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
  signature_data?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const { order_id, new_status, signature_data } = payload;
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
        requested_delivery_date,
        assigned_courier,
        order_items ( products ( product_categories ( assigned_role ) ) )
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
    } else if (role === "meat_specialist" || role === "bread_baker" || role === "pastry_chef") {
      const items = order.order_items as any;
      const assignedRole = items?.[0]?.products?.product_categories?.assigned_role;
      if (assignedRole !== role) {
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

    if (new_status === "specialist_approved") {
      // Auto-assign to default courier to fulfill grouping
      const { data: courier } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "courier")
        .limit(1)
        .single();
      if (courier) {
        patch.assigned_courier = courier.id;
      }
    }

    const { data: updated, error: uErr } = await admin
      .from("orders")
      .update(patch)
      .eq("id", order_id)
      .eq("status", from)
      .select("id")
      .maybeSingle();

    if (uErr) throw uErr;
    if (!updated) {
      return Response.json({ error: "concurrent_modification" }, { status: 409, headers: corsHeaders });
    }

    if (new_status === "specialist_approved" && patch.assigned_courier) {
      const courierId = patch.assigned_courier as string;
      const deliveryDate = order.requested_delivery_date;
      const shopId = order.shop_id;

      let manifestId: string;
      const { data: existingManifest } = await admin
        .from("delivery_manifests")
        .select("id")
        .eq("courier_id", courierId)
        .eq("delivery_date", deliveryDate)
        .limit(1)
        .maybeSingle();

      if (existingManifest) {
        manifestId = existingManifest.id;
      } else {
        const { data: newManifest } = await admin
          .from("delivery_manifests")
          .insert({ courier_id: courierId, delivery_date: deliveryDate })
          .select("id")
          .single();
        manifestId = newManifest!.id;
      }

      const { data: existingStop } = await admin
        .from("manifest_stops")
        .select("id")
        .eq("manifest_id", manifestId)
        .eq("order_id", order_id)
        .maybeSingle();
      
      if (!existingStop) {
        const { data: seqData } = await admin
          .from("manifest_stops")
          .select("stop_sequence")
          .eq("manifest_id", manifestId)
          .order("stop_sequence", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        const nextSeq = (seqData?.stop_sequence || 0) + 1;

        await admin.from("manifest_stops").insert({
          manifest_id: manifestId,
          order_id: order_id,
          shop_id: shopId,
          stop_sequence: nextSeq
        });
      }
    }

    if (new_status === "delivered") {
      const { error: msErr } = await admin
        .from("manifest_stops")
        .update({
          signed_off_by: user.id,
          signed_off_at: new Date().toISOString(),
          signature_data: signature_data || null,
        })
        .eq("order_id", order_id);
      if (msErr) {
        console.error("Failed to update manifest_stops:", msErr);
      }
    }

    // Receipt generation on 'delivered' is triggered client-side after this
    // returns (reliable; function-to-function invoke here was flaky).
    return Response.json({ ok: true, from, to: new_status }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "internal_server_error", details: String(e) }, { status: 500, headers: corsHeaders });
  }
});
