import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });

// Explicit named e2e accounts only (per the user's request).
if (!process.argv.includes("--confirm")) {
  console.error(`Refusing to run without --confirm — this DELETES the named e2e test users + their data on ${kv.SUPABASE_URL}.`);
  console.error("Re-run:  node scripts/delete-test-users.mjs --confirm");
  process.exit(1);
}
const E2E_EMAILS = [
  "e2e.admin@boboandwild.dev",
  "e2e.courier@boboandwild.dev",
  "e2e.meat@boboandwild.dev",
  "e2e.foh@boboandwild.dev",
];
const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
const targets = list.users.filter((u) => E2E_EMAILS.includes((u.email || "").toLowerCase()));
console.log("deleting", targets.length, "test users:", targets.map((u) => u.email).join(", "));

const ids = targets.map((u) => u.id);
// 1. their orders → null receipt_id, delete receipts, delete orders (items/mods cascade)
const { data: orders } = await db.from("orders").select("id").in("submitted_by", ids);
const orderIds = (orders ?? []).map((o) => o.id);
if (orderIds.length) {
  await db.from("orders").update({ receipt_id: null }).in("id", orderIds);
  await db.from("receipts").delete().in("order_id", orderIds);
  await db.from("orders").delete().in("id", orderIds);
  console.log("deleted", orderIds.length, "orders by test users");
}
// 2. clear assigned_courier / assigned_specialist references pointing at test users
await db.from("orders").update({ assigned_courier: null }).in("assigned_courier", ids);
await db.from("orders").update({ assigned_specialist: null }).in("assigned_specialist", ids);
// 3. order_templates by test users
await db.from("order_templates").delete().in("created_by", ids);
// 4. delete auth users (cascades profile via FK)
for (const u of targets) {
  const { error } = await db.auth.admin.deleteUser(u.id);
  console.log("  delete", u.email, "->", error ? "ERR " + error.message : "ok");
}
const { data: after } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
console.log("remaining users:", after.users.length);
