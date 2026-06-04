// Pure, testable order-submission logic — PROJECT_SPEC §8.2, §9.2, §10.
// No Deno/Supabase imports here so it can be unit-tested in CI.

export interface CartItem {
  product_id: string;
  category_id: string;
  quantity: number;
  lead_time_hours: number;
  custom_note?: string;
}

/**
 * Earliest valid delivery date per §9.2.
 * Before cut-off: from start of tomorrow + lead time.
 * After cut-off:  from start of day-after-tomorrow + lead time.
 * `now` is server time (UTC); `cutoffPassed` is decided by the caller using the
 * configured timezone so this stays pure and testable.
 */
export function earliestDeliveryDate(
  now: Date,
  cutoffPassed: boolean,
  leadTimeHours: number,
): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const leadDays = Math.max(1, Math.ceil(leadTimeHours / 24));
  const penalty = cutoffPassed ? 1 : 0;
  d.setUTCDate(d.getUTCDate() + leadDays + penalty);
  return d;
}

export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** True if `requested` (YYYY-MM-DD) satisfies the item's lead time. */
export function isDeliveryDateValid(
  requested: string,
  now: Date,
  cutoffPassed: boolean,
  leadTimeHours: number,
): boolean {
  return requested >= dateOnly(earliestDeliveryDate(now, cutoffPassed, leadTimeHours));
}

export interface CartValidation {
  ok: boolean;
  errors: string[];
}

/** Validates every cart item's lead time against the requested delivery date. */
export function validateCart(
  items: CartItem[],
  requestedDeliveryDate: string,
  now: Date,
  cutoffPassed: boolean,
): CartValidation {
  const errors: string[] = [];
  if (items.length === 0) errors.push("Cart is empty.");
  for (const it of items) {
    if (it.quantity <= 0) errors.push(`Quantity must be positive for ${it.product_id}.`);
    if (!isDeliveryDateValid(requestedDeliveryDate, now, cutoffPassed, it.lead_time_hours)) {
      errors.push(
        `${it.product_id} needs ${it.lead_time_hours}h lead time; ` +
          `earliest delivery ${dateOnly(earliestDeliveryDate(now, cutoffPassed, it.lead_time_hours))}.`,
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Split a cart into one group per category — one order per specialist (§8.2). */
export function splitByCategory(items: CartItem[]): Record<string, CartItem[]> {
  const groups: Record<string, CartItem[]> = {};
  for (const it of items) (groups[it.category_id] ??= []).push(it);
  return groups;
}
