"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  CalendarCheck2,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  GripVertical,
  Link2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  BookingPage,
  BookingQuestion,
  BookingRequest,
} from "@/lib/supabase/practice-data";
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

const COLORS = ["#28282b", "#347a5f", "#2563a8", "#a65f44", "#a24f72"];

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54);
}

function defaultPage(userName: string): Omit<BookingPage, "id"> {
  return {
    slug: makeSlug(userName) || "consultation",
    brandName: `${userName} Coaching`,
    title: "Let’s explore working together",
    description:
      "Choose a time for a relaxed, no-pressure conversation about what you’re working toward.",
    accentColor: COLORS[0],
    durationMinutes: 30,
    locationType: "zoom",
    availability: { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
    minimumNoticeHours: 24,
    active: true,
    questions: [
      {
        id: crypto.randomUUID(),
        label: "What would make this conversation valuable for you?",
        type: "long_text",
        required: true,
        options: [],
      },
    ],
  };
}

export function BookingsView({
  userName,
  bookingPage,
  requests,
  onSave,
  onCancelRequest,
  onToast,
}: {
  userName: string;
  bookingPage: BookingPage | null;
  requests: BookingRequest[];
  onSave: (page: Omit<BookingPage, "id">) => Promise<void>;
  onCancelRequest: (requestId: string) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Omit<BookingPage, "id">>(() =>
    bookingPage ? { ...bookingPage } : defaultPage(userName),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt] = useState(() => Date.now());
  const bookingUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? `/book/${draft.slug}`
        : `${window.location.origin}/book/${draft.slug}`,
    [draft.slug],
  );
  const upcoming = requests.filter(
    (request) =>
      request.status !== "cancelled" &&
      new Date(request.startsAt).getTime() >= loadedAt,
  );

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
      onToast(bookingPage ? "Booking page updated" : "Booking page published");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The booking page could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(bookingUrl);
    onToast("Booking link copied");
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

  const updateQuestion = (
    id: string,
    changes: Partial<BookingQuestion>,
  ) =>
    update(
      "questions",
      draft.questions.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    );

  return (
    <div className="bookings-page page-enter">
      <div className="page-heading booking-heading">
        <div>
          <p className="eyebrow">CONSULTATION BOOKINGS</p>
          <h1>A welcoming first step</h1>
          <p>
            Share a beautiful booking page, learn what brings someone in, and
            turn interest into a thoughtful first conversation.
          </p>
        </div>
        <div className="heading-actions">
          {bookingPage ? (
            <Button
              variant="outline"
              onClick={() => window.open(bookingUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink size={14} /> View live page
            </Button>
          ) : null}
          <Button onClick={save} disabled={saving}>
            <Sparkles size={14} />
            {saving ? "Saving…" : bookingPage ? "Save changes" : "Publish page"}
          </Button>
        </div>
      </div>

      <div className="booking-link-strip">
        <span className="booking-link-icon"><Link2 size={17} /></span>
        <div>
          <small>Your consultation link</small>
          <strong>{bookingUrl.replace(/^https?:\/\//, "")}</strong>
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
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy size={13} /> Copy
        </Button>
      </div>

      {error ? <div className="data-error" role="alert">{error}</div> : null}

      <div className="booking-builder-grid">
        <div className="booking-settings-stack">
          <section className="panel booking-settings-card">
            <div className="booking-section-heading">
              <span><Sparkles size={16} /></span>
              <div>
                <h2>Brand & welcome</h2>
                <p>Make the first touchpoint feel unmistakably yours.</p>
              </div>
            </div>
            <div className="booking-form-grid">
              <label>
                Brand name
                <input
                  value={draft.brandName}
                  onChange={(event) => update("brandName", event.target.value)}
                />
              </label>
              <label>
                Booking link
                <div className="slug-field">
                  <span>/book/</span>
                  <input
                    value={draft.slug}
                    onChange={(event) => update("slug", makeSlug(event.target.value))}
                  />
                </div>
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
                  onChange={(event) => update("description", event.target.value)}
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

          <section className="panel booking-settings-card">
            <div className="booking-section-heading">
              <span><Clock3 size={16} /></span>
              <div>
                <h2>Availability</h2>
                <p>Set the simple weekly window prospects can choose from.</p>
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
                          ? draft.availability.days.filter((value) => value !== day.value)
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
                    update("availability", { ...draft.availability, start: event.target.value })
                  }
                />
              </label>
              <label>
                Until
                <input
                  type="time"
                  value={draft.availability.end}
                  onChange={(event) =>
                    update("availability", { ...draft.availability, end: event.target.value })
                  }
                />
              </label>
              <label>
                Call length
                <select
                  value={draft.durationMinutes}
                  onChange={(event) => update("durationMinutes", Number(event.target.value))}
                >
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
              <label>
                Meeting
                <select
                  value={draft.locationType}
                  onChange={(event) =>
                    update("locationType", event.target.value as BookingPage["locationType"])
                  }
                >
                  <option value="zoom">Zoom</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="phone">Phone call</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel booking-settings-card">
            <div className="booking-section-heading questionnaire-heading">
              <span><UserRound size={16} /></span>
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
                      onChange={(event) => updateQuestion(question.id, { label: event.target.value })}
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
                            updateQuestion(question.id, { required: event.target.checked })
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
        </div>

        <aside className="booking-preview-column">
          <div className="booking-preview-label">
            <span>Live preview</span>
            <small>Updates as you edit</small>
          </div>
          <div className="booking-page-preview" style={{ "--booking-accent": draft.accentColor } as CSSProperties}>
            <div className="preview-brand-mark">{draft.brandName.charAt(0).toUpperCase()}</div>
            <small>{draft.brandName}</small>
            <h2>{draft.title || "Your consultation headline"}</h2>
            <p>{draft.description || "Add a short, welcoming introduction."}</p>
            <div className="preview-meta">
              <span><Clock3 size={13} /> {draft.durationMinutes} min</span>
              <span><MapPin size={13} /> {draft.locationType === "phone" ? "Phone" : draft.locationType === "zoom" ? "Zoom" : "Google Meet"}</span>
            </div>
            <div className="preview-calendar-head">
              <button aria-label="Previous month">‹</button>
              <strong>Choose a day</strong>
              <button aria-label="Next month">›</button>
            </div>
            <div className="preview-days">
              {[18, 19, 20, 21, 22].map((date, index) => (
                <button key={date} className={index === 2 ? "selected" : ""}>
                  <small>{["MON", "TUE", "WED", "THU", "FRI"][index]}</small>
                  <strong>{date}</strong>
                </button>
              ))}
            </div>
            <button className="preview-time">10:00 AM <ArrowUpRight size={14} /></button>
          </div>

          <section className="panel booking-requests-card">
            <div className="booking-requests-title">
              <div>
                <h2>Upcoming consultations</h2>
                <p>{upcoming.length ? `${upcoming.length} booked` : "No bookings yet"}</p>
              </div>
              <span><CalendarCheck2 size={16} /></span>
            </div>
            <div className="booking-request-list">
              {upcoming.slice(0, 4).map((request) => (
                <div key={request.id}>
                  <span className="request-date-tile">
                    <small>{new Date(request.startsAt).toLocaleDateString("en-US", { month: "short" })}</small>
                    <strong>{new Date(request.startsAt).getDate()}</strong>
                  </span>
                  <p>
                    <strong>{request.guestName}</strong>
                    <span>{new Date(request.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {request.guestEmail}</span>
                  </p>
                  <button
                    aria-label={`Cancel booking for ${request.guestName}`}
                    onClick={async () => {
                      await onCancelRequest(request.id);
                      onToast("Consultation cancelled");
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {!upcoming.length ? (
                <div className="booking-request-empty">
                  <CalendarCheck2 size={20} />
                  <p><strong>Your next great client starts here.</strong><span>Share your link to receive consultation bookings.</span></p>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
