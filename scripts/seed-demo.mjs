import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const statePath = new URL("../.design/demo-state.json", import.meta.url);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};

const EMAIL = "foh.demo@boboandwild.dev";
const PASSWORD = "DemoPass123!";

// 1. shop
let shopId = state.shopId;
if (!shopId) {
  const { data: shop } = await db.from("shops").select("id, name").limit(1).maybeSingle();
  if (shop) { shopId = shop.id; state.shopName = shop.name; }
  else {
    const { data: ns } = await db.from("shops").insert({ name: "Shop C — Camden" }).select("id, name").single();
    shopId = ns.id; state.shopName = ns.name; state.createdShop = true;
  }
  state.shopId = shopId;
}

// 2. demo FOH user (reuse via saved id)
let userId = state.userId;
if (!userId) {
  const { data: created, error } = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw new Error("createUser: " + error.message);
  userId = created.user.id;
  state.userId = userId;
}
await db.auth.admin.updateUserById(userId, { password: PASSWORD });
await db.from("profiles").upsert({ id: userId, full_name: "Amara Okafor", role: "foh_manager", shop_id: shopId, is_active: true });

// 3. clean previous demo orders + templates so re-runs stay tidy
await db.from("orders").delete().eq("submitted_by", userId);
await db.from("order_templates").delete().eq("created_by", userId);

// 4. FOH-readable products (Pastry / Retail Bakery)
const { data: cat } = await db.from("product_categories").select("id").eq("name", "Pastry / Retail Bakery").single();
const { data: products } = await db
  .from("products")
  .select("id, unit, category_id, name")
  .eq("category_id", cat.id)
  .eq("is_available", true)
  .limit(8);
if (!products?.length) throw new Error("no FOH products to seed");

async function makeOrder(status, daysOut, items, approved) {
  const date = new Date(); date.setDate(date.getDate() + daysOut);
  const patch = { shop_id: shopId, submitted_by: userId, status, requested_delivery_date: date.toISOString().slice(0, 10) };
  if (approved) patch.specialist_approved_at = new Date().toISOString();
  const { data: order, error } = await db.from("orders").insert(patch).select("id").single();
  if (error) throw new Error("order insert: " + error.message);
  const rows = items.map((it, i) => ({
    order_id: order.id, product_id: products[i % products.length].id,
    quantity: it.qty, unit: products[i % products.length].unit ?? "unit", unit_cost: it.cost ?? null,
  }));
  await db.from("order_items").insert(rows);
  return order.id;
}

const ids = [];
ids.push(await makeOrder("specialist_approved", 2, [{ qty: 3, cost: 28.5 }, { qty: 6, cost: 54 }, { qty: 24, cost: 60 }, { qty: 2, cost: 24 }], true));
ids.push(await makeOrder("in_transit", 1, [{ qty: 6 }, { qty: 4 }, { qty: 24 }]));
ids.push(await makeOrder("packaged", 2, [{ qty: 12 }, { qty: 8 }]));
ids.push(await makeOrder("delivered", -1, [{ qty: 6 }, { qty: 6 }]));
state.orderIds = ids;

// 5. a template (FOH products)
const { data: tpl } = await db.from("order_templates")
  .insert({ shop_id: shopId, created_by: userId, name: "Standard Tuesday Restock", role: "foh_manager" })
  .select("id").single();
await db.from("order_template_items").insert(products.slice(0, 3).map((p, i) => ({ template_id: tpl.id, product_id: p.id, quantity: [3, 6, 24][i] })));
state.templateId = tpl.id;

writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log("DEMO LOGIN:", EMAIL, "/", PASSWORD, "| shop:", state.shopName);
console.log("orders:", ids.length, "| template items: 3 | products from Pastry / Retail Bakery");
