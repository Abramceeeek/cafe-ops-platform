// End-to-end UAT against the LIVE backend with the real role logins.
// Drives a full Two-Way Handshake + lifecycle on real catalog data and checks
// the Edge Functions, role gates, and receipt generation.
// Run: node scripts/uat.mjs  (needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PW = "Hubsync123!";
const admin = createClient(URL, SR, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`); ok ? pass++ : fail++; };

async function client(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}
const invoke = (c, fn, body) => c.functions.invoke(fn, { body });

// ── setup: ids ──
const { data: prods } = await admin
  .from("products")
  .select("id, name, unit, lead_time_hours, category_id, product_categories(assigned_role)");
const bread = prods.find((p) => p.name === "Sourdough Bread");
const meat = prods.find((p) => p.name === "Smoked Lamb");
check("real catalog present (Sourdough + Smoked Lamb)", !!bread && !!meat);

const foh = await client("foh.shopa@hubsync.test");
const { data: { user: fohUser } } = await foh.auth.getUser();
const { data: fohProfile } = await foh.from("profiles").select("shop_id").eq("id", fohUser.id).single();

const date = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
const mkItem = (p) => ({
  product_id: p.id, category_id: p.category_id, quantity: 2,
  lead_time_hours: p.lead_time_hours, unit: p.unit,
  modifiers: [],
});

// ── 1. submit multi-category cart → 2 orders ──
const { data: sub, error: subErr } = await invoke(foh, "submit-request", {
  shop_id: fohProfile.shop_id, submitted_by: fohUser.id,
  requested_delivery_date: date, items: [mkItem(bread), mkItem(meat)],
});
check("submit-request ok", !subErr, subErr?.message);
const orderIds = sub?.order_ids ?? [];
check("multi-category cart split into 2 orders", orderIds.length === 2, `got ${orderIds.length}`);

// classify orders by category
const orders = {};
for (const id of orderIds) {
  const { data: o } = await admin.from("orders").select("id, order_items(products(product_categories(assigned_role)))").eq("id", id).single();
  const role = o.order_items[0]?.products?.product_categories?.assigned_role;
  orders[role] = id;
}
check("one order per specialist (bread_baker + meat_specialist)", !!orders.bread_baker && !!orders.meat_specialist);

// ── 2. specialists approve their own ──
const meatC = await client("meat@hubsync.test");
const breadC = await client("bread@hubsync.test");
const { error: aprMeat } = await invoke(meatC, "order-state-change", { order_id: orders.meat_specialist, new_status: "specialist_approved" });
check("meat specialist approves meat order", !aprMeat, aprMeat?.message);
// role gate: meat specialist must NOT be able to approve as a shop confirm
const { error: badGate } = await invoke(meatC, "order-state-change", { order_id: orders.meat_specialist, new_status: "shop_confirmed" });
check("role gate blocks specialist doing shop_confirmed", !!badGate);
const { error: aprBread } = await invoke(breadC, "order-state-change", { order_id: orders.bread_baker, new_status: "specialist_approved" });
check("bread baker approves bread order", !aprBread, aprBread?.message);

// ── 3. shop final-confirms both ──
for (const id of orderIds) {
  const { error } = await invoke(foh, "order-state-change", { order_id: id, new_status: "shop_confirmed" });
  check(`shop final-confirm ${id.slice(0, 8)}`, !error, error?.message);
}

// ── 4. production on the meat order ──
for (const s of ["in_progress", "packaged", "ready_for_courier"]) {
  const { error } = await invoke(meatC, "order-state-change", { order_id: orders.meat_specialist, new_status: s });
  check(`meat order → ${s}`, !error, error?.message);
}

// invalid transition guard
const { error: invalid } = await invoke(meatC, "order-state-change", { order_id: orders.meat_specialist, new_status: "delivered" });
check("invalid transition (ready → delivered by specialist) rejected", !!invalid);

// ── 5. courier pickup, shop receipt ──
const courierC = await client("courier@hubsync.test");
const { error: transit } = await invoke(courierC, "order-state-change", { order_id: orders.meat_specialist, new_status: "in_transit" });
check("courier → in_transit", !transit, transit?.message);
const { error: delivered } = await invoke(foh, "order-state-change", { order_id: orders.meat_specialist, new_status: "delivered" });
check("shop confirm receipt → delivered", !delivered, delivered?.message);

// ── 6. receipt generated (client-triggered after delivery) ──
const { error: rcptErr } = await invoke(foh, "generate-receipt", { order_id: orders.meat_specialist });
check("generate-receipt invoked", !rcptErr, rcptErr?.message);
await new Promise((r) => setTimeout(r, 1500));
const { data: receipt } = await admin.from("receipts").select("id, pdf_storage_path").eq("order_id", orders.meat_specialist).maybeSingle();
check("receipt PDF generated on delivery", !!receipt, receipt?.pdf_storage_path);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
