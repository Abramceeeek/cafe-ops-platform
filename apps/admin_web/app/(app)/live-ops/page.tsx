"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Row {
  id: string;
  status: string;
  requested_delivery_date: string;
  submitted_at: string;
  shops: { name: string } | null;
  order_items: { quantity: number; products: { name: string } | null }[];
}

const STATUSES = [
  "pending_request", "specialist_approved", "shop_confirmed", "in_progress",
  "packaged", "ready_for_courier", "in_transit", "delivered", "rejected", "cancelled",
];

export default function LiveOpsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date, submitted_at,
         shops ( name ), order_items ( quantity, products ( name ) )`,
      )
      .order("submitted_at", { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const summary = (r: Row) =>
    r.order_items.map((i) => `${i.products?.name} ×${i.quantity}`).join(", ");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Operations</h1>
          <p className="text-sm text-muted-foreground">All orders across every shop.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.shops?.name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.requested_delivery_date}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{summary(r)}</TableCell>
                  <TableCell><OrderStatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No orders.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
