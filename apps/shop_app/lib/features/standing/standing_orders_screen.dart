import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../request/request_providers.dart';

class StandingItem {
  final String productId;
  final num qty;
  final String? name; // null when 86'd / hidden by RLS
  final String unit;
  final String catName;
  StandingItem({required this.productId, required this.qty, required this.name, required this.unit, required this.catName});
}

class StandingOrder {
  final String id;
  final int weekday; // ISO 1=Mon..7=Sun
  final String effectiveFrom; // YYYY-MM-DD
  final List<StandingItem> items;
  StandingOrder({required this.id, required this.weekday, required this.effectiveFrom, required this.items});
}

const _weekdays = [
  (1, 'Monday'),
  (2, 'Tuesday'),
  (3, 'Wednesday'),
  (4, 'Thursday'),
  (5, 'Friday'),
  (6, 'Saturday'),
  (7, 'Sunday'),
];

String _todayIso() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
}

// Monday of next ISO week — when an edit takes effect (current week stays locked).
String _nextMondayIso() {
  final n = DateTime.now();
  final today = DateTime(n.year, n.month, n.day);
  final d = today.add(Duration(days: 8 - today.weekday)); // weekday 1..7
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

/// The shop's recurring standing orders (this manager's role, via RLS).
final standingOrdersProvider = FutureProvider<List<StandingOrder>>((ref) async {
  final sb = ref.watch(supabaseProvider);
  final rows = await sb.from('standing_orders').select(
        'id, weekday, effective_from, '
        'standing_order_items(product_id, quantity, products(name, unit, product_categories(name)))',
      ).order('effective_from', ascending: false).order('created_at', ascending: false);
  return (rows as List).map((r) {
    final items = (r['standing_order_items'] as List?) ?? [];
    return StandingOrder(
      id: r['id'] as String,
      weekday: (r['weekday'] as num).toInt(),
      effectiveFrom: (r['effective_from'] ?? '') as String,
      items: items.map((it) {
        final m = it as Map<String, dynamic>;
        final p = m['products'] as Map<String, dynamic>?;
        return StandingItem(
          productId: (m['product_id'] ?? '') as String,
          qty: (m['quantity'] as num?) ?? 0,
          name: p?['name'] as String?,
          unit: (p?['unit'] ?? '') as String,
          catName: (p?['product_categories']?['name'] ?? '') as String,
        );
      }).toList(),
    );
  }).toList();
});

class StandingOrdersScreen extends ConsumerWidget {
  const StandingOrdersScreen({super.key});

  // current = latest version effective on/before today; next = latest future version.
  (StandingOrder?, StandingOrder?) _forWeekday(List<StandingOrder> all, int wd) {
    final today = _todayIso();
    StandingOrder? cur, next;
    for (final so in all.where((s) => s.weekday == wd)) {
      if (so.effectiveFrom.compareTo(today) <= 0) {
        cur ??= so;
      } else {
        next ??= so;
      }
    }
    return (cur, next);
  }

  Future<void> _remove(BuildContext context, WidgetRef ref, int weekday) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove standing order?'),
        content: const Text('It will stop generating from next week.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(supabaseProvider).from('standing_orders').delete().eq('weekday', weekday);
      ref.invalidate(standingOrdersProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Standing order removed.')));
      }
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _edit(BuildContext context, WidgetRef ref, int weekday, String label, StandingOrder? seed) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _StandingEditor(weekday: weekday, label: label, seed: seed, hasCurrent: seed != null),
      ),
    );
    if (saved == true) ref.invalidate(standingOrdersProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final standing = ref.watch(standingOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Standing Orders'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(standingOrdersProvider)),
        ],
      ),
      body: standing.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (all) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(standingOrdersProvider),
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(4, 0, 4, 8),
                child: Text(
                  'Your recurring weekly order — sent to the Hub automatically, no approval needed. '
                  'Edits take effect next week; this week is locked. For a one-off change, use New Request.',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey),
                ),
              ),
              for (final (wd, label) in _weekdays) _weekdayCard(context, ref, all, wd, label),
            ],
          ),
        ),
      ),
    );
  }

  Widget _weekdayCard(BuildContext context, WidgetRef ref, List<StandingOrder> all, int wd, String label) {
    final (cur, next) = _forWeekday(all, wd);
    final items = cur?.items ?? const <StandingItem>[];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                if (cur != null)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    tooltip: 'Remove',
                    onPressed: () => _remove(context, ref, wd),
                  ),
              ],
            ),
            if (items.isEmpty)
              const Text('No standing order', style: TextStyle(color: Colors.grey, fontSize: 13))
            else
              ...items.map((i) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(i.name ?? 'Unavailable item')),
                        Text('${i.qty} ${i.unit}'),
                      ],
                    ),
                  )),
            if (next != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Changes pending — ${next.items.length} item${next.items.length == 1 ? '' : 's'} from next week.',
                  style: const TextStyle(fontSize: 12, color: Colors.orange),
                ),
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: Icon(cur != null ? Icons.edit : Icons.add, size: 18),
                label: Text(cur != null ? 'Edit for next week' : 'Add standing order'),
                onPressed: () => _edit(context, ref, wd, label, next ?? cur),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full-screen editor: pick quantities per product for a weekday. Saves a new
/// version (effective next Monday if one already exists, else immediately).
class _StandingEditor extends ConsumerStatefulWidget {
  final int weekday;
  final String label;
  final StandingOrder? seed;
  final bool hasCurrent;
  const _StandingEditor({required this.weekday, required this.label, required this.seed, required this.hasCurrent});
  @override
  ConsumerState<_StandingEditor> createState() => _StandingEditorState();
}

class _StandingEditorState extends ConsumerState<_StandingEditor> {
  final Map<String, int> _qty = {}; // product_id -> quantity
  bool _saving = false;
  bool _seeded = false;

  void _seedFrom(List<Product> products) {
    if (_seeded || widget.seed == null) {
      _seeded = true;
      return;
    }
    // Seed by product_id (stable; immune to duplicate/renamed product names).
    final available = {for (final p in products) p.id};
    for (final i in widget.seed!.items) {
      if (available.contains(i.productId)) _qty[i.productId] = i.qty.toInt();
    }
    _seeded = true;
  }

  Future<void> _save() async {
    final items = _qty.entries.where((e) => e.value > 0).map((e) => {'product_id': e.key, 'quantity': e.value}).toList();
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Add at least one item.')));
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(supabaseProvider).rpc('save_standing_order', params: {
        'p_weekday': widget.weekday,
        'p_effective_from': widget.hasCurrent ? _nextMondayIso() : _todayIso(),
        'p_items': items,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.hasCurrent ? 'Saved — takes effect next week.' : 'Standing order created.')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Save failed: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final count = _qty.values.where((v) => v > 0).length;
    return Scaffold(
      appBar: AppBar(title: Text('${widget.label} standing order')),
      body: catalog.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load catalog:\n$e', textAlign: TextAlign.center)),
        data: (products) {
          _seedFrom(products);
          return ListView.separated(
            itemCount: products.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final p = products[i];
              final qty = _qty[p.id] ?? 0;
              return ListTile(
                title: Text(p.name),
                subtitle: Text('${p.categoryName} · per ${p.unit}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed: qty <= 0 ? null : () => setState(() => _qty[p.id] = qty - 1),
                    ),
                    Text('$qty'),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: () => setState(() => _qty[p.id] = qty + 1),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: FilledButton(
            onPressed: _saving || count == 0 ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save ($count item${count == 1 ? '' : 's'})'),
          ),
        ),
      ),
    );
  }
}
