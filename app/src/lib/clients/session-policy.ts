export const MAX_WEEKLY_SESSIONS = 26

export function creditCancellationOutcome(input: { by: 'guest' | 'business'; startsAt: Date; now: Date; noticeHours: number; late: 'preserve' | 'forfeit' }) {
  const timely = input.startsAt.getTime() - input.now.getTime() >= input.noticeHours * 3_600_000
  return input.by === 'guest' && !timely && input.late === 'forfeit' ? 'forfeited' : 'released'
}

/** What a family cancelling now would do to a covered session's credit, for the warning they see first. */
export function familyCancellationOutcome(booking: { startsAt: Date; creditNoticeHours: number | null; creditLateCancellation: 'preserve' | 'forfeit' | null; creditCoveredAt: Date | null }, now: Date) {
  if (!booking.creditCoveredAt || booking.creditNoticeHours === null || !booking.creditLateCancellation) return 'released' as const
  return creditCancellationOutcome({ by: 'guest', startsAt: booking.startsAt, now, noticeHours: booking.creditNoticeHours, late: booking.creditLateCancellation })
}
