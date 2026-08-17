import type { Json } from "@/lib/supabase/database.types";

export type BookingWindow = { start: string; end: string };
export type BookingDayKey = "0" | "1" | "2" | "3" | "4" | "5" | "6";

/**
 * Availability as a list of time windows per weekday, so a coach can work
 * 9-12 and 1-5 on Monday but only 6-8pm on Thursday. Keys are weekday numbers
 * matching both `Date#getDay()` and Postgres `extract(dow from ...)`.
 */
export type BookingAvailability = {
  version: 2;
  windows: Record<BookingDayKey, BookingWindow[]>;
};

export const BOOKING_DAY_KEYS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
] as const satisfies readonly BookingDayKey[];

/** `24:00` is a valid window end — Postgres accepts it and it lands on next-day
 * midnight — but never a valid start. */
const START_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const END_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export const MIDNIGHT_END = "24:00";

export function bookingMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Minutes past midnight, treating the `24:00` end sentinel as end-of-day. */
export function bookingEndMinutes(value: string) {
  return value === MIDNIGHT_END ? 24 * 60 : bookingMinutes(value);
}

export function formatBookingTime(value: string) {
  if (value === MIDNIGHT_END) return "Midnight";
  const total = bookingMinutes(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Every quarter hour, as "HH:MM" values with a friendly label. */
export const BOOKING_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const total = index * 15;
  const value = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
  return { value, label: formatBookingTime(value) };
});

/** Window ends may additionally land on end-of-day. */
export const BOOKING_END_TIME_OPTIONS = [
  ...BOOKING_TIME_OPTIONS.slice(1),
  { value: MIDNIGHT_END, label: formatBookingTime(MIDNIGHT_END) },
];

export function bookingDayKey(day: number): BookingDayKey | null {
  return Number.isInteger(day) && day >= 0 && day <= 6
    ? (String(day) as BookingDayKey)
    : null;
}

export function emptyBookingWindows(): BookingAvailability["windows"] {
  return { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
}

/** Mon-Fri 9-5, for brand-new booking types only. */
export function defaultBookingAvailability(): BookingAvailability {
  const windows = emptyBookingWindows();
  for (const key of ["1", "2", "3", "4", "5"] as const)
    windows[key] = [{ start: "09:00", end: "17:00" }];
  return { version: 2, windows };
}

export function hasAnyWindow(availability: BookingAvailability) {
  return BOOKING_DAY_KEYS.some((key) => availability.windows[key].length > 0);
}

/**
 * Validates and sorts one day's windows. Deliberately does not *merge*
 * overlaps: collapsing 09:00-12:00 + 11:15-14:00 into 09:00-14:00 would
 * produce a different slot grid than the SQL generator does, so the editor
 * would quietly disagree with the live page. `save_booking_page` rejects
 * overlaps instead, and `describeAvailabilityProblem` catches them first.
 */
function normalizeWindows(value: Json | undefined): BookingWindow[] {
  if (!Array.isArray(value)) return [];
  const windows: BookingWindow[] = [];
  for (const entry of value) {
    if (!entry || Array.isArray(entry) || typeof entry !== "object") continue;
    const { start, end } = entry;
    if (typeof start !== "string" || typeof end !== "string") continue;
    if (!START_PATTERN.test(start) || !END_PATTERN.test(end)) continue;
    if (bookingMinutes(end) <= bookingMinutes(start)) continue;
    windows.push({ start, end });
  }
  return windows.sort(
    (left, right) => bookingMinutes(left.start) - bookingMinutes(right.start),
  );
}

/**
 * Accepts either stored shape and always returns the current one, so the app
 * behaves correctly whether or not the availability-windows migration has run:
 *
 *   v2 `{version, windows: {"0": [...]}}` -> passed through, validated
 *   v1 `{days: [1..5], start, end}`       -> fanned out across those weekdays
 *   anything else                         -> empty
 *
 * Branches on structure rather than on `version`, so a row that lost its
 * version key still round-trips.
 *
 * The empty fallback is deliberate. The previous normalizer fell back to
 * Mon-Fri 9-5, which showed the coach a populated editor while the SQL
 * generator produced nothing — the live page was empty and the editor said
 * otherwise. Use `defaultBookingAvailability()` where a default is wanted.
 */
export function bookingAvailability(value: Json): BookingAvailability {
  if (!value || Array.isArray(value) || typeof value !== "object")
    return { version: 2, windows: emptyBookingWindows() };

  const source = value.windows;
  if (source && !Array.isArray(source) && typeof source === "object") {
    const windows = emptyBookingWindows();
    for (const key of BOOKING_DAY_KEYS)
      windows[key] = normalizeWindows(source[key]);
    return { version: 2, windows };
  }

  const windows = emptyBookingWindows();
  const [legacy] = normalizeWindows([
    { start: value.start ?? null, end: value.end ?? null },
  ]);
  if (legacy && Array.isArray(value.days)) {
    for (const day of value.days) {
      const key = typeof day === "number" ? bookingDayKey(day) : null;
      if (key) windows[key] = [{ ...legacy }];
    }
  }
  return { version: 2, windows };
}

/**
 * Mirrors the checks in `save_booking_page` so the coach gets a useful message
 * before a round trip. Returns null when the availability is fine to save.
 */
export function describeAvailabilityProblem(
  availability: BookingAvailability,
  durationMinutes: number,
): string | null {
  if (!hasAnyWindow(availability))
    return "Add at least one time slot you’re available.";

  for (const key of BOOKING_DAY_KEYS) {
    const windows = availability.windows[key];
    let previousEnd: number | null = null;
    for (const window of windows) {
      const start = bookingMinutes(window.start);
      const end = bookingEndMinutes(window.end);
      if (end <= start) return "Each time slot has to end after it starts.";
      if (previousEnd !== null && start < previousEnd)
        return "Time slots on the same day can’t overlap.";
      previousEnd = end;
    }
  }

  const longest = Math.max(
    ...BOOKING_DAY_KEYS.flatMap((key) =>
      availability.windows[key].map(
        (window) => bookingEndMinutes(window.end) - bookingMinutes(window.start),
      ),
    ),
  );
  if (longest < durationMinutes)
    return "Every time slot is shorter than the call length.";

  return null;
}

/**
 * Slot start times a window produces, re-anchored at that window's own start —
 * the same grid `booking_page_slots` generates, so previews match the live page.
 */
export function windowSlotMinutes(
  window: BookingWindow,
  durationMinutes: number,
) {
  const start = bookingMinutes(window.start);
  const end = bookingEndMinutes(window.end);
  const starts: number[] = [];
  for (
    let cursor = start;
    cursor + durationMinutes <= end;
    cursor += durationMinutes
  )
    starts.push(cursor);
  return starts;
}
