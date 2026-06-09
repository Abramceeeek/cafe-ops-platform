import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ⚠️ CANONICAL STATE MACHINE — must stay byte-for-byte in step with the web
// server action `apps/admin_web/app/actions/orders.ts` (VALID_TRANSITIONS /
// TRANSITION_ROLES / STATUS_TIMESTAMP). The web is the live path today; this
// edge function is the entry point for the Flutter apps. Until the web migrates
// to call this function, any change here must be mirrored there and vice-versa.
const ORDER_SPEC: Record<string, string[]> = {
  pending_request: ["specialist_approved", "rejected"],
  // Approve → specialist marks "ready for delivery" (ready_for_courier), skipping
  // the old production stages. in_progress/packaged kept only for legacy rows.
  specialist_approved: ["ready_for_courier", "in_progress", "cancelled"],
  shop_confirmed: ["ready_for_courier", "in_progress"],
  in_progress: ["packaged"],
  packaged: ["ready_for_courier"],
  ready_for_courier: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

const TRANSITION_ROLES: Record<string, string[]> = {
  specialist_approved: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  rejected: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  shop_confirmed: ["foh_manager", "kitchen_manager", "admin"],
  cancelled: ["foh_manager", "kitchen_manager", "admin"],
  in_progress: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  packaged: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  ready_for_courier: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  in_transit: ["courier", "admin"],
  // Courier confirms delivery (single-party courier sign-off in the new flow).
  delivered: ["courier", "admin"],
};

const STATUS_TIMESTAMP: Record<string, string> = {
  specialist_approved: "specialist_approved_at",
  shop_confirmed: "shop_confirmed_at",
  in_progress: "in_progress_at",
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

    const { id, status, item_edits, removed_item_ids, rejection_reason } = await req.json();
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

    // 5. Build update (admin client bypasses RLS; role + state machine already validated)
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const updatePayload: Record<string, any> = { status };
    const tsCol = STATUS_TIMESTAMP[status];
    if (tsCol) updatePayload[tsCol] = new Date().toISOString();
    if (status === "rejected") updatePayload.rejection_reason = (rejection_reason ?? "").trim() || null;

    // Line edits: specialist drops lines / changes qty as they approve; courier
    // changes qty at handoff (in_transit). Pricing is admin-owned (set below).
    if (status === "specialist_approved" || status === "in_transit") {
      for (const rid of (removed_item_ids ?? [])) {
        const { error } = await adminClient.from("order_items").delete().eq("id", rid).eq("order_id", id);
        if (error) throw error;
      }
      for (const e of (item_edits ?? [])) {
        if (e.quantity == null) continue;
        const { error } = await adminClient.from("order_items").update({ quantity: e.quantity }).eq("id", e.id).eq("order_id", id);
        if (error) throw error;
      }
    }

    // On approval: price each surviving line from the admin-set product price and
    // flag the order edited so the shop reviews the diff.
    if (status === "specialist_approved") {
      const { data: liveItems } = await adminClient
        .from("order_items").select("id, product_id, quantity, requested_quantity").eq("order_id", id);
      const ids = [...new Set((liveItems ?? []).map((r: any) => r.product_id))];
      const { data: prods } = ids.length
        ? await adminClient.from("products").select("id, price").in("id", ids)
        : { data: [] };
      const priceById = new Map((prods ?? []).map((p: any) => [p.id, p.price]));
      for (const it of (liveItems ?? [])) {
        const { error } = await adminClient.from("order_items").update({ unit_cost: priceById.get(it.product_id) ?? null }).eq("id", it.id);
        if (error) throw error;
      }
      const qtyChanged = (liveItems ?? []).some(
        (r: any) => r.requested_quantity != null && Number(r.quantity) !== Number(r.requested_quantity),
      );
      updatePayload.was_edited = qtyChanged || (removed_item_ids ?? []).length > 0;
    }

    // 6. Update order
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
      // generate-receipt reads `order_id` from the body (not `orderId`).
      await adminClient.functions.invoke("generate-receipt", { body: { order_id: id } });
    }

    // TODO: Trigger FCM notifications

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
