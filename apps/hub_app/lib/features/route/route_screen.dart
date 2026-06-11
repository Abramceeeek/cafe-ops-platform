import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../../core/realtime.dart';
import '../../core/print_sheet.dart';

class RouteItem {
  final String name;
  final num qty;
  final String unit;
  RouteItem(this.name, this.qty, this.unit);
}

class RouteOrder {
  final String id;
  final String shopName;
  final String? address;
  final String status;
  final String deliveryDate;
  final List<RouteItem> items;
  RouteOrder({
    required this.id,
    required this.shopName,
    required this.address,
    required this.status,
    required this.deliveryDate,
    required this.items,
  });
}

/// Orders on the courier's route — anything ready or already out for delivery.
final routeOrdersProvider = FutureProvider<List<RouteOrder>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  ref.watch(ordersTickProvider); // live re-fetch on any orders change (this app or web)
  final rows = await supabase
      .from('orders')
      .select(
        'id, status, requested_delivery_date, shops(name, address), '
        'order_items(quantity, unit, products(name))',
      )
      .inFilter('status', ['ready_for_courier', 'in_transit'])
      .order('requested_delivery_date');
  return (rows as List).map((r) {
    final items = (r['order_items'] as List?) ?? [];
    return RouteOrder(
      id: r['id'] as String,
      shopName: (r['shops']?['name'] ?? 'Shop') as String,
      address: r['shops']?['address'] as String?,
      status: r['status'] as String,
      deliveryDate: (r['requested_delivery_date'] ?? '') as String,
      items: items.map((i) {
        final m = i as Map<String, dynamic>;
        return RouteItem((m['products']?['name'] ?? 'Item') as String, (m['quantity'] as num?) ?? 0, (m['unit'] ?? '') as String);
      }).toList(),
    );
  }).toList();
});

class CourierRouteScreen extends ConsumerStatefulWidget {
  const CourierRouteScreen({super.key});
  @override
  ConsumerState<CourierRouteScreen> createState() => _CourierRouteScreenState();
}

class _CourierRouteScreenState extends ConsumerState<CourierRouteScreen> {
  String? _busyId;

  Future<void> _advance(RouteOrder o, String to, String okMsg) async {
    setState(() => _busyId = o.id);
    try {
      await ref.read(supabaseProvider).rpc('change_order_status', params: {
        'p_order_id': o.id,
        'p_to': to,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(okMsg)));
      ref.invalidate(routeOrdersProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(routeOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Route'),
        actions: [
          IconButton(
            icon: const Icon(Icons.print_outlined),
            tooltip: 'Print route',
            onPressed: () {
              final list = ref.read(routeOrdersProvider).value ?? [];
              printSheet(
                heading: 'Delivery Route',
                subtitle: 'Ready & out-for-delivery',
                blocks: list
                    .map((o) => PrintBlock(
                          title: o.shopName,
                          meta: '${o.status == 'in_transit' ? 'In transit' : 'Ready'} · for ${o.deliveryDate}',
                          address: o.address,
                          lines: o.items.map((it) => PrintLine(it.name, '${it.qty} ${it.unit}')).toList(),
                        ))
                    .toList(),
              );
            },
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(routeOrdersProvider)),
        ],
      ),
      body: orders.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('No deliveries right now.'));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(routeOrdersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final o = list[i];
                final busy = _busyId == o.id;
                final inTransit = o.status == 'in_transit';
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(o.shopName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            Text(inTransit ? 'In transit' : 'Ready', style: const TextStyle(fontSize: 12)),
                          ],
                        ),
                        if (o.address != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(o.address!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
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
                          child: inTransit
                              ? FilledButton.icon(
                                  icon: const Icon(Icons.check, size: 18),
                                  label: Text(busy ? '…' : 'Confirm delivered'),
                                  onPressed: busy ? null : () => _advance(o, 'delivered', 'Delivered'),
                                )
                              : FilledButton.icon(
                                  icon: const Icon(Icons.local_shipping, size: 18),
                                  label: Text(busy ? '…' : 'Start delivery'),
                                  onPressed: busy ? null : () => _advance(o, 'in_transit', 'Delivery started'),
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
