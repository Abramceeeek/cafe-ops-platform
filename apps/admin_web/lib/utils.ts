import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function earliestDate(now: Date, maxLeadHours: number, cutoffPassedOverride?: boolean): string {
  let cutoffPassed = cutoffPassedOverride;
  if (cutoffPassed === undefined) {
    const londonHour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now),
    );
    cutoffPassed = londonHour >= 16;
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const leadDays = Math.max(1, Math.ceil(maxLeadHours / 24));
  const penalty = cutoffPassed ? 1 : 0;
  d.setUTCDate(d.getUTCDate() + leadDays + penalty);
  return d.toISOString().slice(0, 10);
}
