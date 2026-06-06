import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const statePath = new URL("../.design/demo-state.json", import.meta.url);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};

const EMAIL = "baker.demo@boboandwild.dev";
const PASSWORD = "DemoPass123!";

let userId = state.specialistId;
if (!userId) {
  const { data: created, error } = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw new Error("createUser: " + error.message);
  userId = created.user.id;
  state.specialistId = userId;
}
await db.auth.admin.updateUserById(userId, { password: PASSWORD });
// Hub role: shop_id must be NULL (profiles check_shop_role)
await db.from("profiles").upsert({ id: userId, full_name: "Priya Anand", role: "bread_baker", shop_id: null, is_active: true });

writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log("SPECIALIST LOGIN:", EMAIL, "/", PASSWORD, "(bread_baker)");
