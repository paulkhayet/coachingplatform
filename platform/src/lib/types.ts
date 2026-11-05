export type ID = string
export type ISO = string

export type Role = 'owner' | 'admin' | 'coach'
export type PlanId = 'free' | 'solo' | 'studio' | 'practice'
export type PortalState = 'none' | 'invited' | 'active'

export interface Policies {
  bookingMode: 'funded_only' | 'advance'
  autoCancelUnpaid: boolean
  unpaidCutoffHours: number
  cancelNoticeHours: number
  lateCancelOutcome: 'forfeit' | 'preserve'
  noShowOutcome: 'forfeit' | 'preserve'
  makeupWindowDays: number
  minNoticeHours: number
  bookingWindowDays: number
  bufferMinutes: number
  followUpMode: 'manual' | 'automatic'
  autoSendAudiences: { student: boolean; parent: boolean }
  emailReminderHours: number[]
  smsEnabled: boolean
  smsReminderHours: number
  smsQuietHours: boolean
  poolAccessDays: number
  workflow: 'direct' | 'team'
}

export type IntegrationKey = 'google' | 'zoom' | 'stripe' | 'esign' | 'sms' | 'ai'
export interface Integration {
  status: 'connected' | 'disconnected' | 'error' | 'not_selected'
  account?: string
  note?: string
}

export interface Business {
  id: ID
  name: string
  slug: string
  timezoneLabel: string
  plan: PlanId
  pendingPlanChange?: { to: PlanId; effective: ISO; keepStaffIds: ID[] }
  policies: Policies
  integrations: Record<IntegrationKey, Integration>
  setupDismissed?: boolean
  usage: { smsThisMonth: number; aiDraftsThisMonth: number; signaturesThisMonth: number }
}

export interface Availability {
  weekday: number // 0 = Sunday
  start: string // HH:mm
  end: string
}

export interface Staff {
  id: ID
  name: string
  email: string
  role: Role
  coaches: boolean
  title: string
  status: 'active' | 'invited' | 'inactive'
  availability: Availability[]
  googleConnected: boolean
  calendarHealthy: boolean
  financial?: boolean
  invitedAt?: ISO
}

export interface Pool {
  id: ID
  name: string
  coachIds: ID[]
}

export interface Guardian {
  id: ID
  name: string
  email: string
  phone?: string
  smsOptIn: boolean
  portal: PortalState
}

export interface GuardianLink {
  guardianId: ID
  relationship: string
  canBook: boolean
  followUps: boolean
  homework: boolean
  billing: boolean
  payer: boolean
  signer: boolean
}

export type EnrollmentStatus = 'prospect' | 'pending' | 'active' | 'completed'

export interface Student {
  id: ID
  name: string
  email?: string
  phone?: string
  smsOptIn: boolean
  grade: string
  school: string
  goals: string
  assignedCoachId: ID | null
  poolId: ID | null
  status: EnrollmentStatus
  portal: PortalState
  studentCanBook: boolean
  independent: boolean
  guardians: GuardianLink[]
  source: string
  createdAt: ISO
  manualEntry?: boolean
}

export interface SessionType {
  id: ID
  name: string
  minutes: number
  credits: number
  meeting: 'zoom' | 'in_person' | 'manual'
  consultation?: boolean
}

export interface Offering {
  id: ID
  name: string
  kind: 'fixed' | 'monthly'
  description: string
  credits: number
  priceCents: number
  installmentOptions: number[]
  termWeeks: number
  sessionTypeIds: ID[]
  poolId?: ID | null
  cancelNoticeHours: number
  active: boolean
}

export interface Question {
  id: ID
  label: string
  type: 'text' | 'textarea' | 'single' | 'multi' | 'phone'
  required: boolean
  options: string[]
}

/** A Calendly-style booking page: a bookable call with its own price and questionnaire. */
export interface EventType {
  id: ID
  slug: string
  name: string
  description: string
  minutes: number
  location: 'zoom' | 'in_person' | 'phone'
  hostIds: ID[]
  hostMode: 'choose' | 'any'
  priceCents: number
  refundCutoffHours: number
  minNoticeHours: number
  bookingWindowDays: number
  bufferMinutes: number
  askStudent: boolean
  questions: Question[]
  active: boolean
  color: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose'
}

export interface Answer {
  questionId: ID
  label: string
  value: string
}

export interface GuestPayment {
  amountCents: number
  status: 'paid' | 'refunded' | 'kept'
  ref: string
  paidAt: ISO
  refundedAt?: ISO
}

export type InquiryStage = 'new' | 'matching' | 'consult_scheduled' | 'consult_done' | 'offer_sent' | 'enrolled' | 'waiting' | 'declined'

export interface Inquiry {
  id: ID
  studentName: string
  grade: string
  school: string
  guardianName: string
  guardianEmail: string
  guardianPhone?: string
  studentEmail?: string
  independent: boolean
  goals: string
  availability: string
  source: string
  createdAt: ISO
  stage: InquiryStage
  responsibleId: ID
  matchedCoachId?: ID
  consultApptId?: ID
  fitOutcome?: 'fit' | 'not_fit' | 'follow_up'
  fitNotes?: string
  handoffNote?: string
  offerId?: ID
  studentId?: ID
  eventTypeId?: ID
  answers?: Answer[]
}

export interface OfferOption {
  offeringId: ID
  name: string
  kind: 'fixed' | 'monthly'
  credits: number
  priceCents: number
  installments: number
  termWeeks: number
  sessionTypeIds: ID[]
}

export type OfferStatus = 'sent' | 'accepted' | 'signed' | 'paid' | 'declined' | 'expired' | 'voided'

export interface Offer {
  id: ID
  token: string
  inquiryId: ID
  coachId: ID
  options: OfferOption[]
  selected?: number
  status: OfferStatus
  version: number
  policy: { cancelNoticeHours: number; lateCancelOutcome: Policies['lateCancelOutcome']; makeupWindowDays: number }
  sentAt: ISO
  expiresAt: ISO
  signedAt?: ISO
  signerName?: string
  paidAt?: ISO
  createdBy: ID
  purchaseId?: ID
}

export interface Installment {
  id: ID
  dueDate: ISO
  amountCents: number
  status: 'scheduled' | 'paid' | 'failed' | 'processing'
  paidAt?: ISO
  ref?: string
  historical?: boolean
}

export interface Purchase {
  id: ID
  studentId: ID
  offerId?: ID
  name: string
  kind: 'fixed' | 'monthly'
  credits: number // total for fixed, per cycle for monthly
  priceCents: number // total for fixed, per cycle for monthly
  startDate: ISO
  endDate: ISO
  sessionTypeIds: ID[]
  installments: Installment[]
  status: 'active' | 'completed' | 'ended'
  policy: Offer['policy']
  historical?: { verifiedBy: ID; note: string; at: ISO }
}

export interface CreditAdjustment {
  id: ID
  purchaseId: ID
  credits: number
  reason: string
  by: ID
  at: ISO
}

export type ApptStatus = 'scheduled' | 'attended' | 'no_show' | 'canceled_timely' | 'canceled_late' | 'canceled_business' | 'canceled_unpaid'

export interface Appointment {
  id: ID
  studentId: ID | null
  inquiryId?: ID
  coachId: ID
  sessionTypeId: ID
  purchaseId: ID | null
  kind: 'coaching' | 'consultation'
  start: ISO
  minutes: number
  credits: number
  status: ApptStatus
  seriesId?: ID
  isMakeup?: boolean
  viaPool?: boolean
  meeting: { type: 'zoom' | 'in_person' | 'manual' | 'phone'; url?: string; location?: string; status: 'ready' | 'pending' | 'error' }
  policy: { noticeHours: number; lateOutcome: Policies['lateCancelOutcome']; noShowOutcome: Policies['noShowOutcome'] }
  lateOutcomeApplied?: 'forfeit' | 'preserve'
  canceledAt?: ISO
  canceledBy?: string
  cancelReason?: string
  exception?: { by: ID; reason: string }
  createdAt: ISO
  createdBy: string
  eventTypeId?: ID
  guest?: { name: string; email: string; phone?: string }
  answers?: Answer[]
  payment?: GuestPayment
  manageToken?: string
  privateNotes?: string
  source?: { kind: 'zoom' | 'manual' | 'transcript'; status: 'pending' | 'ready' | 'unavailable'; text: string; at?: ISO }
}

export interface CalendarBlock {
  id: ID
  coachId: ID
  start: ISO
  end: ISO
  title: string
}

export interface FollowUpVersion {
  audience: 'student' | 'parent' | 'shared'
  subject: string
  body: string
}

export interface Delivery {
  recipient: string
  recipientKind: 'student' | 'guardian'
  version: FollowUpVersion['audience']
  status: 'delivered' | 'sent' | 'held'
  reason?: string
}

export interface FollowUp {
  id: ID
  appointmentId: ID
  studentId: ID
  coachId: ID
  mode: 'separate' | 'shared'
  versions: FollowUpVersion[]
  status: 'draft' | 'published' | 'held'
  sourceKind: 'zoom' | 'manual' | 'transcript'
  createdAt: ISO
  publishedAt?: ISO
  publishedBy?: ID
  deliveries: Delivery[]
  holdReason?: string
}

export interface Homework {
  id: ID
  studentId: ID
  coachId: ID
  appointmentId?: ID
  title: string
  instructions: string
  due?: ISO
  status: 'draft' | 'assigned' | 'complete' | 'reviewed'
  guardiansCanSee: boolean
  response?: string
  completedAt?: ISO
  createdAt: ISO
  fileIds: ID[]
}

export interface SharedFile {
  id: ID
  name: string
  sizeKb: number
  uploadedBy: ID
  studentIds: ID[]
  createdAt: ISO
}

export interface Task {
  id: ID
  title: string
  detail: string
  assigneeId: ID
  kind: 'handoff' | 'payment' | 'followup' | 'issue' | 'renewal' | 'makeup' | 'calendar' | 'setup'
  link?: string
  status: 'open' | 'done'
  createdAt: ISO
  due?: ISO
}

export interface Issue {
  id: ID
  kind: 'zoom_link' | 'calendar_sync' | 'zoom_summary' | 'email_bounce' | 'payment_failed' | 'sms_cap'
  title: string
  detail: string
  ownerId: ID
  link?: string
  status: 'open' | 'resolved'
  createdAt: ISO
  history: { at: ISO; text: string }[]
}

export interface Notification {
  id: ID
  at: ISO
  channel: 'email' | 'sms'
  to: string
  subject: string
  status: 'scheduled' | 'sent' | 'delivered' | 'suppressed' | 'failed'
  reason?: string
}

export interface AuditEvent {
  id: ID
  at: ISO
  actor: string
  action: string
  detail: string
}

export interface Grant {
  id: ID
  staffId: ID
  studentId: ID
  scope: 'client' | 'private_notes'
  reason: string
  grantedBy: ID
  expiresAt?: ISO
}

export type Viewer =
  | { kind: 'staff'; id: ID }
  | { kind: 'guardian'; id: ID; studentId: ID }
  | { kind: 'student'; id: ID }

export interface DB {
  version: number
  business: Business
  staff: Staff[]
  pools: Pool[]
  guardians: Guardian[]
  students: Student[]
  sessionTypes: SessionType[]
  offerings: Offering[]
  eventTypes: EventType[]
  inquiries: Inquiry[]
  offers: Offer[]
  purchases: Purchase[]
  adjustments: CreditAdjustment[]
  appointments: Appointment[]
  calendarBlocks: CalendarBlock[]
  followUps: FollowUp[]
  homework: Homework[]
  files: SharedFile[]
  tasks: Task[]
  issues: Issue[]
  notifications: Notification[]
  audit: AuditEvent[]
  grants: Grant[]
}
