import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { monthRange, previousMonth, sumByShop } from "./lib.ts";

Deno.test("previousMonth wraps the year", () => {
  assertEquals(previousMonth(new Date("2026-01-15T00:00:00Z")), { year: 2025, month: 12 });
  assertEquals(previousMonth(new Date("2026-07-15T00:00:00Z")), { year: 2026, month: 6 });
});

Deno.test("monthRange gives half-open bounds", () => {
  const r = monthRange(2026, 6);
  assertEquals(r.start, "2026-06-01T00:00:00.000Z");
  assertEquals(r.end, "2026-07-01T00:00:00.000Z");
});

Deno.test("sumByShop totals and counts, null-safe", () => {
  const got = sumByShop([
    { shop_id: "a", total_cost: 10 },
    { shop_id: "a", total_cost: null },
    { shop_id: "b", total_cost: 5 },
  ]);
  assertEquals(got.a, { total: 10, count: 2 });
  assertEquals(got.b, { total: 5, count: 1 });
});
