import type { DB, Appointment, FollowUpVersion, Delivery, FollowUp } from './types'

const first = (name: string) => name.split(' ')[0]

function sentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

/** Simulated drafting step. The text-generation provider is unselected (product spec §13), so this
 *  deterministic stand-in rewrites the permitted source into audience-specific drafts for review. */
export function draftFollowUp(db: DB, a: Appointment, mode: 'separate' | 'shared'): FollowUpVersion[] {
  const s = db.students.find((x) => x.id === a.studentId)!
  const coach = db.staff.find((x) => x.id === a.coachId)!
  const src = a.source?.text ?? ''
  const all = sentences(src)
  const wins = all.filter((x) => /(built|finished|completed|improv|progress|proud|managed|figured|got|made)/i.test(x)).slice(0, 2)
  const next = all.filter((x) => /(next|will|plan|try|goal|before|by |agreed|commit)/i.test(x)).slice(0, 3)
  const hw = db.homework.filter((h) => h.appointmentId === a.id && h.status !== 'draft')
  const bullets = (xs: string[]) => xs.map((x) => `• ${x.replace(/^(we|they) /i, '')}`).join('\n')
  const date = new Date(a.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const studentBody = [
    `Hi ${first(s.name)},`,
    '',
    wins.length ? `Nice work in today's session. ${wins.join(' ')}` : `Thanks for a focused session today.`,
    '',
    next.length ? `What we agreed for this week:\n${bullets(next)}` : 'Keep going with the plan we talked through.',
    hw.length ? `\nHomework: ${hw.map((h) => h.title).join(', ')} (see your portal).` : '',
    '',
    `See you next time,\n${first(coach.name)}`,
  ].join('\n')

  const parentBody = [
    `Hello,`,
    '',
    `Here is a short update from ${first(s.name)}'s session on ${date}.`,
    '',
    wins.length ? `Progress worth noticing: ${wins.join(' ')}` : `${first(s.name)} stayed engaged and worked through this week's priorities.`,
    '',
    next.length ? `Next steps ${first(s.name)} agreed to:\n${bullets(next)}` : '',
    '',
    `You can support by asking ${first(s.name)} how the plan is going, rather than checking each task.`,
    '',
    `Best,\n${coach.name}`,
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')

  if (mode === 'shared') {
    return [{ audience: 'shared', subject: `Session recap — ${date}`, body: studentBody.replace(`Hi ${first(s.name)},`, `Hi ${first(s.name)} and family,`) }]
  }
  return [
    { audience: 'student', subject: `Your next steps from ${date}`, body: studentBody },
    { audience: 'parent', subject: `${first(s.name)}'s session update — ${date}`, body: parentBody },
  ]
}

/** Each recipient receives only the version their own permissions allow (P-13). */
export function plannedDeliveries(db: DB, f: Pick<FollowUp, 'studentId' | 'versions' | 'mode'>): Delivery[] {
  const s = db.students.find((x) => x.id === f.studentId)!
  const out: Delivery[] = []
  const has = (aud: FollowUpVersion['audience']) => f.versions.some((v) => v.audience === aud)
  const studentVersion = has('student') ? 'student' : has('shared') ? 'shared' : null
  const parentVersion = has('parent') ? 'parent' : has('shared') ? 'shared' : null
  if (studentVersion) out.push({ recipient: s.name, recipientKind: 'student', version: studentVersion, status: s.portal === 'active' || s.email ? 'sent' : 'held', reason: s.portal === 'active' || s.email ? undefined : 'No verified student contact' })
  for (const link of s.guardians) {
    const g = db.guardians.find((x) => x.id === link.guardianId)!
    if (!link.followUps) {
      out.push({ recipient: g.name, recipientKind: 'guardian', version: parentVersion ?? 'shared', status: 'held', reason: 'Not permitted to receive follow-ups' })
    } else if (parentVersion) {
      out.push({ recipient: g.name, recipientKind: 'guardian', version: parentVersion, status: 'sent' })
    }
  }
  return out
}
