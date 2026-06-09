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

  void _toast(String m) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _approve(PendingOrder o) async {
    setState(() => _busyId = o.id);
    try {
      await ref.read(supabaseProvider).rpc('specialist_review', params: {
        'p_order_id': o.id,
        'p_approve': true,
      });
      _toast('Approved');
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
                            const SizedBox(height: 8),
                            ...o.items.map((it) => Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 2),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(child: Text(it.name)),
                                      Text('${it.qty} ${it.unit}'),
                                    ],
                                  ),
                                )),
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
