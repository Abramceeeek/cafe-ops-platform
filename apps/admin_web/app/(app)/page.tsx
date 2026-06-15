import Link from "next/link";
import { PlusCircle, CalendarRange, ChevronRight, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { CutoffCountdown } from "@/components/cutoff-countdown";

export const dynamic = "force-dynamic";

const SHOP_ROLES = ["foh_manager", "kitchen_manager"];
const ACTIVE = [
  "pending_request", "specialist_approved", "shop_confirmed",
  "in_progress", "packaged", "ready_for_courier", "in_transit",
];
const ROLE_TITLE: Record<string, string> = {
  foh_manager: "FOH Manager",
  kitchen_manager: "Kitchen Manager",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function shopShort(name: string) {
  const m = name.split(/[—–-]/);
  return (m[m.length - 1] ?? name).trim();
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}


interface OrderRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  order_items: { quantity: number; products: { product_categories: { name: string } | null } | null }[];
}

function categoryOf(o: OrderRow): string {
  return o.order_items?.[0]?.products?.product_categories?.name ?? "Order";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role, shop_id, full_name, shops(name)").eq("id", user.id).single()
    : { data: null };
  const role = profile?.role as string | undefined ?? "unknown";
  const name = profile?.full_name || "Unknown User";
  const shopName = (profile?.shops as { name?: string })?.name || "Central Hub";

  // ── Shop (FOH / BOH) redesigned home ──
  if (role && SHOP_ROLES.includes(role)) {
    const { data: cfg } = await supabase
      .from("cutoff_config")
      .select("cutoff_time")
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cutoffHour = parseInt((cfg?.cutoff_time ?? "16:00:00").split(":")[0], 10);

    const { data } = await supabase
      .from("orders")
      .select(`id, status, requested_delivery_date,
               order_items ( quantity, products ( product_categories ( name ) ) )`)
      .in("status", ACTIVE)
      .order("requested_delivery_date", { ascending: true });
    const orders = (data ?? []) as unknown as OrderRow[];
    const needsAction = orders.filter((o) => o.status === "specialist_approved");
    const active = orders.filter((o) => o.status !== "specialist_approved");

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <CutoffCountdown cutoffHour={cutoffHour} />

        <div className="grid grid-cols-2 gap-3">
          <Button asChild className="h-24 flex-col items-start justify-between rounded-2xl p-4">
            <Link href="/request">
              <PlusCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">New Request</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="h-24 flex-col items-start justify-between rounded-2xl p-4"
          >
            <Link href="/standing-orders">
              <CalendarRange className="h-5 w-5" />
              <span className="text-sm font-semibold">Standing Orders</span>
            </Link>
          </Button>
        </div>

        <section>
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <h2 className="font-display text-lg">Recently approved</h2>
            {needsAction.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ color: "var(--st-pend)", background: "var(--st-pend-bg)" }}
              >
                {needsAction.length}
              </span>
            )}
          </div>
          {needsAction.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No recent approvals.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {needsAction.map((o) => (
                <Card key={o.id} className="overflow-hidden" style={{ borderColor: "var(--st-pend-line)" }}>
                  <div style={{ height: 3, background: "var(--st-pend)" }} />
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        #{o.id.slice(0, 4).toUpperCase()} · {categoryOf(o)}
                      </span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="text-sm font-semibold">Hub approved &amp; priced your request</p>
                    <p className="text-xs text-muted-foreground">
                      Now in production · delivery {fmtDate(o.requested_delivery_date)}
                    </p>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/orders">
                        View order <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <h2 className="font-display text-lg">Active orders</h2>
            <span className="text-sm font-semibold text-muted-foreground">{active.length} live</span>
          </div>
          {active.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No active orders. <Link href="/request" className="font-medium text-primary">Start a request →</Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {active.map((o) => (
                <Card key={o.id}>
                  <CardContent className="flex items-center justify-between py-3.5">
                    <div>
                      <div className="text-sm font-semibold">{categoryOf(o)}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        #{o.id.slice(0, 4).toUpperCase()} · {fmtDate(o.requested_delivery_date)}
                      </div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── Non-shop roles: operations stat overview ──
  const { data } = await supabase.from("orders").select("status");
  const orders = data ?? [];
  const count = (statuses: string[]) => orders.filter((o) => statuses.includes(o.status as string)).length;
  const needsActionCount = count(["pending_request"]);
  const stats = [
    { label: "Active orders", value: count(ACTIVE) },
    { label: "Awaiting approval", value: needsActionCount },
    { label: "In transit", value: count(["in_transit"]) },
    { label: "Delivered", value: count(["delivered"]) },
  ];

  return (
    <div className="mx-auto max-w-md space-y-4 pb-8">
      {/* App bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent bg-accent text-sm font-bold text-accent-foreground">
            {initials(name)}
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold">{shopShort(shopName)}</div>
            <div className="text-xs text-muted-foreground">
              {name} · {ROLE_TITLE[role]}
            </div>
          </div>
        </div>
        <Link
          href="/orders"
          aria-label="Orders"
          className="relative grid h-9 w-9 place-items-center text-foreground/80"
        >
          <Bell className="h-5 w-5" />
          {needsActionCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
              {needsActionCount}
            </span>
          )}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
