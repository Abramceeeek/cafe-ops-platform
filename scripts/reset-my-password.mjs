import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const admin = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });

const EMAIL = "abdurakhmonbekfayzullaev@gmail.com";
const NEWPASS = "HubSync!2026";

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = list.users.find((x) => x.email === EMAIL);
if (!u) { console.log("account not found:", EMAIL); process.exit(1); }
const { error } = await admin.auth.admin.updateUserById(u.id, { password: NEWPASS, email_confirm: true });
if (error) { console.log("reset error:", error.message); process.exit(1); }

// verify it works via the anon path (exactly what the app does)
const anon = createClient(kv.SUPABASE_URL, kv.Superbase_anon_public, { auth: { persistSession: false } });
const { error: se } = await anon.auth.signInWithPassword({ email: EMAIL, password: NEWPASS });
console.log("password reset for", EMAIL, "->", NEWPASS);
console.log("verify login via anon key:", se ? "FAIL " + se.message : "OK ✓");
