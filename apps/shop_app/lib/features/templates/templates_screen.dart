import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/supabase_provider.dart';
import '../request/request_providers.dart';

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
  /// Load the template's available items into the New Request cart so the orderer
  /// can edit quantities / add items / pick the date, then submit from there.
  Future<void> _useInRequest(OrderTemplate t) async {
    final available = t.items.where((i) => i.available && i.productId != null).toList();
    if (available.isEmpty) {
      _toast('All items in this template are unavailable.');
      return;
    }
    final List<Product> products;
    try {
      products = await ref.read(catalogProvider.future);
    } catch (e) {
      _toast('Could not load the catalog: $e');
      return;
    }
    final byId = {for (final p in products) p.id: p};
    final notifier = ref.read(cartProvider.notifier);
    notifier.clear();
    var added = 0;
    for (final it in available) {
      final p = byId[it.productId];
      if (p == null) continue; // not in the current catalog (86'd / RLS-hidden)
      notifier.setLine(p, it.qty.toInt(), {}, null);
      added++;
    }
    if (!mounted) return;
    if (added == 0) {
      notifier.clear();
      _toast('None of these items are available to order right now.');
      return;
    }
    final skipped = t.items.length - added;
    _toast('Loaded "${t.name}"${skipped > 0 ? ' · $skipped item(s) skipped' : ''} — edit and submit.');
    context.go('/request');
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
                                icon: const Icon(Icons.edit_note, size: 18),
                                label: const Text('Edit in New Request'),
                                onPressed: () => _useInRequest(t),
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
