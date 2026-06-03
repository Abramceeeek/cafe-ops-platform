import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ACTIVE = [
  "pending_request",
  "specialist_approved",
  "shop_confirmed",
  "in_progress",
  "packaged",
  "ready_for_courier",
  "in_transit",
];

export default async function DashboardPage() {
  const supabase = createClient();
  const { data } = await supabase.from("orders").select("status");
  const orders = data ?? [];
  const count = (statuses: string[]) =>
    orders.filter((o) => statuses.includes(o.status as string)).length;

  const stats = [
    { label: "Active orders", value: count(ACTIVE) },
    { label: "Awaiting approval", value: count(["pending_request"]) },
    { label: "In transit", value: count(["in_transit"]) },
    { label: "Delivered", value: count(["delivered"]) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Operations overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/catalog" className="text-sm font-medium text-primary hover:underline">
            Catalog management →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
