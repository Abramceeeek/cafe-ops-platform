"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Plus, Minus, Pencil, Trash2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Product { id: string; category_id: string; name: string; unit: string }
interface Category { id: string; name: string; display_order: number }
interface SOItem {
  quantity: number;
  products: { id: string; name: string; unit: string; product_categories: { name: string } | null } | null;
}
interface StandingOrder {
  id: string;
  weekday: number;
  effective_from: string; // YYYY-MM-DD
  standing_order_items: SOItem[];
}

const WEEKDAYS = [
  { n: 1, label: "Monday" },
  { n: 2, label: "Tuesday" },
  { n: 3, label: "Wednesday" },
  { n: 4, label: "Thursday" },
  { n: 5, label: "Friday" },
  { n: 6, label: "Saturday" },
  { n: 7, label: "Sunday" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
// Monday of next ISO week — when edits take effect (current week stays locked).
function nextMondayISO(): string {
  const d = new Date();
  const isoDow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon..7=Sun
  d.setDate(d.getDate() + (8 - isoDow));
  return d.toISOString().slice(0, 10);
}

export default function StandingOrdersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [standing, setStanding] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // editor
  const [editWeekday, setEditWeekday] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({}); // product_id -> quantity
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: cats }, { data: prods }, { data: so }] = await Promise.all([
      supabase.from("product_categories").select("id,name,display_order").order("display_order"),
      supabase
        .from("products")
        .select("id,category_id,name,unit")
        .eq("is_available", true)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("standing_orders")
        .select(
          `id, weekday, effective_from,
           standing_order_items ( quantity, products ( id, name, unit, product_categories ( name ) ) )`,
        )
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setCategories(cats ?? []);
    setProducts(prods ?? []);
    setStanding((so ?? []) as unknown as StandingOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Per weekday: the version effective now (current week) + any future-effective edit.
  const byWeekday = useMemo(() => {
    const today = todayISO();
    const map = new Map<number, { current?: StandingOrder; next?: StandingOrder }>();
    for (const wd of WEEKDAYS) map.set(wd.n, {});
    // `standing` is ordered effective_from DESC, so the first match per bucket wins.
    for (const so of standing) {
      const slot = map.get(so.weekday);
      if (!slot) continue;
      if (so.effective_from <= today) {
        if (!slot.current) slot.current = so;
      } else if (!slot.next) {
        slot.next = so;
      }
    }
    return map;
  }, [standing]);

  const visibleCats = categories.filter((c) => products.some((p) => p.category_id === c.id));

  function openEditor(weekday: number) {
    const cur = byWeekday.get(weekday)?.next ?? byWeekday.get(weekday)?.current;
    const seed: Record<string, number> = {};
    cur?.standing_order_items.forEach((i) => {
      if (i.products) seed[i.products.id] = Number(i.quantity);
    });
    setDraft(seed);
    setEditWeekday(weekday);
  }

  function setQty(productId: string, qty: number) {
    setDraft((d) => {
      const next = { ...d };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  async function save() {
    if (editWeekday == null) return;
    const items = Object.entries(draft).map(([product_id, quantity]) => ({ product_id, quantity }));
    if (items.length === 0) return toast.error("Add at least one item.");
    // Existing current version → edit takes effect next week. Brand-new → starts now.
    const hasCurrent = !!byWeekday.get(editWeekday)?.current;
    const effective = hasCurrent ? nextMondayISO() : todayISO();
    setSaving(true);
    const { error } = await createClient().rpc("save_standing_order", {
      p_weekday: editWeekday,
      p_effective_from: effective,
      p_items: items,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(hasCurrent ? "Saved — takes effect next week." : "Standing order created.");
    setEditWeekday(null);
    await load();
  }

  async function removeWeekday(weekday: number) {
    if (!confirm("Remove this standing order? It will stop generating from next week.")) return;
    const { error } = await createClient().from("standing_orders").delete().eq("weekday", weekday);
    if (error) return toast.error(error.message);
    toast.success("Standing order removed.");
    await load();
  }

  const editorItemCount = Object.keys(draft).length;

  return (
    <div className="space-y-4">
      <div className="px-0.5 pt-1">
        <h1 className="font-display text-2xl">Standing Orders</h1>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
          Your recurring weekly order. It&apos;s sent to the Hub automatically each day — no approval
          needed. <span className="font-semibold text-foreground/80">Edits take effect next week</span>;
          this week is locked. For a one-off change, use New Request.
        </p>
      </div>

      {loading && <p className="px-0.5 text-sm text-muted-foreground">Loading…</p>}

      {!loading &&
        WEEKDAYS.map((wd) => {
          const slot = byWeekday.get(wd.n) ?? {};
          const cur = slot.current;
          const next = slot.next;
          const items = cur?.standing_order_items ?? [];
          return (
            <div key={wd.n} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-accent bg-accent text-accent-foreground">
                    <CalendarRange className="h-[21px] w-[21px]" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold leading-tight">{wd.label}</div>
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {items.length > 0
                        ? `${items.length} item${items.length !== 1 ? "s" : ""} each ${wd.label}`
                        : "No standing order"}
                    </div>
                  </div>
                </div>
                {cur && (
                  <button
                    onClick={() => void removeWeekday(wd.n)}
                    aria-label="Remove standing order"
                    className="grid shrink-0 place-items-center rounded-xl border border-input px-3 py-2 text-muted-foreground transition hover:text-foreground"
                  >
                    <Trash2 className="h-[16px] w-[16px]" />
                  </button>
                )}
              </div>

              {items.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {items.map((i, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 text-[13px]">
                      <span className="min-w-0 font-medium">{i.products?.name ?? "Unavailable item"}</span>
                      <span className="shrink-0 font-mono">
                        {i.quantity} {i.products?.unit ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {next && (
                <div
                  className="mt-3 flex items-center gap-2 rounded-lg border p-2.5"
                  style={{ background: "var(--st-pend-bg)", borderColor: "var(--st-pend-line)" }}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--st-pend)" }} />
                  <span className="text-xs text-foreground/80">
                    Changes pending — {next.standing_order_items.length} item
                    {next.standing_order_items.length !== 1 ? "s" : ""} from next week.
                  </span>
                </div>
              )}

              <button
                onClick={() => openEditor(wd.n)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-[0.98]"
              >
                {cur ? <Pencil className="h-4 w-4" /> : <Plus className="h-[17px] w-[17px]" />}
                {cur ? "Edit for next week" : "Add standing order"}
              </button>
            </div>
          );
        })}

      {/* Editor */}
      <Dialog open={editWeekday != null} onOpenChange={(o) => !o && setEditWeekday(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {WEEKDAYS.find((w) => w.n === editWeekday)?.label} standing order
            </DialogTitle>
            <DialogDescription>
              {byWeekday.get(editWeekday ?? 0)?.current
                ? "Changes apply from next week — this week stays as is."
                : "Set the items delivered every " + (WEEKDAYS.find((w) => w.n === editWeekday)?.label ?? "") + "."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {visibleCats.map((cat) => {
              const items = products.filter((p) => p.category_id === cat.id);
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-2">
                  <div className="px-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                    {cat.name}
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-card">
                    {items.map((p, i) => {
                      const qty = draft[p.id] ?? 0;
                      return (
                        <div
                          key={p.id}
                          className={
                            "flex items-center gap-3 px-4 py-2.5 " +
                            (i < items.length - 1 ? "border-b border-border" : "")
                          }
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">per {p.unit}</span>
                          </span>
                          <div className="flex items-center overflow-hidden rounded-full border border-input">
                            <button
                              onClick={() => setQty(p.id, qty - 1)}
                              aria-label="Decrease"
                              className="grid h-8 w-8 place-items-center bg-card disabled:opacity-40"
                              disabled={qty <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[40px] text-center font-mono text-sm font-bold">{qty}</span>
                            <button
                              onClick={() => setQty(p.id, qty + 1)}
                              aria-label="Increase"
                              className="grid h-8 w-8 place-items-center bg-card"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button disabled={saving || editorItemCount === 0} onClick={() => void save()} className="w-full">
              {saving ? "Saving…" : `Save (${editorItemCount} item${editorItemCount !== 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
