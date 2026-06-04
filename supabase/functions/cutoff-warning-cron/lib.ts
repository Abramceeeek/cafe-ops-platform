// Pure, testable cut-off-warning targeting — ROADMAP 4.4, PROJECT_SPEC §13.
// No Deno/Supabase imports so it runs in CI unit tests.

export interface Manager {
  id: string;
  shop_id: string;
}

// A shop counts as "sorted for tomorrow" once its order has reached shop_confirmed.
export const CONFIRMED_STATUSES = [
  "shop_confirmed",
  "in_progress",
  "packaged",
  "ready_for_courier",
  "in_transit",
  "delivered",
];

/** Tomorrow's delivery date (YYYY-MM-DD) in London timezone. */
export function tomorrowDate(now: Date, timezone = "Europe/London"): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);
}

/**
 * Managers to warn: active shop managers whose shop has NO confirmed order for
 * tomorrow. Don't spam shops that are already sorted (§13 / ROADMAP 4.4 DoD).
 */
export function managersToWarn(
  managers: Manager[],
  shopsWithConfirmedTomorrow: string[],
): Manager[] {
  const sorted = new Set(shopsWithConfirmedTomorrow);
  return managers.filter((m) => !sorted.has(m.shop_id));
}
