import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../../core/realtime.dart';
import '../../core/print_sheet.dart';

class RouteItem {
  final String name;
  final num qty;
  final String unit;
  final String catName;
  RouteItem(this.name, this.qty, this.unit, {this.catName = ''});
}

// Pastry first, then bread, then anything else (matches the schedule + web print).
int _catRank(String name) {
  final n = name.toLowerCase();
  if (n.contains('pastry') || n.contains('retail')) return 0;
  if (n.contains('bread')) return 1;
  return 2;
}

// First line of each category group carries a sub-header.
List<PrintLine> _routeLines(List<RouteItem> items) {
  final sorted = [...items]..sort((a, b) {
      final r = _catRank(a.catName).compareTo(_catRank(b.catName));
      return r != 0 ? r : a.name.compareTo(b.name);
    });
  var last = -1;
  final out = <PrintLine>[];
  for (final it in sorted) {
    final r = _catRank(it.catName);
    out.add(PrintLine(it.name, '${it.qty} ${it.unit}', subhead: r != last ? it.catName : null));
    last = r;
  }
  return out;
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
        'order_items(quantity, unit, products(name, product_categories(name)))',
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
        return RouteItem(
          (m['products']?['name'] ?? 'Item') as String,
          (m['quantity'] as num?) ?? 0,
          (m['unit'] ?? '') as String,
          catName: (m['products']?['product_categories']?['name'] ?? '') as String,
        );
      }).toList(),
    );
  }).toList();
});

/// One shop's deliveries for a single day, merged into one stop. A shop can have
/// several orders (split per category/submission) in mixed states; the courier
/// acts on the whole stop — "Start delivery" moves the ready ones out, "Confirm
/// delivered" closes the in-transit ones, and anything still in production waits.
class _ShopGroup {
  final String shopName;
  final String? address;
  final String deliveryDate;
  final List<String> readyIds = [];
  final List<String> inTransitIds = [];
  final List<String> productionIds = []; // specialist_approved / in_progress / packaged
  final List<String> deliveredIds = [];
  final Map<String, RouteItem> _merged = {};

  _ShopGroup(this.shopName, this.address, this.deliveryDate);

  String get key => '$deliveryDate|$shopName';
  List<RouteItem> get items => _merged.values.toList();
  bool get hasUndelivered =>
      readyIds.isNotEmpty || inTransitIds.isNotEmpty || productionIds.isNotEmpty;
  bool get allDelivered => !hasUndelivered && deliveredIds.isNotEmpty;

  void add(RouteOrder o) {
    switch (o.status) {
      case 'ready_for_courier':
        readyIds.add(o.id);
        break;
      case 'in_transit':
        inTransitIds.add(o.id);
        break;
      case 'delivered':
        deliveredIds.add(o.id);
        break;
      default: // specialist_approved / in_progress / packaged
        productionIds.add(o.id);
    }
    for (final it in o.items) {
      final k = '${it.name}|${it.unit}';
      final ex = _merged[k];
      _merged[k] = ex == null
          ? RouteItem(it.name, it.qty, it.unit, catName: it.catName)
          : RouteItem(ex.name, ex.qty + it.qty, ex.unit, catName: ex.catName);
    }
  }

  String get statusSummary {
    final parts = <String>[];
    if (inTransitIds.isNotEmpty) parts.add('${inTransitIds.length} in transit');
    if (readyIds.isNotEmpty) parts.add('${readyIds.length} ready');
    if (productionIds.isNotEmpty) parts.add('${productionIds.length} in production');
    if (deliveredIds.isNotEmpty) parts.add('${deliveredIds.length} delivered');
    return parts.join(' · ');
  }
}

List<_ShopGroup> _groupByDayShop(List<RouteOrder> list) {
  final groups = <String, _ShopGroup>{};
  for (final o in list) {
    final key = '${o.deliveryDate}|${o.shopName}';
    (groups[key] ??= _ShopGroup(o.shopName, o.address, o.deliveryDate)).add(o);
  }
  return groups.values.toList();
}

class CourierRouteScreen extends ConsumerStatefulWidget {
  const CourierRouteScreen({super.key});
  @override
  ConsumerState<CourierRouteScreen> createState() => _CourierRouteScreenState();
}

class _CourierRouteScreenState extends ConsumerState<CourierRouteScreen> {
  String? _busyKey;

  Future<void> _advance(_ShopGroup g, List<String> ids, String to, String okMsg) async {
    setState(() => _busyKey = g.key);
    try {
      for (final id in ids) {
        await ref.read(supabaseProvider).rpc('change_order_status', params: {
          'p_order_id': id,
          'p_to': to,
        });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(okMsg)));
      ref.invalidate(routeOrdersProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _busyKey = null);
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

  /// Group deliveries by day (Overdue, Today, Tomorrow, then dated), then by shop
  /// within each day — one card per shop stop, like the web manifest.
  List<Widget> _buildSections(List<RouteOrder> list) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final todayStr = _ymd(today);
    final overdue = <_ShopGroup>[];
    final byDate = <String, List<_ShopGroup>>{};
    for (final g in _groupByDayShop(list)) {
      if (g.deliveryDate.compareTo(todayStr) < 0 && g.hasUndelivered) {
        overdue.add(g);
      } else {
        (byDate[g.deliveryDate] ??= <_ShopGroup>[]).add(g);
      }
    }
    final dates = byDate.keys.toList()..sort();
    final out = <Widget>[];
    if (overdue.isNotEmpty) {
      overdue.sort((a, b) {
        final byDateCmp = a.deliveryDate.compareTo(b.deliveryDate);
        return byDateCmp != 0 ? byDateCmp : a.shopName.compareTo(b.shopName);
      });
      out.add(_sectionHeader('Overdue', overdue.length, overdue: true));
      out.addAll(overdue.map(_card));
    }
    for (final ds in dates) {
      final group = byDate[ds]!..sort((a, b) => a.shopName.compareTo(b.shopName));
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

  Widget _card(_ShopGroup g) {
    final busy = _busyKey == g.key;
    final canStart = g.readyIds.isNotEmpty;
    final canDeliver = g.inTransitIds.isNotEmpty;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(g.shopName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
                Text(g.statusSummary, style: const TextStyle(fontSize: 12)),
              ],
            ),
            if (g.address != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(g.address!, style: const TextStyle(fontSize: 12, color: Colors.grey)),
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
            if (canDeliver)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.check, size: 18),
                  label: Text(busy ? '…' : 'Confirm delivered'),
                  onPressed: busy ? null : () => _advance(g, g.inTransitIds, 'delivered', 'Delivered'),
                ),
              ),
            if (canDeliver && canStart) const SizedBox(height: 8),
            if (canStart)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.local_shipping, size: 18),
                  label: Text(busy ? '…' : 'Start delivery'),
                  onPressed: busy ? null : () => _advance(g, g.readyIds, 'in_transit', 'Delivery started'),
                ),
              ),
            if (!canDeliver && !canStart)
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  g.allDelivered ? 'Delivered' : 'Scheduled — waiting for the hub to mark it ready',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
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
              final groups = _groupByDayShop(ref.read(routeOrdersProvider).value ?? []);
              final totalMap = <String, RouteItem>{};
              for (final g in groups) {
                for (final it in g.items) {
                  final k = '${it.name}|${it.unit}';
                  final ex = totalMap[k];
                  totalMap[k] = ex == null ? it : RouteItem(ex.name, ex.qty + it.qty, ex.unit, catName: ex.catName);
                }
              }
              printSheet(
                heading: 'Delivery Route',
                subtitle: 'Ready & out-for-delivery, grouped by shop',
                blocks: groups
                    .map((g) => PrintBlock(
                          title: g.shopName,
                          meta: '${g.statusSummary} · for ${g.deliveryDate}',
                          address: g.address,
                          lines: _routeLines(g.items),
                        ))
                    .toList(),
                perShopPages: true,
                totals: _routeLines(totalMap.values.toList()),
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
