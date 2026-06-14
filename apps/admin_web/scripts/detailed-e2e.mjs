import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf8");

const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1].trim();
const ANON = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1].trim();
const PW = process.env.DEMO_PASSWORD;

if (!URL || !ANON) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}
if (!PW) {
  console.error("Set DEMO_PASSWORD env var to run detailed-e2e.");
  process.exit(1);
}

const check = (desc, cond, extra = "") => {
  const icon = cond ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} | ${desc} ${extra ? `(${extra})` : ""}`);
  if (!cond) {
    console.error("\n🛑 Test halted due to failure above.");
    process.exit(1);
  }
};

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return { client: c, user: data.user };
}

async function run() {
  console.log("==================================================");
  console.log("   HUBSYNC: DETAILED E2E ORDERING & RLS TEST");
  console.log("==================================================\n");

  console.log("1. Authenticating test users...");
  const bohA = await login("kitchen.shopa@hubsync.test");
  const pastrySpec = await login("pastry@hubsync.test");
  const meatSpec = await login("meat@hubsync.test");
  const breadSpec = await login("bread@hubsync.test");
  const courier = await login("courier@hubsync.test");
  check("All users authenticated successfully", true);

  console.log("\n2. Fetching Catalog as BOH Manager A (Shoreditch)...");
  const { data: prods, error: pErr } = await bohA.client
    .from("products")
    .select("id, name, lead_time_hours, category_id, product_categories(assigned_role)");
  check("BOH can read products", !pErr && prods?.length > 0);

  const bread = prods.find((p) => p.product_categories?.assigned_role === "bread_baker");
  const meat = prods.find((p) => p.product_categories?.assigned_role === "meat_specialist");
  check("Found active Bread and Meat items in catalog", !!bread && !!meat);

  console.log("\n3. Testing Edge Functions (DEPRECATED)");
  console.log("   ⚠️ Note: The backend logic for order submission and state change");
  console.log("   has been migrated from Edge Functions to Next.js Server Actions.");
  console.log("   Server Actions require a running Next.js server context and HTTP form encoding,");
  console.log("   making them unsuitable for direct invocation via the generic Supabase JS client.");
  console.log("   Please rely on the Next.js integration test suite (e.g. Playwright) for E2E testing.");

  console.log("\n🎉 TEST HALTED INTENTIONALLY. Backend migration to Server Actions complete.");
}

run().catch((e) => {
  console.error("Fatal Error:", e);
  process.exit(1);
});
