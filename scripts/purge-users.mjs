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

const EMAILS = ["baker.demo@boboandwild.dev", "foh.demo@boboandwild.dev", "pastry@hubsync.test"];
const { rows: users } = await client.query(`SELECT id, email FROM auth.users WHERE lower(email) = ANY($1)`, [EMAILS]);
console.log("matched:", users.map((u) => u.email).join(", ") || "(none)");
const ids = users.map((u) => u.id);

async function run(label, sql, params) {
  try { const r = await client.query(sql, params); console.log(`  ${label}: ${r.rowCount}`); }
  catch (e) { console.log(`  ${label}: skip (${e.message.split("\n")[0]})`); }
}

if (ids.length) {
  await run("receipts (their orders)", `DELETE FROM receipts WHERE order_id IN (SELECT id FROM orders WHERE submitted_by = ANY($1))`, [ids]);
  await run("orders submitted", `DELETE FROM orders WHERE submitted_by = ANY($1)`, [ids]);
  await run("null assigned_courier", `UPDATE orders SET assigned_courier = NULL WHERE assigned_courier = ANY($1)`, [ids]);
  await run("null manifest signoff", `UPDATE manifest_stops SET signed_off_by = NULL WHERE signed_off_by = ANY($1)`, [ids]);
  await run("order_templates", `DELETE FROM order_templates WHERE created_by = ANY($1)`, [ids]);
  await run("delete auth.users", `DELETE FROM auth.users WHERE id = ANY($1)`, [ids]);
}

const { rows: remain } = await client.query(`SELECT count(*)::int n FROM auth.users`);
console.log("remaining auth users:", remain[0].n);
await client.end();
