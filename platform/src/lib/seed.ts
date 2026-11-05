import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'
import type { Appointment, DB, Availability, ApptStatus, Installment } from './types'
import { draftFollowUp, plannedDeliveries } from './followups'

export const DB_VERSION = 5

const at = (day: number, hm = '09:00') => {
  const [h, m] = hm.split(':').map(Number)
  return setMinutes(setHours(addDays(startOfDay(new Date()), day), h), m).toISOString()
}
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

const weekdays = (start: string, end: string, days = [1, 2, 3, 4, 5]): Availability[] => days.map((weekday) => ({ weekday, start, end }))

const SOURCES: Record<string, string> = {
  sophie:
    'Sophie reviewed last week. She built a weekly plan on Sunday night and finished three of four tasks. She said starting is the hardest part, especially with chemistry. We agreed she will try the five-minute start before tackling a bigger task. Next step: use the planner each evening before dinner. She will message her chemistry teacher about the lab redo by Friday.',
  jamie:
    'Jamie came in frustrated about a missed history assignment. We broke the project into three parts and he figured out that the research step was what stalled him. He made a checklist for the next history project and was proud of how quickly the outline came together. Next step: Jamie will set up a homework tracker and check it after school. He agreed to show his outline to his teacher before Wednesday.',
}

let n = 0
const id = (p: string) => `${p}_${++n}`

function appt(o: Partial<Appointment> & Pick<Appointment, 'studentId' | 'coachId' | 'start'>): Appointment {
  return {
    id: id('ap'),
    sessionTypeId: 'stype_60',
    purchaseId: null,
    kind: 'coaching',
    minutes: 60,
    credits: 1,
    status: 'scheduled',
    meeting: { type: 'zoom', url: `https://zoom.us/j/8${Math.floor(Math.random() * 1e9)}`, status: 'ready' },
    policy: { noticeHours: 24, lateOutcome: 'forfeit', noShowOutcome: 'forfeit' },
    createdAt: ago(45),
    createdBy: 'seed',
    ...o,
  }
}

function series(base: Omit<Partial<Appointment>, 'status'> & Pick<Appointment, 'studentId' | 'coachId'>, days: number[], hm: string, statuses: ApptStatus[], seriesId?: string) {
  return days.map((d, i) =>
    appt({
      ...base,
      start: at(d, hm),
      status: statuses[i] ?? 'scheduled',
      seriesId,
      ...(statuses[i] === 'canceled_timely' ? { canceledAt: at(d - 3, '10:00'), canceledBy: 'Family', cancelReason: 'School trip' } : {}),
    }),
  )
}

const inst = (dueDay: number, cents: number, status: Installment['status'], extra?: Partial<Installment>): Installment => ({
  id: id('in'),
  dueDate: at(dueDay, '08:00'),
  amountCents: cents,
  status,
  paidAt: status === 'paid' ? at(dueDay, '08:05') : undefined,
  ref: status === 'paid' ? `pi_${Math.random().toString(36).slice(2, 12)}` : undefined,
  ...extra,
})

export function buildSeed(): DB {
  n = 0
  const policy = { cancelNoticeHours: 24, lateCancelOutcome: 'forfeit' as const, makeupWindowDays: 30 }

  const appointments: Appointment[] = [
    // Sophie — 12-credit semester, two of three installments paid → 8 funded
    ...series({ studentId: 's_sophie', coachId: 'st_priya', purchaseId: 'pu_sophie' }, [-38, -31, -24, -17, -10, -3], '15:30', ['attended', 'attended', 'canceled_timely', 'attended', 'attended', 'attended'], 'ser_sophie'),
    ...series({ studentId: 's_sophie', coachId: 'st_priya', purchaseId: 'pu_sophie', createdAt: ago(38) }, [0, 7, 14, 21, 28], '15:30', [], 'ser_sophie'),
    // Noah — exam sprint, second installment failed → 0 funded remaining
    ...series({ studentId: 's_noah', coachId: 'st_priya', purchaseId: 'pu_noah' }, [-18, -11, -4], '16:30', ['attended', 'attended', 'attended'], 'ser_noah'),
    ...series({ studentId: 's_noah', coachId: 'st_priya', purchaseId: 'pu_noah', createdAt: ago(20) }, [0, 7], '16:30', [], 'ser_noah'),
    // Maya — independent college student, monthly arrangement
    ...series({ studentId: 's_maya', coachId: 'st_daniel', purchaseId: 'pu_maya' }, [-38, -31, -24, -17], '17:00', ['attended', 'attended', 'attended', 'attended']),
    ...series({ studentId: 's_maya', coachId: 'st_daniel', purchaseId: 'pu_maya', sessionTypeId: 'stype_inperson', meeting: { type: 'in_person', location: 'Willow Coaching studio, 214 Elm St', status: 'ready' } }, [-8, -1], '17:00', ['attended', 'attended']),
    ...series({ studentId: 's_maya', coachId: 'st_daniel', purchaseId: 'pu_maya', sessionTypeId: 'stype_inperson', meeting: { type: 'in_person', location: 'Willow Coaching studio, 214 Elm St', status: 'ready' }, createdAt: ago(9) }, [6, 13], '17:00', []),
    // Jamie — paid in full, owner-coached
    ...series({ studentId: 's_jamie', coachId: 'st_eleni', purchaseId: 'pu_jamie' }, [-27, -20, -13, -6, -1], '14:00', ['attended', 'attended', 'attended', 'attended', 'attended'], 'ser_jamie'),
    ...series({ studentId: 's_jamie', coachId: 'st_eleni', purchaseId: 'pu_jamie', createdAt: ago(28) }, [6, 13, 20], '14:00', [], 'ser_jamie'),
    // Ethan — program ended five days ago with one preserved makeup
    ...series({ studentId: 's_ethan', coachId: 'st_daniel', purchaseId: 'pu_ethan' }, [-48, -41, -34, -20], '18:00', ['attended', 'attended', 'attended', 'canceled_timely']),
    appt({ studentId: 's_ethan', coachId: 'st_ava', purchaseId: 'pu_ethan', start: at(-27, '16:00'), status: 'attended', viaPool: true }),
    appt({ studentId: 's_ethan', coachId: 'st_ava', purchaseId: 'pu_ethan', start: at(-9, '16:00'), status: 'attended', viaPool: true }),
    // Lily — existing client entered manually with verified historical coverage
    ...series({ studentId: 's_lily', coachId: 'st_ava', purchaseId: 'pu_lily', createdAt: ago(10) }, [-9, -2], '15:00', ['attended', 'attended']),
    appt({ studentId: 's_lily', coachId: 'st_ava', purchaseId: 'pu_lily', start: at(5, '15:00'), createdAt: ago(2) }),
    // Consultations (free fit calls)
    appt({ studentId: null, inquiryId: 'inq_zoe', kind: 'consultation', coachId: 'st_daniel', start: at(1, '17:00'), sessionTypeId: 'stype_fit', minutes: 20, credits: 0, createdAt: ago(2) }),
    appt({
      studentId: null, inquiryId: 'inq_grace', kind: 'consultation', coachId: 'st_eleni', start: at(2, '15:00'), sessionTypeId: 'stype_fit', minutes: 45, credits: 0, createdAt: ago(1), createdBy: 'Mark Kim (guest)',
      eventTypeId: 'et_strategy', guest: { name: 'Mark Kim', email: 'mark.kim@example.com', phone: '(617) 555-0133' }, manageToken: 'grace-kim-strategy',
      answers: [
        { questionId: 'q_focus', label: 'What should we focus on?', value: 'College application timeline, Organisation' },
        { questionId: 'q_context', label: 'Anything we should know beforehand?', value: 'Grace is juggling varsity soccer and two AP classes. We want a realistic plan for the fall.' },
      ],
      payment: { amountCents: 7500, status: 'paid', ref: 'pi_3Q8strategy', paidAt: ago(1) },
    }),
    appt({ studentId: null, inquiryId: 'inq_henry', kind: 'consultation', coachId: 'st_priya', start: at(-2, '18:00'), sessionTypeId: 'stype_fit', minutes: 20, credits: 0, status: 'attended', createdAt: ago(5) }),
  ]

  const jamieLast = appointments.find((a) => a.studentId === 's_jamie' && a.start === at(-1, '14:00'))!
  jamieLast.source = { kind: 'zoom', status: 'ready', text: SOURCES.jamie, at: at(-1, '15:10') }
  jamieLast.privateNotes = 'Frustration seems tied to the history teacher’s feedback style. Watch for avoidance.'
  const sophieLast = appointments.find((a) => a.studentId === 's_sophie' && a.start === at(-3, '15:30'))!
  sophieLast.source = { kind: 'zoom', status: 'ready', text: SOURCES.sophie, at: at(-3, '16:40') }
  const lilyLast = appointments.find((a) => a.studentId === 's_lily' && a.start === at(-2, '15:00'))!
  lilyLast.source = { kind: 'zoom', status: 'unavailable', text: '' }

  const db: DB = {
    version: DB_VERSION,
    business: {
      id: 'biz_willow',
      name: 'Willow Coaching',
      slug: 'willow-coaching',
      timezoneLabel: 'Eastern Time',
      plan: 'practice',
      policies: {
        bookingMode: 'advance',
        autoCancelUnpaid: true,
        unpaidCutoffHours: 48,
        cancelNoticeHours: 24,
        lateCancelOutcome: 'forfeit',
        noShowOutcome: 'forfeit',
        makeupWindowDays: 30,
        minNoticeHours: 12,
        bookingWindowDays: 60,
        bufferMinutes: 10,
        followUpMode: 'manual',
        autoSendAudiences: { student: false, parent: false },
        emailReminderHours: [24, 1],
        smsEnabled: true,
        smsReminderHours: 2,
        smsQuietHours: true,
        poolAccessDays: 14,
        workflow: 'team',
      },
      integrations: {
        google: { status: 'connected', account: '4 of 5 coaches connected' },
        zoom: { status: 'connected', account: 'eleni@willowcoaching.com' },
        stripe: { status: 'connected', account: 'Willow Coaching LLC · test mode' },
        esign: { status: 'connected', account: 'Simulated signing', note: 'Signing provider not yet selected (Q-04)' },
        sms: { status: 'connected', account: 'Simulated SMS', note: 'SMS provider and allowances not yet selected (Q-01/Q-04)' },
        ai: { status: 'connected', account: 'Simulated drafting', note: 'Text-generation provider not yet selected' },
      },
      usage: { smsThisMonth: 212, aiDraftsThisMonth: 46, signaturesThisMonth: 9 },
    },
    staff: [
      { id: 'st_eleni', name: 'Eleni Morgan', email: 'eleni@willowcoaching.com', role: 'owner', coaches: true, title: 'Founder and coach', status: 'active', availability: weekdays('13:00', '18:00'), googleConnected: true, calendarHealthy: true },
      { id: 'st_marcus', name: 'Marcus Hale', email: 'marcus@willowcoaching.com', role: 'admin', coaches: false, title: 'Operations manager', status: 'active', availability: [], googleConnected: true, calendarHealthy: true, financial: true },
      { id: 'st_priya', name: 'Priya Shah', email: 'priya@willowcoaching.com', role: 'coach', coaches: true, title: 'Academic coach', status: 'active', availability: weekdays('15:00', '20:00', [1, 2, 3, 4, 5, 6]), googleConnected: true, calendarHealthy: true },
      { id: 'st_daniel', name: 'Daniel Kim', email: 'daniel@willowcoaching.com', role: 'coach', coaches: true, title: 'Executive function coach', status: 'active', availability: [...weekdays('16:00', '20:00'), { weekday: 6, start: '09:00', end: '13:00' }], googleConnected: true, calendarHealthy: false },
      { id: 'st_ava', name: 'Ava Thompson', email: 'ava@willowcoaching.com', role: 'coach', coaches: true, title: 'Study skills coach', status: 'active', availability: weekdays('14:00', '19:00'), googleConnected: false, calendarHealthy: true },
      { id: 'st_jordan', name: 'Jordan Rivera', email: 'jordan@willowcoaching.com', role: 'coach', coaches: true, title: 'College admissions coach', status: 'invited', availability: [], googleConnected: false, calendarHealthy: true, invitedAt: ago(3) },
    ],
    pools: [{ id: 'pool_ef', name: 'Executive function pool', coachIds: ['st_priya', 'st_daniel', 'st_ava'] }],
    guardians: [
      { id: 'g_rachel', name: 'Rachel Reynolds', email: 'rachel.reynolds@example.com', phone: '(617) 555-0142', smsOptIn: true, portal: 'active' },
      { id: 'g_tom', name: 'Tom Reynolds', email: 'tom.reynolds@example.com', smsOptIn: false, portal: 'active' },
      { id: 'g_dana', name: 'Dana Carter', email: 'dana.carter@example.com', phone: '(617) 555-0199', smsOptIn: true, portal: 'active' },
      { id: 'g_kevin', name: 'Kevin Lee', email: 'kevin.lee@example.com', phone: '(617) 555-0117', smsOptIn: false, portal: 'active' },
      { id: 'g_susan', name: 'Susan Brooks', email: 'susan.brooks@example.com', smsOptIn: false, portal: 'active' },
      { id: 'g_mei', name: 'Mei Chen', email: 'mei.chen@example.com', phone: '(617) 555-0175', smsOptIn: true, portal: 'active' },
      { id: 'g_wei', name: 'Wei Chen', email: 'wei.chen@example.com', smsOptIn: false, portal: 'invited' },
      { id: 'g_raj', name: 'Raj Patel', email: 'raj.patel@example.com', smsOptIn: false, portal: 'active' },
    ],
    students: [
      { id: 's_sophie', name: 'Sophie Reynolds', email: 'sophie.r@example.com', smsOptIn: false, grade: '10th grade', school: 'Lincoln High School', goals: 'Build a weekly routine and stop falling behind in chemistry.', assignedCoachId: 'st_priya', poolId: null, status: 'active', portal: 'active', studentCanBook: true, independent: false, source: 'Google search', createdAt: ago(50), guardians: [
        { guardianId: 'g_rachel', relationship: 'Mother', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true },
        { guardianId: 'g_tom', relationship: 'Father', canBook: false, followUps: true, homework: true, billing: false, payer: false, signer: false },
      ] },
      { id: 's_noah', name: 'Noah Carter', email: 'noah.carter@example.com', smsOptIn: false, grade: '11th grade', school: 'Brookline High School', goals: 'SAT preparation and test-day pacing.', assignedCoachId: 'st_priya', poolId: null, status: 'active', portal: 'active', studentCanBook: false, independent: false, source: 'Referral', createdAt: ago(25), guardians: [
        { guardianId: 'g_dana', relationship: 'Mother', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true },
      ] },
      { id: 's_maya', name: 'Maya Ortiz', email: 'maya.ortiz@example.edu', phone: '(617) 555-0160', smsOptIn: true, grade: 'College freshman', school: 'Northeastern University', goals: 'Manage a heavier course load and part-time job.', assignedCoachId: 'st_daniel', poolId: null, status: 'active', portal: 'active', studentCanBook: true, independent: true, source: 'Instagram', createdAt: ago(42), guardians: [] },
      { id: 's_jamie', name: 'Jamie Lee', smsOptIn: false, email: 'jamie.lee@example.com', grade: '8th grade', school: 'Pierce Middle School', goals: 'Organisation, long-term projects, and confidence.', assignedCoachId: 'st_eleni', poolId: null, status: 'active', portal: 'active', studentCanBook: false, independent: false, source: 'School counselor', createdAt: ago(32), guardians: [
        { guardianId: 'g_kevin', relationship: 'Father', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true },
      ] },
      { id: 's_ethan', name: 'Ethan Brooks', email: 'ethan.brooks@example.com', smsOptIn: false, grade: '12th grade', school: 'Newton North High School', goals: 'Finish college applications on time.', assignedCoachId: 'st_daniel', poolId: 'pool_ef', status: 'active', portal: 'active', studentCanBook: true, independent: false, source: 'Referral', createdAt: ago(55), guardians: [
        { guardianId: 'g_susan', relationship: 'Mother', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true },
      ] },
      { id: 's_lily', name: 'Lily Chen', email: 'lily.chen@example.com', smsOptIn: false, grade: '9th grade', school: 'Lincoln High School', goals: 'Reading comprehension and study habits.', assignedCoachId: 'st_ava', poolId: null, status: 'active', portal: 'active', studentCanBook: false, independent: false, source: 'Existing client', createdAt: ago(10), manualEntry: true, guardians: [
        { guardianId: 'g_mei', relationship: 'Mother', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true },
        { guardianId: 'g_wei', relationship: 'Father', canBook: false, followUps: false, homework: true, billing: false, payer: false, signer: false },
      ] },
      { id: 's_owen', name: 'Owen Patel', smsOptIn: false, grade: '7th grade', school: 'Heath School', goals: 'Transition to middle school workload.', assignedCoachId: 'st_daniel', poolId: null, status: 'completed', portal: 'active', studentCanBook: false, independent: false, source: 'Referral', createdAt: ago(130), guardians: [
        { guardianId: 'g_raj', relationship: 'Father', canBook: true, followUps: true, homework: true, billing: true, payer: true, signer: true },
      ] },
    ],
    sessionTypes: [
      { id: 'stype_60', name: 'Coaching session', minutes: 60, credits: 1, meeting: 'zoom' },
      { id: 'stype_30', name: 'Check-in', minutes: 30, credits: 0.5, meeting: 'zoom' },
      { id: 'stype_inperson', name: 'In-person session', minutes: 60, credits: 1, meeting: 'in_person' },
      { id: 'stype_fit', name: 'Free fit call', minutes: 20, credits: 0, meeting: 'zoom', consultation: true },
    ],
    offerings: [
      { id: 'off_semester', name: 'Semester Focus Program', kind: 'fixed', description: 'Twelve weekly sessions for a semester of steady progress.', credits: 12, priceCents: 120000, installmentOptions: [1, 3], termWeeks: 12, sessionTypeIds: ['stype_60', 'stype_30'], cancelNoticeHours: 24, active: true },
      { id: 'off_sprint', name: 'Exam Sprint', kind: 'fixed', description: 'Six focused sessions before a major exam.', credits: 6, priceCents: 72000, installmentOptions: [1, 2], termWeeks: 6, sessionTypeIds: ['stype_60', 'stype_30'], poolId: 'pool_ef', cancelNoticeHours: 24, active: true },
      { id: 'off_monthly', name: 'Ongoing Monthly Coaching', kind: 'monthly', description: 'Four sessions each month, renewing monthly.', credits: 4, priceCents: 38000, installmentOptions: [1], termWeeks: 0, sessionTypeIds: ['stype_60', 'stype_30', 'stype_inperson'], cancelNoticeHours: 24, active: true },
    ],
    eventTypes: [
      {
        id: 'et_fit', slug: 'fit-call', name: 'Free fit call', description: 'A short, no-pressure conversation to see whether coaching is a good fit and which coach would suit your student best.',
        minutes: 20, location: 'zoom', hostIds: ['st_eleni', 'st_priya', 'st_daniel', 'st_ava'], hostMode: 'any', priceCents: 0, refundCutoffHours: 0, minNoticeHours: 12, bookingWindowDays: 21, bufferMinutes: 10, askStudent: true, active: true, color: 'emerald',
        questions: [
          { id: 'q_goals', label: 'What would you like help with?', type: 'textarea', required: true, options: [] },
          { id: 'q_source', label: 'How did you hear about us?', type: 'single', required: false, options: ['Google search', 'Referral', 'School counselor', 'Instagram', 'Other'] },
        ],
      },
      {
        id: 'et_strategy', slug: 'strategy-session', name: 'Strategy session', description: 'A focused 45-minute working session with Eleni. Leave with a concrete plan for the semester — whether or not you continue with coaching.',
        minutes: 45, location: 'zoom', hostIds: ['st_eleni'], hostMode: 'choose', priceCents: 7500, refundCutoffHours: 24, minNoticeHours: 24, bookingWindowDays: 30, bufferMinutes: 15, askStudent: true, active: true, color: 'blue',
        questions: [
          { id: 'q_focus', label: 'What should we focus on?', type: 'multi', required: true, options: ['Organisation', 'Procrastination', 'Test preparation', 'College application timeline', 'Motivation'] },
          { id: 'q_context', label: 'Anything we should know beforehand?', type: 'textarea', required: false, options: [] },
        ],
      },
      {
        id: 'et_essay', slug: 'college-essay-review', name: 'College essay review', description: 'Bring a draft. Priya will review structure, voice, and fit with the prompt, and send written notes afterwards.',
        minutes: 60, location: 'zoom', hostIds: ['st_priya'], hostMode: 'choose', priceCents: 12000, refundCutoffHours: 48, minNoticeHours: 48, bookingWindowDays: 45, bufferMinutes: 15, askStudent: true, active: true, color: 'violet',
        questions: [
          { id: 'q_prompt', label: 'Which prompt are you writing for?', type: 'text', required: true, options: [] },
          { id: 'q_deadline', label: 'Application deadline', type: 'single', required: true, options: ['Early action / early decision', 'Regular decision', 'Not sure yet'] },
          { id: 'q_phone', label: 'Mobile number for day-of changes', type: 'phone', required: false, options: [] },
        ],
      },
    ],
    inquiries: [
      { id: 'inq_ava', studentName: 'Ava Martinez', grade: '9th grade', school: 'Brookline High School', guardianName: 'Lucia Martinez', guardianEmail: 'lucia.martinez@example.com', independent: false, goals: 'Ava is overwhelmed by the jump to high school and wants help planning her week.', availability: 'Weekday afternoons after 3:30', source: 'Instagram', createdAt: ago(0.2), stage: 'new', responsibleId: 'st_marcus' },
      { id: 'inq_leo', studentName: 'Leo Nguyen', grade: '11th grade', school: 'Newton South High School', guardianName: 'Hanh Nguyen', guardianEmail: 'hanh.nguyen@example.com', independent: false, goals: 'Executive function support; misses deadlines despite strong grades on tests.', availability: 'Tuesdays and Thursdays, evenings', source: 'Referral — Rachel Reynolds', createdAt: ago(1.1), stage: 'matching', responsibleId: 'st_marcus' },
      { id: 'inq_zoe', studentName: 'Zoe Williams', grade: '10th grade', school: 'Cambridge Rindge and Latin', guardianName: 'Andre Williams', guardianEmail: 'andre.williams@example.com', independent: false, goals: 'Procrastination on long assignments; wants accountability.', availability: 'After 5 p.m.', source: 'Google search', createdAt: ago(3), stage: 'consult_scheduled', responsibleId: 'st_daniel', matchedCoachId: 'st_daniel', handoffNote: 'Parent prefers a coach with ADHD experience.' },
      { id: 'inq_henry', studentName: 'Henry Adams', grade: '12th grade', school: 'Belmont High School', guardianName: 'Claire Adams', guardianEmail: 'claire.adams@example.com', independent: false, goals: 'Senior-year workload and college essays.', availability: 'Weekday evenings', source: 'School counselor', createdAt: ago(6), stage: 'consult_done', responsibleId: 'st_marcus', matchedCoachId: 'st_priya', fitOutcome: 'fit', fitNotes: 'Motivated, needs structure for essays. Recommend the semester program, weekly.' },
      { id: 'inq_mia', studentName: 'Mia Johnson', grade: '8th grade', school: 'Pierce Middle School', guardianName: 'Erin Johnson', guardianEmail: 'erin.johnson@example.com', independent: false, goals: 'Organisation and confidence with math homework.', availability: 'Mondays and Wednesdays', source: 'Referral', createdAt: ago(9), stage: 'offer_sent', responsibleId: 'st_marcus', matchedCoachId: 'st_ava', fitOutcome: 'fit', fitNotes: 'Great rapport. Weekly sessions recommended.', offerId: 'offer_mia' },
      { id: 'inq_grace', studentName: 'Grace Kim', grade: '11th grade', school: '', guardianName: 'Mark Kim', guardianEmail: 'mark.kim@example.com', guardianPhone: '(617) 555-0133', independent: false, goals: 'College application timeline, Organisation', availability: 'Booked online', source: 'Booking page: Strategy session', createdAt: ago(1), stage: 'consult_scheduled', responsibleId: 'st_eleni', matchedCoachId: 'st_eleni', eventTypeId: 'et_strategy' },
      { id: 'inq_chloe', studentName: 'Chloe Davis', grade: '11th grade', school: 'Wellesley High School', guardianName: 'Morgan Davis', guardianEmail: 'morgan.davis@example.com', independent: false, goals: 'ACT preparation.', availability: 'Weekends', source: 'Google search', createdAt: ago(14), stage: 'declined', responsibleId: 'st_marcus', fitNotes: 'Family chose a content tutoring center.' },
    ],
    offers: [
      {
        id: 'offer_mia', token: 'mia-johnson-7f3k', inquiryId: 'inq_mia', coachId: 'st_ava', status: 'sent', version: 1, policy, sentAt: ago(1), expiresAt: at(13), createdBy: 'st_marcus',
        options: [
          { offeringId: 'off_semester', name: 'Semester Focus Program', kind: 'fixed', credits: 12, priceCents: 120000, installments: 1, termWeeks: 12, sessionTypeIds: ['stype_60', 'stype_30'] },
          { offeringId: 'off_semester', name: 'Semester Focus Program', kind: 'fixed', credits: 12, priceCents: 120000, installments: 3, termWeeks: 12, sessionTypeIds: ['stype_60', 'stype_30'] },
          { offeringId: 'off_monthly', name: 'Ongoing Monthly Coaching', kind: 'monthly', credits: 4, priceCents: 38000, installments: 1, termWeeks: 0, sessionTypeIds: ['stype_60', 'stype_30', 'stype_inperson'] },
        ],
      },
    ],
    purchases: [
      { id: 'pu_sophie', studentId: 's_sophie', name: 'Semester Focus Program', kind: 'fixed', credits: 12, priceCents: 120000, startDate: at(-42), endDate: at(42), sessionTypeIds: ['stype_60', 'stype_30'], status: 'active', policy, installments: [inst(-42, 40000, 'paid'), inst(-14, 40000, 'paid'), inst(10, 40000, 'scheduled')] },
      { id: 'pu_noah', studentId: 's_noah', name: 'Exam Sprint', kind: 'fixed', credits: 6, priceCents: 72000, startDate: at(-21), endDate: at(21), sessionTypeIds: ['stype_60', 'stype_30'], status: 'active', policy, installments: [inst(-21, 36000, 'paid'), inst(-1, 36000, 'failed')] },
      { id: 'pu_maya', studentId: 's_maya', name: 'Ongoing Monthly Coaching', kind: 'monthly', credits: 4, priceCents: 38000, startDate: at(-40), endDate: at(50), sessionTypeIds: ['stype_60', 'stype_30', 'stype_inperson'], status: 'active', policy, installments: [inst(-40, 38000, 'paid'), inst(-10, 38000, 'paid'), inst(20, 38000, 'scheduled')] },
      { id: 'pu_jamie', studentId: 's_jamie', name: 'Semester Focus Program', kind: 'fixed', credits: 12, priceCents: 120000, startDate: at(-30), endDate: at(54), sessionTypeIds: ['stype_60', 'stype_30'], status: 'active', policy, installments: [inst(-30, 120000, 'paid')] },
      { id: 'pu_ethan', studentId: 's_ethan', name: 'Exam Sprint', kind: 'fixed', credits: 6, priceCents: 72000, startDate: at(-50), endDate: at(-5), sessionTypeIds: ['stype_60', 'stype_30'], status: 'active', policy, installments: [inst(-50, 72000, 'paid')] },
      { id: 'pu_lily', studentId: 's_lily', name: 'Semester Focus Program', kind: 'fixed', credits: 12, priceCents: 120000, startDate: at(-60), endDate: at(24), sessionTypeIds: ['stype_60', 'stype_30'], status: 'active', policy, installments: [inst(-60, 120000, 'paid', { historical: true, ref: 'Invoice #1042 (previous system)' })], historical: { verifiedBy: 'st_eleni', note: 'Paid in full through previous invoicing — Invoice #1042.', at: ago(10) } },
      { id: 'pu_owen', studentId: 's_owen', name: 'Exam Sprint', kind: 'fixed', credits: 6, priceCents: 72000, startDate: at(-120), endDate: at(-78), sessionTypeIds: ['stype_60'], status: 'completed', policy, installments: [inst(-120, 72000, 'paid')] },
    ],
    adjustments: [{ id: 'adj_lily', purchaseId: 'pu_lily', credits: -7, reason: 'Opening balance: 7 sessions delivered before moving to schedulefa.st', by: 'st_eleni', at: ago(10) }],
    appointments,
    calendarBlocks: [
      { id: 'cb1', coachId: 'st_priya', start: at(1, '15:00'), end: at(1, '16:30'), title: 'Busy' },
      { id: 'cb2', coachId: 'st_daniel', start: at(2, '18:00'), end: at(2, '19:30'), title: 'Busy' },
      { id: 'cb3', coachId: 'st_eleni', start: at(0, '16:00'), end: at(0, '17:00'), title: 'Busy' },
      { id: 'cb4', coachId: 'st_ava', start: at(3, '14:00'), end: at(3, '15:00'), title: 'Busy' },
    ],
    followUps: [],
    homework: [
      { id: 'hw1', studentId: 's_sophie', coachId: 'st_priya', appointmentId: sophieLast.id, title: 'Try the five-minute start', instructions: 'Before each chemistry assignment, set a five-minute timer and begin with the smallest step. Note how it went in one sentence.', due: at(3, '20:00'), status: 'assigned', guardiansCanSee: true, createdAt: at(-3, '16:45'), fileIds: ['f2'] },
      { id: 'hw2', studentId: 's_sophie', coachId: 'st_priya', title: 'Fill in your weekly planner', instructions: 'Use the planner template on Sunday evening. Include practice, tests, and two breaks.', due: at(-4, '20:00'), status: 'complete', response: 'Done! Did it Sunday night — practice took more slots than I thought.', completedAt: at(-4, '19:30'), guardiansCanSee: true, createdAt: at(-10, '16:30'), fileIds: ['f1'] },
      { id: 'hw3', studentId: 's_noah', coachId: 'st_priya', title: 'Timed SAT reading section', instructions: 'Complete one reading section under timed conditions and mark the questions you guessed.', due: at(2, '20:00'), status: 'assigned', guardiansCanSee: true, createdAt: at(-4, '17:30'), fileIds: ['f3'] },
      { id: 'hw4', studentId: 's_jamie', coachId: 'st_eleni', title: 'Set up a homework tracker', instructions: 'Use the study tracker to list each class and check it after school every day this week.', due: at(4, '20:00'), status: 'assigned', guardiansCanSee: true, createdAt: at(-1, '15:05'), fileIds: ['f4'], appointmentId: jamieLast.id },
      { id: 'hw5', studentId: 's_lily', coachId: 'st_ava', title: 'Read chapter 4 using SQ3R', instructions: 'Survey, question, read, recite, review. Bring your questions next session.', due: at(-3, '20:00'), status: 'reviewed', response: 'I wrote 6 questions.', completedAt: at(-4, '18:00'), guardiansCanSee: true, createdAt: at(-9, '16:00'), fileIds: [] },
    ],
    files: [
      { id: 'f1', name: 'Weekly planner template.pdf', sizeKb: 240, uploadedBy: 'st_priya', studentIds: ['s_sophie', 's_noah'], createdAt: ago(20) },
      { id: 'f2', name: 'Five-minute start worksheet.pdf', sizeKb: 96, uploadedBy: 'st_priya', studentIds: ['s_sophie'], createdAt: ago(3) },
      { id: 'f3', name: 'SAT pacing guide.pdf', sizeKb: 412, uploadedBy: 'st_priya', studentIds: ['s_noah'], createdAt: ago(12) },
      { id: 'f4', name: 'Study tracker.xlsx', sizeKb: 38, uploadedBy: 'st_eleni', studentIds: ['s_jamie'], createdAt: ago(1) },
    ],
    tasks: [
      { id: 't1', title: 'Match a coach for Leo Nguyen', detail: 'Referral from the Reynolds family. Prefers Tuesday/Thursday evenings.', assigneeId: 'st_marcus', kind: 'handoff', link: '/app/inquiries?open=inq_leo', status: 'open', createdAt: ago(1.1) },
      { id: 't2', title: 'Send an offer to the Adams family', detail: 'Priya reported a fit after the consultation.', assigneeId: 'st_marcus', kind: 'handoff', link: '/app/inquiries?open=inq_henry', status: 'open', createdAt: ago(2) },
      { id: 't3', title: 'Resolve failed payment for Noah Carter', detail: 'Installment 2 of 2 failed. Upcoming sessions are not funded.', assigneeId: 'st_marcus', kind: 'payment', link: '/app/clients/s_noah?tab=billing', status: 'open', createdAt: ago(1) },
      { id: 't4', title: 'Review follow-up for Jamie Lee', detail: 'Zoom summary imported. Drafts are ready for review.', assigneeId: 'st_eleni', kind: 'followup', link: `/app/sessions/${jamieLast.id}`, status: 'open', createdAt: ago(0.9) },
      { id: 't5', title: 'Reconnect Google Calendar', detail: 'Availability is using your last known busy times.', assigneeId: 'st_daniel', kind: 'calendar', link: '/app/settings?tab=integrations', status: 'open', createdAt: ago(0.5) },
      { id: 't6', title: 'Ethan Brooks has a makeup before closing', detail: 'Program ended. One preserved makeup credit remains.', assigneeId: 'st_marcus', kind: 'makeup', link: '/app/clients/s_ethan', status: 'open', createdAt: ago(5) },
      { id: 't7', title: 'Fit call with Zoe Williams tomorrow', detail: 'Handoff from Marcus: parent prefers a coach with ADHD experience.', assigneeId: 'st_daniel', kind: 'handoff', link: '/app/inquiries?open=inq_zoe', status: 'open', createdAt: ago(2) },
      { id: 't8', title: 'Add notes for Lily’s session', detail: 'The Zoom summary was unavailable. Add manual notes to prepare a follow-up.', assigneeId: 'st_ava', kind: 'followup', link: `/app/sessions/${lilyLast.id}`, status: 'open', createdAt: ago(1.8) },
    ],
    issues: [
      { id: 'iss1', kind: 'payment_failed', title: 'Payment failed — Noah Carter', detail: 'Stripe reported card_declined for installment 2 of 2 ($360).', ownerId: 'st_marcus', link: '/app/clients/s_noah?tab=billing', status: 'open', createdAt: ago(1), history: [{ at: ago(1), text: 'Stripe event received: payment_intent.payment_failed' }, { at: ago(1), text: 'Payment reminder email sent to Dana Carter' }] },
      { id: 'iss2', kind: 'calendar_sync', title: 'Google Calendar sync stale — Daniel Kim', detail: 'Last successful sync 14 hours ago. Unknown slots are not offered as free.', ownerId: 'st_daniel', link: '/app/settings?tab=integrations', status: 'open', createdAt: ago(0.5), history: [{ at: ago(0.6), text: 'Token refresh failed (invalid_grant)' }] },
      { id: 'iss3', kind: 'zoom_summary', title: 'Zoom summary unavailable — Lily Chen', detail: 'No meeting summary was generated for this meeting instance. Use manual notes or paste a transcript.', ownerId: 'st_ava', link: `/app/sessions/${lilyLast.id}`, status: 'open', createdAt: ago(1.8), history: [{ at: ago(1.9), text: 'Summary not found after 3 retries' }] },
    ],
    notifications: [
      { id: 'n1', at: ago(1), channel: 'email', to: 'Dana Carter', subject: 'Payment unsuccessful — Exam Sprint installment 2', status: 'delivered' },
      { id: 'n2', at: ago(1), channel: 'email', to: 'Erin Johnson', subject: 'Your coaching offer from Willow Coaching', status: 'delivered' },
      { id: 'n3', at: ago(0.1), channel: 'email', to: 'Rachel Reynolds', subject: 'Reminder: Sophie’s session today at 3:30 PM', status: 'delivered' },
      { id: 'n4', at: ago(0.05), channel: 'sms', to: 'Rachel Reynolds', subject: 'Reminder: Sophie’s session today at 3:30 PM', status: 'delivered' },
      { id: 'n5', at: ago(3), channel: 'email', to: 'Wei Chen', subject: 'You’re invited to the Willow Coaching portal', status: 'sent' },
    ],
    audit: [
      { id: 'a1', at: ago(10), actor: 'Eleni Morgan', action: 'Verified historical paid coverage', detail: 'Lily Chen · Semester Focus Program · Invoice #1042' },
      { id: 'a2', at: ago(1), actor: 'Stripe', action: 'Payment failed', detail: 'Noah Carter · Exam Sprint installment 2' },
      { id: 'a3', at: ago(1), actor: 'Marcus Hale', action: 'Sent offer', detail: 'Mia Johnson · 3 options' },
    ],
    grants: [{ id: 'gr1', staffId: 'st_ava', studentId: 's_noah', scope: 'client', reason: 'Covering for Priya during SAT week', grantedBy: 'st_eleni', expiresAt: at(9) }],
  }

  // Published follow-up for Sophie's last session.
  const sophieVersions = draftFollowUp(db, sophieLast, 'separate')
  db.followUps.push({ id: 'fu_sophie', appointmentId: sophieLast.id, studentId: 's_sophie', coachId: 'st_priya', mode: 'separate', versions: sophieVersions, status: 'published', sourceKind: 'zoom', createdAt: at(-3, '16:45'), publishedAt: at(-3, '17:10'), publishedBy: 'st_priya', deliveries: plannedDeliveries(db, { studentId: 's_sophie', versions: sophieVersions, mode: 'separate' }).map((d) => (d.status === 'sent' ? { ...d, status: 'delivered' } : d)) })
  // Draft awaiting review for Jamie.
  db.followUps.push({ id: 'fu_jamie', appointmentId: jamieLast.id, studentId: 's_jamie', coachId: 'st_eleni', mode: 'separate', versions: draftFollowUp(db, jamieLast, 'separate'), status: 'draft', sourceKind: 'zoom', createdAt: at(-1, '15:12'), deliveries: [] })
  return db
}
