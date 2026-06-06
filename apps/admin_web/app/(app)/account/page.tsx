import { Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ModeToggle } from "@/components/mode-toggle";
import SignOutButton from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  foh_manager: "FOH Manager",
  kitchen_manager: "Kitchen Manager",
  meat_specialist: "Meat Specialist",
  bread_baker: "Bread Baker",
  pastry_chef: "Pastry Chef",
  courier: "Courier",
  admin: "Admin",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, shops(name)")
    .eq("id", user?.id ?? "")
    .single();

  const name = (profile?.full_name as string) ?? "";
  const role = (profile?.role as string) ?? "";
  const shopRel = profile?.shops as unknown as { name: string } | { name: string }[] | null;
  const shopName = (Array.isArray(shopRel) ? shopRel[0]?.name : shopRel?.name) ?? "";

  return (
    <div className="space-y-4">
      <h1 className="px-0.5 pt-1 font-display text-2xl">Account</h1>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent bg-accent text-base font-bold text-accent-foreground">
            {initials(name)}
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold">{name}</div>
            <div className="text-sm text-muted-foreground">
              {ROLE_LABEL[role] ?? role}
              {shopName ? ` · ${shopName}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-semibold">Appearance</span>
          </div>
          <ModeToggle />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <SignOutButton />
        <p className="mt-2 text-xs text-muted-foreground">
          Internal staff access · accounts are issued by your administrator.
        </p>
      </div>
    </div>
  );
}
