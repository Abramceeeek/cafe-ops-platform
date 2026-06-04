"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrderStatus } from "@/app/actions/orders";

interface InboxRow {
  id: string;
  requested_delivery_date: string;
  submitted_at: string;
  shops: { name: string } | null;
  order_items: {
    quantity: number;
    unit: string;
    custom_note: string | null;
    products: {
      name: string;
      product_categories: { name: string; assigned_role: string } | null;
    } | null;
    order_item_modifiers: { modifier_group_name: string; modifier_option_name: string }[];
  }[];
}

export default function InboxPage() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setRole((profile?.role as string) ?? "");
    }
    const { data } = await supabase
      .from("orders")
      .select(
        `id, requested_delivery_date, submitted_at,
         shops ( name ),
         order_items (
           quantity, unit, custom_note,
           products ( name, product_categories ( name, assigned_role ) ),
           order_item_modifiers ( modifier_group_name, modifier_option_name )
         )`,
      )
      .eq("status", "pending_request")
      .order("requested_delivery_date", { ascending: true });
    setRows((data ?? []) as unknown as InboxRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(orderId: string, newStatus: "specialist_approved" | "rejected") {
    const response = await updateOrderStatus({ order_id: orderId, new_status: newStatus });
    if (response.error) {
      return toast.error(response.error + (response.details ? ": " + response.details : ""));
    }
    toast.success(newStatus === "specialist_approved" ? "Approved" : "Rejected");
    await load();
  }

  // only items in this specialist's category
  const mine = (r: InboxRow) =>
    r.order_items.filter((i) => i.products?.product_categories?.assigned_role === role);
  const visible = rows.filter((r) => mine(r).length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">Pending requests awaiting your approval.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {!loading && visible.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No pending requests — all clear.
          </CardContent>
        </Card>
      )}

      {visible.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{r.shops?.name ?? "Shop"}</CardTitle>
            <span className="text-sm text-muted-foreground">
              for {r.requested_delivery_date}
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {mine(r).map((i, idx) => (
                <li key={idx} className="flex justify-between border-b py-1">
                  <span>
                    {i.products?.name}
                    {i.order_item_modifiers.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {i.order_item_modifiers.map((m) => m.modifier_option_name).join(", ")}
                      </span>
                    )}
                    {i.custom_note && (
                      <span className="text-muted-foreground"> ({i.custom_note})</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void act(r.id, "specialist_approved")}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void act(r.id, "rejected")}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
