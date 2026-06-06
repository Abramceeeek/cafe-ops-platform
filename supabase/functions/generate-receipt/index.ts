// generate-receipt — ROADMAP 4.1, PROJECT_SPEC §12.1.
// Builds a PDF receipt with pdf-lib (Deno-friendly, no headless browser), stores
// it in the private 'receipts' bucket (created on first run), records the
// receipts row and links orders.receipt_id. Invoked async from order-state-change
// on the 'delivered' transition.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { buildReceiptModel, type RItem } from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ItemRow {
  quantity: number;
  unit: string;
  unit_cost: number | null;
  products: { name: string } | null;
  order_item_modifiers: { modifier_option_name: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { order_id } = (await req.json()) as { order_id: string };
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: order, error } = await admin
      .from("orders")
      .select(
        `id, shop_id, requested_delivery_date, delivered_at, status, receipt_id,
         shops ( name ),
         courier:profiles!orders_assigned_courier_fkey ( full_name ),
         order_items ( quantity, unit, unit_cost, products ( name ), order_item_modifiers ( modifier_option_name ) )`
      )
      .eq("id", order_id)
      .single();
      
    if (error || !order) return Response.json({ error: "order_not_found" }, { status: 404, headers: corsHeaders });

    // Authorization: Admin or owning shop manager
    if (profile.role !== "admin") {
      if ((profile.role !== "foh_manager" && profile.role !== "kitchen_manager") || profile.shop_id !== order.shop_id) {
        return Response.json({ error: "not_your_shop" }, { status: 403, headers: corsHeaders });
      }
    }

    // Status check
    if (order.status !== "delivered") {
       return Response.json({ error: "order_not_delivered" }, { status: 400, headers: corsHeaders });
    }

    // Idempotency check
    if (order.receipt_id) {
       const { data: existing } = await admin.from("receipts").select("pdf_storage_path").eq("id", order.receipt_id).single();
       if (existing) {
         return Response.json({ ok: true, receipt_id: order.receipt_id, path: existing.pdf_storage_path }, { headers: corsHeaders });
       }
    }

    const items: RItem[] = (order.order_items as unknown as ItemRow[]).map((i) => ({
      name: i.products?.name ?? "Item",
      modifiers: i.order_item_modifiers.map((m) => m.modifier_option_name),
      quantity: i.quantity,
      unit: i.unit,
      unit_cost: i.unit_cost,
    }));
    const model = buildReceiptModel(items);

    const receiptId = crypto.randomUUID();
    const shopName = (order.shops as unknown as { name: string } | null)?.name ?? "Shop";

    // Render PDF
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    const line = (t: string, size = 11, b = false) => {
      page.drawText(t, { x: 50, y, size, font: b ? bold : font });
      y -= size + 7;
    };
    line("HubSync - Internal Dispatch Receipt", 16, true);
    line(`Receipt #: ${receiptId.slice(-8).toUpperCase()}`);
    line(`Shop: ${shopName}`);
    line(`Delivery date: ${order.requested_delivery_date}`);
    
    const issuedStr = order.delivered_at 
      ? new Date(order.delivered_at).toISOString().replace("T", " ").slice(0, 16) 
      : "N/A";
    line(`Date Issued: ${issuedStr}`);

    const courierObj = order.courier as unknown as { full_name: string } | null;
    line(`Courier: ${courierObj?.full_name ?? "Unknown"}`);

    const { data: manifest } = await admin
      .from("delivery_manifests")
      .select("id")
      .eq("delivery_date", order.requested_delivery_date)
      .limit(1)
      .maybeSingle();

    let stop = null;
    if (manifest) {
      const { data: stopData } = await admin
        .from("manifest_stops")
        .select(`signature_data, signed_off_by:profiles!manifest_stops_signed_off_by_fkey ( full_name )`)
        .eq("manifest_id", manifest.id)
        .eq("shop_id", order.shop_id)
        .maybeSingle();
      stop = stopData as unknown as { signature_data: string | null; signed_off_by: { full_name: string } | null } | null;
    }

    line(`Received By: ${stop?.signed_off_by?.full_name ?? "Unknown"}`);
    line(`Signature Captured: ${stop?.signature_data ? "Yes" : "No"}`);
    y -= 6;
    line("ITEMS DELIVERED:", 12, true);
    for (const l of model.lines) line(`${l.desc}  x ${l.qty}    ${l.amount}`);
    y -= 6;
    line(`TOTAL: ${model.hasCosts ? "GBP " + model.total.toFixed(2) : "-"}`, 12, true);
    y -= 10;
    line("This is an internal transfer record. Not a VAT invoice.", 9);
    const bytes = await pdf.save();

    // Ensure bucket + upload
    await admin.storage.createBucket("receipts", { public: false }).catch(() => {});
    const d = order.delivered_at ? new Date(order.delivered_at) : new Date();
    const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${order.shop_id}/${receiptId}.pdf`;
    const { error: upErr } = await admin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    await admin.from("receipts").insert({
      id: receiptId,
      order_id,
      shop_id: order.shop_id,
      pdf_storage_path: path,
      total_cost: model.hasCosts ? model.total : null,
    });
    await admin.from("orders").update({ receipt_id: receiptId }).eq("id", order_id);

    return Response.json({ ok: true, receipt_id: receiptId, path }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "internal_server_error" }, { status: 500, headers: corsHeaders });
  }
});
