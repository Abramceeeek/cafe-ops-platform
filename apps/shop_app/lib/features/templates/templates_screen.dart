import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';

class TemplateItem {
  final String id;
  final num qty;
  final String? name; // null when the product is 86'd / hidden by RLS
  final String? productId;
  final String unit;
  final num leadTimeHours;
  final bool available;
  TemplateItem({
    required this.id,
    required this.qty,
    required this.name,
    required this.productId,
    required this.unit,
    required this.leadTimeHours,
    required this.available,
  });
}

class OrderTemplate {
  final String id;
  final String name;
  final List<TemplateItem> items;
  OrderTemplate({required this.id, required this.name, required this.items});

  int get unavailable => items.where((i) => !i.available).length;
  num get maxLead =>
      items.where((i) => i.available).fold<num>(0, (m, i) => i.leadTimeHours > m ? i.leadTimeHours : m);
}

/// Saved carts for this manager's role. Mirrors the web Templates page.
final templatesProvider = FutureProvider<List<OrderTemplate>>((ref) async {
  final sb = ref.watch(supabaseProvider);
  final rows = await sb.from('order_templates').select(
        'id, name, '
        'order_template_items(id, quantity, products(id, name, unit, lead_time_hours, is_available))',
      ).order('created_at', ascending: false);
  return (rows as List).map((r) {
    final items = (r['order_template_items'] as List?) ?? [];
    return OrderTemplate(
      id: r['id'] as String,
      name: (r['name'] ?? '') as String,
      items: items.map((it) {
        final m = it as Map<String, dynamic>;
        final p = m['products'] as Map<String, dynamic>?;
        final available = p != null && p['is_available'] == true;
        return TemplateItem(
          id: m['id'] as String,
          qty: (m['quantity'] as num?) ?? 0,
          name: p?['name'] as String?,
          productId: p?['id'] as String?,
          unit: (p?['unit'] ?? '') as String,
          leadTimeHours: (p?['lead_time_hours'] ?? 24) as num,
          available: available,
        );
      }).toList(),
    );
  }).toList();
});

class TemplatesScreen extends ConsumerStatefulWidget {
  const TemplatesScreen({super.key});
  @override
  ConsumerState<TemplatesScreen> createState() => _TemplatesScreenState();
}

class _TemplatesScreenState extends ConsumerState<TemplatesScreen> {
  // London hour (BST late-Mar..late-Oct = UTC+1), mirroring the server + request screen.
  int _londonHour(DateTime nowUtc) {
    final y = nowUtc.year;
    DateTime lastSunday(int month) {
      var d = DateTime.utc(y, month + 1, 1).subtract(const Duration(days: 1));
      return d.subtract(Duration(days: d.weekday % 7));
    }
    final bst = nowUtc.isAfter(lastSunday(3).add(const Duration(hours: 1))) &&
        nowUtc.isBefore(lastSunday(10).add(const Duration(hours: 1)));
    return (nowUtc.hour + (bst ? 1 : 0)) % 24;
  }

  DateTime _earliest(num maxLead) {
    final nowUtc = DateTime.now().toUtc();
    final cutoffPassed = _londonHour(nowUtc) >= 16;
    final leadDays = (maxLead / 24).ceil().clamp(1, 365);
    return DateTime.utc(nowUtc.year, nowUtc.month, nowUtc.day)
        .add(Duration(days: leadDays + (cutoffPassed ? 1 : 0)));
  }

  String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _orderNow(OrderTemplate t) async {
    final available = t.items.where((i) => i.available).toList();
    if (available.isEmpty) {
      _toast('All items in this template are unavailable.');
      return;
    }
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: today,
      firstDate: today,
      lastDate: today.add(const Duration(days: 30)),
    );
    if (picked == null || !mounted) return;

    final earliest = _earliest(t.maxLead);
    final d = DateTime.utc(picked.year, picked.month, picked.day);
    final emergency = d.isBefore(earliest);

    if (emergency) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Emergency order'),
          content: const Text(
            "This is before the cut-off — an emergency order with a high chance of not being approved. "
            "Re-check with the specialist before submitting.",
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Submit emergency order'),
            ),
          ],
        ),
      );
      if (ok != true) return;
    }

    try {
      final res = await ref.read(supabaseProvider).rpc('submit_request', params: {
        'p_requested_delivery_date': _fmt(picked),
        'p_items': available.map((i) => {'product_id': i.productId, 'quantity': i.qty}).toList(),
        'p_is_emergency': emergency,
        'p_idempotency_key': null,
      });
      final data = res as Map<String, dynamic>?;
      final n = (data?['order_ids'] as List?)?.length ?? 0;
      final excluded = t.items.length - available.length;
      var msg = emergency ? 'Emergency order submitted — $n order(s).' : 'Request submitted — $n order(s).';
      if (excluded > 0) msg += ' $excluded unavailable item(s) excluded.';
      _toast(msg);
    } catch (e) {
      _toast('Submit failed: $e');
    }
  }

  Future<void> _delete(OrderTemplate t) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete template?'),
        content: Text('Delete "${t.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(supabaseProvider).from('order_templates').delete().eq('id', t.id);
      if (!mounted) return;
      ref.invalidate(templatesProvider);
      _toast('Template deleted.');
    } catch (e) {
      _toast('Delete failed: $e');
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final templates = ref.watch(templatesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Templates'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(templatesProvider)),
        ],
      ),
      body: templates.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('No templates yet — save one from New Request.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(templatesProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final t = list[i];
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
                              child: Text(t.name,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                            ),
                            Text('${t.items.length} item${t.items.length == 1 ? '' : 's'}',
                                style: const TextStyle(fontSize: 12, color: Colors.grey)),
                          ],
                        ),
                        const Divider(height: 16),
                        ...t.items.map((it) {
                          final unit = it.unit.isEmpty ? '' : ' ${it.unit}';
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    it.available ? (it.name ?? 'Item') : 'Unavailable item',
                                    style: TextStyle(
                                      decoration: it.available ? null : TextDecoration.lineThrough,
                                      color: it.available ? null : Colors.grey,
                                      fontStyle: it.available ? null : FontStyle.italic,
                                    ),
                                  ),
                                ),
                                Text('${it.qty}$unit'),
                              ],
                            ),
                          );
                        }),
                        if (t.unavailable > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              '${t.unavailable} item${t.unavailable == 1 ? '' : 's'} currently unavailable — excluded on order.',
                              style: const TextStyle(fontSize: 12, color: Colors.orange),
                            ),
                          ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton.icon(
                                icon: const Icon(Icons.send, size: 18),
                                label: const Text('Order Now'),
                                onPressed: () => _orderNow(t),
                              ),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              onPressed: () => _delete(t),
                              child: const Icon(Icons.delete_outline, size: 20),
                            ),
                          ],
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
