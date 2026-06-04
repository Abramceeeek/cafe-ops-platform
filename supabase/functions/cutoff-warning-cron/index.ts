// cutoff-warning-cron Edge Function — ROADMAP 4.4, PROJECT_SPEC §13.
// Computes which active shop managers have NOT yet placed a confirmed order for
// tomorrow's delivery, so they can be nudged 30 min before cut-off.
//
// Channel note: FCM push lands with the native apps (Stage E); the in-app bell
// listens to order changes, not this job. For now the function returns the
// target list and logs it — a manual trigger has NO side effects on data
// (satisfies the 4.4 DoD). Attach the FCM/email send where marked once available.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONFIRMED_STATUSES, managersToWarn, tomorrowDate, type Manager } from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const tomorrow = tomorrowDate(new Date());

    const { data: managers, error: mErr } = await supabase
      .from("profiles")
      .select("id, shop_id")
      .in("role", ["foh_manager", "kitchen_manager"])
      .eq("is_active", true)
      .not("shop_id", "is", null);
    if (mErr) throw mErr;

    const { data: confirmed, error: cErr } = await supabase
      .from("orders")
      .select("shop_id")
      .eq("requested_delivery_date", tomorrow)
      .in("status", CONFIRMED_STATUSES);
    if (cErr) throw cErr;

    const shopsSorted = (confirmed ?? []).map((o) => o.shop_id as string);
    const warn = managersToWarn((managers ?? []) as Manager[], shopsSorted);

    // TODO(Stage E): dispatch FCM push to warn[].id here once tokens exist.
    console.log(`cutoff-warning: tomorrow=${tomorrow} warn=${warn.length}`);

    return Response.json({ ok: true, tomorrow, warn_count: warn.length, warn: warn.map((m) => m.id) }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "internal_server_error" }, { status: 500, headers: corsHeaders });
  }
});
