import { readFileSync } from "node:fs";
import pg from "../apps/admin_web/node_modules/pg/lib/index.js";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const ref = kv.SUPABASE_URL.replace("https://", "").split(".")[0];
const candidates = [
  { host: `aws-1-eu-west-2.pooler.supabase.com`, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, user: "postgres" },
];
let client;
for (const c of candidates) {
  const cl = new pg.Client({ ...c, port: 5432, password: kv.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try { await cl.connect(); client = cl; console.log("connected via", c.host, "\n"); break; }
  catch (e) { console.log("fail", c.host, e.message); try { await cl.end(); } catch {} }
}
if (!client) process.exit(1);

const q = async (label, sql) => {
  const r = await client.query(sql);
  console.log(label + ":", JSON.stringify(r.rows));
};

await q("orders.in_progress_at exists",
  `SELECT count(*) FROM information_schema.columns WHERE table_name='orders' AND column_name='in_progress_at'`);
await q("manifest_stops.order_id still present",
  `SELECT count(*) FROM information_schema.columns WHERE table_name='manifest_stops' AND column_name='order_id'`);
await q("manifest_stops_unique_shop constraint",
  `SELECT count(*) FROM pg_constraint WHERE conname='manifest_stops_unique_shop'`);
await q("submit_request_atomic function",
  `SELECT count(*) FROM pg_proc WHERE proname='submit_request_atomic'`);
await q("save_order_template function",
  `SELECT count(*) FROM pg_proc WHERE proname='save_order_template'`);
await q("products SELECT policies",
  `SELECT polname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='products' AND p.polcmd IN ('r','*')`);

await client.end();
