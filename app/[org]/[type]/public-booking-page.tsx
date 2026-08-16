"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

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
  title: string;
  description: string;
  accentColor: string;
  durationMinutes: number;
  locationType: "zoom" | "google_meet" | "phone";
  timezone: string;
  availability: { days: number[]; start: string; end: string };
  minimumNoticeHours: number;
  questions: PublicQuestion[];
  bookedStarts: string[];
  availableSlots: string[];
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function slotsFor(page: PublicPage) {
  return page.availableSlots.map((value) => new Date(value));
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [step, setStep] = useState<"time" | "details" | "success">("time");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const slots = useMemo(() => (page ? slotsFor(page) : []), [page]);
  const days = useMemo(() => {
    const unique = new Map<string, Date>();
    for (const slot of slots) unique.set(dateKey(slot), slot);
    return [...unique.values()].slice(0, 7);
  }, [slots]);
  const effectiveSelectedDay = selectedDay || (days[0] ? dateKey(days[0]) : null);
  const visibleSlots = effectiveSelectedDay
    ? slots.filter((slot) => dateKey(slot) === effectiveSelectedDay).slice(0, 8)
    : [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!page || !selectedSlot) return;
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
        guest_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        submitted_answers: answers,
        website,
      });
      if (error) throw error;
      setStep("success");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "We couldn’t complete the booking.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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

  const meetingLabel =
    page.locationType === "zoom"
      ? "Zoom"
      : page.locationType === "google_meet"
        ? "Google Meet"
        : "Phone call";

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
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          <div className="public-booking-meta">
            <span><Clock3 size={15} /> {page.durationMinutes} minutes</span>
            <span><MapPin size={15} /> {meetingLabel}</span>
          </div>
          <div className="public-booking-trust">
            <ShieldCheck size={15} />
            <span><strong>Your information stays private.</strong> It is shared only with {page.coachName}.</span>
          </div>
        </aside>

        <div className="public-booking-flow">
          {step === "time" ? (
            <>
              <div className="public-flow-heading">
                <div><span>1</span><p><strong>Choose a time</strong><small>Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ")}</small></p></div>
              </div>
              <div className="public-day-row">
                {days.map((day) => {
                  const key = dateKey(day);
                  return (
                    <button
                      key={key}
                      className={effectiveSelectedDay === key ? "selected" : ""}
                      onClick={() => {
                        setSelectedDay(key);
                        setSelectedSlot(null);
                      }}
                    >
                      <small>{day.toLocaleDateString("en-US", { weekday: "short" })}</small>
                      <strong>{day.getDate()}</strong>
                      <span>{day.toLocaleDateString("en-US", { month: "short" })}</span>
                    </button>
                  );
                })}
              </div>
              <div className="public-time-grid">
                {visibleSlots.map((slot) => (
                  <button
                    key={slot.toISOString()}
                    className={selectedSlot?.getTime() === slot.getTime() ? "selected" : ""}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {selectedSlot?.getTime() === slot.getTime() ? <Check size={14} /> : null}
                  </button>
                ))}
              </div>
              {!visibleSlots.length ? <p className="public-no-times">No open times on this day.</p> : null}
              <button
                className="public-primary-button"
                disabled={!selectedSlot}
                onClick={() => setStep("details")}
              >
                Continue <ArrowRight size={15} />
              </button>
            </>
          ) : step === "details" ? (
            <form onSubmit={submit}>
              <button className="public-back-button" type="button" onClick={() => setStep("time")}>
                <ArrowLeft size={14} /> Change time
              </button>
              <div className="public-selection-summary">
                <CalendarDays size={17} />
                <p><strong>{selectedSlot?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong><span>{selectedSlot?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {page.durationMinutes} min</span></p>
              </div>
              <div className="public-form-fields">
                <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
                <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                <label>Phone <small>Optional</small><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                <label className="booking-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
                {page.questions.map((question) => (
                  <label key={question.id}>
                    {question.label} {!question.required ? <small>Optional</small> : null}
                    {question.type === "long_text" ? (
                      <textarea rows={3} required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
                    ) : question.type === "select" ? (
                      <select required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}>
                        <option value="">Choose one…</option>
                        {question.options.map((option) => <option key={option}>{option}</option>)}
                      </select>
                    ) : question.type === "checkbox" ? (
                      <span className="public-checkbox"><input type="checkbox" required={question.required} checked={answers[question.id] === "Yes"} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.checked ? "Yes" : "" }))} /> Yes</span>
                    ) : (
                      <input required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
                    )}
                  </label>
                ))}
              </div>
              {submitError ? <div className="data-error" role="alert">{submitError}</div> : null}
              <button className="public-primary-button" type="submit" disabled={submitting}>
                {submitting ? "Booking…" : "Book consultation"} <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <div className="public-booking-success">
              <span><Check size={25} /></span>
              <small>YOU’RE BOOKED</small>
              <h2>Looking forward to meeting you, {name.split(" ")[0]}.</h2>
              <p>A confirmation is ready for <strong>{email}</strong>. {page.coachName} will follow up with the meeting details.</p>
              <div><CalendarDays size={17} /><p><strong>{selectedSlot?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong><span>{selectedSlot?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {meetingLabel}</span></p></div>
              <span className="public-success-note"><Sparkles size={14} /> You can close this page.</span>
            </div>
          )}
        </div>
      </section>
      <footer className="public-booking-footer">Powered by <strong>Soli</strong></footer>
    </main>
  );
}
