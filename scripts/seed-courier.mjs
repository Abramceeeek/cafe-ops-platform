import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const statePath = new URL("../.design/demo-state.json", import.meta.url);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const EMAIL = "courier.demo@boboandwild.dev", PASSWORD = "DemoPass123!";

let id = state.courierId;
if (!id) {
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);
  id = data.user.id;
  state.courierId = id;
}
await db.auth.admin.updateUserById(id, { password: PASSWORD });
await db.from("profiles").upsert({ id, full_name: "Dani Cole", role: "courier", shop_id: null, is_active: true });

// Assign any ready_for_courier / in_transit orders to this courier so the manifest populates.
const { data: ready } = await db.from("orders").select("id").in("status", ["ready_for_courier", "in_transit"]);
if (ready?.length) await db.from("orders").update({ assigned_courier: id }).in("id", ready.map((o) => o.id));
writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log("COURIER LOGIN:", EMAIL, "/", PASSWORD, "| assigned", ready?.length ?? 0, "orders");
