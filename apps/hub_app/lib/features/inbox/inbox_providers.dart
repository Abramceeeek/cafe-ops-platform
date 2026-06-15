import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../../core/auth_provider.dart';
import '../../core/realtime.dart';

class PendingItem {
  final String id;
  final String name;
  final num qty;
  final String unit;
  final String catName; // product category (for pastry→bread ordering on the schedule)
  PendingItem(this.id, this.name, this.qty, this.unit, {this.catName = ''});
}

class PendingOrder {
  final String id;
  final String shopName;
  final bool isEmergency;
  final String deliveryDate;
  final List<PendingItem> items;
  PendingOrder({
    required this.id,
    required this.shopName,
    required this.isEmergency,
    required this.deliveryDate,
    required this.items,
  });
}

/// Pending requests for the current specialist's category only (orders are split
/// one-category-per-order, so the first line's assigned_role identifies it).
final pendingOrdersProvider = FutureProvider<List<PendingOrder>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  ref.watch(ordersTickProvider); // live re-fetch on any orders change (this app or web)
  final role = ref.watch(currentUserRoleProvider).value?.value;
  final rows = await supabase
      .from('orders')
      .select(
        'id, requested_delivery_date, is_emergency, '
        'shops(name), '
        'order_items(id, quantity, unit, products(name, product_categories(assigned_role)))',
      )
      .eq('status', 'pending_request')
      .order('requested_delivery_date');

  final out = <PendingOrder>[];
  for (final r in rows as List) {
    final items = (r['order_items'] as List?) ?? [];
    if (items.isEmpty) continue;
    final first = items.first as Map<String, dynamic>;
    final assigned = first['products']?['product_categories']?['assigned_role'];
    if (role != null && assigned != role) continue;
    out.add(PendingOrder(
      id: r['id'] as String,
      shopName: (r['shops']?['name'] ?? 'Shop') as String,
      isEmergency: r['is_emergency'] == true,
      deliveryDate: (r['requested_delivery_date'] ?? '') as String,
      items: items.map((i) {
        final m = i as Map<String, dynamic>;
        return PendingItem(
          m['id'] as String,
          (m['products']?['name'] ?? 'Item') as String,
          (m['quantity'] as num?) ?? 0,
          (m['unit'] ?? '') as String,
        );
      }).toList(),
    ));
  }
  out.sort((a, b) => (b.isEmergency ? 1 : 0) - (a.isEmergency ? 1 : 0));
  return out;
});
