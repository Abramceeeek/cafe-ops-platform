"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Clock,
  ChevronRight,
  Send,
  Minus,
  Check,
} from "lucide-react";
import { submitOrder } from "@/app/actions/orders";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Category { id: string; name: string; assigned_role: string | null }
interface Product {
  id: string;
  category_id: string;
  name: string;
  unit: string;
  lead_time_hours: number;
}
interface Group { id: string; product_id: string; name: string; is_required: boolean }
interface Option { id: string; modifier_group_id: string; name: string }
interface CartLine {
  key: string;
  product: Product;
  selected: Record<string, string>; // group_id -> option_id
  quantity: number;
  note: string;
}

// Hub specialist display name from the category's assigned_role (DB-driven,
// not a hardcoded regex — add a category in the DB, no deploy needed).
function specialistFor(assignedRole: string | null | undefined): string {
  return (assignedRole && ROLE_LABEL[assignedRole]) || "Hub";
}

function earliestDate(now: Date, maxLeadHours: number): string {
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now),
  );
  const cutoffPassed = londonHour >= 16;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // 48h floor: earliest delivery is the day-after-tomorrow; +1 more past the 16:00 cut-off.
  const leadDays = Math.max(2, Math.ceil(maxLeadHours / 24));
  const penalty = cutoffPassed ? 1 : 0;
  d.setUTCDate(d.getUTCDate() + leadDays + penalty);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_OPTIONS = [
  { n: 1, label: "Every Monday" },
  { n: 2, label: "Every Tuesday" },
  { n: 3, label: "Every Wednesday" },
  { n: 4, label: "Every Thursday" },
  { n: 5, label: "Every Friday" },
  { n: 6, label: "Every Saturday" },
  { n: 7, label: "Every Sunday" },
];

// Monday of next ISO week — when a new/edited standing order takes effect.
function nextMondayISO(): string {
  const d = new Date();
  const isoDow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon..7=Sun
  d.setDate(d.getDate() + (8 - isoDow));
  return d.toISOString().slice(0, 10);
}

export default function NewRequestPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<Date>(new Date());

  const [cart, setCart] = useState<CartLine[]>([]);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [standingWeekday, setStandingWeekday] = useState("");
  const [savingStanding, setSavingStanding] = useState(false);

  // add-to-cart dialog
  const [active, setActive] = useState<Product | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [{ data: cats }, { data: prods }, { data: grps }, { data: opts }, profileRes, timeRes] =
        await Promise.all([
          supabase.from("product_categories").select("id,name,assigned_role").order("display_order"),
          supabase
            .from("products")
            .select("id,category_id,name,unit,lead_time_hours")
            .eq("is_available", true)
            .order("name"),
          supabase.from("modifier_groups").select("id,product_id,name,is_required").order("display_order"),
          supabase.from("modifier_options").select("id,modifier_group_id,name").order("display_order"),
          user ? supabase.from("profiles").select("shop_id").eq("id", user.id).single() : Promise.resolve({ data: null }),
          supabase.functions.invoke("get-server-time"),
        ]);
      setCategories(cats ?? []);
      setProducts(prods ?? []);
      setGroups(grps ?? []);
      setOptions(opts ?? []);
      setUserId(user?.id ?? null);
      const profile = profileRes.data as { shop_id: string } | null;
      setShopId(profile?.shop_id ?? null);
      const now = (timeRes.data as { now?: string } | null)?.now;
      if (now) setServerNow(new Date(now));
    })();
  }, []);

  // Seed the cart from a template chosen on the Templates page ("Edit in New
  // Request"). Runs once the catalog + modifier options have loaded.
  useEffect(() => {
    if (products.length === 0) return;
    const raw = sessionStorage.getItem("request_seed");
    if (!raw) return;
    sessionStorage.removeItem("request_seed");
    try {
      const seed = JSON.parse(raw) as {
        product_id: string;
        quantity: number;
        note: string;
        modifier_option_ids: string[];
      }[];
      const lines: CartLine[] = [];
      seed.forEach((s, idx) => {
        const product = products.find((p) => p.id === s.product_id);
        if (!product) return;
        const selected: Record<string, string> = {};
        for (const oid of s.modifier_option_ids) {
          const opt = options.find((o) => o.id === oid);
          if (opt) selected[opt.modifier_group_id] = oid;
        }
        lines.push({ key: `${product.id}-${idx}-seed`, product, selected, quantity: s.quantity, note: s.note ?? "" });
      });
      if (lines.length > 0) {
        setCart(lines);
        toast.success("Template loaded — edit and submit.");
      }
    } catch {
      // ignore a malformed seed
    }
  }, [products, options]);

  const productGroups = (productId: string) => groups.filter((g) => g.product_id === productId);
  const groupOptions = (groupId: string) => options.filter((o) => o.modifier_group_id === groupId);

  function openProduct(p: Product) {
    setActive(p);
    setSel({});
    setQty(1);
    setNote("");
  }

  const requiredMet =
    active != null &&
    productGroups(active.id)
      .filter((g) => g.is_required)
      .every((g) => sel[g.id]);

  function addToCart() {
    if (!active) return;
    setCart((c) => [
      ...c,
      { key: `${active.id}-${Date.now()}`, product: active, selected: { ...sel }, quantity: qty, note },
    ]);
    setActive(null);
  }

  const maxLead = useMemo(
    () => cart.reduce((m, l) => Math.max(m, l.product.lead_time_hours), 0),
    [cart],
  );
  const minDate = earliestDate(serverNow, maxLead);
  // Date picker floor = today, so today + tomorrow are *selectable* (and flagged
  // as an emergency below) rather than blocked outright.
  const floorDate = useMemo(
    () => new Date(Date.UTC(serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate()))
      .toISOString()
      .slice(0, 10),
    [serverNow],
  );
  const isEmergency = !!deliveryDate && deliveryDate < minDate;
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  // One idempotency key per submission intent — reused across retries so a flaky
  // network can't create duplicate orders; rotated after a successful submit.
  const [submitKey, setSubmitKey] = useState(() => crypto.randomUUID());

  // only categories the role can actually order from (products are RLS-scoped, categories are not)
  const visibleCats = categories.filter((c) => products.some((p) => p.category_id === c.id));

  function submit() {
    if (!shopId || !userId) return toast.error("Your profile has no shop assigned.");
    if (cart.length === 0) return toast.error("Cart is empty.");
    if (!deliveryDate) return toast.error("Pick a delivery date.");
    if (isEmergency) return setEmergencyOpen(true);
    void doSubmit(false);
  }

  async function doSubmit(emergency: boolean) {
    if (!shopId) return;
    setEmergencyOpen(false);
    setSubmitting(true);
    const items = cart.map((l) => ({
      product_id: l.product.id,
      category_id: l.product.category_id,
      quantity: l.quantity,
      lead_time_hours: l.product.lead_time_hours,
      unit: l.product.unit,
      custom_note: l.note || undefined,
      modifiers: Object.entries(l.selected).map(([gid, oid]) => ({
        modifier_option_id: oid,
        modifier_group_name: groups.find((g) => g.id === gid)?.name ?? "",
        modifier_option_name: options.find((o) => o.id === oid)?.name ?? "",
      })),
    }));
    try {
      const response = await submitOrder({ shop_id: shopId, requested_delivery_date: deliveryDate, emergency, idempotency_key: submitKey, items });
      if (response.error) {
        const details = Array.isArray(response.details) ? ": " + response.details.join(", ") : (response.details ? ": " + response.details : "");
        return toast.error(response.error + details);
      }
      const ids = response.order_ids ?? [];
      toast.success(emergency ? `Emergency order submitted — ${ids.length} order(s).` : `Request submitted — ${ids.length} order(s) created.`);
      setCart([]);
      setDeliveryDate("");
      setSubmitKey(crypto.randomUUID());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Save the current cart as a recurring standing order for a weekday. Takes effect
  // next week (the current week stays locked) — see the Standing Orders page.
  async function saveStanding() {
    if (cart.length === 0) return toast.error("Cart is empty.");
    if (!standingWeekday) return toast.error("Pick a weekday.");
    setSavingStanding(true);
    const itemsPayload = cart.map((l) => ({
      product_id: l.product.id,
      quantity: l.quantity,
      custom_note: l.note || null,
      modifiers: Object.values(l.selected).map((oid) => ({ modifier_option_id: oid })),
    }));
    const { error } = await createClient().rpc("save_standing_order", {
      p_weekday: Number(standingWeekday),
      p_effective_from: nextMondayISO(),
      p_items: itemsPayload,
    });
    setSavingStanding(false);
    if (error) return toast.error(error.message);
    setStandingWeekday("");
    toast.success("Saved as a standing order — starts next week.");
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="px-0.5 pt-1">
        <h1 className="font-display text-2xl tracking-tight">New Request</h1>
        <p className="text-sm text-muted-foreground">Browse your catalog and build your request.</p>
      </div>

      {/* Category filter chips */}
      {visibleCats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCat(null)}
            className={
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
              (filterCat === null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground")
            }
          >
            All
          </button>
          {visibleCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(cat.id)}
              className={
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                (filterCat === cat.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground")
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-5">
      {/* Catalog */}
      {visibleCats
        .filter((c) => !filterCat || c.id === filterCat)
        .map((cat) => {
        const items = products.filter((p) => p.category_id === cat.id);
        if (items.length === 0) return null;
        return (
          <div key={cat.id} className="space-y-2">
            <div className="px-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
              {cat.name} · {items.length} products
            </div>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {items.map((p, i) => {
                const mods = productGroups(p.id).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p)}
                    className={
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-secondary/50 " +
                      (i < items.length - 1 ? "border-b border-border" : "")
                    }
                  >

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        per {p.unit} · {p.lead_time_hours}h lead
                        {mods ? ` · ${mods} option${mods > 1 ? "s" : ""}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
        </div>
        <div className="space-y-5 lg:sticky lg:top-4">
      {/* Cart */}
      <div id="cart" className="scroll-mt-4 space-y-4 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg">Your Cart</span>
              <span className="text-[13px] font-semibold text-muted-foreground">
                {cart.length} line{cart.length !== 1 ? "s" : ""}
              </span>
            </div>
            {cart.length === 0 && (
              <p className="text-sm text-muted-foreground">No items yet — tap a product above.</p>
            )}

            {(() => {
              const catIds = Array.from(new Set(cart.map((l) => l.product.category_id)));
              return (
                <>
                  {catIds.length >= 2 && (
                    <div
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
                      style={{ background: "var(--accent)", borderColor: "var(--st-pend-line)", color: "var(--ink-2)" }}
                    >
                      <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                      <span>
                        This cart spans {catIds.length} categories — it&apos;ll submit as{" "}
                        <strong>{catIds.length} orders</strong>, one per Hub specialist.
                      </span>
                    </div>
                  )}
                  {catIds.map((cid) => {
                    const catObj = categories.find((c) => c.id === cid);
                    const catName = catObj?.name ?? "Items";
                    const lines = cart.filter((l) => l.product.category_id === cid);
                    return (
                      <div key={cid} className="space-y-1.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold">{catName}</span>
                          <span className="font-mono text-xs text-muted-foreground">→ {specialistFor(catObj?.assigned_role)}</span>
                        </div>
                        {lines.map((l) => (
                          <div key={l.key} className="flex items-start justify-between gap-2 border-b pb-2 text-sm">
                            <div>
                              <div className="font-medium">
                                {l.product.name} × {l.quantity} {l.product.unit}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {Object.entries(l.selected)
                                  .map(([, oid]) => options.find((o) => o.id === oid)?.name)
                                  .filter(Boolean)
                                  .join(" · ")}
                                {l.note ? ` — ${l.note}` : ""}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              );
            })()}

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="ddate" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Delivery date
          </Label>
          <Input
            id="ddate"
            type="date"
            min={floorDate}
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
          {isEmergency ? (
            <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--st-bad)" }}>
              <Clock className="h-3 w-3" /> Before the {minDate} cut-off — this will be an emergency order.
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Earliest: {minDate} (4:00 PM London cut-off)
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-dashed border-input bg-secondary p-3 text-xs text-muted-foreground">
          <Send className="h-4 w-4 shrink-0" />
          <span>
            Prices are set in the catalog and applied automatically when the Hub approves your order.
          </span>
        </div>

        <button
          disabled={submitting || cart.length === 0}
          onClick={submit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
        >
          {submitting ? (
            "Submitting…"
          ) : (
            <>
              <Send className="h-[17px] w-[17px]" /> Submit Request to Hub
            </>
          )}
        </button>
      </div>

      {/* Emergency-order confirmation */}
      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--st-bad)" }}>⚠ Emergency order</DialogTitle>
            <DialogDescription>
              You&rsquo;re ordering for {deliveryDate}, before the {minDate} cut-off. This is an
              <strong> emergency order</strong>: it has a <strong>high chance of not being approved</strong>,
              is treated as the last resort, and may not be produced in time. Please
              <strong> re-check with the specialist first</strong> before submitting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setEmergencyOpen(false)}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={() => void doSubmit(true)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--st-bad)" }}
            >
              Submit emergency order
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as standing order */}
      {cart.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <Label htmlFor="sodow" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Save as standing order
          </Label>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Repeats every chosen weekday, auto-sent to the Hub. Starts next week.
          </p>
          <div className="mt-2 flex gap-2">
            <select
              id="sodow"
              value={standingWeekday}
              onChange={(e) => setStandingWeekday(e.target.value)}
              className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose a day…</option>
              {WEEKDAY_OPTIONS.map((w) => (
                <option key={w.n} value={w.n}>{w.label}</option>
              ))}
            </select>
            <Button variant="outline" disabled={savingStanding || !standingWeekday} onClick={saveStanding}>
              {savingStanding ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

        </div>
      </div>

      {/* Mobile: jump-to-cart (catalog is long; cart sits below). Hidden on lg (cart is a sticky sidebar). */}
      {cart.length > 0 && (
        <a
          href="#cart"
          className="fixed inset-x-4 bottom-[76px] z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
        >
          <span>
            {cart.length} item{cart.length !== 1 ? "s" : ""} in cart
          </span>
          <span className="flex items-center gap-1">
            View cart <ChevronRight className="h-4 w-4 rotate-90" />
          </span>
        </a>
      )}

      {/* Product modifier dialog */}
      <Dialog open={active != null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.name}</DialogTitle>
                <DialogDescription>
                  per {active.unit} · {active.lead_time_hours}h lead time
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {productGroups(active.id).map((g) => (
                  <div key={g.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {g.name}
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wide"
                        style={
                          g.is_required
                            ? { color: "var(--primary)", background: "var(--accent)" }
                            : { color: "var(--muted-foreground)", background: "var(--secondary)" }
                        }
                      >
                        {g.is_required ? "REQUIRED" : "OPTIONAL"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groupOptions(g.id).map((o) => {
                        const on = sel[g.id] === o.id;
                        return (
                          <button
                            key={o.id}
                            onClick={() =>
                              setSel((s) => {
                                const next = { ...s };
                                if (on && !g.is_required) delete next[g.id];
                                else next[g.id] = o.id;
                                return next;
                              })
                            }
                            className={
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition " +
                              (on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-secondary text-foreground/80")
                            }
                          >
                            {on && <Check className="h-3.5 w-3.5" />}
                            {o.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13.5px] font-bold">Quantity</div>
                    <div className="text-xs text-muted-foreground">{active.unit}s</div>
                  </div>
                  <div className="flex items-center overflow-hidden rounded-full border border-input">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="Decrease"
                      className="grid h-9 w-9 place-items-center bg-card"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[46px] text-center font-mono text-[15px] font-bold">{qty}</span>
                    <button
                      onClick={() => setQty((q) => q + 1)}
                      aria-label="Increase"
                      className="grid h-9 w-9 place-items-center bg-card"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Note (optional)
                  </Label>
                  <Input
                    id="note"
                    maxLength={200}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note for the Hub…"
                  />
                  <div className="text-right text-[11px] text-muted-foreground">{note.length} / 200</div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!requiredMet} onClick={addToCart} className="w-full">
                  <Plus className="h-4 w-4" /> Add to request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
