import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });

const { data: profiles } = await db.from("profiles").select("id, full_name, role, shop_id");
console.log("PROFILES:");
for (const p of profiles ?? []) console.log(`  ${p.role.padEnd(16)} ${p.full_name?.padEnd(20)} shop=${p.shop_id ?? "-"}  id=${p.id}`);

const { data: shops } = await db.from("shops").select("id, name");
console.log("SHOPS:");
for (const s of shops ?? []) console.log(`  ${s.name}  id=${s.id}`);

const { data: cats } = await db.from("product_categories").select("id, name, assigned_role");
console.log("CATEGORIES:");
for (const c of cats ?? []) console.log(`  ${c.name?.padEnd(18)} role=${c.assigned_role}  id=${c.id}`);

const { data: users } = await db.auth.admin.listUsers();
console.log("AUTH USERS:");
for (const u of users?.users ?? []) console.log(`  ${u.email?.padEnd(34)} id=${u.id}`);
