import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildReceiptModel, type RItem } from "./lib.ts";

Deno.test("totals only priced items; modifiers in description", () => {
  const items: RItem[] = [
    { name: "Lamb", modifiers: ["Leg", "Raw"], quantity: 2, unit: "kg", unit_cost: 10 },
    { name: "Bread", modifiers: [], quantity: 3, unit: "loaf", unit_cost: null },
  ];
  const m = buildReceiptModel(items);
  assertEquals(m.total, 20);
  assertEquals(m.hasCosts, true);
  assertEquals(m.lines[0].desc, "Lamb (Leg, Raw)");
  assertEquals(m.lines[0].amount, "GBP 20.00");
  assertEquals(m.lines[1].amount, "-");
});

Deno.test("no costs at all → hasCosts false, total 0", () => {
  const m = buildReceiptModel([{ name: "X", modifiers: [], quantity: 1, unit: "u", unit_cost: null }]);
  assertEquals(m.hasCosts, false);
  assertEquals(m.total, 0);
});
