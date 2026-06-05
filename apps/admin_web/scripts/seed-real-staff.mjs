// Create the REAL staff in Supabase Auth + set their profiles (Roadmap go-live,
// LAUNCH_CHECKLIST §2). Idempotent: existing users are matched by email and only
// their profile is upserted. Uses the service_role key (admin API, bypasses RLS).
//
// Roster is owner-supplied and git-ignored (PII + initial passwords):
//   apps/admin_web/scripts/staff-roster.json   (see staff-roster.example.json)
//
// Run (PowerShell, sourcing rotated keys from keys.txt):
//   node scripts/seed-real-staff.mjs
// Needs env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   --dry-run  prints what would happen, makes no changes.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const ROLES = new Set([
  "foh_manager", "kitchen_manager", "meat_specialist",
  "bread_baker", "courier", "admin",
]);
const SHOP_ROLES = new Set(["foh_manager", "kitchen_manager"]);

const here = dirname(fileURLToPath(import.meta.url));
const rosterPath = process.argv.find((a) => a.endsWith(".json")) ?? join(here, "staff-roster.json");

let roster;
try {
  roster = JSON.parse(readFileSync(rosterPath, "utf8"));
} catch (e) {
  console.error(`Cannot read roster at ${rosterPath}: ${e.message}`);
  console.error("Copy staff-roster.example.json → staff-roster.json and fill it in.");
  process.exit(1);
}

// ── validate roster before touching anything ──
const errors = [];
roster.forEach((u, i) => {
  if (!u.email) errors.push(`[${i}] missing email`);
  if (!ROLES.has(u.role)) errors.push(`[${i}] ${u.email}: invalid role "${u.role}"`);
  const isShopRole = SHOP_ROLES.has(u.role);
  if (isShopRole && !u.shop) errors.push(`[${i}] ${u.email}: shop role needs "shop"`);
  if (!isShopRole && u.shop) errors.push(`[${i}] ${u.email}: non-shop role must not set "shop"`);
});
if (errors.length) {
  console.error("Roster validation failed:\n  " + errors.join("\n  "));
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: shops, error: shopErr } = await admin.from("shops").select("id,name");
if (shopErr) { console.error("Failed to read shops:", shopErr.message); process.exit(1); }
const shopId = (name) => {
  const id = shops.find((s) => s.name === name)?.id;
  if (!id) { console.error(`No shop named "${name}" — load real locations first.`); process.exit(1); }
  return id;
};
// fail fast on bad shop names before any writes
roster.filter((u) => u.shop).forEach((u) => shopId(u.shop));

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const byEmail = new Map((list?.users ?? []).map((u) => [u.email, u.id]));

const genPassword = () => randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12) + "A1!";
const credentials = [];

for (const u of roster) {
  let id = byEmail.get(u.email);
  let issuedPassword = null;

  if (!id) {
    const password = u.password || genPassword();
    issuedPassword = u.password ? "(from roster)" : password;
    if (dryRun) {
      console.log(`[dry-run] would create ${u.email}`);
      id = "dry-run";
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email, password, email_confirm: true,
      });
      if (error) { console.error(`createUser ${u.email}: ${error.message}`); continue; }
      id = data.user.id;
      console.log(`created  ${u.email}`);
    }
  } else {
    console.log(`exists   ${u.email}`);
  }

  if (!dryRun) {
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id,
        full_name: u.full_name ?? u.email,
        role: u.role,
        shop_id: u.shop ? shopId(u.shop) : null,
        is_active: u.is_active ?? true,
      },
      { onConflict: "id" },
    );
    console.log(pErr ? `  profile FAIL: ${pErr.message}` : `  profile -> ${u.role}${u.shop ? " @ " + u.shop : ""}`);
  }
  if (issuedPassword) credentials.push({ email: u.email, role: u.role, password: issuedPassword });
}

if (credentials.length) {
  console.log("\nINITIAL CREDENTIALS (distribute securely, then have staff change them):");
  console.table(credentials);
}
console.log(dryRun ? "\nDry run — no changes made." : "\nDone.");
