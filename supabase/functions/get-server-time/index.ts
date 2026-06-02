// get-server-time — Edge Function (Deno runtime).
// Returns authoritative server time so the Shop App can compute its clock
// offset and never trust the device clock (PROJECT_SPEC §10.1, C5).
//
// Phase 0 scaffold: hello-world + pure, testable core. Real cut-off/lead-time
// logic is Phase 2 (ROADMAP 2.2).

export function serverTime(date: Date = new Date()): { now: string } {
  return { now: date.toISOString() };
}

if (import.meta.main) {
  Deno.serve(() =>
    new Response(JSON.stringify(serverTime()), {
      headers: { "Content-Type": "application/json" },
    })
  );
}
