// Pure helpers for the monthly statement — ROADMAP 4.2. Testable.

export function previousMonth(now: Date): { year: number; month: number } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

// [start, end) ISO bounds for a given year/month (1-12).
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function sumByShop(
  rows: { shop_id: string; total_cost: number | null }[],
): Record<string, { total: number; count: number }> {
  const out: Record<string, { total: number; count: number }> = {};
  for (const r of rows) {
    const cur = out[r.shop_id] ?? { total: 0, count: 0 };
    cur.total += r.total_cost ?? 0;
    cur.count += 1;
    out[r.shop_id] = cur;
  }
  return out;
}
