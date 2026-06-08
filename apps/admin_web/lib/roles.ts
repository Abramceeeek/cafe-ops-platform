// Single source of truth for role display names + selectable role lists.
// Specialists are Baker (bread + pastry/retail) and Pitmaster (meat). Pastry Chef
// was dropped — its categories are owned by the Baker. Keep these labels identical
// everywhere so the UI never drifts again.
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  foh_manager: "FOH Manager",
  kitchen_manager: "Kitchen Manager",
  bread_baker: "Baker",
  meat_specialist: "Pitmaster",
  courier: "Courier",
};

export function roleLabel(role?: string | null): string {
  return (role && ROLE_LABEL[role]) || role || "—";
}

export const SPECIALIST_ROLES = ["bread_baker", "meat_specialist"];

// Roles selectable when creating a user.
export const USER_ROLES = [
  "admin",
  "bread_baker",
  "meat_specialist",
  "foh_manager",
  "kitchen_manager",
  "courier",
];

// Roles a catalog category can be assigned to.
export const CATEGORY_ROLES = ["bread_baker", "meat_specialist", "admin"];
