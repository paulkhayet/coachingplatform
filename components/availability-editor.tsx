"use client";

import { CopyPlus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BOOKING_DAY_KEYS,
  BOOKING_END_TIME_OPTIONS,
  BOOKING_TIME_OPTIONS,
  bookingEndMinutes,
  bookingMinutes,
  formatBookingTime,
  type BookingAvailability,
  type BookingDayKey,
  type BookingWindow,
} from "@/lib/booking-availability";
import { cn } from "@/lib/utils";

const DAY_LABELS: Record<BookingDayKey, string> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
};

const DEFAULT_WINDOW: BookingWindow = { start: "09:00", end: "17:00" };

/** First option strictly later than `after`, so a window can never invert. */
function nextEndAfter(after: string) {
  const limit = bookingMinutes(after);
  return (
    BOOKING_END_TIME_OPTIONS.find(
      (option) => bookingEndMinutes(option.value) > limit,
    )?.value || "24:00"
  );
}

/** A new window defaults to an hour, or whatever is left before midnight. */
const ADDED_WINDOW_MINUTES = 60;

/**
 * Picks a window that starts after the day's last one ends, so "Add a time"
 * never lands on an overlap the server would reject. Returns null when the day
 * is already full, which disables the button rather than adding a dud row.
 */
function windowAfter(windows: BookingWindow[]): BookingWindow | null {
  if (!windows.length) return { ...DEFAULT_WINDOW };
  const lastEnd = bookingEndMinutes(windows[windows.length - 1].end);
  const start = BOOKING_TIME_OPTIONS.find(
    (option) => bookingMinutes(option.value) >= lastEnd,
  );
  if (!start) return null;
  const startMinutes = bookingMinutes(start.value);
  const target = Math.min(startMinutes + ADDED_WINDOW_MINUTES, 24 * 60);
  const end =
    BOOKING_END_TIME_OPTIONS.find(
      (option) => bookingEndMinutes(option.value) >= target,
    )?.value || nextEndAfter(start.value);
  if (bookingEndMinutes(end) <= startMinutes) return null;
  return { start: start.value, end };
}

export function AvailabilityEditor({
  availability,
  onChange,
  timezoneLabel,
}: {
  availability: BookingAvailability;
  onChange: (next: BookingAvailability) => void;
  timezoneLabel?: string | null;
}) {
  const setDay = (day: BookingDayKey, windows: BookingWindow[]) =>
    onChange({
      ...availability,
      windows: { ...availability.windows, [day]: windows },
    });

  const updateWindow = (
    day: BookingDayKey,
    index: number,
    patch: Partial<BookingWindow>,
  ) => {
    const windows = availability.windows[day].map((window, position) =>
      position === index ? { ...window, ...patch } : window,
    );
    // Keep the window valid when a new start overtakes the existing end,
    // rather than saving something the server will bounce.
    const changed = windows[index];
    if (bookingEndMinutes(changed.end) <= bookingMinutes(changed.start))
      windows[index] = { ...changed, end: nextEndAfter(changed.start) };
    setDay(day, windows);
  };

  const copyToEveryDay = (day: BookingDayKey) => {
    const source = availability.windows[day].map((window) => ({ ...window }));
    const windows = { ...availability.windows };
    for (const key of BOOKING_DAY_KEYS)
      windows[key] = source.map((window) => ({ ...window }));
    onChange({ ...availability, windows });
  };

  return (
    <div className="rounded-xl border border-border">
      {timezoneLabel ? (
        <p className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          Times are in {timezoneLabel}.
        </p>
      ) : null}

      {BOOKING_DAY_KEYS.map((day) => {
        const windows = availability.windows[day];
        const enabled = windows.length > 0;

        return (
          <div
            key={day}
            className="flex flex-col gap-3 border-b border-border px-4 py-3.5 last:border-b-0 sm:flex-row sm:gap-4"
          >
            <label className="flex h-8 min-w-[130px] cursor-pointer items-center gap-2.5 text-sm font-medium">
              <Checkbox
                checked={enabled}
                onCheckedChange={(checked) =>
                  setDay(day, checked ? [{ ...DEFAULT_WINDOW }] : [])
                }
                aria-label={DAY_LABELS[day]}
              />
              {DAY_LABELS[day]}
            </label>

            <div className="flex flex-1 flex-col gap-2">
              {enabled ? (
                windows.map((window, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={window.start}
                      onValueChange={(value) =>
                        updateWindow(day, index, { start: value })
                      }
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue>
                          {formatBookingTime(window.start)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {BOOKING_TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-sm text-muted-foreground">–</span>

                    <Select
                      value={window.end}
                      onValueChange={(value) =>
                        updateWindow(day, index, { end: value })
                      }
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue>
                          {formatBookingTime(window.end)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {BOOKING_END_TIME_OPTIONS.filter(
                          (option) =>
                            bookingEndMinutes(option.value) >
                            bookingMinutes(window.start),
                        ).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      onClick={() =>
                        setDay(
                          day,
                          windows.filter((_, position) => position !== index),
                        )
                      }
                      aria-label={`Remove ${formatBookingTime(window.start)} to ${formatBookingTime(window.end)} on ${DAY_LABELS[day]}`}
                    >
                      <X size={14} />
                    </Button>

                    {index === 0 ? (
                      <div className="ml-auto flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              disabled={!windowAfter(windows)}
                              onClick={() => {
                                const next = windowAfter(windows);
                                if (next) setDay(day, [...windows, next]);
                              }}
                              aria-label={`Add a time on ${DAY_LABELS[day]}`}
                            >
                              <Plus size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Add a time</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              onClick={() => copyToEveryDay(day)}
                              aria-label={`Copy ${DAY_LABELS[day]} to every day`}
                            >
                              <CopyPlus size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy to every day</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <span
                  className={cn(
                    "flex h-8 items-center text-sm text-muted-foreground",
                  )}
                >
                  Unavailable
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
