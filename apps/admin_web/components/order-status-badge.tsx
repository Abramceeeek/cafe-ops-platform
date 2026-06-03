// Status pill (dot + label) using the bobo & wild status palette
// (globals.css --st-*). Mapping per PROJECT_SPEC §7/§11.1.
const MAP: Record<string, { label: string; key: string }> = {
  pending_request: { label: "Pending", key: "pend" },
  specialist_approved: { label: "Approved", key: "pend" },
  shop_confirmed: { label: "Confirmed", key: "prog" },
  in_progress: { label: "In progress", key: "prog" },
  packaged: { label: "Packaged", key: "prog" },
  ready_for_courier: { label: "Ready", key: "ready" },
  in_transit: { label: "In transit", key: "ready" },
  delivered: { label: "Delivered", key: "done" },
  rejected: { label: "Rejected", key: "bad" },
  cancelled: { label: "Cancelled", key: "bad" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, key: "pend" };
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold"
      style={{
        color: `var(--st-${s.key})`,
        background: `var(--st-${s.key}-bg)`,
        borderColor: `var(--st-${s.key}-line)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
      {s.label}
    </span>
  );
}
