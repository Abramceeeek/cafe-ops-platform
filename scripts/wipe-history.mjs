// Wipe ALL order history for a clean test slate. DESTRUCTIVE.
// Keeps: products, prices, product_categories, profiles/users, shops, cutoff_config.
// Deletes: orders, order_items, order_item_modifiers, receipts, delivery_manifests,
// manifest_stops, order_templates, and the receipts storage bucket PDFs.
// FK-safe order: null orders.receipt_id -> manifest_stops -> delivery_manifests ->
// receipts -> order_item_modifiers -> order_items -> orders -> order_templates.
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
];
let client;
for (const c of candidates) {
  client = new pg.Client({ ...c, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try { await client.connect(); break; } catch { try { await client.end(); } catch {} client = null; }
}
if (!client) { console.error("no connection"); process.exit(1); }

const steps = [
  ["null orders.receipt_id", "UPDATE orders SET receipt_id = NULL"],
  ["manifest_stops", "DELETE FROM manifest_stops"],
  ["delivery_manifests", "DELETE FROM delivery_manifests"],
  ["receipts", "DELETE FROM receipts"],
  ["order_item_modifiers", "DELETE FROM order_item_modifiers"],
  ["order_items", "DELETE FROM order_items"],
  ["orders", "DELETE FROM orders"],
  ["order_templates", "DELETE FROM order_templates"],
  // Drop receipt PDF metadata so old receipts are no longer listable/served
  // (the underlying private-bucket blobs orphan harmlessly).
  ["receipts storage objects", "DELETE FROM storage.objects WHERE bucket_id = 'receipts'"],
];
for (const [label, sql] of steps) {
  try { const r = await client.query(sql); console.log(`  ${label}: ${r.rowCount}`); }
  catch (e) { console.log(`  ${label}: ERR ${e.message.split("\n")[0]}`); }
}
await client.end();
console.log("DB history wiped. (Run prune-receipt-pdfs via service role to clear storage.)");
