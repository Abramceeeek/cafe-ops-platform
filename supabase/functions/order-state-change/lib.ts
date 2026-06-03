// Order state-machine rules — PROJECT_SPEC §7.2/§7.3, §6.1.
// Pure + testable; the handler enforces these before any DB write.

export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_request: ["specialist_approved", "rejected"],
  specialist_approved: ["shop_confirmed", "cancelled"],
  shop_confirmed: ["in_progress"],
  in_progress: ["packaged"],
  packaged: ["ready_for_courier"],
  ready_for_courier: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
  rejected: [],
  cancelled: [],
};

// Roles permitted to drive each target status.
export const TRANSITION_ROLES: Record<string, string[]> = {
  specialist_approved: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  rejected: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  shop_confirmed: ["foh_manager", "kitchen_manager", "admin"],
  cancelled: ["foh_manager", "kitchen_manager", "admin"],
  in_progress: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  packaged: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  ready_for_courier: ["meat_specialist", "bread_baker", "pastry_chef", "admin"],
  in_transit: ["courier", "admin"],
  delivered: ["foh_manager", "kitchen_manager", "admin"],
};

// Timestamp column stamped when entering a status.
export const STATUS_TIMESTAMP: Record<string, string> = {
  specialist_approved: "specialist_approved_at",
  shop_confirmed: "shop_confirmed_at",
  packaged: "packaged_at",
  ready_for_courier: "ready_at",
  delivered: "delivered_at",
};

export function canTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function roleAllowed(to: string, role: string): boolean {
  return (TRANSITION_ROLES[to] ?? []).includes(role);
}
