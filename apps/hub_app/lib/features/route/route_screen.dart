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
  // 15-day delivery window (up to today+14), all pipeline statuses from approval
  // onward — mirrors the web courier manifest so the courier can plan ahead. The
  // courier RLS already permits these statuses (migrations 0026 + 0028); if the
  // live DB predates 0028, the 'specialist_approved' rows just won't appear.
  final end = DateTime.now().add(const Duration(days: 14));
  final endStr = '${end.year}-${end.month.toString().padLeft(2, '0')}-${end.day.toString().padLeft(2, '0')}';
  final rows = await supabase
      .from('orders')
      .select(
        'id, status, requested_delivery_date, shops(name, address), '
        'order_items(quantity, unit, products(name))',
      )
      .inFilter('status',
          ['specialist_approved', 'in_progress', 'packaged', 'ready_for_courier', 'in_transit', 'delivered'])
      .lte('requested_delivery_date', endStr)
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

  String _statusLabel(String s) {
    switch (s) {
      case 'in_transit':
        return 'In transit';
      case 'ready_for_courier':
        return 'Ready';
      case 'delivered':
        return 'Delivered';
      case 'packaged':
        return 'Packaged';
      case 'in_progress':
        return 'In production';
      default:
        return 'Approved';
    }
  }

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

  static const _wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const _mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  String _ymd(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String _dayLabel(String dateStr, DateTime today) {
    final p = dateStr.split('-');
    if (p.length != 3) return dateStr;
    final d = DateTime.utc(int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
    final t = DateTime.utc(today.year, today.month, today.day);
    final diff = d.difference(t).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Tomorrow';
    return '${_wd[d.weekday - 1]} ${d.day} ${_mo[d.month - 1]}';
  }

  /// Group deliveries by day — Overdue, Today, Tomorrow, then dated — like the web manifest.
  List<Widget> _buildSections(List<RouteOrder> list) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final todayStr = _ymd(today);
    final overdue = <RouteOrder>[];
    final byDate = <String, List<RouteOrder>>{};
    for (final o in list) {
      if (o.deliveryDate.compareTo(todayStr) < 0 && o.status != 'delivered') {
        overdue.add(o);
      } else {
        (byDate[o.deliveryDate] ??= <RouteOrder>[]).add(o);
      }
    }
    final dates = byDate.keys.toList()..sort();
    final out = <Widget>[];
    if (overdue.isNotEmpty) {
      out.add(_sectionHeader('Overdue', overdue.length, overdue: true));
      out.addAll(overdue.map(_card));
    }
    for (final ds in dates) {
      final group = byDate[ds]!;
      out.add(_sectionHeader(_dayLabel(ds, today), group.length));
      out.addAll(group.map(_card));
    }
    return out;
  }

  Widget _sectionHeader(String label, int count, {bool overdue = false}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: overdue ? Colors.red : null),
          ),
          const SizedBox(width: 8),
          Text('$count', style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _card(RouteOrder o) {
    final busy = _busyId == o.id;
    final inTransit = o.status == 'in_transit';
    final canStart = o.status == 'ready_for_courier';
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
                Text(_statusLabel(o.status), style: const TextStyle(fontSize: 12)),
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
                  : canStart
                      ? FilledButton.icon(
                          icon: const Icon(Icons.local_shipping, size: 18),
                          label: Text(busy ? '…' : 'Start delivery'),
                          onPressed: busy ? null : () => _advance(o, 'in_transit', 'Delivery started'),
                        )
                      : Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            o.status == 'delivered'
                                ? 'Delivered'
                                : 'Scheduled — waiting for the hub to mark it ready',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
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
          if (list.isEmpty) return const Center(child: Text('No deliveries in the next 15 days.'));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(routeOrdersProvider),
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: _buildSections(list),
            ),
          );
        },
      ),
    );
  }
}
