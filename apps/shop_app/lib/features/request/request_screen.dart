import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import 'request_providers.dart';

class RequestScreen extends ConsumerStatefulWidget {
  const RequestScreen({super.key});
  @override
  ConsumerState<RequestScreen> createState() => _RequestScreenState();
}

class _RequestScreenState extends ConsumerState<RequestScreen> {
  DateTime? _date;
  bool _submitting = false;

  // London hour (BST late-Mar..late-Oct = UTC+1), mirroring the server.
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

  bool get _isEmergency {
    if (_date == null) return false;
    final maxLead = ref.read(cartProvider.notifier).maxLead;
    final e = _earliest(maxLead);
    final d = DateTime.utc(_date!.year, _date!.month, _date!.day);
    return d.isBefore(e);
  }

  String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Allow today + tomorrow (flagged as emergency below) — not blocked outright.
    final picked = await showDatePicker(
      context: context,
      initialDate: today,
      firstDate: today,
      lastDate: today.add(const Duration(days: 30)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    final cart = ref.read(cartProvider);
    if (cart.isEmpty) {
      _toast('Cart is empty.');
      return;
    }
    if (_date == null) {
      _toast('Pick a delivery date.');
      return;
    }
    if (_isEmergency) {
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
    await _doSubmit(emergency: _isEmergency);
  }

  Future<void> _doSubmit({required bool emergency}) async {
    setState(() => _submitting = true);
    try {
      final cart = ref.read(cartProvider);
      final res = await ref.read(supabaseProvider).rpc('submit_request', params: {
        'p_requested_delivery_date': _fmt(_date!),
        'p_items': cart.map((l) => {'product_id': l.product.id, 'quantity': l.qty}).toList(),
        'p_is_emergency': emergency,
        'p_idempotency_key': null,
      });
      final data = res as Map<String, dynamic>?;
      final n = (data?['order_ids'] as List?)?.length ?? 0;
      ref.read(cartProvider.notifier).clear();
      setState(() => _date = null);
      _toast(emergency ? 'Emergency order submitted — $n order(s).' : 'Request submitted — $n order(s).');
    } catch (e) {
      _toast('Submit failed: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final cart = ref.watch(cartProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('New Request')),
      body: Column(
        children: [
          Expanded(
            child: catalog.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Failed to load catalog:\n$e', textAlign: TextAlign.center)),
              data: (products) {
                if (products.isEmpty) {
                  return const Center(child: Text('No products available.'));
                }
                return ListView.separated(
                  itemCount: products.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final p = products[i];
                    final qty = cart
                        .firstWhere((l) => l.product.id == p.id, orElse: () => CartLine(p, 0))
                        .qty;
                    return ListTile(
                      title: Text(p.name),
                      subtitle: Text(
                        '${p.categoryName} · per ${p.unit}'
                        '${p.price != null ? ' · £${p.price!.toStringAsFixed(2)}' : ''}',
                      ),
                      trailing: qty == 0
                          ? IconButton(
                              icon: const Icon(Icons.add_circle_outline),
                              onPressed: () => ref.read(cartProvider.notifier).add(p),
                            )
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline),
                                  onPressed: () => ref.read(cartProvider.notifier).setQty(p.id, qty - 1),
                                ),
                                Text('$qty'),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline),
                                  onPressed: () => ref.read(cartProvider.notifier).setQty(p.id, qty + 1),
                                ),
                              ],
                            ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.calendar_today, size: 18),
                          label: Text(_date == null ? 'Delivery date' : _fmt(_date!)),
                          onPressed: _pickDate,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('${cart.length} line${cart.length == 1 ? '' : 's'}'),
                    ],
                  ),
                  if (_isEmergency)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Before the cut-off — this will be an emergency order.',
                          style: TextStyle(color: Colors.red, fontSize: 12),
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting || cart.isEmpty ? null : _submit,
                      child: Text(_submitting ? 'Submitting…' : 'Submit Request to Hub'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
