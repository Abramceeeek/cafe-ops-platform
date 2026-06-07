"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/order-status-badge";

interface Row {
  id: string;
  status: string;
  requested_delivery_date: string;
  submitted_at: string;
  shops: { name: string } | null;
  order_items: { quantity: number; products: { name: string; product_categories: { name: string } | null } | null }[];
}

const COLS: { label: string; statuses: string[] }[] = [
  { label: "Pending", statuses: ["pending_request", "specialist_approved"] },
  { label: "Confirmed", statuses: ["shop_confirmed"] },
  { label: "In Production", statuses: ["in_progress", "packaged"] },
  { label: "Ready / Transit", statuses: ["ready_for_courier", "in_transit"] },
  { label: "Delivered", statuses: ["delivered"] },
];

const ACTIVE = [
  "pending_request", "specialist_approved", "shop_confirmed", "in_progress",
  "packaged", "ready_for_courier", "in_transit",
];

function category(r: Row) {
  return r.order_items[0]?.products?.product_categories?.name ?? "—";
}

export default function LiveOpsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date, submitted_at,
         shops ( name ), order_items ( quantity, products ( name, product_categories ( name ) ) )`,
      )
      .order("submitted_at", { ascending: false });
    if (error) toast.error(error.message || "Failed to load orders");
    else setRows((data ?? []) as unknown as Row[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const count = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;
  const stats: { label: string; value: number; color: string }[] = [
    { label: "Active orders", value: count(ACTIVE), color: "var(--primary)" },
    { label: "Awaiting approval", value: count(["pending_request"]), color: "var(--st-pend)" },
    { label: "In transit", value: count(["in_transit"]), color: "var(--st-ready)" },
    { label: "Delivered", value: count(["delivered"]), color: "var(--st-done)" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Live Operations</h1>
          <p className="text-sm text-muted-foreground">
            {count(ACTIVE)} active orders across every shop · updated live
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Live
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="text-[12.5px] font-semibold text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-3xl tabular-nums" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {COLS.map((col) => {
            const cards = rows.filter((r) => col.statuses.includes(r.status));
            return (
              <div key={col.label} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[13px] font-bold">{col.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{cards.length}</span>
                </div>
                {cards.map((r) => (
                  <div key={r.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-bold">{r.shops?.name ?? "Shop"}</span>
                      <OrderStatusBadge status={r.status} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{category(r)}</span>
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        #{r.id.slice(0, 4).toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-muted-foreground">—</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
