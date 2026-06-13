"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
  emergency?: boolean; // past-cutoff / short-lead emergency order (waives lead-time floor)
  idempotency_key?: string; // one per submit attempt — dedupes network retries
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

  // Lead time validation. Emergency orders waive the cut-off / lead-time floor
  // (they're flagged is_emergency and the specialist is warned), but quantity
  // and the category/security checks above still apply.
  const errors: string[] = [];
  for (const it of payload.items) {
    if (it.quantity <= 0) errors.push(`Quantity must be positive for ${it.product_id}.`);
    if (!payload.emergency && !isDeliveryDateValid(payload.requested_delivery_date, now, cutoffPassed, it.lead_time_hours)) {
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
    p_is_emergency: !!payload.emergency,
    p_idempotency_key: payload.idempotency_key ?? null,
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
        is_emergency: !!payload.emergency,
        idempotency_key: payload.idempotency_key ?? null,
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
  in_transit: "in_transit_at",
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
  rejection_reason?: string; // why the specialist declined (on new_status === 'rejected')
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
  if (payload.new_status === "rejected") patch.rejection_reason = payload.rejection_reason?.trim() || null;

  // Line edits: the specialist adjusts quantities + drops lines as they approve;
  // the courier adjusts quantities at handoff (delivering more/less). Apply both
  // before flipping the status. Pricing is NOT set here — admin owns it (below).
  if (payload.new_status === "specialist_approved" || payload.new_status === "in_transit") {
    for (const id of payload.removed_item_ids ?? []) {
      const { error } = await admin.from("order_items").delete().eq("id", id).eq("order_id", payload.order_id);
      if (error) return { error: "internal_server_error", details: error.message };
    }
    for (const e of payload.item_edits ?? []) {
      if (e.quantity == null) continue;
      const { error } = await admin.from("order_items").update({ quantity: e.quantity }).eq("id", e.id).eq("order_id", payload.order_id);
      if (error) return { error: "internal_server_error", details: error.message };
    }

    // Audit 2026-06-13: never strand an order with zero line items (mirrors the
    // specialist_review (0041) + change_order_status (0043) DB guards, on the web path).
    const { count: remaining } = await admin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", payload.order_id)
      .gt("quantity", 0);
    if (!remaining) return { error: "cannot_transition_empty_order" };
  }

  // On approval, price every surviving line from the admin-set product price
  // (specialists no longer price), and flag the order edited so the shop reviews.
  if (payload.new_status === "specialist_approved") {
    const { data: liveItems } = await admin
      .from("order_items")
      .select("id, product_id, quantity, requested_quantity")
      .eq("order_id", payload.order_id);
    const ids = Array.from(new Set((liveItems ?? []).map((r) => r.product_id)));
    const { data: prods } = ids.length
      ? await admin.from("products").select("id, price").in("id", ids)
      : { data: [] as { id: string; price: number | null }[] };
    const priceById = new Map((prods ?? []).map((p) => [p.id, p.price]));
    for (const it of liveItems ?? []) {
      const price = priceById.get(it.product_id) ?? null;
      const { error } = await admin.from("order_items").update({ unit_cost: price }).eq("id", it.id);
      if (error) return { error: "internal_server_error", details: error.message };
    }
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

    // Generate the receipt here with the service-role client. (The edge function
    // can't be triggered from the courier's session — courier isn't the shop —
    // and we have no edge-deploy path, so this keeps it shipping with the web app.)
    await generateReceipt(admin, payload.order_id);
  }

  return { ok: true, from, to: payload.new_status };
}

// Generate receipts for delivered orders that don't have one yet. The mobile
// courier "deliver" path records the status via RPC but can't render a PDF, so
// admin runs this (from Finance) to fill the gap. Admin-only; service-role.
export async function backfillReceipts() {
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
  const { data: profile } = await userClient.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!profile || !profile.is_active || profile.role !== "admin") return { error: "forbidden" };

  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: orders } = await admin.from("orders").select("id").eq("status", "delivered").is("receipt_id", null);
  let count = 0;
  for (const o of orders ?? []) {
    await generateReceipt(admin, o.id);
    count++;
  }
  return { ok: true, count };
}

// Server-side PDF receipt — built with the service-role client on the `delivered`
// transition. Writes the PDF to the private `receipts` bucket, inserts the
// receipts row and links orders.receipt_id. Idempotent (skips if already linked).
// Mirrors supabase/functions/generate-receipt (kept for the future Flutter path).
/* eslint-disable @typescript-eslint/no-explicit-any */
async function generateReceipt(admin: any, orderId: string) {
  const { data: order } = await admin
    .from("orders")
    .select(
      `id, shop_id, requested_delivery_date, delivered_at, status, receipt_id,
       shops ( name ),
       courier:profiles!orders_assigned_courier_fkey ( full_name ),
       order_items ( quantity, unit, unit_cost, products ( name ), order_item_modifiers ( modifier_option_name ) )`,
    )
    .eq("id", orderId)
    .single();
  if (!order || order.status !== "delivered" || order.receipt_id) return;

  let total = 0;
  let hasCosts = false;
  const lines = (order.order_items as any[]).map((i) => {
    const mods = (i.order_item_modifiers ?? []).map((m: any) => m.modifier_option_name);
    const desc = `${i.products?.name ?? "Item"}${mods.length ? ` (${mods.join(", ")})` : ""}`;
    let amount = "—";
    if (i.unit_cost != null) {
      const lt = Number(i.unit_cost) * Number(i.quantity);
      total += lt;
      hasCosts = true;
      amount = `£${lt.toFixed(2)}`;
    }
    return { desc, qty: `${i.quantity} ${i.unit}`, amount };
  });

  const receiptId = crypto.randomUUID();
  const shopName = (order.shops as any)?.name ?? "Shop";
  const courierName = (order.courier as any)?.full_name ?? "Courier";
  const deliveredStr = order.delivered_at
    ? new Date(order.delivered_at).toISOString().replace("T", " ").slice(0, 16)
    : "—";

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const grey = rgb(0.46, 0.45, 0.44);
  const M = 56;
  const RIGHT = 595 - M;
  let y = 792;
  const at = (t: string, x: number, size: number, f = font, color = ink) =>
    page.drawText(t, { x, y, size, font: f, color });
  const right = (t: string, size: number, f = font, color = ink) =>
    page.drawText(t, { x: RIGHT - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  const rule = (yy: number, color = rgb(0.85, 0.84, 0.82)) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: RIGHT, y: yy }, thickness: 1, color });

  at("bobo & wild", M, 22, bold);
  right("RECEIPT", 12, bold, grey);
  y -= 16;
  at("HubSync · Internal Delivery Receipt", M, 10, font, grey);
  right(`#${receiptId.slice(-8).toUpperCase()}`, 10, font, grey);
  y -= 16;
  rule(y);
  y -= 26;

  const meta: [string, string][] = [
    ["Shop", shopName],
    ["Delivery date", String(order.requested_delivery_date)],
    ["Delivered", deliveredStr],
    ["Delivered by", courierName],
  ];
  for (const [k, v] of meta) {
    at(k, M, 10, font, grey);
    at(v, M + 110, 11, bold);
    y -= 19;
  }

  y -= 10;
  at("ITEMS DELIVERED", M, 11, bold, grey);
  right("AMOUNT", 11, bold, grey);
  at("QTY", RIGHT - 150, 11, bold, grey);
  y -= 8;
  rule(y);
  y -= 20;
  for (const l of lines) {
    at(l.desc.length > 52 ? l.desc.slice(0, 51) + "…" : l.desc, M, 11);
    at(l.qty, RIGHT - 150, 11, font, grey);
    right(l.amount, 11);
    y -= 20;
  }
  y -= 2;
  rule(y);
  y -= 24;
  at("TOTAL", M, 13, bold);
  right(hasCosts ? `£${total.toFixed(2)}` : "—", 13, bold);

  y = 96;
  rule(y + 16);
  at("This is an internal transfer record between bobo & wild sites. Not a VAT invoice.", M, 9, font, grey);

  const bytes = await pdf.save();
  await admin.storage.createBucket("receipts", { public: false }).catch(() => {});
  const d = order.delivered_at ? new Date(order.delivered_at) : new Date();
  const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${order.shop_id}/${receiptId}.pdf`;
  const { error: upErr } = await admin.storage
    .from("receipts")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) return;

  await admin.from("receipts").insert({
    id: receiptId,
    order_id: orderId,
    shop_id: order.shop_id,
    pdf_storage_path: path,
    total_cost: hasCosts ? total : null,
  });
  await admin.from("orders").update({ receipt_id: receiptId }).eq("id", orderId);
}
