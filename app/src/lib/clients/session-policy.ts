export function creditCancellationOutcome(input: { by: 'guest' | 'business'; startsAt: Date; now: Date; noticeHours: number; late: 'preserve' | 'forfeit' }) {
  const timely = input.startsAt.getTime() - input.now.getTime() >= input.noticeHours * 3_600_000
  return input.by === 'guest' && !timely && input.late === 'forfeit' ? 'forfeited' : 'released'
}
