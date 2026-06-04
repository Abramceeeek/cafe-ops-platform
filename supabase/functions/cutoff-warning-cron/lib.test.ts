import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { managersToWarn, tomorrowDate, type Manager } from "./lib.ts";

Deno.test("tomorrowDate rolls to the next day", () => {
  assertEquals(tomorrowDate(new Date("2026-06-01T15:00:00Z")), "2026-06-02");
  assertEquals(tomorrowDate(new Date("2026-06-30T23:00:00Z")), "2026-07-02");
});

Deno.test("managersToWarn excludes shops already confirmed for tomorrow", () => {
  const managers: Manager[] = [
    { id: "m1", shop_id: "A" },
    { id: "m2", shop_id: "B" },
    { id: "m3", shop_id: "C" },
  ];
  const warned = managersToWarn(managers, ["B"]);
  assertEquals(warned.map((m) => m.id), ["m1", "m3"]);
});

Deno.test("managersToWarn warns everyone when no shop is sorted", () => {
  const managers: Manager[] = [{ id: "m1", shop_id: "A" }];
  assertEquals(managersToWarn(managers, []).length, 1);
});

Deno.test("managersToWarn warns no one when all shops sorted", () => {
  const managers: Manager[] = [{ id: "m1", shop_id: "A" }, { id: "m2", shop_id: "B" }];
  assertEquals(managersToWarn(managers, ["A", "B"]).length, 0);
});
