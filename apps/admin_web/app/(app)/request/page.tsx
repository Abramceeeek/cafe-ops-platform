"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Clock } from "lucide-react";
import { submitOrder } from "@/app/actions/orders";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    const response = await submitOrder({ shop_id: shopId, requested_delivery_date: deliveryDate, items });
    setSubmitting(false);
    if (response.error) {
      const details = Array.isArray(response.details) ? ": " + response.details.join(", ") : (response.details ? ": " + response.details : "");
      return toast.error(response.error + details);
    }
    const ids = response.order_ids ?? [];
    toast.success(`Request submitted — ${ids.length} order(s) created.`);
    setCart([]);
    setDeliveryDate("");
  }

  async function saveTemplate() {
    if (!shopId || !userId || !role) return toast.error("Your profile has no shop assigned.");
    if (cart.length === 0) return toast.error("Cart is empty.");
    const name = templateName.trim();
    if (!name) return toast.error("Name the template.");
    setSavingTemplate(true);
    const supabase = createClient();
    const { data: t, error: tErr } = await supabase
      .from("order_templates")
      .insert({ shop_id: shopId, created_by: userId, name, role })
      .select("id")
      .single();
    if (tErr || !t) {
      setSavingTemplate(false);
      return toast.error(tErr?.message ?? "Could not save template.");
    }
    for (const l of cart) {
      const { data: item, error: iErr } = await supabase
        .from("order_template_items")
        .insert({ template_id: t.id, product_id: l.product.id, quantity: l.quantity, custom_note: l.note || null })
        .select("id")
        .single();
      if (iErr || !item) {
        setSavingTemplate(false);
        return toast.error(iErr?.message ?? "Could not save template items.");
      }
      const modIds = Object.values(l.selected);
      if (modIds.length > 0) {
        const { error: mErr } = await supabase
          .from("order_template_item_modifiers")
          .insert(modIds.map((oid) => ({ template_item_id: item.id, modifier_option_id: oid })));
        if (mErr) {
          setSavingTemplate(false);
          return toast.error(mErr.message);
        }
      }
    }
    setSavingTemplate(false);
    setTemplateName("");
    toast.success(`Template "${name}" saved.`);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="ddate">Delivery date</Label>
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

            <Button className="w-full" disabled={submitting || cart.length === 0} onClick={submit}>
              {submitting ? "Submitting…" : "Submit Request"}
            </Button>

            {cart.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="tmpl">Save as template</Label>
                <div className="flex gap-2">
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
          </CardContent>
        </Card>
      </div>

      {/* Add-to-cart dialog */}
      <Dialog open={active != null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.name}</DialogTitle>
                <DialogDescription>Choose options and quantity.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {productGroups(active.id).map((g) => (
                  <div key={g.id} className="space-y-2">
                    <Label>
                      {g.name}{" "}
                      {g.is_required ? (
                        <Badge variant="secondary" className="ml-1">required</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">(optional)</span>
                      )}
                    </Label>
                    <Select
                      value={sel[g.id] ?? ""}
                      onValueChange={(v) => setSel((s) => ({ ...s, [g.id]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose…" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupOptions(g.id).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="qty">Quantity</Label>
                    <Input
                      id="qty"
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">Note</Label>
                    <Input id="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!requiredMet} onClick={addToCart}>
                  Add to cart
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
