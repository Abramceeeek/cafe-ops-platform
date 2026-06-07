"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, MapPin, Navigation, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { updateOrderStatus } from "@/app/actions/orders";

interface ManifestRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  shops: { name: string; address: string | null } | null;
  order_items: {
    quantity: number;
    unit: string;
    products: { name: string; product_categories: { name: string } | null } | null;
  }[];
}

// Full production pipeline the courier should be aware of for a delivery date —
// not just "ready". Lets the courier see what's coming and whether it's done.
const PIPELINE = ["shop_confirmed", "in_progress", "packaged", "ready_for_courier", "in_transit"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface OrderCard {
  id: string;
  status: string;
  cat: string;
  lines: { name: string; qty: number; unit: string }[];
}
interface Stop {
  shop: string;
  address: string | null;
  orders: OrderCard[];
  readyIds: string[];
}

function groupByBranch(rows: ManifestRow[]): Stop[] {
  const byShop = new Map<string, Stop>();
  for (const r of rows) {
    const shop = r.shops?.name ?? "Shop";
    let g = byShop.get(shop);
    if (!g) {
      g = { shop, address: r.shops?.address ?? null, orders: [], readyIds: [] };
      byShop.set(shop, g);
    }
    g.orders.push({
      id: r.id,
      status: r.status,
      cat: r.order_items[0]?.products?.product_categories?.name ?? "Order",
      lines: r.order_items.map((it) => ({
        name: it.products?.name ?? "Item",
        qty: Number(it.quantity),
        unit: it.unit,
      })),
    });
    if (r.status === "ready_for_courier") g.readyIds.push(r.id);
  }
  return Array.from(byShop.values()).sort((a, b) => a.shop.localeCompare(b.shop));
}

export default function ManifestPage() {
  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [day, setDay] = useState<"today" | "tomorrow">("today");

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date,
         shops ( name, address ),
         order_items ( quantity, unit, products ( name, product_categories ( name ) ) )`,
      )
      .in("status", PIPELINE)
      .order("requested_delivery_date", { ascending: true });
    setRows((data ?? []) as unknown as ManifestRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { todayStr, tomorrowStr } = useMemo(() => {
    const now = new Date();
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return { todayStr: ymd(now), tomorrowStr: ymd(t) };
  }, []);

  const target = day === "today" ? todayStr : tomorrowStr;
  const stops = groupByBranch(rows.filter((r) => r.requested_delivery_date === target));
  const counts = {
    today: rows.filter((r) => r.requested_delivery_date === todayStr).length,
    tomorrow: rows.filter((r) => r.requested_delivery_date === tomorrowStr).length,
  };

  const totalItems = stops.reduce((n, s) => n + s.orders.reduce((m, o) => m + o.lines.reduce((k, l) => k + l.qty, 0), 0), 0);
  const readyStops = stops.filter((s) => s.readyIds.length > 0).length;

  const addresses = Array.from(new Set(stops.map((s) => s.address).filter((a): a is string => !!a)));
  const routeUrl =
    addresses.length > 0 ? "https://www.google.com/maps/dir/" + addresses.map(encodeURIComponent).join("/") : null;

  async function pickup(stop: Stop) {
    if (stop.readyIds.length === 0) return;
    let ok = 0;
    for (const id of stop.readyIds) {
      const res = await updateOrderStatus({ order_id: id, new_status: "in_transit" });
      if (res.error) toast.error(`${stop.shop}: ${res.error}${res.details ? " — " + res.details : ""}`);
      else ok++;
    }
    if (ok) toast.success(`${stop.shop}: ${ok} order${ok > 1 ? "s" : ""} picked up`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl">Today&rsquo;s Route</h1>
          <p className="text-sm text-muted-foreground">All deliveries for {day} · with production status</p>
        </div>
        <button onClick={() => void load()} aria-label="Refresh" className="grid h-9 w-9 place-items-center text-muted-foreground">
          <RefreshCw className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="inline-flex rounded-full border bg-secondary p-1 text-sm">
        {(["today", "tomorrow"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-full px-4 py-1.5 font-semibold capitalize transition-colors ${
              day === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {d} ({counts[d]})
          </button>
        ))}
      </div>

      {stops.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div className="flex gap-6">
            {[
              [String(stops.length), "stops"],
              [String(totalItems), "items"],
              [`${readyStops}/${stops.length}`, "ready"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-mono font-display text-xl">{v}</div>
                <div className="text-[11px] text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          {routeUrl && (
            <a
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Navigation className="h-4 w-4" /> Maps
            </a>
          )}
        </div>
      )}

      {stops.length === 0 && (
        <div className="rounded-2xl border bg-card py-10 text-center text-sm text-muted-foreground">
          Nothing scheduled for {day}.
        </div>
      )}

      {stops.map((s) => {
        const allReady = s.readyIds.length === s.orders.length;
        return (
          <div
            key={s.shop}
            className="overflow-hidden rounded-2xl border bg-card"
            style={s.readyIds.length > 0 ? { borderColor: "var(--primary)" } : undefined}
          >
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-[15.5px] font-bold">{s.shop}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {s.orders.length} order{s.orders.length > 1 ? "s" : ""}
                </span>
              </div>
              {s.address && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {s.address}
                </p>
              )}
            </div>

            {/* Each order with its production status, so the courier sees readiness */}
            <div className="divide-y divide-border">
              {s.orders.map((o) => (
                <div key={o.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{o.cat}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[13px] text-foreground/80">
                    {o.lines.map((l, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{l.name}</span>
                        <span className="font-mono">{l.qty} {l.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              {s.readyIds.length > 0 ? (
                <button
                  onClick={() => void pickup(s)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                >
                  <Check className="h-4 w-4" /> Confirm pickup ({s.readyIds.length} ready
                  {allReady ? "" : ` of ${s.orders.length}`})
                </button>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-sm font-semibold text-muted-foreground">
                  Not ready yet — still in production
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
