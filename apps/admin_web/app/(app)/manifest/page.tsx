"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, MapPin, Navigation } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { updateOrderStatus } from "@/app/actions/orders";

interface ManifestRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  shops: { name: string; address: string | null } | null;
  order_items: { quantity: number; unit: string; products: { name: string } | null }[];
}

export default function ManifestPage() {
  const [rows, setRows] = useState<ManifestRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("orders")
      .select(
        `id, status, requested_delivery_date,
         shops ( name, address ),
         order_items ( quantity, unit, products ( name ) )`,
      )
      .in("status", ["ready_for_courier", "in_transit"])
      .order("requested_delivery_date", { ascending: true });
    setRows((data ?? []) as unknown as ManifestRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pickup(orderId: string) {
    const response = await updateOrderStatus({ order_id: orderId, new_status: "in_transit" });
    if (response.error) {
      return toast.error(response.error + (response.details ? ": " + response.details : ""));
    }
    toast.success("Picked up — in transit");
    await load();
  }

  // distinct shop addresses → free Google Maps multi-stop route (no API key)
  const addresses = Array.from(
    new Set(rows.map((r) => r.shops?.address).filter((a): a is string => !!a)),
  );
  const routeUrl =
    addresses.length > 0
      ? "https://www.google.com/maps/dir/" + addresses.map(encodeURIComponent).join("/")
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manifest</h1>
          <p className="text-sm text-muted-foreground">Stops ready for delivery.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {routeUrl && (
            <Button size="sm" asChild>
              <a href={routeUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" /> Start route
              </a>
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No stops ready yet.
          </CardContent>
        </Card>
      )}

      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{r.shops?.name ?? "Shop"}</CardTitle>
            <OrderStatusBadge status={r.status} />
          </CardHeader>
          <CardContent className="space-y-2">
            {r.shops?.address && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {r.shops.address}
              </p>
            )}
            <ul className="text-sm text-muted-foreground">
              {r.order_items.map((i, idx) => (
                <li key={idx}>
                  {i.products?.name} × {i.quantity} {i.unit}
                </li>
              ))}
            </ul>
            {r.status === "ready_for_courier" && (
              <Button size="sm" onClick={() => void pickup(r.id)}>
                Confirm pickup
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
