import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canTransition, roleAllowed, STATUS_TIMESTAMP } from "./lib.ts";

Deno.test("valid transitions allowed", () => {
  assertEquals(canTransition("pending_request", "specialist_approved"), true);
  assertEquals(canTransition("specialist_approved", "shop_confirmed"), true);
  assertEquals(canTransition("in_transit", "delivered"), true);
});

Deno.test("invalid transitions rejected (spec §7.3)", () => {
  assertEquals(canTransition("pending_request", "in_progress"), false); // bypasses handshake
  assertEquals(canTransition("shop_confirmed", "pending_request"), false); // no rollback
  assertEquals(canTransition("delivered", "in_transit"), false); // terminal
  assertEquals(canTransition("rejected", "specialist_approved"), false); // terminal
});

Deno.test("role gating per target status", () => {
  assertEquals(roleAllowed("specialist_approved", "meat_specialist"), true);
  assertEquals(roleAllowed("specialist_approved", "foh_manager"), false);
  assertEquals(roleAllowed("shop_confirmed", "foh_manager"), true);
  assertEquals(roleAllowed("in_transit", "courier"), true);
  assertEquals(roleAllowed("delivered", "kitchen_manager"), true);
  assertEquals(roleAllowed("anything", "admin"), false); // admin only where listed
});

Deno.test("timestamp columns mapped", () => {
  assertEquals(STATUS_TIMESTAMP.delivered, "delivered_at");
  assertEquals(STATUS_TIMESTAMP.shop_confirmed, "shop_confirmed_at");
});
