import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY);

const shopsConfig = [
  { dbName: "Clapham", prefix: "clapham" },
  { dbName: "Shoreditch", prefix: "shoreditch" },
  { dbName: "Chigwell", prefix: "chigwell" },
  { dbName: "South Woodford", prefix: "swoodford" },
  { dbName: "Stratford", prefix: "stratford" },
  { dbName: "St. Albans", prefix: "stalbans" },
  { dbName: "Wanstead", prefix: "wanstead" },
];

const hubUsers = [
  { email: "amin.pitmaster@boboandwild.com", role: "meat_specialist", name: "Chef Amin (Pitmaster)", shopId: null },
  { email: "arun.baker@boboandwild.com", role: "bread_baker", name: "Baker Arun", shopId: null },
  { email: "delivery@boboandwild.com", role: "courier", name: "Delivery Guy", shopId: null },
];

const DEFAULT_PASSWORD = "Welcome123!";

async function run() {
  console.log("Fetching shops from DB...");
  const { data: dbShops, error: shopErr } = await admin.from("shops").select("id, name");
  if (shopErr) throw shopErr;

  const usersToCreate = [...hubUsers];

  for (const conf of shopsConfig) {
    const shop = dbShops.find((s) => s.name === conf.dbName);
    if (!shop) {
      console.warn(`Shop ${conf.dbName} not found in DB! Make sure catalog_seed.sql is applied.`);
      continue;
    }

    usersToCreate.push({
      email: `${conf.prefix}.boh@boboandwild.com`,
      role: "kitchen_manager",
      name: `${conf.dbName} BOH`,
      shopId: shop.id,
    });
    usersToCreate.push({
      email: `${conf.prefix}.foh@boboandwild.com`,
      role: "foh_manager",
      name: `${conf.dbName} FOH`,
      shopId: shop.id,
    });
  }

  console.log(`Going to ensure ${usersToCreate.length} accounts exist...`);

  // We fetch existing users by traversing all pages or just rely on catching user_already_exists
  // Since we don't have thousands, we can just try to create and catch
  for (const user of usersToCreate) {
    console.log(`Processing ${user.email} ...`);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: user.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    let authUserId = null;

    if (createErr) {
      if (createErr.message.includes("already exists")) {
        console.log(`  -> User ${user.email} already exists in auth.users, looking up ID...`);
        // We have to lookup the user ID. We can list users and find them.
        const { data: listData } = await admin.auth.admin.listUsers();
        const existing = listData.users.find(u => u.email === user.email);
        if (existing) authUserId = existing.id;
      } else {
        console.error(`  -> Failed to create ${user.email}:`, createErr.message);
        continue;
      }
    } else {
      authUserId = created.user.id;
      console.log(`  -> Created in auth.users with ID ${authUserId}`);
    }

    if (!authUserId) {
      console.error(`  -> Could not resolve auth ID for ${user.email}`);
      continue;
    }

    // Upsert into profiles
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: authUserId,
      full_name: user.name,
      role: user.role,
      shop_id: user.shopId,
      is_active: true,
    });

    if (profileErr) {
      console.error(`  -> Failed to upsert profile for ${user.email}:`, profileErr.message);
    } else {
      console.log(`  -> Profile synced.`);
    }
  }

  console.log("Done seeding accounts.");
}

run().catch(console.error);
