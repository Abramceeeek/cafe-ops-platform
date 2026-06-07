"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  ChevronRight,
  Croissant,
  Beef,
  Wheat,
  Package,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { ReceiptButton } from "@/components/receipt-button";
import { updateOrderStatus } from "@/app/actions/orders";

interface OrderRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  submitted_at: string;
  was_edited?: boolean;
  order_items: {
    quantity: number;
    requested_quantity: number | null;
    unit: string;
    unit_cost: number | null;
    products: { name: string; product_categories: { name: string } | null } | null;
  }[];
}

const FILTERS = ["All", "Active", "Delivered", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

const ACTIVE_STATUSES = [
  "pending_request",
  "specialist_approved",
  "shop_confirmed",
  "in_progress",
  "packaged",
  "ready_for_courier",
  "in_transit",
];

function categoryIcon(cat: string): LucideIcon {
  const c = cat.toLowerCase();
  if (c.includes("meat") || c.includes("smoked") || c.includes("prep")) return Beef;
  if (c.includes("bread")) return Wheat;
  if (c.includes("pastry") || c.includes("retail") || c.includes("cookie") || c.includes("cake")) return Croissant;
  return Package;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function qtyLabel(r: OrderRow) {
  const items = r.order_items;
  if (items.length === 0) return "—";
  const units = new Set(items.map((i) => i.unit));
  if (units.size === 1) {
    const sum = items.reduce((s, i) => s + Number(i.quantity), 0);
    const unit = items[0].unit;
    return `${sum} ${unit}${sum !== 1 && !unit.endsWith("s") ? "s" : ""}`;
  }
  return `${items.length} items`;
}

function category(r: OrderRow) {
  return r.order_items[0]?.products?.product_categories?.name ?? "Order";
}

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("All");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date, submitted_at, was_edited,
         order_items ( quantity, requested_quantity, unit, unit_cost, products ( name, product_categories ( name ) ) )`,
      )
      .order("requested_delivery_date", { ascending: false });
    setRows((data ?? []) as unknown as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(orderId: string, newStatus: string, ok: string) {
    const supabase = createClient();
    const response = await updateOrderStatus({ order_id: orderId, new_status: newStatus });
    if (response.error) {
      return toast.error(response.error + (response.details ? ": " + response.details : ""));
    }
    if (newStatus === "delivered") {
      await supabase.functions.invoke("generate-receipt", { body: { order_id: orderId } });
    }
    toast.success(ok);
    await load();
  }

  const match = (o: OrderRow) =>
    filter === "All" ||
    (filter === "Active" && ACTIVE_STATUSES.includes(o.status)) ||
    (filter === "Delivered" && o.status === "delivered") ||
    (filter === "Rejected" && (o.status === "rejected" || o.status === "cancelled"));

  // Group filtered rows by delivery date, preserving the date-desc order.
  const groups = useMemo(() => {
    const out: { date: string; orders: OrderRow[] }[] = [];
    for (const o of rows.filter(match)) {
      const key = o.requested_delivery_date;
      const g = out.find((x) => x.date === key);
      if (g) g.orders.push(o);
      else out.push({ date: key, orders: [o] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <h1 className="font-display text-2xl">Order History</h1>
        <button
          onClick={() => void load()}
          aria-label="Refresh"
          className="grid h-9 w-9 place-items-center text-muted-foreground"
        >
          <RefreshCw className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
              (f === filter
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-foreground/80")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="px-0.5 text-sm text-muted-foreground">Loading…</p>}

      {!loading && groups.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No {filter.toLowerCase()} orders.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.date} className="space-y-2">
          <div className="px-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
            {fmtDate(g.date)}
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {g.orders.map((o, i) => {
              const cat = category(o);
              const Icon = categoryIcon(cat);
              const actionable =
                o.status === "specialist_approved" ||
                o.status === "in_transit" ||
                o.status === "delivered";
              return (
                <div
                  key={o.id}
                  className={i < g.orders.length - 1 ? "border-b border-border" : ""}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-secondary text-foreground/70">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{cat}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span className="font-mono">#{o.id.slice(0, 4).toUpperCase()}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <span>{qtyLabel(o)}</span>
                      </div>
                    </div>
                    {o.was_edited && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide"
                        style={{ color: "var(--st-pend)", background: "var(--st-pend-bg)" }}
                      >
                        EDITED
                      </span>
                    )}
                    <OrderStatusBadge status={o.status} />
                    {!actionable && (
                      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
                    )}
                  </div>
                  {actionable && (
                    <div className="px-4 pb-3">
                      {o.status === "specialist_approved" && (
                        <>
                          <div className="mb-3 space-y-1 rounded-xl bg-secondary/60 p-3">
                            {o.was_edited && (
                              <div className="mb-1 text-[11px] font-bold" style={{ color: "var(--st-pend)" }}>
                                The Hub edited this order — review the changes below.
                              </div>
                            )}
                            {o.order_items.map((it, idx) => {
                              const changed =
                                it.requested_quantity != null &&
                                Number(it.quantity) !== Number(it.requested_quantity);
                              return (
                                <div key={idx} className="flex items-center justify-between text-[13px]">
                                  <span className="min-w-0 truncate">{it.products?.name ?? "Item"}</span>
                                  <span className="shrink-0 font-mono">
                                    {changed && (
                                      <span className="mr-1 text-muted-foreground line-through">
                                        {it.requested_quantity}
                                      </span>
                                    )}
                                    {it.quantity} {it.unit}
                                    {it.unit_cost != null && (
                                      <span className="ml-2 font-bold">
                                        £{(Number(it.unit_cost) * Number(it.quantity)).toFixed(2)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                            <div className="flex justify-between border-t border-border pt-1 text-[13px] font-bold">
                              <span>Total</span>
                              <span className="font-mono">
                                £{o.order_items
                                  .reduce((s, it) => s + Number(it.unit_cost ?? 0) * Number(it.quantity), 0)
                                  .toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => void transition(o.id, "shop_confirmed", "Order confirmed")}
                            className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                          >
                            Final Confirm
                          </button>
                        </>
                      )}
                      {o.status === "in_transit" && (
                        <button
                          onClick={() => void transition(o.id, "delivered", "Delivery confirmed")}
                          className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                        >
                          Confirm Receipt
                        </button>
                      )}
                      {o.status === "delivered" && <ReceiptButton orderId={o.id} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
