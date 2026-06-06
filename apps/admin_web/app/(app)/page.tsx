import Link from "next/link";
import {
  Bell,
  Plus,
  Files,
  Flame,
  Truck,
  ChevronRight,
  Croissant,
  Beef,
  Wheat,
  Package,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { CountdownBanner } from "@/components/countdown-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const SHOP_ROLES = ["foh_manager", "kitchen_manager"];
const ACTIVE = [
  "pending_request",
  "specialist_approved",
  "shop_confirmed",
  "in_progress",
  "packaged",
  "ready_for_courier",
  "in_transit",
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

function categoryIcon(cat: string): LucideIcon {
  const c = cat.toLowerCase();
  if (c.includes("meat") || c.includes("protein")) return Beef;
  if (c.includes("bread") || c.includes("retail")) return Wheat;
  if (c.includes("pastry") || c.includes("cookie") || c.includes("cake")) return Croissant;
  return Package;
}



interface OrderRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  order_items: { quantity: number; unit_cost: number | null; products: { name: string; product_categories: { name: string } | null } | null }[];
}

function summarize(o: OrderRow) {
  const cat = o.order_items[0]?.products?.product_categories?.name ?? "Order";
  const items = o.order_items.length;
  const priced = o.order_items.length > 0 && o.order_items.every((i) => i.unit_cost != null);
  const total = priced
    ? o.order_items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0)
    : null;
  return { cat, items, total, code: o.id.slice(0, 4).toUpperCase() };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, shop_id, shops(name)")
    .eq("id", user?.id ?? "")
    .single();

  const role = (profile?.role as string) ?? "";

  // Non-shop roles keep the operations overview dashboard.
  if (!SHOP_ROLES.includes(role)) {
    const { data } = await supabase.from("orders").select("status");
    const orders = data ?? [];
    const count = (s: string[]) => orders.filter((o) => s.includes(o.status as string)).length;
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

  // ── FOH / Kitchen Home ──
  const kitchen = role === "kitchen_manager";
  const name = (profile?.full_name as string) ?? "";
  const shopRel = profile?.shops as unknown as { name: string } | { name: string }[] | null;
  const shopName = (Array.isArray(shopRel) ? shopRel[0]?.name : shopRel?.name) ?? "";

  const { data: myOrders } = await supabase
    .from("orders")
    .select(
      "id, status, requested_delivery_date, order_items ( quantity, unit_cost, products ( name, product_categories ( name ) ) )",
    )
    .eq("submitted_by", user?.id ?? "")
    .order("requested_delivery_date", { ascending: true });

  const orders = (myOrders ?? []) as unknown as OrderRow[];
  const needsAction = orders.filter((o) => o.status === "specialist_approved");
  const active = orders.filter(
    (o) => ACTIVE.includes(o.status) && o.status !== "specialist_approved",
  );

  // Kitchen 86 alert — products unavailable in this role's categories (§ C7)
  const { data: eightySix } = await supabase
    .from("products")
    .select("name")
    .eq("is_available", false)
    .limit(1);
  const off = eightySix?.[0]?.name;

  const { data: serverTime } = await supabase.functions.invoke("get-server-time");
  const serverNowStr = serverTime?.now || new Date().toISOString();

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
          {needsAction.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
              {needsAction.length}
            </span>
          )}
        </Link>
      </div>

      {/* Kitchen 86 alert */}
      {kitchen && off && (
        <div className="flex items-start gap-3 rounded-xl border p-3.5" style={{ background: "var(--st-bad-bg)", borderColor: "var(--st-bad-line)" }}>
          <Flame className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--st-bad)" }} />
          <div>
            <div className="text-sm font-bold" style={{ color: "var(--st-bad)" }}>
              {off} is 86&rsquo;d
            </div>
            <div className="mt-0.5 text-[13px] text-foreground/80">
              Out at the Hub today — adjust your orders.
            </div>
          </div>
        </div>
      )}

      {/* Cut-off countdown */}
      <CountdownBanner serverNowStr={serverNowStr} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/request"
          className="flex h-[92px] flex-col items-start justify-start gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm transition hover:brightness-105"
        >
          <Plus className="h-5 w-5" />
          <span className="text-[14.5px] font-semibold">New Request</span>
        </Link>
        <Link
          href="/templates"
          className="flex h-[92px] flex-col items-start justify-start gap-3 rounded-2xl bg-accent p-4 text-accent-foreground transition hover:brightness-[0.98]"
        >
          <Files className="h-5 w-5" />
          <span className="text-[14.5px] font-semibold">My Templates</span>
        </Link>
      </div>

      {/* Needs your action */}
      {needsAction.length > 0 && (
        <>
          <div className="mt-5 flex items-center justify-between px-0.5">
            <span className="font-display text-lg">Needs your action</span>
            <OrderStatusBadge status="specialist_approved" />
          </div>
          {needsAction.map((o) => {
            const s = summarize(o);
            return (
              <Link
                key={o.id}
                href="/orders"
                className="block w-full overflow-hidden rounded-2xl border bg-card"
                style={{ borderColor: "var(--st-pend-line)" }}
              >
                <div className="h-[3px]" style={{ background: "var(--st-pend)" }} />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{s.code} · {s.cat}
                    </span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 text-[15px] font-bold">Hub approved &amp; priced your request</div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground">
                    {s.total != null ? `£${s.total.toFixed(2)} · ` : ""}
                    {s.items} line{s.items !== 1 ? "s" : ""} · for {fmtDate(o.requested_delivery_date)}
                  </div>
                  <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
                    Review &amp; Final Confirm <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </>
      )}

      {/* Active orders */}
      <div className="mt-5 flex items-center justify-between px-0.5">
        <span className="font-display text-lg">Active orders</span>
        <span className="text-[13px] font-semibold text-muted-foreground">{active.length} live</span>
      </div>
      {active.length === 0 ? (
        <p className="px-0.5 text-sm text-muted-foreground">No active orders. Start a new request above.</p>
      ) : (
        active.map((o) => {
          const s = summarize(o);
          const Icon = categoryIcon(s.cat);
          const transit = o.status === "in_transit";
          return (
            <Link
              key={o.id}
              href="/orders"
              className="block w-full rounded-2xl border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  #{s.code} · {s.cat}
                </span>
                <OrderStatusBadge status={o.status} />
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                {transit ? (
                  <Truck className="h-[18px] w-[18px]" style={{ color: "var(--st-ready)" }} />
                ) : (
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-secondary text-foreground/70">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                )}
                <span className="text-sm font-semibold">
                  {s.items} item{s.items !== 1 ? "s" : ""} · {fmtDate(o.requested_delivery_date)}
                </span>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
