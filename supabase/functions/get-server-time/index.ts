// get-server-time — Edge Function (Deno runtime).
// Returns authoritative server time so the Shop App can compute its clock
// offset and never trust the device clock (PROJECT_SPEC §10.1, C5).
//
// Phase 0 scaffold: hello-world + pure, testable core. Real cut-off/lead-time
// logic is Phase 2 (ROADMAP 2.2).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function serverTime(date: Date = new Date()): { now: string } {
  return { now: date.toISOString() };
}

if (import.meta.main) {
  Deno.serve((req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }
    return new Response(JSON.stringify(serverTime()), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  });
}
