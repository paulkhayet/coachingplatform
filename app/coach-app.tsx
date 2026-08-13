"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  Copy,
  File,
  FileCheck2,
  FileText,
  FolderOpen,
  Goal,
  Headphones,
  Home,
  KeyRound,
  Inbox,
  LayoutTemplate,
  Link2,
  ListChecks,
  LockKeyhole,
  LogIn,
  Mail,
  Menu,
  MessageCircle,
  Mic2,
  MoreHorizontal,
  NotebookPen,
  Paperclip,
  Pause,
  PenLine,
  Plus,
  Route,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TextCursorInput,
  UserRound,
  Users,
  Video,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  assignments,
  clients,
  resources,
  sessions,
  templates,
  type Assignment,
  type Client,
  type PracticeSession,
  type Visibility,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { usePracticeData, type ConnectionState } from "@/lib/supabase/practice-data";

type View = "Dashboard" | "Clients" | "Calendar" | "Resources" | "Templates";
type ClientTab = "Overview" | "Sessions" | "Notes" | "Assignments" | "Files";

const navItems: { label: View; icon: typeof Home }[] = [
  { label: "Dashboard", icon: Home },
  { label: "Clients", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "Resources", icon: FolderOpen },
  { label: "Templates", icon: LayoutTemplate },
];

const visibilityTone: Record<Visibility, "dark" | "purple" | "blue" | "success"> = {
  "Coach only": "dark",
  "Coach + Client": "purple",
  "Coach + Parent": "blue",
  Everyone: "success",
};

const practiceTimeZone = "America/Los_Angeles";

function formatPracticeTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: practiceTimeZone });
}

function formatPracticeDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString("en-US", { ...options, timeZone: practiceTimeZone });
}

function Avatar({
  initials,
  color,
  size = "md",
}: {
  initials: string;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span
      className={cn("avatar", `avatar-${size}`)}
      style={{ background: color || "#ebe9e4" }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <Badge variant={visibilityTone[visibility]} className="visibility-badge">
      <LockKeyhole size={10} strokeWidth={2.2} />
      {visibility}
    </Badge>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-title-row">
      <h2>{children}</h2>
      {action}
    </div>
  );
}

function AppLogo() {
  return (
    <div className="brand-lockup" aria-label="Soli home">
      <span className="brand-mark"><span /></span>
      <span>Soli</span>
    </div>
  );
}

export function CoachApp() {
  const practice = usePracticeData();
  const practiceClients = practice.clients;
  const practiceAssignments = practice.assignments;
  const practiceResources = practice.resources;
  const practiceTemplates = practice.templates;
  const [view, setView] = useState<View>("Dashboard");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientTab, setClientTab] = useState<ClientTab>("Overview");
  const [search, setSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sessionContext, setSessionContext] = useState<{ client: Client; sessionId: string | null } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleClientId, setScheduleClientId] = useState<string | null>(null);
  const [assignmentClient, setAssignmentClient] = useState<Client | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<Assignment | null>(null);
  const [sharingClient, setSharingClient] = useState<Client | null>(null);
  const [portalClient, setPortalClient] = useState<Client | null>(null);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [doneAssignments, setDoneAssignments] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<"All" | "Adult" | "Teen">("All");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setQuickAddOpen(false);
        setSessionContext(null);
        setScheduleOpen(false);
        setAssignmentClient(null);
        setAssignmentDetail(null);
        setSharingClient(null);
        setPortalClient(null);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (practice.connectionState !== "unconfigured" && (practice.connectionState !== "connected" || practice.needsPasswordUpdate)) {
    return (
      <AuthScreen
        state={practice.connectionState}
        error={practice.error}
        needsPasswordUpdate={practice.needsPasswordUpdate}
        onSignIn={practice.signIn}
        onOAuth={practice.signInWithOAuth}
        onSignUp={practice.signUp}
        onReset={practice.requestPasswordReset}
        onUpdatePassword={practice.updatePassword}
      />
    );
  }

  const navigate = (nextView: View) => {
    setView(nextView);
    setSelectedClient(null);
    setMobileMenuOpen(false);
  };

  const openClient = (client: Client) => {
    setSelectedClient(client);
    setView("Clients");
    setClientTab("Overview");
  };

  const currentSelectedClient = selectedClient ? practiceClients.find((client) => client.id === selectedClient.id) || selectedClient : null;

  const startSession = (client?: Client, sessionId: string | null = null) => setSessionContext({ client: client || currentSelectedClient || practiceClients[0] || clients[0], sessionId });
  const openSchedule = (client?: Client) => { setScheduleClientId(client?.id || null); setScheduleOpen(true); };

  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileMenuOpen && "sidebar-mobile-open")}>
        <div className="sidebar-top">
          <AppLogo />
          <button className="mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <button className="workspace-switcher" onClick={() => setDataPanelOpen(true)}>
          <Avatar initials={(practice.userName || "Alex Morgan").split(/\s+/).slice(0, 2).map((part) => part[0]).join("")} color="#f1c8ab" size="sm" />
          <span><strong>{practice.userName || "Alex Morgan"}</strong><small>{practice.mode === "supabase" ? "Soli Coaching" : "Personal practice"}</small></span>
          <ChevronDown size={14} />
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={cn(view === label && !selectedClient && "active")}
              onClick={() => navigate(label)}
            >
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
              {label === "Clients" && <small>{practiceClients.length}</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-insight">
          <div className="insight-icon"><Zap size={14} /></div>
          <p><strong>Your week is 74% booked</strong><span>3 open session slots remain</span></p>
          <ChevronRight size={14} />
        </div>
        <div className="sidebar-footer">
          <button onClick={() => setToast("No new notifications")}><Bell size={17} /><span>Notifications</span><i /></button>
          <button onClick={() => setToast("Settings are ready for the next build")}><Settings size={17} /><span>Settings</span></button>
          <button className={cn("security-note", "data-status", `data-${practice.connectionState}`)} onClick={() => setDataPanelOpen(true)} title={practice.error || undefined}><ShieldCheck size={13} /><span>{practice.connectionState === "connected" ? "Supabase connected" : "Demo data · Supabase ready"}</span></button>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <span className="breadcrumb">
              {selectedClient ? <><button onClick={() => setSelectedClient(null)}>Clients</button><ChevronRight size={13} /><strong>{selectedClient.name}</strong></> : <strong>{view}</strong>}
            </span>
          </div>
          <div className="topbar-actions">
            <button className="search-button" onClick={() => setCommandOpen(true)}>
              <Search size={15} /><span>Search anything…</span><kbd>⌘ K</kbd>
            </button>
            <Button variant="accent" size="sm" onClick={() => setQuickAddOpen(true)}><Plus size={15} />Quick add</Button>
            <button className="top-avatar" onClick={() => setDataPanelOpen(true)} aria-label="Open account settings"><Avatar initials={(practice.userName || "Alex Morgan").split(/\s+/).slice(0, 2).map((part) => part[0]).join("")} color="#f1c8ab" size="sm" /></button>
          </div>
        </header>

        <div className="page-wrap">
          {currentSelectedClient ? (
            <ClientProfile
              client={currentSelectedClient}
              assignmentData={practiceAssignments}
              sessionData={practice.sessions}
              tab={clientTab}
              setTab={setClientTab}
              onBack={() => setSelectedClient(null)}
              onSession={(sessionId) => startSession(currentSelectedClient, sessionId)}
              onSchedule={() => openSchedule(currentSelectedClient)}
              onAssign={() => setAssignmentClient(currentSelectedClient)}
              onSharing={() => setSharingClient(currentSelectedClient)}
              onPortal={() => setPortalClient(currentSelectedClient)}
              onOpenAssignment={setAssignmentDetail}
              onToast={setToast}
            />
          ) : view === "Dashboard" ? (
            <Dashboard
              clientData={practiceClients}
              assignmentData={practiceAssignments}
              onClient={openClient}
              onNavigate={navigate}
              onSession={() => startSession()}
              doneAssignments={doneAssignments}
              onToggleAssignment={(id) => setDoneAssignments((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
              onToast={setToast}
            />
          ) : view === "Clients" ? (
            <ClientsView
              clientData={practiceClients}
              search={search}
              setSearch={setSearch}
              filter={clientFilter}
              setFilter={setClientFilter}
              onClient={openClient}
              onAdd={() => setQuickAddOpen(true)}
            />
          ) : view === "Calendar" ? (
            <CalendarView clientData={practiceClients} sessionData={practice.sessions} onSchedule={() => openSchedule()} onSession={(client, sessionId) => startSession(client, sessionId)} onToast={setToast} />
          ) : view === "Resources" ? (
            <ResourcesView resourcesData={practiceResources} onToast={setToast} />
          ) : (
            <TemplatesView templatesData={practiceTemplates} onToast={setToast} />
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map(({ label, icon: Icon }) => (
          <button key={label} className={cn(view === label && "active")} onClick={() => navigate(label)}><Icon size={18} /><span>{label}</span></button>
        ))}
        <button onClick={() => setMobileMenuOpen(true)}><Menu size={18} /><span>More</span></button>
      </nav>

      {commandOpen && <CommandPalette clientData={practiceClients} onClose={() => setCommandOpen(false)} onNavigate={navigate} onClient={openClient} />}
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} onSchedule={() => { setQuickAddOpen(false); openSchedule(); }} onAssignment={() => { setQuickAddOpen(false); setAssignmentClient(currentSelectedClient || practiceClients[0] || null); }} onSession={() => { setQuickAddOpen(false); startSession(); }} onToast={(message) => { setQuickAddOpen(false); setToast(message); }} />}
      {dataPanelOpen && <AccountModal state={practice.connectionState} email={practice.userEmail} error={practice.error} onClose={() => setDataPanelOpen(false)} onSignOut={practice.signOut} />}
      {sessionContext && <SessionPanel client={sessionContext.client} sessionId={sessionContext.sessionId} onClose={() => setSessionContext(null)} onComplete={async (input) => { await practice.completeSession(input); setSessionContext(null); setToast("Session completed and follow-up saved"); }} />}
      {scheduleOpen && <ScheduleSessionModal clients={practiceClients} initialClientId={scheduleClientId} onClose={() => setScheduleOpen(false)} onSave={async (input) => { await practice.createSession(input); setScheduleOpen(false); setToast("Session scheduled"); }} />}
      {assignmentClient && <AssignmentComposer client={assignmentClient} onClose={() => setAssignmentClient(null)} onSave={async (input) => { await practice.createAssignment({ clientId: assignmentClient.id, ...input }); setAssignmentClient(null); setToast("Assignment published to the client portal"); }} />}
      {assignmentDetail && <AssignmentDetail assignment={assignmentDetail} onClose={() => setAssignmentDetail(null)} onSubmit={async (responseText, completed) => { await practice.submitAssignmentResponse(assignmentDetail, responseText, completed); setAssignmentDetail(null); setToast("Client response saved"); }} onReview={async () => { await practice.reviewAssignment(assignmentDetail.id); setAssignmentDetail(null); setToast("Assignment marked reviewed"); }} />}
      {sharingClient && <GuardianSharingModal client={sharingClient} onClose={() => setSharingClient(null)} onChange={async (guardianId, enabled) => { await practice.updateGuardianAssignmentSharing(guardianId, enabled); setToast(enabled ? "Automatic logistics sharing enabled" : "Automatic sharing turned off"); }} />}
      {portalClient && <ClientPortalPreview client={portalClient} assignments={practiceAssignments.filter((assignment) => assignment.clientId === portalClient.id)} onClose={() => setPortalClient(null)} onOpenAssignment={(assignment) => { setPortalClient(null); setAssignmentDetail(assignment); }} onSchedule={() => { setPortalClient(null); openSchedule(portalClient); }} />}
      {toast && <div className="toast"><CheckCircle2 size={17} /><span>{toast}</span></div>}
    </div>
  );
}

function Dashboard({
  clientData,
  assignmentData,
  onClient,
  onNavigate,
  onSession,
  doneAssignments,
  onToggleAssignment,
  onToast,
}: {
  clientData: Client[];
  assignmentData: typeof assignments;
  onClient: (client: Client) => void;
  onNavigate: (view: View) => void;
  onSession: () => void;
  doneAssignments: string[];
  onToggleAssignment: (id: string) => void;
  onToast: (message: string) => void;
}) {
  return (
    <div className="dashboard page-enter">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">THURSDAY, AUGUST 13</p>
          <h1>Good morning, Alex <span>✦</span></h1>
          <p>You have a steady day ahead—three sessions and a little space to breathe.</p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" onClick={() => onToast("Booking page copied to clipboard")}><Copy size={14} />Booking link</Button>
          <Button onClick={() => onSession()}><NotebookPen size={14} />New session note</Button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card"><span className="metric-icon purple"><CalendarDays size={17} /></span><p><strong>3</strong><span>Sessions today</span></p><small>Next at 10:00 AM</small></div>
        <div className="metric-card"><span className="metric-icon amber"><Clock3 size={17} /></span><p><strong>4</strong><span>Follow-ups</span></p><small>2 due today</small></div>
        <div className="metric-card"><span className="metric-icon green"><ListChecks size={17} /></span><p><strong>3</strong><span>Homework items</span></p><small>Need your attention</small></div>
        <div className="metric-card"><span className="metric-icon blue"><CircleDollarSign size={17} /></span><p><strong>$4.8k</strong><span>August revenue</span></p><small><b>↑ 12%</b> from July</small></div>
      </div>

      <div className="dashboard-grid">
        <section className="panel schedule-panel">
          <SectionTitle action={<button className="text-action" onClick={() => onNavigate("Calendar")}>View calendar <ArrowRight size={13} /></button>}>Today</SectionTitle>
          <div className="day-progress"><span>9 AM</span><div><i style={{ width: "38%" }} /></div><span>5 PM</span></div>
          <div className="session-list">
            {sessions.map((session, index) => {
              const client = clientData.find((item) => item.id === session.clientId);
              const starts = new Date(session.startsAt);
              const minutes = Math.round((new Date(session.endsAt).getTime() - starts.getTime()) / 60_000);
              return (
                <button className="session-row" key={session.id} onClick={() => client ? onClient(client) : onSession()}>
                  <div className="session-time"><strong>{formatPracticeTime(session.startsAt).split(" ")[0]}</strong><span>{formatPracticeTime(session.startsAt).split(" ")[1]}</span></div>
                  <div className={cn("timeline-pin", index === 0 && "current")}><i /></div>
                  <Avatar initials={client?.initials || "?"} color={client?.color} size="md" />
                  <div className="session-info"><strong>{session.client}</strong><span>{client?.headline || "Coaching session"} · {minutes} min</span></div>
                  {index < 2 ? <span className="video-pill"><Video size={12} /> Meet</span> : <Badge>Discovery</Badge>}
                  <ChevronRight size={15} />
                </button>
              );
            })}
          </div>
          <button className="open-slot" onClick={() => onNavigate("Calendar")}><Plus size={14} /><span>Open time</span><small>12:00–2:00 PM</small></button>
        </section>

        <section className="panel focus-panel">
          <SectionTitle action={<button className="icon-button" aria-label="More options"><MoreHorizontal size={17} /></button>}>Needs attention</SectionTitle>
          <div className="attention-list">
            {clientData[2] && <button onClick={() => onClient(clientData[2])}><span className="attention-icon rose"><CircleDollarSign size={16} /></span><p><strong>Invoice due soon</strong><span>{clientData[2].name.split(" ")[0]}’s payment needs review</span></p><Badge variant="rose">Review</Badge></button>}
            {clientData[1] && <button onClick={() => onClient(clientData[1])}><span className="attention-icon amber"><FileCheck2 size={16} /></span><p><strong>{clientData[1].type === "Teen" ? "Guardian signature" : "Agreement signature"}</strong><span>{clientData[1].name.split(" ")[0]}’s agreement is waiting</span></p><ChevronRight size={14} /></button>}
            {clientData[0] && <button onClick={() => onClient(clientData[0])}><span className="attention-icon blue"><MessageCircle size={16} /></span><p><strong>Follow up with {clientData[0].name.split(" ")[0]}</strong><span>Send a check-in before 5 PM</span></p><ChevronRight size={14} /></button>}
          </div>
          <div className="calm-callout"><span>✦</span><p><strong>You’re all caught up on notes.</strong><br />Last session note finished 18 hours ago.</p></div>
        </section>
      </div>

      <div className="dashboard-grid lower-grid">
        <section className="panel assignments-panel">
          <SectionTitle action={<button className="text-action" onClick={() => onNavigate("Clients")}>See all <ArrowRight size={13} /></button>}>Client homework</SectionTitle>
          <div className="assignment-list">
            {assignmentData.map((assignment) => {
              const client = clientData.find((item) => item.name === assignment.client);
              const done = doneAssignments.includes(assignment.id);
              if (!client) return null;
              return (
                <div className={cn("assignment-row", done && "done")} key={assignment.id}>
                  <button className="check-button" onClick={() => onToggleAssignment(assignment.id)} aria-label={`Mark ${assignment.title} complete`}>{done && <Check size={12} />}</button>
                  <Avatar initials={client.initials} color={client.color} size="sm" />
                  <button className="assignment-copy" onClick={() => onClient(client)}><strong>{assignment.title}</strong><span>{assignment.client}</span></button>
                  {assignment.required && <Badge variant="warning">Required</Badge>}
                  <span className={cn("due-date", assignment.due === "Today" && "today")}>{assignment.due}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel activity-panel">
          <SectionTitle action={<button className="icon-button"><MoreHorizontal size={17} /></button>}>Recent activity</SectionTitle>
          <div className="activity-list">
            <div><span className="activity-dot green"><Check size={11} /></span><p><strong>Maya completed a reflection</strong><span>“What I want from my next role”</span><small>42 min ago</small></p></div>
            <div><span className="activity-dot purple"><PenLine size={11} /></span><p><strong>Jamie added a shared note</strong><span>Ava Thompson · Viewable by parent</span><small>3h ago</small></p></div>
            <div><span className="activity-dot blue"><CalendarDays size={11} /></span><p><strong>Jonah rescheduled a session</strong><span>Moved to Friday at 11:00 AM</span><small>Yesterday</small></p></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ClientsView({
  clientData,
  search,
  setSearch,
  filter,
  setFilter,
  onClient,
  onAdd,
}: {
  clientData: Client[];
  search: string;
  setSearch: (value: string) => void;
  filter: "All" | "Adult" | "Teen";
  setFilter: (value: "All" | "Adult" | "Teen") => void;
  onClient: (client: Client) => void;
  onAdd: () => void;
}) {
  const filtered = useMemo(() => clientData.filter((client) => {
    const matchesSearch = client.name.toLowerCase().includes(search.toLowerCase()) || client.email.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "All" || client.type === filter);
  }), [clientData, search, filter]);

  return (
    <div className="clients-page page-enter">
      <div className="page-heading compact-heading">
        <div><h1>Clients</h1><p>Every relationship, goal, and next step in one place.</p></div>
        <Button variant="accent" onClick={onAdd}><Plus size={15} />Add client</Button>
      </div>
      <div className="client-toolbar">
        <div className="filter-tabs">
          {(["All", "Adult", "Teen"] as const).map((item) => <button key={item} className={cn(filter === item && "active")} onClick={() => setFilter(item)}>{item}{item === "All" && <span>{clientData.length}</span>}</button>)}
        </div>
        <div className="inline-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" aria-label="Search clients" />{search && <button onClick={() => setSearch("")}><X size={14} /></button>}</div>
      </div>

      {filtered.length ? (
        <div className="client-table panel">
          <div className="client-table-head"><span>Client</span><span>Next session</span><span>Coach</span><span>Package</span><span>Payment</span><span /></div>
          {filtered.map((client) => (
            <button className="client-table-row" key={client.id} onClick={() => onClient(client)}>
              <span className="client-cell"><Avatar initials={client.initials} color={client.color} /><span><strong>{client.name}</strong><small>{client.type === "Teen" ? `Teen · Age ${client.age}` : client.email}</small></span>{client.type === "Teen" && <Badge variant="blue"><ShieldCheck size={10} />Minor</Badge>}</span>
              <span><strong>{client.nextSession}</strong><small>{client.nextSessionTime || "—"}</small></span>
              <span>{client.coach}</span>
              <span><strong>{client.package.split(" · ")[0]}</strong><small>{client.cadence}</small></span>
              <span><Badge variant={client.payment === "Paid" ? "success" : client.payment === "Past due" ? "rose" : "warning"}>{client.payment}</Badge></span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state panel"><span><Search size={22} /></span><h3>No clients found</h3><p>Try a different name or client type.</p><Button variant="outline" onClick={() => { setSearch(""); setFilter("All"); }}>Clear filters</Button></div>
      )}
    </div>
  );
}

function ClientProfile({
  client,
  assignmentData,
  sessionData,
  tab,
  setTab,
  onBack,
  onSession,
  onSchedule,
  onAssign,
  onSharing,
  onPortal,
  onOpenAssignment,
  onToast,
}: {
  client: Client;
  assignmentData: Assignment[];
  sessionData: PracticeSession[];
  tab: ClientTab;
  setTab: (tab: ClientTab) => void;
  onBack: () => void;
  onSession: (sessionId: string | null) => void;
  onSchedule: () => void;
  onAssign: () => void;
  onSharing: () => void;
  onPortal: () => void;
  onOpenAssignment: (assignment: Assignment) => void;
  onToast: (message: string) => void;
}) {
  const clientAssignments = assignmentData.filter((assignment) => assignment.clientId === client.id);
  const clientSessions = sessionData.filter((session) => session.clientId === client.id);
  const nextScheduledSessionId = [...clientSessions].filter((session) => session.status === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.id || null;
  return (
    <div className="client-profile page-enter">
      <button className="back-link" onClick={onBack}><ArrowLeft size={14} />All clients</button>
      <div className="profile-hero">
        <div className="profile-identity"><Avatar initials={client.initials} color={client.color} size="xl" /><div><div className="profile-name-row"><h1>{client.name}</h1><Badge variant={client.status === "Active" ? "success" : "neutral"}>{client.status === "Paused" && <Pause size={9} />}{client.status}</Badge>{client.type === "Teen" && <Badge variant="blue"><ShieldCheck size={10} />Minor · {client.age}</Badge>}</div><p>{client.pronouns} · {client.timezone} · Client since {client.joined}</p><span>{client.headline}</span></div></div>
        <div className="profile-actions"><Button variant="outline" onClick={() => onToast(`Message draft opened for ${client.name}`)}><MessageCircle size={14} />Message</Button><Button variant="outline" onClick={onSchedule}><CalendarDays size={14} />Schedule</Button><Button onClick={() => onSession(nextScheduledSessionId)}><NotebookPen size={14} />Start session</Button><button className="icon-button bordered"><MoreHorizontal size={17} /></button></div>
      </div>

      {client.type === "Teen" && (
        <div className="privacy-banner"><span className="privacy-shield"><ShieldCheck size={18} /></span><div><strong>Minor privacy controls are active</strong><p>{client.name.split(" ")[0]}’s private coaching notes stay private. Guardians only see logistics and the specific updates you choose to share.</p></div><button onClick={onSharing}>Review access <ArrowRight size={13} /></button></div>
      )}

      <div className="profile-tabs" role="tablist">
        {(["Overview", "Sessions", "Notes", "Assignments", "Files"] as ClientTab[]).map((item) => <button key={item} className={cn(tab === item && "active")} onClick={() => setTab(item)}>{item}{item === "Assignments" && <span>{clientAssignments.length}</span>}</button>)}
      </div>

      {tab === "Overview" ? (
        <div className="profile-grid">
          <div className="profile-main-column">
            <section className="panel next-session-card">
              <div className="date-tile"><strong>{client.nextSession === "Today" ? "13" : "14"}</strong><span>AUG</span></div>
              <div><p className="card-kicker">NEXT SESSION</p><h3>{client.nextSession}, {client.nextSessionTime || "time not set"}</h3><span>{client.cadence} · 50 min</span></div>
              <span className="meet-badge"><Video size={13} />Google Meet ready</span>
              <Button size="sm" onClick={() => onSession(nextScheduledSessionId)}>Start session</Button>
            </section>

            <section className="panel goals-card">
              <SectionTitle action={<Button variant="ghost" size="sm" onClick={() => onToast("Goal editor opened")}><Plus size={13} />Add goal</Button>}>Goals</SectionTitle>
              <p className="section-subcopy">Visible to {client.name.split(" ")[0]} unless you change access.</p>
              <div className="goal-list">
                {client.goals.map((goal, index) => <div key={goal.title}><span className={cn("goal-number", index === 1 && "alt")}>{index + 1}</span><div><strong>{goal.title}</strong><span><i style={{ width: `${goal.progress}%` }} /></span><small>{goal.progress}% progress</small></div><button className="icon-button"><MoreHorizontal size={16} /></button></div>)}
              </div>
            </section>

            <section className="panel notes-card">
              <SectionTitle action={<button className="text-action" onClick={() => setTab("Notes")}>All notes <ArrowRight size={13} /></button>}>Recent notes</SectionTitle>
              <div className="note-item private"><div className="note-meta"><VisibilityBadge visibility="Coach only" /><span>Aug 6 · Session 7</span></div><p>{client.name.split(" ")[0]} noticed a pattern of waiting for certainty before taking small experiments. Explore what a “safe enough” first step could look like next time.</p><div className="note-footer"><span><Paperclip size={12} />1 attachment</span><span>Edited by Alex</span></div></div>
              <div className="note-item shared"><div className="note-meta"><VisibilityBadge visibility={client.type === "Teen" ? "Coach + Parent" : "Coach + Client"} /><span>Jul 30 · Progress update</span></div><p>{client.type === "Teen" ? "We’re focusing on consistent routines and practicing how to ask for support before stress builds up." : "You’re making thoughtful progress on choosing experiments over pressure. Keep noticing where energy grows, not just where you perform well."}</p></div>
            </section>

            <section className="panel client-assignments-card">
              <SectionTitle action={<Button variant="ghost" size="sm" onClick={onAssign}><Plus size={13} />Assign</Button>}>Current assignments</SectionTitle>
              {clientAssignments.length ? clientAssignments.map((item) => <button className="profile-assignment" key={item.id} onClick={() => onOpenAssignment(item)}><span className="assignment-type-icon">{item.responseType === "text" ? <TextCursorInput size={16} /> : <ListChecks size={16} />}</span><div><strong>{item.title}</strong><span>Due {item.due} · {item.required ? "Required" : "Optional"}</span></div><Badge variant={item.status === "Overdue" ? "rose" : item.status === "Submitted" ? "purple" : item.status === "In progress" ? "warning" : "neutral"}>{item.status}</Badge><ChevronRight size={14} /></button>) : <div className="mini-empty">No current assignments</div>}
            </section>
          </div>

          <aside className="profile-side-column">
            {client.type === "Teen" && (
              <section className="panel people-card">
                <SectionTitle action={<button className="icon-button"><Plus size={15} /></button>}>People & access</SectionTitle>
                <p className="section-subcopy">You decide what each person can see.</p>
                <div className="people-list">
                  <div><Avatar initials={client.initials} color={client.color} size="sm" /><p><strong>{client.name}</strong><span>Client</span></p><Badge variant="purple">Portal</Badge></div>
                  {client.guardians?.map((person) => <div key={person.name}><Avatar initials={person.initials} size="sm" /><p><strong>{person.name}</strong><span>{person.relation} · Assignment updates {person.automaticAssignmentUpdates ? "on" : "off"}</span></p><button onClick={onSharing}><ChevronRight size={14} /></button></div>)}
                  {client.careTeam?.map((person) => <div key={person.name}><Avatar initials={person.initials} color="#dbe8f7" size="sm" /><p><strong>{person.name}</strong><span>{person.role} · Selected updates</span></p><button onClick={() => onToast(`${person.name}’s access opened`)}><ChevronRight size={14} /></button></div>)}
                </div>
                <button className="permission-note" onClick={onSharing}><LockKeyhole size={13} /><span><strong>Private session notes</strong> are visible to you only.</span><ChevronRight size={13} /></button>
              </section>
            )}

            <section className="panel details-card">
              <SectionTitle action={<button className="icon-button" onClick={() => onToast("Client details ready to edit")}><PenLine size={14} /></button>}>Details</SectionTitle>
              <dl><div><dt>Email</dt><dd>{client.email}</dd></div><div><dt>Phone</dt><dd>{client.phone}</dd></div><div><dt>Coach</dt><dd>{client.coach}</dd></div><div><dt>Cadence</dt><dd>{client.cadence}</dd></div><div><dt>Package</dt><dd>{client.package}</dd></div></dl>
            </section>

            <section className="panel billing-card">
              <SectionTitle action={<button className="text-action" onClick={() => onToast("Billing history opened")}>View all</button>}>Billing</SectionTitle>
              <div className="billing-status"><span className={cn("payment-dot", client.payment !== "Paid" && "warning")}><CircleDollarSign size={16} /></span><p><strong>{client.payment === "Paid" ? "All paid up" : client.payment}</strong><span>{client.payment === "Paid" ? "Next invoice Sep 1 · $450" : "Payment action needed"}</span></p></div>
              <div className="package-progress"><div><span>Package sessions</span><strong>5 of 8 used</strong></div><span><i style={{ width: "62.5%" }} /></span></div>
            </section>

            <section className="portal-preview"><div><span><UserRound size={15} /></span><p><strong>Client portal</strong><small>See what {client.name.split(" ")[0]} sees</small></p></div><Button variant="outline" size="sm" onClick={onPortal}>Preview</Button></section>
          </aside>
        </div>
      ) : tab === "Sessions" ? (
        <ClientSessions client={client} sessionData={clientSessions} onSession={onSession} onSchedule={onSchedule} />
      ) : tab === "Notes" ? (
        <ClientNotes client={client} onToast={onToast} />
      ) : tab === "Assignments" ? (
        <ClientAssignments client={client} assignmentData={clientAssignments} onAssign={onAssign} onOpen={onOpenAssignment} />
      ) : (
        <ClientFiles client={client} onToast={onToast} />
      )}
    </div>
  );
}

function ClientSessions({ client, sessionData, onSession, onSchedule }: { client: Client; sessionData: PracticeSession[]; onSession: (sessionId: string | null) => void; onSchedule: () => void }) {
  const ordered = [...sessionData].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Sessions</h2><p>Upcoming conversations and context from every session with {client.name.split(" ")[0]}.</p></div><div className="heading-actions"><Button variant="outline" onClick={onSchedule}><CalendarDays size={14} />Schedule</Button><Button onClick={() => onSession(null)}><Plus size={14} />Start session</Button></div></div><div className="timeline-list">{ordered.length ? ordered.map((session, index) => { const date = new Date(session.startsAt); return <button className="timeline-card panel" key={session.id} onClick={() => onSession(session.id)}><div className="timeline-date"><strong>{formatPracticeDate(session.startsAt, { day: "numeric" })}</strong><span>{formatPracticeDate(session.startsAt, { month: "short" })}</span></div><div><div className="timeline-card-title"><strong>{formatPracticeTime(session.startsAt)}</strong><Badge variant={session.status === "scheduled" ? "blue" : session.status === "attended" ? "success" : "neutral"}>{session.status.replace("_", " ")}</Badge></div><p>{session.status === "scheduled" ? `${session.meetingProvider === "google_meet" ? "Google Meet" : session.meetingProvider === "zoom" ? "Zoom" : "Session"} is ready. Open the workspace to capture attendance, notes, and follow-up.` : index === 0 ? "Session complete. Notes and client follow-up are kept together here." : "Review the private record and shared follow-up from this session."}</p><span><Clock3 size={13} />{Math.round((new Date(session.endsAt).getTime() - date.getTime()) / 60_000)} min <VisibilityBadge visibility="Coach only" /></span></div><ChevronRight size={16} /></button>; }) : <div className="empty-state panel"><span><CalendarDays size={22} /></span><h3>No sessions yet</h3><p>Schedule the first session or start a note now.</p><Button onClick={onSchedule}>Schedule session</Button></div>}</div></div>;
}

function ClientNotes({ client, onToast }: { client: Client; onToast: (message: string) => void }) {
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Notes</h2><p>Private thinking and intentional updates, with visibility attached to every note.</p></div><Button onClick={() => onToast("New note opened with Coach only visibility")}><Plus size={14} />New note</Button></div><div className="privacy-legend"><strong><LockKeyhole size={13} />Visibility guide</strong>{(["Coach only", "Coach + Client", ...(client.type === "Teen" ? ["Coach + Parent", "Everyone"] : [])] as Visibility[]).map((item) => <VisibilityBadge key={item} visibility={item} />)}</div><div className="notes-feed">{[0,1,2].map((item) => <article className="panel feed-note" key={item}><div><VisibilityBadge visibility={item === 0 ? "Coach only" : item === 1 && client.type === "Teen" ? "Coach + Parent" : "Coach + Client"} /><span>{item === 0 ? "Aug 6" : item === 1 ? "Jul 30" : "Jul 23"}</span><button><MoreHorizontal size={15} /></button></div><h3>{item === 0 ? "Post-session observations" : item === 1 ? "Progress update" : "Shared session takeaway"}</h3><p>{item === 0 ? "There was a noticeable shift when we reframed the next decision as an experiment. Return to the language of curiosity next session." : item === 1 && client.type === "Teen" ? "We’re focusing on building consistent routines and practicing how to ask for support early." : "Keep noticing the difference between the path that looks impressive and the path that feels energizing."}</p><small>Edited by Alex Morgan</small></article>)}</div></div>;
}

function ClientAssignments({ client, assignmentData, onAssign, onOpen }: { client: Client; assignmentData: Assignment[]; onAssign: () => void; onOpen: (assignment: Assignment) => void }) {
  const active = assignmentData.filter((item) => item.status !== "Complete" && item.status !== "Reviewed");
  const finished = assignmentData.filter((item) => item.status === "Complete" || item.status === "Reviewed");
  const row = (item: Assignment) => <button className={cn("board-assignment", (item.status === "Complete" || item.status === "Reviewed") && "completed")} key={item.id} onClick={() => onOpen(item)}><span>{item.responseType === "text" ? <TextCursorInput size={16} /> : item.status === "Complete" || item.status === "Reviewed" ? <Check size={15} /> : <ListChecks size={16} />}</span><p><strong>{item.title}</strong><small>Due {item.due} · {item.required ? "Required" : "Optional"}{item.guardianLogisticsShared ? " · Guardian logistics shared" : ""}</small></p><VisibilityBadge visibility={item.visibility} /><Badge variant={item.status === "Overdue" ? "rose" : item.status === "Submitted" ? "purple" : item.status === "Reviewed" ? "success" : "warning"}>{item.status}</Badge><ChevronRight size={14} /></button>;
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Assignments</h2><p>Tasks and reflections with a clear response type, due date, and sharing boundary.</p></div><Button onClick={onAssign}><Plus size={14} />New assignment</Button></div><div className="assignment-board"><section className="panel"><SectionTitle>Needs attention</SectionTitle>{active.length ? active.map(row) : <div className="mini-empty">Nothing outstanding for {client.name.split(" ")[0]}</div>}</section><section className="panel"><SectionTitle>Completed & reviewed</SectionTitle>{finished.length ? finished.map(row) : <div className="mini-empty">Completed work will appear here.</div>}</section></div></div>;
}

function ClientFiles({ client, onToast }: { client: Client; onToast: (message: string) => void }) {
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Files & agreements</h2><p>Securely stored resources, forms, and signed documents.</p></div><Button onClick={() => onToast("Secure upload opened")}><Plus size={14} />Upload file</Button></div><div className="files-table panel">{["Signed coaching agreement.pdf", "Client intake questionnaire.pdf", "Values worksheet.pdf"].map((name, index) => <button key={name}><span className={cn("file-icon", index === 0 && "signed")}><FileText size={17} /></span><p><strong>{name}</strong><small>{index === 0 ? `${client.name} ${client.type === "Teen" ? "+ guardian" : ""} · Signed Aug 1` : `${index + 2}.4 MB · Updated Jul ${28 - index}`}</small></p>{index === 0 && <Badge variant="success"><FileCheck2 size={10} />Documented</Badge>}<VisibilityBadge visibility={index === 2 ? "Coach + Client" : client.type === "Teen" ? "Coach + Parent" : "Coach only"} /><MoreHorizontal size={15} /></button>)}</div></div>;
}

function CalendarView({ clientData, sessionData, onSchedule, onSession, onToast }: { clientData: Client[]; sessionData: PracticeSession[]; onSchedule: () => void; onSession: (client: Client, sessionId: string) => void; onToast: (message: string) => void }) {
  const days = ["MON 10", "TUE 11", "WED 12", "THU 13", "FRI 14"];
  const visibleSessions = sessionData.filter((session) => session.status === "scheduled").slice(0, 5);
  return <div className="calendar-page page-enter"><div className="page-heading compact-heading"><div><h1>Calendar</h1><p>Your coaching week · Pacific Time</p></div><div className="heading-actions"><Button variant="outline" onClick={() => onToast("Availability editor opened")}><Clock3 size={14} />Availability</Button><Button variant="outline" onClick={() => onToast("Booking page copied")}><Link2 size={14} />Booking page</Button><Button variant="accent" onClick={onSchedule}><Plus size={14} />New session</Button></div></div><div className="calendar-status"><span><i />Google Calendar connected</span><span><Video size={13} />Meet links added automatically</span><button onClick={() => onToast("Calendar settings opened")}>Manage</button></div><div className="calendar-agenda panel"><div className="calendar-controls"><button className="today-button">Today</button><strong>Upcoming sessions</strong><span /></div>{visibleSessions.length ? visibleSessions.map((session) => { const client = clientData.find((item) => item.id === session.clientId); return <button className="agenda-session" key={session.id} onClick={() => client && onSession(client, session.id)}><div className="agenda-date"><strong>{formatPracticeDate(session.startsAt, { day: "numeric" })}</strong><span>{formatPracticeDate(session.startsAt, { month: "short" })}</span></div>{client && <Avatar initials={client.initials} color={client.color} size="sm" />}<p><strong>{session.client}</strong><span>{formatPracticeTime(session.startsAt)} · {session.meetingProvider === "google_meet" ? "Google Meet" : session.meetingProvider === "zoom" ? "Zoom" : "Session"}</span></p><Badge variant="success">Scheduled</Badge><ChevronRight size={15} /></button>; }) : <div className="empty-state"><span><CalendarDays size={22} /></span><h3>Your week is open</h3><p>Schedule a session from here or from any client profile.</p><Button onClick={onSchedule}>Schedule session</Button></div>}</div><div className="calendar-shell panel calendar-week-preview"><div className="week-grid"><div className="time-column header" />{days.map((day) => <div className={cn("day-header", day.includes("13") && "today")} key={day}>{day.split(" ")[0]}<strong>{day.split(" ")[1]}</strong></div>)}{["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM"].map((time) => <div className="calendar-row" key={time}><div className="time-label">{time}</div>{days.map((day) => <div className="calendar-cell" key={day + time} />)}</div>)}</div></div></div>;
}

function ResourcesView({ resourcesData, onToast }: { resourcesData: typeof resources; onToast: (message: string) => void }) {
  const [resourceSearch, setResourceSearch] = useState("");
  const visible = resourcesData.filter((item) => item.title.toLowerCase().includes(resourceSearch.toLowerCase()));
  return <div className="resources-page page-enter"><div className="page-heading compact-heading"><div><h1>Resources</h1><p>Your reusable library of tools, prompts, and learning materials.</p></div><Button variant="accent" onClick={() => onToast("Secure resource upload opened")}><Plus size={15} />Add resource</Button></div><div className="resource-toolbar"><div className="inline-search"><Search size={15} /><input value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder="Search your library" /></div><div className="resource-filters"><button className="active">All</button><button>Worksheets</button><button>Guides</button><button>Media</button></div></div>{visible.length ? <div className="resource-grid">{visible.map((resource) => <button className="resource-card panel" key={resource.title} onClick={() => onToast(`${resource.title} opened`)}><div className={cn("resource-cover", resource.color)}><span className="resource-brand">SOLI / TOOLS</span><FileText size={28} strokeWidth={1.3} /><strong>{resource.title}</strong><i /></div><div className="resource-card-copy"><div><Badge>{resource.type}</Badge><span className="icon-button"><MoreHorizontal size={15} /></span></div><h3>{resource.title}</h3><p>{resource.size} · Assigned to {resource.assigned} clients</p></div></button>)}</div> : <div className="empty-state panel"><span><BookOpen size={22} /></span><h3>No resources found</h3><p>Try a broader search.</p></div>}</div>;
}

function TemplatesView({ templatesData, onToast }: { templatesData: typeof templates; onToast: (message: string) => void }) {
  const icons = { sparkles: Sparkles, shield: ShieldCheck, route: Route, notes: NotebookPen, check: ListChecks, file: FileCheck2 };
  return <div className="templates-page page-enter"><div className="page-heading compact-heading"><div><h1>Templates</h1><p>Create it once. Deliver a thoughtful, consistent client experience every time.</p></div><Button variant="accent" onClick={() => onToast("New template builder opened")}><Plus size={15} />New template</Button></div><div className="template-starter"><div><span><WandSparkles size={19} /></span><div><h3>Build a complete coaching flow</h3><p>Combine forms, agreements, sessions, assignments, and payment steps into one reusable program.</p></div></div><Button variant="soft" onClick={() => onToast("Program builder opened")}>Build a program <ArrowRight size={13} /></Button></div><div className="template-tabs"><button className="active">All templates <span>{templatesData.length}</span></button><button>Onboarding</button><button>Programs</button><button>Sessions</button><button>Assignments</button></div><div className="template-grid">{templatesData.map((template) => { const Icon = icons[template.icon as keyof typeof icons] || Sparkles; return <button className="template-card panel" key={template.title} onClick={() => onToast(`${template.title} opened`)}><div className={cn("template-icon", template.type.toLowerCase())}><Icon size={18} /></div><span className="icon-button"><MoreHorizontal size={16} /></span><Badge variant={template.type === "Onboarding" ? "purple" : template.type === "Program" ? "success" : "neutral"}>{template.type}</Badge><h3>{template.title}</h3><p>{template.steps} steps · Updated {template.updated}</p><div className="template-footer"><span className="mini-avatars"><i>AM</i><i>JL</i></span><span>Used {template.steps * 3 + 2} times</span><ChevronRight size={14} /></div></button>})}</div></div>;
}

function CommandPalette({ clientData, onClose, onNavigate, onClient }: { clientData: Client[]; onClose: () => void; onNavigate: (view: View) => void; onClient: (client: Client) => void }) {
  const [query, setQuery] = useState("");
  const matches = clientData.filter((client) => client.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="command-palette" onMouseDown={(event) => event.stopPropagation()}><div className="command-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients, notes, sessions…" /><kbd>ESC</kbd></div><div className="command-results"><p>QUICK NAVIGATION</p><div className="command-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { onNavigate(label); onClose(); }}><Icon size={16} /><span>{label}</span><Command size={12} /></button>)}</div><p>CLIENTS</p>{matches.slice(0,4).map((client) => <button className="command-client" key={client.id} onClick={() => { onClient(client); onClose(); }}><Avatar initials={client.initials} color={client.color} size="sm" /><span><strong>{client.name}</strong><small>{client.type} · {client.nextSession} {client.nextSessionTime}</small></span><ArrowRight size={13} /></button>)}</div><div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span>Searches stay private</span></div></div></div>;
}

type AuthView = "sign_in" | "sign_up" | "forgot" | "check_email" | "set_password";

function AuthScreen({ state, error, needsPasswordUpdate, onSignIn, onOAuth, onSignUp, onReset, onUpdatePassword }: {
  state: ConnectionState;
  error: string | null;
  needsPasswordUpdate: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onOAuth: (provider: "google" | "apple") => Promise<void>;
  onSignUp: (fullName: string, email: string, password: string) => Promise<{ requiresEmailConfirmation: boolean }>;
  onReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
}) {
  const [view, setView] = useState<AuthView>(needsPasswordUpdate ? "set_password" : "sign_in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "apple" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (needsPasswordUpdate) setView("set_password");
  }, [needsPasswordUpdate]);

  const changeView = (next: AuthView) => {
    setView(next);
    setPassword("");
    setConfirmPassword("");
    setFormError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (view === "sign_in") await onSignIn(email.trim(), password);
      if (view === "sign_up") {
        if (password.length < 10) throw new Error("Use at least 10 characters for your password.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const result = await onSignUp(fullName.trim(), email.trim(), password);
        if (result.requiresEmailConfirmation) setView("check_email");
      }
      if (view === "forgot") {
        await onReset(email.trim());
        setView("check_email");
      }
      if (view === "set_password") {
        if (password.length < 10) throw new Error("Use at least 10 characters for your password.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await onUpdatePassword(password);
      }
    } catch (authError) {
      setFormError(authError instanceof Error ? authError.message : "We couldn't complete that request.");
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = async (provider: "google" | "apple") => {
    setOauthProvider(provider);
    setFormError(null);
    try {
      await onOAuth(provider);
    } catch (oauthError) {
      setFormError(oauthError instanceof Error ? oauthError.message : `Unable to continue with ${provider === "google" ? "Google" : "Apple"}.`);
      setOauthProvider(null);
    }
  };

  if (state === "loading" && !needsPasswordUpdate) {
    return <main className="auth-shell"><section className="auth-card auth-loading" role="status" aria-live="polite"><AppLogo /><span className="auth-spinner" aria-hidden="true" /><p>Securing your workspace…</p></section></main>;
  }

  const title = view === "sign_up" ? "Create your practice" : view === "forgot" ? "Reset your password" : view === "check_email" ? "Check your email" : view === "set_password" ? "Choose your password" : "Welcome back";
  const copy = view === "sign_up" ? "Start a private workspace for your coaching practice." : view === "forgot" ? "We'll send you a secure link to choose a new password." : view === "check_email" ? `We sent a secure link to ${email || "your inbox"}.` : view === "set_password" ? "Finish activating your account with a password only you know." : "Sign in to your private Soli workspace.";

  return (
    <main className="auth-shell">
      <div className="auth-ambient auth-ambient-one" /><div className="auth-ambient auth-ambient-two" />
      <section className="auth-card">
        <header className="auth-brand"><AppLogo /><span><ShieldCheck size={12} />Private by design</span></header>
        <div className="auth-heading"><span className="auth-icon">{view === "check_email" ? <Mail size={20} /> : view === "set_password" || view === "forgot" ? <KeyRound size={20} /> : <LogIn size={20} />}</span><h1>{title}</h1><p>{copy}</p></div>
        {view === "check_email" ? (
          <div className="auth-check-email"><div><CheckCircle2 size={20} /></div><p>The link may take a minute to arrive. Check your spam folder if you don’t see it.</p><Button variant="outline" onClick={() => changeView("sign_in")}><ArrowLeft size={14} />Back to sign in</Button></div>
        ) : (
          <>
          {(view === "sign_in" || view === "sign_up") && <div className="oauth-options"><button className="oauth-provider-button" type="button" aria-label={oauthProvider === "google" ? "Opening Google" : "Sign in with Google"} aria-busy={oauthProvider === "google"} onClick={() => void startOAuth("google")} disabled={submitting || oauthProvider !== null}><img src="/oauth/google-signin-light.png" alt="" width="180" height="40" /></button><button className="oauth-provider-button" type="button" aria-label={oauthProvider === "apple" ? "Opening Apple" : "Continue with Apple"} aria-busy={oauthProvider === "apple"} onClick={() => void startOAuth("apple")} disabled={submitting || oauthProvider !== null}><img src="/oauth/apple-continue-white.png" alt="" width="180" height="40" /></button></div>}
          {(view === "sign_in" || view === "sign_up") && <div className="auth-divider"><span>or continue with email</span></div>}
          <form className="auth-form" onSubmit={submit}>
            {view === "sign_up" && <label>Full name<input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder="Your name" /></label>}
            {view !== "set_password" && <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@yourpractice.com" /></label>}
            {(view === "sign_in" || view === "sign_up" || view === "set_password") && <label>{view === "set_password" ? "New password" : "Password"}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={view === "sign_in" ? "current-password" : "new-password"} minLength={view === "sign_in" ? undefined : 10} required placeholder="••••••••••••" /></label>}
            {(view === "sign_up" || view === "set_password") && <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} required placeholder="••••••••••••" /></label>}
            {view === "sign_in" && <button className="auth-text-button" type="button" onClick={() => changeView("forgot")}>Forgot password?</button>}
            {(formError || error) && <div className="data-error" role="alert">{formError || error}</div>}
            <Button variant="accent" type="submit" disabled={submitting}>{submitting ? "Please wait…" : view === "sign_up" ? "Create practice" : view === "forgot" ? "Send reset link" : view === "set_password" ? "Set password and continue" : "Sign in"}</Button>
          </form>
          </>
        )}
        {(view === "sign_in" || view === "sign_up") && <footer className="auth-switch">{view === "sign_in" ? <>New to Soli? <button onClick={() => changeView("sign_up")}>Create an account</button></> : <>Already have an account? <button onClick={() => changeView("sign_in")}>Sign in</button></>}</footer>}
        <div className="auth-trust"><LockKeyhole size={11} />Your client data is protected by account and organization permissions.</div>
      </section>
    </main>
  );
}

function AccountModal({ state, email, error, onClose, onSignOut }: { state: ConnectionState; email: string | null; error: string | null; onClose: () => void; onSignOut: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const signOut = async () => {
    setSubmitting(true);
    setFormError(null);
    try { await onSignOut(); onClose(); } catch (signOutError) { setFormError(signOutError instanceof Error ? signOutError.message : "Unable to sign out."); setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="data-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">ACCOUNT</p><h2>Your secure workspace</h2></div><button onClick={onClose} aria-label="Close account settings"><X size={18} /></button></div><div className="data-connected"><span><CheckCircle2 size={20} /></span><div><strong>Live data is active</strong><p>{email || "Signed in"} · Protected by row-level permissions.</p></div></div>{(formError || error) && <div className="data-error">{formError || error}</div>}<Button className="account-signout" variant="outline" onClick={() => void signOut()} disabled={submitting}>{submitting ? "Signing out…" : "Sign out"}</Button><div className="data-modal-note"><LockKeyhole size={12} />Your browser never receives administrative credentials.</div></div></div>;
}

function QuickAdd({ onClose, onSchedule, onAssignment, onSession, onToast }: { onClose: () => void; onSchedule: () => void; onAssignment: () => void; onSession: () => void; onToast: (message: string) => void }) {
  const actions = [{ icon: UserRound, title: "Add client", copy: "Start a new client record", action: () => onToast("Client onboarding is next in the MVP") }, { icon: CalendarDays, title: "Schedule session", copy: "Book or block time", action: onSchedule }, { icon: NotebookPen, title: "Start session", copy: "Notes, attendance, and follow-up", action: onSession }, { icon: ListChecks, title: "Assignment", copy: "Send a task or reflection", action: onAssignment }, { icon: FileText, title: "Upload resource", copy: "Add to your library", action: () => onToast("Secure resource upload opened") }, { icon: Send, title: "Send message", copy: "Reach out to a client", action: () => onToast("Message composer opened") }];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="quick-add-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">CREATE</p><h2>What would you like to add?</h2></div><button onClick={onClose}><X size={18} /></button></div><div className="quick-action-grid">{actions.map(({ icon: Icon, title, copy, action }) => <button key={title} onClick={action}><span><Icon size={18} /></span><p><strong>{title}</strong><small>{copy}</small></p><ChevronRight size={14} /></button>)}</div></div></div>;
}

function localDateTime(hoursAhead = 24) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function SessionPanel({ client, sessionId, onClose, onComplete }: { client: Client; sessionId: string | null; onClose: () => void; onComplete: (input: { sessionId: string | null; clientId: string; attendance: "attended" | "late_cancel" | "no_show"; notes: string; noteVisibility: Visibility; sharedSummary: string; nextSessionAt: string | null; assignment: null | { title: string; instructions: string; responseType: "checkbox" | "text"; required: boolean; dueAt: string | null; guardianShare: "client_default" | "share" | "private" } }) => Promise<void> }) {
  const [visibility, setVisibility] = useState<Visibility>("Coach only");
  const [aiSummary, setAiSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [attendance, setAttendance] = useState<"attended" | "late_cancel" | "no_show">("attended");
  const [sharedSummary, setSharedSummary] = useState("");
  const [nextSessionAt, setNextSessionAt] = useState("");
  const [addAssignment, setAddAssignment] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [responseType, setResponseType] = useState<"checkbox" | "text">("checkbox");
  const [required, setRequired] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [guardianShare, setGuardianShare] = useState<"client_default" | "share" | "private">(client.type === "Teen" ? "client_default" : "private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete({ sessionId, clientId: client.id, attendance, notes, noteVisibility: visibility, sharedSummary, nextSessionAt: nextSessionAt ? new Date(nextSessionAt).toISOString() : null, assignment: addAssignment && assignmentTitle.trim() ? { title: assignmentTitle.trim(), instructions: assignmentInstructions, responseType, required, dueAt: dueAt ? new Date(dueAt).toISOString() : null, guardianShare } : null });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to finish this session.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="drawer-backdrop"><button className="drawer-scrim" onClick={onClose} aria-label="Close session panel" /><aside className="session-drawer"><header><div><p className="eyebrow">SESSION WORKSPACE</p><h2>{client.name}</h2><span>{sessionId ? "Scheduled session" : "New session"} · 50 minutes</span></div><button onClick={onClose}><X size={19} /></button></header><div className="session-context"><p><span>Active focus</span><strong>{client.goals[0]?.title || client.headline}</strong></p><span className="session-private"><LockKeyhole size={11} />Coach context</span></div><div className="session-form"><label>Attendance<div className="attendance-options">{(["attended", "late_cancel", "no_show"] as const).map((item) => <button key={item} type="button" className={cn(attendance === item && "active")} onClick={() => setAttendance(item)}>{item === "attended" && <CheckCircle2 size={14} />}{item === "attended" ? "Attended" : item === "late_cancel" ? "Late cancel" : "No show"}</button>)}</div></label><label>Session notes<span className="field-hint">Private by default. The visibility is attached to this note.</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Capture themes, observations, and next steps…" autoFocus /></label><div className="visibility-picker"><div><strong>Who can see this note?</strong><span>The coach always controls sharing.</span></div><div className="visibility-options">{(["Coach only", "Coach + Client", ...(client.type === "Teen" ? ["Coach + Parent", "Everyone"] : [])] as Visibility[]).map((item) => <button type="button" key={item} className={cn(visibility === item && "active")} onClick={() => setVisibility(item)}><LockKeyhole size={12} />{item}{visibility === item && <Check size={12} />}</button>)}</div></div><label>Client takeaway <span className="field-hint">Optional · shared directly with {client.name.split(" ")[0]}</span><textarea className="compact-textarea" value={sharedSummary} onChange={(event) => setSharedSummary(event.target.value)} placeholder="A concise recap or encouragement in your own words…" /></label><div className="ai-summary-box"><div className="ai-summary-top"><span><Mic2 size={16} /></span><div><strong>AI meeting summary</strong><p>Optional transcription and summary only. Soli never gives coaching advice.</p></div><button type="button" aria-label="Toggle AI summary" className={cn("toggle", aiSummary && "on")} onClick={() => setAiSummary(!aiSummary)}><i /></button></div>{aiSummary && <div className="ai-consent"><ShieldCheck size={13} /><span>Client consent is required before recording. Summary generation will be connected in a later build.</span></div>}</div><div className="session-wrapup-grid"><label>Next session<input type="datetime-local" value={nextSessionAt} onChange={(event) => setNextSessionAt(event.target.value)} /></label><button type="button" className={cn("add-followup-card", addAssignment && "active")} onClick={() => setAddAssignment(!addAssignment)}><ListChecks size={16} /><span><strong>Add assignment</strong><small>Publish a task with this follow-up</small></span><i className={cn("toggle", addAssignment && "on")}><i /></i></button></div>{addAssignment && <div className="inline-assignment"><label>Assignment title<input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="One clear next step" /></label><label>Instructions<textarea className="compact-textarea" value={assignmentInstructions} onChange={(event) => setAssignmentInstructions(event.target.value)} placeholder="What should the client do or reflect on?" /></label><div className="form-grid"><label>Response<select value={responseType} onChange={(event) => setResponseType(event.target.value as "checkbox" | "text")}><option value="checkbox">Completion checkbox</option><option value="text">Written response</option></select></label><label>Due<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div><label className="check-control"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />Required to complete</label>{client.type === "Teen" && <GuardianShareSelect value={guardianShare} onChange={setGuardianShare} />}</div>}{error && <div className="data-error" role="alert">{error}</div>}</div><footer><span><LockKeyhole size={12} />Private until you finish</span><div><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={() => void finish()} disabled={!notes.trim() || saving}>{saving ? "Saving…" : "Finish session"}</Button></div></footer></aside></div>;
}

function ScheduleSessionModal({ clients: clientData, initialClientId, onClose, onSave }: { clients: Client[]; initialClientId: string | null; onClose: () => void; onSave: (input: { clientId: string; startsAt: string; durationMinutes: number; meetingProvider: "google_meet" | "zoom" | "other" | null }) => Promise<void> }) {
  const [clientId, setClientId] = useState(initialClientId || clientData[0]?.id || "");
  const [startsAt, setStartsAt] = useState(localDateTime());
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [meetingProvider, setMeetingProvider] = useState<"google_meet" | "zoom" | "other" | null>("google_meet");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave({ clientId, startsAt, durationMinutes, meetingProvider }); } finally { setSaving(false); } };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="workflow-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">SCHEDULING</p><h2>Schedule a session</h2></div><button type="button" onClick={onClose}><X size={18} /></button></div><p className="modal-copy">Choose the client and time. You can begin the session workspace directly from the calendar.</p><div className="form-stack"><label>Client<select value={clientId} onChange={(event) => setClientId(event.target.value)} required>{clientData.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><div className="form-grid"><label>Starts<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label>Duration<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={30}>30 minutes</option><option value={50}>50 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label></div><label>Meeting location<select value={meetingProvider || "other"} onChange={(event) => setMeetingProvider(event.target.value as "google_meet" | "zoom" | "other")}><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="other">Other / in person</option></select></label><div className="privacy-callout neutral"><Video size={16} /><span><strong>Calendar-ready</strong> Meeting-link creation is represented here; provider API automation comes with the calendar integration milestone.</span></div></div><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" variant="accent" disabled={saving || !clientId}>{saving ? "Scheduling…" : "Schedule session"}</Button></div></form></div>;
}

function GuardianShareSelect({ value, onChange }: { value: "client_default" | "share" | "private"; onChange: (value: "client_default" | "share" | "private") => void }) {
  return <label>Guardian logistics<select value={value} onChange={(event) => onChange(event.target.value as "client_default" | "share" | "private")}><option value="client_default">Use this client’s guardian settings</option><option value="share">Share logistics for this assignment</option><option value="private">Keep this assignment private</option></select><span className="field-hint">Only title, due date, required status, and completion can be shared. Responses stay private.</span></label>;
}

function AssignmentComposer({ client, onClose, onSave }: { client: Client; onClose: () => void; onSave: (input: { title: string; instructions: string; responseType: "checkbox" | "text"; required: boolean; dueAt: string | null; guardianShare: "client_default" | "share" | "private" }) => Promise<void> }) {
  const [title, setTitle] = useState(""); const [instructions, setInstructions] = useState(""); const [responseType, setResponseType] = useState<"checkbox" | "text">("checkbox"); const [required, setRequired] = useState(false); const [dueAt, setDueAt] = useState(localDateTime(72)); const [guardianShare, setGuardianShare] = useState<"client_default" | "share" | "private">(client.type === "Teen" ? "client_default" : "private"); const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await onSave({ title: title.trim(), instructions, responseType, required, dueAt: dueAt ? new Date(dueAt).toISOString() : null, guardianShare }); } finally { setSaving(false); } };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="workflow-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">ASSIGN TO {client.name.toUpperCase()}</p><h2>Create an assignment</h2></div><button type="button" onClick={onClose}><X size={18} /></button></div><p className="modal-copy">Keep it clear: one outcome, one response, and an obvious due date.</p><div className="form-stack"><label>Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Three moments I trusted myself" required /></label><label>Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="What should the client do?" /></label><div className="response-choice"><button type="button" className={cn(responseType === "checkbox" && "active")} onClick={() => setResponseType("checkbox")}><ListChecks size={17} /><span><strong>Checkbox</strong><small>Client marks it done</small></span></button><button type="button" className={cn(responseType === "text" && "active")} onClick={() => setResponseType("text")}><TextCursorInput size={17} /><span><strong>Text response</strong><small>Client submits writing</small></span></button></div><label>Due date<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><label className="check-control"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />Make this mandatory</label>{client.type === "Teen" && <GuardianShareSelect value={guardianShare} onChange={setGuardianShare} />}<div className="privacy-callout"><LockKeyhole size={16} /><span><strong>Coach + client</strong> The assignment response is never automatically visible to a guardian.</span></div></div><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" variant="accent" disabled={!title.trim() || saving}>{saving ? "Publishing…" : "Publish assignment"}</Button></div></form></div>;
}

function AssignmentDetail({ assignment, onClose, onSubmit, onReview }: { assignment: Assignment; onClose: () => void; onSubmit: (responseText: string, completed: boolean) => Promise<void>; onReview: () => Promise<void> }) {
  const [response, setResponse] = useState(assignment.responseText); const [checked, setChecked] = useState(assignment.status === "Complete" || assignment.status === "Reviewed"); const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await onSubmit(response, assignment.responseType === "checkbox" ? checked : false); } finally { setSaving(false); } };
  const reviewable = assignment.status === "Submitted" || assignment.status === "Complete";
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="workflow-modal assignment-detail" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{assignment.client.toUpperCase()} · DUE {assignment.due.toUpperCase()}</p><h2>{assignment.title}</h2></div><button onClick={onClose}><X size={18} /></button></div><div className="detail-meta"><Badge variant={assignment.required ? "warning" : "neutral"}>{assignment.required ? "Required" : "Optional"}</Badge><Badge variant={assignment.status === "Overdue" ? "rose" : assignment.status === "Reviewed" ? "success" : "purple"}>{assignment.status}</Badge><VisibilityBadge visibility={assignment.visibility} /></div><p className="assignment-instructions">{assignment.instructions || "No additional instructions."}</p>{assignment.guardianLogisticsShared && <div className="privacy-callout guardian"><ShieldCheck size={16} /><span><strong>Guardian logistics shared</strong> Title, due date, required status, and completion are visible. The response stays private.</span></div>}<div className="response-preview"><p className="eyebrow">CLIENT RESPONSE</p>{assignment.responseType === "text" ? <label>Written reflection<textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="The client’s response appears here…" /></label> : <label className="completion-check"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span><strong>Mark this assignment complete</strong><small>The coach and client will see the updated status.</small></span></label>}</div><div className="modal-actions"><Button variant="outline" onClick={onClose}>Close</Button>{reviewable && <Button variant="soft" onClick={() => void onReview()}>Mark reviewed</Button>}<Button variant="accent" onClick={() => void submit()} disabled={saving || (assignment.responseType === "text" && !response.trim())}>{saving ? "Saving…" : assignment.responseType === "text" ? "Submit response" : "Save completion"}</Button></div></div></div>;
}

function GuardianSharingModal({ client, onClose, onChange }: { client: Client; onClose: () => void; onChange: (guardianId: string, enabled: boolean) => Promise<void> }) {
  const [pending, setPending] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => Object.fromEntries((client.guardians || []).map((guardian) => [guardian.id, guardian.automaticAssignmentUpdates])));
  const [error, setError] = useState<string | null>(null);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="workflow-modal sharing-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">PEOPLE & ACCESS</p><h2>Guardian assignment updates</h2></div><button onClick={onClose}><X size={18} /></button></div><p className="modal-copy">Choose which guardians automatically receive assignment logistics for {client.name}. Coaches can override this on each assignment.</p><div className="sharing-boundary"><div><span><Check size={14} /></span><p><strong>May be shared</strong><small>Title, due date, required or optional, completion status</small></p></div><div><span className="locked"><LockKeyhole size={14} /></span><p><strong>Always private unless explicitly shared elsewhere</strong><small>Written responses, session notes, coach observations</small></p></div></div><div className="guardian-list">{client.guardians?.map((guardian) => { const enabled = preferences[guardian.id] ?? false; return <div key={guardian.id}><Avatar initials={guardian.initials} size="sm" /><p><strong>{guardian.name}</strong><small>{guardian.relation} · {guardian.permissions.join(", ")}</small></p><button aria-label={`Toggle updates for ${guardian.name}`} aria-pressed={enabled} className={cn("toggle", enabled && "on")} disabled={pending === guardian.id} onClick={async () => { const next = !enabled; setError(null); setPending(guardian.id); setPreferences((current) => ({ ...current, [guardian.id]: next })); try { await onChange(guardian.id, next); } catch (updateError) { setPreferences((current) => ({ ...current, [guardian.id]: enabled })); setError(updateError instanceof Error ? updateError.message : "Unable to update this guardian."); } finally { setPending(null); } }}><i /></button></div>; })}</div>{error && <div className="data-error" role="alert">{error}</div>}<div className="privacy-callout"><ShieldCheck size={16} /><span><strong>The coach remains in control.</strong> Automatic sharing can be turned off here or overridden on a specific assignment.</span></div><div className="modal-actions"><Button onClick={onClose}>Done</Button></div></div></div>;
}

function ClientPortalPreview({ client, assignments: clientAssignments, onClose, onOpenAssignment, onSchedule }: { client: Client; assignments: Assignment[]; onClose: () => void; onOpenAssignment: (assignment: Assignment) => void; onSchedule: () => void }) {
  return <div className="modal-backdrop portal-backdrop" onMouseDown={onClose}><div className="portal-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><AppLogo /><Badge variant="neutral">Client portal preview</Badge></div><button onClick={onClose}><X size={18} /></button></header><main><p className="eyebrow">WELCOME BACK</p><h2>Hi, {client.name.split(" ")[0]}</h2><p className="portal-lead">Here’s everything you need before your next conversation.</p><section className="portal-next"><div className="date-tile"><strong>{client.nextSession === "Today" ? "13" : "20"}</strong><span>AUG</span></div><p><small>NEXT SESSION</small><strong>{client.nextSession}, {client.nextSessionTime || "time not set"}</strong><span>50 minutes · Google Meet</span></p><Button onClick={onSchedule} variant="outline">Reschedule</Button></section><div className="portal-columns"><section><div className="section-title-row"><h3>Your assignments</h3><span>{clientAssignments.filter((item) => item.status !== "Complete" && item.status !== "Reviewed").length} open</span></div>{clientAssignments.length ? clientAssignments.map((assignment) => <button className="portal-assignment" key={assignment.id} onClick={() => onOpenAssignment(assignment)}><span>{assignment.responseType === "text" ? <TextCursorInput size={16} /> : <ListChecks size={16} />}</span><p><strong>{assignment.title}</strong><small>Due {assignment.due} · {assignment.required ? "Required" : "Optional"}</small></p><Badge variant={assignment.status === "Overdue" ? "rose" : "neutral"}>{assignment.status}</Badge><ChevronRight size={14} /></button>) : <div className="mini-empty">You’re all caught up.</div>}</section><aside><h3>Your goals</h3>{client.goals.map((goal) => <div className="portal-goal" key={goal.title}><Target size={15} /><p><strong>{goal.title}</strong><span><i style={{ width: `${goal.progress}%` }} /></span></p></div>)}<h3>Shared resources</h3><button className="portal-resource"><FileText size={16} /><span><strong>Weekly reflection guide</strong><small>PDF · Shared by your coach</small></span></button></aside></div></main><footer><LockKeyhole size={12} />Only information intentionally shared with the client appears here.</footer></div></div>;
}
