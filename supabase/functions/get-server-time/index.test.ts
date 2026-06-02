import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { serverTime } from "./index.ts";

Deno.test("serverTime returns an ISO timestamp", () => {
  const fixed = new Date("2026-06-02T12:00:00.000Z");
  assertEquals(serverTime(fixed).now, "2026-06-02T12:00:00.000Z");
});
