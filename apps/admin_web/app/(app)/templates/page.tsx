"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Clock, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  } | null; // null when the product is 86'd (hidden by RLS)
  order_template_item_modifiers: TemplateModifier[];
}
interface Template {
  id: string;
  name: string;
  order_template_items: TemplateItem[];
}

function earliestDate(now: Date, maxLeadHours: number): string {
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now),
  );
  const cutoffPassed = londonHour >= 16;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + (cutoffPassed ? 2 : 1));
  d.setUTCHours(d.getUTCHours() + maxLeadHours);
  return d.toISOString().slice(0, 10);
}

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
             products ( id, name, unit, category_id, lead_time_hours ),
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

  const itemSummary = (t: Template) =>
    t.order_template_items
      .map((i) => (i.products ? `${i.products.name} ×${i.quantity}` : "(unavailable item)"))
      .join(", ");

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
    const { data, error } = await createClient().functions.invoke("submit-request", {
      body: { shop_id: shopId, submitted_by: userId, requested_delivery_date: deliveryDate, items },
    });
    setOrdering(false);
    if (error) return toast.error(error.message);
    if (excluded > 0) toast.warning(`${excluded} unavailable item(s) were excluded.`);
    const ids = (data as { order_ids?: string[] } | null)?.order_ids ?? [];
    toast.success(`Request submitted — ${ids.length} order(s) created.`);
    setActive(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">Reorder your saved standard orders in one tap.</p>
      </div>

      {!loading && templates.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No templates yet — save one from New Request.
          </CardContent>
        </Card>
      )}

      {templates.map((t) => (
        <Card key={t.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t.name}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openOrder(t)}>
                <ShoppingCart className="h-4 w-4" /> Order Now
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void deleteTemplate(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{itemSummary(t)}</p>
          </CardContent>
        </Card>
      ))}

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
