"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { BookingAvailability } from "@/lib/booking-availability";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type PublicQuestion = {
  id: string;
  label: string;
  type: "short_text" | "long_text" | "select" | "checkbox";
  required: boolean;
  options: string[];
};

type PublicPage = {
  slug: string;
  orgSlug: string;
  brandName: string;
  coachName: string;
  coachAvatarUrl: string | null;
  title: string;
  description: string;
  accentColor: string;
  durationMinutes: number;
  locationType: "zoom" | "google_meet" | "phone" | "in_person";
  /** Street address. The RPC only sends this when locationType is in_person. */
  locationDetails: string;
  timezone: string;
  availability: BookingAvailability;
  minimumNoticeHours: number;
  questions: PublicQuestion[];
  bookedStarts: string[];
  availableSlots: string[];
};

const FALLBACK_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
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

/** The calendar day (YYYY-MM-DD) a given instant falls on, in `timeZone`. */
function zonedDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

function calendarKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** e.g. "Pacific Daylight Time (1:24 PM)" for the current moment in `timeZone`. */
function zoneClockLabel(timeZone: string) {
  const now = new Date();
  const nameParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "long",
  }).formatToParts(now);
  const name =
    nameParts.find((part) => part.type === "timeZoneName")?.value || timeZone;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  return `${name} (${time})`;
}

function isPublicPage(value: Json) {
  return Boolean(
    value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      typeof value.slug === "string" &&
      typeof value.brandName === "string" &&
      typeof value.accentColor === "string" &&
      Array.isArray(value.availableSlots),
  );
}

export function PublicBookingPage({
  orgSlug,
  typeSlug,
}: {
  orgSlug: string;
  typeSlug: string;
}) {
  const configured = isSupabaseConfigured();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [loading, setLoading] = useState(configured);
  const [loadError, setLoadError] = useState<string | null>(
    configured ? null : "Booking is temporarily unavailable.",
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase
      .rpc("get_public_booking_page", { org_slug: orgSlug, type_slug: typeSlug })
      .then(({ data, error }) => {
        if (error || !isPublicPage(data))
          setLoadError("This booking page is not available.");
        else setPage(data as unknown as PublicPage);
        setLoading(false);
      });
  }, [orgSlug, typeSlug]);

  if (loading)
    return (
      <main className="public-booking-shell public-booking-loading">
        <span className="auth-spinner" />
        <p>Opening the calendar…</p>
      </main>
    );

  if (!page || loadError)
    return (
      <main className="public-booking-shell">
        <section className="public-booking-error">
          <CalendarDays size={24} />
          <h1>Booking page unavailable</h1>
          <p>{loadError || "Ask your coach for an updated booking link."}</p>
        </section>
      </main>
    );

  return <PublicBookingPageView page={page} />;
}

function PublicBookingPageView({ page }: { page: PublicPage }) {
  const [viewerTimezone, setViewerTimezone] = useState(() =>
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [viewMonthOverride, setViewMonthOverride] = useState<Date | null>(
    null,
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [step, setStep] = useState<
    "time" | "details" | "questions" | "success"
  >("time");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const slots = useMemo(
    () => page.availableSlots.map((value) => new Date(value)),
    [page],
  );
  /** Every calendar day (in the viewer's timezone) that has an open slot. */
  const dayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) set.add(zonedDateKey(slot, viewerTimezone));
    return set;
  }, [slots, viewerTimezone]);
  const sortedDayKeys = useMemo(() => [...dayKeys].sort(), [dayKeys]);
  // Default to the first month with availability rather than showing an
  // empty grid for the current month; once the visitor navigates manually,
  // that choice takes over.
  const defaultViewMonth = useMemo(() => {
    if (sortedDayKeys.length) {
      const [year, month] = sortedDayKeys[0].split("-").map(Number);
      return new Date(year, month - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [sortedDayKeys]);
  const viewMonth = viewMonthOverride || defaultViewMonth;

  const effectiveSelectedDay = selectedDay || sortedDayKeys[0] || null;
  const visibleSlots = useMemo(
    () =>
      effectiveSelectedDay
        ? slots
            .filter(
              (slot) => zonedDateKey(slot, viewerTimezone) === effectiveSelectedDay,
            )
            .sort((a, b) => a.getTime() - b.getTime())
        : [],
    [slots, viewerTimezone, effectiveSelectedDay],
  );
  const hasQuestions = Boolean(page.questions.length);

  const monthGrid = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, key: calendarKey(year, month, day) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);
  const todayKey = zonedDateKey(new Date(), viewerTimezone);
  const canGoToPreviousMonth = (() => {
    const now = new Date();
    return (
      viewMonth.getFullYear() > now.getFullYear() ||
      (viewMonth.getFullYear() === now.getFullYear() &&
        viewMonth.getMonth() > now.getMonth())
    );
  })();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Booking is temporarily unavailable.");
      const { error } = await supabase.rpc("submit_public_booking", {
        org_slug: page.orgSlug,
        type_slug: page.slug,
        guest_name: name,
        guest_email: email,
        guest_phone: phone,
        requested_starts_at: selectedSlot.toISOString(),
        guest_timezone: viewerTimezone,
        submitted_answers: answers,
        website,
      });
      if (error) throw error;
      setStep("success");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn’t complete the booking.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const meetingLabel =
    page.locationType === "zoom"
      ? "Zoom"
      : page.locationType === "google_meet"
        ? "Google Meet"
        : page.locationType === "in_person"
          ? "In person"
          : "Phone call";
  const meetingIcon =
    page.locationType === "in_person" ? (
      <MapPin size={15} />
    ) : page.locationType === "phone" ? (
      <Phone size={15} />
    ) : (
      <Video size={15} />
    );
  const totalSteps = hasQuestions ? 2 : 1;
  const stepNumber = step === "details" ? 1 : 2;
  const selectionSummary = selectedSlot ? (
    <div className="public-selection-summary">
      <CalendarDays size={17} />
      <p>
        <strong>
          {selectedSlot.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: viewerTimezone,
          })}
        </strong>
        <span>
          {selectedSlot.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: viewerTimezone,
          })}{" "}
          · {page.durationMinutes} min
        </span>
      </p>
    </div>
  ) : null;

  return (
    <main
      className="public-booking-shell"
      style={{ "--booking-accent": page.accentColor } as CSSProperties}
    >
      <div className="public-booking-ambient" />
      <section className="public-booking-card">
        <aside className="public-booking-intro">
          <div className="public-brand-mark">{page.brandName.charAt(0)}</div>
          <small>{page.brandName}</small>
          <div className="public-intro-divider" />
          <div className="public-coach-row">
            <Avatar
              initials={page.coachName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
              imageUrl={page.coachAvatarUrl}
              color={page.accentColor}
              size="xl"
            />
            <small>{page.coachName}</small>
          </div>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          <div className="public-booking-meta">
            <span>
              <Clock3 size={15} /> {page.durationMinutes} minutes
            </span>
            <span>
              {meetingIcon}
              {page.locationType === "in_person" && page.locationDetails
                ? page.locationDetails
                : meetingLabel}
            </span>
          </div>
          <div className="public-booking-trust">
            <ShieldCheck size={15} />
            <span>
              <strong>Your information stays private.</strong> It is shared only
              with {page.coachName}.
            </span>
          </div>
        </aside>

        <div className="public-booking-flow">
          {step === "details" || step === "questions" ? (
            <div className="public-flow-heading">
              <div>
                <span>{stepNumber}</span>
                <p>
                  <strong>
                    {step === "details" ? "Your details" : "A few questions"}
                  </strong>
                  <small>
                    Step {stepNumber} of {totalSteps}
                  </small>
                </p>
              </div>
            </div>
          ) : null}

          {step === "time" ? (
            <>
              <h2 className="public-time-heading">Select a Date &amp; Time</h2>
              {sortedDayKeys.length ? (
                <div className="public-calendar-columns">
                  <div className="public-calendar-block">
                    <div className="public-month-nav">
                      <button
                        type="button"
                        onClick={() =>
                          setViewMonthOverride(
                            new Date(
                              viewMonth.getFullYear(),
                              viewMonth.getMonth() - 1,
                              1,
                            ),
                          )
                        }
                        disabled={!canGoToPreviousMonth}
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <strong>
                        {viewMonth.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          setViewMonthOverride(
                            new Date(
                              viewMonth.getFullYear(),
                              viewMonth.getMonth() + 1,
                              1,
                            ),
                          )
                        }
                        aria-label="Next month"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    <div className="public-month-grid">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (label) => (
                          <span key={label} className="public-weekday-label">
                            {label}
                          </span>
                        ),
                      )}
                      {monthGrid.map((cell, index) => {
                        if (!cell)
                          return (
                            <span
                              key={`blank-${index}`}
                              className="public-day-cell empty"
                              aria-hidden="true"
                            />
                          );
                        const available = dayKeys.has(cell.key);
                        const selected = effectiveSelectedDay === cell.key;
                        return (
                          <button
                            key={cell.key}
                            type="button"
                            className={cn(
                              "public-day-cell",
                              available && "available",
                              selected && "selected",
                              cell.key === todayKey && "today",
                            )}
                            disabled={!available}
                            onClick={() => {
                              setSelectedDay(cell.key);
                              setSelectedSlot(null);
                            }}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>
                    <div className="public-timezone-row">
                      <span>Time zone</span>
                      <Select
                        value={viewerTimezone}
                        onValueChange={setViewerTimezone}
                      >
                        <SelectTrigger className="public-timezone-trigger">
                          <Globe size={14} />
                          <SelectValue>
                            {zoneClockLabel(viewerTimezone)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {allTimezones().map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="public-times-block">
                    {effectiveSelectedDay ? (
                      <>
                        <h3>
                          {(() => {
                            const [year, month, day] = effectiveSelectedDay
                              .split("-")
                              .map(Number);
                            return new Date(
                              year,
                              month - 1,
                              day,
                            ).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            });
                          })()}
                        </h3>
                        {visibleSlots.length ? (
                          <div className="public-time-list">
                            {visibleSlots.map((slot) => (
                              <button
                                key={slot.toISOString()}
                                type="button"
                                className={cn(
                                  selectedSlot?.getTime() === slot.getTime() &&
                                    "selected",
                                )}
                                onClick={() => setSelectedSlot(slot)}
                              >
                                {slot.toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  timeZone: viewerTimezone,
                                })}
                                {selectedSlot?.getTime() === slot.getTime() ? (
                                  <Check size={14} />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="public-no-times">
                            No open times on this day — try another.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="public-no-times">
                        Select a date to see available times.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="public-no-availability">
                  <CalendarDays size={22} />
                  <p>
                    <strong>No open times right now.</strong>
                    <span>
                      {page.coachName} is fully booked for the next few weeks.
                      Check back soon or reach out directly.
                    </span>
                  </p>
                </div>
              )}
              {selectedSlot ? (
                <button
                  className="public-primary-button"
                  onClick={() => setStep("details")}
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : null}
            </>
          ) : step === "details" ? (
            <form
              onSubmit={
                hasQuestions
                  ? (event) => {
                      event.preventDefault();
                      setStep("questions");
                    }
                  : submit
              }
            >
              <button
                className="public-back-button"
                type="button"
                onClick={() => setStep("time")}
              >
                <ArrowLeft size={14} /> Change time
              </button>
              {selectionSummary}
              <div className="public-form-fields">
                <Label>
                  Full name
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </Label>
                <Label>
                  Email address
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Label>
                <Label>
                  Phone <small>Optional</small>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </Label>
                <Label className="booking-honeypot" aria-hidden="true">
                  Website
                  <Input
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </Label>
              </div>
              {submitError ? (
                <div className="data-error" role="alert">
                  {submitError}
                </div>
              ) : null}
              <button
                className="public-primary-button"
                type="submit"
                disabled={submitting}
              >
                {hasQuestions
                  ? "Continue"
                  : submitting
                    ? "Booking…"
                    : "Book consultation"}{" "}
                <ArrowRight size={15} />
              </button>
            </form>
          ) : step === "questions" ? (
            <form onSubmit={submit}>
              <button
                className="public-back-button"
                type="button"
                onClick={() => setStep("details")}
              >
                <ArrowLeft size={14} /> Back
              </button>
              {selectionSummary}
              <p className="public-questions-intro">
                This helps {page.coachName} make the most of your time together.
              </p>
              <div className="public-form-fields">
                {page.questions.map((question) => (
                  <Label key={question.id}>
                    {question.label}{" "}
                    {!question.required ? <small>Optional</small> : null}
                    {question.type === "long_text" ? (
                      <Textarea
                        rows={3}
                        required={question.required}
                        value={answers[question.id] || ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                    ) : question.type === "select" ? (
                      <Select
                        required={question.required}
                        value={answers[question.id] || undefined}
                        onValueChange={(value) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose one…" />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : question.type === "checkbox" ? (
                      <span className="public-checkbox">
                        <Checkbox
                          required={question.required}
                          checked={answers[question.id] === "Yes"}
                          onCheckedChange={(checked) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: checked === true ? "Yes" : "",
                            }))
                          }
                        />{" "}
                        Yes
                      </span>
                    ) : (
                      <Input
                        required={question.required}
                        value={answers[question.id] || ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </Label>
                ))}
              </div>
              {submitError ? (
                <div className="data-error" role="alert">
                  {submitError}
                </div>
              ) : null}
              <button
                className="public-primary-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Booking…" : "Book consultation"}{" "}
                <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <div className="public-booking-success">
              <span>
                <Check size={25} />
              </span>
              <small>YOU’RE BOOKED</small>
              <h2>Looking forward to meeting you, {name.split(" ")[0]}.</h2>
              <p>
                A confirmation is ready for <strong>{email}</strong>.{" "}
                {page.coachName} will follow up with the meeting details.
              </p>
              <div>
                <CalendarDays size={17} />
                <p>
                  <strong>
                    {selectedSlot?.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      timeZone: viewerTimezone,
                    })}
                  </strong>
                  <span>
                    {selectedSlot?.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: viewerTimezone,
                    })}{" "}
                    · {meetingLabel}
                  </span>
                  {page.locationType === "in_person" && page.locationDetails ? (
                    <span>{page.locationDetails}</span>
                  ) : null}
                </p>
              </div>
              <span className="public-success-note">
                <Sparkles size={14} /> You can close this page.
              </span>
            </div>
          )}
        </div>
      </section>
      <footer className="public-booking-footer">
        Powered by <strong>Soli</strong>
      </footer>
    </main>
  );
}
