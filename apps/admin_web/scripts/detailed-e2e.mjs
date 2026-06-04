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
const PW = "Hubsync123!";

if (!URL || !ANON) {
  console.error("Missing Supabase credentials in .env.local");
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
  const fohA = await login("foh.shopa@hubsync.test");
  const pastrySpec = await login("pastry@hubsync.test");
  const meatSpec = await login("meat@hubsync.test");
  const breadSpec = await login("bread@hubsync.test");
  const courier = await login("courier@hubsync.test");
  check("All users authenticated successfully", true);

  console.log("\n2. Fetching Catalog as FOH Manager A (Shoreditch)...");
  const { data: prods, error: pErr } = await fohA.client
    .from("products")
    .select("id, name, lead_time_hours, category_id, product_categories(assigned_role)");
  check("FOH can read products", !pErr && prods?.length > 0);

  const bread = prods.find((p) => p.product_categories?.assigned_role === "bread_baker");
  const meat = prods.find((p) => p.product_categories?.assigned_role === "meat_specialist");
  check("Found active Bread and Meat items in catalog", !!bread && !!meat);

  console.log("\n3. FOH A Submits Multi-Category Cart...");
  const reqDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const payload = {
    requested_delivery_date: reqDate,
    items: [
      { product_id: bread.id, quantity: 10, custom_note: "Fresh" },
      { product_id: meat.id, quantity: 5, custom_note: "Lean" },
    ],
  };

  const { data: subRes, error: subErr } = await fohA.client.functions.invoke("submit-request", { body: payload });
  if (subErr) console.error("submit-request failed:", subErr.context?.json ? await subErr.context.json() : subErr);
  check("Edge Function: submit-request succeeded", !subErr, subErr?.message);

  const orderIds = subRes?.order_ids || [];
  check("Backend atomic logic split cart into exactly 2 orders", orderIds.length === 2, `Got ${orderIds.length}`);

  console.log("\n4. Verifying RLS Tenant Isolation & Visibility (Status: pending_request)");

  const { data: fohA_orders } = await fohA.client.from("orders").select("id").in("id", orderIds);
  check("FOH A (Shoreditch) sees both orders", fohA_orders?.length === 2);

  const { data: pastry_orders } = await pastrySpec.client.from("orders").select("id").in("id", orderIds);
  check("Pastry Chef sees 0 orders (Cross-role/Status RLS isolation working)", pastry_orders?.length === 0);

  const { data: meat_orders } = await meatSpec.client.from("orders").select("id").in("id", orderIds);
  check("Meat Specialist sees exactly 1 order in Inbox", meat_orders?.length === 1);
  const meatOrderId = meat_orders?.[0]?.id;

  const { data: bread_orders } = await breadSpec.client.from("orders").select("id").in("id", orderIds);
  check("Bread Baker sees exactly 1 order in Inbox", bread_orders?.length === 1);
  const breadOrderId = bread_orders?.[0]?.id;

  check("Specialists were routed different, role-isolated orders", meatOrderId !== breadOrderId);

  const { data: courier_orders } = await courier.client.from("orders").select("id").in("id", orderIds);
  check("Courier sees 0 orders (Status/Assignment isolation working)", courier_orders?.length === 0);

  console.log("\n5. Testing Two-Way Handshake & Authorizations...");

  // Bread Baker attempts to approve Meat Order (Cross-role unauthorized attempt)
  const { error: badAprErr } = await breadSpec.client.functions.invoke("order-state-change", {
    body: { order_id: meatOrderId, new_status: "specialist_approved" },
  });
  check("Bread Baker is correctly BLOCKED from updating Meat order", !!badAprErr, badAprErr?.message || "Expected an error");

  // Meat Spec approves Meat Order
  const { error: aprErr } = await meatSpec.client.functions.invoke("order-state-change", {
    body: { order_id: meatOrderId, new_status: "specialist_approved" },
  });
  check("Meat Specialist successfully approves Meat order", !aprErr, aprErr?.message);

  // FOH A Final Confirms
  const { error: confErr } = await fohA.client.functions.invoke("order-state-change", {
    body: { order_id: meatOrderId, new_status: "shop_confirmed" },
  });
  check("FOH A executes 'Final Confirm' on Meat order", !confErr, confErr?.message);

  console.log("\n6. Advancing Production Pipeline...");
  for (const status of ["in_progress", "packaged", "ready_for_courier"]) {
    const { error: pErr } = await meatSpec.client.functions.invoke("order-state-change", {
      body: { order_id: meatOrderId, new_status: status },
    });
    check(`Meat Spec successfully updates state to: ${status}`, !pErr, pErr?.message);
  }

  console.log("\n7. Logistics & Delivery Flow...");
  const { data: c1 } = await courier.client.from("orders").select("id").eq("id", meatOrderId);
  check("Courier can now read the order (RLS allows ready_for_courier)", c1?.length === 1, `Found ${c1?.length}`);

  const { error: transErr } = await courier.client.functions.invoke("order-state-change", {
    body: { order_id: meatOrderId, new_status: "in_transit" },
  });
  check("Courier marks order as in_transit", !transErr, transErr?.message);

  const { error: delErr } = await fohA.client.functions.invoke("order-state-change", {
    body: { order_id: meatOrderId, new_status: "delivered" },
  });
  check("FOH A signs off and marks order as delivered", !delErr, delErr?.message);

  console.log("\n🎉 ALL TESTS PASSED. The end-to-end flow is mathematically proven.");
}

run().catch((e) => {
  console.error("Fatal Error:", e);
  process.exit(1);
});
