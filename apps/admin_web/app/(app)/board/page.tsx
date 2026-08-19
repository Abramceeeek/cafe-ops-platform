"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Truck, Printer, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/app/actions/orders";

interface Item {
  quantity: number;
  unit: string;
  product_name: string | null;
  products: { name: string; product_categories: { name: string; assigned_role: string } | null } | null;
}
interface Row {
  id: string;
  status: string;
  requested_delivery_date: string;
  is_standing: boolean;
  shops: { name: string } | null;
  order_items: Item[];
}

// Working set the specialist plans deliveries from. in_progress/packaged are
// legacy stages kept visible so old rows still surface.
const STATUSES = ["specialist_approved", "in_progress", "packaged", "ready_for_courier", "in_transit", "delivered"];
const WINDOW_DAYS = 15;
// Statuses that still need the specialist to hand them to the courier.
const READYABLE = new Set(["specialist_approved", "in_progress", "packaged"]);

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Pastry first, then bread, then anything else — for the per-shop item ordering.
function catRank(name: string | undefined): number {
  const n = (name ?? "").toLowerCase();
  if (n.includes("pastry") || n.includes("retail")) return 0;
  if (n.includes("bread")) return 1;
  return 2;
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

// One merged line per product within a shop (standing + approved new requests summed).
interface MergedItem { name: string; unit: string; qty: number; catName: string }
interface ShopGroup {
  shopName: string;
  items: MergedItem[];
  readyable: { id: string; status: string }[]; // orders still to be handed to the courier
  withCourier: boolean;
  allDelivered: boolean;
}

export default function BoardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [role, setRole] = useState("");
  const [sel, setSel] = useState("");
  const [busyShop, setBusyShop] = useState("");

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
        `id, status, requested_delivery_date, is_standing,
         shops ( name ),
         order_items ( quantity, unit, product_name, products ( name, product_categories ( name, assigned_role ) ) )`,
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

  // Merge a day's orders into one card per shop: standing orders + approved new
  // requests for the same shop are summed per product (the baker bakes one number).
  const groups: ShopGroup[] = useMemo(() => {
    if (!active) return [];
    const byShop = new Map<string, Row[]>();
    for (const r of active.orders) {
      const name = r.shops?.name ?? "Shop";
      (byShop.get(name) ?? byShop.set(name, []).get(name)!).push(r);
    }
    const out: ShopGroup[] = [];
    for (const [shopName, orders] of Array.from(byShop.entries())) {
      const merged = new Map<string, MergedItem>();
      for (const r of orders) {
        for (const i of mineItems(r)) {
          const catName = i.products?.product_categories?.name ?? "";
          const name = i.product_name ?? i.products?.name ?? "Item";
          const key = `${name}|${i.unit}`;
          const ex = merged.get(key);
          if (ex) ex.qty += Number(i.quantity);
          else merged.set(key, { name, unit: i.unit, qty: Number(i.quantity), catName });
        }
      }
      const items = Array.from(merged.values()).sort(
        (a, b) => catRank(a.catName) - catRank(b.catName) || a.name.localeCompare(b.name),
      );
      const readyable = orders.filter((o) => READYABLE.has(o.status)).map((o) => ({ id: o.id, status: o.status }));
      out.push({
        shopName,
        items,
        readyable,
        withCourier: orders.some((o) => o.status === "ready_for_courier" || o.status === "in_transit"),
        allDelivered: orders.every((o) => o.status === "delivered"),
      });
    }
    return out.sort((a, b) => a.shopName.localeCompare(b.shopName));
  }, [active, role]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markReady(g: ShopGroup) {
    setBusyShop(g.shopName);
    try {
      for (const o of g.readyable) {
        // specialist_approved/packaged → ready_for_courier; legacy in_progress → packaged.
        const to = o.status === "in_progress" ? "packaged" : "ready_for_courier";
        const res = await updateOrderStatus({ order_id: o.id, new_status: to });
        if (res.error) throw new Error(res.error + (res.details ? ": " + res.details : ""));
      }
      toast.success("Ready for delivery");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to mark ready");
    } finally {
      setBusyShop("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl">Schedule</h1>
          <p className="text-sm text-muted-foreground">Per shop, by delivery day · standing orders + approved requests merged</p>
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
              {active.label} · {groups.length} shop{groups.length !== 1 ? "s" : ""}
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
            {groups.map((g) => {
              let lastCat = -1;
              return (
                <div key={g.shopName} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-[15px] font-bold">{g.shopName}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {g.items.length} item{g.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-0.5 px-4 py-3 text-[13px] text-foreground/80">
                    {g.items.map((i, idx) => {
                      const rank = catRank(i.catName);
                      const header = rank !== lastCat ? ((lastCat = rank), i.catName) : null;
                      return (
                        <div key={idx}>
                          {header && (
                            <div className="pb-0.5 pt-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground first:pt-0">
                              {header}
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>{i.name}</span>
                            <span className="font-mono">{i.qty} {i.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border p-3">
                    {g.readyable.length > 0 ? (
                      <button
                        onClick={() => void markReady(g)}
                        disabled={busyShop === g.shopName}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> {busyShop === g.shopName ? "Working…" : "Mark ready for delivery"}
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--st-ready)" }}>
                        <Truck className="h-3.5 w-3.5" />
                        {g.allDelivered ? "Delivered" : "With courier"}
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
