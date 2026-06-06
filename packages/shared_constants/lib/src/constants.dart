class AppConstants {
  static const String appName = 'HubSync';
  
  // Storage Keys
  static const String sessionKey = 'hubsync_session';
  
  // Table Names
  static const String shopsTable = 'shops';
  static const String profilesTable = 'profiles';
  static const String productCategoriesTable = 'product_categories';
  static const String productsTable = 'products';
  static const String modifierGroupsTable = 'modifier_groups';
  static const String modifierOptionsTable = 'modifier_options';
  static const String ordersTable = 'orders';
  static const String orderItemsTable = 'order_items';
  static const String orderItemModifiersTable = 'order_item_modifiers';
  static const String deliveryManifestsTable = 'delivery_manifests';
  static const String manifestStopsTable = 'manifest_stops';
  static const String receiptsTable = 'receipts';
  static const String orderTemplatesTable = 'order_templates';
  static const String orderTemplateItemsTable = 'order_template_items';
  static const String orderTemplateItemModifiersTable = 'order_template_item_modifiers';
  static const String cutoffConfigTable = 'cutoff_config';

  // Edge Functions
  static const String getServerTimeFunction = 'get-server-time';
  static const String submitRequestFunction = 'submit-request';
  static const String orderStateChangeFunction = 'order-state-change';
}
