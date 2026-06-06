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
  Croissant,
  Wheat,
  Beef,
  Package,
  type LucideIcon,
} from "lucide-react";
import { submitOrder } from "@/app/actions/orders";
import { createClient } from "@/lib/supabase/client";
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

interface Category { id: string; name: string }
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

// Which Hub specialist receives each category (routing per the live model).
function specialistFor(categoryName: string): string {
  if (/meat|smoked/i.test(categoryName)) return "Pitmaster";
  return "Baker"; // Kitchen Bread + Pastry / Retail Bakery
}

function earliestDate(now: Date, maxLeadHours: number): string {
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now),
  );
  const cutoffPassed = londonHour >= 16;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const leadDays = Math.max(1, Math.ceil(maxLeadHours / 24));
  const penalty = cutoffPassed ? 1 : 0;
  d.setUTCDate(d.getUTCDate() + leadDays + penalty);
  return d.toISOString().slice(0, 10);
}

export default function NewRequestPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<Date>(new Date());

  const [cart, setCart] = useState<CartLine[]>([]);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

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
          supabase.from("product_categories").select("id,name").order("display_order"),
          supabase
            .from("products")
            .select("id,category_id,name,unit,lead_time_hours")
            .eq("is_available", true)
            .order("name"),
          supabase.from("modifier_groups").select("id,product_id,name,is_required").order("display_order"),
          supabase.from("modifier_options").select("id,modifier_group_id,name").order("display_order"),
          user ? supabase.from("profiles").select("shop_id, role").eq("id", user.id).single() : Promise.resolve({ data: null }),
          supabase.functions.invoke("get-server-time"),
        ]);
      setCategories(cats ?? []);
      setProducts(prods ?? []);
      setGroups(grps ?? []);
      setOptions(opts ?? []);
      setUserId(user?.id ?? null);
      const profile = profileRes.data as { shop_id: string; role: string } | null;
      setShopId(profile?.shop_id ?? null);
      setRole(profile?.role ?? null);
      const now = (timeRes.data as { now?: string } | null)?.now;
      if (now) setServerNow(new Date(now));
    })();
  }, []);

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

  // only categories the role can actually order from (products are RLS-scoped, categories are not)
  const visibleCats = categories.filter((c) => products.some((p) => p.category_id === c.id));

  async function submit() {
    if (!shopId || !userId) return toast.error("Your profile has no shop assigned.");
    if (cart.length === 0) return toast.error("Cart is empty.");
    if (!deliveryDate) return toast.error("Pick a delivery date.");
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
      const response = await submitOrder({ shop_id: shopId, requested_delivery_date: deliveryDate, items });
      if (response.error) {
        const details = Array.isArray(response.details) ? ": " + response.details.join(", ") : (response.details ? ": " + response.details : "");
        return toast.error(response.error + details);
      }
      const ids = response.order_ids ?? [];
      toast.success(`Request submitted — ${ids.length} order(s) created.`);
      setCart([]);
      setDeliveryDate("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTemplate() {
    if (!shopId || !userId || !role) return toast.error("Your profile has no shop assigned.");
    if (cart.length === 0) return toast.error("Cart is empty.");
    const name = templateName.trim();
    if (!name) return toast.error("Name the template.");
    setSavingTemplate(true);
    const supabase = createClient();
    const itemsPayload = cart.map(l => ({
      product_id: l.product.id,
      quantity: l.quantity,
      custom_note: l.note || null,
      modifiers: Object.values(l.selected).map(oid => ({ modifier_option_id: oid }))
    }));

    const { error: rpcErr } = await supabase.rpc("save_order_template", {
      p_shop_id: shopId,
      p_created_by: userId,
      p_name: name,
      p_role: role,
      p_items: itemsPayload
    });

    if (rpcErr) {
      setSavingTemplate(false);
      return toast.error(rpcErr.message);
    }
    setSavingTemplate(false);
    setTemplateName("");
    toast.success(`Template "${name}" saved.`);
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-end justify-between px-0.5 pt-1">
        <div>
          <h1 className="font-display text-2xl tracking-tight">New Request</h1>
          <p className="text-sm text-muted-foreground">Browse your catalog and build your request.</p>
        </div>

        {visibleCats.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCat(null)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                filterCat === null ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"
              }`}
            >
              All
            </button>
            {visibleCats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCat(cat.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterCat === cat.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {visibleCats.filter((c) => !filterCat || c.id === filterCat).map((cat) => {
          const items = products.filter((p) => p.category_id === cat.id);
          if (items.length === 0) return null;
          return (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        per {p.unit} · {p.lead_time_hours}h lead
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openProduct(p)}>
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Catalog */}
      {categories.map((cat) => {
        const items = products.filter((p) => p.category_id === cat.id);
        if (items.length === 0) return null;
        const Icon = categoryIcon(cat.name);
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
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-secondary text-foreground/70">
                      <Icon className="h-[20px] w-[20px]" />
                    </span>
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

      {/* Cart */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cart ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 && (
              <p className="text-sm text-muted-foreground">No items yet.</p>
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
                    const catName = categories.find((c) => c.id === cid)?.name ?? "Items";
                    const lines = cart.filter((l) => l.product.category_id === cid);
                    return (
                      <div key={cid} className="space-y-1.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold">{catName}</span>
                          <span className="font-mono text-xs text-muted-foreground">→ {specialistFor(catName)}</span>
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
            min={minDate}
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> Earliest: {minDate} (4:00 PM London cut-off)
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-dashed border-input bg-secondary p-3 text-xs text-muted-foreground">
          <Send className="h-4 w-4 shrink-0" />
          <span>
            Costs are set by the Hub specialist at approval — you&rsquo;ll review prices at Final Confirm.
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

      {/* Save as template */}
      {cart.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <Label htmlFor="tmpl" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Save as template
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="tmpl"
              maxLength={50}
              placeholder="e.g. Tuesday restock"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Button variant="outline" disabled={savingTemplate || !templateName.trim()} onClick={saveTemplate}>
              {savingTemplate ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
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
