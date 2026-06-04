"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Inbox,
  PlusCircle,
  ClipboardList,
  Files,
  KanbanSquare,
  Truck,
  Activity,
  Receipt,
  Users,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";
import NotificationBell from "@/components/notification-bell";
import SignOutButton from "@/components/sign-out-button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[]; // empty = all roles
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: [] },
  { href: "/request", label: "New Request", icon: PlusCircle, roles: ["foh_manager", "kitchen_manager"] },
  { href: "/templates", label: "Templates", icon: Files, roles: ["foh_manager", "kitchen_manager"] },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ["foh_manager", "kitchen_manager"] },
  { href: "/inbox", label: "Inbox", icon: Inbox, roles: ["meat_specialist", "bread_baker", "pastry_chef"] },
  { href: "/board", label: "To-Do Board", icon: KanbanSquare, roles: ["meat_specialist", "bread_baker", "pastry_chef"] },
  { href: "/manifest", label: "Manifest", icon: Truck, roles: ["courier"] },
  { href: "/live-ops", label: "Live Ops", icon: Activity, roles: ["admin"] },
  { href: "/catalog", label: "Catalog", icon: BookOpen, roles: ["admin"] },
  { href: "/finance", label: "Finance", icon: Receipt, roles: ["admin"] },
  { href: "/users", label: "Users", icon: Users, roles: ["admin"] },
];

const READY = new Set([
  "/", "/catalog", "/request", "/templates", "/inbox", "/orders", "/board", "/manifest",
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

function Brand() {
  return (
    <div className="flex h-14 flex-col justify-center border-b px-5">
      <span className="font-display text-base leading-tight">
        bobo <em>&amp;</em> wild
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        HubSync
      </span>
    </div>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

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
  const [open, setOpen] = useState(false);
  const items = NAV.filter(
    (i) => READY.has(i.href) && (i.roles.length === 0 || i.roles.includes(role)),
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <Brand />
        <NavLinks items={items} pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-2">
            {/* Mobile nav drawer */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col">
                <Brand />
                <NavLinks items={items} pathname={pathname} onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-sm text-muted-foreground">{ROLE_LABEL[role] ?? role}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
            <NotificationBell role={role} />
            <ModeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
