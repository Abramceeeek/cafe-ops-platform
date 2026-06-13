// Overdue "mark ready" reminder. Meant to be hit once each evening by a pg_cron
// schedule (see supabase/manual/orders_overdue_cron.sql). Finds approved orders
// whose delivery is tonight-or-sooner but that the specialist hasn't marked
// ready yet, and pushes a reminder to the owning specialist(s).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/fcm";

export const runtime = "nodejs";

interface OrderRow {
  id: string;
  requested_delivery_date: string;
  order_items: { products: { product_categories: { assigned_role: string } | null } | null }[];
}

export async function POST(req: Request) {
  if (req.headers.get("x-notify-secret") !== process.env.NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    // Deadline is 23:59 the day before delivery, so anything still 'specialist_approved'
    // with a delivery date of tomorrow-or-earlier needs a reminder tonight.
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const cutoff = tomorrow.toISOString().slice(0, 10);

    const { data } = await admin
      .from("orders")
      .select("id, requested_delivery_date, order_items(products(product_categories(assigned_role)))")
      .eq("status", "specialist_approved")
      .lte("requested_delivery_date", cutoff);

    const orders = (data ?? []) as unknown as OrderRow[];
    if (orders.length === 0) return NextResponse.json({ ok: true, reminders: 0 });

    // Count outstanding orders per owning specialist role.
    const perRole: Record<string, number> = {};
    for (const o of orders) {
      const role = o.order_items?.[0]?.products?.product_categories?.assigned_role;
      if (!role) continue;
      perRole[role] = (perRole[role] ?? 0) + 1;
    }
    const roles = Object.entries(perRole);
    if (roles.length === 0) return NextResponse.json({ ok: true, reminders: 0 });

    let pushed = 0;
    for (const [role, count] of roles) {
      const { data: profs } = await admin
        .from("profiles")
        .select("fcm_token")
        .eq("role", role)
        .eq("is_active", true);
      const tokens = (profs ?? []).map((p) => p.fcm_token as string | null);
      const res = await sendPush(
        tokens,
        "Orders not ready",
        `${count} order${count === 1 ? "" : "s"} due soon ${count === 1 ? "isn't" : "aren't"} marked ready — mark by 23:59.`,
        { kind: "overdue_reminder", count: String(count) },
      );
      pushed += res.sent;
    }

    return NextResponse.json({ ok: true, roles: roles.length, pushed });
  } catch (err) {
    console.error("notify-overdue failed:", err);
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
