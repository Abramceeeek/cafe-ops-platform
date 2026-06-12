// Cut-off reminder. Hit ~once daily before the 16:00 London cut-off by a pg_cron
// schedule (see supabase/manual/notify-crons.sql). Pushes the FOH/Kitchen
// managers whose shop has NOT yet placed a confirmed order for tomorrow.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/fcm";

export const runtime = "nodejs";

// A shop counts as "sorted for tomorrow" once an order reaches shop_confirmed.
const CONFIRMED_STATUSES = ["shop_confirmed", "in_progress", "packaged", "ready_for_courier", "in_transit", "delivered"];

function tomorrowLondon(now: Date): string {
  const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(t);
}

export async function POST(req: Request) {
  if (req.headers.get("x-notify-secret") !== process.env.NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const tomorrow = tomorrowLondon(new Date());

  const { data: managers } = await admin
    .from("profiles")
    .select("fcm_token, shop_id")
    .in("role", ["foh_manager", "kitchen_manager"])
    .eq("is_active", true)
    .not("shop_id", "is", null);

  const { data: confirmed } = await admin
    .from("orders")
    .select("shop_id")
    .eq("requested_delivery_date", tomorrow)
    .in("status", CONFIRMED_STATUSES);

  const sortedShops = new Set((confirmed ?? []).map((o) => o.shop_id as string));
  const tokens = (managers ?? [])
    .filter((m) => !sortedShops.has(m.shop_id as string))
    .map((m) => m.fcm_token as string | null);

  if (tokens.filter(Boolean).length === 0) return NextResponse.json({ ok: true, pushed: 0 });

  const res = await sendPush(
    tokens,
    "Cut-off coming up",
    `Place your order for ${tomorrow} before 16:00 — your shop hasn't ordered yet.`,
    { kind: "cutoff_reminder" },
  );
  return NextResponse.json({ ok: true, pushed: res.sent });
}
