import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";
import assert from "node:assert";

// Load environment variables from keys.txt
const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const supabaseUrl = kv.SUPABASE_URL;
const supabaseAnonKey = kv.Supabase_Publishable_Key || kv.Superbase_anon_public;
const supabaseServiceKey = kv.Superbase_service_role;

const adminDb = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

// Common test password
const PASSWORD = process.env.DEMO_PASSWORD || kv.DEMO_PASSWORD;
if (!PASSWORD) { console.error("Set DEMO_PASSWORD in keys.txt or env (see .env.example)."); process.exit(1); }

async function ensureUser(email, fullName, role, shopId = null) {
  // Try to find user by email
  const { data: { users } } = await adminDb.auth.admin.listUsers();
  const existingUser = users.find(u => u.email === email);
  
  let userId;
  if (!existingUser) {
    const { data: authUser, error: authErr } = await adminDb.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (authErr) throw new Error(`Failed to create ${role}: ${authErr.message}`);
    userId = authUser.user.id;
    await adminDb.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      role: role,
      shop_id: shopId,
      is_active: true,
    });
  } else {
    userId = existingUser.id;
    await adminDb.auth.admin.updateUserById(userId, { password: PASSWORD });
    await adminDb.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      role: role,
      shop_id: shopId,
      is_active: true,
    });
  }
  return userId;
}

async function loginAs(email) {
  const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return client;
}

async function run() {
  console.log("=== Starting Realistic E2E Order Lifecycle Test ===");

  // 1. Setup Test Data (Shop, Category, Product)
  console.log("[1] Setting up test data...");
  let { data: shop } = await adminDb.from("shops").select("id").limit(1).maybeSingle();
  if (!shop) {
    const res = await adminDb.from("shops").insert({ name: "E2E Test Shop" }).select("id").single();
    shop = res.data;
  }
  
  let { data: cat } = await adminDb.from("product_categories").select("id").eq("assigned_role", "meat_specialist").limit(1).maybeSingle();
  if (!cat) {
    const res = await adminDb.from("product_categories").insert({ name: "E2E Meat", assigned_role: "meat_specialist" }).select("id").single();
    cat = res.data;
  }

  let { data: product } = await adminDb.from("products").select("id, unit").eq("category_id", cat.id).limit(1).maybeSingle();
  if (!product) {
    const res = await adminDb.from("products").insert({ category_id: cat.id, name: "E2E Steak", unit: "kg" }).select("id, unit").single();
    product = res.data;
  }

  // 2. Setup Test Users
  console.log("[2] Setting up test users...");
  const fohEmail = "e2e.foh@boboandwild.dev";
  const meatEmail = "e2e.meat@boboandwild.dev";
  const courierEmail = "e2e.courier@boboandwild.dev";
  const adminEmail = "e2e.admin@boboandwild.dev";

  const fohId = await ensureUser(fohEmail, "E2E FOH", "foh_manager", shop.id);
  const meatId = await ensureUser(meatEmail, "E2E Meat Spec", "meat_specialist", null);
  const courierId = await ensureUser(courierEmail, "E2E Courier", "courier", null);
  const adminId = await ensureUser(adminEmail, "E2E Admin", "admin", null);

  const fohClient = await loginAs(fohEmail);
  const meatClient = await loginAs(meatEmail);
  const courierClient = await loginAs(courierEmail);
  const adminClient = await loginAs(adminEmail);

  let orderId;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);
  const dateStr = targetDate.toISOString().slice(0, 10);

  try {
    // 3. FOH Manager: Create Order
    console.log("[3] FOH Manager: Creating new order request...");
    // Simulate the Next.js server action creating the order securely
    const { data: order, error: orderErr } = await adminDb
      .from("orders")
      .insert({
        shop_id: shop.id,
        submitted_by: fohId,
        requested_delivery_date: dateStr,
        status: "pending_request",
      })
      .select("id")
      .single();
    if (orderErr) throw new Error("FOH Failed to create order: " + orderErr.message);
    orderId = order.id;

    await adminDb.from("order_items").insert({
      order_id: orderId,
      product_id: product.id,
      quantity: 5,
      unit: product.unit,
    });
    console.log("    -> Order created successfully: " + orderId);

    // 4. Negative Test: FOH attempts to approve their own order
    console.log("[4] Negative Test: FOH attempting to approve (should fail)...");
    const { data: fohFailRes, error: fohFailErr } = await fohClient.functions.invoke("order-state-change", {
      body: { id: orderId, status: "specialist_approved" }
    });
    if (!fohFailErr && !fohFailRes?.error) {
      throw new Error("FOH was incorrectly allowed to approve their own order!");
    }
    console.log("    -> CORRECT: FOH was blocked from approving.");

    // 5. Meat Specialist: Approve Order
    console.log("[5] Meat Specialist: Approving order...");
    const { data: meatRes, error: meatErr } = await meatClient.functions.invoke("order-state-change", {
      body: { id: orderId, status: "specialist_approved" }
    });
    if (meatErr || meatRes?.error) {
      console.error(meatErr?.context);
      throw new Error("Meat Specialist failed to approve: " + (meatErr?.message || meatRes?.error));
    }
    console.log("    -> Order successfully transitioned to 'specialist_approved'.");

    // 6. FOH Manager: Final Confirm
    console.log("[6] FOH Manager: Final Confirmation...");
    const { data: { session } } = await fohClient.auth.getSession();
    const req = await fetch(`${supabaseUrl}/functions/v1/order-state-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ id: orderId, status: "shop_confirmed" })
    });
    const resBody = await req.json();
    if (!req.ok) {
      throw new Error(`FOH failed to confirm: HTTP ${req.status} - ${JSON.stringify(resBody)}`);
    }

    // 7. Meat Specialist: Process Order through Production
    console.log("[7] Meat Specialist: Processing through production...");
    let mRes, mErr;
    
    ({ data: mRes, error: mErr } = await meatClient.functions.invoke("order-state-change", { body: { id: orderId, status: "in_progress" } }));
    if (mErr || mRes?.error) throw new Error("in_progress failed: " + (mErr?.message || mRes?.error || JSON.stringify(mErr)));
    
    ({ data: mRes, error: mErr } = await meatClient.functions.invoke("order-state-change", { body: { id: orderId, status: "packaged" } }));
    if (mErr || mRes?.error) throw new Error("packaged failed: " + (mErr?.message || mRes?.error || JSON.stringify(mErr)));
    
    ({ data: mRes, error: mErr } = await meatClient.functions.invoke("order-state-change", { body: { id: orderId, status: "ready_for_courier" } }));
    if (mErr || mRes?.error) throw new Error("ready_for_courier failed: " + (mErr?.message || mRes?.error || JSON.stringify(mErr)));
    
    console.log("    -> Order moved to 'ready_for_courier'.");

    // Simulate Admin assigning Courier
    console.log("[7.5] Admin: Assigning courier to order...");
    await adminDb.from("orders").update({ assigned_courier: courierId }).eq("id", orderId);

    // 8. Courier: Transit and Deliver
    console.log("[8] Courier: Delivering order...");
    const { data: courTransit, error: courTransitErr } = await courierClient.functions.invoke("order-state-change", {
      body: { id: orderId, status: "in_transit" }
    });
    if (courTransitErr || courTransit?.error) {
      console.error(courTransitErr?.context);
      throw new Error("Courier transit failed: " + (courTransitErr?.message || courTransit?.error));
    }

    const { data: courDeliv, error: courDelivErr } = await courierClient.functions.invoke("order-state-change", {
      body: { id: orderId, status: "delivered" }
    });
    if (courDelivErr || courDeliv?.error) {
      console.error(courDelivErr?.context);
      throw new Error("Courier delivery failed: " + (courDelivErr?.message || courDeliv?.error));
    }
    console.log("    -> Order successfully delivered.");

    // 9. Admin Verification
    console.log("[9] Admin: Verifying Final State...");
    const { data: finalOrder } = await adminDb.from("orders").select("status, delivered_at").eq("id", orderId).single();
    assert.strictEqual(finalOrder.status, "delivered", "Status should be 'delivered'");
    assert.ok(finalOrder.delivered_at, "delivered_at timestamp should be set");
    console.log("    -> ALL TESTS PASSED! E2E Lifecycle is secure and functional.");

  } catch (err) {
    console.error("\n❌ E2E TEST FAILED:");
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    // 10. Cleanup
    if (orderId) {
      console.log("\n[10] Cleaning up test order...");
      await adminDb.from("order_items").delete().eq("order_id", orderId);
      await adminDb.from("orders").delete().eq("id", orderId);
    }
  }
}

run();
