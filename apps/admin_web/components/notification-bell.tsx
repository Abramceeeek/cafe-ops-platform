"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Friendly message per order status.
const MSG: Record<string, string> = {
  pending_request: "New request received",
  specialist_approved: "Order approved — confirm it",
  shop_confirmed: "Order confirmed",
  in_progress: "Order in production",
  packaged: "Order packaged",
  ready_for_courier: "Order ready for pickup",
  in_transit: "Order out for delivery",
  delivered: "Order delivered",
  rejected: "Order rejected",
};

// Which transitions each role cares about (empty = all). RLS already limits the
// rows a role can see; this just trims noise to the relevant events.
const RELEVANT: Record<string, string[]> = {
  foh_manager: ["specialist_approved", "in_transit", "delivered", "rejected"],
  kitchen_manager: ["specialist_approved", "in_transit", "delivered", "rejected"],
  meat_specialist: ["pending_request", "shop_confirmed"],
  bread_baker: ["pending_request", "shop_confirmed"],
  pastry_chef: ["pending_request", "shop_confirmed"],
  courier: ["ready_for_courier"],
  admin: [],
};

export default function NotificationBell({ role }: { role: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const relevant = RELEVANT[role] ?? [];
    const channel = supabase
      .channel("orders-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const status = (payload.new as { status?: string } | null)?.status;
          if (!status) return; // DELETE events have no new row
          if (relevant.length > 0 && !relevant.includes(status)) return;
          toast(MSG[status] ?? `Order update: ${status}`);
          setCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [role]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Notifications"
      onClick={() => setCount(0)}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  );
}
