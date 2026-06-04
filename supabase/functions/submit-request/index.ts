// submit-request Edge Function — ROADMAP 2.3, PROJECT_SPEC §8.
// Validates cut-off + lead time server-side, splits a multi-category cart into
// one order per specialist, and inserts orders/items atomically (service role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { splitByCategory, validateCart, type CartItem } from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  shop_id: string; // Ignored: overridden by server
  submitted_by: string; // Ignored: overridden by server
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("role, shop_id, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.is_active) {
      return Response.json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    if (profile.role !== "foh_manager" && profile.role !== "kitchen_manager") {
      return Response.json({ error: "role_not_permitted" }, { status: 403, headers: corsHeaders });
    }
    if (!profile.shop_id) {
      return Response.json({ error: "no_shop_assigned" }, { status: 403, headers: corsHeaders });
    }

    const payload = (await req.json()) as Payload;
    const now = new Date();
    const cutoffPassed = isCutoffPassed(now);

    const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Look up true product lead times and categories to prevent client tampering
    const productIds = payload.items.map(i => i.product_id);
    const { data: dbProducts, error: dbErr } = await admin
      .from("products")
      .select("id, category_id, lead_time_hours, unit")
      .in("id", productIds);

    if (dbErr) throw dbErr;
    const prodMap = new Map(dbProducts?.map(p => [p.id, p]) ?? []);

    for (const item of payload.items) {
      const real = prodMap.get(item.product_id);
      if (!real) {
        return Response.json({ error: "validation_failed", details: [`Product not found: ${item.product_id}`] }, { status: 400, headers: corsHeaders });
      }
      item.category_id = real.category_id;
      item.lead_time_hours = real.lead_time_hours;
      item.unit = real.unit;
    }

    const check = validateCart(payload.items, payload.requested_delivery_date, now, cutoffPassed);
    if (!check.ok) {
      return Response.json({ error: "validation_failed", details: check.errors }, { status: 400, headers: corsHeaders });
    }

    const groups = splitByCategory(payload.items);
    const created: string[] = [];

    for (const items of Object.values(groups)) {
      const { data, error: rpcErr } = await admin.rpc("submit_request_atomic", {
        p_shop_id: profile.shop_id,
        p_submitted_by: user.id,
        p_requested_delivery_date: payload.requested_delivery_date,
        p_items: items,
      });

      if (rpcErr) throw rpcErr;
      if (data && data.order_id) {
        created.push(data.order_id);
      }
    }

    return Response.json({ ok: true, order_ids: created }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "internal_server_error" }, { status: 500, headers: corsHeaders });
  }
});
