// get-receipt — returns a short-lived signed URL for an order's receipt PDF.
// Access control: the caller must be able to SELECT the order under RLS (shop
// sees own, admin sees all); then a service-role signed URL is returned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { order_id } = (await req.json()) as { order_id: string };
    const url = Deno.env.get("SUPABASE_URL")!;

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

    // RLS scopes this — a row comes back only if the caller may see the order.
    const { data: allowed } = await userClient.from("orders").select("id").eq("id", order_id).maybeSingle();
    if (!allowed) return Response.json({ error: "forbidden" }, { status: 403 });

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: receipt } = await admin
      .from("receipts")
      .select("pdf_storage_path")
      .eq("order_id", order_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!receipt) return Response.json({ error: "no_receipt" }, { status: 404 });

    const { data: signed, error } = await admin.storage
      .from("receipts")
      .createSignedUrl(receipt.pdf_storage_path, 120);
    if (error) throw error;

    return Response.json({ url: signed.signedUrl });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
