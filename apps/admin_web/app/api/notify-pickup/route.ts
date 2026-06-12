// Pickup reminder. Hit ~once daily (early afternoon) by a pg_cron schedule
// (see supabase/manual/notify-crons.sql). If orders are marked ready_for_courier
// for today-or-earlier but haven't been collected, nudge the courier(s).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/fcm";

export const runtime = "nodejs";

function todayLondon(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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

  const today = todayLondon(new Date());

  const { data: waiting } = await admin
    .from("orders")
    .select("id")
    .eq("status", "ready_for_courier")
    .lte("requested_delivery_date", today);

  const count = (waiting ?? []).length;
  if (count === 0) return NextResponse.json({ ok: true, pushed: 0 });

  const { data: couriers } = await admin
    .from("profiles")
    .select("fcm_token")
    .eq("role", "courier")
    .eq("is_active", true);
  const tokens = (couriers ?? []).map((p) => p.fcm_token as string | null);

  const res = await sendPush(
    tokens,
    "Orders waiting for pickup",
    `${count} order${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} ready and waiting to be collected.`,
    { kind: "pickup_reminder", count: String(count) },
  );
  return NextResponse.json({ ok: true, pushed: res.sent });
}
