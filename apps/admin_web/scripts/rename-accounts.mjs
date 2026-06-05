// Provision the canonical bobo & wild logins on @bobo.wild (Roadmap go-live).
// Idempotent + safe: renames existing accounts in place (preserves their UUID and all
// FK links to orders/history), creates any missing ones, ensures profiles, and
// deactivates leftover test accounts. Re-runnable.
//
// Canonical set (18): foh.<slug>@bobo.wild + boh.<slug>@bobo.wild for 7 sites,
//   pitmaster@ / baker@ / courier@ / admin@bobo.wild.
//
// Password comes ONLY from the environment — never hard-coded (public repo):
//   PowerShell:  $env:STAFF_PASSWORD='Bobo&wild2026'; node scripts/rename-accounts.mjs --dry-run
// Needs env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAFF_PASSWORD
//   --dry-run  prints the plan, makes no changes.
//
// NOTE: the shared password is a launch convenience — rotate / have staff change it after go-live.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PW = process.env.STAFF_PASSWORD;
const dryRun = process.argv.includes("--dry-run");

if (!URL || !SR) { console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
if (!PW) { console.error("Missing STAFF_PASSWORD (pass the shared launch password via env)."); process.exit(1); }

// site slug -> shop name in the DB
const SITES = [
  ["clapham", "Clapham"], ["shoreditch", "Shoreditch"], ["chigwell", "Chigwell"],
  ["swoodford", "South Woodford"], ["stratford", "Stratford"], ["stalbans", "St. Albans"],
  ["wanstead", "Wanstead"],
];

// Canonical accounts: { email, role, shop (name|null), name }
const canonical = [];
for (const [slug, shop] of SITES) {
  canonical.push({ email: `foh.${slug}@bobo.wild`, role: "foh_manager", shop, name: `${shop} FOH` });
  canonical.push({ email: `boh.${slug}@bobo.wild`, role: "kitchen_manager", shop, name: `${shop} BOH (Kitchen)` });
}
canonical.push({ email: "pitmaster@bobo.wild", role: "meat_specialist", shop: null, name: "Chef Amin (Pitmaster)" });
canonical.push({ email: "baker@bobo.wild", role: "bread_baker", shop: null, name: "Baker Arun" });
canonical.push({ email: "courier@bobo.wild", role: "courier", shop: null, name: "Courier" });
canonical.push({ email: "admin@bobo.wild", role: "admin", shop: null, name: "Admin" });

// Old email -> canonical email (rename in place to preserve UUID + order history FKs)
const RENAME = {
  "meat@hubsync.test": "pitmaster@bobo.wild",
  "bread@hubsync.test": "baker@bobo.wild",
  "courier@hubsync.test": "courier@bobo.wild",
  "foh.shopa@hubsync.test": "foh.shoreditch@bobo.wild",
  "kitchen.shopa@hubsync.test": "boh.shoreditch@bobo.wild",
};
// Leftover test accounts to deactivate (NOT delete — owner clears data)
const DEACTIVATE = ["pastry@hubsync.test", "jane@example.com"];

const a = createClient(URL, SR, { auth: { persistSession: false } });

const { data: shops, error: shopErr } = await a.from("shops").select("id,name");
if (shopErr) { console.error("read shops:", shopErr.message); process.exit(1); }
const shopId = (name) => {
  const id = shops.find((s) => s.name === name)?.id;
  if (!id) { console.error(`No shop named "${name}".`); process.exit(1); }
  return id;
};
canonical.filter((c) => c.shop).forEach((c) => shopId(c.shop)); // fail fast

const { data: list } = await a.auth.admin.listUsers({ perPage: 1000 });
const byEmail = new Map((list?.users ?? []).map((u) => [u.email, u.id]));

const log = (...m) => console.log(...m);
const tag = dryRun ? "[dry-run] " : "";

// 1. Rename mappable old accounts -> canonical email (+ password)
for (const [oldEmail, newEmail] of Object.entries(RENAME)) {
  const id = byEmail.get(oldEmail);
  if (!id) { log(`${tag}rename skip (no ${oldEmail})`); continue; }
  if (byEmail.has(newEmail)) { log(`${tag}rename skip (${newEmail} already exists)`); continue; }
  if (!dryRun) {
    const { error } = await a.auth.admin.updateUserById(id, { email: newEmail, password: PW, email_confirm: true });
    if (error) { console.error(`rename ${oldEmail}->${newEmail}: ${error.message}`); continue; }
  }
  byEmail.delete(oldEmail); byEmail.set(newEmail, id);
  log(`${tag}renamed  ${oldEmail}  ->  ${newEmail}`);
}

// 2. Ensure every canonical account exists (create missing), set password, upsert profile
for (const c of canonical) {
  let id = byEmail.get(c.email);
  if (!id) {
    if (dryRun) { log(`${tag}create   ${c.email}  (${c.role})`); id = "dry-run"; }
    else {
      const { data, error } = await a.auth.admin.createUser({ email: c.email, password: PW, email_confirm: true });
      if (error) { console.error(`create ${c.email}: ${error.message}`); continue; }
      id = data.user.id; byEmail.set(c.email, id);
      log(`created  ${c.email}`);
    }
  } else {
    if (!dryRun) await a.auth.admin.updateUserById(id, { password: PW });
    log(`${tag}ensure   ${c.email}  (password set)`);
  }
  if (!dryRun) {
    const { error } = await a.from("profiles").upsert(
      { id, full_name: c.name, role: c.role, shop_id: c.shop ? shopId(c.shop) : null, is_active: true },
      { onConflict: "id" },
    );
    if (error) console.error(`  profile ${c.email}: ${error.message}`);
    else log(`  profile -> ${c.role}${c.shop ? " @ " + c.shop : ""}`);
  }
}

// 3. Deactivate leftover test accounts (keep data; just block login-relevant access)
for (const email of DEACTIVATE) {
  const id = byEmail.get(email);
  if (!id) { log(`${tag}deactivate skip (no ${email})`); continue; }
  if (!dryRun) await a.from("profiles").update({ is_active: false }).eq("id", id);
  log(`${tag}deactivated ${email}`);
}

log(dryRun ? "\nDry run — no changes made." : "\nDone. Shared password set via STAFF_PASSWORD — rotate after launch.");
