"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Check, X, ChevronRight, Trash2, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/app/actions/orders";

interface Item {
  id: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  custom_note: string | null;
  products: { name: string; product_categories: { name: string; assigned_role: string } | null } | null;
  order_item_modifiers: { modifier_group_name: string; modifier_option_name: string }[];
}
interface InboxRow {
  id: string;
  requested_delivery_date: string;
  submitted_at: string;
  shops: { name: string } | null;
  order_items: Item[];
}

function urgency(date: string): { key: string; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = Math.round((new Date(date + "T00:00:00").getTime() - today.getTime()) / 86400000);
  if (d <= 1) return { key: "bad", label: "Urgent" };
  if (d === 2) return { key: "pend", label: "Soon" };
  return { key: "done", label: "Scheduled" };
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function InboxPage() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((profile?.role as string) ?? "");
    }
    const { data } = await supabase
      .from("orders")
      .select(
        `id, requested_delivery_date, submitted_at,
         shops ( name ),
         order_items (
           id, quantity, unit, unit_cost, custom_note,
           products ( name, product_categories ( name, assigned_role ) ),
           order_item_modifiers ( modifier_group_name, modifier_option_name )
         )`,
      )
      .eq("status", "pending_request")
      .order("requested_delivery_date", { ascending: true });
    setRows((data ?? []) as unknown as InboxRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = (r: InboxRow) =>
    r.order_items.filter((i) => i.products?.product_categories?.assigned_role === role);
  const visible = rows.filter((r) => mine(r).length > 0);

  function openQuote(r: InboxRow) {
    if (openId === r.id) return setOpenId(null);
    const c: Record<string, string> = {};
    const q: Record<string, string> = {};
    const rm: Record<string, boolean> = {};
    for (const i of mine(r)) {
      c[i.id] = (i.unit_cost ?? 0).toFixed(2);
      q[i.id] = String(i.quantity);
      rm[i.id] = false;
    }
    setCosts(c);
    setQtys(q);
    setRemoved(rm);
    setOpenId(r.id);
  }

  async function approve(r: InboxRow) {
    setBusy(true);
    const items = mine(r);
    const kept = items.filter((i) => !removed[i.id]);
    if (kept.length === 0) {
      setBusy(false);
      return toast.error("Can't approve an empty order — reject it instead.");
    }
    const item_edits = kept.map((i) => ({
      id: i.id,
      quantity: parseFloat(qtys[i.id] || String(i.quantity)) || Number(i.quantity),
      unit_cost: parseFloat(costs[i.id] || "0") || 0,
    }));
    const removed_item_ids = items.filter((i) => removed[i.id]).map((i) => i.id);
    const res = await updateOrderStatus({
      order_id: r.id,
      new_status: "specialist_approved",
      item_edits,
      removed_item_ids,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error + (res.details ? ": " + res.details : ""));
    toast.success(removed_item_ids.length || item_edits.some((e, idx) => e.quantity !== Number(kept[idx].quantity))
      ? "Edited & approved"
      : "Approved & priced");
    setOpenId(null);
    await load();
  }

  async function reject(r: InboxRow) {
    setBusy(true);
    const res = await updateOrderStatus({ order_id: r.id, new_status: "rejected" });
    setBusy(false);
    if (res.error) return toast.error(res.error + (res.details ? ": " + res.details : ""));
    toast.success("Request rejected");
    setOpenId(null);
    await load();
  }

  const total = (r: InboxRow) =>
    mine(r)
      .filter((i) => !removed[i.id])
      .reduce((s, i) => s + (parseFloat(costs[i.id] || "0") || 0) * (parseFloat(qtys[i.id] || "0") || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl">Inbox</h1>
          <p className="text-sm text-muted-foreground">Pending requests · review, edit &amp; quote</p>
        </div>
        <button onClick={() => void load()} aria-label="Refresh" className="grid h-9 w-9 place-items-center text-muted-foreground">
          <RefreshCw className="h-[18px] w-[18px]" />
        </button>
      </div>

      {!loading && (
        <div className="px-0.5">
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--st-ready)", background: "var(--accent)" }}>
            {visible.length} pending
          </span>
        </div>
      )}

      {loading && <p className="px-0.5 text-sm text-muted-foreground">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border bg-card py-10 text-center text-sm text-muted-foreground">
          No pending requests — all clear.
        </div>
      )}

      {visible.map((r) => {
        const u = urgency(r.requested_delivery_date);
        const items = mine(r);
        const open = openId === r.id;
        return (
          <div key={r.id} className="flex overflow-hidden rounded-2xl border bg-card">
            <div className="w-[5px] shrink-0" style={{ background: `var(--st-${u.key})` }} />
            <div className="min-w-0 flex-1 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">{r.shops?.name ?? "Shop"}</span>
                  <span className="font-mono text-xs text-muted-foreground">#{r.id.slice(0, 4).toUpperCase()}</span>
                </div>
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                  style={{ color: `var(--st-${u.key})`, background: `var(--st-${u.key}-bg)`, borderColor: `var(--st-${u.key}-line)` }}
                >
                  {u.label}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                for {fmtDate(r.requested_delivery_date)} · {items.length} line{items.length !== 1 ? "s" : ""}
              </div>

              <div className="mt-3 space-y-2">
                {items.map((i) => {
                  const isRemoved = open && removed[i.id];
                  return (
                    <div key={i.id} className="text-[13px]">
                      <div className="flex items-start justify-between gap-2">
                        <span className={"min-w-0 " + (isRemoved ? "line-through opacity-50" : "")}>
                          <span className="font-semibold">{i.products?.name ?? "Item"}</span>
                          {i.order_item_modifiers.length > 0 && (
                            <span className="text-muted-foreground">
                              {" "}· {i.order_item_modifiers.map((m) => m.modifier_option_name).join(" · ")}
                            </span>
                          )}
                          {i.custom_note && (
                            <span className="italic text-muted-foreground"> — &ldquo;{i.custom_note}&rdquo;</span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono font-bold">
                          {i.quantity} {i.unit}
                        </span>
                      </div>

                      {open && (
                        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-secondary px-2.5 py-1.5">
                          {isRemoved ? (
                            <>
                              <span className="text-[11.5px] font-semibold text-muted-foreground">Removed from order</span>
                              <button
                                onClick={() => setRemoved((m) => ({ ...m, [i.id]: false }))}
                                className="flex items-center gap-1 text-[12px] font-semibold text-primary"
                              >
                                <Undo2 className="h-3.5 w-3.5" /> Undo
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11.5px] font-semibold text-muted-foreground">Qty</span>
                                <input
                                  inputMode="decimal"
                                  value={qtys[i.id] ?? String(i.quantity)}
                                  onChange={(e) => setQtys((q) => ({ ...q, [i.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                                  className="w-12 rounded-md border border-input bg-card px-2 py-1 text-right font-mono text-[13px] font-bold outline-none"
                                />
                                <span className="text-[11px] text-muted-foreground">{i.unit}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1">
                                  <span className="font-mono text-[13px] font-bold">£</span>
                                  <input
                                    inputMode="decimal"
                                    value={costs[i.id] ?? "0.00"}
                                    onChange={(e) => setCosts((c) => ({ ...c, [i.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                                    className="w-12 bg-transparent text-right font-mono text-[13px] font-bold outline-none"
                                  />
                                </div>
                                <button
                                  onClick={() => setRemoved((m) => ({ ...m, [i.id]: true }))}
                                  aria-label="Remove line"
                                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:text-foreground"
                                  style={{ color: "var(--st-bad)" }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {open ? (
                <>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="font-display text-base">Quote total</span>
                    <span className="font-mono text-lg font-bold text-primary">£{total(r).toFixed(2)}</span>
                  </div>
                  <div className="mt-3 flex gap-2.5">
                    <button
                      disabled={busy}
                      onClick={() => void reject(r)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                      style={{ color: "var(--st-bad)", borderColor: "var(--st-bad-line)" }}
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void approve(r)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Approve &amp; Quote
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => openQuote(r)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                >
                  Review, edit &amp; quote <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
