// generate-monthly-statement — ROADMAP 4.2, spec §12.2.
// Per active shop, aggregates the month's daily receipts into a summary PDF in
// the 'receipts' bucket and returns signed download URLs. Manually triggerable by
// admin (Finance page) or by a pg_cron schedule (see docs). v0 returns URLs
// rather than inserting summary rows (receipts.order_id is NOT NULL).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { monthRange, previousMonth, sumByShop } from "./lib.ts";

Deno.serve(async (req) => {
  try {
    const body = (await req.json().catch(() => ({}))) as { year?: number; month?: number };
    const pm = previousMonth(new Date());
    const year = body.year ?? pm.year;
    const month = body.month ?? pm.month;
    const { start, end } = monthRange(year, month);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: shops } = await admin.from("shops").select("id, name").eq("is_active", true);
    const { data: receipts } = await admin
      .from("receipts")
      .select("shop_id, total_cost, generated_at")
      .eq("is_monthly_summary", false)
      .gte("generated_at", start)
      .lt("generated_at", end);

    const totals = sumByShop((receipts ?? []) as { shop_id: string; total_cost: number | null }[]);
    await admin.storage.createBucket("receipts", { public: false }).catch(() => {});

    const mm = String(month).padStart(2, "0");
    const statements: { shop_id: string; shop_name: string; total: number; count: number; url: string | null }[] = [];

    for (const shop of shops ?? []) {
      const agg = totals[shop.id] ?? { total: 0, count: 0 };
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([595, 842]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let y = 800;
      const line = (t: string, size = 11, b = false) => {
        page.drawText(t, { x: 50, y, size, font: b ? bold : font });
        y -= size + 8;
      };
      line("HubSync - Monthly Statement", 16, true);
      line(`Shop: ${shop.name}`);
      line(`Period: ${year}-${mm}`);
      y -= 8;
      line(`Deliveries: ${agg.count}`, 12, true);
      line(`Total: GBP ${agg.total.toFixed(2)}`, 12, true);
      y -= 10;
      line("Internal summary. Not a VAT invoice.", 9);
      const bytes = await pdf.save();

      const path = `${year}/${mm}/${shop.id}/MONTHLY_SUMMARY.pdf`;
      await admin.storage.from("receipts").upload(path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      const { data: signed } = await admin.storage.from("receipts").createSignedUrl(path, 300);
      statements.push({
        shop_id: shop.id,
        shop_name: shop.name,
        total: agg.total,
        count: agg.count,
        url: signed?.signedUrl ?? null,
      });
    }

    return Response.json({ period: `${year}-${mm}`, statements });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
