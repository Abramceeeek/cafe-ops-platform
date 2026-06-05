import Link from "next/link";
import { PlusCircle, Files, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { CutoffCountdown } from "@/components/cutoff-countdown";

export const dynamic = "force-dynamic";

const ACTIVE = [
  "pending_request", "specialist_approved", "shop_confirmed",
  "in_progress", "packaged", "ready_for_courier", "in_transit",
];

interface OrderRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  order_items: { quantity: number; products: { product_categories: { name: string } | null } | null }[];
}

const SHOP_ROLES = ["foh_manager", "kitchen_manager"];

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function categoryOf(o: OrderRow): string {
  return o.order_items?.[0]?.products?.product_categories?.name ?? "Order";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role, shop_id").eq("id", user.id).single()
    : { data: null };
  const role = profile?.role as string | undefined;

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
            <Link href="/templates">
              <Files className="h-5 w-5" />
              <span className="text-sm font-semibold">My Templates</span>
            </Link>
          </Button>
        </div>

        <section>
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <h2 className="font-display text-lg">Needs your action</h2>
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
                Nothing waiting on you.
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
                    <p className="text-xs text-muted-foreground">Delivery {fmtDate(o.requested_delivery_date)}</p>
                    <Button asChild className="w-full">
                      <Link href="/orders">
                        Review &amp; Final Confirm <ChevronRight className="h-4 w-4" />
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
  const stats = [
    { label: "Active orders", value: count(ACTIVE) },
    { label: "Awaiting approval", value: count(["pending_request"]) },
    { label: "In transit", value: count(["in_transit"]) },
    { label: "Delivered", value: count(["delivered"]) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Operations overview.</p>
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
