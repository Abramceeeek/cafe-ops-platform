// One-shot loader: replace the sample catalog with the real bobo & wild catalog
// and rename the 7 shops to the real locations. Safe only pre-launch (no orders).
// Run: node load-real-catalog.mjs   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from "@supabase/supabase-js";

const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ALL = "00000000-0000-0000-0000-000000000000";

const SHOPS = [
  "Shoreditch", "Clapham", "St. Albans", "Chigwell",
  "Stratford", "South Woodford", "Wanstead",
];

const CATEGORIES = [
  {
    name: "Kitchen Bread",
    assigned_role: "bread_baker",
    unit: "item",
    products: ["Sourdough Bread", "Focaccia", "Burger Bun"],
  },
  {
    name: "Smoked / Meat / Prep",
    assigned_role: "meat_specialist",
    unit: "kg",
    products: ["Smoked Lamb", "Smoked Brisket", "Smoked Chicken", "Halal Bacon", "Halal Sausage", "Pickled Goods"],
  },
  {
    name: "Pastry / Retail Bakery",
    assigned_role: "pastry_chef",
    unit: "item",
    products: [
      "Plain C.Buns", "Raspberry White Choco", "Pist. C.Buns", "Apple C. Buns",
      "Alm. Croissant", "Pistachio Pain au Chocolate", "Dark Croissants", "Croissants",
      "Pain au Chocolate", "Pista / Choco Pain au Sussie", "The Bow (Dulche)", "Browine",
      "Pain au Raisin", "Apricot & Almond Danish", "Walnut / Chocolate Cookie", "Choco Cookies",
      "Honey Cake", "Toffee Cake", "Snicker Round", "Apple Tart", "Ret. Focaccia", "Ret. Sourd. Bread",
    ],
  },
];

const die = (label, error) => {
  if (error) { console.error(`${label}:`, error.message); process.exit(1); }
};

// 1. Clear existing catalog (no orders reference it).
for (const t of ["modifier_options", "modifier_groups", "products", "product_categories"]) {
  const { error } = await a.from(t).delete().gte("id", ALL);
  die(`clear ${t}`, error);
}
console.log("cleared old catalog");

// 2. Rename the 7 shops to the real locations.
const { data: shops, error: shopErr } = await a.from("shops").select("id").order("created_at");
die("read shops", shopErr);
for (let i = 0; i < Math.min(SHOPS.length, shops.length); i++) {
  const { error } = await a.from("shops").update({ name: SHOPS[i] }).eq("id", shops[i].id);
  die(`rename shop ${SHOPS[i]}`, error);
}
console.log(`renamed ${Math.min(SHOPS.length, shops.length)} shops`);

// 3. Insert categories + products.
let order = 0;
let productCount = 0;
for (const c of CATEGORIES) {
  order += 1;
  const { data: cat, error: cErr } = await a
    .from("product_categories")
    .insert({ name: c.name, assigned_role: c.assigned_role, display_order: order })
    .select("id")
    .single();
  die(`insert category ${c.name}`, cErr);

  const rows = c.products.map((name, idx) => ({
    category_id: cat.id,
    name,
    unit: c.unit,
    lead_time_hours: 24,
    display_order: idx,
  }));
  const { error: pErr } = await a.from("products").insert(rows);
  die(`insert products for ${c.name}`, pErr);
  productCount += rows.length;
  console.log(`  ${c.name}: ${rows.length} products`);
}

console.log(`Done. 3 categories, ${productCount} products, ${SHOPS.length} shops.`);
