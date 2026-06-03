"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Inbox,
  PlusCircle,
  ClipboardList,
  KanbanSquare,
  Truck,
  Activity,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import SignOutButton from "@/components/sign-out-button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[]; // empty = all roles
}

// Full role-aware nav. Routes are added as each stage ships; unbuilt links are
// hidden via the `ready` set below so the nav never 404s.
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: [] },
  { href: "/request", label: "New Request", icon: PlusCircle, roles: ["foh_manager", "kitchen_manager"] },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["foh_manager", "kitchen_manager"] },
  { href: "/inbox", label: "Inbox", icon: Inbox, roles: ["meat_specialist", "bread_baker", "pastry_chef"] },
  { href: "/board", label: "To-Do Board", icon: KanbanSquare, roles: ["meat_specialist", "bread_baker", "pastry_chef"] },
  { href: "/manifest", label: "Manifest", icon: Truck, roles: ["courier"] },
  { href: "/live-ops", label: "Live Ops", icon: Activity, roles: ["admin"] },
  { href: "/catalog", label: "Catalog", icon: BookOpen, roles: ["admin"] },
  { href: "/finance", label: "Finance", icon: Receipt, roles: ["admin"] },
  { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
];

// Routes that actually exist today. Extend as stages land.
const READY = new Set([
  "/", "/catalog", "/request", "/inbox", "/orders", "/board", "/manifest",
  "/live-ops", "/finance", "/users",
]);

const ROLE_LABEL: Record<string, string> = {
  foh_manager: "FOH Manager",
  kitchen_manager: "Kitchen Manager",
  meat_specialist: "Meat Specialist",
  bread_baker: "Bread Baker",
  pastry_chef: "Pastry Chef",
  courier: "Courier",
  admin: "Admin",
};

export function AppShell({
  email,
  role,
  children,
}: {
  email: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV.filter(
    (i) => READY.has(i.href) && (i.roles.length === 0 || i.roles.includes(role)),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            H
          </div>
          <span className="font-semibold tracking-tight">HubSync</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-6">
          <div className="text-sm text-muted-foreground">
            {ROLE_LABEL[role] ?? role}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
            <ModeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  );
}
