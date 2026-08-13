"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Apple,
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
  type Client,
  type Visibility,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { saveCoachNote, usePracticeData, type ConnectionState } from "@/lib/supabase/practice-data";

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
  const [sessionOpen, setSessionOpen] = useState(false);
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
        setSessionOpen(false);
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

  const saveSessionNote = async (body: string, visibility: Visibility) => {
    const client = selectedClient || practiceClients[0];
    if (practice.mode === "supabase" && practice.organizationId && practice.userId && client) {
      await saveCoachNote({
        organizationId: practice.organizationId,
        userId: practice.userId,
        clientId: client.id,
        body,
        visibility,
      });
      await practice.refresh();
      setToast("Session note saved to Supabase");
    } else {
      setToast("Demo note completed — connect and sign in to persist it");
    }
    setSessionOpen(false);
  };

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
          {selectedClient ? (
            <ClientProfile
              client={selectedClient}
              assignmentData={practiceAssignments}
              tab={clientTab}
              setTab={setClientTab}
              onBack={() => setSelectedClient(null)}
              onSession={() => setSessionOpen(true)}
              onToast={setToast}
            />
          ) : view === "Dashboard" ? (
            <Dashboard
              clientData={practiceClients}
              assignmentData={practiceAssignments}
              onClient={openClient}
              onNavigate={navigate}
              onSession={() => setSessionOpen(true)}
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
            <CalendarView onSession={() => setSessionOpen(true)} onToast={setToast} />
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
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} onToast={(message) => { setQuickAddOpen(false); setToast(message); }} />}
      {dataPanelOpen && <AccountModal state={practice.connectionState} email={practice.userEmail} error={practice.error} onClose={() => setDataPanelOpen(false)} onSignOut={practice.signOut} />}
      {sessionOpen && <SessionPanel client={selectedClient || practiceClients[0] || clients[0]} onClose={() => setSessionOpen(false)} onSaved={saveSessionNote} />}
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
          <Button onClick={onSession}><NotebookPen size={14} />New session note</Button>
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
              const client = clientData.find((item) => item.name === session.client);
              return (
                <button className="session-row" key={session.client} onClick={() => client ? onClient(client) : onSession()}>
                  <div className="session-time"><strong>{session.time}</strong><span>{session.meridiem}</span></div>
                  <div className={cn("timeline-pin", index === 0 && "current")}><i /></div>
                  <Avatar initials={session.initials} color={session.color} size="md" />
                  <div className="session-info"><strong>{session.client}</strong><span>{session.type} · {session.duration}</span></div>
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
  tab,
  setTab,
  onBack,
  onSession,
  onToast,
}: {
  client: Client;
  assignmentData: typeof assignments;
  tab: ClientTab;
  setTab: (tab: ClientTab) => void;
  onBack: () => void;
  onSession: () => void;
  onToast: (message: string) => void;
}) {
  const clientAssignments = assignmentData.filter((assignment) => assignment.client === client.name);
  return (
    <div className="client-profile page-enter">
      <button className="back-link" onClick={onBack}><ArrowLeft size={14} />All clients</button>
      <div className="profile-hero">
        <div className="profile-identity"><Avatar initials={client.initials} color={client.color} size="xl" /><div><div className="profile-name-row"><h1>{client.name}</h1><Badge variant={client.status === "Active" ? "success" : "neutral"}>{client.status === "Paused" && <Pause size={9} />}{client.status}</Badge>{client.type === "Teen" && <Badge variant="blue"><ShieldCheck size={10} />Minor · {client.age}</Badge>}</div><p>{client.pronouns} · {client.timezone} · Client since {client.joined}</p><span>{client.headline}</span></div></div>
        <div className="profile-actions"><Button variant="outline" onClick={() => onToast(`Message draft opened for ${client.name}`)}><MessageCircle size={14} />Message</Button><Button variant="outline" onClick={() => onToast("Scheduling link copied")}><CalendarDays size={14} />Schedule</Button><Button onClick={onSession}><NotebookPen size={14} />Session note</Button><button className="icon-button bordered"><MoreHorizontal size={17} /></button></div>
      </div>

      {client.type === "Teen" && (
        <div className="privacy-banner"><span className="privacy-shield"><ShieldCheck size={18} /></span><div><strong>Minor privacy controls are active</strong><p>{client.name.split(" ")[0]}’s private coaching notes stay private. Guardians only see logistics and the specific updates you choose to share.</p></div><button onClick={() => onToast("Sharing permissions opened")}>Review access <ArrowRight size={13} /></button></div>
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
              <Button size="sm" onClick={onSession}>Start session</Button>
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
              <SectionTitle action={<Button variant="ghost" size="sm" onClick={() => onToast("Assignment composer opened")}><Plus size={13} />Assign</Button>}>Current assignments</SectionTitle>
              {clientAssignments.length ? clientAssignments.map((item) => <div className="profile-assignment" key={item.id}><span className="assignment-type-icon"><ListChecks size={16} /></span><div><strong>{item.title}</strong><span>Due {item.due} · {item.required ? "Required" : "Optional"}</span></div><Badge variant={item.status === "In progress" ? "warning" : "neutral"}>{item.status}</Badge><ChevronRight size={14} /></div>) : <div className="mini-empty">No current assignments</div>}
            </section>
          </div>

          <aside className="profile-side-column">
            {client.type === "Teen" && (
              <section className="panel people-card">
                <SectionTitle action={<button className="icon-button"><Plus size={15} /></button>}>People & access</SectionTitle>
                <p className="section-subcopy">You decide what each person can see.</p>
                <div className="people-list">
                  <div><Avatar initials={client.initials} color={client.color} size="sm" /><p><strong>{client.name}</strong><span>Client</span></p><Badge variant="purple">Portal</Badge></div>
                  {client.guardians?.map((person) => <div key={person.name}><Avatar initials={person.initials} size="sm" /><p><strong>{person.name}</strong><span>{person.relation} · {person.permissions.length} permissions</span></p><button onClick={() => onToast(`${person.name}’s permissions opened`)}><ChevronRight size={14} /></button></div>)}
                  {client.careTeam?.map((person) => <div key={person.name}><Avatar initials={person.initials} color="#dbe8f7" size="sm" /><p><strong>{person.name}</strong><span>{person.role} · Selected updates</span></p><button onClick={() => onToast(`${person.name}’s access opened`)}><ChevronRight size={14} /></button></div>)}
                </div>
                <button className="permission-note" onClick={() => onToast("Privacy matrix opened")}><LockKeyhole size={13} /><span><strong>Private session notes</strong> are visible to you only.</span><ChevronRight size={13} /></button>
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

            <section className="portal-preview"><div><span><UserRound size={15} /></span><p><strong>Client portal</strong><small>See what {client.name.split(" ")[0]} sees</small></p></div><Button variant="outline" size="sm" onClick={() => onToast("Portal preview opened safely")}>Preview</Button></section>
          </aside>
        </div>
      ) : tab === "Sessions" ? (
        <ClientSessions client={client} onSession={onSession} />
      ) : tab === "Notes" ? (
        <ClientNotes client={client} onToast={onToast} />
      ) : tab === "Assignments" ? (
        <ClientAssignments client={client} assignmentData={clientAssignments} onToast={onToast} />
      ) : (
        <ClientFiles client={client} onToast={onToast} />
      )}
    </div>
  );
}

function ClientSessions({ client, onSession }: { client: Client; onSession: () => void }) {
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Session history</h2><p>Context and notes from every conversation with {client.name.split(" ")[0]}.</p></div><Button onClick={onSession}><Plus size={14} />New session note</Button></div><div className="timeline-list">{["Aug 6", "Jul 30", "Jul 23", "Jul 16"].map((date, index) => <button className="timeline-card panel" key={date} onClick={onSession}><div className="timeline-date"><strong>{date.split(" ")[1]}</strong><span>{date.split(" ")[0]}</span></div><div><div className="timeline-card-title"><strong>Session {8 - index}</strong><Badge variant={index === 0 ? "purple" : "neutral"}>{index === 0 ? "AI summary" : "Coach notes"}</Badge></div><p>{index === 0 ? "Explored the tension between waiting for certainty and building clarity through small experiments." : "Reviewed the week, celebrated progress, and identified one focused next step."}</p><span><CheckCircle2 size={13} />Attended · 50 min <VisibilityBadge visibility="Coach only" /></span></div><ChevronRight size={16} /></button>)}</div></div>;
}

function ClientNotes({ client, onToast }: { client: Client; onToast: (message: string) => void }) {
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Notes</h2><p>Private thinking and intentional updates, with visibility attached to every note.</p></div><Button onClick={() => onToast("New note opened with Coach only visibility")}><Plus size={14} />New note</Button></div><div className="privacy-legend"><strong><LockKeyhole size={13} />Visibility guide</strong>{(["Coach only", "Coach + Client", ...(client.type === "Teen" ? ["Coach + Parent", "Everyone"] : [])] as Visibility[]).map((item) => <VisibilityBadge key={item} visibility={item} />)}</div><div className="notes-feed">{[0,1,2].map((item) => <article className="panel feed-note" key={item}><div><VisibilityBadge visibility={item === 0 ? "Coach only" : item === 1 && client.type === "Teen" ? "Coach + Parent" : "Coach + Client"} /><span>{item === 0 ? "Aug 6" : item === 1 ? "Jul 30" : "Jul 23"}</span><button><MoreHorizontal size={15} /></button></div><h3>{item === 0 ? "Post-session observations" : item === 1 ? "Progress update" : "Shared session takeaway"}</h3><p>{item === 0 ? "There was a noticeable shift when we reframed the next decision as an experiment. Return to the language of curiosity next session." : item === 1 && client.type === "Teen" ? "We’re focusing on building consistent routines and practicing how to ask for support early." : "Keep noticing the difference between the path that looks impressive and the path that feels energizing."}</p><small>Edited by Alex Morgan</small></article>)}</div></div>;
}

function ClientAssignments({ client, assignmentData, onToast }: { client: Client; assignmentData: typeof assignments; onToast: (message: string) => void }) {
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Assignments</h2><p>Tasks, reflections, habits, and worksheets between sessions.</p></div><Button onClick={() => onToast("Assignment composer opened")}><Plus size={14} />New assignment</Button></div><div className="assignment-board"><section className="panel"><SectionTitle>Current</SectionTitle>{assignmentData.length ? assignmentData.map((item) => <div className="board-assignment" key={item.id}><span><ListChecks size={16} /></span><p><strong>{item.title}</strong><small>Due {item.due} · {item.required ? "Mandatory" : "Optional"}</small></p><VisibilityBadge visibility={item.visibility} /><Badge variant="warning">{item.status}</Badge></div>) : <div className="mini-empty">No current assignments for {client.name.split(" ")[0]}</div>}</section><section className="panel"><SectionTitle>Completed</SectionTitle>{["One brave conversation", "Ideal week reflection"].map((title, index) => <div className="board-assignment completed" key={title}><span><Check size={15} /></span><p><strong>{title}</strong><small>Completed {index ? "Jul 20" : "Aug 3"}</small></p><Badge variant="success">Complete</Badge></div>)}</section></div></div>;
}

function ClientFiles({ client, onToast }: { client: Client; onToast: (message: string) => void }) {
  return <div className="tab-content page-enter"><div className="tab-content-heading"><div><h2>Files & agreements</h2><p>Securely stored resources, forms, and signed documents.</p></div><Button onClick={() => onToast("Secure upload opened")}><Plus size={14} />Upload file</Button></div><div className="files-table panel">{["Signed coaching agreement.pdf", "Client intake questionnaire.pdf", "Values worksheet.pdf"].map((name, index) => <button key={name}><span className={cn("file-icon", index === 0 && "signed")}><FileText size={17} /></span><p><strong>{name}</strong><small>{index === 0 ? `${client.name} ${client.type === "Teen" ? "+ guardian" : ""} · Signed Aug 1` : `${index + 2}.4 MB · Updated Jul ${28 - index}`}</small></p>{index === 0 && <Badge variant="success"><FileCheck2 size={10} />Documented</Badge>}<VisibilityBadge visibility={index === 2 ? "Coach + Client" : client.type === "Teen" ? "Coach + Parent" : "Coach only"} /><MoreHorizontal size={15} /></button>)}</div></div>;
}

function CalendarView({ onSession, onToast }: { onSession: () => void; onToast: (message: string) => void }) {
  const days = ["MON 10", "TUE 11", "WED 12", "THU 13", "FRI 14"];
  return <div className="calendar-page page-enter"><div className="page-heading compact-heading"><div><h1>Calendar</h1><p>August 10–16, 2026 · Pacific Time</p></div><div className="heading-actions"><Button variant="outline" onClick={() => onToast("Availability editor opened")}><Clock3 size={14} />Availability</Button><Button variant="outline" onClick={() => onToast("Booking page copied")}><Link2 size={14} />Booking page</Button><Button variant="accent" onClick={onSession}><Plus size={14} />New session</Button></div></div><div className="calendar-status"><span><i />Google Calendar connected</span><span><Video size={13} />Meet links added automatically</span><button onClick={() => onToast("Calendar settings opened")}>Manage</button></div><div className="calendar-shell panel"><div className="calendar-controls"><button className="today-button">Today</button><button><ArrowLeft size={15} /></button><button><ArrowRight size={15} /></button><strong>August 10–16</strong><span /><button>Week <ChevronDown size={13} /></button></div><div className="week-grid"><div className="time-column header" />{days.map((day) => <div className={cn("day-header", day.includes("13") && "today")} key={day}>{day.split(" ")[0]}<strong>{day.split(" ")[1]}</strong></div>)}{["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM"].map((time) => <div className="calendar-row" key={time}><div className="time-label">{time}</div>{days.map((day) => <div className="calendar-cell" key={day + time}>{day.includes("13") && time === "10 AM" && <button className="calendar-event purple" onClick={onSession}><strong>Maya Chen</strong><span>Career clarity · Meet</span></button>}{day.includes("13") && time === "2 PM" && <button className="calendar-event green" onClick={onSession}><strong>Eli Rivera</strong><span>2:30 PM · Meet</span></button>}{day.includes("14") && time === "11 AM" && <button className="calendar-event peach" onClick={onSession}><strong>Jonah Brooks</strong><span>Leadership reset</span></button>}{day.includes("11") && time === "4 PM" && <button className="calendar-event blue"><strong>Ava Thompson</strong><span>Teen coaching</span></button>}</div>)}</div>)}</div></div></div>;
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
          {(view === "sign_in" || view === "sign_up") && <div className="oauth-options"><button type="button" onClick={() => void startOAuth("google")} disabled={submitting || oauthProvider !== null}><span className="oauth-google-mark">G</span>{oauthProvider === "google" ? "Opening Google…" : "Continue with Google"}</button><button type="button" onClick={() => void startOAuth("apple")} disabled={submitting || oauthProvider !== null}><Apple size={16} fill="currentColor" />{oauthProvider === "apple" ? "Opening Apple…" : "Continue with Apple"}</button></div>}
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

function QuickAdd({ onClose, onToast }: { onClose: () => void; onToast: (message: string) => void }) {
  const actions = [{ icon: UserRound, title: "Add client", copy: "Start a new client record" }, { icon: CalendarDays, title: "Schedule session", copy: "Book or block time" }, { icon: NotebookPen, title: "Session note", copy: "Write a private note" }, { icon: ListChecks, title: "Assignment", copy: "Send a task or reflection" }, { icon: FileText, title: "Upload resource", copy: "Add to your library" }, { icon: Send, title: "Send message", copy: "Reach out to a client" }];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="quick-add-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">CREATE</p><h2>What would you like to add?</h2></div><button onClick={onClose}><X size={18} /></button></div><div className="quick-action-grid">{actions.map(({ icon: Icon, title, copy }) => <button key={title} onClick={() => onToast(`${title} flow opened`)}><span><Icon size={18} /></span><p><strong>{title}</strong><small>{copy}</small></p><ChevronRight size={14} /></button>)}</div></div></div>;
}

function SessionPanel({ client, onClose, onSaved }: { client: Client; onClose: () => void; onSaved: (body: string, visibility: Visibility) => Promise<void> }) {
  const [visibility, setVisibility] = useState<Visibility>("Coach only");
  const [aiSummary, setAiSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const finish = async () => {
    setSaving(true);
    try {
      await onSaved(notes, visibility);
    } finally {
      setSaving(false);
    }
  };
  return <div className="drawer-backdrop"><button className="drawer-scrim" onClick={onClose} aria-label="Close session panel" /><aside className="session-drawer"><header><div><p className="eyebrow">SESSION WORKSPACE</p><h2>{client.name}</h2><span>Today · 50 minutes</span></div><button onClick={onClose}><X size={19} /></button></header><div className="session-context"><p><span>Previous session</span><strong>Waiting for certainty vs. learning through small experiments</strong></p><button><ChevronRight size={14} /></button></div><div className="session-form"><label>Attendance<div className="attendance-options"><button className="active"><CheckCircle2 size={14} />Attended</button><button>Late cancel</button><button>No show</button></div></label><label>Session notes<span className="field-hint">Your words stay yours.</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Capture themes, observations, and next steps…" autoFocus /></label><div className="visibility-picker"><div><strong>Who can see this note?</strong><span>The coach always controls sharing.</span></div><div className="visibility-options">{(["Coach only", "Coach + Client", ...(client.type === "Teen" ? ["Coach + Parent", "Everyone"] : [])] as Visibility[]).map((item) => <button key={item} className={cn(visibility === item && "active")} onClick={() => setVisibility(item)}><LockKeyhole size={12} />{item}{visibility === item && <Check size={12} />}</button>)}</div></div><div className="ai-summary-box"><div className="ai-summary-top"><span><Mic2 size={16} /></span><div><strong>AI meeting summary</strong><p>Optional transcription and summary of this session only. Soli never gives coaching advice.</p></div><button className={cn("toggle", aiSummary && "on")} onClick={() => setAiSummary(!aiSummary)}><i /></button></div>{aiSummary && <div className="ai-consent"><ShieldCheck size={13} /><span>Client consent is required before recording. Audio is never used to train models.</span></div>}</div><div className="session-next-step"><label>Next session</label><button><CalendarDays size={14} />Thursday, Aug 20 at 10:00 AM<ChevronDown size={13} /></button></div></div><footer><span><LockKeyhole size={12} />Draft saved privately</span><div><Button variant="outline" onClick={onClose}>Save draft</Button><Button variant="accent" onClick={() => void finish()} disabled={!notes.trim() || saving}>{saving ? "Saving…" : "Finish session"}</Button></div></footer></aside></div>;
}
