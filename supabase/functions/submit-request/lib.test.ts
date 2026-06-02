import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  dateOnly,
  earliestDeliveryDate,
  isDeliveryDateValid,
  splitByCategory,
  validateCart,
  type CartItem,
} from "./lib.ts";

const MON = new Date("2026-06-01T15:00:00Z"); // a Monday

Deno.test("24h lead before cut-off → earliest is Wednesday", () => {
  assertEquals(dateOnly(earliestDeliveryDate(MON, false, 24)), "2026-06-03");
});

Deno.test("48h lead before cut-off → earliest is Thursday (spec example)", () => {
  assertEquals(dateOnly(earliestDeliveryDate(MON, false, 48)), "2026-06-04");
});

Deno.test("after cut-off pushes a day further", () => {
  assertEquals(dateOnly(earliestDeliveryDate(MON, true, 48)), "2026-06-05");
});

Deno.test("isDeliveryDateValid enforces the boundary", () => {
  assertEquals(isDeliveryDateValid("2026-06-03", MON, false, 48), false); // too early
  assertEquals(isDeliveryDateValid("2026-06-04", MON, false, 48), true); // exact
});

Deno.test("validateCart rejects too-early date and empty cart", () => {
  const items: CartItem[] = [
    { product_id: "sourdough", category_id: "bread", quantity: 2, lead_time_hours: 48 },
  ];
  assertEquals(validateCart(items, "2026-06-02", MON, false).ok, false);
  assertEquals(validateCart(items, "2026-06-04", MON, false).ok, true);
  assertEquals(validateCart([], "2026-06-10", MON, false).ok, false);
});

Deno.test("splitByCategory creates one group per category (§8.2)", () => {
  const items: CartItem[] = [
    { product_id: "lamb", category_id: "meat", quantity: 1, lead_time_hours: 24 },
    { product_id: "croissant", category_id: "pastry", quantity: 12, lead_time_hours: 24 },
    { product_id: "beef", category_id: "meat", quantity: 3, lead_time_hours: 24 },
  ];
  const groups = splitByCategory(items);
  assertEquals(Object.keys(groups).sort(), ["meat", "pastry"]);
  assertEquals(groups.meat.length, 2);
  assertEquals(groups.pastry.length, 1);
});
