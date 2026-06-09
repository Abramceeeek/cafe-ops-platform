import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
console.log("Project (keys.txt):", kv.SUPABASE_URL, "\n");

const anon = createClient(kv.SUPABASE_URL, kv.Superbase_anon_public, { auth: { persistSession: false } });
const admin = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const byEmail = new Map(list.users.map((u) => [u.email, u]));

const PASS = "Bobo&wild2026";
const accounts = ["admin@bobo.wild", "foh.shoreditch@bobo.wild", "baker@bobo.wild", "courier@bobo.wild"];

for (const email of accounts) {
  const exists = byEmail.has(email);
  let login = "—";
  if (exists) {
    const { error } = await anon.auth.signInWithPassword({ email, password: PASS });
    login = error ? "FAIL: " + error.message : "OK ✓";
  }
  console.log(`${email.padEnd(28)} exists=${exists ? "YES" : "NO "}  login(${PASS})=${login}`);
}
console.log(`\nTotal @bobo.wild accounts present: ${[...byEmail.keys()].filter((e) => e?.endsWith("@bobo.wild")).length}`);
