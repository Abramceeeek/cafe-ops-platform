// generate-receipt — ROADMAP 4.1, PROJECT_SPEC §12.1.
// Builds a PDF receipt with pdf-lib (Deno-friendly, no headless browser), stores
// it in the private 'receipts' bucket (created on first run), records the
// receipts row and links orders.receipt_id. Invoked async from order-state-change
// on the 'delivered' transition.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { buildReceiptModel, type RItem } from "./lib.ts";

interface ItemRow {
  quantity: number;
  unit: string;
  unit_cost: number | null;
  products: { name: string } | null;
  order_item_modifiers: { modifier_option_name: string }[];
}

Deno.serve(async (req) => {
  try {
    const { order_id } = (await req.json()) as { order_id: string };
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: order, error } = await admin
      .from("orders")
      .select(
        `id, shop_id, requested_delivery_date, delivered_at,
         shops ( name ),
         order_items ( quantity, unit, unit_cost, products ( name ), order_item_modifiers ( modifier_option_name ) )`,
      )
      .eq("id", order_id)
      .single();
    if (error || !order) return Response.json({ error: "order_not_found" }, { status: 404 });

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

    return Response.json({ ok: true, receipt_id: receiptId, path });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
