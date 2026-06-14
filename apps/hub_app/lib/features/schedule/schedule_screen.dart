import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../../core/auth_provider.dart';
import '../../core/realtime.dart';
import '../../core/print_sheet.dart';
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

/// All of one shop's approved orders for a single delivery day, merged into one
/// card. Orders are split per category/submission, so a shop can have several;
/// the specialist sees and acts on them as one delivery for that shop+day.
class _SchedGroup {
  final String shopName;
  final String deliveryDate;
  bool isEmergency = false;
  final List<String> orderIds = [];
  final Map<String, PendingItem> _merged = {};

  _SchedGroup(this.shopName, this.deliveryDate);

  String get key => '$deliveryDate|$shopName';
  List<PendingItem> get items => _merged.values.toList();

  void add(PendingOrder o) {
    orderIds.add(o.id);
    if (o.isEmergency) isEmergency = true;
    for (final it in o.items) {
      final k = '${it.name}|${it.unit}';
      final ex = _merged[k];
      _merged[k] = ex == null
          ? PendingItem(it.id, it.name, it.qty, it.unit)
          : PendingItem(ex.id, ex.name, ex.qty + it.qty, ex.unit);
    }
  }
}

List<_SchedGroup> _groupByShopDay(List<PendingOrder> list) {
  final groups = <String, _SchedGroup>{};
  for (final o in list) {
    final key = '${o.deliveryDate}|${o.shopName}';
    (groups[key] ??= _SchedGroup(o.shopName, o.deliveryDate)).add(o);
  }
  final out = groups.values.toList()
    ..sort((a, b) {
      final byDate = a.deliveryDate.compareTo(b.deliveryDate);
      return byDate != 0 ? byDate : a.shopName.compareTo(b.shopName);
    });
  return out;
}

class ScheduleScreen extends ConsumerStatefulWidget {
  const ScheduleScreen({super.key});
  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  String? _busyKey;

  Future<void> _markReady(_SchedGroup g) async {
    setState(() => _busyKey = g.key);
    try {
      for (final id in g.orderIds) {
        await ref.read(supabaseProvider).rpc('change_order_status', params: {
          'p_order_id': id,
          'p_to': 'ready_for_courier',
        });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ready for delivery')));
      ref.invalidate(approvedOrdersProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busyKey = null);
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
        actions: [
          IconButton(
            icon: const Icon(Icons.print_outlined),
            tooltip: 'Print sheet',
            onPressed: () {
              final groups = _groupByShopDay(ref.read(approvedOrdersProvider).value ?? []);
              printSheet(
                heading: 'Production / Delivery Sheet',
                subtitle: 'Approved orders waiting to go out',
                blocks: groups
                    .map((g) => PrintBlock(
                          title: g.shopName,
                          meta: 'for ${g.deliveryDate}${g.isEmergency ? ' · EMERGENCY' : ''}',
                          lines: g.items.map((it) => PrintLine(it.name, '${it.qty} ${it.unit}')).toList(),
                        ))
                    .toList(),
              );
            },
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(approvedOrdersProvider)),
        ],
      ),
      body: orders.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('Nothing approved waiting to go out.'));
          final groups = _groupByShopDay(list);
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(approvedOrdersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: groups.length,
              itemBuilder: (_, i) {
                final g = groups[i];
                final busy = _busyKey == g.key;
                final dl = _deadline(g.deliveryDate);
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
                                Expanded(
                                  child: Row(
                                    children: [
                                      Flexible(
                                        child: Text(g.shopName,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                      ),
                                      if (g.isEmergency)
                                        const Padding(
                                          padding: EdgeInsets.only(left: 6),
                                          child: Text('EMERGENCY',
                                              style: TextStyle(
                                                  color: Colors.red, fontSize: 10.5, fontWeight: FontWeight.bold)),
                                        ),
                                    ],
                                  ),
                                ),
                                Text('for ${g.deliveryDate}', style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                            if (g.orderIds.length > 1)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text('${g.orderIds.length} orders combined',
                                    style: const TextStyle(fontSize: 11.5, color: Colors.grey)),
                              ),
                            const SizedBox(height: 8),
                            ...g.items.map((it) => Padding(
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
                                onPressed: busy ? null : () => _markReady(g),
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
