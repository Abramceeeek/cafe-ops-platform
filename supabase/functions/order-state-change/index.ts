// order-state-change Edge Function — ROADMAP 2.3/2.4, PROJECT_SPEC §7.4.
// The ONLY path allowed to mutate orders.status. Validates the transition and
// the caller's role, stamps the timestamp. (FCM + dual-routing on shop_confirmed
// are layered in later stages.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canTransition, roleAllowed, STATUS_TIMESTAMP } from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  order_id: string;
  new_status: string;
}

const SPECIALIST_CATEGORIES: Record<string, string> = {
  meat_specialist: "meat",
  bread_baker: "bread",
  pastry_chef: "pastry",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { order_id, new_status } = (await req.json()) as Payload;
    const url = Deno.env.get("SUPABASE_URL")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
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
    const role = profile.role as string;

    // Read current status with service role (authoritative).
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select(`
        status, 
        shop_id, 
        assigned_courier,
        order_items ( products ( category_id ) )
      `)
      .eq("id", order_id)
      .single();
      
    if (oErr || !order) return Response.json({ error: "order_not_found" }, { status: 404, headers: corsHeaders });

    const from = order.status as string;
    if (!canTransition(from, new_status)) {
      return Response.json(
        { error: "invalid_transition", from, to: new_status },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!roleAllowed(new_status, role)) {
      return Response.json(
        { error: "role_not_permitted", role, to: new_status },
        { status: 403, headers: corsHeaders },
      );
    }

    // Ownership checks
    if (role === "foh_manager" || role === "kitchen_manager") {
      if (order.shop_id !== profile.shop_id) {
        return Response.json({ error: "not_your_shop" }, { status: 403, headers: corsHeaders });
      }
    } else if (role in SPECIALIST_CATEGORIES) {
      const items = order.order_items as unknown as Array<{ products: { category_id: string } | null }>;
      const orderCat = items?.[0]?.products?.category_id;
      if (orderCat !== SPECIALIST_CATEGORIES[role]) {
        return Response.json({ error: "not_your_category" }, { status: 403, headers: corsHeaders });
      }
    } else if (role === "courier") {
      if (order.assigned_courier !== user.id) {
        return Response.json({ error: "not_assigned_courier" }, { status: 403, headers: corsHeaders });
      }
    }

    const patch: Record<string, unknown> = { status: new_status };
    const tsCol = STATUS_TIMESTAMP[new_status];
    if (tsCol) patch[tsCol] = new Date().toISOString();

    const { error: uErr } = await admin.from("orders").update(patch).eq("id", order_id);
    if (uErr) throw uErr;

    // Receipt generation on 'delivered' is triggered client-side after this
    // returns (reliable; function-to-function invoke here was flaky).
    return Response.json({ ok: true, from, to: new_status }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "internal_server_error" }, { status: 500, headers: corsHeaders });
  }
});
