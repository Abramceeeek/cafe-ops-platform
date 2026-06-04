// get-receipt — returns a short-lived signed URL for an order's receipt PDF.
// Access control: the caller must be able to SELECT the order under RLS (shop
// sees own, admin sees all); then a service-role signed URL is returned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { order_id } = (await req.json()) as { order_id: string };
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

    // RLS scopes this — a row comes back only if the caller may see the order.
    const { data: allowed } = await userClient.from("orders").select("id").eq("id", order_id).maybeSingle();
    if (!allowed) return Response.json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

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
    if (!receipt) return Response.json({ error: "no_receipt" }, { status: 404, headers: corsHeaders });

    const { data: signed, error } = await admin.storage
      .from("receipts")
      .createSignedUrl(receipt.pdf_storage_path, 120);
    if (error) throw error;

    return Response.json({ url: signed.signedUrl }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "internal_server_error" }, { status: 500, headers: corsHeaders });
  }
});
