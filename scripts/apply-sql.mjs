import { readFileSync } from "node:fs";
import pg from "../apps/admin_web/node_modules/pg/lib/index.js";
import { assertConfirmedTarget } from "./_confirm-guard.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
// apply-sql runs ARBITRARY SQL against live — require `--confirm <project-ref>` like
// the other destructive scripts so a swapped keys.txt can't silently target prod.
assertConfirmedTarget(kv.SUPABASE_URL, "apply-sql.mjs");
const ref = kv.SUPABASE_URL.replace("https://", "").split(".")[0];
const password = kv.SUPABASE_DB_PASSWORD;
const sqlPath = process.argv[2];
const sql = readFileSync(sqlPath, "utf8");

const candidates = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  { host: `aws-0-eu-west-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `aws-0-eu-central-1.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `aws-1-eu-west-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
];

for (const c of candidates) {
  const client = new pg.Client({ ...c, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query(sql);
    console.log("APPLIED via", c.host);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log("fail", c.host, "->", e.message);
    try { await client.end(); } catch {}
  }
}
console.error("All connection attempts failed.");
process.exit(1);
