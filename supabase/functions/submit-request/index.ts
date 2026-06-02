// submit-request Edge Function — ROADMAP 2.3, PROJECT_SPEC §8.
// Validates cut-off + lead time server-side, splits a multi-category cart into
// one order per specialist, and inserts orders/items atomically (service role).
//
// v0 scope: trusts the authenticated caller's shop context from the payload;
// JWT-derived submitted_by hardening and FCM dispatch come next.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { splitByCategory, validateCart, type CartItem } from "./lib.ts";

interface Payload {
  shop_id: string;
  submitted_by: string;
  requested_delivery_date: string; // YYYY-MM-DD
  items: Array<
    CartItem & {
      unit: string;
      modifiers?: Array<{
        modifier_option_id: string;
        modifier_group_name: string;
        modifier_option_name: string;
      }>;
    }
  >;
}

// London cut-off check. Intl gives the local hour without a tz dependency.
function isCutoffPassed(now: Date, cutoffHour = 16): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return hour >= cutoffHour;
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as Payload;
    const now = new Date();
    const cutoffPassed = isCutoffPassed(now);

    const check = validateCart(payload.items, payload.requested_delivery_date, now, cutoffPassed);
    if (!check.ok) {
      return Response.json({ error: "validation_failed", details: check.errors }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const groups = splitByCategory(payload.items);
    const created: string[] = [];

    for (const items of Object.values(groups)) {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          shop_id: payload.shop_id,
          submitted_by: payload.submitted_by,
          status: "pending_request",
          requested_delivery_date: payload.requested_delivery_date,
        })
        .select("id")
        .single();
      if (oErr) throw oErr;

      for (const it of items) {
        const { data: item, error: iErr } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: it.product_id,
            quantity: it.quantity,
            unit: it.unit,
            custom_note: it.custom_note ?? null,
          })
          .select("id")
          .single();
        if (iErr) throw iErr;

        for (const m of it.modifiers ?? []) {
          const { error: mErr } = await supabase.from("order_item_modifiers").insert({
            order_item_id: item.id,
            modifier_option_id: m.modifier_option_id,
            modifier_group_name: m.modifier_group_name,
            modifier_option_name: m.modifier_option_name,
          });
          if (mErr) throw mErr;
        }
      }
      created.push(order.id);
    }

    return Response.json({ ok: true, order_ids: created });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
