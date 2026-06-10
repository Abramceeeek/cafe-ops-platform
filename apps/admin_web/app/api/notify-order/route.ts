// Order push-notification endpoint. Called by the Supabase Database Webhook on
// orders status changes (covers both web actions and mobile RPCs, since both
// land in the same table). Verifies a shared secret, resolves the recipients
// for the new status, and sends FCM pushes via the service account.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/fcm";

export const runtime = "nodejs";

interface OrderRow {
  id: string;
  status: string;
  submitted_by: string | null;
  shop_id: string | null;
  requested_delivery_date: string | null;
}

function messageFor(status: string, date: string): { title: string; body: string } | null {
  switch (status) {
    case "pending_request":
      return { title: "New order request", body: `A new order for ${date} needs your review.` };
    case "specialist_approved":
      return { title: "Order approved", body: `Your order for ${date} was approved by the Hub.` };
    case "rejected":
      return { title: "Order declined", body: `Your order for ${date} was declined — check the app for the reason.` };
    case "ready_for_courier":
      return { title: "Order ready for pickup", body: `An order for ${date} is ready for delivery.` };
    case "in_transit":
      return { title: "Out for delivery", body: `Your order for ${date} is on the way.` };
    case "delivered":
      return { title: "Delivered", body: `Your order for ${date} was delivered.` };
    default:
      return null;
  }
}

export async function POST(req: Request) {
  if (req.headers.get("x-notify-secret") !== process.env.NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const rec: OrderRow | undefined = payload?.record ?? payload;
  const old: OrderRow | undefined = payload?.old_record;
  if (!rec?.status || !rec.id) return NextResponse.json({ skipped: "no record" });
  if (old && old.status === rec.status) return NextResponse.json({ skipped: "status unchanged" });

  const msg = messageFor(rec.status, rec.requested_delivery_date ?? "");
  if (!msg) return NextResponse.json({ skipped: "no notification for status" });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Recipients by status:
  //  - pending_request   → the specialist(s) who own the order's category (Hub Inbox)
  //  - ready_for_courier → all active couriers
  //  - everything else   → the shop submitter
  let tokens: (string | null)[] = [];
  if (rec.status === "pending_request") {
    const { data: items } = await admin
      .from("order_items")
      .select("products(product_categories(assigned_role))")
      .eq("order_id", rec.id)
      .limit(1);
    const assignedRole = (items?.[0] as { products?: { product_categories?: { assigned_role?: string } } } | undefined)
      ?.products?.product_categories?.assigned_role;
    if (assignedRole) {
      const { data } = await admin
        .from("profiles")
        .select("fcm_token")
        .eq("role", assignedRole)
        .eq("is_active", true);
      tokens = (data ?? []).map((p) => p.fcm_token as string | null);
    }
  } else if (rec.status === "ready_for_courier") {
    const { data } = await admin
      .from("profiles")
      .select("fcm_token")
      .eq("role", "courier")
      .eq("is_active", true);
    tokens = (data ?? []).map((p) => p.fcm_token as string | null);
  } else if (rec.submitted_by) {
    const { data } = await admin.from("profiles").select("fcm_token").eq("id", rec.submitted_by).single();
    tokens = [(data?.fcm_token as string | null) ?? null];
  }

  const result = await sendPush(tokens, msg.title, msg.body, { order_id: rec.id, status: rec.status });
  return NextResponse.json({ ok: true, ...result });
}
