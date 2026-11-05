import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns'

export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)

export const credits = (n: number) => {
  const r = Math.round(n * 100) / 100
  return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(r * 10 % 1 === 0 ? 1 : 2)} ${Math.abs(r) === 1 ? 'credit' : 'credits'}`
}
export const num = (n: number) => {
  const r = Math.round(n * 100) / 100
  return r % 1 === 0 ? r.toFixed(0) : String(r)
}

export const time = (iso: string) => format(new Date(iso), 'h:mm a')
export const date = (iso: string) => format(new Date(iso), 'MMM d, yyyy')
export const shortDate = (iso: string) => format(new Date(iso), 'EEE, MMM d')
export const dateTime = (iso: string) => format(new Date(iso), "EEE, MMM d 'at' h:mm a")

export function dayLabel(iso: string) {
  const d = new Date(iso)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, MMM d')
}
export function relative(iso: string) {
  const d = new Date(iso)
  const s = formatDistanceToNowStrict(d, { addSuffix: true })
  return s
}

export const tzLabel = () => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? 'local time'
  } catch {
    return 'local time'
  }
}

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`
