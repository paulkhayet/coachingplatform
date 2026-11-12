import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import { adminDb, type AdminDb } from '@/db/server'
import { businesses, clientGuardians, coachingClients, familyAccess, profiles } from '@/db/schema'
import { siteUrl } from '@/lib/env'
import { sendEmail } from '@/lib/email/server'
import { familyInviteEmail } from '@/lib/booking/emails'
import { businessLogoUrl } from '@/lib/business-logo'
import { hashToken, looksLikeToken } from '@/lib/team/invitations'

// D-073: owners and administrators invite a guardian contact to the family portal. Same link scheme as team
// invitations (D-060): a random token, only its hash stored, one use, 14 days, invited email only.

export const FAMILY_INVITE_DAYS = 14
export const familyInviteUrl = (token: string) => `${siteUrl}/family/join/${token}`

export type FamilyPermissions = { canViewSessions: boolean; canViewCredits: boolean; canReschedule: boolean; canBook: boolean }

/** Creates or renews the guardian's invitation and emails it. Callers check the inviter may manage clients. */
export async function sendFamilyInvite(opts: {
  businessId: string
  guardianId: string
  inviter: { id: string; name: string; email: string }
}, db: AdminDb = adminDb()): Promise<{ url: string; emailed: boolean } | { error: string }> {
  const [g] = await db
    .select({ id: clientGuardians.id, clientId: clientGuardians.clientId, email: clientGuardians.email, clientName: coachingClients.name, businessName: businesses.name, logoPath: businesses.logoPath })
    .from(clientGuardians)
    .innerJoin(coachingClients, and(eq(coachingClients.id, clientGuardians.clientId), eq(coachingClients.businessId, clientGuardians.businessId)))
    .innerJoin(businesses, eq(businesses.id, clientGuardians.businessId))
    .where(and(eq(clientGuardians.id, opts.guardianId), eq(clientGuardians.businessId, opts.businessId)))
  if (!g) return { error: 'This guardian contact could not be found.' }
  if (!g.email) return { error: 'Add an email address to this contact before inviting them.' }
  const email = g.email.trim().toLowerCase()

  const [existing] = await db.select().from(familyAccess).where(eq(familyAccess.guardianId, g.id))
  if (existing?.acceptedAt && !existing.revokedAt && existing.email === email) return { error: 'This guardian already has portal access.' }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + FAMILY_INVITE_DAYS * 86_400_000)
  // A new invitation (or one after access was turned off) starts fresh: the old link stops working,
  // and the person has to accept again. Permission switches carry over.
  const fields = {
    email, tokenHash: hashToken(token), expiresAt, invitedBy: opts.inviter.id, invitedAt: new Date(),
    userId: null, acceptedAt: null, revokedAt: null,
  }
  if (existing) await db.update(familyAccess).set(fields).where(eq(familyAccess.id, existing.id))
  else await db.insert(familyAccess).values({ businessId: opts.businessId, clientId: g.clientId, guardianId: g.id, ...fields })

  const url = familyInviteUrl(token)
  const emailed = await sendEmail(email, familyInviteEmail({ businessName: g.businessName, logoUrl: businessLogoUrl(g.logoPath), inviterName: opts.inviter.name, clientName: g.clientName, url, expires: expiresAt }), { replyTo: opts.inviter.email })
  return { url, emailed }
}

export interface FamilyInviteView {
  id: string
  email: string
  businessName: string
  clientName: string
  inviterName: string | null
  state: 'open' | 'expired'
}

/** What the family join page shows. Null when the link isn't (or is no longer) a valid invitation. */
export async function findFamilyInvite(token: string, db: AdminDb = adminDb()): Promise<FamilyInviteView | null> {
  if (!looksLikeToken(token)) return null
  const [row] = await db
    .select({ id: familyAccess.id, email: familyAccess.email, expiresAt: familyAccess.expiresAt, businessName: businesses.name, clientName: coachingClients.name, inviterName: profiles.fullName })
    .from(familyAccess)
    .innerJoin(businesses, eq(businesses.id, familyAccess.businessId))
    .innerJoin(coachingClients, and(eq(coachingClients.id, familyAccess.clientId), eq(coachingClients.businessId, familyAccess.businessId)))
    .leftJoin(profiles, eq(profiles.id, familyAccess.invitedBy))
    .where(and(eq(familyAccess.tokenHash, hashToken(token)), isNull(familyAccess.acceptedAt), isNull(familyAccess.revokedAt)))
  if (!row) return null
  return { id: row.id, email: row.email, businessName: row.businessName, clientName: row.clientName, inviterName: row.inviterName, state: row.expiresAt && row.expiresAt > new Date() ? 'open' : 'expired' }
}

/** Open invitations for this email, for people who signed in without using the link. */
export async function openFamilyInvitesFor(email: string, db: AdminDb = adminDb()) {
  if (!email) return []
  return db
    .select({ id: familyAccess.id, businessName: businesses.name, clientName: coachingClients.name })
    .from(familyAccess)
    .innerJoin(businesses, eq(businesses.id, familyAccess.businessId))
    .innerJoin(coachingClients, and(eq(coachingClients.id, familyAccess.clientId), eq(coachingClients.businessId, familyAccess.businessId)))
    .where(and(eq(familyAccess.email, email.toLowerCase()), isNull(familyAccess.acceptedAt), isNull(familyAccess.revokedAt), isNotNull(familyAccess.tokenHash), gt(familyAccess.expiresAt, new Date())))
}

export type FamilyAcceptResult = { ok: true; clientId: string } | { ok: false; reason: 'gone' | 'expired' | 'wrong-email' | 'unverified' }

/** Links the signed-in account to the client. By link token, or by id for an invitation to the person's own email. */
export async function acceptFamilyInvite(
  by: { token: string } | { id: string },
  user: { id: string; email: string | null | undefined; emailConfirmed: boolean },
  db: AdminDb = adminDb(),
): Promise<FamilyAcceptResult> {
  if ('token' in by && !looksLikeToken(by.token)) return { ok: false, reason: 'gone' }
  if (!user.emailConfirmed || !user.email) return { ok: false, reason: 'unverified' }
  const email = user.email.toLowerCase()
  return db.transaction(async (tx): Promise<FamilyAcceptResult> => {
    const [row] = await tx.select().from(familyAccess)
      .where('token' in by ? eq(familyAccess.tokenHash, hashToken(by.token)) : and(eq(familyAccess.id, by.id), eq(familyAccess.email, email)))
      .for('update')
    if (!row || row.acceptedAt || row.revokedAt || !row.tokenHash) return { ok: false, reason: 'gone' }
    if (!row.expiresAt || row.expiresAt <= new Date()) return { ok: false, reason: 'expired' }
    if (row.email !== email) return { ok: false, reason: 'wrong-email' }
    await tx.update(familyAccess).set({ userId: user.id, acceptedAt: new Date(), tokenHash: null }).where(eq(familyAccess.id, row.id))
    return { ok: true, clientId: row.clientId }
  })
}

/** Turns portal access off (and voids any open link). The row stays so it can be re-invited. */
export async function revokeFamilyAccess(businessId: string, accessId: string, db: AdminDb = adminDb()) {
  const rows = await db.update(familyAccess).set({ revokedAt: new Date(), tokenHash: null })
    .where(and(eq(familyAccess.id, accessId), eq(familyAccess.businessId, businessId), isNull(familyAccess.revokedAt)))
    .returning({ id: familyAccess.id })
  return rows.length > 0
}

export async function setFamilyPermissions(businessId: string, accessId: string, permissions: FamilyPermissions, db: AdminDb = adminDb()) {
  const rows = await db.update(familyAccess).set(permissions)
    .where(and(eq(familyAccess.id, accessId), eq(familyAccess.businessId, businessId)))
    .returning({ id: familyAccess.id })
  return rows.length > 0
}
