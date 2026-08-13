export type Visibility =
  "Coach only" | "Coach + Client" | "Coach + Parent" | "Everyone";

export type Client = {
  id: string;
  name: string;
  initials: string;
  age?: number;
  pronouns: string;
  email: string;
  phone: string;
  status: "Active" | "Paused";
  type: "Adult" | "Teen";
  color: string;
  nextSession: string;
  nextSessionTime: string;
  cadence: string;
  package: string;
  payment: "Paid" | "Due soon" | "Past due";
  coach: string;
  joined: string;
  timezone: string;
  headline: string;
  portalActive: boolean;
  goals: { title: string; progress: number }[];
  guardians?: {
    id: string;
    name: string;
    email: string;
    relation: string;
    initials: string;
    permissions: string[];
    automaticAssignmentUpdates: boolean;
    portalActive: boolean;
  }[];
  careTeam?: {
    id: string;
    name: string;
    email: string;
    role: string;
    initials: string;
    permissions: string[];
    portalActive: boolean;
  }[];
};

export const clients: Client[] = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    initials: "MC",
    pronouns: "she/her",
    email: "maya.chen@example.com",
    phone: "+1 (415) 555-0148",
    status: "Active",
    type: "Adult",
    color: "#d9c7ff",
    nextSession: "Today",
    nextSessionTime: "10:00 AM",
    cadence: "Weekly · Thursdays",
    package: "Momentum · 8 sessions",
    payment: "Paid",
    coach: "Alex Morgan",
    joined: "Mar 18, 2026",
    timezone: "Pacific Time",
    headline: "Building confidence for a thoughtful career transition.",
    portalActive: true,
    goals: [
      { title: "Choose the right next career chapter", progress: 68 },
      { title: "Build a sustainable weekly rhythm", progress: 42 },
    ],
  },
  {
    id: "eli-rivera",
    name: "Eli Rivera",
    initials: "ER",
    age: 16,
    pronouns: "they/them",
    email: "eli.rivera@example.com",
    phone: "+1 (510) 555-0171",
    status: "Active",
    type: "Teen",
    color: "#b9ddd2",
    nextSession: "Today",
    nextSessionTime: "2:30 PM",
    cadence: "Every other week",
    package: "Teen Growth · 12 sessions",
    payment: "Paid",
    coach: "Alex Morgan",
    joined: "Jan 9, 2026",
    timezone: "Pacific Time",
    headline:
      "Growing self-trust while navigating school and family expectations.",
    portalActive: true,
    goals: [
      { title: "Speak up with more confidence", progress: 58 },
      { title: "Create a calmer school routine", progress: 74 },
    ],
    guardians: [
      {
        id: "guardian-sofia",
        name: "Sofia Rivera",
        email: "sofia.rivera@example.com",
        relation: "Mother",
        initials: "SR",
        permissions: [
          "Scheduling",
          "Billing",
          "Agreements",
          "Progress updates",
        ],
        automaticAssignmentUpdates: true,
        portalActive: true,
      },
      {
        id: "guardian-daniel",
        name: "Daniel Rivera",
        email: "daniel.rivera@example.com",
        relation: "Father",
        initials: "DR",
        permissions: ["Scheduling", "Agreements"],
        automaticAssignmentUpdates: false,
        portalActive: false,
      },
    ],
    careTeam: [
      {
        id: "care-nina",
        name: "Dr. Nina Patel",
        email: "nina.patel@example.com",
        role: "Therapist",
        initials: "NP",
        permissions: ["Selected progress updates"],
        portalActive: false,
      },
    ],
  },
  {
    id: "jonah-brooks",
    name: "Jonah Brooks",
    initials: "JB",
    pronouns: "he/him",
    email: "jonah.b@example.com",
    phone: "+1 (650) 555-0199",
    status: "Active",
    type: "Adult",
    color: "#f3c9ae",
    nextSession: "Tomorrow",
    nextSessionTime: "11:00 AM",
    cadence: "Weekly · Fridays",
    package: "Leadership Reset · 6 sessions",
    payment: "Due soon",
    coach: "Alex Morgan",
    joined: "Jun 2, 2026",
    timezone: "Pacific Time",
    headline: "Leading with clarity without sacrificing life outside work.",
    portalActive: false,
    goals: [
      { title: "Set clear boundaries with my team", progress: 35 },
      { title: "Reconnect with life outside work", progress: 52 },
    ],
  },
  {
    id: "ava-thompson",
    name: "Ava Thompson",
    initials: "AT",
    age: 15,
    pronouns: "she/her",
    email: "ava.t@example.com",
    phone: "+1 (925) 555-0126",
    status: "Active",
    type: "Teen",
    color: "#f0d8a9",
    nextSession: "Aug 18",
    nextSessionTime: "4:00 PM",
    cadence: "Every other week",
    package: "Teen Foundations · 8 sessions",
    payment: "Past due",
    coach: "Jamie Lee",
    joined: "Apr 25, 2026",
    timezone: "Pacific Time",
    headline: "Finding balance between achievement, friendships, and rest.",
    portalActive: false,
    goals: [
      { title: "Reduce school-related overwhelm", progress: 46 },
      { title: "Make room for friendships", progress: 61 },
    ],
    guardians: [
      {
        id: "guardian-caroline",
        name: "Caroline Thompson",
        email: "caroline.thompson@example.com",
        relation: "Mother",
        initials: "CT",
        permissions: ["Scheduling", "Billing", "Agreements"],
        automaticAssignmentUpdates: false,
        portalActive: false,
      },
    ],
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    initials: "PS",
    pronouns: "she/her",
    email: "priya.shah@example.com",
    phone: "+1 (408) 555-0164",
    status: "Paused",
    type: "Adult",
    color: "#c8d9f4",
    nextSession: "Not scheduled",
    nextSessionTime: "",
    cadence: "On demand",
    package: "Clarity · 4 sessions",
    payment: "Paid",
    coach: "Jamie Lee",
    joined: "Nov 14, 2025",
    timezone: "Pacific Time",
    headline: "Creating space for a more intentional next season.",
    portalActive: false,
    goals: [{ title: "Clarify personal priorities", progress: 82 }],
  },
];

export type Assignment = {
  id: string;
  clientId: string;
  client: string;
  title: string;
  instructions: string;
  due: string;
  dueAt: string | null;
  required: boolean;
  status:
    | "Not started"
    | "In progress"
    | "Submitted"
    | "Reviewed"
    | "Complete"
    | "Overdue";
  visibility: Visibility;
  responseType: "checkbox" | "text";
  responseText: string;
  guardianShare: "client_default" | "share" | "private";
  guardianLogisticsShared: boolean;
};

export const assignments: Assignment[] = [
  {
    id: "a1",
    clientId: "maya-chen",
    client: "Maya Chen",
    title: "Values-aligned role scorecard",
    instructions:
      "Score the three roles you are considering against your five most important values.",
    due: "Today",
    dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    required: true,
    status: "In progress",
    visibility: "Coach + Client" as Visibility,
    responseType: "text",
    responseText: "",
    guardianShare: "private",
    guardianLogisticsShared: false,
  },
  {
    id: "a2",
    clientId: "eli-rivera",
    client: "Eli Rivera",
    title: "Three moments I trusted myself",
    instructions:
      "Write a sentence about three moments when you listened to your own judgment this week.",
    due: "Tomorrow",
    dueAt: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
    required: false,
    status: "Not started",
    visibility: "Coach + Client" as Visibility,
    responseType: "text",
    responseText: "",
    guardianShare: "client_default",
    guardianLogisticsShared: true,
  },
  {
    id: "a3",
    clientId: "jonah-brooks",
    client: "Jonah Brooks",
    title: "Energy audit: one workweek",
    instructions:
      "Mark the audit complete after tracking your energy at the end of each workday.",
    due: "Aug 17",
    dueAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
    required: true,
    status: "In progress",
    visibility: "Coach + Client" as Visibility,
    responseType: "checkbox",
    responseText: "",
    guardianShare: "private",
    guardianLogisticsShared: false,
  },
];

export type PracticeSession = {
  id: string;
  clientId: string;
  client: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "attended" | "late_cancel" | "no_show" | "cancelled";
  meetingProvider: string | null;
  meetingUrl: string | null;
  nextSessionAt: string | null;
};

export type SharedNote = {
  id: string;
  clientId: string;
  body: string;
  visibility: Visibility;
  type: string;
  createdAt: string;
};

export type PortalInvitation = {
  id: string;
  clientId: string;
  relationshipId: string | null;
  email: string;
  fullName: string;
  role: "client" | "guardian" | "third_party";
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export const sessions: PracticeSession[] = [
  {
    id: "session-maya",
    clientId: "maya-chen",
    client: "Maya Chen",
    startsAt: "2026-08-13T10:00:00-07:00",
    endsAt: "2026-08-13T10:50:00-07:00",
    status: "scheduled",
    meetingProvider: "zoom",
    meetingUrl: "https://zoom.us/j/81234567890",
    nextSessionAt: null,
  },
  {
    id: "session-eli",
    clientId: "eli-rivera",
    client: "Eli Rivera",
    startsAt: "2026-08-13T14:30:00-07:00",
    endsAt: "2026-08-13T15:20:00-07:00",
    status: "scheduled",
    meetingProvider: "zoom",
    meetingUrl: "https://zoom.us/j/82345678901",
    nextSessionAt: null,
  },
  {
    id: "session-jonah",
    clientId: "jonah-brooks",
    client: "Jonah Brooks",
    startsAt: "2026-08-14T11:00:00-07:00",
    endsAt: "2026-08-14T11:50:00-07:00",
    status: "scheduled",
    meetingProvider: "zoom",
    meetingUrl: "https://zoom.us/j/83456789012",
    nextSessionAt: null,
  },
];

export const sharedNotes: SharedNote[] = [
  {
    id: "note-maya",
    clientId: "maya-chen",
    body: "You’re making thoughtful progress on choosing experiments over pressure. Keep noticing where your energy grows.",
    visibility: "Coach + Client",
    type: "Shared takeaway",
    createdAt: "2026-08-06T18:00:00Z",
  },
  {
    id: "note-eli-parent",
    clientId: "eli-rivera",
    body: "We’re focusing on consistent routines and practicing how to ask for support before stress builds up.",
    visibility: "Coach + Parent",
    type: "Progress update",
    createdAt: "2026-07-30T18:00:00Z",
  },
];

export const resources = [
  {
    title: "Weekly Energy Audit",
    type: "Worksheet",
    size: "2 pages",
    assigned: 12,
    color: "lavender",
  },
  {
    title: "Values Clarification Guide",
    type: "Workbook",
    size: "14 pages",
    assigned: 8,
    color: "peach",
  },
  {
    title: "Boundary-Setting Prompts",
    type: "PDF",
    size: "6 pages",
    assigned: 17,
    color: "sage",
  },
  {
    title: "Future Self Visualization",
    type: "Audio",
    size: "8 min",
    assigned: 6,
    color: "blue",
  },
  {
    title: "The Wheel of Life",
    type: "Worksheet",
    size: "1 page",
    assigned: 22,
    color: "yellow",
  },
  {
    title: "Career Decision Matrix",
    type: "Template",
    size: "4 pages",
    assigned: 9,
    color: "rose",
  },
];

export const templates = [
  {
    title: "New adult client",
    type: "Onboarding",
    steps: 6,
    updated: "2 days ago",
    icon: "sparkles",
  },
  {
    title: "Teen + guardian onboarding",
    type: "Onboarding",
    steps: 9,
    updated: "1 week ago",
    icon: "shield",
  },
  {
    title: "Career clarity program",
    type: "Program",
    steps: 8,
    updated: "Jul 28",
    icon: "route",
  },
  {
    title: "First coaching session",
    type: "Session",
    steps: 5,
    updated: "Jul 22",
    icon: "notes",
  },
  {
    title: "Monthly reflection",
    type: "Assignment",
    steps: 7,
    updated: "Jul 18",
    icon: "check",
  },
  {
    title: "Coaching agreement",
    type: "Agreement",
    steps: 4,
    updated: "Jul 11",
    icon: "file",
  },
];
