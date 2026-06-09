enum UserRole {
  fohManager('foh_manager'),
  kitchenManager('kitchen_manager'),
  meatSpecialist('meat_specialist'),
  breadBaker('bread_baker'),
  pastryChef('pastry_chef'),
  courier('courier'),
  admin('admin');

  final String value;
  const UserRole(this.value);

  static UserRole? fromString(String val) {
    for (var role in UserRole.values) {
      if (role.value == val) return role;
    }
    return null;
  }
}

enum OrderStatus {
  pendingRequest('pending_request'),
  specialistApproved('specialist_approved'),
  rejected('rejected'),
  shopConfirmed('shop_confirmed'),
  cancelled('cancelled'),
  inProgress('in_progress'),
  packaged('packaged'),
  readyForCourier('ready_for_courier'),
  inTransit('in_transit'),
  delivered('delivered');

  final String value;
  const OrderStatus(this.value);

  static OrderStatus? fromString(String val) {
    for (var status in OrderStatus.values) {
      if (status.value == val) return status;
    }
    return null;
  }
}

/// Display names for role values — identical to the web (`lib/roles.ts`).
/// Specialists are Baker (bread + pastry/retail) and Pitmaster (meat).
const _roleLabels = {
  'admin': 'Admin',
  'foh_manager': 'FOH Manager',
  'kitchen_manager': 'Kitchen Manager',
  'bread_baker': 'Baker',
  'meat_specialist': 'Pitmaster',
  'courier': 'Courier',
};

String roleLabel(String? role) => (role == null ? null : _roleLabels[role]) ?? role ?? '—';
