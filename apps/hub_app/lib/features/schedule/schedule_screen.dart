import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../../core/auth_provider.dart';
import '../../core/realtime.dart';
import '../inbox/inbox_providers.dart';

/// Approved orders for this specialist's category, waiting to be marked ready.
final approvedOrdersProvider = FutureProvider<List<PendingOrder>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  ref.watch(ordersTickProvider); // live re-fetch on any orders change (this app or web)
  final role = ref.watch(currentUserRoleProvider).value?.value;
  final rows = await supabase
      .from('orders')
      .select(
        'id, requested_delivery_date, is_emergency, shops(name), '
        'order_items(id, quantity, unit, products(name, product_categories(assigned_role)))',
      )
      .eq('status', 'specialist_approved')
      .order('requested_delivery_date');
  final out = <PendingOrder>[];
  for (final r in rows as List) {
    final items = (r['order_items'] as List?) ?? [];
    if (items.isEmpty) continue;
    final assigned = (items.first as Map)['products']?['product_categories']?['assigned_role'];
    if (role != null && assigned != role) continue;
    out.add(PendingOrder(
      id: r['id'] as String,
      shopName: (r['shops']?['name'] ?? 'Shop') as String,
      isEmergency: r['is_emergency'] == true,
      deliveryDate: (r['requested_delivery_date'] ?? '') as String,
      items: items.map((i) {
        final m = i as Map<String, dynamic>;
        return PendingItem(m['id'] as String, (m['products']?['name'] ?? 'Item') as String,
            (m['quantity'] as num?) ?? 0, (m['unit'] ?? '') as String);
      }).toList(),
    ));
  }
  return out;
});

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});
  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  String? _busyId;

  Future<void> _markReady(PendingOrder o) async {
    setState(() => _busyId = o.id);
    try {
      await ref.read(supabaseProvider).rpc('change_order_status', params: {
        'p_order_id': o.id,
        'p_to': 'ready_for_courier',
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ready for delivery')));
      ref.invalidate(approvedOrdersProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  // Deadline to mark ready = 23:59 the day before delivery.
  // 'overdue' once that has passed (delivery is today or earlier); 'tonight' when
  // delivery is tomorrow (so it's due by 23:59 tonight).
  String _deadline(String dateStr) {
    final d = DateTime.tryParse(dateStr);
    if (d == null) return 'ok';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dd = DateTime(d.year, d.month, d.day);
    if (!dd.isAfter(today)) return 'overdue';
    if (dd.difference(today).inDays == 1) return 'tonight';
    return 'ok';
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(approvedOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Schedule'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(approvedOrdersProvider))],
      ),
      body: orders.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('Nothing approved waiting to go out.'));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(approvedOrdersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final o = list[i];
                final busy = _busyId == o.id;
                final dl = _deadline(o.deliveryDate);
                final overdue = dl == 'overdue';
                final tonight = dl == 'tonight';
                return Card(
                  clipBehavior: Clip.antiAlias,
                  shape: overdue
                      ? RoundedRectangleBorder(
                          side: const BorderSide(color: Colors.red, width: 1.5),
                          borderRadius: BorderRadius.circular(12),
                        )
                      : null,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (overdue || tonight)
                        Container(
                          width: double.infinity,
                          color: overdue ? Colors.red : Colors.orange.shade800,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          child: Text(
                            overdue
                                ? 'OVERDUE · should already be ready for delivery — mark it now.'
                                : 'Due tonight · mark ready by 23:59 (delivery is tomorrow).',
                            style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(o.shopName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            Text('for ${o.deliveryDate}', style: const TextStyle(fontSize: 12)),
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
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            icon: const Icon(Icons.local_shipping_outlined, size: 18),
                            label: Text(busy ? '…' : 'Mark ready for delivery'),
                            onPressed: busy ? null : () => _markReady(o),
                          ),
                        ),
                      ],
                    ),
                  ),
                    ],
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
