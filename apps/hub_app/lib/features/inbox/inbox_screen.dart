import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import 'inbox_providers.dart';

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});
  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  String? _busyId;
  // Per-line amendments, keyed by order_item id (ids are unique across orders).
  final Map<String, num> _edits = {};
  final Map<String, bool> _removed = {};

  void _toast(String m) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  String _fmtQty(num q) => q % 1 == 0 ? q.toInt().toString() : q.toString();

  Future<void> _approve(PendingOrder o) async {
    // Collect amendments: changed quantities + removed lines.
    final edits = <Map<String, dynamic>>[];
    final removed = <String>[];
    for (final it in o.items) {
      if (_removed[it.id] == true) {
        removed.add(it.id);
        continue;
      }
      final q = _edits[it.id] ?? it.qty;
      if (q != it.qty) edits.add({'id': it.id, 'quantity': q});
    }
    if (removed.length == o.items.length) {
      _toast('Keep at least one item, or reject the order instead.');
      return;
    }
    setState(() => _busyId = o.id);
    try {
      await ref.read(supabaseProvider).rpc('specialist_review', params: {
        'p_order_id': o.id,
        'p_approve': true,
        'p_item_edits': edits,
        'p_removed_item_ids': removed,
      });
      _toast(edits.isEmpty && removed.isEmpty ? 'Approved' : 'Approved with changes');
      for (final it in o.items) {
        _edits.remove(it.id);
        _removed.remove(it.id);
      }
      ref.invalidate(pendingOrdersProvider);
    } catch (e) {
      _toast('Failed: $e');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _reject(PendingOrder o) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject request'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 2,
          decoration: const InputDecoration(hintText: 'Reason (so the shop knows why)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Reject')),
        ],
      ),
    );
    if (reason == null) return;
    if (reason.isEmpty) {
      _toast('Add a short reason so the shop knows why.');
      return;
    }
    setState(() => _busyId = o.id);
    try {
      await ref.read(supabaseProvider).rpc('specialist_review', params: {
        'p_order_id': o.id,
        'p_approve': false,
        'p_reason': reason,
      });
      _toast('Rejected');
      ref.invalidate(pendingOrdersProvider);
    } catch (e) {
      _toast('Failed: $e');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = ref.watch(pendingOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inbox'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(pendingOrdersProvider),
          ),
        ],
      ),
      body: pending.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (orders) {
          if (orders.isEmpty) {
            return const Center(child: Text('No pending requests — all clear.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(pendingOrdersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: orders.length,
              itemBuilder: (_, i) {
                final o = orders[i];
                final busy = _busyId == o.id;
                return Card(
                  clipBehavior: Clip.antiAlias,
                  shape: o.isEmergency
                      ? RoundedRectangleBorder(
                          side: const BorderSide(color: Colors.red, width: 1.5),
                          borderRadius: BorderRadius.circular(12),
                        )
                      : null,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (o.isEmergency)
                        Container(
                          width: double.infinity,
                          color: Colors.red,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          child: const Text(
                            'EMERGENCY · placed after the cut-off — confirm with the shop before approving.',
                            style: TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
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
                            const SizedBox(height: 4),
                            const Text(
                              'Adjust quantities or remove a line before approving.',
                              style: TextStyle(fontSize: 11.5, color: Colors.grey),
                            ),
                            const SizedBox(height: 8),
                            ...o.items.map((it) {
                              final removed = _removed[it.id] == true;
                              final q = _edits[it.id] ?? it.qty;
                              final changed = !removed && q != it.qty;
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        it.name,
                                        style: removed
                                            ? const TextStyle(
                                                decoration: TextDecoration.lineThrough, color: Colors.grey)
                                            : null,
                                      ),
                                    ),
                                    if (removed)
                                      TextButton(
                                        onPressed: busy ? null : () => setState(() => _removed[it.id] = false),
                                        child: const Text('Undo'),
                                      )
                                    else ...[
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        icon: const Icon(Icons.remove_circle_outline, size: 20),
                                        onPressed:
                                            busy || q <= 1 ? null : () => setState(() => _edits[it.id] = q - 1),
                                      ),
                                      Text(
                                        '${_fmtQty(q)} ${it.unit}',
                                        style: TextStyle(
                                          fontWeight: changed ? FontWeight.bold : FontWeight.normal,
                                          color: changed ? Theme.of(context).colorScheme.primary : null,
                                        ),
                                      ),
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        icon: const Icon(Icons.add_circle_outline, size: 20),
                                        onPressed: busy ? null : () => setState(() => _edits[it.id] = q + 1),
                                      ),
                                      IconButton(
                                        visualDensity: VisualDensity.compact,
                                        icon: const Icon(Icons.close, size: 18),
                                        tooltip: 'Remove line',
                                        onPressed: busy ? null : () => setState(() => _removed[it.id] = true),
                                      ),
                                    ],
                                  ],
                                ),
                              );
                            }),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                OutlinedButton(
                                  onPressed: busy ? null : () => _reject(o),
                                  child: const Text('Reject'),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: busy ? null : () => _approve(o),
                                    child: Text(busy ? '…' : 'Approve'),
                                  ),
                                ),
                              ],
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
