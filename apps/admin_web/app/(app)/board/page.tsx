"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Truck, Printer, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { updateOrderStatus } from "@/app/actions/orders";

interface Row {
  id: string;
  status: string;
  requested_delivery_date: string;
  shops: { name: string } | null;
  order_items: {
    quantity: number;
    unit: string;
    products: { name: string; product_categories: { assigned_role: string } | null } | null;
  }[];
}

// Working set the specialist plans deliveries from. in_progress/packaged are
// legacy stages kept visible so old rows still surface.
const STATUSES = ["specialist_approved", "in_progress", "packaged", "ready_for_courier", "in_transit", "delivered"];
const WINDOW_DAYS = 15;

// specialist "mark ready for delivery" target per status (legacy stages collapse to ready).
const NEXT: Record<string, string> = {
  specialist_approved: "ready_for_courier",
  in_progress: "packaged",
  packaged: "ready_for_courier",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Bucket {
  key: string;
  label: string;
  match: (r: Row) => boolean;
}

function buildBuckets(todayStr: string): Bucket[] {
  const out: Bucket[] = [
    { key: "overdue", label: "Overdue", match: (r) => r.requested_delivery_date < todayStr && r.status !== "delivered" },
  ];
  const now = new Date(todayStr + "T00:00:00");
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const str = ymd(d);
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    out.push({ key: str, label, match: (r) => r.requested_delivery_date === str });
  }
  return out;
}

export default function BoardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState("");
  const [sel, setSel] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((p?.role as string) ?? "");
    }
    const { data } = await supabase
      .from("orders")
      .select(
        `id, status, requested_delivery_date,
         shops ( name ),
         order_items ( quantity, unit, products ( name, product_categories ( assigned_role ) ) )`,
      )
      .in("status", STATUSES)
      .order("requested_delivery_date", { ascending: true });
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayStr = useMemo(() => ymd(new Date()), []);
  const buckets = useMemo(() => buildBuckets(todayStr), [todayStr]);

  const mineItems = (r: Row) => r.order_items.filter((i) => i.products?.product_categories?.assigned_role === role);
  const visible = rows.filter((r) => mineItems(r).length > 0);

  // Drop empty buckets (esp. Overdue), default-select the first non-empty.
  const live = buckets.map((b) => ({ ...b, orders: visible.filter(b.match) })).filter((b) => b.orders.length > 0);
  const active = live.find((b) => b.key === sel) ?? live.find((b) => b.key === todayStr) ?? live[0];

  async function markReady(id: string, from: string) {
    const to = NEXT[from];
    if (!to) return;
    const res = await updateOrderStatus({ order_id: id, new_status: to });
    if (res.error) return toast.error(res.error + (res.details ? ": " + res.details : ""));
    toast.success(to === "ready_for_courier" ? "Ready for delivery" : "Advanced");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl">Schedule</h1>
          <p className="text-sm text-muted-foreground">Approved orders by delivery day · next {WINDOW_DAYS} days</p>
        </div>
        <button onClick={() => void load()} aria-label="Refresh" className="grid h-9 w-9 place-items-center text-muted-foreground">
          <RefreshCw className="h-[18px] w-[18px]" />
        </button>
      </div>

      {live.length === 0 && (
        <div className="rounded-2xl border bg-card py-10 text-center text-sm text-muted-foreground">
          No upcoming orders.
        </div>
      )}

      {live.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {live.map((b) => {
            const on = (active?.key ?? "") === b.key;
            return (
              <button
                key={b.key}
                onClick={() => setSel(b.key)}
                className={
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
                  (on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-foreground/80")
                }
              >
                {b.label} ({b.orders.length})
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
              {active.label} · {active.orders.length} order{active.orders.length !== 1 ? "s" : ""}
            </span>
            {active.key !== "overdue" && (
              <a
                href={`/print?date=${active.key}&role=specialist`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-bold text-primary"
              >
                <Printer className="h-3.5 w-3.5" /> Print day
              </a>
            )}
          </div>

          <div className="space-y-2.5">
            {active.orders.map((r) => {
              const next = NEXT[r.status];
              return (
                <div key={r.id} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold">{r.shops?.name ?? "Shop"}</span>
                      <span className="font-mono text-xs text-muted-foreground">#{r.id.slice(0, 4).toUpperCase()}</span>
                    </div>
                    <OrderStatusBadge status={r.status} />
                  </div>
                  <div className="space-y-0.5 px-4 py-3 text-[13px] text-foreground/80">
                    {mineItems(r).map((i, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{i.products?.name}</span>
                        <span className="font-mono">{i.quantity} {i.unit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border p-3">
                    {next ? (
                      <button
                        onClick={() => void markReady(r.id, r.status)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                      >
                        <Check className="h-4 w-4" /> Mark ready for delivery
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--st-ready)" }}>
                        <Truck className="h-3.5 w-3.5" />
                        {r.status === "delivered" ? "Delivered" : "With courier"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
