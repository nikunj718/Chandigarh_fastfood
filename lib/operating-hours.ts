import { z } from "zod";
import type { OperatingHour } from "@/lib/types";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time.");

const operatingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  opensAt: timeSchema.nullable(),
  closesAt: timeSchema.nullable(),
}).superRefine((hour, context) => {
  if (hour.isClosed && (hour.opensAt !== null || hour.closesAt !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Closed days cannot have opening hours." });
  }
  if (!hour.isClosed && (!hour.opensAt || !hour.closesAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Open days need both an opening and closing time." });
  }
  if (!hour.isClosed && hour.opensAt === hour.closesAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Opening and closing times must differ." });
  }
});

export const operatingHoursSchema = z.array(operatingHourSchema).length(7).superRefine((hours, context) => {
  if (new Set(hours.map((hour) => hour.dayOfWeek)).size !== 7) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide one schedule for every day of the week." });
  }
});

export const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function defaultOperatingHours(): OperatingHour[] {
  return weekdayLabels.map((_, dayOfWeek) => ({ dayOfWeek, isClosed: true, opensAt: null, closesAt: null }));
}

function toClientTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : null;
}

export function normalizeOperatingHours(rows: Array<Record<string, unknown>> | null | undefined): OperatingHour[] {
  const byDay = new Map((rows ?? []).map((row) => [Number(row.day_of_week ?? row.dayOfWeek), row]));
  return defaultOperatingHours().map((fallback) => {
    const row = byDay.get(fallback.dayOfWeek);
    if (!row) return fallback;
    const isClosed = Boolean(row.is_closed ?? row.isClosed);
    return {
      dayOfWeek: fallback.dayOfWeek,
      isClosed,
      opensAt: isClosed ? null : toClientTime(row.opens_at ?? row.opensAt),
      closesAt: isClosed ? null : toClientTime(row.closes_at ?? row.closesAt),
    };
  });
}

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function indiaClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dayOfWeek: days[part("weekday")], minute: Number(part("hour")) * 60 + Number(part("minute")) };
}

/** A close time before its open time means the restaurant closes the following day. */
export function isRestaurantOpenNow(hours: OperatingHour[], now = new Date()) {
  const { dayOfWeek, minute } = indiaClock(now);
  const current = hours.find((hour) => hour.dayOfWeek === dayOfWeek);
  if (current && !current.isClosed && current.opensAt && current.closesAt) {
    const opens = minutes(current.opensAt);
    const closes = minutes(current.closesAt);
    if ((closes > opens && minute >= opens && minute < closes) || (closes < opens && minute >= opens)) return true;
  }
  const previous = hours.find((hour) => hour.dayOfWeek === (dayOfWeek + 6) % 7);
  if (!previous || previous.isClosed || !previous.opensAt || !previous.closesAt) return false;
  const opens = minutes(previous.opensAt);
  const closes = minutes(previous.closesAt);
  return closes < opens && minute < closes;
}
