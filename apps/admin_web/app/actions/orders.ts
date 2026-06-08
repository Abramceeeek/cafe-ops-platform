"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { earliestDate } from "@/lib/utils";

export interface CartItem {
  product_id: string;
  category_id: string;
  quantity: number;
  lead_time_hours: number;
  unit: string;
  custom_note?: string;
  modifiers?: Array<{
    modifier_option_id: string;
    modifier_group_name: string;
    modifier_option_name: string;
  }>;
}

export interface Payload {
  shop_id: string;
  requested_delivery_date: string; // YYYY-MM-DD
  items: CartItem[];
}

function isDeliveryDateValid(requested: string, now: Date, cutoffPassed: boolean, leadTimeHours: number): boolean {
  return requested >= earliestDate(now, leadTimeHours, cutoffPassed);
}

function splitByCategory(items: CartItem[]): Record<string, CartItem[]> {
  const groups: Record<string, CartItem[]> = {};
  for (const it of items) {
    (groups[it.category_id] ??= []).push(it);
  }
  return groups;
}

export async function submitOrder(payload: Payload) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { }
      },
    },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return { error: "unauthorized" };
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("role, shop_id, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    return { error: "forbidden" };
  }

  if (profile.role !== "foh_manager" && profile.role !== "kitchen_manager") {
    return { error: "role_not_permitted" };
  }
  if (!profile.shop_id) {
    return { error: "no_shop_assigned" };
  }

  const now = new Date();
  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  // Fetch cut-off config
  const { data: cutoffConfig } = await admin
    .from("cutoff_config")
    .select("cutoff_time, timezone")
    .lte("effective_from", now.toISOString().split("T")[0])
    .order("effective_from", { ascending: false })
    .limit(1)
    .single();

  const cutoffTimeString = cutoffConfig?.cutoff_time || "16:00:00";
  const cutoffHour = parseInt(cutoffTimeString.split(":")[0] || "16", 10);

  const getLondonHour = (d: Date) => {
    const year = d.getUTCFullYear();
    const marchEnd = new Date(Date.UTC(year, 2, 31));
    marchEnd.setUTCDate(31 - marchEnd.getUTCDay());
    marchEnd.setUTCHours(1);
    const octEnd = new Date(Date.UTC(year, 9, 31));
    octEnd.setUTCDate(31 - octEnd.getUTCDay());
    octEnd.setUTCHours(1);
    const isBST = d >= marchEnd && d < octEnd;
    return (d.getUTCHours() + (isBST ? 1 : 0)) % 24;
  };
  const hourNow = getLondonHour(now);
  const cutoffPassed = hourNow >= cutoffHour;

  if (!payload.items || payload.items.length === 0) {
    return { error: "validation_failed", details: ["Cart is empty."] };
  }

  const productIds = payload.items.map(i => i.product_id);
  const { data: dbProducts, error: dbErr } = await admin
    .from("products")
    .select(`
      id, category_id, lead_time_hours, unit,
      product_categories ( assigned_role ),
      modifier_groups ( id, is_required, name )
    `)
    .in("id", productIds);

  if (dbErr) return { error: "internal_server_error", details: dbErr.message };

  const prodMap = new Map(dbProducts?.map(p => [p.id, p]) ?? []);

  // F-2: NATIVE Backend RLS Security Bypass Fix
  // Verify FOH manager only submits bread_baker assigned categories (Pastry/Retail), 
  // and BOH manager only submits meat_specialist / bread_baker (Meat/Bread).
  // Note: we can just check their specific allowed roles!
  
  for (const item of payload.items) {
    const real = prodMap.get(item.product_id);
    if (!real) {
      return { error: "validation_failed", details: [`Product not found: ${item.product_id}`] };
    }
    
    const assignedRole = (real.product_categories as { assigned_role?: string } | null)?.assigned_role;
    if (profile.role === "foh_manager") {
      if (assignedRole !== "bread_baker") {
         // Pastry and Retail are assigned to bread_baker
         return { error: "security_bypass", details: ["FOH managers can only order Pastry/Retail items."] };
      }
    } else if (profile.role === "kitchen_manager") {
      if (assignedRole !== "bread_baker" && assignedRole !== "meat_specialist") {
         return { error: "security_bypass", details: ["BOH managers can only order Bread/Meat items."] };
      }
    }

    const requiredGroups = (real.modifier_groups || []).filter((g: { is_required?: boolean } | null) => g && g.is_required);
    const providedNames = new Set((item.modifiers || []).map(m => m ? m.modifier_group_name : null));
    for (const g of requiredGroups) {
      if (!providedNames.has(g.name)) {
        return { error: "validation_failed", details: [`Missing required modifier group "${g.name}" for product ${item.product_id}`] };
      }
    }

    item.category_id = real.category_id;
    item.lead_time_hours = real.lead_time_hours;
    item.unit = real.unit;
  }

  // Lead time validation
  const errors: string[] = [];
  for (const it of payload.items) {
    if (it.quantity <= 0) errors.push(`Quantity must be positive for ${it.product_id}.`);
    if (!isDeliveryDateValid(payload.requested_delivery_date, now, cutoffPassed, it.lead_time_hours)) {
      errors.push(`${it.product_id} needs ${it.lead_time_hours}h lead time; earliest delivery ${earliestDate(now, it.lead_time_hours, cutoffPassed)}.`);
    }
  }

  if (errors.length > 0) {
    return { error: "validation_failed", details: errors };
  }

  const groups = Object.values(splitByCategory(payload.items));

  // Atomic path (migration 0022): create every order/item/modifier in ONE transaction.
  const { data: rpcRes, error: rpcErr } = await admin.rpc("submit_request_atomic", {
    p_shop_id: profile.shop_id,
    p_submitted_by: user.id,
    p_requested_delivery_date: payload.requested_delivery_date,
    p_groups: groups,
  });
  if (!rpcErr) {
    return { ok: true, order_ids: (rpcRes as { order_ids?: string[] } | null)?.order_ids ?? [] };
  }
  // Fallback (non-atomic) only when the RPC isn't applied to this environment yet.
  if (rpcErr.code !== "PGRST202" && !/submit_request_atomic/.test(rpcErr.message ?? "")) {
    return { error: "internal_server_error", details: rpcErr.message };
  }

  const created: string[] = [];
  for (const items of groups) {
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        shop_id: profile.shop_id,
        submitted_by: user.id,
        status: "pending_request",
        requested_delivery_date: payload.requested_delivery_date,
      })
      .select("id")
      .single();

    if (oErr) return { error: "internal_server_error", details: oErr.message };

    for (const it of items) {
      const { data: itemData, error: iErr } = await admin
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: it.product_id,
          quantity: it.quantity,
          requested_quantity: it.quantity, // preserve what the shop asked for
          unit: it.unit,
          custom_note: it.custom_note ?? null,
        })
        .select("id")
        .single();

      if (iErr) return { error: "internal_server_error", details: iErr.message };

      if (it.modifiers && it.modifiers.length > 0) {
        const mods = it.modifiers.map(m => ({
          order_item_id: itemData.id,
          modifier_option_id: m.modifier_option_id,
          modifier_group_name: m.modifier_group_name,
          modifier_option_name: m.modifier_option_name,
        }));
        const { error: mErr } = await admin.from("order_item_modifiers").insert(mods);
        if (mErr) return { error: "internal_server_error", details: mErr.message };
      }
    }
    created.push(order.id);
  }

  return { ok: true, order_ids: created };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_request: ["specialist_approved", "rejected"],
  // Specialist approval is final — no shop re-confirm. Production starts straight
  // from approved; the shop is only notified. (shop_confirmed kept for legacy rows.)
  specialist_approved: ["in_progress", "cancelled"],
  shop_confirmed: ["in_progress"],
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
  delivered: ["foh_manager", "kitchen_manager", "admin"],
};

const STATUS_TIMESTAMP: Record<string, string> = {
  specialist_approved: "specialist_approved_at",
  shop_confirmed: "shop_confirmed_at",
  in_progress: "in_progress_at",
  packaged: "packaged_at",
  ready_for_courier: "ready_at",
  delivered: "delivered_at",
};

function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

function roleAllowed(to: string, role: string): boolean {
  return (TRANSITION_ROLES[to] ?? []).includes(role);
}

export async function updateOrderStatus(payload: {
  order_id: string;
  new_status: string;
  signature_data?: string;
  item_costs?: { id: string; unit_cost: number }[];
  // Specialist Approve & Edit: adjust line quantities / costs and/or drop lines.
  item_edits?: { id: string; quantity?: number; unit_cost?: number }[];
  removed_item_ids?: string[];
}) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: any[]) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
      },
    },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: profile } = await userClient
    .from("profiles")
    .select("role, shop_id, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) return { error: "forbidden" };
  const role = profile.role as string;

  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  
  const { data: order, error: oErr } = await admin
    .from("orders")
    .select(`
      status, 
      shop_id, 
      requested_delivery_date,
      assigned_courier,
      order_items ( products ( product_categories ( assigned_role ) ) )
    `)
    .eq("id", payload.order_id)
    .single();
    
  if (oErr || !order) return { error: "order_not_found" };

  const from = order.status as string;
  if (!canTransition(from, payload.new_status)) return { error: "invalid_transition", from, to: payload.new_status };
  if (!roleAllowed(payload.new_status, role)) return { error: "role_not_permitted", role, to: payload.new_status };

  // Ownership checks
  if (role === "foh_manager" || role === "kitchen_manager") {
    if (order.shop_id !== profile.shop_id) return { error: "not_your_shop" };
  } else if (role === "meat_specialist" || role === "bread_baker") {
    const items = order.order_items as { products?: { product_categories?: { assigned_role?: string } | null } | null }[] | null;
    const assignedRole = items?.[0]?.products?.product_categories?.assigned_role;
    if (assignedRole !== role) return { error: "not_your_category" };
  }
  // Courier: single-route model (migration 0026) — any courier delivers the day's
  // route, so transitions aren't gated on assigned_courier (read is already global).

  const patch: Record<string, unknown> = { status: payload.new_status };

  // Approve & Edit: as the specialist approves, they may drop lines, change line
  // quantities, and set unit costs. Apply all of that before flipping the status,
  // then flag the order as edited so the shop is told to review the changes.
  if (payload.new_status === "specialist_approved") {
    for (const id of payload.removed_item_ids ?? []) {
      const { error } = await admin.from("order_items").delete().eq("id", id).eq("order_id", payload.order_id);
      if (error) return { error: "internal_server_error", details: error.message };
    }
    for (const e of payload.item_edits ?? []) {
      const upd: Record<string, unknown> = {};
      if (e.quantity != null) upd.quantity = e.quantity;
      if (e.unit_cost != null) upd.unit_cost = e.unit_cost;
      if (Object.keys(upd).length > 0) {
        const { error } = await admin.from("order_items").update(upd).eq("id", e.id).eq("order_id", payload.order_id);
        if (error) return { error: "internal_server_error", details: error.message };
      }
    }
    // Legacy cost-only payload (kept for back-compat).
    for (const c of payload.item_costs ?? []) {
      const { error } = await admin.from("order_items").update({ unit_cost: c.unit_cost }).eq("id", c.id).eq("order_id", payload.order_id);
      if (error) return { error: "internal_server_error", details: error.message };
    }
    // was_edited = any surviving line whose quantity differs from what was requested, or any removal.
    const { data: liveItems } = await admin
      .from("order_items")
      .select("quantity, requested_quantity")
      .eq("order_id", payload.order_id);
    const qtyChanged = (liveItems ?? []).some(
      (r) => r.requested_quantity != null && Number(r.quantity) !== Number(r.requested_quantity),
    );
    patch.was_edited = qtyChanged || (payload.removed_item_ids?.length ?? 0) > 0;
  }

  const tsCol = STATUS_TIMESTAMP[payload.new_status];
  if (tsCol) patch[tsCol] = new Date().toISOString();

  if (payload.new_status === "specialist_approved") {
    const { data: courier } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "courier")
      .limit(1)
      .single();
    if (courier) patch.assigned_courier = courier.id;
  }

  const { data: updated, error: uErr } = await admin
    .from("orders")
    .update(patch)
    .eq("id", payload.order_id)
    .eq("status", from)
    .select("id")
    .maybeSingle();

  if (uErr) return { error: "internal_server_error", details: uErr.message };
  if (!updated) return { error: "concurrent_modification" };

  if (payload.new_status === "shop_confirmed" && order.assigned_courier) {
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
      .eq("shop_id", shopId)
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
        shop_id: shopId,
        stop_sequence: nextSeq
      });
    }
  }

  if (payload.new_status === "delivered") {
    const { data: manifest } = await admin
      .from("delivery_manifests")
      .select("id")
      .eq("delivery_date", order.requested_delivery_date)
      .limit(1)
      .maybeSingle();

    if (manifest) {
      await admin
        .from("manifest_stops")
        .update({
          signed_off_by: user.id,
          signed_off_at: new Date().toISOString(),
          signature_data: payload.signature_data || null,
        })
        .eq("manifest_id", manifest.id)
        .eq("shop_id", order.shop_id);
    }

    // Call generate-receipt
    await userClient.functions.invoke("generate-receipt", {
      body: { order_id: payload.order_id },
    });
  }

  return { ok: true, from, to: payload.new_status };
}
