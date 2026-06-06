"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  ClipboardList,
  Plus,
  Files,
  User,
  Inbox,
  LayoutGrid,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  fab?: boolean;
}

// Shop App (FOH + Kitchen) bottom tab bar — design fk-screens-flow TabBar.
const SHOP_TABS: Tab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/request", label: "", icon: Plus, fab: true },
  { href: "/templates", label: "Templates", icon: Files },
  { href: "/account", label: "Account", icon: User },
];

// Hub App — Specialists (dark). spec-screens HubTabs.
const SPECIALIST_TABS: Tab[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/board", label: "Board", icon: LayoutGrid },
  { href: "/account", label: "Account", icon: User },
];

// Hub App — Courier (dark).
const COURIER_TABS: Tab[] = [
  { href: "/manifest", label: "Manifest", icon: Truck },
  { href: "/account", label: "Account", icon: User },
];

const SPECIALIST_ROLES = ["meat_specialist", "bread_baker", "pastry_chef"];

function tabsFor(role: string): Tab[] {
  if (role === "courier") return COURIER_TABS;
  if (SPECIALIST_ROLES.includes(role)) return SPECIALIST_TABS;
  return SHOP_TABS;
}

export function MobileShell({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = tabsFor(role);
  // Hub roles (Specialists + Courier) run the dark kitchen-display theme (§ theme.css .hub).
  const hub = role === "courier" || SPECIALIST_ROLES.includes(role);

  useEffect(() => {
    const supabase = createClient();
    const RELEVANT: Record<string, string[]> = {
      foh_manager: ["specialist_approved", "in_transit", "delivered", "rejected"],
      kitchen_manager: ["specialist_approved", "in_transit", "delivered", "rejected"],
      meat_specialist: ["pending_request", "shop_confirmed"],
      bread_baker: ["pending_request", "shop_confirmed"],
      pastry_chef: ["pending_request", "shop_confirmed"],
      courier: ["ready_for_courier"],
      admin: [],
    };
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
    const relevant = RELEVANT[role] ?? [];
    const channel = supabase
      .channel("orders-feed-mobile")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const status = (payload.new as { status?: string } | null)?.status;
          if (!status) return;
          if (relevant.length > 0 && !relevant.includes(status)) return;
          toast(MSG[status] ?? `Order update: ${status}`);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [role]);

  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen w-full max-w-md flex-col bg-background text-foreground",
        hub && "dark",
      )}
    >
      <main className="flex-1 px-4 pb-24 pt-3">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-around border-t bg-card px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = pathname === t.href;
          if (t.fab) {
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-label="New Request"
                className="-mt-5 grid h-[52px] w-[52px] place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition hover:brightness-105"
              >
                <Icon className="h-6 w-6" />
              </Link>
            );
          }
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-col items-center gap-1 px-2 text-[10px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
