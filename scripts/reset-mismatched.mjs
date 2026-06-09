import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const admin = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const anon = createClient(kv.SUPABASE_URL, kv.Superbase_anon_public, { auth: { persistSession: false } });
const PASS = "Bobo&wild2026";
const targets = ["foh.clapham@bobo.wild", "pitmaster@bobo.wild", "courier@bobo.wild"];

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const byEmail = new Map(list.users.map((u) => [u.email, u]));

for (const email of targets) {
  const u = byEmail.get(email);
  if (!u) { console.log(email, "→ NOT FOUND"); continue; }
  const { error } = await admin.auth.admin.updateUserById(u.id, { password: PASS, email_confirm: true });
  if (error) { console.log(email, "→ reset error:", error.message); continue; }
  const { error: se } = await anon.auth.signInWithPassword({ email, password: PASS });
  await anon.auth.signOut();
  console.log(email, "→ reset, login verify:", se ? "FAIL " + se.message : "OK ✓");
}
