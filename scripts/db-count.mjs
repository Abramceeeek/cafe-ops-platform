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
const url = keys.SUPABASE_URL;
const key = keys.Superbase_service_role; // real service_role JWT from keys.txt
console.log("Project:", url, "| service_role len:", key?.length);

const db = createClient(url, key, { auth: { persistSession: false } });
const tables = ["orders", "order_items", "order_item_modifiers", "receipts", "delivery_manifests", "manifest_stops"];
for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(22)} ${error ? "ERR " + error.message : count}`);
}
