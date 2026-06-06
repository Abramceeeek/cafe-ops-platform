import { readFileSync } from "node:fs";
import { createClient } from "../apps/admin_web/node_modules/@supabase/supabase-js/dist/index.mjs";

const kv = Object.fromEntries(
  readFileSync(new URL("../keys.txt", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(kv.SUPABASE_URL, kv.Superbase_service_role, { auth: { persistSession: false } });
const st = JSON.parse(readFileSync(new URL("../.design/demo-state.json", import.meta.url), "utf8"));

const { data: products } = await db.from("products").select("id").limit(3);
const { data: tpl } = await db
  .from("order_templates")
  .insert({ shop_id: st.shopId, created_by: st.userId, name: "Standard Tuesday Restock", role: "foh_manager" })
  .select("id")
  .single();
await db.from("order_template_items").insert(
  (products ?? []).map((p, i) => ({ template_id: tpl.id, product_id: p.id, quantity: [3, 6, 24][i] ?? 1 })),
);
st.templateId = tpl.id;
import("node:fs").then((fs) => fs.writeFileSync(new URL("../.design/demo-state.json", import.meta.url), JSON.stringify(st, null, 2)));
console.log("seeded template", tpl.id, "with", products?.length, "items");
