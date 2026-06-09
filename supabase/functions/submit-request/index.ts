// submit-request Edge Function — the mobile entry point for placing an order.
// Flutter can't call the Next.js server action or the service_role-only
// submit_request_atomic RPC directly, so this function mirrors the web
// `apps/admin_web/app/actions/orders.ts` submitOrder: it authenticates the user,
// enforces the same role/category + lead-time guards (with the emergency waiver),
// then calls submit_request_atomic with the service-role client.
// ⚠️ Keep the guard logic in step with orders.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InItem {
  product_id: string;
  quantity: number;
  custom_note?: string;
  modifiers?: { modifier_option_id: string; modifier_group_name: string; modifier_option_name: string }[];
}

function earliestDate(now: Date, maxLeadHours: number, cutoffPassed: boolean): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const leadDays = Math.max(1, Math.ceil(maxLeadHours / 24));
  d.setUTCDate(d.getUTCDate() + leadDays + (cutoffPassed ? 1 : 0));
  return d.toISOString().slice(0, 10);
}

function getLondonHour(d: Date): number {
  const year = d.getUTCFullYear();
  const marchEnd = new Date(Date.UTC(year, 2, 31));
  marchEnd.setUTCDate(31 - marchEnd.getUTCDay());
  marchEnd.setUTCHours(1);
  const octEnd = new Date(Date.UTC(year, 9, 31));
  octEnd.setUTCDate(31 - octEnd.getUTCDay());
  octEnd.setUTCHours(1);
  const isBST = d >= marchEnd && d < octEnd;
  return (d.getUTCHours() + (isBST ? 1 : 0)) % 24;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const body = await req.json();
    const requested_delivery_date: string = body.requested_delivery_date;
    const emergency = !!body.emergency;
    const idempotency_key: string | null = body.idempotency_key ?? null;
    const items: InItem[] = body.items ?? [];

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: profile } = await userClient
      .from("profiles").select("role, shop_id, is_active").eq("id", user.id).single();
    if (!profile || !profile.is_active) return json({ error: "forbidden" }, 403);
    if (profile.role !== "foh_manager" && profile.role !== "kitchen_manager") return json({ error: "role_not_permitted" }, 403);
    if (!profile.shop_id) return json({ error: "no_shop_assigned" }, 400);
    if (!items.length) return json({ error: "validation_failed", details: ["Cart is empty."] }, 400);

    const now = new Date();
    const { data: cutoffConfig } = await admin
      .from("cutoff_config").select("cutoff_time")
      .lte("effective_from", now.toISOString().split("T")[0])
      .order("effective_from", { ascending: false }).limit(1).single();
    const cutoffHour = parseInt((cutoffConfig?.cutoff_time || "16:00:00").split(":")[0] || "16", 10);
    const cutoffPassed = getLondonHour(now) >= cutoffHour;

    const productIds = items.map((i) => i.product_id);
    const { data: dbProducts, error: dbErr } = await admin
      .from("products")
      .select(`id, category_id, lead_time_hours, unit, product_categories ( assigned_role ), modifier_groups ( id, is_required, name )`)
      .in("id", productIds);
    if (dbErr) return json({ error: "internal_server_error", details: dbErr.message }, 500);
    const prodMap = new Map((dbProducts ?? []).map((p: any) => [p.id, p]));

    const groupsMap: Record<string, any[]> = {};
    const errors: string[] = [];
    for (const item of items) {
      const real: any = prodMap.get(item.product_id);
      if (!real) return json({ error: "validation_failed", details: [`Product not found: ${item.product_id}`] }, 400);
      const assignedRole = real.product_categories?.assigned_role;
      if (profile.role === "foh_manager" && assignedRole !== "bread_baker") {
        return json({ error: "security_bypass", details: ["FOH managers can only order Pastry/Retail items."] }, 403);
      }
      if (profile.role === "kitchen_manager" && assignedRole !== "bread_baker" && assignedRole !== "meat_specialist") {
        return json({ error: "security_bypass", details: ["BOH managers can only order Bread/Meat items."] }, 403);
      }
      const requiredGroups = (real.modifier_groups || []).filter((g: any) => g && g.is_required);
      const providedNames = new Set((item.modifiers || []).map((m) => m?.modifier_group_name));
      for (const g of requiredGroups) {
        if (!providedNames.has(g.name)) {
          return json({ error: "validation_failed", details: [`Missing required modifier group "${g.name}"`] }, 400);
        }
      }
      if (item.quantity <= 0) errors.push(`Quantity must be positive for ${item.product_id}.`);
      if (!emergency && !(requested_delivery_date >= earliestDate(now, real.lead_time_hours, cutoffPassed))) {
        errors.push(`${item.product_id} needs ${real.lead_time_hours}h lead time.`);
      }
      (groupsMap[real.category_id] ??= []).push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit: real.unit,
        custom_note: item.custom_note ?? null,
        modifiers: item.modifiers ?? [],
      });
    }
    if (errors.length) return json({ error: "validation_failed", details: errors }, 400);

    const { data: rpcRes, error: rpcErr } = await admin.rpc("submit_request_atomic", {
      p_shop_id: profile.shop_id,
      p_submitted_by: user.id,
      p_requested_delivery_date: requested_delivery_date,
      p_groups: Object.values(groupsMap),
      p_is_emergency: emergency,
      p_idempotency_key: idempotency_key,
    });
    if (rpcErr) return json({ error: "internal_server_error", details: rpcErr.message }, 500);
    return json({ ok: true, order_ids: (rpcRes as any)?.order_ids ?? [] });
  } catch (e) {
    return json({ error: "internal_server_error", details: (e as Error).message }, 500);
  }
});
