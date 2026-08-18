"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { AvailabilityEditor } from "@/components/availability-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  bookingDayKey,
  defaultBookingAvailability,
  describeAvailabilityProblem,
  formatBookingTime,
  windowSlotMinutes,
  type BookingAvailability,
} from "@/lib/booking-availability";
import type {
  BookingLocationType,
  BookingPage,
  BookingQuestion,
  BookingRequest,
} from "@/lib/supabase/practice-data";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";

const COLORS = ["#2f6fed", "#347a5f", "#2563a8", "#a65f44", "#a24f72"];

/** Common call lengths. Any whole number of minutes from 5 to 480 is allowed —
 * see the "Custom" branch in `DurationField`. */
const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];
const MIN_DURATION = 5;
const MAX_DURATION = 480;

const LOCATION_OPTIONS: { value: BookingLocationType; label: string }[] = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "phone", label: "Phone call" },
  { value: "in_person", label: "In person" },
];

const NOTICE_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 2, label: "2 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "1 day" },
  { value: 48, label: "2 days" },
  { value: 72, label: "3 days" },
];

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54);
}

function locationLabel(type: BookingLocationType) {
  return (
    LOCATION_OPTIONS.find((option) => option.value === type)?.label ||
    "Google Meet"
  );
}

function timezoneLabel(timezone: string | null) {
  if (!timezone) return null;
  return timezone.replaceAll("_", " ").split("/").at(-1) || timezone;
}

/** Next `count` calendar days that have at least one availability window. */
function upcomingDays(availability: BookingAvailability, count: number) {
  const result: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 60 && result.length < count; offset += 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + offset);
    const key = bookingDayKey(candidate.getDay());
    if (key && availability.windows[key].length) result.push(candidate);
  }
  return result;
}

/**
 * Slot start labels for one calendar day, re-anchored per window so the preview
 * shows the same grid `booking_page_slots` will generate on the live page.
 */
function slotTimesForDay(
  availability: BookingAvailability,
  durationMinutes: number,
  day: Date,
  limit: number,
) {
  const key = bookingDayKey(day.getDay());
  if (!key) return [];
  return availability.windows[key]
    .flatMap((window) => windowSlotMinutes(window, durationMinutes))
    .slice(0, limit)
    .map((minutes) =>
      formatBookingTime(
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
          minutes % 60,
        ).padStart(2, "0")}`,
      ),
    );
}

/**
 * Drops blank multiple-choice options before a question list is sent to the
 * server. An empty-string option isn't just untidy — Radix `Select.Item`
 * reserves "" for clearing the selection, so one would break the public
 * form's dropdown rather than merely showing an unlabeled row.
 */
function sanitizeQuestions(questions: BookingQuestion[]): BookingQuestion[] {
  return questions.map((question) =>
    question.type === "select"
      ? {
          ...question,
          options: question.options
            .map((option) => option.trim())
            .filter(Boolean),
        }
      : question,
  );
}

/** A multiple-choice question needs at least two real choices to make sense. */
function describeQuestionsProblem(questions: BookingQuestion[]): string | null {
  const tooFewChoices = questions.find(
    (question) =>
      question.type === "select" &&
      question.label.trim() &&
      question.options.filter((option) => option.trim()).length < 2,
  );
  if (tooFewChoices)
    return `Add at least two choices for "${tooFewChoices.label.trim()}".`;
  return null;
}

function defaultPage(
  brandName: string,
  colorIndex: number,
): Omit<BookingPage, "id"> {
  return {
    slug: "",
    brandName,
    title: "",
    description: "",
    accentColor: COLORS[colorIndex % COLORS.length],
    durationMinutes: 30,
    locationType: "zoom",
    locationDetails: "",
    availability: defaultBookingAvailability(),
    minimumNoticeHours: 24,
    active: true,
    questions: [],
  };
}

/**
 * Call length as a preset dropdown that falls back to a free-form number, so
 * the common cases stay one click but any length from 5 to 480 minutes is
 * reachable. `custom` is tracked separately from the value so the input stays
 * open while the coach is mid-edit on a number that happens to be a preset.
 */
function DurationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [custom, setCustom] = useState(() => !DURATION_PRESETS.includes(value));
  const selectId = useId();

  return (
    <div className="booking-field-stack">
      <Label htmlFor={selectId}>Call length</Label>
      <Select
        value={custom ? "custom" : String(value)}
        onValueChange={(next) => {
          if (next === "custom") {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(Number(next));
        }}
      >
        <SelectTrigger id={selectId} className="h-[37px] w-full">
          <SelectValue>{`${value} minutes`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DURATION_PRESETS.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {minutes} minutes
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {custom ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={5}
            value={value}
            aria-label="Call length in minutes"
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(next);
            }}
            onBlur={(event) => {
              const next = Number(event.target.value);
              onChange(
                Math.min(
                  MAX_DURATION,
                  Math.max(MIN_DURATION, Number.isFinite(next) ? next : 30),
                ),
              );
            }}
          />
          <span className="text-xs text-muted-foreground">minutes</span>
        </div>
      ) : null}
    </div>
  );
}

/** Meeting location, plus the address field in-person sessions need. */
function LocationFields({
  locationType,
  locationDetails,
  onChangeType,
  onChangeDetails,
}: {
  locationType: BookingLocationType;
  locationDetails: string;
  onChangeType: (type: BookingLocationType) => void;
  onChangeDetails: (details: string) => void;
}) {
  return (
    <>
      <Label>
        Where does it happen?
        <Select
          value={locationType}
          onValueChange={(value) => onChangeType(value as BookingLocationType)}
        >
          <SelectTrigger className="h-[37px] w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      {locationType === "in_person" ? (
        <Label className="booking-field-wide">
          Address
          <Input
            value={locationDetails}
            placeholder="12 Bridge Street, Suite 4, Portland"
            onChange={(event) => onChangeDetails(event.target.value)}
          />
          <small className="field-hint">
            Shown to guests once they book, and on the confirmation screen.
          </small>
        </Label>
      ) : null}
    </>
  );
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
  const activeSlug = organizationSlug || "your-practice";

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

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "types" | "upcoming")}
      >
        <TabsList variant="line">
          <TabsTrigger value="types">
            Booking types
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-normal text-muted-foreground">
              {bookingPages.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-normal text-muted-foreground">
              {upcoming.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-3.5">
          {bookingPages.length ? (
            <div className="booking-type-grid">
              {bookingPages.map((page) => (
                <Card
                  key={page.id}
                  className="gap-0 py-0 transition-shadow hover:ring-foreground/20"
                >
                  <CardContent className="px-0">
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-2 p-4 text-left"
                      onClick={() => onEdit(page.id)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <Avatar
                          initials={
                            page.brandName.charAt(0).toUpperCase() || "?"
                          }
                          color={page.accentColor}
                          shape="square"
                        />
                        <Badge variant={page.active ? "success" : "neutral"}>
                          {page.active ? "Live" : "Paused"}
                        </Badge>
                      </div>
                      <h3 className="font-heading text-[15px] leading-snug font-medium">
                        {page.title || "Untitled booking type"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {page.brandName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={12} /> {page.durationMinutes} min
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={12} /> {locationLabel(page.locationType)}
                        </span>
                      </div>
                    </button>
                  </CardContent>
                  <CardFooter className="gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="truncate font-medium">
                      /{activeSlug}/{page.slug}
                    </span>
                    <span className="ml-auto shrink-0">
                      {upcomingCountByPage.get(page.id) || 0} upcoming
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Copy link for ${page.title || "booking type"}`}
                          onClick={async (event) => {
                            event.stopPropagation();
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/${activeSlug}/${page.slug}`,
                            );
                            onToast("Booking link copied");
                          }}
                        >
                          <Copy size={12} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy link</TooltipContent>
                    </Tooltip>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="items-center gap-2 py-10 text-center">
              <CardContent className="flex flex-col items-center gap-2">
                <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarCheck2 size={22} />
                </span>
                <h3 className="font-heading text-base font-medium">
                  Create your first booking type
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Discovery calls, ongoing sessions, focused consults — each gets
                  its own page and link.
                </p>
                <Button className="mt-2" onClick={onCreate}>
                  <Plus size={14} /> New booking type
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-3.5">
          <UpcomingConsultations
            bookingPages={bookingPages}
            upcoming={upcoming}
            onCancelRequest={onCancelRequest}
            onToast={onToast}
          />
        </TabsContent>
      </Tabs>
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
      <Card className="items-center gap-2 py-10 text-center">
        <CardContent className="flex flex-col items-center gap-2">
          <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarCheck2 size={22} />
          </span>
          <h3 className="font-heading text-base font-medium">
            No consultations booked yet
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Share one of your booking links and new bookings will appear here.
          </p>
        </CardContent>
      </Card>
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
            <Card
              size="sm"
              className={cn("consultation-row gap-0 p-0", expanded && "expanded")}
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
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!pendingCancel}
        onOpenChange={(open) => !open && setPendingCancel(null)}
      >
        <DialogContent className="workflow-modal integration-disconnect-modal">
          {pendingCancel && (
            <>
              <div className="modal-heading">
                <div>
                  <p className="eyebrow">CANCEL CONSULTATION</p>
                  <DialogTitle>
                    Cancel {pendingCancel.guestName}’s booking?
                  </DialogTitle>
                </div>
                <DialogClose asChild>
                  <button aria-label="Close cancellation confirmation">
                    <X size={18} />
                  </button>
                </DialogClose>
              </div>
              <DialogDescription className="modal-copy">
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
              </DialogDescription>
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
            </>
          )}
        </DialogContent>
      </Dialog>
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
  const [draft, setDraft] = useState<Omit<BookingPage, "id">>(() =>
    defaultPage(userName, seedColorIndex),
  );
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSlug = organizationSlug || "your-practice";
  const zone = timezoneLabel(organizationTimezone);

  const update = <Key extends keyof Omit<BookingPage, "id">>(
    key: Key,
    value: Omit<BookingPage, "id">[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const availabilityProblem = describeAvailabilityProblem(
    draft.availability,
    draft.durationMinutes,
  );

  const publish = async () => {
    setError(null);
    if (!draft.title.trim()) {
      setError("Give this booking type a name.");
      return;
    }
    if (availabilityProblem) {
      setError(availabilityProblem);
      return;
    }
    if (draft.locationType === "in_person" && !draft.locationDetails.trim()) {
      setError("Add the address for in-person sessions.");
      return;
    }
    const questionsProblem = describeQuestionsProblem(draft.questions);
    if (questionsProblem) {
      setError(questionsProblem);
      return;
    }
    setPublishing(true);
    try {
      await onPublish({
        ...draft,
        slug: draft.slug || makeSlug(draft.title),
        questions: sanitizeQuestions(draft.questions),
      });
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
          {["The basics", "Availability", "Questions", "Appearance"].map((label, index) => (
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
          ))}
        </div>

        {step === 0 ? (
          <section className="wizard-panel">
            <h2>The basics</h2>
            <p className="wizard-subtitle">
              What people will see, how long you’ll talk, and where.
            </p>
            <div className="wizard-fields">
              <Label className="booking-field-wide">
                What should we call it?
                <Input
                  value={draft.title}
                  placeholder="Discovery call"
                  onChange={(event) => {
                    const title = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      title,
                      slug: makeSlug(title),
                    }));
                  }}
                />
                <small className="field-hint">
                  /{activeSlug}/{draft.slug || "your-link"}
                </small>
              </Label>
              <DurationField
                value={draft.durationMinutes}
                onChange={(minutes) => update("durationMinutes", minutes)}
              />
              <LocationFields
                locationType={draft.locationType}
                locationDetails={draft.locationDetails}
                onChangeType={(type) => update("locationType", type)}
                onChangeDetails={(details) =>
                  update("locationDetails", details)
                }
              />
            </div>
            <div className="wizard-actions">
              <Button
                onClick={() => setStep(1)}
                disabled={!draft.title.trim()}
              >
                Continue <ArrowRight size={14} />
              </Button>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="wizard-panel">
            <h2>When are you available?</h2>
            <p className="wizard-subtitle">
              Add as many time slots per day as you need
              {zone ? `, in ${zone} time` : ""}.
            </p>
            <AvailabilityEditor
              availability={draft.availability}
              onChange={(next) => update("availability", next)}
            />
            {error ? (
              <div className="data-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="wizard-actions">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft size={14} /> Back
              </Button>
              <Button
                onClick={() => {
                  if (availabilityProblem) {
                    setError(availabilityProblem);
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
              >
                Continue <ArrowRight size={14} />
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="wizard-panel">
            <h2>Anything you want to know first?</h2>
            <p className="wizard-subtitle">
              Optional — ask only what helps you prepare. Skip this if you
              don’t need anything up front.
            </p>
            <QuestionsFields
              questions={draft.questions}
              onChange={(next) => update("questions", next)}
            />
            {error ? (
              <div className="data-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="wizard-actions">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft size={14} /> Back
              </Button>
              <Button
                onClick={() => {
                  const questionsProblem = describeQuestionsProblem(
                    draft.questions,
                  );
                  if (questionsProblem) {
                    setError(questionsProblem);
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
              >
                Continue <ArrowRight size={14} />
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="wizard-panel">
            <h2>Make it yours</h2>
            <p className="wizard-subtitle">
              This is what visitors see when they open your link.
            </p>
            <div className="booking-builder-grid">
              <div className="booking-settings-stack">
                <AppearanceFields
                  draft={draft}
                  onChange={(key, value) => update(key, value)}
                />
              </div>
              <aside className="booking-preview-column">
                <div className="booking-preview-label">
                  <span>Live preview</span>
                  <small>Updates as you edit</small>
                </div>
                <BookingPagePreview draft={draft} />
              </aside>
            </div>
            {error ? (
              <div className="data-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="wizard-actions">
              <Button variant="outline" onClick={() => setStep(2)}>
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

/**
 * Brand, headline, welcome copy and accent colour. Shared by the create
 * wizard's last step and the editor's Appearance tab so the two cannot drift.
 */
function AppearanceFields({
  draft,
  onChange,
}: {
  draft: Omit<BookingPage, "id">;
  onChange: <Key extends keyof Omit<BookingPage, "id">>(
    key: Key,
    value: Omit<BookingPage, "id">[Key],
  ) => void;
}) {
  return (
    <>
      <div className="booking-form-grid">
        <Label className="booking-field-wide">
          Brand name
          <Input
            value={draft.brandName}
            onChange={(event) => onChange("brandName", event.target.value)}
          />
        </Label>
        <Label className="booking-field-wide">
          Headline
          <Input
            value={draft.title}
            onChange={(event) => onChange("title", event.target.value)}
          />
        </Label>
        <Label className="booking-field-wide">
          Welcome message
          <Textarea
            rows={3}
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
          />
        </Label>
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
              onClick={() => onChange("accentColor", color)}
              aria-label={`Use ${color}`}
            >
              {draft.accentColor === color ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * One editable row per multiple-choice option, instead of a single
 * comma-separated field — commas typed into an option's own text (e.g.
 * "9am, meet in the lobby") used to silently split into extra choices.
 */
function QuestionOptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="question-options-list">
      {options.map((option, index) => (
        <div className="question-option-row" key={index}>
          <Input
            className="question-options"
            value={option}
            placeholder={`Option ${index + 1}`}
            onChange={(event) => {
              const next = [...options];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="question-option-remove"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
            aria-label={`Remove option ${index + 1}`}
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="question-option-add"
        onClick={() => onChange([...options, ""])}
      >
        <Plus size={12} /> Add option
      </button>
    </div>
  );
}

/**
 * The intake-question builder. Shared by the create wizard's Questions step
 * and the editor's Questions tab so the two implementations cannot diverge.
 */
function QuestionsFields({
  questions,
  onChange,
}: {
  questions: BookingQuestion[];
  onChange: (next: BookingQuestion[]) => void;
}) {
  const addQuestion = () =>
    onChange([
      ...questions,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "long_text",
        required: false,
        options: [],
      },
    ]);

  const updateQuestion = (id: string, changes: Partial<BookingQuestion>) =>
    onChange(
      questions.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    );

  return (
    <>
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
        {questions.map((question, index) => (
          <div className="question-row" key={question.id}>
            <GripVertical size={15} className="question-grip" />
            <span className="question-number">{index + 1}</span>
            <div className="question-fields">
              <Input
                value={question.label}
                placeholder="What would you like to ask?"
                onChange={(event) =>
                  updateQuestion(question.id, { label: event.target.value })
                }
              />
              <div>
                <Select
                  value={question.type}
                  onValueChange={(value) => {
                    const nextType = value as BookingQuestion["type"];
                    updateQuestion(question.id, {
                      type: nextType,
                      options:
                        nextType === "select" && !question.options.length
                          ? ["", ""]
                          : question.options,
                    });
                  }}
                >
                  <SelectTrigger className="h-[37px] w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short_text">Short answer</SelectItem>
                    <SelectItem value="long_text">Long answer</SelectItem>
                    <SelectItem value="select">Multiple choice</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="required-toggle">
                  <Checkbox
                    checked={question.required}
                    onCheckedChange={(checked) =>
                      updateQuestion(question.id, {
                        required: checked === true,
                      })
                    }
                  />
                  Required
                </Label>
              </div>
              {question.type === "select" ? (
                <QuestionOptionsEditor
                  options={question.options}
                  onChange={(options) =>
                    updateQuestion(question.id, { options })
                  }
                />
              ) : null}
            </div>
            <button
              type="button"
              className="question-delete"
              onClick={() =>
                onChange(questions.filter((item) => item.id !== question.id))
              }
              aria-label="Remove question"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!questions.length ? (
          <button className="question-empty" onClick={addQuestion}>
            <Plus size={15} /> Add your first intake question
          </button>
        ) : null}
      </div>
    </>
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
      const availabilityProblem = describeAvailabilityProblem(
        draft.availability,
        draft.durationMinutes,
      );
      if (availabilityProblem) throw new Error(availabilityProblem);
      if (draft.locationType === "in_person" && !draft.locationDetails.trim())
        throw new Error("Add the address for in-person sessions.");
      const questionsProblem = describeQuestionsProblem(draft.questions);
      if (questionsProblem) throw new Error(questionsProblem);
      await onSave({ ...draft, questions: sanitizeQuestions(draft.questions) });
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

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as EditorTab)}
      >
        <TabsList variant="line">
          <TabsTrigger value="setup">
            <Clock3 size={13} /> Setup
          </TabsTrigger>
          <TabsTrigger value="questions">
            <UserRound size={13} /> Questions
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-normal text-muted-foreground">
              {draft.questions.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette size={13} /> Appearance
          </TabsTrigger>
        </TabsList>

      <TabsContent value="setup" className="mt-3.5">
        <Card className="gap-0 px-[18px] py-[18px]">
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
          <AvailabilityEditor
            availability={draft.availability}
            onChange={(next) => update("availability", next)}
          />
          <div className="booking-form-grid">
            <DurationField
              value={draft.durationMinutes}
              onChange={(minutes) => update("durationMinutes", minutes)}
            />
            <LocationFields
              locationType={draft.locationType}
              locationDetails={draft.locationDetails}
              onChangeType={(type) => update("locationType", type)}
              onChangeDetails={(details) => update("locationDetails", details)}
            />
            <Label>
              Shortest notice
              <Select
                value={String(draft.minimumNoticeHours)}
                onValueChange={(value) =>
                  update("minimumNoticeHours", Number(value))
                }
              >
                <SelectTrigger className="h-[37px] w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <small className="field-hint">
                How far ahead someone must book.
              </small>
            </Label>
            <Label>
              Booking link
              <div className="slug-field">
                <span>/{activeSlug}/</span>
                <Input
                  value={draft.slug}
                  onChange={(event) =>
                    update("slug", makeSlug(event.target.value))
                  }
                />
              </div>
            </Label>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="questions" className="mt-3.5">
        <Card className="gap-0 px-[18px] py-[18px]">
          <QuestionsFields
            questions={draft.questions}
            onChange={(next) => update("questions", next)}
          />
        </Card>
      </TabsContent>

      <TabsContent value="appearance" className="mt-3.5">
        <div className="booking-builder-grid">
          <Card className="gap-0 px-[18px] py-[18px]">
            <div className="booking-section-heading">
              <span>
                <Sparkles size={16} />
              </span>
              <div>
                <h2>Brand & welcome</h2>
                <p>Make the first touchpoint feel unmistakably yours.</p>
              </div>
            </div>
            <AppearanceFields
              draft={draft}
              onChange={(key, value) => update(key, value)}
            />
          </Card>

          <aside className="booking-preview-column">
            <div className="booking-preview-label">
              <span>Live preview</span>
              <small>Updates as you edit</small>
            </div>
            <BookingPagePreview draft={draft} />
          </aside>
        </div>
      </TabsContent>
      </Tabs>

      <div className="editor-danger-row">
        <Button variant="outline" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} /> Delete booking type
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
      >
        <DialogContent className="workflow-modal integration-disconnect-modal">
          <div className="modal-heading">
            <div>
              <p className="eyebrow">DELETE BOOKING TYPE</p>
              <DialogTitle>
                Delete “{draft.title || "this booking type"}”?
              </DialogTitle>
            </div>
            <DialogClose asChild>
              <button aria-label="Close delete confirmation">
                <X size={18} />
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="modal-copy">
            The booking link will stop working immediately. Consultations
            already booked through it stay in your calendar.
          </DialogDescription>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PREVIEW_WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * A scaled-down mirror of the real public booking page — same two-panel split,
 * same month grid and time list — so what the coach approves here is what
 * visitors get. Slot times come from `slotTimesForDay`, which reproduces the
 * SQL generator's per-window grid.
 */
function BookingPagePreview({ draft }: { draft: Omit<BookingPage, "id"> }) {
  const days = upcomingDays(draft.availability, 30);
  const selectedDay = days[0] || null;
  const times = selectedDay
    ? slotTimesForDay(draft.availability, draft.durationMinutes, selectedDay, 4)
    : [];

  const anchor = selectedDay || new Date();
  const leadingBlanks = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0,
  ).getDate();
  const monthGrid: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) =>
        new Date(anchor.getFullYear(), anchor.getMonth(), index + 1),
    ),
  ];

  const availableKeys = new Set(days.map((day) => day.toDateString()));

  return (
    <div
      className="booking-page-preview"
      style={{ "--booking-accent": draft.accentColor } as CSSProperties}
    >
      <div className="booking-preview-intro">
        <div className="preview-brand-mark">
          {draft.brandName.charAt(0).toUpperCase() || "?"}
        </div>
        <small>{draft.brandName}</small>
        <h2>{draft.title || "Your consultation headline"}</h2>
        <p>{draft.description || "Add a short, welcoming introduction."}</p>
        <div className="preview-meta">
          <span>
            <Clock3 size={13} /> {draft.durationMinutes} min
          </span>
          <span>
            {draft.locationType === "in_person" ? (
              <MapPin size={13} />
            ) : draft.locationType === "phone" ? (
              <Phone size={13} />
            ) : (
              <Video size={13} />
            )}{" "}
            {locationLabel(draft.locationType)}
          </span>
        </div>
      </div>

      <div className="booking-preview-picker">
        <strong className="preview-calendar-head">Select a Date &amp; Time</strong>
        {days.length ? (
          <>
            <div className="preview-month-grid">
              {PREVIEW_WEEKDAY_LABELS.map((label, index) => (
                <span key={index} className="preview-weekday">
                  {label}
                </span>
              ))}
              {monthGrid.map((day, index) => (
                <span
                  key={index}
                  className={cn(
                    "preview-day-cell",
                    !day && "empty",
                    day && availableKeys.has(day.toDateString()) && "available",
                    day &&
                      selectedDay &&
                      day.toDateString() === selectedDay.toDateString() &&
                      "selected",
                  )}
                >
                  {day ? day.getDate() : ""}
                </span>
              ))}
            </div>
            <div className="preview-times">
              {times.length ? (
                times.map((time) => (
                  <span className="preview-time" key={time}>
                    {time}
                  </span>
                ))
              ) : (
                <p className="preview-empty">
                  Every time slot is shorter than the call length.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="preview-empty">Add at least one time slot.</p>
        )}
      </div>
    </div>
  );
}
