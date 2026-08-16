"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Camera,
  CalendarDays,
  CalendarPlus2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleCheckBig,
  Clock3,
  Command,
  Copy,
  FileCheck2,
  FileDown,
  FileText,
  FileUp,
  FolderOpen,
  Grid2X2,
  HardDrive,
  Home,
  KeyRound,
  Link2,
  List,
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
  Search,
  Send,
  Settings,
  ShieldCheck,
  Target,
  TextCursorInput,
  TriangleAlert,
  UserRound,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookingsView } from "@/components/bookings-view";
import {
  assignments,
  clients,
  type Assignment,
  type Client,
  type PracticeSession,
  type PortalInvitation,
  type Resource,
  type SharedNote,
  type Visibility,
} from "@/lib/data";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";
import {
  usePracticeData,
  type IntegrationConnection,
  type PortalInvitationPreview,
} from "@/lib/supabase/practice-data";

type PracticeHook = ReturnType<typeof usePracticeData>;

type View =
  | "Dashboard"
  | "Clients"
  | "Calendar"
  | "Bookings"
  | "Resources"
  | "Settings";
type ClientTab = "Overview" | "Sessions" | "Notes" | "Assignments" | "Files";

const navItems: { label: View; icon: typeof Home }[] = [
  { label: "Dashboard", icon: Home },
  { label: "Clients", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "Bookings", icon: CalendarPlus2 },
  { label: "Resources", icon: FolderOpen },
];

const visibilityTone: Record<
  Visibility,
  "dark" | "purple" | "blue" | "success"
> = {
  "Coach only": "dark",
  "Coach + Client": "purple",
  "Coach + Parent": "blue",
  Everyone: "success",
};

const TimeZoneContext = createContext("America/Los_Angeles");

// Reads the practice's organization timezone, provided once at the root by
// CoachApp so formatPracticeTime/Date callers don't each need it as a prop.
function usePracticeTimeZone() {
  return useContext(TimeZoneContext);
}

function formatPracticeTime(value: string, timeZone: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatPracticeDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
) {
  return new Date(value).toLocaleDateString("en-US", {
    ...options,
    timeZone,
  });
}

function Avatar({
  initials,
  color,
  imageUrl,
  size = "md",
}: {
  initials: string;
  color?: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external/user-uploaded URL, not a static asset
      <img
        src={imageUrl}
        alt=""
        className={cn("avatar", "avatar-photo", `avatar-${size}`)}
      />
    );
  }
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
      <span className="brand-mark">
        <span />
      </span>
      <span>Soli</span>
    </div>
  );
}

export function CoachApp() {
  const practice = usePracticeData();
  const timeZone = practice.organizationTimezone || "America/Los_Angeles";
  const practiceClients = practice.clients;
  const practiceAssignments = practice.assignments;
  const practiceResources = practice.resources;
  const [view, setView] = useState<View>("Dashboard");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientTab, setClientTab] = useState<ClientTab>("Overview");
  const [search, setSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [sessionContext, setSessionContext] = useState<{
    client: Client;
    sessionId: string | null;
  } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleClientId, setScheduleClientId] = useState<string | null>(null);
  const [assignmentClient, setAssignmentClient] = useState<Client | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<Assignment | null>(
    null,
  );
  const [sharingClient, setSharingClient] = useState<Client | null>(null);
  const [portalAccessClient, setPortalAccessClient] = useState<Client | null>(
    null,
  );
  const [portalClient, setPortalClient] = useState<Client | null>(null);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [doneAssignments, setDoneAssignments] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<"All" | "Adult" | "Teen">(
    "All",
  );

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
        setPortalAccessClient(null);
        setPortalClient(null);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const integration = url.searchParams.get("integration");
    const status = url.searchParams.get("integration_status");
    if (!integration || !status) return;
    const providerName = integration === "zoom" ? "Zoom" : "Google Workspace";
    const message =
      status === "connected"
        ? `${providerName} connected successfully`
        : status === "setup_required"
          ? `${providerName} needs app credentials before coaches can connect`
          : status === "cancelled"
            ? `${providerName} connection cancelled`
            : `Could not connect ${providerName}`;
    window.setTimeout(() => {
      setSelectedClient(null);
      setView("Settings");
      toast(message);
    }, 0);
    url.searchParams.delete("integration");
    url.searchParams.delete("integration_status");
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  if (practice.connectionState === "loading") {
    return (
      <main className="auth-shell">
        <div className="auth-ambient auth-ambient-one" />
        <div className="auth-ambient auth-ambient-two" />
        <section className="auth-card auth-loading-card">
          <header className="auth-brand">
            <AppLogo />
            <span>
              <ShieldCheck size={12} /> Secure workspace
            </span>
          </header>
          <div className="auth-loading">
            <span className="auth-spinner" />
            <h1>Securing your workspace…</h1>
            <p>Confirming your account and role permissions.</p>
          </div>
        </section>
      </main>
    );
  }

  if (
    practice.connectionState !== "unconfigured" &&
    (practice.connectionState !== "connected" || practice.needsPasswordUpdate)
  ) {
    return (
      <AuthScreen
        key={`${practice.needsPasswordUpdate}-${practice.invitationPreview?.invitationId || "standard"}`}
        error={practice.error}
        needsPasswordUpdate={practice.needsPasswordUpdate}
        onSignIn={practice.signIn}
        onOAuth={practice.signInWithOAuth}
        onSignUp={practice.signUp}
        onReset={practice.requestPasswordReset}
        onUpdatePassword={practice.updatePassword}
        invitation={practice.invitationPreview}
        invitationError={practice.invitationError}
      />
    );
  }

  if (
    practice.connectionState === "connected" &&
    practice.accountRole === "unlinked"
  ) {
    return (
      <InviteAcceptanceScreen
        invitation={practice.invitationPreview}
        error={practice.invitationError}
        onAccept={practice.acceptPortalInvitation}
        onSignOut={practice.signOut}
      />
    );
  }

  if (
    practice.connectionState === "connected" &&
    practice.accountRole !== "coach"
  ) {
    return (
      <TimeZoneContext.Provider value={timeZone}>
        <PortalApp practice={practice} />
      </TimeZoneContext.Provider>
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

  const currentSelectedClient = selectedClient
    ? practiceClients.find((client) => client.id === selectedClient.id) ||
      selectedClient
    : null;

  const startSession = (client?: Client, sessionId: string | null = null) =>
    setSessionContext({
      client:
        client || currentSelectedClient || practiceClients[0] || clients[0],
      sessionId,
    });
  const openSchedule = (client?: Client) => {
    setScheduleClientId(client?.id || null);
    setScheduleOpen(true);
  };

  return (
    <TimeZoneContext.Provider value={timeZone}>
    <div className="app-shell">
      <aside className={cn("sidebar", mobileMenuOpen && "sidebar-mobile-open")}>
        <div className="sidebar-top">
          <AppLogo />
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <button
          className="workspace-switcher"
          onClick={() => setDataPanelOpen(true)}
        >
          <Avatar
            initials={(practice.userName || "Alex Morgan")
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
            imageUrl={practice.userAvatarUrl}
            color="#f1c8ab"
            size="sm"
          />
          <span>
            <strong>{practice.userName || "Alex Morgan"}</strong>
            <small>
              {practice.mode === "supabase"
                ? "Soli Coaching"
                : "Personal practice"}
            </small>
          </span>
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
        <div className="sidebar-footer">
          <button onClick={() => toast("No new notifications")}>
            <Bell size={17} />
            <span>Notifications</span>
            <i />
          </button>
          <button
            className={cn(view === "Settings" && !selectedClient && "active")}
            onClick={() => navigate("Settings")}
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>
          <button
            className={cn(
              "security-note",
              "data-status",
              `data-${practice.connectionState}`,
            )}
            onClick={() => setDataPanelOpen(true)}
            title={practice.error || undefined}
          >
            <ShieldCheck size={13} />
            <span>
              {practice.connectionState === "connected"
                ? "Supabase connected"
                : "Demo data · Supabase ready"}
            </span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <span className="breadcrumb">
              {selectedClient ? (
                <>
                  <button onClick={() => setSelectedClient(null)}>
                    Clients
                  </button>
                  <ChevronRight size={13} />
                  <strong>{selectedClient.name}</strong>
                </>
              ) : (
                <strong>{view}</strong>
              )}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="search-button"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={15} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus size={15} />
              Quick add
            </Button>
            <button
              className="top-avatar"
              onClick={() => setDataPanelOpen(true)}
              aria-label="Open account settings"
            >
              <Avatar
                initials={(practice.userName || "Alex Morgan")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
                imageUrl={practice.userAvatarUrl}
                color="#f1c8ab"
                size="sm"
              />
            </button>
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
              onSession={(sessionId) =>
                startSession(currentSelectedClient, sessionId)
              }
              onSchedule={() => openSchedule(currentSelectedClient)}
              onAssign={() => setAssignmentClient(currentSelectedClient)}
              onSharing={() => setSharingClient(currentSelectedClient)}
              onPortal={() => setPortalClient(currentSelectedClient)}
              onAccess={() => setPortalAccessClient(currentSelectedClient)}
              onOpenAssignment={setAssignmentDetail}
              onToast={toast}
            />
          ) : view === "Dashboard" ? (
            <Dashboard
              clientData={practiceClients}
              assignmentData={practiceAssignments}
              sessionData={practice.sessions}
              notesData={practice.notes}
              userName={practice.userName}
              onClient={openClient}
              onNavigate={navigate}
              onSession={() => startSession()}
              doneAssignments={doneAssignments}
              onToggleAssignment={(id) =>
                setDoneAssignments((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                )
              }
              onToast={toast}
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
            <CalendarView
              clientData={practiceClients}
              sessionData={practice.sessions}
              onSchedule={() => openSchedule()}
              onSession={(client, sessionId) => startSession(client, sessionId)}
              onToast={toast}
            />
          ) : view === "Resources" ? (
            <ResourcesView
              resourcesData={practiceResources}
              clients={practiceClients}
              onUpload={practice.uploadResource}
              onOpen={async (resource) => {
                const url = await practice.getResourceUrl(resource);
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              onAssign={practice.assignResourceAsHomework}
              onToast={toast}
            />
          ) : view === "Bookings" ? (
            <BookingsView
              userName={practice.userName || "Your practice"}
              organizationSlug={practice.organizationSlug}
              organizationTimezone={practice.organizationTimezone}
              bookingPages={practice.bookingPages}
              requests={practice.bookingRequests}
              onSave={practice.saveBookingPage}
              onDelete={practice.deleteBookingPage}
              onCancelRequest={practice.cancelBookingRequest}
              onToast={toast}
            />
          ) : (
            <SettingsView
              organizationName={practice.organizationName}
              organizationSlug={practice.organizationSlug}
              organizationTimezone={practice.organizationTimezone}
              onUpdateName={practice.updateOrganizationName}
              onUpdateSlug={practice.updatePracticeSlug}
              onUpdateTimezone={practice.updateOrganizationTimezone}
              userName={practice.userName}
              userEmail={practice.userEmail}
              userPhone={practice.userPhone}
              userAvatarUrl={practice.userAvatarUrl}
              onUpdateProfile={practice.updateProfile}
              onUpdatePassword={practice.updatePassword}
              onUploadAvatar={practice.uploadAvatar}
              integrations={practice.integrations}
              onConnect={practice.connectIntegration}
              onUpdate={practice.updateIntegrationPreferences}
              onDisconnect={practice.disconnectIntegration}
              onToast={toast}
            />
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={cn(view === label && "active")}
            onClick={() => navigate(label)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <button onClick={() => setMobileMenuOpen(true)}>
          <Menu size={18} />
          <span>More</span>
        </button>
      </nav>

      {commandOpen && (
        <CommandPalette
          clientData={practiceClients}
          onClose={() => setCommandOpen(false)}
          onNavigate={navigate}
          onClient={openClient}
        />
      )}
      {quickAddOpen && (
        <QuickAdd
          onClose={() => setQuickAddOpen(false)}
          onSchedule={() => {
            setQuickAddOpen(false);
            openSchedule();
          }}
          onAssignment={() => {
            setQuickAddOpen(false);
            setAssignmentClient(
              currentSelectedClient || practiceClients[0] || null,
            );
          }}
          onSession={() => {
            setQuickAddOpen(false);
            startSession();
          }}
          onToast={(message) => {
            setQuickAddOpen(false);
            toast(message);
          }}
        />
      )}
      {dataPanelOpen && (
        <AccountModal
          email={practice.userEmail}
          error={practice.error}
          onClose={() => setDataPanelOpen(false)}
          onSignOut={practice.signOut}
        />
      )}
      {sessionContext && (
        <SessionPanel
          client={sessionContext.client}
          sessionId={sessionContext.sessionId}
          onClose={() => setSessionContext(null)}
          onComplete={async (input) => {
            await practice.completeSession(input);
            setSessionContext(null);
            toast("Session completed and follow-up saved");
          }}
        />
      )}
      {scheduleOpen && (
        <ScheduleSessionModal
          clients={practiceClients}
          initialClientId={scheduleClientId}
          onClose={() => setScheduleOpen(false)}
          onSave={async (input) => {
            await practice.createSession(input);
            setScheduleOpen(false);
            toast("Session scheduled");
          }}
        />
      )}
      {assignmentClient && (
        <AssignmentComposer
          client={assignmentClient}
          onClose={() => setAssignmentClient(null)}
          onSave={async (input) => {
            await practice.createAssignment({
              clientId: assignmentClient.id,
              ...input,
            });
            setAssignmentClient(null);
            toast("Assignment published to the client portal");
          }}
        />
      )}
      {assignmentDetail && (
        <AssignmentDetail
          assignment={assignmentDetail}
          onClose={() => setAssignmentDetail(null)}
          onSubmit={async (responseText, completed) => {
            await practice.submitAssignmentResponse(
              assignmentDetail,
              responseText,
              completed,
            );
            setAssignmentDetail(null);
            toast("Client response saved");
          }}
          onReview={async () => {
            await practice.reviewAssignment(assignmentDetail.id);
            setAssignmentDetail(null);
            toast("Assignment marked reviewed");
          }}
          onOpenFile={async (storagePath) => {
            const url = await practice.getAssignmentFileUrl(storagePath);
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        />
      )}
      {sharingClient && (
        <GuardianSharingModal
          client={sharingClient}
          onClose={() => setSharingClient(null)}
          onChange={async (guardianId, enabled) => {
            await practice.updateGuardianAssignmentSharing(guardianId, enabled);
            toast(
              enabled
                ? "Automatic logistics sharing enabled"
                : "Automatic sharing turned off",
            );
          }}
        />
      )}
      {portalAccessClient && (
        <PortalAccessModal
          client={portalAccessClient}
          invitations={practice.invitations.filter(
            (invitation) => invitation.clientId === portalAccessClient.id,
          )}
          onClose={() => setPortalAccessClient(null)}
          onCreate={practice.createPortalInvitation}
        />
      )}
      {portalClient && (
        <ClientPortalPreview
          client={portalClient}
          assignments={practiceAssignments.filter(
            (assignment) => assignment.clientId === portalClient.id,
          )}
          onClose={() => setPortalClient(null)}
          onOpenAssignment={(assignment) => {
            setPortalClient(null);
            setAssignmentDetail(assignment);
          }}
          onSchedule={() => {
            setPortalClient(null);
            openSchedule(portalClient);
          }}
        />
      )}
    </div>
    </TimeZoneContext.Provider>
  );
}

function Dashboard({
  clientData,
  assignmentData,
  sessionData,
  notesData,
  userName,
  onClient,
  onNavigate,
  onSession,
  doneAssignments,
  onToggleAssignment,
  onToast,
}: {
  clientData: Client[];
  assignmentData: typeof assignments;
  sessionData: PracticeSession[];
  notesData: SharedNote[];
  userName?: string | null;
  onClient: (client: Client) => void;
  onNavigate: (view: View) => void;
  onSession: () => void;
  doneAssignments: string[];
  onToggleAssignment: (id: string) => void;
  onToast: (message: string) => void;
}) {
  const timeZone = usePracticeTimeZone();
  const now = new Date();
  const firstName = userName?.split(" ")[0] || "there";
  const todayLabel = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
  const greetingHour = now.getHours();
  const timeOfDay =
    greetingHour < 12 ? "morning" : greetingHour < 18 ? "afternoon" : "evening";

  const todaysSessions = useMemo(
    () =>
      sessionData
        .filter(
          (session) =>
            new Date(session.startsAt).toDateString() === now.toDateString(),
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
    [sessionData],
  );
  const nextSession = todaysSessions.find(
    (session) => new Date(session.startsAt).getTime() > now.getTime(),
  );
  const submittedAssignments = assignmentData.filter(
    (assignment) => assignment.status === "Submitted",
  );
  const dueTodayAssignments = assignmentData.filter(
    (assignment) => assignment.due === "Today",
  );
  const needsAttentionAssignments = assignmentData.filter(
    (assignment) =>
      assignment.status === "Submitted" || assignment.status === "Overdue",
  );
  const activeClients = clientData.filter(
    (client) => client.status === "Active",
  );
  const dayProgress = Math.min(
    100,
    Math.max(0, ((now.getHours() + now.getMinutes() / 60 - 9) / 8) * 100),
  );
  const attentionItems = useMemo(() => {
    const items: {
      key: string;
      icon: "rose" | "amber" | "blue";
      title: string;
      description: string;
      client: Client;
      badge?: string;
    }[] = [];
    const paymentDue = clientData.find((client) => client.payment !== "Paid");
    if (paymentDue) {
      items.push({
        key: `payment-${paymentDue.id}`,
        icon: "rose",
        title:
          paymentDue.payment === "Past due" ? "Payment past due" : "Invoice due soon",
        description: `${paymentDue.name.split(" ")[0]}'s payment needs review`,
        client: paymentDue,
        badge: "Review",
      });
    }
    const overdue = assignmentData.find(
      (assignment) => assignment.status === "Overdue",
    );
    if (overdue) {
      const client = clientData.find((item) => item.name === overdue.client);
      if (client) {
        items.push({
          key: `overdue-${overdue.id}`,
          icon: "amber",
          title: "Homework overdue",
          description: `${overdue.title} · ${client.name.split(" ")[0]}`,
          client,
        });
      }
    }
    const submitted = assignmentData.find(
      (assignment) => assignment.status === "Submitted",
    );
    if (submitted) {
      const client = clientData.find((item) => item.name === submitted.client);
      if (client) {
        items.push({
          key: `submitted-${submitted.id}`,
          icon: "blue",
          title: `Review ${client.name.split(" ")[0]}'s homework`,
          description: submitted.title,
          client,
        });
      }
    }
    return items.slice(0, 3);
  }, [clientData, assignmentData]);
  const latestNote = [...notesData].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  const recentActivity = useMemo(() => {
    const noteEvents = notesData.map((note) => ({
      key: `note-${note.id}`,
      icon: "purple" as const,
      title: `${
        clientData.find((client) => client.id === note.clientId)?.name ||
        "A client"
      }'s ${note.type.toLowerCase()} was added`,
      detail: note.body.length > 60 ? `${note.body.slice(0, 60)}…` : note.body,
      at: note.createdAt,
    }));
    const sessionEvents = sessionData
      .filter(
        (session) =>
          session.status !== "scheduled" &&
          new Date(session.endsAt).getTime() <= now.getTime(),
      )
      .map((session) => ({
        key: `session-${session.id}`,
        icon: "blue" as const,
        title: `Session with ${session.client} · ${session.status.replace("_", " ")}`,
        detail: formatPracticeDate(
          session.startsAt,
          { month: "short", day: "numeric" },
          timeZone,
        ),
        at: session.endsAt,
      }));
    return [...noteEvents, ...sessionEvents]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);
  }, [notesData, sessionData, clientData, timeZone]);

  return (
    <div className="dashboard page-enter">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>
            Good {timeOfDay}, {firstName} <span>✦</span>
          </h1>
          <p>
            {todaysSessions.length === 0
              ? "You have a clear day ahead—plenty of space to catch up."
              : `You have ${todaysSessions.length} session${
                  todaysSessions.length === 1 ? "" : "s"
                } today${nextSession ? `, starting at ${formatPracticeTime(nextSession.startsAt, timeZone)}` : ""}.`}
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            onClick={() => onToast("Booking page copied to clipboard")}
          >
            <Copy size={14} />
            Booking link
          </Button>
          <Button onClick={() => onSession()}>
            <NotebookPen size={14} />
            New session note
          </Button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-icon purple">
            <CalendarDays size={17} />
          </span>
          <p>
            <strong>{todaysSessions.length}</strong>
            <span>Sessions today</span>
          </p>
          <small>
            {nextSession
              ? `Next at ${formatPracticeTime(nextSession.startsAt, timeZone)}`
              : "None remaining"}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-icon amber">
            <Clock3 size={17} />
          </span>
          <p>
            <strong>{submittedAssignments.length}</strong>
            <span>Follow-ups</span>
          </p>
          <small>{dueTodayAssignments.length} due today</small>
        </div>
        <div className="metric-card">
          <span className="metric-icon green">
            <ListChecks size={17} />
          </span>
          <p>
            <strong>{needsAttentionAssignments.length}</strong>
            <span>Homework items</span>
          </p>
          <small>
            {needsAttentionAssignments.length > 0
              ? "Need your attention"
              : "All caught up"}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-icon blue">
            <Users size={17} />
          </span>
          <p>
            <strong>{activeClients.length}</strong>
            <span>Active clients</span>
          </p>
          <small>{clientData.length} total</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel schedule-panel">
          <SectionTitle
            action={
              <button
                className="text-action"
                onClick={() => onNavigate("Calendar")}
              >
                View calendar <ArrowRight size={13} />
              </button>
            }
          >
            Today
          </SectionTitle>
          <div className="day-progress">
            <span>9 AM</span>
            <div>
              <i style={{ width: `${dayProgress}%` }} />
            </div>
            <span>5 PM</span>
          </div>
          <div className="session-list">
            {todaysSessions.length === 0 && (
              <p className="empty-hint">No sessions scheduled today.</p>
            )}
            {todaysSessions.map((session) => {
              const client = clientData.find(
                (item) => item.id === session.clientId,
              );
              const starts = new Date(session.startsAt);
              const minutes = Math.round(
                (new Date(session.endsAt).getTime() - starts.getTime()) /
                  60_000,
              );
              const isCurrent =
                starts.getTime() <= now.getTime() &&
                new Date(session.endsAt).getTime() > now.getTime();
              return (
                <button
                  className="session-row"
                  key={session.id}
                  onClick={() => (client ? onClient(client) : onSession())}
                >
                  <div className="session-time">
                    <strong>
                      {formatPracticeTime(session.startsAt, timeZone).split(" ")[0]}
                    </strong>
                    <span>
                      {formatPracticeTime(session.startsAt, timeZone).split(" ")[1]}
                    </span>
                  </div>
                  <div className={cn("timeline-pin", isCurrent && "current")}>
                    <i />
                  </div>
                  <Avatar
                    initials={client?.initials || "?"}
                    color={client?.color}
                    size="md"
                  />
                  <div className="session-info">
                    <strong>{session.client}</strong>
                    <span>
                      {client?.headline || "Coaching session"} · {minutes} min
                    </span>
                  </div>
                  {session.meetingProvider ? (
                    <span className="video-pill">
                      <Video size={12} />{" "}
                      {session.meetingProvider.charAt(0).toUpperCase() +
                        session.meetingProvider.slice(1)}
                    </span>
                  ) : (
                    <Badge>{session.status}</Badge>
                  )}
                  <ChevronRight size={15} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel focus-panel">
          <SectionTitle
            action={
              <button className="icon-button" aria-label="More options">
                <MoreHorizontal size={17} />
              </button>
            }
          >
            Needs attention
          </SectionTitle>
          <div className="attention-list">
            {attentionItems.length === 0 && (
              <p className="empty-hint">Nothing needs your attention right now.</p>
            )}
            {attentionItems.map((item) => (
              <button key={item.key} onClick={() => onClient(item.client)}>
                <span className={cn("attention-icon", item.icon)}>
                  {item.icon === "rose" ? (
                    <CircleDollarSign size={16} />
                  ) : item.icon === "amber" ? (
                    <FileCheck2 size={16} />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                </span>
                <p>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </p>
                {item.badge ? (
                  <Badge variant="rose">{item.badge}</Badge>
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            ))}
          </div>
          <div className="calm-callout">
            <span>✦</span>
            <p>
              {latestNote ? (
                <>
                  <strong>Latest note added {formatRelativeTime(latestNote.createdAt)}</strong>
                  <br />
                  {clientData.find((client) => client.id === latestNote.clientId)
                    ?.name || "A client"}{" "}
                  · {latestNote.type}
                </>
              ) : (
                <>
                  <strong>You’re all caught up on notes.</strong>
                  <br />
                  No session notes yet.
                </>
              )}
            </p>
          </div>
        </section>
      </div>

      <div className="dashboard-grid lower-grid">
        <section className="panel assignments-panel">
          <SectionTitle
            action={
              <button
                className="text-action"
                onClick={() => onNavigate("Clients")}
              >
                See all <ArrowRight size={13} />
              </button>
            }
          >
            Client homework
          </SectionTitle>
          <div className="assignment-list">
            {assignmentData.map((assignment) => {
              const client = clientData.find(
                (item) => item.name === assignment.client,
              );
              const done = doneAssignments.includes(assignment.id);
              if (!client) return null;
              return (
                <div
                  className={cn("assignment-row", done && "done")}
                  key={assignment.id}
                >
                  <button
                    className="check-button"
                    onClick={() => onToggleAssignment(assignment.id)}
                    aria-label={`Mark ${assignment.title} complete`}
                  >
                    {done && <Check size={12} />}
                  </button>
                  <Avatar
                    initials={client.initials}
                    color={client.color}
                    size="sm"
                  />
                  <button
                    className="assignment-copy"
                    onClick={() => onClient(client)}
                  >
                    <strong>{assignment.title}</strong>
                    <span>{assignment.client}</span>
                  </button>
                  {assignment.required && (
                    <Badge variant="warning">Required</Badge>
                  )}
                  <span
                    className={cn(
                      "due-date",
                      assignment.due === "Today" && "today",
                    )}
                  >
                    {assignment.due}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel activity-panel">
          <SectionTitle
            action={
              <button className="icon-button">
                <MoreHorizontal size={17} />
              </button>
            }
          >
            Recent activity
          </SectionTitle>
          <div className="activity-list">
            {recentActivity.length === 0 && (
              <p className="empty-hint">No recent activity yet.</p>
            )}
            {recentActivity.map((event) => (
              <div key={event.key}>
                <span className={cn("activity-dot", event.icon)}>
                  {event.icon === "purple" ? (
                    <PenLine size={11} />
                  ) : (
                    <CalendarDays size={11} />
                  )}
                </span>
                <p>
                  <strong>{event.title}</strong>
                  <span>{event.detail}</span>
                  <small>{formatRelativeTime(event.at)}</small>
                </p>
              </div>
            ))}
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
  const filtered = useMemo(
    () =>
      clientData.filter((client) => {
        const matchesSearch =
          client.name.toLowerCase().includes(search.toLowerCase()) ||
          client.email.toLowerCase().includes(search.toLowerCase());
        return matchesSearch && (filter === "All" || client.type === filter);
      }),
    [clientData, search, filter],
  );

  return (
    <div className="clients-page page-enter">
      <div className="page-heading compact-heading">
        <div>
          <h1>Clients</h1>
          <p>Every relationship, goal, and next step in one place.</p>
        </div>
        <Button variant="accent" onClick={onAdd}>
          <Plus size={15} />
          Add client
        </Button>
      </div>
      <div className="client-toolbar">
        <div className="filter-tabs">
          {(["All", "Adult", "Teen"] as const).map((item) => (
            <button
              key={item}
              className={cn(filter === item && "active")}
              onClick={() => setFilter(item)}
            >
              {item}
              {item === "All" && <span>{clientData.length}</span>}
            </button>
          ))}
        </div>
        <div className="inline-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search clients"
            aria-label="Search clients"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {filtered.length ? (
        <div className="client-table panel">
          <div className="client-table-head">
            <span>Client</span>
            <span>Next session</span>
            <span>Coach</span>
            <span>Package</span>
            <span>Payment</span>
            <span />
          </div>
          {filtered.map((client) => (
            <button
              className="client-table-row"
              key={client.id}
              onClick={() => onClient(client)}
            >
              <span className="client-cell">
                <Avatar initials={client.initials} color={client.color} />
                <span>
                  <strong>{client.name}</strong>
                  <small>
                    {client.type === "Teen"
                      ? `Teen · Age ${client.age}`
                      : client.email}
                  </small>
                </span>
                {client.type === "Teen" && (
                  <Badge variant="blue">
                    <ShieldCheck size={10} />
                    Minor
                  </Badge>
                )}
              </span>
              <span>
                <strong>{client.nextSession}</strong>
                <small>{client.nextSessionTime || "—"}</small>
              </span>
              <span>{client.coach}</span>
              <span>
                <strong>{client.package.split(" · ")[0]}</strong>
                <small>{client.cadence}</small>
              </span>
              <span>
                <Badge
                  variant={
                    client.payment === "Paid"
                      ? "success"
                      : client.payment === "Past due"
                        ? "rose"
                        : "warning"
                  }
                >
                  {client.payment}
                </Badge>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state panel">
          <span>
            <Search size={22} />
          </span>
          <h3>No clients found</h3>
          <p>Try a different name or client type.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setFilter("All");
            }}
          >
            Clear filters
          </Button>
        </div>
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
  onAccess,
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
  onAccess: () => void;
  onOpenAssignment: (assignment: Assignment) => void;
  onToast: (message: string) => void;
}) {
  const clientAssignments = assignmentData.filter(
    (assignment) => assignment.clientId === client.id,
  );
  const clientSessions = sessionData.filter(
    (session) => session.clientId === client.id,
  );
  const nextScheduledSessionId =
    [...clientSessions]
      .filter((session) => session.status === "scheduled")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.id || null;
  return (
    <div className="client-profile page-enter">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={14} />
        All clients
      </button>
      <div className="profile-hero">
        <div className="profile-identity">
          <Avatar initials={client.initials} color={client.color} size="xl" />
          <div>
            <div className="profile-name-row">
              <h1>{client.name}</h1>
              <Badge
                variant={client.status === "Active" ? "success" : "neutral"}
              >
                {client.status === "Paused" && <Pause size={9} />}
                {client.status}
              </Badge>
              {client.type === "Teen" && (
                <Badge variant="blue">
                  <ShieldCheck size={10} />
                  Minor · {client.age}
                </Badge>
              )}
            </div>
            <p>
              {client.pronouns} · {client.timezone} · Client since{" "}
              {client.joined}
            </p>
            <span>{client.headline}</span>
          </div>
        </div>
        <div className="profile-actions">
          <Button
            variant="outline"
            onClick={() => onToast(`Message draft opened for ${client.name}`)}
          >
            <MessageCircle size={14} />
            Message
          </Button>
          <Button variant="outline" onClick={onSchedule}>
            <CalendarDays size={14} />
            Schedule
          </Button>
          <Button onClick={() => onSession(nextScheduledSessionId)}>
            <NotebookPen size={14} />
            Start session
          </Button>
          <button className="icon-button bordered">
            <MoreHorizontal size={17} />
          </button>
        </div>
      </div>

      {client.type === "Teen" && (
        <div className="privacy-banner">
          <span className="privacy-shield">
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>Minor privacy controls are active</strong>
            <p>
              {client.name.split(" ")[0]}’s private coaching notes stay private.
              Guardians only see logistics and the specific updates you choose
              to share.
            </p>
          </div>
          <button onClick={onSharing}>
            Review access <ArrowRight size={13} />
          </button>
        </div>
      )}

      <div className="profile-tabs" role="tablist">
        {(
          [
            "Overview",
            "Sessions",
            "Notes",
            "Assignments",
            "Files",
          ] as ClientTab[]
        ).map((item) => (
          <button
            key={item}
            className={cn(tab === item && "active")}
            onClick={() => setTab(item)}
          >
            {item}
            {item === "Assignments" && <span>{clientAssignments.length}</span>}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="profile-grid">
          <div className="profile-main-column">
            <section className="panel next-session-card">
              <div className="date-tile">
                <strong>{client.nextSession === "Today" ? "13" : "14"}</strong>
                <span>AUG</span>
              </div>
              <div>
                <p className="card-kicker">NEXT SESSION</p>
                <h3>
                  {client.nextSession},{" "}
                  {client.nextSessionTime || "time not set"}
                </h3>
                <span>{client.cadence} · 50 min</span>
              </div>
              <span className="meet-badge">
                <Video size={13} />
                Zoom ready
              </span>
              <Button
                size="sm"
                onClick={() => onSession(nextScheduledSessionId)}
              >
                Start session
              </Button>
            </section>

            <section className="panel goals-card">
              <SectionTitle
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToast("Goal editor opened")}
                  >
                    <Plus size={13} />
                    Add goal
                  </Button>
                }
              >
                Goals
              </SectionTitle>
              <p className="section-subcopy">
                Visible to {client.name.split(" ")[0]} unless you change access.
              </p>
              <div className="goal-list">
                {client.goals.map((goal, index) => (
                  <div key={goal.title}>
                    <span className={cn("goal-number", index === 1 && "alt")}>
                      {index + 1}
                    </span>
                    <div>
                      <strong>{goal.title}</strong>
                      <span>
                        <i style={{ width: `${goal.progress}%` }} />
                      </span>
                      <small>{goal.progress}% progress</small>
                    </div>
                    <button className="icon-button">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel notes-card">
              <SectionTitle
                action={
                  <button
                    className="text-action"
                    onClick={() => setTab("Notes")}
                  >
                    All notes <ArrowRight size={13} />
                  </button>
                }
              >
                Recent notes
              </SectionTitle>
              <div className="note-item private">
                <div className="note-meta">
                  <VisibilityBadge visibility="Coach only" />
                  <span>Aug 6 · Session 7</span>
                </div>
                <p>
                  {client.name.split(" ")[0]} noticed a pattern of waiting for
                  certainty before taking small experiments. Explore what a
                  “safe enough” first step could look like next time.
                </p>
                <div className="note-footer">
                  <span>
                    <Paperclip size={12} />1 attachment
                  </span>
                  <span>Edited by Alex</span>
                </div>
              </div>
              <div className="note-item shared">
                <div className="note-meta">
                  <VisibilityBadge
                    visibility={
                      client.type === "Teen"
                        ? "Coach + Parent"
                        : "Coach + Client"
                    }
                  />
                  <span>Jul 30 · Progress update</span>
                </div>
                <p>
                  {client.type === "Teen"
                    ? "We’re focusing on consistent routines and practicing how to ask for support before stress builds up."
                    : "You’re making thoughtful progress on choosing experiments over pressure. Keep noticing where energy grows, not just where you perform well."}
                </p>
              </div>
            </section>

            <section className="panel client-assignments-card">
              <SectionTitle
                action={
                  <Button variant="ghost" size="sm" onClick={onAssign}>
                    <Plus size={13} />
                    Assign
                  </Button>
                }
              >
                Current assignments
              </SectionTitle>
              {clientAssignments.length ? (
                clientAssignments.map((item) => (
                  <button
                    className="profile-assignment"
                    key={item.id}
                    onClick={() => onOpenAssignment(item)}
                  >
                    <span className="assignment-type-icon">
                      {item.responseType === "text" ? (
                        <TextCursorInput size={16} />
                      ) : item.responseType === "file" ? (
                        <FileUp size={16} />
                      ) : (
                        <ListChecks size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        Due {item.due} ·{" "}
                        {item.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <Badge
                      variant={
                        item.status === "Overdue"
                          ? "rose"
                          : item.status === "Submitted"
                            ? "purple"
                            : item.status === "In progress"
                              ? "warning"
                              : "neutral"
                      }
                    >
                      {item.status}
                    </Badge>
                    <ChevronRight size={14} />
                  </button>
                ))
              ) : (
                <div className="mini-empty">No current assignments</div>
              )}
            </section>
          </div>

          <aside className="profile-side-column">
            {client.type === "Teen" && (
              <section className="panel people-card">
                <SectionTitle
                  action={
                    <button className="text-action" onClick={onAccess}>
                      Manage
                    </button>
                  }
                >
                  People & access
                </SectionTitle>
                <p className="section-subcopy">
                  You decide what each person can see.
                </p>
                <div className="people-list">
                  <div>
                    <Avatar
                      initials={client.initials}
                      color={client.color}
                      size="sm"
                    />
                    <p>
                      <strong>{client.name}</strong>
                      <span>Client</span>
                    </p>
                    <Badge variant="purple">Portal</Badge>
                  </div>
                  {client.guardians?.map((person) => (
                    <div key={person.name}>
                      <Avatar initials={person.initials} size="sm" />
                      <p>
                        <strong>{person.name}</strong>
                        <span>
                          {person.relation} · Assignment updates{" "}
                          {person.automaticAssignmentUpdates ? "on" : "off"}
                        </span>
                      </p>
                      <button onClick={onSharing}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                  {client.careTeam?.map((person) => (
                    <div key={person.name}>
                      <Avatar
                        initials={person.initials}
                        color="#dbe8f7"
                        size="sm"
                      />
                      <p>
                        <strong>{person.name}</strong>
                        <span>{person.role} · Selected updates</span>
                      </p>
                      <button
                        onClick={() =>
                          onToast(`${person.name}’s access opened`)
                        }
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="permission-note" onClick={onSharing}>
                  <LockKeyhole size={13} />
                  <span>
                    <strong>Private session notes</strong> are visible to you
                    only.
                  </span>
                  <ChevronRight size={13} />
                </button>
              </section>
            )}

            <section className="panel details-card">
              <SectionTitle
                action={
                  <button
                    className="icon-button"
                    onClick={() => onToast("Client details ready to edit")}
                  >
                    <PenLine size={14} />
                  </button>
                }
              >
                Details
              </SectionTitle>
              <dl>
                <div>
                  <dt>Email</dt>
                  <dd>{client.email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{client.phone}</dd>
                </div>
                <div>
                  <dt>Coach</dt>
                  <dd>{client.coach}</dd>
                </div>
                <div>
                  <dt>Cadence</dt>
                  <dd>{client.cadence}</dd>
                </div>
                <div>
                  <dt>Package</dt>
                  <dd>{client.package}</dd>
                </div>
              </dl>
            </section>

            <section className="panel billing-card">
              <SectionTitle
                action={
                  <button
                    className="text-action"
                    onClick={() => onToast("Billing history opened")}
                  >
                    View all
                  </button>
                }
              >
                Billing
              </SectionTitle>
              <div className="billing-status">
                <span
                  className={cn(
                    "payment-dot",
                    client.payment !== "Paid" && "warning",
                  )}
                >
                  <CircleDollarSign size={16} />
                </span>
                <p>
                  <strong>
                    {client.payment === "Paid" ? "All paid up" : client.payment}
                  </strong>
                  <span>
                    {client.payment === "Paid"
                      ? "Next invoice Sep 1 · $450"
                      : "Payment action needed"}
                  </span>
                </p>
              </div>
              <div className="package-progress">
                <div>
                  <span>Package sessions</span>
                  <strong>5 of 8 used</strong>
                </div>
                <span>
                  <i style={{ width: "62.5%" }} />
                </span>
              </div>
            </section>

            <section className="portal-preview">
              <div>
                <span>
                  <UserRound size={15} />
                </span>
                <p>
                  <strong>Client portal</strong>
                  <small>
                    {client.portalActive
                      ? "Access is active"
                      : "Invite client or guardians"}
                  </small>
                </p>
              </div>
              <div className="portal-preview-actions">
                <Button variant="outline" size="sm" onClick={onAccess}>
                  {client.portalActive ? "Manage" : "Invite"}
                </Button>
                <Button variant="ghost" size="sm" onClick={onPortal}>
                  Preview
                </Button>
              </div>
            </section>
          </aside>
        </div>
      ) : tab === "Sessions" ? (
        <ClientSessions
          client={client}
          sessionData={clientSessions}
          onSession={onSession}
          onSchedule={onSchedule}
        />
      ) : tab === "Notes" ? (
        <ClientNotes client={client} onToast={onToast} />
      ) : tab === "Assignments" ? (
        <ClientAssignments
          client={client}
          assignmentData={clientAssignments}
          onAssign={onAssign}
          onOpen={onOpenAssignment}
        />
      ) : (
        <ClientFiles client={client} onToast={onToast} />
      )}
    </div>
  );
}

function ClientSessions({
  client,
  sessionData,
  onSession,
  onSchedule,
}: {
  client: Client;
  sessionData: PracticeSession[];
  onSession: (sessionId: string | null) => void;
  onSchedule: () => void;
}) {
  const timeZone = usePracticeTimeZone();
  const ordered = [...sessionData].sort((a, b) =>
    b.startsAt.localeCompare(a.startsAt),
  );
  return (
    <div className="tab-content page-enter">
      <div className="tab-content-heading">
        <div>
          <h2>Sessions</h2>
          <p>
            Upcoming conversations and context from every session with{" "}
            {client.name.split(" ")[0]}.
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" onClick={onSchedule}>
            <CalendarDays size={14} />
            Schedule
          </Button>
          <Button onClick={() => onSession(null)}>
            <Plus size={14} />
            Start session
          </Button>
        </div>
      </div>
      <div className="timeline-list">
        {ordered.length ? (
          ordered.map((session, index) => {
            const date = new Date(session.startsAt);
            return (
              <button
                className="timeline-card panel"
                key={session.id}
                onClick={() => onSession(session.id)}
              >
                <div className="timeline-date">
                  <strong>
                    {formatPracticeDate(
                      session.startsAt,
                      { day: "numeric" },
                      timeZone,
                    )}
                  </strong>
                  <span>
                    {formatPracticeDate(
                      session.startsAt,
                      { month: "short" },
                      timeZone,
                    )}
                  </span>
                </div>
                <div>
                  <div className="timeline-card-title">
                    <strong>
                      {formatPracticeTime(session.startsAt, timeZone)}
                    </strong>
                    <Badge
                      variant={
                        session.status === "scheduled"
                          ? "blue"
                          : session.status === "attended"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {session.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p>
                    {session.status === "scheduled"
                      ? `${session.meetingProvider === "google_meet" ? "Google Meet" : session.meetingProvider === "zoom" ? "Zoom" : "Session"} is ready. Open the workspace to capture attendance, notes, and follow-up.`
                      : index === 0
                        ? "Session complete. Notes and client follow-up are kept together here."
                        : "Review the private record and shared follow-up from this session."}
                  </p>
                  <span>
                    <Clock3 size={13} />
                    {Math.round(
                      (new Date(session.endsAt).getTime() - date.getTime()) /
                        60_000,
                    )}{" "}
                    min <VisibilityBadge visibility="Coach only" />
                  </span>
                </div>
                <ChevronRight size={16} />
              </button>
            );
          })
        ) : (
          <div className="empty-state panel">
            <span>
              <CalendarDays size={22} />
            </span>
            <h3>No sessions yet</h3>
            <p>Schedule the first session or start a note now.</p>
            <Button onClick={onSchedule}>Schedule session</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientNotes({
  client,
  onToast,
}: {
  client: Client;
  onToast: (message: string) => void;
}) {
  return (
    <div className="tab-content page-enter">
      <div className="tab-content-heading">
        <div>
          <h2>Notes</h2>
          <p>
            Private thinking and intentional updates, with visibility attached
            to every note.
          </p>
        </div>
        <Button
          onClick={() => onToast("New note opened with Coach only visibility")}
        >
          <Plus size={14} />
          New note
        </Button>
      </div>
      <div className="privacy-legend">
        <strong>
          <LockKeyhole size={13} />
          Visibility guide
        </strong>
        {(
          [
            "Coach only",
            "Coach + Client",
            ...(client.type === "Teen" ? ["Coach + Parent", "Everyone"] : []),
          ] as Visibility[]
        ).map((item) => (
          <VisibilityBadge key={item} visibility={item} />
        ))}
      </div>
      <div className="notes-feed">
        {[0, 1, 2].map((item) => (
          <article className="panel feed-note" key={item}>
            <div>
              <VisibilityBadge
                visibility={
                  item === 0
                    ? "Coach only"
                    : item === 1 && client.type === "Teen"
                      ? "Coach + Parent"
                      : "Coach + Client"
                }
              />
              <span>
                {item === 0 ? "Aug 6" : item === 1 ? "Jul 30" : "Jul 23"}
              </span>
              <button>
                <MoreHorizontal size={15} />
              </button>
            </div>
            <h3>
              {item === 0
                ? "Post-session observations"
                : item === 1
                  ? "Progress update"
                  : "Shared session takeaway"}
            </h3>
            <p>
              {item === 0
                ? "There was a noticeable shift when we reframed the next decision as an experiment. Return to the language of curiosity next session."
                : item === 1 && client.type === "Teen"
                  ? "We’re focusing on building consistent routines and practicing how to ask for support early."
                  : "Keep noticing the difference between the path that looks impressive and the path that feels energizing."}
            </p>
            <small>Edited by Alex Morgan</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function ClientAssignments({
  client,
  assignmentData,
  onAssign,
  onOpen,
}: {
  client: Client;
  assignmentData: Assignment[];
  onAssign: () => void;
  onOpen: (assignment: Assignment) => void;
}) {
  const active = assignmentData.filter(
    (item) => item.status !== "Complete" && item.status !== "Reviewed",
  );
  const finished = assignmentData.filter(
    (item) => item.status === "Complete" || item.status === "Reviewed",
  );
  const row = (item: Assignment) => (
    <button
      className={cn(
        "board-assignment",
        (item.status === "Complete" || item.status === "Reviewed") &&
          "completed",
      )}
      key={item.id}
      onClick={() => onOpen(item)}
    >
      <span>
        {item.responseType === "text" ? (
          <TextCursorInput size={16} />
        ) : item.responseType === "file" ? (
          <FileUp size={16} />
        ) : item.status === "Complete" || item.status === "Reviewed" ? (
          <Check size={15} />
        ) : (
          <ListChecks size={16} />
        )}
      </span>
      <p>
        <strong>{item.title}</strong>
        <small>
          Due {item.due} · {item.required ? "Required" : "Optional"}
          {item.guardianLogisticsShared ? " · Guardian logistics shared" : ""}
        </small>
      </p>
      <VisibilityBadge visibility={item.visibility} />
      <Badge
        variant={
          item.status === "Overdue"
            ? "rose"
            : item.status === "Submitted"
              ? "purple"
              : item.status === "Reviewed"
                ? "success"
                : "warning"
        }
      >
        {item.status}
      </Badge>
      <ChevronRight size={14} />
    </button>
  );
  return (
    <div className="tab-content page-enter">
      <div className="tab-content-heading">
        <div>
          <h2>Assignments</h2>
          <p>
            Tasks and reflections with a clear response type, due date, and
            sharing boundary.
          </p>
        </div>
        <Button onClick={onAssign}>
          <Plus size={14} />
          New assignment
        </Button>
      </div>
      <div className="assignment-board">
        <section className="panel">
          <SectionTitle>Needs attention</SectionTitle>
          {active.length ? (
            active.map(row)
          ) : (
            <div className="mini-empty">
              Nothing outstanding for {client.name.split(" ")[0]}
            </div>
          )}
        </section>
        <section className="panel">
          <SectionTitle>Completed & reviewed</SectionTitle>
          {finished.length ? (
            finished.map(row)
          ) : (
            <div className="mini-empty">Completed work will appear here.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function ClientFiles({
  client,
  onToast,
}: {
  client: Client;
  onToast: (message: string) => void;
}) {
  return (
    <div className="tab-content page-enter">
      <div className="tab-content-heading">
        <div>
          <h2>Files & agreements</h2>
          <p>Securely stored resources, forms, and signed documents.</p>
        </div>
        <Button onClick={() => onToast("Secure upload opened")}>
          <Plus size={14} />
          Upload file
        </Button>
      </div>
      <div className="files-table panel">
        {[
          "Signed coaching agreement.pdf",
          "Client intake questionnaire.pdf",
          "Values worksheet.pdf",
        ].map((name, index) => (
          <button key={name}>
            <span className={cn("file-icon", index === 0 && "signed")}>
              <FileText size={17} />
            </span>
            <p>
              <strong>{name}</strong>
              <small>
                {index === 0
                  ? `${client.name} ${client.type === "Teen" ? "+ guardian" : ""} · Signed Aug 1`
                  : `${index + 2}.4 MB · Updated Jul ${28 - index}`}
              </small>
            </p>
            {index === 0 && (
              <Badge variant="success">
                <FileCheck2 size={10} />
                Documented
              </Badge>
            )}
            <VisibilityBadge
              visibility={
                index === 2
                  ? "Coach + Client"
                  : client.type === "Teen"
                    ? "Coach + Parent"
                    : "Coach only"
              }
            />
            <MoreHorizontal size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 18; // exclusive
const CALENDAR_ROW_HEIGHT = 55; // px, must match .time-label/.calendar-cell height
const CALENDAR_HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, index) => CALENDAR_START_HOUR + index,
);
const CALENDAR_EVENT_COLORS = ["purple", "blue", "green", "peach"] as const;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

/** Monday..Friday of the week `weekOffset` weeks from the current one. */
function weekdaysForOffset(weekOffset: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

function CalendarView({
  clientData,
  sessionData,
  onSchedule,
  onSession,
  onToast,
}: {
  clientData: Client[];
  sessionData: PracticeSession[];
  onSchedule: () => void;
  onSession: (client: Client, sessionId: string) => void;
  onToast: (message: string) => void;
}) {
  const timeZone = usePracticeTimeZone();
  const timeZoneLabel = timeZone.replaceAll("_", " ").split("/").at(-1);
  const visibleSessions = sessionData
    .filter((session) => session.status === "scheduled")
    .slice(0, 5);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDays = useMemo(() => weekdaysForOffset(weekOffset), [weekOffset]);
  const todayKey = dateKey(new Date());
  const weekLabel = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[4].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const eventsByCell = useMemo(() => {
    const map = new Map<string, PracticeSession[]>();
    const weekKeys = new Set(weekDays.map(dateKey));
    for (const session of sessionData) {
      if (session.status === "cancelled") continue;
      const start = new Date(session.startsAt);
      const key = dateKey(start);
      if (!weekKeys.has(key)) continue;
      const hour = start.getHours();
      if (hour < CALENDAR_START_HOUR || hour >= CALENDAR_END_HOUR) continue;
      const cellKey = `${key}-${hour}`;
      const existing = map.get(cellKey) || [];
      existing.push(session);
      map.set(cellKey, existing);
    }
    return map;
  }, [sessionData, weekDays]);

  return (
    <div className="calendar-page page-enter">
      <div className="page-heading compact-heading">
        <div>
          <h1>Calendar</h1>
          <p>Your coaching week · {timeZoneLabel} Time</p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            onClick={() => onToast("Availability editor opened")}
          >
            <Clock3 size={14} />
            Availability
          </Button>
          <Button
            variant="outline"
            onClick={() => onToast("Booking page copied")}
          >
            <Link2 size={14} />
            Booking page
          </Button>
          <Button variant="accent" onClick={onSchedule}>
            <Plus size={14} />
            New session
          </Button>
        </div>
      </div>
      <div className="calendar-status">
        <span>
          <i />
          Calendar connection ready
        </span>
        <span>
          <Video size={13} />
          Zoom is the primary meeting provider
        </span>
        <button onClick={() => onToast("Zoom connection settings opened")}>
          Manage
        </button>
      </div>
      <div className="calendar-agenda panel">
        <div className="calendar-controls">
          <button className="today-button">Today</button>
          <strong>Upcoming sessions</strong>
          <span />
        </div>
        {visibleSessions.length ? (
          visibleSessions.map((session) => {
            const client = clientData.find(
              (item) => item.id === session.clientId,
            );
            return (
              <button
                className="agenda-session"
                key={session.id}
                onClick={() => client && onSession(client, session.id)}
              >
                <div className="agenda-date">
                  <strong>
                    {formatPracticeDate(
                      session.startsAt,
                      { day: "numeric" },
                      timeZone,
                    )}
                  </strong>
                  <span>
                    {formatPracticeDate(
                      session.startsAt,
                      { month: "short" },
                      timeZone,
                    )}
                  </span>
                </div>
                {client && (
                  <Avatar
                    initials={client.initials}
                    color={client.color}
                    size="sm"
                  />
                )}
                <p>
                  <strong>{session.client}</strong>
                  <span>
                    {formatPracticeTime(session.startsAt, timeZone)} ·{" "}
                    {session.meetingProvider === "google_meet"
                      ? "Google Meet"
                      : session.meetingProvider === "zoom"
                        ? "Zoom"
                        : "Session"}
                  </span>
                </p>
                <Badge variant="success">Scheduled</Badge>
                <ChevronRight size={15} />
              </button>
            );
          })
        ) : (
          <div className="empty-state">
            <span>
              <CalendarDays size={22} />
            </span>
            <h3>Your week is open</h3>
            <p>Schedule a session from here or from any client profile.</p>
            <Button onClick={onSchedule}>Schedule session</Button>
          </div>
        )}
      </div>
      <div className="calendar-shell panel calendar-week-grid">
        <div className="calendar-controls">
          <button className="today-button" onClick={() => setWeekOffset(0)}>
            Today
          </button>
          <button
            aria-label="Previous week"
            onClick={() => setWeekOffset((current) => current - 1)}
          >
            <ChevronLeft size={13} />
          </button>
          <button
            aria-label="Next week"
            onClick={() => setWeekOffset((current) => current + 1)}
          >
            <ChevronRight size={13} />
          </button>
          <strong>{weekLabel}</strong>
          <span />
        </div>
        <div className="week-grid">
          <div className="time-column header" />
          {weekDays.map((day) => (
            <div
              className={cn(
                "day-header",
                dateKey(day) === todayKey && "today",
              )}
              key={dateKey(day)}
            >
              {day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              <strong>{day.getDate()}</strong>
            </div>
          ))}
          {CALENDAR_HOURS.map((hour) => (
            <div className="calendar-row" key={hour}>
              <div className="time-label">{hourLabel(hour)}</div>
              {weekDays.map((day) => {
                const cellSessions =
                  eventsByCell.get(`${dateKey(day)}-${hour}`) || [];
                return (
                  <div className="calendar-cell" key={dateKey(day)}>
                    {cellSessions.map((session, index) => {
                      const start = new Date(session.startsAt);
                      const end = new Date(session.endsAt);
                      const durationMinutes = Math.max(
                        15,
                        (end.getTime() - start.getTime()) / 60_000,
                      );
                      const top =
                        (start.getMinutes() / 60) * CALENDAR_ROW_HEIGHT + 3;
                      const height = Math.max(
                        26,
                        (durationMinutes / 60) * CALENDAR_ROW_HEIGHT - 6,
                      );
                      const client = clientData.find(
                        (item) => item.id === session.clientId,
                      );
                      const color =
                        session.status === "attended"
                          ? "green"
                          : session.status === "late_cancel" ||
                              session.status === "no_show"
                            ? "peach"
                            : CALENDAR_EVENT_COLORS[
                                index % CALENDAR_EVENT_COLORS.length
                              ];
                      return (
                        <button
                          type="button"
                          key={session.id}
                          className={cn("calendar-event", color)}
                          style={{ top, height }}
                          onClick={() => client && onSession(client, session.id)}
                        >
                          <strong>{session.client}</strong>
                          <span>
                            {formatPracticeTime(session.startsAt, timeZone)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourcesView({
  resourcesData,
  clients,
  onUpload,
  onOpen,
  onAssign,
  onToast,
}: {
  resourcesData: Resource[];
  clients: Client[];
  onUpload: (input: {
    file: File;
    title: string;
    description: string;
  }) => Promise<void>;
  onOpen: (resource: Resource) => Promise<void>;
  onAssign: (input: {
    resource: Resource;
    clientId: string;
    dueAt: string | null;
    required: boolean;
    responseType: "checkbox" | "file";
    instructions: string;
    guardianShare: "client_default" | "share" | "private";
  }) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [resourceSearch, setResourceSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "recent" | "assigned">("all");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [recentCutoff] = useState(() => Date.now() - 30 * 86_400_000);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [assigning, setAssigning] = useState<Resource | null>(null);
  const visible = resourcesData.filter(
    (item) =>
      item.title.toLowerCase().includes(resourceSearch.toLowerCase()) &&
      (filter !== "assigned" || item.assigned > 0) &&
      (filter !== "recent" ||
        new Date(item.createdAt).getTime() >= recentCutoff),
  );
  const usedBytes = resourcesData.reduce((sum, item) => sum + item.byteSize, 0);
  const openResource = async (resource: Resource) => {
    try {
      await onOpen(resource);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Resource unavailable");
    }
  };
  return (
    <div className="resources-page page-enter">
      <div className="page-heading compact-heading">
        <div>
          <h1>Resources</h1>
          <p>
            Your reusable library of tools, prompts, and learning materials.
          </p>
        </div>
        <Button variant="accent" onClick={() => setUploadOpen(true)}>
          <Plus size={15} />
          New
        </Button>
      </div>
      <div className="drive-shell panel">
        <aside className="drive-sidebar">
          <Button variant="accent" onClick={() => setUploadOpen(true)}>
            <Plus size={16} /> Upload resource
          </Button>
          <nav aria-label="Resource filters">
            <button
              className={cn(filter === "all" && "active")}
              onClick={() => setFilter("all")}
            >
              <FolderOpen size={16} /> My library
              <span>{resourcesData.length}</span>
            </button>
            <button
              className={cn(filter === "recent" && "active")}
              onClick={() => setFilter("recent")}
            >
              <Clock3 size={16} /> Recent
            </button>
            <button
              className={cn(filter === "assigned" && "active")}
              onClick={() => setFilter("assigned")}
            >
              <Users size={16} /> Assigned
            </button>
          </nav>
          <div className="drive-storage">
            <HardDrive size={16} />
            <div>
              <strong>Secure storage</strong>
              <span>{fileSizeLabel(usedBytes)} used</span>
              <i>
                <i
                  style={{
                    width: `${Math.min(100, (usedBytes / 1024 ** 3) * 100)}%`,
                  }}
                />
              </i>
              <small>10 MB maximum per file</small>
            </div>
          </div>
        </aside>
        <section className="drive-main">
          <header className="drive-toolbar">
            <div>
              <p className="eyebrow">RESOURCES /</p>
              <h2>
                {filter === "recent"
                  ? "Recent"
                  : filter === "assigned"
                    ? "Assigned"
                    : "My library"}
              </h2>
            </div>
            <div className="drive-actions">
              <label className="inline-search">
                <Search size={15} />
                <input
                  value={resourceSearch}
                  onChange={(event) => setResourceSearch(event.target.value)}
                  placeholder="Search resources"
                />
              </label>
              <div className="layout-toggle" aria-label="Resource layout">
                <button
                  aria-label="List view"
                  className={cn(layout === "list" && "active")}
                  onClick={() => setLayout("list")}
                >
                  <List size={15} />
                </button>
                <button
                  aria-label="Grid view"
                  className={cn(layout === "grid" && "active")}
                  onClick={() => setLayout("grid")}
                >
                  <Grid2X2 size={14} />
                </button>
              </div>
            </div>
          </header>
          {visible.length ? (
            layout === "list" ? (
              <div className="drive-table">
                <div className="drive-table-head">
                  <span>Name</span>
                  <span>Assigned</span>
                  <span>Modified</span>
                  <span>Size</span>
                  <span />
                </div>
                {visible.map((resource) => (
                  <div className="drive-row" key={resource.id}>
                    <button
                      className="drive-name"
                      onClick={() => void openResource(resource)}
                    >
                      <span className={cn("drive-file-icon", resource.color)}>
                        <FileText size={18} />
                      </span>
                      <span>
                        <strong>{resource.title}</strong>
                        <small>{resource.type}</small>
                      </span>
                    </button>
                    <span>{resource.assigned || "—"}</span>
                    <span>
                      {new Date(resource.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                    <span>{resource.size}</span>
                    <span className="drive-row-actions">
                      <button
                        onClick={() => setAssigning(resource)}
                        aria-label={`Assign ${resource.title}`}
                        title="Assign as homework"
                      >
                        <Send size={14} />
                      </button>
                      <button
                        onClick={() => void openResource(resource)}
                        aria-label={`Open ${resource.title}`}
                        title="Open file"
                      >
                        <FileDown size={14} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="drive-grid">
                {visible.map((resource) => (
                  <article className="drive-card" key={resource.id}>
                    <header>
                      <FileText size={16} />
                      <strong>{resource.title}</strong>
                      <button
                        onClick={() => setAssigning(resource)}
                        aria-label={`Assign ${resource.title}`}
                      >
                        <Send size={14} />
                      </button>
                    </header>
                    <button
                      className={cn("drive-preview", resource.color)}
                      onClick={() => void openResource(resource)}
                    >
                      <FileText size={32} strokeWidth={1.3} />
                      <span>{resource.type}</span>
                    </button>
                    <footer>
                      <span>{resource.size}</span>
                      <span>{resource.assigned} assigned</span>
                    </footer>
                  </article>
                ))}
              </div>
            )
          ) : (
            <div className="drive-empty">
              <span>
                <FolderOpen size={23} />
              </span>
              <h3>
                {resourceSearch
                  ? "No matching resources"
                  : "Your library is ready"}
              </h3>
              <p>
                {resourceSearch
                  ? "Try a different name or filter."
                  : "Upload a worksheet, guide, video, or link to get started."}
              </p>
              {!resourceSearch && (
                <Button variant="soft" onClick={() => setUploadOpen(true)}>
                  <FileUp size={14} /> Upload your first resource
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
      {uploadOpen && (
        <ResourceUploadModal
          onClose={() => setUploadOpen(false)}
          onSave={async (input) => {
            await onUpload(input);
            setUploadOpen(false);
            onToast("Resource uploaded securely");
          }}
        />
      )}
      {assigning && (
        <AssignResourceModal
          resource={assigning}
          clients={clients}
          onClose={() => setAssigning(null)}
          onSave={async (input) => {
            await onAssign({ resource: assigning, ...input });
            setAssigning(null);
            onToast("Resource assigned as homework");
          }}
        />
      )}
    </div>
  );
}

function fileSizeLabel(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ResourceUploadModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: {
    file: File;
    title: string;
    description: string;
  }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chooseFile = (selected: File | null) => {
    setError(null);
    if (selected && selected.size > 10 * 1024 * 1024) {
      setError("That file is over the 10 MB limit.");
      return;
    }
    setFile(selected);
    if (selected && !title) setTitle(selected.name.replace(/\.[^.]+$/, ""));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ file, title, description });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="workflow-modal resource-upload-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">SECURE LIBRARY</p>
            <h2>Upload a resource</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close upload">
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          Files stay private until you assign them to a client.
        </p>
        <label className={cn("resource-dropzone", file && "selected")}>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.mp4,.mp3,.txt,.doc,.docx,.xls,.xlsx"
            onChange={(event) => chooseFile(event.target.files?.[0] || null)}
          />
          <span>
            <FileUp size={22} />
          </span>
          <strong>{file ? file.name : "Choose a file"}</strong>
          <small>
            {file
              ? `${fileSizeLabel(file.size)} · Ready to upload`
              : "PDF, document, image, audio, or video · 10 MB max"}
          </small>
        </label>
        <div className="form-stack">
          <label>
            Resource name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label>
            Description <span className="optional">Optional</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="How might a client use this?"
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="accent"
            disabled={!file || !title.trim() || saving}
          >
            {saving ? "Uploading…" : "Upload resource"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AssignResourceModal({
  resource,
  clients,
  onClose,
  onSave,
}: {
  resource: Resource;
  clients: Client[];
  onClose: () => void;
  onSave: (input: {
    clientId: string;
    dueAt: string | null;
    required: boolean;
    responseType: "checkbox" | "file";
    instructions: string;
    guardianShare: "client_default" | "share" | "private";
  }) => Promise<void>;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const client = clients.find((item) => item.id === clientId);
  const [dueAt, setDueAt] = useState(localDateTime(72));
  const [required, setRequired] = useState(true);
  const [responseType, setResponseType] = useState<"checkbox" | "file">(
    "checkbox",
  );
  const [instructions, setInstructions] = useState("");
  const [guardianShare, setGuardianShare] = useState<
    "client_default" | "share" | "private"
  >(clients[0]?.type === "Teen" ? "client_default" : "private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        clientId,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        required,
        responseType,
        instructions,
        guardianShare,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assignment failed.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="workflow-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ASSIGN RESOURCE</p>
            <h2>{resource.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close assignment">
            <X size={18} />
          </button>
        </div>
        <div className="assigned-resource-chip">
          <FileText size={17} />
          <span>
            <strong>{resource.title}</strong>
            <small>
              {resource.type} · {resource.size}
            </small>
          </span>
        </div>
        <div className="form-stack">
          <label>
            Client
            <select
              value={clientId}
              onChange={(event) => {
                const nextId = event.target.value;
                setClientId(nextId);
                setGuardianShare(
                  clients.find((item) => item.id === nextId)?.type === "Teen"
                    ? "client_default"
                    : "private",
                );
              }}
            >
              {clients.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Instructions <span className="optional">Optional</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={`How should the client use ${resource.title}?`}
            />
          </label>
          <div className="response-choice compact">
            <button
              type="button"
              className={cn(responseType === "checkbox" && "active")}
              onClick={() => setResponseType("checkbox")}
            >
              <ListChecks size={17} />
              <span>
                <strong>Mark complete</strong>
                <small>Confirm they finished it</small>
              </span>
            </button>
            <button
              type="button"
              className={cn(responseType === "file" && "active")}
              onClick={() => setResponseType("file")}
            >
              <FileUp size={17} />
              <span>
                <strong>Upload a file</strong>
                <small>Submit completed work</small>
              </span>
            </button>
          </div>
          <label>
            Due date
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <label className="check-control">
            <Checkbox
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            Make this mandatory
          </label>
          {client?.type === "Teen" && (
            <GuardianShareSelect
              value={guardianShare}
              onChange={setGuardianShare}
            />
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={!clientId || saving}>
            {saving ? "Assigning…" : "Assign as homework"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type IntegrationAvailability = { google: boolean; zoom: boolean };
type SettingsTab = "general" | "profile" | "integrations";

function SettingsView({
  organizationName,
  organizationSlug,
  organizationTimezone,
  onUpdateName,
  onUpdateSlug,
  onUpdateTimezone,
  userName,
  userEmail,
  userPhone,
  userAvatarUrl,
  onUpdateProfile,
  onUpdatePassword,
  onUploadAvatar,
  integrations,
  onConnect,
  onUpdate,
  onDisconnect,
  onToast,
}: {
  organizationName: string | null;
  organizationSlug: string | null;
  organizationTimezone: string | null;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateSlug: (slug: string) => Promise<void>;
  onUpdateTimezone: (timezone: string) => Promise<void>;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userAvatarUrl: string | null;
  onUpdateProfile: (input: { fullName: string; phone: string }) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  integrations: IntegrationConnection[];
  onConnect: (provider: "google" | "zoom") => void;
  onUpdate: (input: {
    connectionId: string;
    syncEnabled: boolean;
    autoAddMeeting: boolean;
    defaultForScheduling: boolean;
  }) => Promise<void>;
  onDisconnect: (connectionId: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const connectedCount = integrations.filter(
    (item) => item.status !== "disconnected",
  ).length;

  return (
    <div className="integrations-page page-enter">
      <div className="page-heading compact-heading">
        <div>
          <h1>Settings</h1>
          <p>Your practice details and the tools that keep sessions moving.</p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as SettingsTab)}
      >
        <TabsList variant="line">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="integrations">
            Integrations
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-normal text-muted-foreground">
              {connectedCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-3.5">
          <GeneralSettings
            organizationName={organizationName}
            organizationSlug={organizationSlug}
            organizationTimezone={organizationTimezone}
            onUpdateName={onUpdateName}
            onUpdateSlug={onUpdateSlug}
            onUpdateTimezone={onUpdateTimezone}
            onToast={onToast}
          />
        </TabsContent>

        <TabsContent value="profile" className="mt-3.5">
          <ProfileSettings
            userName={userName}
            userEmail={userEmail}
            userPhone={userPhone}
            userAvatarUrl={userAvatarUrl}
            onUpdateProfile={onUpdateProfile}
            onUpdatePassword={onUpdatePassword}
            onUploadAvatar={onUploadAvatar}
            onToast={onToast}
          />
        </TabsContent>

        <TabsContent value="integrations" className="mt-3.5">
          <IntegrationsSettings
            integrations={integrations}
            onConnect={onConnect}
            onUpdate={onUpdate}
            onDisconnect={onDisconnect}
            onToast={onToast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54);
}

const FALLBACK_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

let cachedTimezones: string[] | null = null;
function allTimezones(): string[] {
  if (!cachedTimezones) {
    try {
      cachedTimezones = Intl.supportedValuesOf("timeZone");
    } catch {
      cachedTimezones = FALLBACK_TIMEZONES;
    }
  }
  return cachedTimezones;
}

const timezoneListSubscribe = () => () => {};
const timezoneServerSnapshot = () => FALLBACK_TIMEZONES;

// Intl.supportedValuesOf can return a different list (order/coverage) between
// the Node SSR runtime and the browser, so we render the fixed fallback list
// on the server and first client paint, then switch to the full list once
// mounted — same trick as useOrigin, to avoid a hydration mismatch.
function useTimezoneList(): string[] {
  return useSyncExternalStore(
    timezoneListSubscribe,
    allTimezones,
    timezoneServerSnapshot,
  );
}

function timezoneOptions(current: string, zones: string[]): string[] {
  return zones.includes(current) ? zones : [current, ...zones];
}

function GeneralSettings({
  organizationName,
  organizationSlug,
  organizationTimezone,
  onUpdateName,
  onUpdateSlug,
  onUpdateTimezone,
  onToast,
}: {
  organizationName: string | null;
  organizationSlug: string | null;
  organizationTimezone: string | null;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateSlug: (slug: string) => Promise<void>;
  onUpdateTimezone: (timezone: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const activeSlug = organizationSlug || "your-practice";
  const activeTimezone = organizationTimezone || "America/Los_Angeles";
  const [nameDraft, setNameDraft] = useState(organizationName || "");
  const [slugDraft, setSlugDraft] = useState(activeSlug);
  const [timezoneDraft, setTimezoneDraft] = useState(activeTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = useOrigin();
  const availableTimezones = useTimezoneList();
  const zones = useMemo(
    () => timezoneOptions(activeTimezone, availableTimezones),
    [activeTimezone, availableTimezones],
  );

  const dirty =
    nameDraft.trim() !== (organizationName || "") ||
    slugDraft !== activeSlug ||
    timezoneDraft !== activeTimezone;

  const cancel = () => {
    setNameDraft(organizationName || "");
    setSlugDraft(activeSlug);
    setTimezoneDraft(activeTimezone);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const cleanedSlug = sanitizeSlug(slugDraft);
      if (!cleanedSlug) throw new Error("Enter a practice URL.");
      if (nameDraft.trim() !== (organizationName || "")) {
        if (!nameDraft.trim()) throw new Error("Enter a practice name.");
        await onUpdateName(nameDraft.trim());
      }
      if (cleanedSlug !== activeSlug) await onUpdateSlug(cleanedSlug);
      if (timezoneDraft !== activeTimezone) {
        await onUpdateTimezone(timezoneDraft);
      }
      onToast("Practice details updated");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Those changes could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel booking-settings-card">
      <div className="booking-section-heading">
        <span>
          <Building2 size={16} />
        </span>
        <div>
          <h2>Practice details</h2>
          <p>Your practice name, booking link, and timezone.</p>
        </div>
      </div>
      <div className="booking-form-grid">
        <label className="booking-field-wide">
          Practice name
          <input
            value={nameDraft}
            placeholder="Your Coaching Practice"
            onChange={(event) => setNameDraft(event.target.value)}
          />
        </label>
        <label className="booking-field-wide">
          Practice URL
          <div className="slug-field">
            <span>{origin.replace(/^https?:\/\//, "")}/</span>
            <input
              value={slugDraft}
              onChange={(event) => setSlugDraft(sanitizeSlug(event.target.value))}
            />
          </div>
        </label>
        <label>
          Timezone
          <select
            value={timezoneDraft}
            onChange={(event) => setTimezoneDraft(event.target.value)}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <small className="field-hint">
            Booking availability windows are interpreted in this timezone.
          </small>
        </label>
      </div>
      {error ? (
        <div className="data-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="settings-field-actions">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(`${origin}/${activeSlug}`);
            onToast("Practice URL copied");
          }}
        >
          <Copy size={13} /> Copy URL
        </Button>
        {dirty ? (
          <>
            <Button variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ProfileSettings({
  userName,
  userEmail,
  userPhone,
  userAvatarUrl,
  onUpdateProfile,
  onUpdatePassword,
  onUploadAvatar,
  onToast,
}: {
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userAvatarUrl: string | null;
  onUpdateProfile: (input: { fullName: string; phone: string }) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(userName || "");
  const [phoneDraft, setPhoneDraft] = useState(userPhone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const dirty =
    nameDraft.trim() !== (userName || "") ||
    phoneDraft.trim() !== (userPhone || "");

  const save = async () => {
    if (!nameDraft.trim()) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdateProfile({
        fullName: nameDraft.trim(),
        phone: phoneDraft.trim(),
      });
      onToast("Profile updated");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      await onUploadAvatar(file);
      onToast("Photo updated");
    } catch (uploadError) {
      onToast(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload that photo.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <>
      <section className="panel booking-settings-card">
        <div className="booking-section-heading">
          <span>
            <UserRound size={16} />
          </span>
          <div>
            <h2>Your profile</h2>
            <p>How you appear to clients and teammates.</p>
          </div>
        </div>
        <div className="settings-avatar-row">
          <Avatar
            initials={(userName || "You")
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
            imageUrl={userAvatarUrl}
            color="#f1c8ab"
            size="xl"
          />
          <div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="settings-avatar-input"
              onChange={pickPhoto}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera size={13} />
              {uploadingAvatar ? "Uploading…" : "Upload photo"}
            </Button>
            <p className="field-hint">PNG, JPEG, or WEBP. Up to 5 MB.</p>
          </div>
        </div>
        <div className="booking-form-grid">
          <label className="booking-field-wide">
            Full name
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </label>
          <label>
            Email
            <input value={userEmail || ""} disabled />
            <small className="field-hint">Contact support to change your email.</small>
          </label>
          <label>
            Phone <small>Optional</small>
            <input
              type="tel"
              value={phoneDraft}
              onChange={(event) => setPhoneDraft(event.target.value)}
            />
          </label>
        </div>
        {error ? (
          <div className="data-error" role="alert">
            {error}
          </div>
        ) : null}
        {dirty ? (
          <div className="settings-field-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNameDraft(userName || "");
                setPhoneDraft(userPhone || "");
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </section>
      <PasswordCard onUpdatePassword={onUpdatePassword} onToast={onToast} />
    </>
  );
}

function PasswordCard({
  onUpdatePassword,
  onToast,
}: {
  onUpdatePassword: (password: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdatePassword(password);
      setPassword("");
      setConfirm("");
      onToast("Password updated");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your password could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel booking-settings-card">
      <div className="booking-section-heading">
        <span>
          <LockKeyhole size={16} />
        </span>
        <div>
          <h2>Password</h2>
          <p>Choose a new password for signing in.</p>
        </div>
      </div>
      <div className="booking-form-grid">
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
          />
        </label>
      </div>
      {error ? (
        <div className="data-error" role="alert">
          {error}
        </div>
      ) : null}
      {password || confirm ? (
        <div className="settings-field-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPassword("");
              setConfirm("");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function IntegrationsSettings({
  integrations,
  onConnect,
  onUpdate,
  onDisconnect,
  onToast,
}: {
  integrations: IntegrationConnection[];
  onConnect: (provider: "google" | "zoom") => void;
  onUpdate: (input: {
    connectionId: string;
    syncEnabled: boolean;
    autoAddMeeting: boolean;
    defaultForScheduling: boolean;
  }) => Promise<void>;
  onDisconnect: (connectionId: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [availability, setAvailability] =
    useState<IntegrationAvailability | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<IntegrationConnection | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/integrations/status")
      .then((response) => response.json() as Promise<IntegrationAvailability>)
      .then((result) => active && setAvailability(result))
      .catch(() => active && setAvailability({ google: false, zoom: false }));
    return () => {
      active = false;
    };
  }, []);
  const google = integrations.find(
    (item) => item.provider === "google" && item.status !== "disconnected",
  );
  const zoom = integrations.find(
    (item) => item.provider === "zoom" && item.status !== "disconnected",
  );
  return (
    <>
      <section className="integration-overview panel">
        <span className="integration-overview-icon">
          <Zap size={18} />
        </span>
        <div>
          <p className="eyebrow">SCHEDULING AUTOMATION</p>
          <h2>One booking, everything in sync</h2>
          <p>
            Soli can add sessions to your calendar, prevent double-booking, and
            attach the right meeting link automatically.
          </p>
        </div>
        <div className="integration-flow" aria-label="Integration workflow">
          <span>Client books</span>
          <ArrowRight size={12} />
          <span>Calendar syncs</span>
          <ArrowRight size={12} />
          <span>Meeting link added</span>
        </div>
      </section>

      <div className="integration-section-heading">
        <div>
          <h2>Calendar & video</h2>
          <p>Your essential scheduling connections.</p>
        </div>
      </div>
      <div className="integration-provider-grid">
        <IntegrationProviderCard
          key={`google-${google?.updatedAt || "none"}`}
          provider="google"
          connection={google}
          configured={availability?.google ?? null}
          onConnect={onConnect}
          onUpdate={onUpdate}
          onDisconnect={(connection) => setPendingDisconnect(connection)}
          onToast={onToast}
        />
        <IntegrationProviderCard
          key={`zoom-${zoom?.updatedAt || "none"}`}
          provider="zoom"
          connection={zoom}
          configured={availability?.zoom ?? null}
          onConnect={onConnect}
          onUpdate={onUpdate}
          onDisconnect={(connection) => setPendingDisconnect(connection)}
          onToast={onToast}
        />
      </div>

      <div className="integration-section-heading secondary">
        <div>
          <h2>More ways to connect</h2>
          <p>Planned for the next stages of the practice workflow.</p>
        </div>
      </div>
      <div className="integration-coming-grid">
        <ComingIntegration
          icon={<CircleDollarSign size={18} />}
          title="Stripe"
          copy="Packages, subscriptions, and invoices"
          tone="stripe"
        />
        <ComingIntegration
          icon={<CalendarDays size={18} />}
          title="Outlook Calendar"
          copy="Microsoft 365 calendar sync"
          tone="outlook"
        />
        <ComingIntegration
          icon={<MessageCircle size={18} />}
          title="Email & SMS"
          copy="Session reminders and follow-ups"
          tone="messages"
        />
      </div>

      <div className="integration-security-note">
        <ShieldCheck size={16} />
        <span>
          <strong>Private by design</strong>
          OAuth tokens are encrypted and never exposed in the coach or client
          interface. You can disconnect an account at any time.
        </span>
      </div>

      {pendingDisconnect && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPendingDisconnect(null)
          }
        >
          <div className="workflow-modal integration-disconnect-modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">DISCONNECT ACCOUNT</p>
                <h2>
                  Disconnect{" "}
                  {pendingDisconnect.provider === "google"
                    ? "Google Workspace"
                    : "Zoom"}
                  ?
                </h2>
              </div>
              <button
                onClick={() => setPendingDisconnect(null)}
                aria-label="Close disconnect confirmation"
              >
                <X size={18} />
              </button>
            </div>
            <p className="modal-copy">
              Existing sessions will remain in Soli, but new sessions will no
              longer sync or receive meeting links from this account.
            </p>
            <div className="modal-actions">
              <Button
                variant="outline"
                onClick={() => setPendingDisconnect(null)}
              >
                Keep connected
              </Button>
              <Button
                variant="default"
                disabled={disconnecting}
                onClick={async () => {
                  setDisconnecting(true);
                  try {
                    await onDisconnect(pendingDisconnect.id);
                    onToast("Integration disconnected");
                    setPendingDisconnect(null);
                  } catch (error) {
                    onToast(
                      error instanceof Error
                        ? error.message
                        : "Could not disconnect integration",
                    );
                  } finally {
                    setDisconnecting(false);
                  }
                }}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IntegrationProviderCard({
  provider,
  connection,
  configured,
  onConnect,
  onUpdate,
  onDisconnect,
  onToast,
}: {
  provider: "google" | "zoom";
  connection?: IntegrationConnection;
  configured: boolean | null;
  onConnect: (provider: "google" | "zoom") => void;
  onUpdate: (input: {
    connectionId: string;
    syncEnabled: boolean;
    autoAddMeeting: boolean;
    defaultForScheduling: boolean;
  }) => Promise<void>;
  onDisconnect: (connection: IntegrationConnection) => void;
  onToast: (message: string) => void;
}) {
  const connected = connection?.status === "connected";
  const [syncEnabled, setSyncEnabled] = useState(
    connection?.syncEnabled ?? true,
  );
  const [autoAddMeeting, setAutoAddMeeting] = useState(
    connection?.autoAddMeeting ?? true,
  );
  const [defaultForScheduling, setDefaultForScheduling] = useState(
    connection?.defaultForScheduling ?? provider === "zoom",
  );
  const [saving, setSaving] = useState(false);
  const isGoogle = provider === "google";
  const features = isGoogle
    ? [
        "Two-way calendar visibility",
        "Google Meet links",
        "Conflict protection",
      ]
    : [
        "Automatic Zoom links",
        "Personal Meeting ID support",
        "Session-ready invites",
      ];
  return (
    <article className={cn("integration-card panel", connected && "connected")}>
      <header>
        <div className={cn("integration-brand", provider)}>
          {isGoogle ? (
            <span className="google-g">G</span>
          ) : (
            <span className="zoom-wordmark">zoom</span>
          )}
        </div>
        <div className="integration-card-title">
          <div>
            <h3>{isGoogle ? "Google Workspace" : "Zoom"}</h3>
            <p>{isGoogle ? "Calendar + Google Meet" : "Video meetings"}</p>
          </div>
          {connected ? (
            <Badge variant="success">
              <CircleCheckBig size={11} /> Connected
            </Badge>
          ) : configured === false ? (
            <Badge variant="warning">
              <TriangleAlert size={11} /> Setup required
            </Badge>
          ) : (
            <Badge variant="neutral">Not connected</Badge>
          )}
        </div>
      </header>
      <ul>
        {features.map((feature) => (
          <li key={feature}>
            <Check size={12} /> {feature}
          </li>
        ))}
      </ul>
      {connected && connection ? (
        <>
          <div className="connected-account">
            <span className="connected-dot" />
            <span>
              <strong>{connection.accountEmail || "Connected account"}</strong>
              <small>
                Authorized{" "}
                {new Date(connection.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </small>
            </span>
          </div>
          <div className="integration-preferences">
            <IntegrationSwitch
              label={
                isGoogle ? "Sync calendar availability" : "Sync Zoom meetings"
              }
              copy={
                isGoogle
                  ? "Use busy events to prevent double-booking."
                  : "Keep meeting details attached to Soli sessions."
              }
              checked={syncEnabled}
              onChange={setSyncEnabled}
            />
            <IntegrationSwitch
              label={`Automatically add ${isGoogle ? "Google Meet" : "Zoom"}`}
              copy="Create a meeting link for new online sessions."
              checked={autoAddMeeting}
              onChange={setAutoAddMeeting}
            />
            <IntegrationSwitch
              label="Default meeting provider"
              copy="Preselect this provider when a session is scheduled."
              checked={defaultForScheduling}
              onChange={setDefaultForScheduling}
            />
          </div>
          <footer>
            <button onClick={() => onDisconnect(connection)}>Disconnect</button>
            <Button
              variant="soft"
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onUpdate({
                    connectionId: connection.id,
                    syncEnabled,
                    autoAddMeeting,
                    defaultForScheduling,
                  });
                  onToast("Integration preferences saved");
                } catch (error) {
                  onToast(
                    error instanceof Error
                      ? error.message
                      : "Could not save integration preferences",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </footer>
        </>
      ) : (
        <footer className="integration-connect-footer">
          <span>
            {configured === false
              ? "Platform credentials need to be added once before coaches can connect."
              : "You’ll choose an account and approve only the permissions Soli needs."}
          </span>
          <Button
            variant="outline"
            onClick={() => onConnect(provider)}
            disabled={configured === null}
          >
            {configured === null
              ? "Checking…"
              : configured === false
                ? "View setup status"
                : `Connect ${isGoogle ? "Google" : "Zoom"}`}
            <ArrowRight size={13} />
          </Button>
        </footer>
      )}
    </article>
  );
}

function IntegrationSwitch({
  label,
  copy,
  checked,
  onChange,
}: {
  label: string;
  copy: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="integration-switch-row"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{label}</strong>
        <small>{copy}</small>
      </span>
      <i className={cn("integration-switch", checked && "on")}>
        <i />
      </i>
    </button>
  );
}

function ComingIntegration({
  icon,
  title,
  copy,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  tone: string;
}) {
  return (
    <article className="coming-integration panel">
      <span className={cn("coming-integration-icon", tone)}>{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
      <Badge variant="neutral">Coming next</Badge>
    </article>
  );
}

function CommandPalette({
  clientData,
  onClose,
  onNavigate,
  onClient,
}: {
  clientData: Client[];
  onClose: () => void;
  onNavigate: (view: View) => void;
  onClient: (client: Client) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = clientData.filter((client) =>
    client.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="command-palette">
        <div className="command-input">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients, notes, sessions…"
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-results">
          <p>QUICK NAVIGATION</p>
          <div className="command-nav">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => {
                  onNavigate(label);
                  onClose();
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
                <Command size={12} />
              </button>
            ))}
          </div>
          <p>CLIENTS</p>
          {matches.slice(0, 4).map((client) => (
            <button
              className="command-client"
              key={client.id}
              onClick={() => {
                onClient(client);
                onClose();
              }}
            >
              <Avatar
                initials={client.initials}
                color={client.color}
                size="sm"
              />
              <span>
                <strong>{client.name}</strong>
                <small>
                  {client.type} · {client.nextSession} {client.nextSessionTime}
                </small>
              </span>
              <ArrowRight size={13} />
            </button>
          ))}
        </div>
        <div className="command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>↵</kbd> Open
          </span>
          <span>Searches stay private</span>
        </div>
      </div>
    </div>
  );
}

function InviteAcceptanceScreen({
  invitation,
  error,
  onAccept,
  onSignOut,
}: {
  invitation: PortalInvitationPreview | null;
  error: string | null;
  onAccept: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const accept = async () => {
    setSubmitting(true);
    setClaimError(null);
    try {
      await onAccept();
    } catch (acceptError) {
      setClaimError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept this invitation.",
      );
      setSubmitting(false);
    }
  };
  return (
    <main className="auth-shell">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <section className="auth-card invite-acceptance">
        <header className="auth-brand">
          <AppLogo />
          <span>
            <ShieldCheck size={12} />
            Verified account
          </span>
        </header>
        <div className="invite-accept-icon">
          <Mail size={22} />
        </div>
        <p className="eyebrow">PORTAL INVITATION</p>
        <h1>
          {invitation
            ? `Join ${invitation.clientName}’s coaching portal`
            : "This account needs an invitation"}
        </h1>
        <p>
          {invitation
            ? `You’re signed in as ${invitation.email}. Accept access to continue as ${invitation.role === "guardian" ? "a guardian" : invitation.role === "client" ? "the client" : "a care team member"}.`
            : "Open the invitation link from your coach while signed into this account."}
        </p>
        {invitation && (
          <div className="invite-boundary">
            <LockKeyhole size={15} />
            <span>
              <strong>Your access is limited by role</strong>Private coaching
              notes and responses remain hidden unless the coach explicitly
              shares them.
            </span>
          </div>
        )}
        {(claimError || error) && (
          <div className="data-error" role="alert">
            {claimError || error}
          </div>
        )}
        <div className="invite-actions">
          {invitation && (
            <Button
              variant="accent"
              onClick={() => void accept()}
              disabled={submitting}
            >
              {submitting ? "Connecting…" : "Accept invitation"}
            </Button>
          )}
          <Button variant="outline" onClick={() => void onSignOut()}>
            Use a different account
          </Button>
        </div>
      </section>
    </main>
  );
}

function PortalApp({ practice }: { practice: PracticeHook }) {
  const timeZone = usePracticeTimeZone();
  const client = practice.clients[0];
  const [assignmentDetail, setAssignmentDetail] = useState<Assignment | null>(
    null,
  );
  const [scheduleRequest, setScheduleRequest] = useState<
    PracticeSession | "new" | null
  >(null);
  if (!client)
    return (
      <InviteAcceptanceScreen
        invitation={practice.invitationPreview}
        error={practice.error || practice.invitationError}
        onAccept={practice.acceptPortalInvitation}
        onSignOut={practice.signOut}
      />
    );
  const isClient = practice.accountRole === "client";
  const isGuardian = practice.accountRole === "guardian";
  const nextSession = [...practice.sessions]
    .filter((session) => session.status === "scheduled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const openAssignments = practice.assignments.filter(
    (assignment) =>
      assignment.status !== "Complete" && assignment.status !== "Reviewed",
  );
  return (
    <div className="member-portal-shell">
      <header className="member-portal-header">
        <AppLogo />
        <nav>
          <span className="member-role">
            <ShieldCheck size={12} />
            {isClient
              ? "Client portal"
              : isGuardian
                ? "Guardian portal"
                : "Care team portal"}
          </span>
          <button onClick={() => void practice.signOut()}>
            <Avatar
              initials={(practice.userName || "Portal member")
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
              size="sm"
            />
            <span>{practice.userName}</span>
            <LogIn size={14} />
          </button>
        </nav>
      </header>
      <main className="member-portal-main">
        <section className="member-welcome">
          <p className="eyebrow">
            {isClient
              ? "YOUR COACHING SPACE"
              : `SUPPORTING ${client.name.toUpperCase()}`}
          </p>
          <h1>
            {isClient
              ? `Welcome back, ${client.name.split(" ")[0]}`
              : `Hi, ${practice.userName?.split(" ")[0] || "there"}`}
          </h1>
          <p>
            {isClient
              ? "Your next session, assignments, goals, and shared resources—all in one calm place."
              : "A clear view of the logistics and progress updates your coach has chosen to share."}
          </p>
        </section>
        {!isClient && (
          <div className="guardian-privacy-strip">
            <LockKeyhole size={16} />
            <div>
              <strong>Privacy boundary active</strong>
              <span>
                You can see only approved logistics and progress updates.
                Private session notes and assignment responses are never
                included.
              </span>
            </div>
            <Badge variant="blue">
              {practice.portalPermissions.length} permissions
            </Badge>
          </div>
        )}
        <section className="member-next panel">
          <div className="member-next-icon">
            <Video size={20} />
          </div>
          <div>
            <p className="card-kicker">NEXT SESSION</p>
            {nextSession ? (
              <>
                <h2>
                  {formatPracticeDate(
                    nextSession.startsAt,
                    { weekday: "long", month: "long", day: "numeric" },
                    timeZone,
                  )}{" "}
                  at {formatPracticeTime(nextSession.startsAt, timeZone)}
                </h2>
                <span>50 minutes · Zoom</span>
              </>
            ) : (
              <>
                <h2>No session scheduled</h2>
                <span>Send your coach a request when you’re ready.</span>
              </>
            )}
          </div>
          <div className="member-next-actions">
            {nextSession?.meetingUrl && (
              <a
                className="portal-join-button"
                href={nextSession.meetingUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Video size={14} />
                Join Zoom
              </a>
            )}
            {(isClient ||
              practice.portalPermissions.includes("Scheduling")) && (
              <Button
                variant="outline"
                onClick={() => setScheduleRequest(nextSession || "new")}
              >
                {nextSession ? "Request change" : "Request session"}
              </Button>
            )}
          </div>
        </section>
        <div className="member-portal-grid">
          <section className="member-section panel">
            <SectionTitle
              action={
                <Badge variant="neutral">{openAssignments.length} open</Badge>
              }
            >
              {isClient ? "Your assignments" : "Assignment progress"}
            </SectionTitle>
            <p className="section-subcopy">
              {isClient
                ? "Small steps between sessions."
                : "Responses stay private; only logistics and completion appear here."}
            </p>
            <div className="member-assignment-list">
              {practice.assignments.length ? (
                practice.assignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    disabled={!isClient}
                    onClick={() => isClient && setAssignmentDetail(assignment)}
                  >
                    <span
                      className={cn(
                        "member-check",
                        assignment.status === "Complete" ||
                          assignment.status === "Reviewed"
                          ? "done"
                          : "",
                      )}
                    >
                      {assignment.status === "Complete" ||
                      assignment.status === "Reviewed" ? (
                        <Check size={15} />
                      ) : assignment.responseType === "text" ? (
                        <TextCursorInput size={15} />
                      ) : assignment.responseType === "file" ? (
                        <FileUp size={15} />
                      ) : (
                        <ListChecks size={15} />
                      )}
                    </span>
                    <p>
                      <strong>{assignment.title}</strong>
                      <small>
                        {assignment.required ? "Required" : "Optional"} · Due{" "}
                        {assignment.due}
                      </small>
                    </p>
                    <Badge
                      variant={
                        assignment.status === "Overdue"
                          ? "rose"
                          : assignment.status === "Complete" ||
                              assignment.status === "Reviewed"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {assignment.status}
                    </Badge>
                    {isClient && <ChevronRight size={14} />}
                  </button>
                ))
              ) : (
                <div className="mini-empty">
                  No assignments are currently shared.
                </div>
              )}
            </div>
          </section>
          <aside className="member-side">
            <section className="member-section panel">
              <SectionTitle>Goals</SectionTitle>
              {client.goals.length ? (
                client.goals.map((goal) => (
                  <div className="member-goal" key={goal.title}>
                    <div>
                      <Target size={15} />
                      <strong>{goal.title}</strong>
                      <span>{goal.progress}%</span>
                    </div>
                    <i>
                      <i style={{ width: `${goal.progress}%` }} />
                    </i>
                  </div>
                ))
              ) : (
                <div className="mini-empty">No goals are currently shared.</div>
              )}
            </section>
            <section className="member-section panel">
              <SectionTitle>
                {isClient ? "Shared with you" : "Progress updates"}
              </SectionTitle>
              {practice.notes.length ? (
                practice.notes.slice(0, 3).map((note) => (
                  <article className="member-note" key={note.id}>
                    <VisibilityBadge visibility={note.visibility} />
                    <p>{note.body}</p>
                    <span>
                      {formatPracticeDate(
                        note.createdAt,
                        { month: "short", day: "numeric" },
                        timeZone,
                      )}
                    </span>
                  </article>
                ))
              ) : (
                <div className="mini-empty">
                  No updates have been shared yet.
                </div>
              )}
            </section>
            {isClient && (
              <section className="member-section panel">
                <SectionTitle>Resources</SectionTitle>
                {practice.resources.length ? (
                  practice.resources.slice(0, 4).map((resource) => (
                    <button
                      className="member-resource"
                      key={resource.id}
                      onClick={async () => {
                        try {
                          const url = await practice.getResourceUrl(resource);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (error) {
                          toast(
                            error instanceof Error
                              ? error.message
                              : "Resource unavailable",
                          );
                        }
                      }}
                    >
                      <FileText size={16} />
                      <span>
                        <strong>{resource.title}</strong>
                        <small>
                          {resource.type} · {resource.size}
                        </small>
                      </span>
                      <ChevronRight size={13} />
                    </button>
                  ))
                ) : (
                  <div className="mini-empty">
                    Your coach hasn’t assigned resources yet.
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>
      </main>
      <footer className="member-portal-footer">
        <LockKeyhole size={12} />
        Soli shows only information allowed for this account.
      </footer>
      {assignmentDetail && (
        <AssignmentDetail
          assignment={assignmentDetail}
          canReview={false}
          onClose={() => setAssignmentDetail(null)}
          onSubmit={async (responseText, completed) => {
            await practice.submitAssignmentResponse(
              assignmentDetail,
              responseText,
              completed,
            );
            setAssignmentDetail(null);
            toast("Your response was saved");
          }}
          onReview={async () => {}}
          onUploadFile={(file) =>
            practice.uploadAssignmentFile(assignmentDetail, file)
          }
          onOpenFile={async (storagePath) => {
            const url = await practice.getAssignmentFileUrl(storagePath);
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        />
      )}
      {scheduleRequest && (
        <SchedulingRequestModal
          session={scheduleRequest === "new" ? null : scheduleRequest}
          onClose={() => setScheduleRequest(null)}
          onSubmit={async (input) => {
            await practice.requestScheduleChange(input);
            setScheduleRequest(null);
            toast("Your coach received the request");
          }}
        />
      )}
    </div>
  );
}

function PortalAccessModal({
  client,
  invitations,
  onClose,
  onCreate,
}: {
  client: Client;
  invitations: PortalInvitation[];
  onClose: () => void;
  onCreate: (input: {
    clientId: string;
    relationshipId: string | null;
    email: string;
    fullName: string;
    role: "client" | "guardian" | "third_party";
  }) => Promise<string>;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const members = [
    {
      key: `client-${client.id}`,
      relationshipId: null,
      name: client.name,
      email: client.email,
      role: "client" as const,
      label: client.type === "Teen" ? "Teen client" : "Client",
      initials: client.initials,
      active: client.portalActive,
    },
    ...(client.guardians || []).map((guardian) => ({
      key: `guardian-${guardian.id}`,
      relationshipId: guardian.id,
      name: guardian.name,
      email: guardian.email,
      role: "guardian" as const,
      label: guardian.relation,
      initials: guardian.initials,
      active: guardian.portalActive,
    })),
    ...(client.careTeam || []).map((person) => ({
      key: `third-${person.id}`,
      relationshipId: person.id,
      name: person.name,
      email: person.email,
      role: "third_party" as const,
      label: person.role,
      initials: person.initials,
      active: person.portalActive,
    })),
  ];
  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setMessage("Secure invitation link copied");
  };
  const invite = async (member: (typeof members)[number]) => {
    setError(null);
    setMessage(null);
    setPendingKey(member.key);
    try {
      const link = await onCreate({
        clientId: client.id,
        relationshipId: member.relationshipId,
        email: member.email,
        fullName: member.name,
        role: member.role,
      });
      await copy(link);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Unable to create this invitation.",
      );
    } finally {
      setPendingKey(null);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="workflow-modal portal-access-modal">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PEOPLE & ACCESS</p>
            <h2>Portal access for {client.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close portal access">
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          Create an email-bound invitation for each person. Links expire after
          seven days and connect only to the intended role.
        </p>
        <div className="access-boundary">
          <ShieldCheck size={17} />
          <div>
            <strong>Coach-controlled privacy</strong>
            <span>
              Portal access never grants private coaching notes. Guardian and
              care-team permissions remain separate.
            </span>
          </div>
        </div>
        <div className="portal-member-list">
          {members.map((member) => {
            const currentInvite = invitations.find(
              (invitation) =>
                invitation.relationshipId === member.relationshipId &&
                invitation.role === member.role &&
                !invitation.acceptedAt &&
                !invitation.revokedAt &&
                new Date(invitation.expiresAt).getTime() > Date.now(),
            );
            const missingEmail = member.email === "Email not set";
            return (
              <div className="portal-member" key={member.key}>
                <Avatar initials={member.initials} size="sm" />
                <p>
                  <strong>{member.name}</strong>
                  <small>
                    {member.label} · {member.email}
                  </small>
                </p>
                {member.active ? (
                  <Badge variant="success">Active</Badge>
                ) : currentInvite ? (
                  <Badge variant="warning">Invited</Badge>
                ) : (
                  <Badge variant="neutral">Not invited</Badge>
                )}
                {member.active ? (
                  <Button size="sm" variant="ghost" disabled>
                    Connected
                  </Button>
                ) : currentInvite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void copy(
                        `${window.location.origin}/?invite=${currentInvite.token}`,
                      )
                    }
                  >
                    <Copy size={13} />
                    Copy link
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={missingEmail || pendingKey === member.key}
                    onClick={() => void invite(member)}
                  >
                    {pendingKey === member.key ? "Creating…" : "Invite"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {message && (
          <div className="access-message">
            <CheckCircle2 size={14} />
            {message}
          </div>
        )}
        {error && (
          <div className="data-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

function SchedulingRequestModal({
  session,
  onClose,
  onSubmit,
}: {
  session: PracticeSession | null;
  onClose: () => void;
  onSubmit: (input: {
    sessionId: string | null;
    requestType: "reschedule" | "cancel" | "new_session";
    requestedStartsAt: string | null;
    message: string;
  }) => Promise<void>;
}) {
  const timeZone = usePracticeTimeZone();
  const [requestType, setRequestType] = useState<
    "reschedule" | "cancel" | "new_session"
  >(session ? "reschedule" : "new_session");
  const [requestedStartsAt, setRequestedStartsAt] = useState(
    session ? localDateTime(48) : localDateTime(24),
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        sessionId: session?.id || null,
        requestType,
        requestedStartsAt:
          requestType === "cancel" || !requestedStartsAt
            ? null
            : new Date(requestedStartsAt).toISOString(),
        message: message.trim(),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send this request.",
      );
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="workflow-modal scheduling-request-modal"
        onSubmit={submit}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">SCHEDULING REQUEST</p>
            <h2>
              {session ? "Request a session change" : "Request a session"}
            </h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          Send a request to your coach. Your current booking stays unchanged
          until they confirm it.
        </p>
        {session && (
          <div className="request-current">
            <CalendarDays size={16} />
            <div>
              <strong>Current session</strong>
              <span>
                {formatPracticeDate(
                  session.startsAt,
                  { weekday: "long", month: "short", day: "numeric" },
                  timeZone,
                )}{" "}
                at {formatPracticeTime(session.startsAt, timeZone)} · Zoom
              </span>
            </div>
          </div>
        )}
        <div className="form-stack">
          <label>
            Request
            <select
              value={requestType}
              onChange={(event) =>
                setRequestType(
                  event.target.value as "reschedule" | "cancel" | "new_session",
                )
              }
            >
              <option value={session ? "reschedule" : "new_session"}>
                {session ? "Reschedule" : "New session"}
              </option>
              {session && <option value="cancel">Cancel this session</option>}
            </select>
          </label>
          {requestType !== "cancel" && (
            <label>
              Preferred date and time
              <input
                type="datetime-local"
                value={requestedStartsAt}
                onChange={(event) => setRequestedStartsAt(event.target.value)}
                required
              />
            </label>
          )}
          <label>
            Note for your coach
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share a few times that work, or anything your coach should know."
            />
          </label>
        </div>
        {error && (
          <div className="data-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Keep current session
          </Button>
          <Button type="submit" variant="accent" disabled={saving}>
            {saving ? "Sending…" : "Send request"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type AuthView =
  "sign_in" | "sign_up" | "forgot" | "check_email" | "set_password";

function AuthScreen({
  error,
  needsPasswordUpdate,
  invitation,
  invitationError,
  onSignIn,
  onOAuth,
  onSignUp,
  onReset,
  onUpdatePassword,
}: {
  error: string | null;
  needsPasswordUpdate: boolean;
  invitation: PortalInvitationPreview | null;
  invitationError: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onOAuth: (provider: "google" | "apple") => Promise<void>;
  onSignUp: (
    fullName: string,
    email: string,
    password: string,
    accountType?: "coach" | "portal",
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  onReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
}) {
  const [view, setView] = useState<AuthView>(
    needsPasswordUpdate ? "set_password" : invitation ? "sign_up" : "sign_in",
  );
  const [fullName, setFullName] = useState(invitation?.fullName || "");
  const [email, setEmail] = useState(invitation?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "apple" | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

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
        if (password.length < 10)
          throw new Error("Use at least 10 characters for your password.");
        if (password !== confirmPassword)
          throw new Error("Passwords do not match.");
        const result = await onSignUp(
          fullName.trim(),
          email.trim(),
          password,
          invitation ? "portal" : "coach",
        );
        if (result.requiresEmailConfirmation) setView("check_email");
      }
      if (view === "forgot") {
        await onReset(email.trim());
        setView("check_email");
      }
      if (view === "set_password") {
        if (password.length < 10)
          throw new Error("Use at least 10 characters for your password.");
        if (password !== confirmPassword)
          throw new Error("Passwords do not match.");
        await onUpdatePassword(password);
      }
    } catch (authError) {
      setFormError(
        authError instanceof Error
          ? authError.message
          : "We couldn't complete that request.",
      );
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
      setFormError(
        oauthError instanceof Error
          ? oauthError.message
          : `Unable to continue with ${provider === "google" ? "Google" : "Apple"}.`,
      );
      setOauthProvider(null);
    }
  };

  const title =
    invitation && view === "sign_up"
      ? `Join ${invitation.clientName}’s portal`
      : view === "sign_up"
        ? "Create your practice"
        : view === "forgot"
          ? "Reset your password"
          : view === "check_email"
            ? "Check your email"
            : view === "set_password"
              ? "Choose your password"
              : "Welcome back";
  const copy =
    invitation && view === "sign_up"
      ? `Create the ${invitation.role === "guardian" ? "guardian" : invitation.role === "client" ? "client" : "care team"} account invited for ${invitation.email}.`
      : view === "sign_up"
        ? "Start a private workspace for your coaching practice."
        : view === "forgot"
          ? "We'll send you a secure link to choose a new password."
          : view === "check_email"
            ? `We sent a secure link to ${email || "your inbox"}.`
            : view === "set_password"
              ? "Finish activating your account with a password only you know."
              : "Sign in to your private Soli workspace.";

  return (
    <main className="auth-shell">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <section className="auth-card">
        <header className="auth-brand">
          <AppLogo />
          <span>
            <ShieldCheck size={12} />
            Private by design
          </span>
        </header>
        <div className="auth-heading">
          <span className="auth-icon">
            {view === "check_email" ? (
              <Mail size={20} />
            ) : view === "set_password" || view === "forgot" ? (
              <KeyRound size={20} />
            ) : (
              <LogIn size={20} />
            )}
          </span>
          <h1>{title}</h1>
          <p>{copy}</p>
        </div>
        {view === "check_email" ? (
          <div className="auth-check-email">
            <div>
              <CheckCircle2 size={20} />
            </div>
            <p>
              The link may take a minute to arrive. Check your spam folder if
              you don’t see it.
            </p>
            <Button variant="outline" onClick={() => changeView("sign_in")}>
              <ArrowLeft size={14} />
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            {!invitation && (view === "sign_in" || view === "sign_up") && (
              <div className="oauth-options">
                <button
                  className="oauth-provider-button"
                  type="button"
                  aria-label={
                    oauthProvider === "google"
                      ? "Opening Google"
                      : "Sign in with Google"
                  }
                  aria-busy={oauthProvider === "google"}
                  onClick={() => void startOAuth("google")}
                  disabled={submitting || oauthProvider !== null}
                >
                  {/* Native image preserves the exact official OAuth artwork. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/oauth/google-signin-light.png"
                    alt=""
                    width="180"
                    height="40"
                  />
                </button>
                <button
                  className="oauth-provider-button"
                  type="button"
                  aria-label={
                    oauthProvider === "apple"
                      ? "Opening Apple"
                      : "Continue with Apple"
                  }
                  aria-busy={oauthProvider === "apple"}
                  onClick={() => void startOAuth("apple")}
                  disabled={submitting || oauthProvider !== null}
                >
                  {/* Native image preserves the exact official OAuth artwork. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/oauth/apple-continue-white.png"
                    alt=""
                    width="180"
                    height="40"
                  />
                </button>
              </div>
            )}
            {!invitation && (view === "sign_in" || view === "sign_up") && (
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            )}
            <form className="auth-form" onSubmit={submit}>
              {view === "sign_up" && (
                <label>
                  Full name
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    required
                    placeholder="Your name"
                  />
                </label>
              )}
              {view !== "set_password" && (
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    placeholder="you@yourpractice.com"
                  />
                </label>
              )}
              {(view === "sign_in" ||
                view === "sign_up" ||
                view === "set_password") && (
                <label>
                  {view === "set_password" ? "New password" : "Password"}
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      view === "sign_in" ? "current-password" : "new-password"
                    }
                    minLength={view === "sign_in" ? undefined : 10}
                    required
                    placeholder="••••••••••••"
                  />
                </label>
              )}
              {(view === "sign_up" || view === "set_password") && (
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    required
                    placeholder="••••••••••••"
                  />
                </label>
              )}
              {view === "sign_in" && (
                <button
                  className="auth-text-button"
                  type="button"
                  onClick={() => changeView("forgot")}
                >
                  Forgot password?
                </button>
              )}
              {(formError || error || invitationError) && (
                <div className="data-error" role="alert">
                  {formError || error || invitationError}
                </div>
              )}
              <Button variant="accent" type="submit" disabled={submitting}>
                {submitting
                  ? "Please wait…"
                  : view === "sign_up"
                    ? invitation
                      ? "Create portal account"
                      : "Create practice"
                    : view === "forgot"
                      ? "Send reset link"
                      : view === "set_password"
                        ? "Set password and continue"
                        : "Sign in"}
              </Button>
            </form>
          </>
        )}
        {(view === "sign_in" || view === "sign_up") && (
          <footer className="auth-switch">
            {view === "sign_in" ? (
              <>
                {invitation ? "Need a portal account?" : "New to Soli?"}{" "}
                <button onClick={() => changeView("sign_up")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => changeView("sign_in")}>Sign in</button>
              </>
            )}
          </footer>
        )}
        <div className="auth-trust">
          <LockKeyhole size={11} />
          Your client data is protected by account and organization permissions.
        </div>
      </section>
    </main>
  );
}

function AccountModal({
  email,
  error,
  onClose,
  onSignOut,
}: {
  email: string | null;
  error: string | null;
  onClose: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const signOut = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await onSignOut();
      onClose();
    } catch (signOutError) {
      setFormError(
        signOutError instanceof Error
          ? signOutError.message
          : "Unable to sign out.",
      );
      setSubmitting(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="data-modal">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ACCOUNT</p>
            <h2>Your secure workspace</h2>
          </div>
          <button onClick={onClose} aria-label="Close account settings">
            <X size={18} />
          </button>
        </div>
        <div className="data-connected">
          <span>
            <CheckCircle2 size={20} />
          </span>
          <div>
            <strong>Live data is active</strong>
            <p>{email || "Signed in"} · Protected by row-level permissions.</p>
          </div>
        </div>
        {(formError || error) && (
          <div className="data-error">{formError || error}</div>
        )}
        <Button
          className="account-signout"
          variant="outline"
          onClick={() => void signOut()}
          disabled={submitting}
        >
          {submitting ? "Signing out…" : "Sign out"}
        </Button>
        <div className="data-modal-note">
          <LockKeyhole size={12} />
          Your browser never receives administrative credentials.
        </div>
      </div>
    </div>
  );
}

function QuickAdd({
  onClose,
  onSchedule,
  onAssignment,
  onSession,
  onToast,
}: {
  onClose: () => void;
  onSchedule: () => void;
  onAssignment: () => void;
  onSession: () => void;
  onToast: (message: string) => void;
}) {
  const actions = [
    {
      icon: UserRound,
      title: "Add client",
      copy: "Start a new client record",
      action: () => onToast("Client onboarding is next in the MVP"),
    },
    {
      icon: CalendarDays,
      title: "Schedule session",
      copy: "Book or block time",
      action: onSchedule,
    },
    {
      icon: NotebookPen,
      title: "Start session",
      copy: "Notes, attendance, and follow-up",
      action: onSession,
    },
    {
      icon: ListChecks,
      title: "Assignment",
      copy: "Send a task or reflection",
      action: onAssignment,
    },
    {
      icon: FileText,
      title: "Upload resource",
      copy: "Add to your library",
      action: () => onToast("Secure resource upload opened"),
    },
    {
      icon: Send,
      title: "Send message",
      copy: "Reach out to a client",
      action: () => onToast("Message composer opened"),
    },
  ];
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="quick-add-modal">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">CREATE</p>
            <h2>What would you like to add?</h2>
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="quick-action-grid">
          {actions.map(({ icon: Icon, title, copy, action }) => (
            <button key={title} onClick={action}>
              <span>
                <Icon size={18} />
              </span>
              <p>
                <strong>{title}</strong>
                <small>{copy}</small>
              </p>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function localDateTime(hoursAhead = 24) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function SessionPanel({
  client,
  sessionId,
  onClose,
  onComplete,
}: {
  client: Client;
  sessionId: string | null;
  onClose: () => void;
  onComplete: (input: {
    sessionId: string | null;
    clientId: string;
    attendance: "attended" | "late_cancel" | "no_show";
    notes: string;
    noteVisibility: Visibility;
    sharedSummary: string;
    nextSessionAt: string | null;
    assignment: null | {
      title: string;
      instructions: string;
      responseType: "checkbox" | "text";
      required: boolean;
      dueAt: string | null;
      guardianShare: "client_default" | "share" | "private";
    };
  }) => Promise<void>;
}) {
  const [visibility, setVisibility] = useState<Visibility>("Coach only");
  const [aiSummary, setAiSummary] = useState(false);
  const [notes, setNotes] = useState("");
  const [attendance, setAttendance] = useState<
    "attended" | "late_cancel" | "no_show"
  >("attended");
  const [sharedSummary, setSharedSummary] = useState("");
  const [nextSessionAt, setNextSessionAt] = useState("");
  const [addAssignment, setAddAssignment] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [responseType, setResponseType] = useState<"checkbox" | "text">(
    "checkbox",
  );
  const [required, setRequired] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [guardianShare, setGuardianShare] = useState<
    "client_default" | "share" | "private"
  >(client.type === "Teen" ? "client_default" : "private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete({
        sessionId,
        clientId: client.id,
        attendance,
        notes,
        noteVisibility: visibility,
        sharedSummary,
        nextSessionAt: nextSessionAt
          ? new Date(nextSessionAt).toISOString()
          : null,
        assignment:
          addAssignment && assignmentTitle.trim()
            ? {
                title: assignmentTitle.trim(),
                instructions: assignmentInstructions,
                responseType,
                required,
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                guardianShare,
              }
            : null,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to finish this session.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="drawer-backdrop">
      <button
        className="drawer-scrim"
        onClick={onClose}
        aria-label="Close session panel"
      />
      <aside className="session-drawer">
        <header>
          <div>
            <p className="eyebrow">SESSION WORKSPACE</p>
            <h2>{client.name}</h2>
            <span>
              {sessionId ? "Scheduled session" : "New session"} · 50 minutes
            </span>
          </div>
          <button onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="session-context">
          <p>
            <span>Active focus</span>
            <strong>{client.goals[0]?.title || client.headline}</strong>
          </p>
          <span className="session-private">
            <LockKeyhole size={11} />
            Coach context
          </span>
        </div>
        <div className="session-form">
          <label>
            Attendance
            <div className="attendance-options">
              {(["attended", "late_cancel", "no_show"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(attendance === item && "active")}
                  onClick={() => setAttendance(item)}
                >
                  {item === "attended" && <CheckCircle2 size={14} />}
                  {item === "attended"
                    ? "Attended"
                    : item === "late_cancel"
                      ? "Late cancel"
                      : "No show"}
                </button>
              ))}
            </div>
          </label>
          <label>
            Session notes
            <span className="field-hint">
              Private by default. The visibility is attached to this note.
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Capture themes, observations, and next steps…"
            />
          </label>
          <div className="visibility-picker">
            <div>
              <strong>Who can see this note?</strong>
              <span>The coach always controls sharing.</span>
            </div>
            <div className="visibility-options">
              {(
                [
                  "Coach only",
                  "Coach + Client",
                  ...(client.type === "Teen"
                    ? ["Coach + Parent", "Everyone"]
                    : []),
                ] as Visibility[]
              ).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={cn(visibility === item && "active")}
                  onClick={() => setVisibility(item)}
                >
                  <LockKeyhole size={12} />
                  {item}
                  {visibility === item && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>
          <label>
            Client takeaway{" "}
            <span className="field-hint">
              Optional · shared directly with {client.name.split(" ")[0]}
            </span>
            <textarea
              className="compact-textarea"
              value={sharedSummary}
              onChange={(event) => setSharedSummary(event.target.value)}
              placeholder="A concise recap or encouragement in your own words…"
            />
          </label>
          <div className="ai-summary-box">
            <div className="ai-summary-top">
              <span>
                <Mic2 size={16} />
              </span>
              <div>
                <strong>AI meeting summary</strong>
                <p>
                  Optional transcription and summary only. Soli never gives
                  coaching advice.
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle AI summary"
                className={cn("toggle", aiSummary && "on")}
                onClick={() => setAiSummary(!aiSummary)}
              >
                <i />
              </button>
            </div>
            {aiSummary && (
              <div className="ai-consent">
                <ShieldCheck size={13} />
                <span>
                  Client consent is required before recording. Summary
                  generation will be connected in a later build.
                </span>
              </div>
            )}
          </div>
          <div className="session-wrapup-grid">
            <label>
              Next session
              <input
                type="datetime-local"
                value={nextSessionAt}
                onChange={(event) => setNextSessionAt(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={cn("add-followup-card", addAssignment && "active")}
              onClick={() => setAddAssignment(!addAssignment)}
            >
              <ListChecks size={16} />
              <span>
                <strong>Add assignment</strong>
                <small>Publish a task with this follow-up</small>
              </span>
              <i className={cn("toggle", addAssignment && "on")}>
                <i />
              </i>
            </button>
          </div>
          {addAssignment && (
            <div className="inline-assignment">
              <label>
                Assignment title
                <input
                  value={assignmentTitle}
                  onChange={(event) => setAssignmentTitle(event.target.value)}
                  placeholder="One clear next step"
                />
              </label>
              <label>
                Instructions
                <textarea
                  className="compact-textarea"
                  value={assignmentInstructions}
                  onChange={(event) =>
                    setAssignmentInstructions(event.target.value)
                  }
                  placeholder="What should the client do or reflect on?"
                />
              </label>
              <div className="form-grid">
                <label>
                  Response
                  <select
                    value={responseType}
                    onChange={(event) =>
                      setResponseType(event.target.value as "checkbox" | "text")
                    }
                  >
                    <option value="checkbox">Completion checkbox</option>
                    <option value="text">Written response</option>
                  </select>
                </label>
                <label>
                  Due
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                  />
                </label>
              </div>
              <label className="check-control">
                <Checkbox
                  checked={required}
                  onCheckedChange={(checked) => setRequired(checked === true)}
                />
                Required to complete
              </label>
              {client.type === "Teen" && (
                <GuardianShareSelect
                  value={guardianShare}
                  onChange={setGuardianShare}
                />
              )}
            </div>
          )}
          {error && (
            <div className="data-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <footer>
          <span>
            <LockKeyhole size={12} />
            Private until you finish
          </span>
          <div>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => void finish()}
              disabled={!notes.trim() || saving}
            >
              {saving ? "Saving…" : "Finish session"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ScheduleSessionModal({
  clients: clientData,
  initialClientId,
  onClose,
  onSave,
}: {
  clients: Client[];
  initialClientId: string | null;
  onClose: () => void;
  onSave: (input: {
    clientId: string;
    startsAt: string;
    durationMinutes: number;
    meetingProvider: "google_meet" | "zoom" | "other" | null;
  }) => Promise<void>;
}) {
  const [clientId, setClientId] = useState(
    initialClientId || clientData[0]?.id || "",
  );
  const [startsAt, setStartsAt] = useState(localDateTime());
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [meetingProvider, setMeetingProvider] = useState<
    "google_meet" | "zoom" | "other" | null
  >("zoom");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ clientId, startsAt, durationMinutes, meetingProvider });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="workflow-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">SCHEDULING</p>
            <h2>Schedule a session</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          Choose the client and time. You can begin the session workspace
          directly from the calendar.
        </p>
        <div className="form-stack">
          <label>
            Client
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              required
            >
              {clientData.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Starts
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label>
              Duration
              <select
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(Number(event.target.value))
                }
              >
                <option value={30}>30 minutes</option>
                <option value={50}>50 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </label>
          </div>
          <label>
            Meeting location
            <select
              value={meetingProvider || "other"}
              onChange={(event) =>
                setMeetingProvider(
                  event.target.value as "google_meet" | "zoom" | "other",
                )
              }
            >
              <option value="zoom">Zoom</option>
              <option value="google_meet">Google Meet (later)</option>
              <option value="other">Other / in person</option>
            </select>
          </label>
          <div className="privacy-callout neutral">
            <Video size={16} />
            <span>
              <strong>Zoom first</strong> Zoom is the default meeting provider.
              Automatic link creation will activate when the Zoom account
              connection is added.
            </span>
          </div>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={saving || !clientId}>
            {saving ? "Scheduling…" : "Schedule session"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function GuardianShareSelect({
  value,
  onChange,
}: {
  value: "client_default" | "share" | "private";
  onChange: (value: "client_default" | "share" | "private") => void;
}) {
  return (
    <label>
      Guardian logistics
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as "client_default" | "share" | "private")
        }
      >
        <option value="client_default">
          Use this client’s guardian settings
        </option>
        <option value="share">Share logistics for this assignment</option>
        <option value="private">Keep this assignment private</option>
      </select>
      <span className="field-hint">
        Only title, due date, required status, and completion can be shared.
        Responses stay private.
      </span>
    </label>
  );
}

function AssignmentComposer({
  client,
  onClose,
  onSave,
}: {
  client: Client;
  onClose: () => void;
  onSave: (input: {
    title: string;
    instructions: string;
    responseType: "checkbox" | "text" | "file";
    required: boolean;
    dueAt: string | null;
    guardianShare: "client_default" | "share" | "private";
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [responseType, setResponseType] = useState<
    "checkbox" | "text" | "file"
  >("checkbox");
  const [required, setRequired] = useState(false);
  const [dueAt, setDueAt] = useState(localDateTime(72));
  const [guardianShare, setGuardianShare] = useState<
    "client_default" | "share" | "private"
  >(client.type === "Teen" ? "client_default" : "private");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        instructions,
        responseType,
        required,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        guardianShare,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form className="workflow-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ASSIGN TO {client.name.toUpperCase()}</p>
            <h2>Create an assignment</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          Keep it clear: one outcome, one response, and an obvious due date.
        </p>
        <div className="form-stack">
          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Three moments I trusted myself"
              required
            />
          </label>
          <label>
            Instructions
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="What should the client do?"
            />
          </label>
          <div className="response-choice assignment-response-choice">
            <button
              type="button"
              className={cn(responseType === "checkbox" && "active")}
              onClick={() => setResponseType("checkbox")}
            >
              <ListChecks size={17} />
              <span>
                <strong>Checkbox</strong>
                <small>Client marks it done</small>
              </span>
            </button>
            <button
              type="button"
              className={cn(responseType === "text" && "active")}
              onClick={() => setResponseType("text")}
            >
              <TextCursorInput size={17} />
              <span>
                <strong>Text response</strong>
                <small>Client submits writing</small>
              </span>
            </button>
            <button
              type="button"
              className={cn(responseType === "file" && "active")}
              onClick={() => setResponseType("file")}
            >
              <FileUp size={17} />
              <span>
                <strong>File upload</strong>
                <small>Client submits a file</small>
              </span>
            </button>
          </div>
          <label>
            Due date
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <label className="check-control">
            <Checkbox
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            Make this mandatory
          </label>
          {client.type === "Teen" && (
            <GuardianShareSelect
              value={guardianShare}
              onChange={setGuardianShare}
            />
          )}
          <div className="privacy-callout">
            <LockKeyhole size={16} />
            <span>
              <strong>Coach + client</strong> The assignment response is never
              automatically visible to a guardian.
            </span>
          </div>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="accent"
            disabled={!title.trim() || saving}
          >
            {saving ? "Publishing…" : "Publish assignment"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AssignmentDetail({
  assignment,
  onClose,
  onSubmit,
  onReview,
  onUploadFile,
  onOpenFile,
  canReview = true,
}: {
  assignment: Assignment;
  onClose: () => void;
  onSubmit: (responseText: string, completed: boolean) => Promise<void>;
  onReview: () => Promise<void>;
  onUploadFile?: (file: File) => Promise<void>;
  onOpenFile?: (storagePath: string) => Promise<void>;
  canReview?: boolean;
}) {
  const [response, setResponse] = useState(assignment.responseText);
  const [checked, setChecked] = useState(
    assignment.status === "Complete" || assignment.status === "Reviewed",
  );
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(
        response,
        assignment.responseType === "checkbox" ? checked : false,
      );
    } finally {
      setSaving(false);
    }
  };
  const reviewable =
    assignment.status === "Submitted" || assignment.status === "Complete";
  const submitFile = async () => {
    if (!selectedFile || !onUploadFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      setFileError("That file is over the 10 MB limit.");
      return;
    }
    setSaving(true);
    setFileError(null);
    try {
      await onUploadFile(selectedFile);
      onClose();
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="workflow-modal assignment-detail">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">
              {assignment.client.toUpperCase()} · DUE{" "}
              {assignment.due.toUpperCase()}
            </p>
            <h2>{assignment.title}</h2>
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="detail-meta">
          <Badge variant={assignment.required ? "warning" : "neutral"}>
            {assignment.required ? "Required" : "Optional"}
          </Badge>
          <Badge
            variant={
              assignment.status === "Overdue"
                ? "rose"
                : assignment.status === "Reviewed"
                  ? "success"
                  : "purple"
            }
          >
            {assignment.status}
          </Badge>
          <VisibilityBadge visibility={assignment.visibility} />
        </div>
        <p className="assignment-instructions">
          {assignment.instructions || "No additional instructions."}
        </p>
        {assignment.guardianLogisticsShared && (
          <div className="privacy-callout guardian">
            <ShieldCheck size={16} />
            <span>
              <strong>Guardian logistics shared</strong> Title, due date,
              required status, and completion are visible. The response stays
              private.
            </span>
          </div>
        )}
        <div className="response-preview">
          <p className="eyebrow">CLIENT RESPONSE</p>
          {assignment.responseType === "text" ? (
            <label>
              Written reflection
              <textarea
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                placeholder="The client’s response appears here…"
              />
            </label>
          ) : assignment.responseType === "file" ? (
            <div className="homework-files">
              {assignment.files.length > 0 && (
                <div className="submitted-file-list">
                  {assignment.files.map((file) => (
                    <button
                      type="button"
                      key={file.id}
                      onClick={() => void onOpenFile?.(file.storagePath)}
                    >
                      <FileCheck2 size={17} />
                      <span>
                        <strong>{file.name}</strong>
                        <small>
                          {fileSizeLabel(file.byteSize)} · Submitted{" "}
                          {new Date(file.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </small>
                      </span>
                      <FileDown size={14} />
                    </button>
                  ))}
                </div>
              )}
              {onUploadFile && (
                <label
                  className={cn(
                    "homework-dropzone",
                    selectedFile && "selected",
                  )}
                >
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.xls,.xlsx"
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] || null);
                      setFileError(null);
                    }}
                  />
                  <FileUp size={20} />
                  <span>
                    <strong>
                      {selectedFile
                        ? selectedFile.name
                        : "Choose your completed file"}
                    </strong>
                    <small>
                      {selectedFile
                        ? `${fileSizeLabel(selectedFile.size)} · Ready to submit`
                        : "PDF, document, spreadsheet, or image · 10 MB max"}
                    </small>
                  </span>
                </label>
              )}
              {!assignment.files.length && !onUploadFile && (
                <div className="mini-empty">
                  No file has been submitted yet.
                </div>
              )}
              {fileError && <p className="form-error">{fileError}</p>}
            </div>
          ) : (
            <label
              className="completion-check"
              aria-label="Mark assignment complete"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => setChecked(value === true)}
              />
              <span>
                <strong>Mark this assignment complete</strong>
                <small>The coach and client will see the updated status.</small>
              </span>
            </label>
          )}
        </div>
        <div className="modal-actions">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canReview && reviewable && (
            <Button variant="soft" onClick={() => void onReview()}>
              Mark reviewed
            </Button>
          )}
          {assignment.responseType === "file" ? (
            onUploadFile && (
              <Button
                variant="accent"
                onClick={() => void submitFile()}
                disabled={!selectedFile || saving}
              >
                {saving ? "Uploading…" : "Submit file"}
              </Button>
            )
          ) : (
            <Button
              variant="accent"
              onClick={() => void submit()}
              disabled={
                saving ||
                (assignment.responseType === "text" && !response.trim())
              }
            >
              {saving
                ? "Saving…"
                : assignment.responseType === "text"
                  ? "Submit response"
                  : "Save completion"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function GuardianSharingModal({
  client,
  onClose,
  onChange,
}: {
  client: Client;
  onClose: () => void;
  onChange: (guardianId: string, enabled: boolean) => Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      (client.guardians || []).map((guardian) => [
        guardian.id,
        guardian.automaticAssignmentUpdates,
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="workflow-modal sharing-modal">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PEOPLE & ACCESS</p>
            <h2>Guardian assignment updates</h2>
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="modal-copy">
          Choose which guardians automatically receive assignment logistics for{" "}
          {client.name}. Coaches can override this on each assignment.
        </p>
        <div className="sharing-boundary">
          <div>
            <span>
              <Check size={14} />
            </span>
            <p>
              <strong>May be shared</strong>
              <small>
                Title, due date, required or optional, completion status
              </small>
            </p>
          </div>
          <div>
            <span className="locked">
              <LockKeyhole size={14} />
            </span>
            <p>
              <strong>Always private unless explicitly shared elsewhere</strong>
              <small>
                Written responses, session notes, coach observations
              </small>
            </p>
          </div>
        </div>
        <div className="guardian-list">
          {client.guardians?.map((guardian) => {
            const enabled = preferences[guardian.id] ?? false;
            return (
              <div key={guardian.id}>
                <Avatar initials={guardian.initials} size="sm" />
                <p>
                  <strong>{guardian.name}</strong>
                  <small>
                    {guardian.relation} · {guardian.permissions.join(", ")}
                  </small>
                </p>
                <button
                  aria-label={`Toggle updates for ${guardian.name}`}
                  aria-pressed={enabled}
                  className={cn("toggle", enabled && "on")}
                  disabled={pending === guardian.id}
                  onClick={async () => {
                    const next = !enabled;
                    setError(null);
                    setPending(guardian.id);
                    setPreferences((current) => ({
                      ...current,
                      [guardian.id]: next,
                    }));
                    try {
                      await onChange(guardian.id, next);
                    } catch (updateError) {
                      setPreferences((current) => ({
                        ...current,
                        [guardian.id]: enabled,
                      }));
                      setError(
                        updateError instanceof Error
                          ? updateError.message
                          : "Unable to update this guardian.",
                      );
                    } finally {
                      setPending(null);
                    }
                  }}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>
        {error && (
          <div className="data-error" role="alert">
            {error}
          </div>
        )}
        <div className="privacy-callout">
          <ShieldCheck size={16} />
          <span>
            <strong>The coach remains in control.</strong> Automatic sharing can
            be turned off here or overridden on a specific assignment.
          </span>
        </div>
        <div className="modal-actions">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

function ClientPortalPreview({
  client,
  assignments: clientAssignments,
  onClose,
  onOpenAssignment,
  onSchedule,
}: {
  client: Client;
  assignments: Assignment[];
  onClose: () => void;
  onOpenAssignment: (assignment: Assignment) => void;
  onSchedule: () => void;
}) {
  return (
    <div
      className="modal-backdrop portal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="portal-modal">
        <header>
          <div>
            <AppLogo />
            <Badge variant="neutral">Client portal preview</Badge>
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <main>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Hi, {client.name.split(" ")[0]}</h2>
          <p className="portal-lead">
            Here’s everything you need before your next conversation.
          </p>
          <section className="portal-next">
            <div className="date-tile">
              <strong>{client.nextSession === "Today" ? "13" : "20"}</strong>
              <span>AUG</span>
            </div>
            <p>
              <small>NEXT SESSION</small>
              <strong>
                {client.nextSession}, {client.nextSessionTime || "time not set"}
              </strong>
              <span>50 minutes · Zoom</span>
            </p>
            <Button onClick={onSchedule} variant="outline">
              Reschedule
            </Button>
          </section>
          <div className="portal-columns">
            <section>
              <div className="section-title-row">
                <h3>Your assignments</h3>
                <span>
                  {
                    clientAssignments.filter(
                      (item) =>
                        item.status !== "Complete" &&
                        item.status !== "Reviewed",
                    ).length
                  }{" "}
                  open
                </span>
              </div>
              {clientAssignments.length ? (
                clientAssignments.map((assignment) => (
                  <button
                    className="portal-assignment"
                    key={assignment.id}
                    onClick={() => onOpenAssignment(assignment)}
                  >
                    <span>
                      {assignment.responseType === "text" ? (
                        <TextCursorInput size={16} />
                      ) : assignment.responseType === "file" ? (
                        <FileUp size={16} />
                      ) : (
                        <ListChecks size={16} />
                      )}
                    </span>
                    <p>
                      <strong>{assignment.title}</strong>
                      <small>
                        Due {assignment.due} ·{" "}
                        {assignment.required ? "Required" : "Optional"}
                      </small>
                    </p>
                    <Badge
                      variant={
                        assignment.status === "Overdue" ? "rose" : "neutral"
                      }
                    >
                      {assignment.status}
                    </Badge>
                    <ChevronRight size={14} />
                  </button>
                ))
              ) : (
                <div className="mini-empty">You’re all caught up.</div>
              )}
            </section>
            <aside>
              <h3>Your goals</h3>
              {client.goals.map((goal) => (
                <div className="portal-goal" key={goal.title}>
                  <Target size={15} />
                  <p>
                    <strong>{goal.title}</strong>
                    <span>
                      <i style={{ width: `${goal.progress}%` }} />
                    </span>
                  </p>
                </div>
              ))}
              <h3>Shared resources</h3>
              <button className="portal-resource">
                <FileText size={16} />
                <span>
                  <strong>Weekly reflection guide</strong>
                  <small>PDF · Shared by your coach</small>
                </span>
              </button>
            </aside>
          </div>
        </main>
        <footer>
          <LockKeyhole size={12} />
          Only information intentionally shared with the client appears here.
        </footer>
      </div>
    </div>
  );
}
