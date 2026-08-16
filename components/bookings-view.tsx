"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  GripVertical,
  Link2,
  MapPin,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  BookingPage,
  BookingQuestion,
  BookingRequest,
} from "@/lib/supabase/practice-data";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
];

const COLORS = ["#2f6fed", "#347a5f", "#2563a8", "#a65f44", "#a24f72"];

const NOTICE_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 2, label: "2 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
  { value: 72, label: "3 days" },
];

type Preset = {
  id: string;
  label: string;
  blurb: string;
  durationMinutes: number;
  title: string;
  description: string;
  questionLabel: string | null;
  questionRequired: boolean;
};

const PRESETS: Preset[] = [
  {
    id: "discovery",
    label: "Discovery call",
    blurb: "A short, no-pressure intro for people considering working with you.",
    durationMinutes: 20,
    title: "Let’s explore working together",
    description:
      "Choose a time for a relaxed, no-pressure conversation about what you’re working toward.",
    questionLabel: "What would make this conversation valuable for you?",
    questionRequired: true,
  },
  {
    id: "session",
    label: "Ongoing session",
    blurb: "A regular coaching session for people you already work with.",
    durationMinutes: 50,
    title: "Book your next session",
    description:
      "Pick a time that works for you and we’ll pick up where we left off.",
    questionLabel: "Anything you’d like to focus on this time?",
    questionRequired: false,
  },
  {
    id: "consult",
    label: "Focused consult",
    blurb: "A longer, deeper session on one specific challenge.",
    durationMinutes: 60,
    title: "Book a focused consult",
    description:
      "A dedicated deep-dive on the challenge you’re facing right now.",
    questionLabel: "What challenge would you like to work through?",
    questionRequired: true,
  },
  {
    id: "blank",
    label: "Start from scratch",
    blurb: "Set everything up yourself.",
    durationMinutes: 30,
    title: "",
    description: "",
    questionLabel: null,
    questionRequired: false,
  },
];

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54);
}

function locationLabel(type: BookingPage["locationType"]) {
  return type === "phone" ? "Phone" : type === "zoom" ? "Zoom" : "Google Meet";
}

function timezoneLabel(timezone: string | null) {
  if (!timezone) return null;
  return timezone.replaceAll("_", " ").split("/").at(-1) || timezone;
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Next `count` calendar days that fall on one of the selected weekdays. */
function upcomingDays(days: number[], count: number) {
  const result: Date[] = [];
  if (!days.length) return result;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 60 && result.length < count; offset += 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + offset);
    if (days.includes(candidate.getDay())) result.push(candidate);
  }
  return result;
}

/** Slot start times implied by the availability window and call length. */
function slotTimes(
  availability: BookingPage["availability"],
  durationMinutes: number,
  limit: number,
) {
  const start = minutesFromTime(availability.start);
  const end = minutesFromTime(availability.end);
  const result: string[] = [];
  for (
    let cursor = start;
    cursor + durationMinutes <= end && result.length < limit;
    cursor += durationMinutes
  ) {
    result.push(formatMinutes(cursor));
  }
  return result;
}

function defaultPage(
  brandName: string,
  colorIndex: number,
  preset: Preset,
): Omit<BookingPage, "id"> {
  return {
    slug: makeSlug(preset.title || preset.label),
    brandName,
    title: preset.title,
    description: preset.description,
    accentColor: COLORS[colorIndex % COLORS.length],
    durationMinutes: preset.durationMinutes,
    locationType: "zoom",
    availability: { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
    minimumNoticeHours: 24,
    active: true,
    questions: preset.questionLabel
      ? [
          {
            id: crypto.randomUUID(),
            label: preset.questionLabel,
            type: "long_text",
            required: preset.questionRequired,
            options: [],
          },
        ]
      : [],
  };
}

export function BookingsView({
  userName,
  organizationSlug,
  organizationTimezone,
  bookingPages,
  requests,
  onSave,
  onDelete,
  onCancelRequest,
  onToast,
}: {
  userName: string;
  organizationSlug: string | null;
  organizationTimezone: string | null;
  bookingPages: BookingPage[];
  requests: BookingRequest[];
  onSave: (page: Omit<BookingPage, "id">, pageId?: string) => Promise<void>;
  onDelete: (pageId: string) => Promise<void>;
  onCancelRequest: (requestId: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editingPage = editingId
    ? bookingPages.find((page) => page.id === editingId) || null
    : null;

  if (creating) {
    return (
      <CreateBookingFlow
        userName={userName}
        organizationSlug={organizationSlug}
        organizationTimezone={organizationTimezone}
        seedColorIndex={bookingPages.length}
        onCancel={() => setCreating(false)}
        onPublish={async (page) => {
          await onSave(page);
          setCreating(false);
          onToast("Booking type published");
        }}
      />
    );
  }

  if (editingPage) {
    return (
      <BookingTypeEditor
        organizationSlug={organizationSlug}
        organizationTimezone={organizationTimezone}
        page={editingPage}
        onBack={() => setEditingId(null)}
        onSave={async (page) => {
          await onSave(page, editingPage.id);
          onToast("Booking type updated");
        }}
        onDelete={async () => {
          await onDelete(editingPage.id);
          setEditingId(null);
          onToast("Booking type deleted");
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <BookingsOverview
      organizationSlug={organizationSlug}
      bookingPages={bookingPages}
      requests={requests}
      onEdit={setEditingId}
      onCreate={() => setCreating(true)}
      onCancelRequest={onCancelRequest}
      onToast={onToast}
    />
  );
}

function BookingsOverview({
  organizationSlug,
  bookingPages,
  requests,
  onEdit,
  onCreate,
  onCancelRequest,
  onToast,
}: {
  organizationSlug: string | null;
  bookingPages: BookingPage[];
  requests: BookingRequest[];
  onEdit: (pageId: string) => void;
  onCreate: () => void;
  onCancelRequest: (requestId: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<"types" | "upcoming">("types");
  const [loadedAt] = useState(() => Date.now());
  const origin = useOrigin();
  const activeSlug = organizationSlug || "your-practice";
  const practiceUrl = `${origin.replace(/^https?:\/\//, "")}/${activeSlug}`;

  const upcoming = useMemo(
    () =>
      requests
        .filter(
          (request) =>
            request.status !== "cancelled" &&
            new Date(request.startsAt).getTime() >= loadedAt,
        )
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
    [requests, loadedAt],
  );

  const upcomingCountByPage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of upcoming)
      counts.set(
        request.bookingPageId,
        (counts.get(request.bookingPageId) || 0) + 1,
      );
    return counts;
  }, [upcoming]);

  return (
    <div className="bookings-page page-enter">
      <div className="page-heading booking-heading">
        <div>
          <p className="eyebrow">CONSULTATION BOOKINGS</p>
          <h1>Bookings</h1>
          <p>
            Give every kind of conversation its own page and link, and see who
            has booked time with you.
          </p>
        </div>
        <div className="heading-actions">
          <Button onClick={onCreate}>
            <Plus size={14} /> New booking type
          </Button>
        </div>
      </div>

      <div className="segmented-tabs">
        <button
          className={cn(tab === "types" && "active")}
          onClick={() => setTab("types")}
        >
          Booking types <span>{bookingPages.length}</span>
        </button>
        <button
          className={cn(tab === "upcoming" && "active")}
          onClick={() => setTab("upcoming")}
        >
          Upcoming <span>{upcoming.length}</span>
        </button>
      </div>

      {tab === "types" ? (
        <>
          <div className="booking-link-strip">
            <span className="booking-link-icon">
              <Link2 size={17} />
            </span>
            <div className="booking-link-copy">
              <small>Your practice URL</small>
              <strong>{practiceUrl}</strong>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/${activeSlug}`,
                );
                onToast("Practice URL copied");
              }}
            >
              <Copy size={13} /> Copy
            </Button>
          </div>

          {bookingPages.length ? (
            <div className="booking-type-grid">
              {bookingPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="panel booking-type-card"
                  onClick={() => onEdit(page.id)}
                >
                  <div className="booking-type-card-top">
                    <span
                      className="booking-type-avatar"
                      style={{ background: page.accentColor }}
                    >
                      {page.brandName.charAt(0).toUpperCase() || "?"}
                    </span>
                    <Badge variant={page.active ? "success" : "neutral"}>
                      {page.active ? "Live" : "Paused"}
                    </Badge>
                  </div>
                  <h3>{page.title || "Untitled booking type"}</h3>
                  <p className="booking-type-brand">{page.brandName}</p>
                  <div className="booking-type-meta">
                    <span>
                      <Clock3 size={12} /> {page.durationMinutes} min
                    </span>
                    <span>
                      <MapPin size={12} /> {locationLabel(page.locationType)}
                    </span>
                  </div>
                  <div className="booking-type-footer">
                    <span className="booking-type-link">
                      /{activeSlug}/{page.slug}
                    </span>
                    <span className="booking-type-count">
                      {upcomingCountByPage.get(page.id) || 0} upcoming
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel empty-state">
              <span>
                <CalendarCheck2 size={22} />
              </span>
              <h3>Create your first booking type</h3>
              <p>
                Discovery calls, ongoing sessions, focused consults — each gets
                its own page and link.
              </p>
              <Button onClick={onCreate}>
                <Plus size={14} /> New booking type
              </Button>
            </div>
          )}
        </>
      ) : (
        <UpcomingConsultations
          bookingPages={bookingPages}
          upcoming={upcoming}
          onCancelRequest={onCancelRequest}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function UpcomingConsultations({
  bookingPages,
  upcoming,
  onCancelRequest,
  onToast,
}: {
  bookingPages: BookingPage[];
  upcoming: BookingRequest[];
  onCancelRequest: (requestId: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<BookingRequest | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);

  if (!upcoming.length)
    return (
      <div className="panel empty-state">
        <span>
          <CalendarCheck2 size={22} />
        </span>
        <h3>No consultations booked yet</h3>
        <p>Share one of your booking links and new bookings will appear here.</p>
      </div>
    );

  return (
    <>
      <div className="consultation-list">
        {upcoming.map((request) => {
          const page = bookingPages.find(
            (item) => item.id === request.bookingPageId,
          );
          const starts = new Date(request.startsAt);
          const expanded = expandedId === request.id;
          const answers =
            request.answers &&
            typeof request.answers === "object" &&
            !Array.isArray(request.answers)
              ? (request.answers as Record<string, unknown>)
              : {};
          const answered = page
            ? page.questions
                .map((question) => ({
                  label: question.label,
                  value: String(answers[question.id] ?? "").trim(),
                }))
                .filter((entry) => entry.value)
            : [];

          return (
            <div
              className={cn("panel consultation-row", expanded && "expanded")}
              key={request.id}
            >
              <div className="consultation-main">
                <span className="request-date-tile">
                  <small>
                    {starts.toLocaleDateString("en-US", { month: "short" })}
                  </small>
                  <strong>{starts.getDate()}</strong>
                </span>
                <div className="consultation-copy">
                  <strong>{request.guestName}</strong>
                  <span>
                    {starts.toLocaleDateString("en-US", {
                      weekday: "long",
                    })}{" "}
                    ·{" "}
                    {starts.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {page ? ` · ${page.durationMinutes} min` : ""}
                  </span>
                  <small>{request.guestEmail}</small>
                </div>
                {page ? (
                  <span
                    className="consultation-type"
                    style={{ background: page.accentColor }}
                  >
                    {page.title || page.brandName}
                  </span>
                ) : null}
                <button
                  className="consultation-expand"
                  onClick={() => setExpandedId(expanded ? null : request.id)}
                  aria-expanded={expanded}
                  aria-label={
                    expanded
                      ? `Hide details for ${request.guestName}`
                      : `Show details for ${request.guestName}`
                  }
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              {expanded ? (
                <div className="consultation-detail">
                  {answered.length ? (
                    answered.map((entry) => (
                      <div key={entry.label}>
                        <small>{entry.label}</small>
                        <p>{entry.value}</p>
                      </div>
                    ))
                  ) : (
                    <p className="consultation-noanswers">
                      No intake answers were submitted.
                    </p>
                  )}
                  <div className="consultation-actions">
                    {request.guestPhone ? (
                      <span>{request.guestPhone}</span>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingCancel(request)}
                    >
                      <Trash2 size={13} /> Cancel consultation
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {pendingCancel ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPendingCancel(null)
          }
        >
          <div className="workflow-modal integration-disconnect-modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">CANCEL CONSULTATION</p>
                <h2>Cancel {pendingCancel.guestName}’s booking?</h2>
              </div>
              <button
                onClick={() => setPendingCancel(null)}
                aria-label="Close cancellation confirmation"
              >
                <X size={18} />
              </button>
            </div>
            <p className="modal-copy">
              This frees up{" "}
              {new Date(pendingCancel.startsAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              at{" "}
              {new Date(pendingCancel.startsAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              . {pendingCancel.guestName} will not be notified automatically —
              reach out at {pendingCancel.guestEmail} to let them know.
            </p>
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setPendingCancel(null)}>
                Keep booking
              </Button>
              <Button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await onCancelRequest(pendingCancel.id);
                    onToast("Consultation cancelled");
                    setPendingCancel(null);
                  } catch (error) {
                    onToast(
                      error instanceof Error
                        ? error.message
                        : "Could not cancel the consultation",
                    );
                  } finally {
                    setCancelling(false);
                  }
                }}
              >
                {cancelling ? "Cancelling…" : "Cancel consultation"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CreateBookingFlow({
  userName,
  organizationSlug,
  organizationTimezone,
  seedColorIndex,
  onCancel,
  onPublish,
}: {
  userName: string;
  organizationSlug: string | null;
  organizationTimezone: string | null;
  seedColorIndex: number;
  onCancel: () => void;
  onPublish: (page: Omit<BookingPage, "id">) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<BookingPage, "id"> | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSlug = organizationSlug || "your-practice";
  const zone = timezoneLabel(organizationTimezone);

  const update = <Key extends keyof Omit<BookingPage, "id">>(
    key: Key,
    value: Omit<BookingPage, "id">[Key],
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const choosePreset = (preset: Preset) => {
    setPresetId(preset.id);
    setDraft(defaultPage(userName, seedColorIndex, preset));
    setStep(1);
  };

  const publish = async () => {
    if (!draft) return;
    setError(null);
    if (!draft.title.trim()) {
      setError("Give this booking type a name.");
      return;
    }
    if (!draft.availability.days.length) {
      setError("Select at least one day you’re available.");
      return;
    }
    if (
      minutesFromTime(draft.availability.end) -
        minutesFromTime(draft.availability.start) <
      draft.durationMinutes
    ) {
      setError("Your available window is shorter than the call length.");
      return;
    }
    setPublishing(true);
    try {
      await onPublish({ ...draft, slug: draft.slug || makeSlug(draft.title) });
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "The booking type could not be published.",
      );
      setPublishing(false);
    }
  };

  return (
    <div className="bookings-page page-enter">
      <button className="back-link" onClick={onCancel} type="button">
        <ArrowLeft size={14} /> All booking types
      </button>

      <div className="wizard-shell">
        <div className="wizard-progress">
          {["Kind of call", "The basics", "Availability"].map(
            (label, index) => (
              <div
                key={label}
                className={cn(
                  "wizard-step",
                  index === step && "current",
                  index < step && "done",
                )}
              >
                <span>{index < step ? <Check size={12} /> : index + 1}</span>
                <small>{label}</small>
              </div>
            ),
          )}
        </div>

        {step === 0 ? (
          <section className="wizard-panel">
            <h2>What kind of call is this?</h2>
            <p className="wizard-subtitle">
              We’ll set sensible defaults — you can change everything later.
            </p>
            <div className="preset-grid">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={cn(
                    "preset-card",
                    presetId === preset.id && "selected",
                  )}
                  onClick={() => choosePreset(preset)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.blurb}</span>
                  {preset.id !== "blank" ? (
                    <small>{preset.durationMinutes} min</small>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 1 && draft ? (
          <section className="wizard-panel">
            <h2>The basics</h2>
            <p className="wizard-subtitle">
              What people will see, how long you’ll talk, and where.
            </p>
            <div className="wizard-fields">
              <label className="booking-field-wide">
                What should we call it?
                <input
                  value={draft.title}
                  placeholder="Discovery call"
                  onChange={(event) => {
                    const title = event.target.value;
                    setDraft((current) =>
                      current
                        ? { ...current, title, slug: makeSlug(title) }
                        : current,
                    );
                  }}
                />
                <small className="field-hint">
                  /{activeSlug}/{draft.slug || "your-link"}
                </small>
              </label>
              <label>
                Call length
                <select
                  value={draft.durationMinutes}
                  onChange={(event) =>
                    update("durationMinutes", Number(event.target.value))
                  }
                >
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={50}>50 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
              <label>
                Where does it happen?
                <select
                  value={draft.locationType}
                  onChange={(event) =>
                    update(
                      "locationType",
                      event.target.value as BookingPage["locationType"],
                    )
                  }
                >
                  <option value="zoom">Zoom</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="phone">Phone call</option>
                </select>
              </label>
            </div>
            <div className="wizard-actions">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft size={14} /> Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!draft.title.trim()}
              >
                Continue <ArrowRight size={14} />
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 && draft ? (
          <section className="wizard-panel">
            <h2>When are you available?</h2>
            <p className="wizard-subtitle">
              A simple weekly window to start with
              {zone ? `, in ${zone} time` : ""}. You can refine it later.
            </p>
            <div className="day-picker wizard-days">
              {DAYS.map((day) => {
                const selected = draft.availability.days.includes(day.value);
                return (
                  <button
                    key={day.label}
                    type="button"
                    className={cn(selected && "selected")}
                    onClick={() =>
                      update("availability", {
                        ...draft.availability,
                        days: selected
                          ? draft.availability.days.filter(
                              (value) => value !== day.value,
                            )
                          : [...draft.availability.days, day.value],
                      })
                    }
                    aria-label={day.label}
                    aria-pressed={selected}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            <div className="wizard-fields">
              <label>
                From
                <input
                  type="time"
                  value={draft.availability.start}
                  onChange={(event) =>
                    update("availability", {
                      ...draft.availability,
                      start: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Until
                <input
                  type="time"
                  value={draft.availability.end}
                  onChange={(event) =>
                    update("availability", {
                      ...draft.availability,
                      end: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            {error ? (
              <div className="data-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="wizard-actions">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft size={14} /> Back
              </Button>
              <Button onClick={publish} disabled={publishing}>
                <Sparkles size={14} />
                {publishing ? "Publishing…" : "Publish booking page"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

type EditorTab = "setup" | "questions" | "appearance";

function BookingTypeEditor({
  organizationSlug,
  organizationTimezone,
  page,
  onBack,
  onSave,
  onDelete,
  onToast,
}: {
  organizationSlug: string | null;
  organizationTimezone: string | null;
  page: BookingPage;
  onBack: () => void;
  onSave: (page: Omit<BookingPage, "id">) => Promise<void>;
  onDelete: () => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<EditorTab>("setup");
  const [draft, setDraft] = useState<Omit<BookingPage, "id">>(() => ({
    ...page,
  }));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSlug = organizationSlug || "your-practice";
  const zone = timezoneLabel(organizationTimezone);
  const origin = useOrigin();
  const bookingPath = `/${activeSlug}/${draft.slug}`;
  const displayUrl = `${origin.replace(/^https?:\/\//, "")}${bookingPath}`;

  const update = <Key extends keyof Omit<BookingPage, "id">>(
    key: Key,
    value: Omit<BookingPage, "id">[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!draft.slug || !draft.brandName.trim() || !draft.title.trim())
        throw new Error("Add a brand name, headline, and booking-link name.");
      if (!draft.availability.days.length)
        throw new Error("Select at least one available day.");
      await onSave(draft);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The booking type could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () =>
    update("questions", [
      ...draft.questions,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "long_text",
        required: false,
        options: [],
      },
    ]);

  const updateQuestion = (id: string, changes: Partial<BookingQuestion>) =>
    update(
      "questions",
      draft.questions.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    );

  return (
    <div className="bookings-page page-enter">
      <button className="back-link" onClick={onBack} type="button">
        <ArrowLeft size={14} /> All booking types
      </button>

      <div className="page-heading booking-heading">
        <div>
          <p className="eyebrow">EDIT BOOKING TYPE</p>
          <h1>{draft.title || "Booking type"}</h1>
          <p>
            {draft.durationMinutes} min · {locationLabel(draft.locationType)}
            {zone ? ` · ${zone} time` : ""}
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `${window.location.origin}${bookingPath}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <ExternalLink size={14} /> View live page
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="booking-link-strip">
        <span className="booking-link-icon">
          <Link2 size={17} />
        </span>
        <div className="booking-link-copy">
          <small>Booking link</small>
          <strong>{displayUrl}</strong>
        </div>
        <Badge variant={draft.active ? "success" : "neutral"}>
          {draft.active ? "Live" : "Paused"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update("active", !draft.active)}
        >
          {draft.active ? "Pause" : "Resume"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(
              `${window.location.origin}${bookingPath}`,
            );
            onToast("Booking link copied");
          }}
        >
          <Copy size={13} /> Copy
        </Button>
      </div>

      {error ? (
        <div className="data-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="segmented-tabs">
        <button
          className={cn(tab === "setup" && "active")}
          onClick={() => setTab("setup")}
        >
          <Clock3 size={13} /> Setup
        </button>
        <button
          className={cn(tab === "questions" && "active")}
          onClick={() => setTab("questions")}
        >
          <UserRound size={13} /> Questions <span>{draft.questions.length}</span>
        </button>
        <button
          className={cn(tab === "appearance" && "active")}
          onClick={() => setTab("appearance")}
        >
          <Palette size={13} /> Appearance
        </button>
      </div>

      {tab === "setup" ? (
        <section className="panel booking-settings-card">
          <div className="booking-section-heading">
            <span>
              <Clock3 size={16} />
            </span>
            <div>
              <h2>Availability</h2>
              <p>
                {zone
                  ? `Times are in your practice timezone (${zone}). Visitors see them converted to their own.`
                  : "Visitors see these times converted to their own timezone."}
              </p>
            </div>
          </div>
          <div className="day-picker">
            {DAYS.map((day) => {
              const selected = draft.availability.days.includes(day.value);
              return (
                <button
                  key={day.label}
                  type="button"
                  className={cn(selected && "selected")}
                  onClick={() =>
                    update("availability", {
                      ...draft.availability,
                      days: selected
                        ? draft.availability.days.filter(
                            (value) => value !== day.value,
                          )
                        : [...draft.availability.days, day.value],
                    })
                  }
                  aria-label={day.label}
                  aria-pressed={selected}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          <div className="booking-form-grid booking-schedule-fields">
            <label>
              From
              <input
                type="time"
                value={draft.availability.start}
                onChange={(event) =>
                  update("availability", {
                    ...draft.availability,
                    start: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Until
              <input
                type="time"
                value={draft.availability.end}
                onChange={(event) =>
                  update("availability", {
                    ...draft.availability,
                    end: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Call length
              <select
                value={draft.durationMinutes}
                onChange={(event) =>
                  update("durationMinutes", Number(event.target.value))
                }
              >
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={50}>50 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </label>
            <label>
              Meeting
              <select
                value={draft.locationType}
                onChange={(event) =>
                  update(
                    "locationType",
                    event.target.value as BookingPage["locationType"],
                  )
                }
              >
                <option value="zoom">Zoom</option>
                <option value="google_meet">Google Meet</option>
                <option value="phone">Phone call</option>
              </select>
            </label>
            <label>
              Shortest notice
              <select
                value={draft.minimumNoticeHours}
                onChange={(event) =>
                  update("minimumNoticeHours", Number(event.target.value))
                }
              >
                {NOTICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small className="field-hint">
                How far ahead someone must book.
              </small>
            </label>
            <label>
              Booking link
              <div className="slug-field">
                <span>/{activeSlug}/</span>
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    update("slug", makeSlug(event.target.value))
                  }
                />
              </div>
            </label>
          </div>
        </section>
      ) : null}

      {tab === "questions" ? (
        <section className="panel booking-settings-card">
          <div className="booking-section-heading questionnaire-heading">
            <span>
              <UserRound size={16} />
            </span>
            <div>
              <h2>Intake questionnaire</h2>
              <p>Ask only what helps you prepare for a useful conversation.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus size={13} /> Add question
            </Button>
          </div>
          <div className="question-list">
            {draft.questions.map((question, index) => (
              <div className="question-row" key={question.id}>
                <GripVertical size={15} className="question-grip" />
                <span className="question-number">{index + 1}</span>
                <div className="question-fields">
                  <input
                    value={question.label}
                    placeholder="What would you like to ask?"
                    onChange={(event) =>
                      updateQuestion(question.id, { label: event.target.value })
                    }
                  />
                  <div>
                    <select
                      value={question.type}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          type: event.target.value as BookingQuestion["type"],
                        })
                      }
                    >
                      <option value="short_text">Short answer</option>
                      <option value="long_text">Long answer</option>
                      <option value="select">Multiple choice</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    <label className="required-toggle">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            required: event.target.checked,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>
                  {question.type === "select" ? (
                    <input
                      className="question-options"
                      value={question.options.join(", ")}
                      placeholder="Choices separated by commas"
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          options: event.target.value
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  className="question-delete"
                  onClick={() =>
                    update(
                      "questions",
                      draft.questions.filter((item) => item.id !== question.id),
                    )
                  }
                  aria-label="Remove question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!draft.questions.length ? (
              <button className="question-empty" onClick={addQuestion}>
                <Plus size={15} /> Add your first intake question
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "appearance" ? (
        <div className="booking-builder-grid">
          <section className="panel booking-settings-card">
            <div className="booking-section-heading">
              <span>
                <Sparkles size={16} />
              </span>
              <div>
                <h2>Brand & welcome</h2>
                <p>Make the first touchpoint feel unmistakably yours.</p>
              </div>
            </div>
            <div className="booking-form-grid">
              <label className="booking-field-wide">
                Brand name
                <input
                  value={draft.brandName}
                  onChange={(event) => update("brandName", event.target.value)}
                />
              </label>
              <label className="booking-field-wide">
                Headline
                <input
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </label>
              <label className="booking-field-wide">
                Welcome message
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                />
              </label>
            </div>
            <div className="brand-color-row">
              <div>
                <strong>Accent color</strong>
                <span>Used for buttons, selections, and highlights.</span>
              </div>
              <div className="color-swatches" aria-label="Accent color">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(draft.accentColor === color && "selected")}
                    style={{ background: color }}
                    onClick={() => update("accentColor", color)}
                    aria-label={`Use ${color}`}
                  >
                    {draft.accentColor === color ? <Check size={13} /> : null}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="booking-preview-column">
            <div className="booking-preview-label">
              <span>Live preview</span>
              <small>Updates as you edit</small>
            </div>
            <BookingPagePreview draft={draft} />
          </aside>
        </div>
      ) : null}

      <div className="editor-danger-row">
        <Button variant="outline" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} /> Delete booking type
        </Button>
      </div>

      {confirmDelete ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setConfirmDelete(false)
          }
        >
          <div className="workflow-modal integration-disconnect-modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">DELETE BOOKING TYPE</p>
                <h2>Delete “{draft.title || "this booking type"}”?</h2>
              </div>
              <button
                onClick={() => setConfirmDelete(false)}
                aria-label="Close delete confirmation"
              >
                <X size={18} />
              </button>
            </div>
            <p className="modal-copy">
              The booking link will stop working immediately. Consultations
              already booked through it stay in your calendar.
            </p>
            <div className="modal-actions">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete();
                  } catch (deleteError) {
                    setError(
                      deleteError instanceof Error
                        ? deleteError.message
                        : "The booking type could not be deleted.",
                    );
                    setDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BookingPagePreview({ draft }: { draft: Omit<BookingPage, "id"> }) {
  const days = upcomingDays(draft.availability.days, 5);
  const times = slotTimes(draft.availability, draft.durationMinutes, 3);

  return (
    <div
      className="booking-page-preview"
      style={{ "--booking-accent": draft.accentColor } as CSSProperties}
    >
      <div className="preview-brand-mark">
        {draft.brandName.charAt(0).toUpperCase()}
      </div>
      <small>{draft.brandName}</small>
      <h2>{draft.title || "Your consultation headline"}</h2>
      <p>{draft.description || "Add a short, welcoming introduction."}</p>
      <div className="preview-meta">
        <span>
          <Clock3 size={13} /> {draft.durationMinutes} min
        </span>
        <span>
          <MapPin size={13} /> {locationLabel(draft.locationType)}
        </span>
      </div>
      <div className="preview-calendar-head">
        <strong>Choose a day</strong>
      </div>
      {days.length ? (
        <div className="preview-days">
          {days.map((day, index) => (
            <button key={day.toISOString()} className={index === 0 ? "selected" : ""}>
              <small>
                {day
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </small>
              <strong>{day.getDate()}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p className="preview-empty">Select at least one available day.</p>
      )}
      {times.length ? (
        times.map((time) => (
          <button className="preview-time" key={time}>
            {time} <ArrowUpRight size={14} />
          </button>
        ))
      ) : (
        <p className="preview-empty">
          Your window is shorter than the call length.
        </p>
      )}
    </div>
  );
}
