export type Visibility =
  | "Coach only"
  | "Coach + Client"
  | "Coach + Parent"
  | "Everyone";

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
  goals: { title: string; progress: number }[];
  guardians?: { name: string; relation: string; initials: string; permissions: string[] }[];
  careTeam?: { name: string; role: string; initials: string; permissions: string[] }[];
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
    headline: "Growing self-trust while navigating school and family expectations.",
    goals: [
      { title: "Speak up with more confidence", progress: 58 },
      { title: "Create a calmer school routine", progress: 74 },
    ],
    guardians: [
      {
        name: "Sofia Rivera",
        relation: "Mother",
        initials: "SR",
        permissions: ["Scheduling", "Billing", "Agreements", "Progress updates"],
      },
      {
        name: "Daniel Rivera",
        relation: "Father",
        initials: "DR",
        permissions: ["Scheduling", "Agreements"],
      },
    ],
    careTeam: [
      {
        name: "Dr. Nina Patel",
        role: "Therapist",
        initials: "NP",
        permissions: ["Selected progress updates"],
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
    goals: [
      { title: "Reduce school-related overwhelm", progress: 46 },
      { title: "Make room for friendships", progress: 61 },
    ],
    guardians: [
      {
        name: "Caroline Thompson",
        relation: "Mother",
        initials: "CT",
        permissions: ["Scheduling", "Billing", "Agreements"],
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
    goals: [{ title: "Clarify personal priorities", progress: 82 }],
  },
];

export const assignments = [
  {
    id: "a1",
    client: "Maya Chen",
    title: "Values-aligned role scorecard",
    due: "Today",
    required: true,
    status: "In progress",
    visibility: "Coach + Client" as Visibility,
  },
  {
    id: "a2",
    client: "Eli Rivera",
    title: "Three moments I trusted myself",
    due: "Tomorrow",
    required: false,
    status: "Not started",
    visibility: "Coach + Client" as Visibility,
  },
  {
    id: "a3",
    client: "Jonah Brooks",
    title: "Energy audit: one workweek",
    due: "Aug 17",
    required: true,
    status: "In progress",
    visibility: "Coach + Client" as Visibility,
  },
];

export const sessions = [
  { time: "10:00", meridiem: "AM", client: "Maya Chen", type: "Career clarity", duration: "50 min", color: "#d9c7ff", initials: "MC" },
  { time: "2:30", meridiem: "PM", client: "Eli Rivera", type: "Teen coaching", duration: "50 min", color: "#b9ddd2", initials: "ER" },
  { time: "4:30", meridiem: "PM", client: "Theo Walker", type: "Discovery call", duration: "30 min", color: "#c8d9f4", initials: "TW" },
];

export const resources = [
  { title: "Weekly Energy Audit", type: "Worksheet", size: "2 pages", assigned: 12, color: "lavender" },
  { title: "Values Clarification Guide", type: "Workbook", size: "14 pages", assigned: 8, color: "peach" },
  { title: "Boundary-Setting Prompts", type: "PDF", size: "6 pages", assigned: 17, color: "sage" },
  { title: "Future Self Visualization", type: "Audio", size: "8 min", assigned: 6, color: "blue" },
  { title: "The Wheel of Life", type: "Worksheet", size: "1 page", assigned: 22, color: "yellow" },
  { title: "Career Decision Matrix", type: "Template", size: "4 pages", assigned: 9, color: "rose" },
];

export const templates = [
  { title: "New adult client", type: "Onboarding", steps: 6, updated: "2 days ago", icon: "sparkles" },
  { title: "Teen + guardian onboarding", type: "Onboarding", steps: 9, updated: "1 week ago", icon: "shield" },
  { title: "Career clarity program", type: "Program", steps: 8, updated: "Jul 28", icon: "route" },
  { title: "First coaching session", type: "Session", steps: 5, updated: "Jul 22", icon: "notes" },
  { title: "Monthly reflection", type: "Assignment", steps: 7, updated: "Jul 18", icon: "check" },
  { title: "Coaching agreement", type: "Agreement", steps: 4, updated: "Jul 11", icon: "file" },
];
