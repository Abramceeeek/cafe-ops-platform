"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, MapPin, Navigation, PackageCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrderStatus } from "@/app/actions/orders";

interface ManifestRow {
  id: string;
  status: string;
  requested_delivery_date: string;
  shops: { name: string; address: string | null } | null;
  order_items: { quantity: number; unit: string; products: { name: string } | null }[];
}

// local YYYY-MM-DD (delivery dates are plain dates, compare in local time)
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface BranchGroup {
  shop: string;
  address: string | null;
  orderIds: string[];
  readyIds: string[];
  lines: { name: string; qty: number; unit: string }[];
}

function groupByBranch(rows: ManifestRow[]): BranchGroup[] {
  const byShop = new Map<string, BranchGroup>();
  for (const r of rows) {
    const shop = r.shops?.name ?? "Shop";
    let g = byShop.get(shop);
    if (!g) {
      g = { shop, address: r.shops?.address ?? null, orderIds: [], readyIds: [], lines: [] };
      byShop.set(shop, g);
    }
    g.orderIds.push(r.id);
    if (r.status === "ready_for_courier") g.readyIds.push(r.id);
    for (const it of r.order_items) {
      const name = it.products?.name ?? "Item";
      const line = g.lines.find((l) => l.name === name && l.unit === it.unit);
      if (line) line.qty += Number(it.quantity);
      else g.lines.push({ name, qty: Number(it.quantity), unit: it.unit });
    }
  }
  const out = Array.from(byShop.values());
  for (const g of out) g.lines.sort((a, b) => a.name.localeCompare(b.name));
  return out.sort((a, b) => a.shop.localeCompare(b.shop));
}

export default function ManifestPage() {
  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [day, setDay] = useState<"today" | "tomorrow">("today");

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

  const { todayStr, tomorrowStr } = useMemo(() => {
    const now = new Date();
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return { todayStr: ymd(now), tomorrowStr: ymd(t) };
  }, []);

  const target = day === "today" ? todayStr : tomorrowStr;
  const dayRows = rows.filter((r) => r.requested_delivery_date === target);
  const groups = groupByBranch(dayRows);
  const counts = {
    today: rows.filter((r) => r.requested_delivery_date === todayStr).length,
    tomorrow: rows.filter((r) => r.requested_delivery_date === tomorrowStr).length,
  };

  // free Google Maps multi-stop route for the selected day (no API key)
  const addresses = Array.from(
    new Set(groups.map((g) => g.address).filter((a): a is string => !!a)),
  );
  const routeUrl =
    addresses.length > 0
      ? "https://www.google.com/maps/dir/" + addresses.map(encodeURIComponent).join("/")
      : null;

  async function pickupBranch(g: BranchGroup) {
    if (g.readyIds.length === 0) return;
    let ok = 0;
    for (const id of g.readyIds) {
      const res = await updateOrderStatus({ order_id: id, new_status: "in_transit" });
      if (res.error) toast.error(`${g.shop}: ${res.error}${res.details ? " — " + res.details : ""}`);
      else ok++;
    }
    if (ok) toast.success(`${g.shop}: ${ok} order${ok > 1 ? "s" : ""} picked up`);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manifest</h1>
          <p className="text-sm text-muted-foreground">What to bring to each branch.</p>
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

      {/* Today / Tomorrow toggle */}
      <div className="inline-flex rounded-lg border bg-muted p-1 text-sm">
        {(["today", "tomorrow"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-md px-4 py-1.5 font-medium capitalize transition-colors ${
              day === d ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {d} ({counts[d]})
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nothing to deliver {day}.
          </CardContent>
        </Card>
      )}

      {groups.map((g) => {
        const totalUnits = g.lines.reduce((n, l) => n + l.qty, 0);
        return (
          <Card key={g.shop}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-base">{g.shop}</CardTitle>
                {g.address && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {g.address}
                  </p>
                )}
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {g.orderIds.length} order{g.orderIds.length > 1 ? "s" : ""} · {totalUnits} units
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="divide-y text-sm">
                {g.lines.map((l, i) => (
                  <li key={i} className="flex items-center justify-between py-1.5">
                    <span>{l.name}</span>
                    <span className="font-mono font-medium">
                      {l.qty} {l.unit}
                    </span>
                  </li>
                ))}
              </ul>
              {g.readyIds.length > 0 && (
                <Button size="sm" onClick={() => void pickupBranch(g)}>
                  <PackageCheck className="h-4 w-4" /> Confirm pickup ({g.readyIds.length})
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
