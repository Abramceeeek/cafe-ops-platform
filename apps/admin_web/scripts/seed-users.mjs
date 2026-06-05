// Dev helper: create the test staff in Supabase Auth + set their profiles.
// Uses the service_role key (admin API, bypasses RLS). Run with:
//   node --env-file=.env.local scripts/seed-users.mjs
// .env.local must contain SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD || "Hubsync123!";

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (put them in .env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const users = [
  { email: "foh.shopa@hubsync.test",     full_name: "FOH Manager (Shop A)",     role: "foh_manager",     shop: "Shop A - Soho" },
  { email: "kitchen.shopa@hubsync.test", full_name: "Kitchen Manager (Shop A)", role: "kitchen_manager", shop: "Shop A - Soho" },
  { email: "meat@hubsync.test",          full_name: "Meat Specialist",          role: "meat_specialist", shop: null },
  { email: "bread@hubsync.test",         full_name: "Bread Baker",              role: "bread_baker",     shop: null },
  { email: "courier@hubsync.test",       full_name: "Courier",                  role: "courier",         shop: null },
];

const { data: shops, error: shopErr } = await admin.from("shops").select("id,name");
if (shopErr) { console.error("Failed to read shops:", shopErr.message); process.exit(1); }
const shopId = (name) => shops.find((s) => s.name === name)?.id ?? null;

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const byEmail = new Map((list?.users ?? []).map((u) => [u.email, u.id]));

for (const u of users) {
  let id = byEmail.get(u.email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
    });
    if (error) { console.error(`createUser ${u.email}: ${error.message}`); continue; }
    id = data.user.id;
    console.log(`created auth user  ${u.email}`);
  } else {
    console.log(`exists auth user   ${u.email}`);
  }

  const { error: pErr } = await admin
    .from("profiles")
    .upsert(
      { id, full_name: u.full_name, role: u.role, shop_id: u.shop ? shopId(u.shop) : null },
      { onConflict: "id" },
    );
  console.log(pErr ? `  profile FAIL: ${pErr.message}` : `  profile -> ${u.role}`);
}

console.log("Done.");
