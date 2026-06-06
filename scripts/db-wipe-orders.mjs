import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

function parseKV(path) {
  return Object.fromEntries(
    readFileSync(new URL(path, import.meta.url), "utf8")
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

const keys = parseKV("../keys.txt");
const db = createClient(keys.SUPABASE_URL, keys.Superbase_service_role, { auth: { persistSession: false } });
const ALL = (q) => q.not("id", "is", null); // PostgREST requires a filter; matches every row

async function count(t) {
  const { count } = await db.from(t).select("*", { count: "exact", head: true });
  return count;
}
const TABLES = ["orders", "order_items", "order_item_modifiers", "receipts", "delivery_manifests", "manifest_stops"];

console.log("BEFORE:");
for (const t of TABLES) console.log(`  ${t.padEnd(22)} ${await count(t)}`);

// Ordered to satisfy FKs (orders.receipt_id <-> receipts is circular)
const steps = [
  ["null orders.receipt_id", () => ALL(db.from("orders").update({ receipt_id: null }))],
  ["delete receipts", () => ALL(db.from("receipts").delete())],
  ["delete order_item_modifiers", () => ALL(db.from("order_item_modifiers").delete())],
  ["delete order_items", () => ALL(db.from("order_items").delete())],
  ["delete orders", () => ALL(db.from("orders").delete())],
  ["delete manifest_stops", () => ALL(db.from("manifest_stops").delete())],
  ["delete delivery_manifests", () => ALL(db.from("delivery_manifests").delete())],
];
for (const [label, run] of steps) {
  const { error } = await run();
  console.log(`  ${error ? "FAIL" : "ok  "} ${label}${error ? " -> " + error.message : ""}`);
  if (error) process.exit(1);
}

console.log("AFTER:");
for (const t of TABLES) console.log(`  ${t.padEnd(22)} ${await count(t)}`);
