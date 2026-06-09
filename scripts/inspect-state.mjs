import { readFileSync } from "node:fs";
import pg from "../apps/admin_web/node_modules/pg/lib/index.js";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const ref = kv.SUPABASE_URL.replace("https://", "").split(".")[0];
const password = kv.SUPABASE_DB_PASSWORD;
const candidates = [
  { host: `aws-1-eu-west-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  { host: `aws-0-eu-west-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
];

let client;
for (const c of candidates) {
  client = new pg.Client({ ...c, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try { await client.connect(); break; } catch { try { await client.end(); } catch {} client = null; }
}
if (!client) { console.error("no connection"); process.exit(1); }

const profiles = await client.query(
  `SELECT p.role, p.full_name, p.is_active, (p.shop_id IS NOT NULL) AS has_shop, u.email
   FROM profiles p LEFT JOIN auth.users u ON u.id = p.id ORDER BY p.role, u.email`);
console.log("=== PROFILES ===");
for (const r of profiles.rows) console.log(`${(r.role||"").padEnd(16)} ${(r.full_name||"").padEnd(22)} active=${r.is_active} shop=${r.has_shop?"Y":"-"} ${r.email||"?"}`);

const cats = await client.query(
  `SELECT c.name, c.assigned_role, COUNT(p.id) AS n
   FROM product_categories c LEFT JOIN products p ON p.category_id=c.id
   GROUP BY c.id, c.name, c.assigned_role, c.display_order ORDER BY c.display_order`);
console.log("\n=== CATEGORIES ===");
for (const r of cats.rows) console.log(`${r.name.padEnd(26)} -> ${r.assigned_role}  (${r.n} products)`);

const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position`);
console.log("\nproducts columns:", cols.rows.map(r=>r.column_name).join(", "));
await client.end();
