"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, MapPin, Navigation, Printer, Truck, Check, Trash2, Undo2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { updateOrderStatus } from "@/app/actions/orders";

interface Item {
  id: string;
  quantity: number;
  unit: string;
  product_name: string | null;
  products: { name: string; product_categories: { name: string } | null } | null;
}
interface Row {
  id: string;
  status: string;
  requested_delivery_date: string;
  shops: { name: string; address: string | null } | null;
  order_items: Item[];
}

// Courier sees an order from the moment it's approved (plan the day), but can only
// start the delivery once the specialist marks it ready_for_courier.
const STATUSES = ["specialist_approved", "in_progress", "packaged", "ready_for_courier", "in_transit", "delivered"];
const WINDOW_DAYS = 15;

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

interface Stop {
  shop: string;
  address: string | null;
  orders: Row[];
}
function groupByShop(rows: Row[]): Stop[] {
  const m = new Map<string, Stop>();
  for (const r of rows) {
    const shop = r.shops?.name ?? "Shop";
    let g = m.get(shop);
    if (!g) {
      g = { shop, address: r.shops?.address ?? null, orders: [] };
      m.set(shop, g);
    }
    g.orders.push(r);
  }
  return Array.from(m.values()).sort((a, b) => a.shop.localeCompare(b.shop));
}

export default function ManifestPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date,
         shops ( name, address ),
         order_items ( id, quantity, unit, product_name, products ( name, product_categories ( name ) ) )`,
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

  const live = buckets.map((b) => ({ ...b, orders: rows.filter(b.match) })).filter((b) => b.orders.length > 0);
  const active = live.find((b) => b.key === sel) ?? live.find((b) => b.key === todayStr) ?? live[0];
  const stops = active ? groupByShop(active.orders) : [];

  const addresses = Array.from(new Set(stops.map((s) => s.address).filter((a): a is string => !!a)));
  const routeUrl =
    addresses.length > 0 ? "https://www.google.com/maps/dir/" + addresses.map(encodeURIComponent).join("/") : null;

  function openCheck(o: Row) {
    if (openId === o.id) return setOpenId(null);
    const q: Record<string, string> = {};
    const rm: Record<string, boolean> = {};
    for (const i of o.order_items) {
      q[i.id] = String(i.quantity);
      rm[i.id] = false;
    }
    setQtys(q);
    setRemoved(rm);
    setOpenId(o.id);
  }

  async function startDelivery(o: Row) {
    setBusy(true);
    const kept = o.order_items.filter((i) => !removed[i.id]);
    if (kept.length === 0) {
      setBusy(false);
      return toast.error("Nothing to deliver — every line removed.");
    }
    const item_edits = kept.map((i) => ({ id: i.id, quantity: parseFloat(qtys[i.id] || String(i.quantity)) || Number(i.quantity) }));
    const removed_item_ids = o.order_items.filter((i) => removed[i.id]).map((i) => i.id);
    const res = await updateOrderStatus({ order_id: o.id, new_status: "in_transit", item_edits, removed_item_ids });
    setBusy(false);
    if (res.error) return toast.error(res.error + (res.details ? ": " + res.details : ""));
    toast.success("Delivery started");
    setOpenId(null);
    await load();
  }

  async function confirmDelivered(o: Row) {
    setBusy(true);
    const res = await updateOrderStatus({ order_id: o.id, new_status: "delivered" });
    setBusy(false);
    if (res.error) return toast.error(res.error + (res.details ? ": " + res.details : ""));
    toast.success("Delivered");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl">Route</h1>
          <p className="text-sm text-muted-foreground">Deliveries by day · next {WINDOW_DAYS} days</p>
        </div>
        <button onClick={() => void load()} aria-label="Refresh" className="grid h-9 w-9 place-items-center text-muted-foreground">
          <RefreshCw className="h-[18px] w-[18px]" />
        </button>
      </div>

      {live.length === 0 && (
        <div className="rounded-2xl border bg-card py-10 text-center text-sm text-muted-foreground">
          No deliveries scheduled.
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
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div className="flex gap-6">
            <div>
              <div className="font-mono font-display text-xl">{stops.length}</div>
              <div className="text-[11px] text-muted-foreground">stops</div>
            </div>
            <div>
              <div className="font-mono font-display text-xl">{active.orders.length}</div>
              <div className="text-[11px] text-muted-foreground">orders</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {active.key !== "overdue" && (
              <a
                href={`/print?date=${active.key}&role=courier`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold"
              >
                <Printer className="h-4 w-4" /> Print
              </a>
            )}
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
        </div>
      )}

      {stops.map((s) => (
        <div key={s.shop} className="overflow-hidden rounded-2xl border bg-card">
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

          <div className="divide-y divide-border">
            {s.orders.map((o) => {
              const cat = o.order_items[0]?.products?.product_categories?.name ?? "Order";
              const open = openId === o.id;
              return (
                <div key={o.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{cat}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[13px] text-foreground/80">
                    {o.order_items.map((l) => (
                      <div key={l.id} className="flex justify-between">
                        <span>{l.product_name ?? l.products?.name ?? "Item"}</span>
                        <span className="font-mono">{l.quantity} {l.unit}</span>
                      </div>
                    ))}
                  </div>

                  {/* Check & edit panel — courier adjusts what's actually delivered */}
                  {open && (
                    <div className="mt-3 space-y-2 rounded-xl bg-secondary/60 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Adjust quantities you&rsquo;re delivering
                      </div>
                      {o.order_items.map((i) => {
                        const isRemoved = removed[i.id];
                        return (
                          <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5">
                            <span className={"min-w-0 truncate text-[13px] " + (isRemoved ? "line-through opacity-50" : "")}>
                              {i.product_name ?? i.products?.name ?? "Item"}
                            </span>
                            {isRemoved ? (
                              <button
                                onClick={() => setRemoved((m) => ({ ...m, [i.id]: false }))}
                                className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary"
                              >
                                <Undo2 className="h-3.5 w-3.5" /> Undo
                              </button>
                            ) : (
                              <div className="flex shrink-0 items-center gap-2">
                                <input
                                  inputMode="decimal"
                                  value={qtys[i.id] ?? String(i.quantity)}
                                  onChange={(e) => setQtys((q) => ({ ...q, [i.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                                  className="w-14 rounded-md border border-input bg-card px-2 py-1 text-right font-mono text-[13px] font-bold outline-none"
                                />
                                <span className="text-[11px] text-muted-foreground">{i.unit}</span>
                                <button
                                  onClick={() => setRemoved((m) => ({ ...m, [i.id]: true }))}
                                  aria-label="Remove line"
                                  className="grid h-7 w-7 place-items-center rounded-md"
                                  style={{ color: "var(--st-bad)" }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        disabled={busy}
                        onClick={() => void startDelivery(o)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                      >
                        <Truck className="h-4 w-4" /> Start delivery
                      </button>
                    </div>
                  )}

                  {!open && (
                    <div className="mt-3">
                      {o.status === "ready_for_courier" && (
                        <button
                          onClick={() => openCheck(o)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                        >
                          Check &amp; start delivery <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                      {o.status === "in_transit" && (
                        <button
                          disabled={busy}
                          onClick={() => void confirmDelivered(o)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                          style={{ background: "var(--st-done)" }}
                        >
                          <Check className="h-4 w-4" /> Confirm delivered
                        </button>
                      )}
                      {o.status === "delivered" && (
                        <div className="flex items-center justify-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--st-done)" }}>
                          <Check className="h-3.5 w-3.5" /> Delivered
                        </div>
                      )}
                      {(o.status === "specialist_approved" || o.status === "in_progress" || o.status === "packaged") && (
                        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-sm font-semibold text-muted-foreground">
                          Not ready yet — awaiting the Hub
                        </div>
                      )}
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
