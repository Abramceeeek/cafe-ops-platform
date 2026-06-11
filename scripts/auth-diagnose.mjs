import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
console.log("URL:", kv.SUPABASE_URL);
console.log("anon key len:", kv.Superbase_anon_public?.length, "| service len:", kv.Superbase_service_role?.length);

const PASSWORD = process.env.DEMO_PASSWORD || kv.DEMO_PASSWORD;
if (!PASSWORD) { console.error("Set DEMO_PASSWORD in keys.txt or env (see .env.example)."); process.exit(1); }

// 1. Test a KNOWN demo login via the anon key (exactly what the web app does)
const anon = createClient(kv.SUPABASE_URL, kv.Superbase_anon_public, { auth: { persistSession: false } });
const { data: s, error: e } = await anon.auth.signInWithPassword({ email: "foh.demo@boboandwild.dev", password: PASSWORD });
console.log("\nKNOWN demo login (foh.demo):", e ? "FAIL → " + e.message + " [status " + (e.status ?? "?") + "]" : "OK, user " + s.user.id);

// 2. Aggregate auth-user confirmation status (no email dump)
const admin = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const { data: list, error: le } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (le) { console.log("listUsers error:", le.message); }
else {
  const u = list.users;
  const confirmed = u.filter((x) => x.email_confirmed_at || x.confirmed_at).length;
  console.log(`\nAuth users: ${u.length} total | ${confirmed} confirmed | ${u.length - confirmed} UNCONFIRMED`);
  // profiles linkage
  const { data: profs } = await admin.from("profiles").select("id, role");
  const profIds = new Set((profs ?? []).map((p) => p.id));
  const noProfile = u.filter((x) => !profIds.has(x.id)).length;
  console.log(`Profiles: ${profs?.length ?? 0} | auth users WITHOUT a profile row: ${noProfile}`);
}

// 3. Is a custom access-token hook function present? (its failure breaks token issuance)
const { error: he } = await admin.rpc("custom_access_token_hook", { event: {} });
console.log("\ncustom_access_token_hook present:", he ? (/(could not find|does not exist|schema cache)/i.test(he.message) ? "NO ("+he.message.slice(0,60)+")" : "YES/err: " + he.message.slice(0,80)) : "YES (callable)");
