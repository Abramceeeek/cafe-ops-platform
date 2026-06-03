// order-state-change Edge Function — ROADMAP 2.3/2.4, PROJECT_SPEC §7.4.
// The ONLY path allowed to mutate orders.status. Validates the transition and
// the caller's role, stamps the timestamp. (FCM + dual-routing on shop_confirmed
// are layered in later stages.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canTransition, roleAllowed, STATUS_TIMESTAMP } from "./lib.ts";

interface Payload {
  order_id: string;
  new_status: string;
}

Deno.serve(async (req) => {
  try {
    const { order_id, new_status } = (await req.json()) as Payload;
    const url = Deno.env.get("SUPABASE_URL")!;

    // Caller identity/role from their JWT (RLS lets a user read own profile).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role as string | undefined;
    if (!role) return Response.json({ error: "no_profile" }, { status: 403 });

    // Read current status with service role (authoritative).
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("status")
      .eq("id", order_id)
      .single();
    if (oErr || !order) return Response.json({ error: "order_not_found" }, { status: 404 });

    const from = order.status as string;
    if (!canTransition(from, new_status)) {
      return Response.json(
        { error: "invalid_transition", from, to: new_status },
        { status: 400 },
      );
    }
    if (!roleAllowed(new_status, role)) {
      return Response.json(
        { error: "role_not_permitted", role, to: new_status },
        { status: 403 },
      );
    }

    const patch: Record<string, unknown> = { status: new_status };
    const tsCol = STATUS_TIMESTAMP[new_status];
    if (tsCol) patch[tsCol] = new Date().toISOString();

    const { error: uErr } = await admin.from("orders").update(patch).eq("id", order_id);
    if (uErr) throw uErr;

    // On delivery, generate the receipt (non-blocking; failure must not fail sign-off).
    if (new_status === "delivered") {
      try {
        await admin.functions.invoke("generate-receipt", { body: { order_id } });
      } catch (_) {
        /* receipt generation is best-effort */
      }
    }

    return Response.json({ ok: true, from, to: new_status });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
