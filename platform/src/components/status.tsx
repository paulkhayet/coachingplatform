import { StatusBadge, type Tone } from '@/components/ui/badge'
import type { Appointment, InquiryStage, Issue } from '@/lib/types'
import type { Coverage } from '@/lib/credits'

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  const map: Record<Coverage, [Tone, string]> = {
    eligible: ['success', 'Eligible'],
    payment_needed: ['warning', 'Payment needed'],
    not_required: ['neutral', 'Free call'],
    paid_call: ['success', 'Paid call'],
    no_purchase: ['danger', 'No purchase'],
    not_applicable: ['neutral', 'Not applicable'],
  }
  const [tone, label] = map[coverage]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

export const apptStatusLabel: Record<Appointment['status'], [Tone, string]> = {
  scheduled: ['info', 'Scheduled'],
  attended: ['success', 'Attended'],
  no_show: ['danger', 'No-show'],
  canceled_timely: ['neutral', 'Cancelled'],
  canceled_late: ['warning', 'Late cancel'],
  canceled_business: ['neutral', 'Cancelled by business'],
  canceled_unpaid: ['warning', 'Released (unpaid)'],
}
export function ApptStatusBadge({ status }: { status: Appointment['status'] }) {
  const [tone, label] = apptStatusLabel[status]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

export const stageLabel: Record<InquiryStage, [Tone, string]> = {
  new: ['info', 'New'],
  matching: ['info', 'Matching'],
  consult_scheduled: ['neutral', 'Fit call booked'],
  consult_done: ['success', 'Ready for offer'],
  offer_sent: ['warning', 'Offer sent'],
  enrolled: ['success', 'Enrolled'],
  waiting: ['neutral', 'Waiting'],
  declined: ['neutral', 'Closed'],
}
export function StageBadge({ stage }: { stage: InquiryStage }) {
  const [tone, label] = stageLabel[stage]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

export function IssueKindLabel({ kind }: { kind: Issue['kind'] }) {
  const labels: Record<Issue['kind'], string> = {
    zoom_link: 'Zoom link',
    calendar_sync: 'Calendar sync',
    zoom_summary: 'Zoom summary',
    email_bounce: 'Email delivery',
    payment_failed: 'Payment',
    sms_cap: 'SMS allowance',
  }
  return <span>{labels[kind]}</span>
}
