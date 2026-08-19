"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Standalone A4 print sheet for a single delivery day — lives outside the (app)
// route group so the mobile shell/nav doesn't render. One page PER SHOP (standing
// orders + approved new requests merged, pastry then bread), then a final
// production-totals page so no one hand-counts. Specialist prints their category;
// courier prints the whole route. Auto-opens the print dialog once data loads.
interface Item {
  quantity: number;
  unit: string;
  product_name: string | null;
  products: { name: string; product_categories: { name: string; assigned_role: string } | null } | null;
}
interface Row {
  id: string;
  status: string;
  shops: { name: string; address: string | null } | null;
  order_items: Item[];
}

const STATUSES = ["specialist_approved", "in_progress", "packaged", "ready_for_courier", "in_transit", "delivered"];

// Pastry first, then bread, then anything else.
function catRank(name: string | undefined): number {
  const n = (name ?? "").toLowerCase();
  if (n.includes("pastry") || n.includes("retail")) return 0;
  if (n.includes("bread")) return 1;
  return 2;
}

interface Line { name: string; unit: string; qty: number; catName: string }
interface ShopSheet { name: string; address: string | null; lines: Line[] }

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function mergeLines(map: Map<string, Line>, items: Item[]) {
  for (const i of items) {
    const name = i.product_name ?? i.products?.name ?? "Item";
    const catName = i.products?.product_categories?.name ?? "";
    const key = `${name}|${i.unit}`;
    const ex = map.get(key);
    if (ex) ex.qty += Number(i.quantity);
    else map.set(key, { name, unit: i.unit, qty: Number(i.quantity), catName });
  }
}

function sortLines(lines: Line[]): Line[] {
  return lines.sort((a, b) => catRank(a.catName) - catRank(b.catName) || a.name.localeCompare(b.name));
}

export default function PrintPage() {
  const [shops, setShops] = useState<ShopSheet[]>([]);
  const [totals, setTotals] = useState<Line[]>([]);
  const [date, setDate] = useState("");
  const [scope, setScope] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date") ?? "";
    const role = params.get("role") ?? "courier";
    setDate(d);
    setScope(role);

    (async () => {
      const supabase = createClient();
      let mineRole = "";
      if (role === "specialist") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
          mineRole = (p?.role as string) ?? "";
        }
      }
      const { data } = await supabase
        .from("orders")
        .select(
          `id, status,
           shops ( name, address ),
           order_items ( quantity, unit, product_name, products ( name, product_categories ( name, assigned_role ) ) )`,
        )
        .eq("requested_delivery_date", d)
        .in("status", STATUSES);

      let list = (data ?? []) as unknown as Row[];
      if (role === "specialist" && mineRole) {
        list = list
          .map((r) => ({ ...r, order_items: r.order_items.filter((i) => i.products?.product_categories?.assigned_role === mineRole) }))
          .filter((r) => r.order_items.length > 0);
      }

      // Merge every order for a shop into one sheet; accumulate grand totals across all shops.
      const byShop = new Map<string, { name: string; address: string | null; lines: Map<string, Line> }>();
      const totalMap = new Map<string, Line>();
      for (const r of list) {
        const name = r.shops?.name ?? "Shop";
        const slot = byShop.get(name) ?? { name, address: r.shops?.address ?? null, lines: new Map() };
        mergeLines(slot.lines, r.order_items);
        byShop.set(name, slot);
        mergeLines(totalMap, r.order_items);
      }
      const sheets = Array.from(byShop.values())
        .map((s) => ({ name: s.name, address: s.address, lines: sortLines(Array.from(s.lines.values())) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setShops(sheets);
      setTotals(sortLines(Array.from(totalMap.values())));
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [ready, shops]);

  const heading = scope === "specialist" ? "Production / Delivery Sheet" : "Delivery Route";

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh" }}>
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print { .no-print { display: none !important; } }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .shop-page { break-after: page; page-break-after: always; }
      `}</style>
      <div style={{ maxWidth: "210mm", margin: "0 auto", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
        <div className="no-print" style={{ marginBottom: 16 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "8px 16px", border: "1px solid #000", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            Print
          </button>
        </div>

        <div style={{ borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{heading}</div>
          <div style={{ fontSize: 14, marginTop: 2 }}>{date ? fmtDate(date) : ""}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            bobo &amp; wild · HubSync · {shops.length} shop{shops.length !== 1 ? "s" : ""}
          </div>
        </div>

        {ready && shops.length === 0 && <div style={{ fontSize: 14 }}>No orders for this day.</div>}

        {shops.map((s) => (
          <div key={s.name} className="shop-page" style={{ marginBottom: 14, border: "1px solid #000", borderRadius: 6 }}>
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #000",
                background: "#f2f2f2",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 17 }}>{s.name}</div>
              {s.address && <div style={{ fontSize: 11, color: "#555" }}>{s.address}</div>}
            </div>
            <ItemTable lines={s.lines} />
          </div>
        ))}

        {/* Final page: grand totals per item across all shops. */}
        {shops.length > 0 && (
          <div style={{ border: "2px solid #000", borderRadius: 6 }}>
            <div style={{ padding: "8px 12px", borderBottom: "2px solid #000", background: "#000", color: "#fff" }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>
                Production totals — all shops {scope === "specialist" ? "(your items)" : ""}
              </div>
              <div style={{ fontSize: 11 }}>Bake/prepare these totals; per-shop split is on the preceding pages.</div>
            </div>
            <ItemTable lines={totals} />
          </div>
        )}
      </div>
    </div>
  );
}

// Item rows grouped under category sub-headers (pastry → bread), with a blank
// tally column for hand-checking during production / loading.
function ItemTable({ lines }: { lines: Line[] }) {
  let lastRank = -1;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {lines.map((l, idx) => {
          const rank = catRank(l.catName);
          const showHeader = rank !== lastRank;
          lastRank = rank;
          return (
            <tr key={idx} style={{ borderTop: "1px solid #ddd" }}>
              <td style={{ padding: "6px 12px" }}>
                {showHeader && l.catName && (
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", marginBottom: 2 }}>
                    {l.catName}
                  </div>
                )}
                {l.name}
              </td>
              <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                {l.qty} {l.unit}
              </td>
              <td style={{ padding: "6px 12px", width: 60, borderLeft: "1px solid #ddd" }}>&nbsp;</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
