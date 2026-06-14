"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus, ListChecks, TriangleAlert, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
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
      .order("created_at", { ascending: false });
    setTemplates((data ?? []) as unknown as Template[]);
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

  // Load the template's available items into the New Request cart so the user can
  // edit quantities / items and pick the delivery date before submitting.
  function editInRequest(t: Template) {
    const available = t.order_template_items.filter((i) => i.products);
    if (available.length === 0) return toast.error("All items in this template are unavailable.");
    const seed = available.map((i) => ({
      product_id: i.products!.id,
      quantity: i.quantity,
      note: i.custom_note ?? "",
      modifier_option_ids: i.order_template_item_modifiers.map((m) => m.modifier_option_id),
    }));
    try {
      sessionStorage.setItem("request_seed", JSON.stringify(seed));
    } catch {
      return toast.error("Couldn't open the request — please try again.");
    }
    const skipped = t.order_template_items.length - available.length;
    if (skipped > 0) toast.info(`${skipped} unavailable item(s) skipped.`);
    router.push("/request");
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;
    const { error } = await createClient().from("order_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Template deleted.");
    await load();
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
        Saved carts for your role.{" "}
        <span className="font-semibold text-foreground/80">Edit in New Request</span> loads a template
        into the cart so you can adjust it and pick the delivery date before submitting.
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

            {t.order_template_items.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                {t.order_template_items.map((i) => {
                  const mods = i.order_template_item_modifiers
                    .map((m) => m.modifier_options?.name)
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={i.id} className="flex items-start justify-between gap-2 text-[13px]">
                      <span className={"min-w-0 " + (i.products ? "" : "italic text-muted-foreground line-through")}>
                        <span className="font-medium">{i.products?.name ?? "Unavailable item"}</span>
                        {mods && <span className="text-muted-foreground"> · {mods}</span>}
                        {i.custom_note && <span className="italic text-muted-foreground"> — &ldquo;{i.custom_note}&rdquo;</span>}
                      </span>
                      <span className="shrink-0 font-mono">
                        {i.quantity} {i.products?.unit ?? ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

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
                onClick={() => editInRequest(t)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
              >
                <Pencil className="h-4 w-4" /> Edit in New Request
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
    </div>
  );
}
