"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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

interface Row {
  id: string;
  requested_delivery_date: string;
  delivered_at: string | null;
  shops: { name: string } | null;
  order_items: { quantity: number; unit_cost: number | null; products: { name: string } | null }[];
}

export default function FinancePage() {
  const [rows, setRows] = useState<Row[]>([]);

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
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
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
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
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
      <p className="text-xs text-muted-foreground">
        PDF receipts &amp; monthly statements are generated in the next step (4.1/4.2).
      </p>
    </div>
  );
}
