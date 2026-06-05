// Live RLS + security checks against the deployed backend with the real @bobo.wild
// logins. The order lifecycle now runs through Next.js server actions (not Edge
// Functions), so it is exercised by the manual UAT (docs/UAT_SCRIPT.md). This harness
// proves the security gate that protects everything: role-scoped catalog visibility,
// cross-shop read isolation, direct-write denial, and the locked-down submit RPC.
//
// Run (PowerShell, env sourced from keys.txt):
//   $env:SUPABASE_URL=...; $env:SUPABASE_ANON_KEY=...; $env:SUPABASE_SERVICE_ROLE_KEY=...
//   $env:STAFF_PASSWORD='Bobo&wild2026'; node scripts/uat.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PW = process.env.STAFF_PASSWORD || "Bobo&wild2026";
if (!URL || !ANON || !SR) { console.error("Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const admin = createClient(URL, SR, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

async function client(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}
const cats = async (c) => {
  const { data } = await c.from("products").select("product_categories(name)");
  return [...new Set((data ?? []).map((p) => p.product_categories?.name))].sort();
};

// ── 1. Role-scoped catalog visibility ──
const boh = await client("boh.clapham@bobo.wild");
const foh = await client("foh.clapham@bobo.wild");
const pit = await client("pitmaster@bobo.wild");

const bohCats = await cats(boh);
check("BOH sees only Bread + Meat", JSON.stringify(bohCats) === JSON.stringify(["Kitchen Bread", "Smoked / Meat / Prep"]), bohCats.join(", "));
const fohCats = await cats(foh);
check("FOH sees only Pastry / Retail", JSON.stringify(fohCats) === JSON.stringify(["Pastry / Retail Bakery"]), fohCats.join(", "));
const pitCats = await cats(pit);
check("Pitmaster (specialist) sees all categories", pitCats.length === 3, pitCats.join(", "));

// ── 2. Cross-shop read isolation ──
const { data: clapShop } = await admin.from("shops").select("id").eq("name", "Clapham").single();
const { data: fohOrders } = await foh.from("orders").select("id, shop_id");
const leak = (fohOrders ?? []).filter((o) => o.shop_id !== clapShop.id);
check("FOH sees no other shop's orders", leak.length === 0, `leaked ${leak.length}`);

// ── 3. Direct write is denied (mutations must go through the server action) ──
const productId = (await admin.from("products").select("id").limit(1).single()).data.id;
const ins = await foh.from("orders").insert({ shop_id: clapShop.id, submitted_by: (await foh.auth.getUser()).data.user.id, status: "pending_request", requested_delivery_date: "2030-01-01" }).select("id");
check("Direct client INSERT into orders is blocked by RLS", !!ins.error || (ins.data?.length ?? 0) === 0, ins.error?.message ?? "row inserted!");

const anyOrder = (await admin.from("orders").select("id").limit(1).maybeSingle()).data;
if (anyOrder) {
  const upd = await foh.from("orders").update({ status: "delivered" }).eq("id", anyOrder.id).select("id");
  check("Direct client UPDATE of order status is blocked by RLS", (upd.data?.length ?? 0) === 0, upd.error?.message ?? "");
}

// ── 4. submit_request_atomic is not callable by end users ──
const rpc = await foh.rpc("submit_request_atomic", { p_shop_id: clapShop.id, p_submitted_by: (await foh.auth.getUser()).data.user.id, p_requested_delivery_date: "2030-01-01", p_groups: [[{ product_id: productId, quantity: 1, unit: "item", modifiers: [] }]] });
check("submit_request_atomic blocked for end users", !!rpc.error, rpc.error?.message ?? "callable!");

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
