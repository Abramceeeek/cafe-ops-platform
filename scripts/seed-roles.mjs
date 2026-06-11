import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const statePath = new URL("../.design/demo-state.json", import.meta.url);
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const PASSWORD = process.env.DEMO_PASSWORD || kv.DEMO_PASSWORD;
if (!PASSWORD) { console.error("Set DEMO_PASSWORD in keys.txt or env (see .env.example)."); process.exit(1); }

async function ensure(key, email, full_name, role) {
  let id = state[key];
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw new Error(email + ": " + error.message);
    id = data.user.id;
    state[key] = id;
  }
  await db.auth.admin.updateUserById(id, { password: PASSWORD });
  await db.from("profiles").upsert({ id, full_name, role, shop_id: null, is_active: true });
  console.log(role.padEnd(16), email, "/", PASSWORD);
  return id;
}

await ensure("adminId", "admin.demo@boboandwild.dev", "Rana Aziz", "admin");
await ensure("courierId", "courier.demo@boboandwild.dev", "Dani Cole", "courier");
writeFileSync(statePath, JSON.stringify(state, null, 2));
