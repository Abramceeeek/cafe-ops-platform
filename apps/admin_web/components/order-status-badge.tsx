import { cn } from "@/lib/utils";

// Status palette per PROJECT_SPEC §7/§11.1D.
const STATUS: Record<string, { label: string; cls: string }> = {
  pending_request: { label: "Pending", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  specialist_approved: { label: "Approved", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  shop_confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  in_progress: { label: "In progress", cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  packaged: { label: "Packaged", cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  ready_for_courier: { label: "Ready", cls: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  in_transit: { label: "In transit", cls: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  delivered: { label: "Delivered", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}
