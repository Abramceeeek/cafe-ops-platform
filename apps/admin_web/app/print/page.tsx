"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Standalone A4 print sheet for a single delivery day — lives outside the (app)
// route group so the mobile shell/nav doesn't render. Specialist prints their
// category's orders; courier prints the whole route. Auto-opens the print dialog
// once data has loaded (printing before load would yield a blank page).
interface Item {
  id: string;
  quantity: number;
  unit: string;
  products: { name: string; product_categories: { name: string; assigned_role: string } | null } | null;
}
interface Row {
  id: string;
  status: string;
  shops: { name: string; address: string | null } | null;
  order_items: Item[];
}

const STATUSES = ["specialist_approved", "in_progress", "packaged", "ready_for_courier", "in_transit", "delivered"];

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PrintPage() {
  const [rows, setRows] = useState<Row[]>([]);
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
           order_items ( id, quantity, unit, products ( name, product_categories ( name, assigned_role ) ) )`,
        )
        .eq("requested_delivery_date", d)
        .in("status", STATUSES);

      let list = (data ?? []) as unknown as Row[];
      if (role === "specialist" && mineRole) {
        list = list
          .map((r) => ({
            ...r,
            order_items: r.order_items.filter((i) => i.products?.product_categories?.assigned_role === mineRole),
          }))
          .filter((r) => r.order_items.length > 0);
      }
      list.sort((a, b) => (a.shops?.name ?? "").localeCompare(b.shops?.name ?? ""));
      setRows(list);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready && rows.length >= 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [ready, rows]);

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh" }}>
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print { .no-print { display: none !important; } }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {scope === "specialist" ? "Production / Delivery Sheet" : "Delivery Route"}
          </div>
          <div style={{ fontSize: 14, marginTop: 2 }}>{date ? fmtDate(date) : ""}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            bobo &amp; wild · HubSync · {rows.length} order{rows.length !== 1 ? "s" : ""}
          </div>
        </div>

        {ready && rows.length === 0 && <div style={{ fontSize: 14 }}>No orders for this day.</div>}

        {rows.map((r) => (
          <div key={r.id} style={{ marginBottom: 14, breakInside: "avoid", border: "1px solid #000", borderRadius: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "8px 12px",
                borderBottom: "1px solid #000",
                background: "#f2f2f2",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.shops?.name ?? "Shop"}</span>
              <span style={{ fontSize: 11, fontFamily: "monospace" }}>
                #{r.id.slice(0, 4).toUpperCase()} · {r.status.replace(/_/g, " ")}
              </span>
            </div>
            {r.shops?.address && <div style={{ fontSize: 11, color: "#555", padding: "4px 12px 0" }}>{r.shops.address}</div>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {r.order_items.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid #ddd" }}>
                    <td style={{ padding: "6px 12px" }}>{i.products?.name ?? "Item"}</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {i.quantity} {i.unit}
                    </td>
                    <td style={{ padding: "6px 12px", width: 60, borderLeft: "1px solid #ddd" }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
