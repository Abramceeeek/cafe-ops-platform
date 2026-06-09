import { readFileSync } from "node:fs";
import pg from "../apps/admin_web/node_modules/pg/lib/index.js";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const ref = kv.SUPABASE_URL.replace("https://", "").split(".")[0];
const cand = [
  { host: `aws-1-eu-west-2.pooler.supabase.com`, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, user: "postgres" },
];
let c;
for (const x of cand) {
  const cl = new pg.Client({ ...x, port: 5432, password: kv.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try { await cl.connect(); c = cl; console.log("connected via", x.host, "\n"); break; } catch (e) { try { await cl.end(); } catch {} }
}
if (!c) { console.log("no connection"); process.exit(1); }

const show = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`### ${label}: ${r.rows.length} row(s)`); for (const row of r.rows) console.log("  ", JSON.stringify(row)); }
  catch (e) { console.log(`### ${label}: ERR ${e.message.slice(0, 80)}`); }
};

await show("pg_cron jobs", `SELECT jobid, schedule, active, left(command,160) AS command FROM cron.job`);
await show("triggers on orders", `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND NOT tgisinternal`);
await show("functions mentioning specialist_approved/shop_confirmed UPDATE", `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%UPDATE%orders%SET%status%' OR (prosrc ILIKE '%specialist_approved%' AND prosrc ILIKE '%update%')`);
await c.end();
