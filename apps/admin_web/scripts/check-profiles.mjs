// Dev helper: list all profiles. Run: node scripts/check-profiles.mjs
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await admin
  .from("profiles")
  .select("full_name, role, shop_id")
  .order("role");

if (error) {
  console.error("error:", error.message);
  process.exit(1);
}
console.table(data);
console.log(`total profiles: ${data.length}`);
