"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2, Clock, Send, Plus, ListChecks, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitOrder } from "@/app/actions/orders";
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

interface TemplateModifier {
  modifier_option_id: string;
  modifier_options: { name: string; modifier_groups: { name: string } | null } | null;
}
interface TemplateItem {
  id: string;
  quantity: number;
  custom_note: string | null;
  products: {
    id: string;
    name: string;
    unit: string;
    category_id: string;
    lead_time_hours: number;
    product_categories: { name: string } | null;
  } | null; // null when the product is 86'd (hidden by RLS)
  order_template_item_modifiers: TemplateModifier[];
}
interface Template {
  id: string;
  name: string;
  order_template_items: TemplateItem[];
}

import { earliestDate } from "@/lib/utils";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState<Date>(new Date());

  const [active, setActive] = useState<Template | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [ordering, setOrdering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [{ data }, profileRes, timeRes] = await Promise.all([
      supabase
        .from("order_templates")
        .select(
          `id, name,
           order_template_items (
             id, quantity, custom_note,
             products ( id, name, unit, category_id, lead_time_hours, product_categories ( name ) ),
             order_template_item_modifiers (
               modifier_option_id,
               modifier_options ( name, modifier_groups ( name ) )
             )
           )`,
        )
        .order("created_at", { ascending: false }),
      user ? supabase.from("profiles").select("shop_id").eq("id", user.id).single() : Promise.resolve({ data: null }),
      supabase.functions.invoke("get-server-time"),
    ]);
    setTemplates((data ?? []) as unknown as Template[]);
    setUserId(user?.id ?? null);
    setShopId((profileRes.data as { shop_id: string } | null)?.shop_id ?? null);
    const now = (timeRes.data as { now?: string } | null)?.now;
    if (now) setServerNow(new Date(now));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = (t: Template) => {
    const cats = Array.from(
      new Set(
        t.order_template_items
          .map((i) => i.products?.product_categories?.name)
          .filter(Boolean) as string[],
      ),
    );
    const unavailable = t.order_template_items.filter((i) => !i.products).length;
    return { count: t.order_template_items.length, cats, unavailable };
  };

  const activeMaxLead = useMemo(
    () =>
      (active?.order_template_items ?? []).reduce(
        (m, i) => Math.max(m, i.products?.lead_time_hours ?? 0),
        0,
      ),
    [active],
  );
  const minDate = earliestDate(serverNow, activeMaxLead);

  function openOrder(t: Template) {
    setActive(t);
    setDeliveryDate("");
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;
    const { error } = await createClient().from("order_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Template deleted.");
    await load();
  }

  async function orderNow() {
    if (!active || !shopId || !userId) return toast.error("Your profile has no shop assigned.");
    if (!deliveryDate) return toast.error("Pick a delivery date.");
    const available = active.order_template_items.filter((i) => i.products);
    const excluded = active.order_template_items.length - available.length;
    if (available.length === 0) return toast.error("All items in this template are unavailable.");

    setOrdering(true);
    const items = available.map((i) => ({
      product_id: i.products!.id,
      category_id: i.products!.category_id,
      quantity: i.quantity,
      lead_time_hours: i.products!.lead_time_hours,
      unit: i.products!.unit,
      custom_note: i.custom_note || undefined,
      modifiers: i.order_template_item_modifiers.map((m) => ({
        modifier_option_id: m.modifier_option_id,
        modifier_group_name: m.modifier_options?.modifier_groups?.name ?? "",
        modifier_option_name: m.modifier_options?.name ?? "",
      })),
    }));
    const response = await submitOrder({ shop_id: shopId, requested_delivery_date: deliveryDate, items });
    setOrdering(false);
    if (response.error) {
      const details = Array.isArray(response.details) ? ": " + response.details.join(", ") : (response.details ? ": " + response.details : "");
      return toast.error(response.error + details);
    }
    if (excluded > 0) toast.warning(`${excluded} unavailable item(s) were excluded.`);
    const ids = response.order_ids ?? [];
    toast.success(`Request submitted — ${ids.length} order(s) created.`);
    setActive(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5 pt-1">
        <h1 className="font-display text-2xl">My Templates</h1>
        <Link
          href="/request"
          aria-label="New template"
          className="grid h-9 w-9 place-items-center text-primary"
        >
          <Plus className="h-[22px] w-[22px]" />
        </Link>
      </div>

      <p className="px-0.5 text-[13px] leading-relaxed text-muted-foreground">
        Saved carts for your role. <span className="font-semibold text-foreground/80">Order Now</span>{" "}
        re-checks lead times &amp; the 4 PM cut-off, then submits.
      </p>

      {loading && <p className="px-0.5 text-sm text-muted-foreground">Loading…</p>}

      {!loading && templates.length === 0 && (
        <div className="rounded-2xl border bg-card py-10 text-center text-sm text-muted-foreground">
          No templates yet — save one from New Request.
        </div>
      )}

      {templates.map((t) => {
        const m = meta(t);
        return (
          <div key={t.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-accent bg-accent text-accent-foreground">
                <ListChecks className="h-[21px] w-[21px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight">{t.name}</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {m.count} item{m.count !== 1 ? "s" : ""}
                  {m.cats.length > 0 ? ` · ${m.cats.join(" · ")}` : ""}
                </div>
              </div>
            </div>

            {m.unavailable > 0 && (
              <div
                className="mt-3 flex items-center gap-2 rounded-lg border p-2.5"
                style={{ background: "var(--st-pend-bg)", borderColor: "var(--st-pend-line)" }}
              >
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--st-pend)" }} />
                <span className="text-xs text-foreground/80">
                  {m.unavailable} item{m.unavailable !== 1 ? "s" : ""} currently unavailable — excluded on order.
                </span>
              </div>
            )}

            <div className="mt-3 flex gap-2.5">
              <button
                onClick={() => openOrder(t)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
              >
                <Send className="h-4 w-4" /> Order Now
              </button>
              <button
                onClick={() => void deleteTemplate(t.id)}
                aria-label="Delete template"
                className="grid shrink-0 place-items-center rounded-xl border border-input px-4 text-muted-foreground transition hover:text-foreground"
              >
                <Trash2 className="h-[17px] w-[17px]" />
              </button>
            </div>
          </div>
        );
      })}

      {!loading && templates.length > 0 && (
        <Link
          href="/request"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-[0.98]"
        >
          <Plus className="h-[17px] w-[17px]" /> New template from a cart
        </Link>
      )}

      <Dialog open={active != null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Order &ldquo;{active.name}&rdquo;</DialogTitle>
                <DialogDescription>
                  Cut-off + lead time still apply. Unavailable items are excluded.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="tdate">Delivery date</Label>
                <Input
                  id="tdate"
                  type="date"
                  min={minDate}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> Earliest: {minDate} (4:00 PM London cut-off)
                </p>
              </div>
              <DialogFooter>
                <Button disabled={ordering || !deliveryDate} onClick={orderNow}>
                  {ordering ? "Submitting…" : "Submit Request"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
