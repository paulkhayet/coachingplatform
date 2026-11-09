import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import { businesses, invitations, memberships, profiles, type MemberRole } from '@/db/schema'
import { siteUrl } from '@/lib/env'
import { sendEmail } from '@/lib/email/server'
import { teamInviteEmail } from '@/lib/booking/emails'
import { roleLabel } from '@/lib/roles'

// D-060: owners invite people by email. The link carries a random token and we store only its hash, so a
// database leak can't be turned into working links. Accepting needs a signed-in account with the invited email.

export const INVITE_DAYS = 14
const MAX_OPEN_INVITES = 50

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const inviteUrl = (token: string) => `${siteUrl}/join/${token}`
const newToken = () => randomBytes(32).toString('base64url')
/** Tokens are 43 base64url characters; anything else is rejected before touching the database. */
export const looksLikeToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)

export type InviteRole = Exclude<MemberRole, 'owner'>

export interface SentInvite {
  url: string
  emailed: boolean
}

/** Creates (or replaces) the open invitation for this email and emails the link. Callers check the owner. */
export async function sendInvitation(opts: {
  businessId: string
  businessName: string
  inviter: { id: string; name: string; email: string }
  email: string
  role: InviteRole
  coaches: boolean
  title: string | null
}, db: AdminDb = adminDb()): Promise<SentInvite | { error: string }> {
  const email = opts.email.trim().toLowerCase()
  const [member] = await db
    .select({ status: memberships.status })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.id, memberships.userId))
    .where(and(eq(memberships.businessId, opts.businessId), sql`lower(${profiles.email}) = ${email}`, eq(memberships.status, 'active')))
  if (member) return { error: 'That person is already on your team.' }
  const open = await db.$count(invitations, and(eq(invitations.businessId, opts.businessId), isNull(invitations.acceptedAt)))
  if (open >= MAX_OPEN_INVITES) return { error: `You have ${MAX_OPEN_INVITES} open invitations. Cancel some before sending more.` }

  const token = newToken()
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000)
  const coaches = opts.role === 'coach' ? true : opts.coaches
  const fields = { role: opts.role, coaches, title: opts.title, tokenHash: hashToken(token), invitedBy: opts.inviter.id, createdAt: new Date(), expiresAt }
  // Inviting the same email again replaces the old link (same invitation, so the team page keeps its place).
  const replaced = await db
    .update(invitations)
    .set(fields)
    .where(and(eq(invitations.businessId, opts.businessId), eq(invitations.email, email), isNull(invitations.acceptedAt)))
    .returning({ id: invitations.id })
  if (replaced.length === 0) await db.insert(invitations).values({ businessId: opts.businessId, email, ...fields })
  const url = inviteUrl(token)
  const emailed = await sendEmail(email, teamInviteEmail({ businessName: opts.businessName, inviterName: opts.inviter.name, roleLabel: roleLabel[opts.role], url, expires: expiresAt }), { replyTo: opts.inviter.email })
  return { url, emailed }
}

export interface InvitationView {
  id: string
  businessId: string
  businessName: string
  email: string
  role: InviteRole
  inviterName: string | null
  state: 'open' | 'expired' | 'accepted'
}

/** What the join page shows for a link. Null when the link isn't one of ours (or was replaced or cancelled). */
export async function findInvitation(token: string, db: AdminDb = adminDb()): Promise<InvitationView | null> {
  if (!looksLikeToken(token)) return null
  const [row] = await db
    .select({ id: invitations.id, businessId: invitations.businessId, businessName: businesses.name, email: invitations.email, role: invitations.role, inviterName: profiles.fullName, expiresAt: invitations.expiresAt, acceptedAt: invitations.acceptedAt })
    .from(invitations)
    .innerJoin(businesses, eq(businesses.id, invitations.businessId))
    .leftJoin(profiles, eq(profiles.id, invitations.invitedBy))
    .where(eq(invitations.tokenHash, hashToken(token)))
  if (!row) return null
  const state = row.acceptedAt ? 'accepted' : row.expiresAt <= new Date() ? 'expired' : 'open'
  return { id: row.id, businessId: row.businessId, businessName: row.businessName, email: row.email, role: row.role as InviteRole, inviterName: row.inviterName, state }
}

/** Open invitations for this email, for people who signed up without using the link. */
export async function openInvitationsFor(email: string) {
  if (!email) return []
  return adminDb()
    .select({ id: invitations.id, businessId: invitations.businessId, businessName: businesses.name, role: invitations.role })
    .from(invitations)
    .innerJoin(businesses, eq(businesses.id, invitations.businessId))
    .where(and(eq(invitations.email, email.toLowerCase()), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())))
}

export type AcceptResult = { ok: true; businessId: string; alreadyMember: boolean } | { ok: false; reason: 'gone' | 'expired' | 'used' | 'wrong-email' | 'unverified' }

/** Joins the business. The invitation is looked up by link token or (for the signed-in person's own email) by id. */
export async function acceptInvitation(
  by: { token: string } | { id: string },
  user: { id: string; email: string | null | undefined; emailConfirmed: boolean },
  db: AdminDb = adminDb(),
): Promise<AcceptResult> {
  if ('token' in by && !looksLikeToken(by.token)) return { ok: false, reason: 'gone' }
  if (!user.emailConfirmed || !user.email) return { ok: false, reason: 'unverified' }
  const email = user.email.toLowerCase()
  return db.transaction(async (tx): Promise<AcceptResult> => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where('token' in by ? eq(invitations.tokenHash, hashToken(by.token)) : and(eq(invitations.id, by.id), eq(invitations.email, email)))
      .for('update')
    if (!inv) return { ok: false, reason: 'gone' }
    if (inv.acceptedAt) return { ok: false, reason: 'used' }
    if (inv.expiresAt <= new Date()) return { ok: false, reason: 'expired' }
    if (inv.email !== email) return { ok: false, reason: 'wrong-email' }

    const [existing] = await tx.select({ id: memberships.id, status: memberships.status }).from(memberships).where(and(eq(memberships.businessId, inv.businessId), eq(memberships.userId, user.id)))
    const alreadyMember = existing?.status === 'active'
    if (!existing) {
      await tx.insert(memberships).values({ businessId: inv.businessId, userId: user.id, role: inv.role, status: 'active', coaches: inv.coaches, financial: false, title: inv.title })
    } else if (!alreadyMember) {
      // Someone who left or was removed comes back with the invited role, without any old delegation.
      await tx.update(memberships).set({ role: inv.role, status: 'active', coaches: inv.coaches, financial: false, title: inv.title }).where(eq(memberships.id, existing.id))
    }
    await tx.update(invitations).set({ acceptedAt: new Date(), acceptedBy: user.id }).where(eq(invitations.id, inv.id))
    return { ok: true, businessId: inv.businessId, alreadyMember }
  })
}
