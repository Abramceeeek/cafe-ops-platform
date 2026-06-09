import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';

class OrderItemView {
  final String name;
  final num qty;
  final String unit;
  OrderItemView(this.name, this.qty, this.unit);
}

class ShopOrder {
  final String id;
  final String status;
  final String deliveryDate;
  final bool isEmergency;
  final String? rejectionReason;
  final List<OrderItemView> items;
  ShopOrder({
    required this.id,
    required this.status,
    required this.deliveryDate,
    required this.isEmergency,
    required this.rejectionReason,
    required this.items,
  });
}

const _statusLabel = {
  'pending_request': 'Pending',
  'specialist_approved': 'Approved',
  'shop_confirmed': 'Confirmed',
  'in_progress': 'In progress',
  'packaged': 'Packaged',
  'ready_for_courier': 'Ready',
  'in_transit': 'Out for delivery',
  'delivered': 'Delivered',
  'rejected': 'Declined',
  'cancelled': 'Cancelled',
};

Color _statusColor(String s) {
  switch (s) {
    case 'delivered':
      return Colors.green;
    case 'rejected':
    case 'cancelled':
      return Colors.red;
    case 'in_transit':
    case 'ready_for_courier':
      return Colors.blue;
    case 'specialist_approved':
      return Colors.teal;
    default:
      return Colors.orange;
  }
}

/// The shop's own orders (RLS scopes to the shop + the manager's own role).
final shopOrdersProvider = FutureProvider<List<ShopOrder>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  final rows = await supabase
      .from('orders')
      .select('id, status, requested_delivery_date, is_emergency, rejection_reason, '
          'order_items(quantity, unit, products(name))')
      .order('requested_delivery_date', ascending: false);
  return (rows as List).map((r) {
    final items = (r['order_items'] as List?) ?? [];
    return ShopOrder(
      id: r['id'] as String,
      status: (r['status'] ?? '') as String,
      deliveryDate: (r['requested_delivery_date'] ?? '') as String,
      isEmergency: r['is_emergency'] == true,
      rejectionReason: r['rejection_reason'] as String?,
      items: items.map((i) {
        final m = i as Map<String, dynamic>;
        return OrderItemView((m['products']?['name'] ?? 'Item') as String, (m['quantity'] as num?) ?? 0, (m['unit'] ?? '') as String);
      }).toList(),
    );
  }).toList();
});

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(shopOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Orders'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(shopOrdersProvider))],
      ),
      body: orders.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('No orders yet.'));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(shopOrdersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final o = list[i];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                if (o.isEmergency)
                                  Container(
                                    margin: const EdgeInsets.only(right: 6),
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(4)),
                                    child: const Text('EMERGENCY', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                  ),
                                Text('for ${o.deliveryDate}', style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                border: Border.all(color: _statusColor(o.status)),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                _statusLabel[o.status] ?? o.status,
                                style: TextStyle(color: _statusColor(o.status), fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ...o.items.map((it) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [Expanded(child: Text(it.name)), Text('${it.qty} ${it.unit}')],
                              ),
                            )),
                        if (o.status == 'rejected' && o.rejectionReason != null && o.rejectionReason!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                              child: Text('Declined — ${o.rejectionReason}', style: TextStyle(color: Colors.red.shade900, fontSize: 12.5)),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
