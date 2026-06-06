import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Centralized state transition logic
const ORDER_SPEC: Record<string, string[]> = {
  pending_request: ["specialist_approved", "rejected"],
  specialist_approved: ["shop_confirmed"],
  shop_confirmed: ["in_progress"],
  in_progress: ["packaged"],
  packaged: ["ready_for_courier"],
  ready_for_courier: ["in_transit"],
  in_transit: ["delivered"],
};

const TRANSITION_ROLES: Record<string, string[]> = {
  specialist_approved: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  rejected: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  shop_confirmed: ["foh_manager", "kitchen_manager", "admin"],
  in_progress: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  packaged: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  ready_for_courier: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  in_transit: ["courier", "admin"],
  delivered: ["courier", "admin"],
};

const STATUS_TIMESTAMP: Record<string, string> = {
  specialist_approved: "specialist_approved_at",
  shop_confirmed: "shop_confirmed_at",
  packaged: "packaged_at",
  ready_for_courier: "ready_at",
  delivered: "delivered_at",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth header" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { id, status } = await req.json();
    if (!id || !status) {
      return new Response(JSON.stringify({ error: "id and status are required" }), { status: 400, headers: corsHeaders });
    }

    // 1. Get user & role
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const role = profile?.role;
    if (!role) throw new Error("No role assigned");

    // 2. Validate transition permission
    const allowedRoles = TRANSITION_ROLES[status];
    if (!allowedRoles || !allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Role ${role} cannot transition to ${status}` }), { status: 403, headers: corsHeaders });
    }

    // 3. Get current order
    const { data: order, error: orderError } = await supabase.from("orders").select("status").eq("id", id).single();
    if (orderError || !order) throw new Error("Order not found");

    // 4. Validate state machine
    const validNextStates = ORDER_SPEC[order.status] ?? [];
    if (!validNextStates.includes(status)) {
      return new Response(JSON.stringify({ error: `Cannot transition from ${order.status} to ${status}` }), { status: 400, headers: corsHeaders });
    }

    // 5. Build update
    const updatePayload: Record<string, any> = { status };
    const tsCol = STATUS_TIMESTAMP[status];
    if (tsCol) {
      updatePayload[tsCol] = new Date().toISOString();
    }

    // 6. Update order (using adminClient to bypass RLS, since we already validated role and state machine)
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: updateError } = await adminClient.from("orders").update(updatePayload).eq("id", id);
    if (updateError) throw updateError;

    // 7. Side effects

    if (status === "shop_confirmed") {
      // Trigger manifest creation
      const { data: o } = await adminClient.from("orders").select("shop_id, requested_delivery_date").eq("id", id).single();
      if (o) {
        const { data: m } = await adminClient.from("delivery_manifests").select("id").eq("delivery_date", o.requested_delivery_date).single();
        let manifestId = m?.id;
        if (!manifestId) {
          const { data: newM } = await adminClient.from("delivery_manifests").insert({ delivery_date: o.requested_delivery_date }).select().single();
          manifestId = newM?.id;
        }
        if (manifestId) {
          await adminClient.from("manifest_stops").insert({ manifest_id: manifestId, shop_id: o.shop_id });
        }
      }
    }

    if (status === "delivered") {
      await adminClient.functions.invoke("generate-receipt", { body: { orderId: id } });
    }

    // TODO: Trigger FCM notifications

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
