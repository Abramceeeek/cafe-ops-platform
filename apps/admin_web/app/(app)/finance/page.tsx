"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptButton } from "@/components/receipt-button";

interface Row {
  id: string;
  requested_delivery_date: string;
  delivered_at: string | null;
  shops: { name: string } | null;
  order_items: { quantity: number; unit_cost: number | null; products: { name: string } | null }[];
}

interface Statement {
  shop_id: string;
  shop_name: string;
  total: number;
  count: number;
  url: string | null;
}

export default function FinancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [busy, setBusy] = useState(false);

  async function genMonthly() {
    setBusy(true);
    const { data, error } = await createClient().functions.invoke("generate-monthly-statement", {
      body: {},
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const st = (data as { statements?: Statement[] } | null)?.statements ?? [];
    setStatements(st);
    toast.success(`Generated ${st.length} statement(s) for last month`);
  }

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, requested_delivery_date, delivered_at,
         shops ( name ), order_items ( quantity, unit_cost, products ( name ) )`,
      )
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orderTotal = (r: Row) => {
    const priced = r.order_items.filter((i) => i.unit_cost != null);
    if (priced.length === 0) return null;
    return priced.reduce((s, i) => s + (i.unit_cost as number) * i.quantity, 0);
  };
  const grand = rows.reduce((s, r) => s + (orderTotal(r) ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">Delivered orders (internal transfer records).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void genMonthly()}>
            <FileBarChart className="h-4 w-4" /> {busy ? "Generating…" : "Last month statements"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {statements.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-medium">Monthly statements</p>
            {statements.map((s) => (
              <div key={s.shop_id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {s.shop_name} — {s.count} deliveries · £{s.total.toFixed(2)}
                </span>
                {s.url && (
                  <a
                    className="font-medium text-primary hover:underline"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download PDF
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const t = orderTotal(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.shops?.name ?? "—"}</TableCell>
                    <TableCell>{r.delivered_at?.slice(0, 10) ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {r.order_items.map((i) => `${i.products?.name} ×${i.quantity}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t == null ? "—" : `£${t.toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReceiptButton orderId={r.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No delivered orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length > 0 && (
            <div className="mt-4 text-right text-sm">
              Grand total (priced): <span className="font-semibold tabular-nums">£{grand.toFixed(2)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
