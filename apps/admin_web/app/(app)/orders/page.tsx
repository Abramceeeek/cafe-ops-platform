"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { ReceiptButton } from "@/components/receipt-button";
import { updateOrderStatus } from "@/app/actions/orders";

interface OrderRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  submitted_at: string;
  order_items: { quantity: number; unit: string; products: { name: string } | null }[];
}

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date, submitted_at,
         order_items ( quantity, unit, products ( name ) )`,
      )
      .order("submitted_at", { ascending: false });
    setRows((data ?? []) as unknown as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(orderId: string, newStatus: string, ok: string) {
    const supabase = createClient();
    const response = await updateOrderStatus({ order_id: orderId, new_status: newStatus });
    if (response.error) {
      return toast.error(response.error + (response.details ? ": " + response.details : ""));
    }
    // Generate the dispatch receipt once delivery is confirmed.
    if (newStatus === "delivered") {
      await supabase.functions.invoke("generate-receipt", { body: { order_id: orderId } });
    }
    toast.success(ok);
    await load();
  }

  const summary = (r: OrderRow) =>
    r.order_items.map((i) => `${i.products?.name} ×${i.quantity}`).join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Your requests and their status.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {!loading && rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No orders yet — submit one from New Request.
          </CardContent>
        </Card>
      )}

      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Delivery {r.requested_delivery_date}</CardTitle>
            <OrderStatusBadge status={r.status} />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{summary(r)}</p>
            {r.status === "specialist_approved" && (
              <Button size="sm" onClick={() => void transition(r.id, "shop_confirmed", "Order confirmed")}>
                Final Confirm
              </Button>
            )}
            {r.status === "in_transit" && (
              <Button size="sm" onClick={() => void transition(r.id, "delivered", "Delivery confirmed")}>
                Confirm Receipt
              </Button>
            )}
            {r.status === "delivered" && <ReceiptButton orderId={r.id} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
