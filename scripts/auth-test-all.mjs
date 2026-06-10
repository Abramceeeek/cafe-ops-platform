import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const anon = createClient(kv.SUPABASE_URL, kv.Superbase_anon_public, { auth: { persistSession: false } });
const PASS = kv.STAFF_PASSWORD;
if (!PASS) { console.error("Add STAFF_PASSWORD=<password> to keys.txt"); process.exit(1); }
const accounts = [
  "foh.clapham@bobo.wild", "boh.clapham@bobo.wild",
  "foh.shoreditch@bobo.wild", "boh.shoreditch@bobo.wild",
  "foh.chigwell@bobo.wild", "boh.chigwell@bobo.wild",
  "foh.swoodford@bobo.wild", "boh.swoodford@bobo.wild",
  "foh.stratford@bobo.wild", "boh.stratford@bobo.wild",
  "foh.stalbans@bobo.wild", "boh.stalbans@bobo.wild",
  "foh.wanstead@bobo.wild", "boh.wanstead@bobo.wild",
  "pitmaster@bobo.wild", "baker@bobo.wild", "courier@bobo.wild", "admin@bobo.wild",
];
let ok = 0, fail = 0;
for (const email of accounts) {
  const { error } = await anon.auth.signInWithPassword({ email, password: PASS });
  if (error) { fail++; console.log("FAIL ".padEnd(6) + email + "  (" + error.message + ")"); }
  else { ok++; console.log("OK ✓ ".padEnd(6) + email); }
  await anon.auth.signOut();
}
console.log(`\n${ok} OK / ${fail} FAIL against ${kv.SUPABASE_URL}`);
