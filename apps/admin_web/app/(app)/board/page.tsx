"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  { status: "in_progress", label: "In progress" },
  { status: "packaged", label: "Packaged" },
  { status: "ready_for_courier", label: "Ready" },
];

const NEXT: Record<string, { to: string; label: string }> = {
  shop_confirmed: { to: "in_progress", label: "Start" },
  in_progress: { to: "packaged", label: "Mark packaged" },
  packaged: { to: "ready_for_courier", label: "Mark ready" },
};

function urgency(date: string): string {
  const today = new Date();
  const d = new Date(date + "T00:00:00");
  const days = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
  if (days <= 0) return "border-l-red-500";
  if (days === 1) return "border-l-amber-500";
  return "border-l-emerald-500";
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
      .in("status", COLUMNS.map((c) => c.status))
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
    await load();
  }

  const mineItems = (r: BoardRow) =>
    r.order_items.filter((i) => i.products?.product_categories?.assigned_role === role);
  const visible = rows.filter((r) => mineItems(r).length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">To-Do Board</h1>
          <p className="text-sm text-muted-foreground">Production queue for your category.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = visible.filter((r) => r.status === col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-muted-foreground">{cards.length}</span>
              </div>
              {cards.map((r) => {
                const next = NEXT[r.status];
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-md border border-l-4 bg-card p-3 shadow-sm",
                      urgency(r.requested_delivery_date),
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{r.shops?.name ?? "Shop"}</span>
                      <span className="text-xs text-muted-foreground">{r.requested_delivery_date}</span>
                    </div>
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {mineItems(r).map((i, idx) => (
                        <li key={idx}>
                          {i.products?.name} × {i.quantity} {i.unit}
                        </li>
                      ))}
                    </ul>
                    {next && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => void advance(r.id, next.to)}
                      >
                        {next.label}
                      </Button>
                    )}
                  </div>
                );
              })}
              {cards.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
