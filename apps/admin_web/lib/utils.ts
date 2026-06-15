import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Daily cut-off is 10:00 Europe/London. Orders placed BEFORE 10:00 are eligible for
// NEXT-DAY delivery; at/after 10:00 the earliest is the day after tomorrow. Uniform
// for every item — per-item lead time no longer extends the floor. `_maxLeadHours` is
// kept for call-site compatibility but intentionally ignored.
export function earliestDate(now: Date, _maxLeadHours: number, cutoffPassedOverride?: boolean): string {
  let cutoffPassed = cutoffPassedOverride;
  if (cutoffPassed === undefined) {
    const londonHour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now),
    );
    cutoffPassed = londonHour >= 10;
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + (cutoffPassed ? 2 : 1));
  return d.toISOString().slice(0, 10);
}
