"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronRight, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/app/actions/orders";

interface BoardRow {
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

const COLUMNS: { status: string; label: string }[] = [
  { status: "shop_confirmed", label: "Confirmed" },
  { status: "in_progress", label: "In Production" },
  { status: "packaged", label: "Packaged" },
  { status: "ready_for_courier", label: "Ready" },
];

const NEXT: Record<string, string> = {
  shop_confirmed: "in_progress",
  in_progress: "packaged",
  packaged: "ready_for_courier",
};

function urgency(date: string): { key: string; label: string } {
  const today = new Date();
  const days = Math.round(
    (new Date(date + "T00:00:00").getTime() - new Date(today.toDateString()).getTime()) / 86400000,
  );
  if (days <= 0) return { key: "bad", label: "Today" };
  if (days === 1) return { key: "pend", label: "Tomorrow" };
  return { key: "done", label: "2+ days" };
}

export default function BoardPage() {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [role, setRole] = useState("");

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
      .in(
        "status",
        COLUMNS.map((c) => c.status),
      )
      .order("requested_delivery_date", { ascending: true });
    setRows((data ?? []) as unknown as BoardRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function advance(orderId: string, to: string) {
    const response = await updateOrderStatus({ order_id: orderId, new_status: to });
    if (response.error) {
      return toast.error(response.error + (response.details ? ": " + response.details : ""));
    }
    toast.success("Advanced");
    await load();
  }

  const mineItems = (r: BoardRow) =>
    r.order_items.filter((i) => i.products?.product_categories?.assigned_role === role);
  const visible = rows.filter((r) => mineItems(r).length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl">Production Board</h1>
          <p className="text-sm text-muted-foreground">Your category · live</p>
        </div>
        <button onClick={() => void load()} aria-label="Refresh" className="grid h-9 w-9 place-items-center text-muted-foreground">
          <RefreshCw className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Urgency legend */}
      <div className="flex gap-4 px-0.5 text-xs font-semibold text-muted-foreground">
        {[
          ["bad", "Today"],
          ["pend", "Tomorrow"],
          ["done", "2+ days"],
        ].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--st-${k})` }} />
            {l}
          </span>
        ))}
      </div>

      {/* Columns — horizontal scroll on the phone shell (design is a wide wall display) */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-3" style={{ minWidth: "min-content" }}>
          {COLUMNS.map((col) => {
            const cards = visible.filter((r) => r.status === col.status);
            return (
              <div
                key={col.status}
                className="flex w-[250px] shrink-0 flex-col rounded-2xl border bg-card"
              >
                <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
                  <span className="text-sm font-bold">{col.label}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 p-3">
                  {cards.length === 0 && (
                    <p className="py-5 text-center text-xs text-muted-foreground">—</p>
                  )}
                  {cards.map((r) => {
                    const u = urgency(r.requested_delivery_date);
                    const next = NEXT[r.status];
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border bg-secondary/60 p-3"
                        style={{ borderLeft: `4px solid var(--st-${u.key})` }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{r.shops?.name ?? "Shop"}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            #{r.id.slice(0, 4).toUpperCase()}
                          </span>
                        </div>
                        <span
                          className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide"
                          style={{ color: `var(--st-${u.key})`, background: `var(--st-${u.key}-bg)` }}
                        >
                          {u.label}
                        </span>
                        <div className="mt-2 space-y-0.5 text-[12.5px] text-foreground/80">
                          {mineItems(r).map((i, idx) => (
                            <div key={idx}>
                              {i.products?.name} · {i.quantity} {i.unit}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2.5 border-t border-border pt-2">
                          {next ? (
                            <button
                              onClick={() => void advance(r.id, next)}
                              className="flex items-center gap-1 text-[12px] font-bold text-primary"
                            >
                              Advance <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[12px] font-bold" style={{ color: "var(--st-ready)" }}>
                              <Truck className="h-3.5 w-3.5" /> queued
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
