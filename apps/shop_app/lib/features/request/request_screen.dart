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
    // 10:00 London cut-off: order before it → next-day delivery; at/after → the day
    // after. Uniform for every item (per-item lead time no longer extends the floor).
    final cutoffPassed = _londonHour(nowUtc) >= 10;
    return DateTime.utc(nowUtc.year, nowUtc.month, nowUtc.day)
        .add(Duration(days: cutoffPassed ? 2 : 1));
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
    if (picked != null && mounted) setState(() => _date = picked);
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
        'p_items': cart.map((l) => {
              'product_id': l.product.id,
              'quantity': l.qty,
              if (l.note != null && l.note!.isNotEmpty) 'custom_note': l.note,
              if (l.modList.isNotEmpty)
                'modifiers': l.modList
                    .map((m) => {
                          'modifier_option_id': m.optionId,
                          'modifier_group_name': m.groupName,
                          'modifier_option_name': m.optionName,
                        })
                    .toList(),
            }).toList(),
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

  // Monday of next ISO week — when a new standing order takes effect.
  String _nextMonday() {
    final n = DateTime.now();
    final today = DateTime(n.year, n.month, n.day);
    return _fmt(today.add(Duration(days: 8 - today.weekday)));
  }

  // Save the current cart as a recurring standing order for a chosen weekday.
  Future<void> _saveAsStanding() async {
    final cart = ref.read(cartProvider);
    if (cart.isEmpty) {
      _toast('Add items first.');
      return;
    }
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final weekday = await showDialog<int>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Save as standing order'),
        children: [
          for (var i = 0; i < days.length; i++)
            SimpleDialogOption(onPressed: () => Navigator.pop(ctx, i + 1), child: Text('Every ${days[i]}')),
        ],
      ),
    );
    if (weekday == null) return;
    try {
      await ref.read(supabaseProvider).rpc('save_standing_order', params: {
        'p_weekday': weekday,
        'p_effective_from': _nextMonday(),
        'p_items': cart
            .map((l) => {
                  'product_id': l.product.id,
                  'quantity': l.qty,
                  if (l.note != null && l.note!.isNotEmpty) 'custom_note': l.note,
                  if (l.modList.isNotEmpty)
                    'modifiers': l.modList.map((m) => {'modifier_option_id': m.optionId}).toList(),
                })
            .toList(),
      });
      _toast('Saved as a standing order — starts next week.');
    } catch (e) {
      _toast('Save failed: $e');
    }
  }

  Future<void> _openOptions(Product p) async {
    CartLine? existing;
    for (final l in ref.read(cartProvider)) {
      if (l.product.id == p.id) existing = l;
    }
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _OptionsSheet(product: p, existing: existing),
    );
    if (result == null) return;
    ref.read(cartProvider.notifier).setLine(
          p,
          result['qty'] as int,
          (result['mods'] as Map<String, SelectedMod>),
          result['note'] as String?,
        );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final cart = ref.watch(cartProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Request'),
        actions: [
          IconButton(
            icon: const Icon(Icons.event_repeat),
            tooltip: 'Save as standing order',
            onPressed: cart.isEmpty ? null : _saveAsStanding,
          ),
        ],
      ),
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
                    CartLine? line;
                    for (final l in cart) {
                      if (l.product.id == p.id) line = l;
                    }
                    final qty = line?.qty ?? 0;
                    final hasMods = p.modifierGroups.isNotEmpty;
                    final modSummary = line?.modList.map((m) => m.optionName).join(' · ') ?? '';
                    return ListTile(
                      title: Text(p.name),
                      subtitle: Text(
                        '${p.categoryName} · per ${p.unit}'
                        '${p.price != null ? ' · £${p.price!.toStringAsFixed(2)}' : ''}'
                        '${modSummary.isNotEmpty ? '\n$modSummary' : ''}'
                        '${(line?.note?.isNotEmpty ?? false) ? '\n“${line!.note}”' : ''}',
                      ),
                      isThreeLine: modSummary.isNotEmpty || (line?.note?.isNotEmpty ?? false),
                      trailing: hasMods
                          ? (qty == 0
                              ? IconButton(
                                  icon: const Icon(Icons.tune),
                                  tooltip: 'Choose options',
                                  onPressed: () => _openOptions(p),
                                )
                              : Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.tune),
                                      tooltip: 'Edit options',
                                      onPressed: () => _openOptions(p),
                                    ),
                                    Text('$qty'),
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline),
                                      onPressed: () => ref.read(cartProvider.notifier).setQty(p.id, 0),
                                    ),
                                  ],
                                ))
                          : (qty == 0
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
                                )),
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

/// Bottom sheet to pick one option per modifier group (required groups must be
/// chosen), set a quantity, and add a note. Returns {qty, mods, note}.
class _OptionsSheet extends StatefulWidget {
  final Product product;
  final CartLine? existing;
  const _OptionsSheet({required this.product, this.existing});
  @override
  State<_OptionsSheet> createState() => _OptionsSheetState();
}

class _OptionsSheetState extends State<_OptionsSheet> {
  late final Map<String, SelectedMod> _selected;
  late int _qty;
  late final TextEditingController _note;

  @override
  void initState() {
    super.initState();
    _selected = Map<String, SelectedMod>.from(widget.existing?.mods ?? {});
    _qty = widget.existing?.qty ?? 1;
    _note = TextEditingController(text: widget.existing?.note ?? '');
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  bool get _requiredMet =>
      widget.product.modifierGroups.where((g) => g.isRequired).every((g) => _selected.containsKey(g.id));

  void _confirm() {
    if (!_requiredMet) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Choose the required options first.')));
      return;
    }
    Navigator.pop(context, {'qty': _qty, 'mods': _selected, 'note': _note.text.trim()});
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 8),
            for (final g in p.modifierGroups) ...[
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 4),
                child: Text(
                  g.isRequired ? '${g.name} *' : g.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: g.options.map((o) {
                  final sel = _selected[g.id]?.optionId == o.id;
                  return ChoiceChip(
                    label: Text(o.name),
                    selected: sel,
                    onSelected: (v) => setState(() {
                      if (v) {
                        _selected[g.id] = SelectedMod(o.id, g.name, o.name);
                      } else {
                        _selected.remove(g.id);
                      }
                    }),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _note,
              decoration: const InputDecoration(labelText: 'Note (optional)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('Quantity'),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline),
                  onPressed: _qty > 1 ? () => setState(() => _qty -= 1) : null,
                ),
                Text('$_qty', style: const TextStyle(fontSize: 16)),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline),
                  onPressed: () => setState(() => _qty += 1),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (widget.existing != null)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context, {'qty': 0, 'mods': <String, SelectedMod>{}, 'note': null}),
                      child: const Text('Remove'),
                    ),
                  ),
                if (widget.existing != null) const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(onPressed: _confirm, child: const Text('Done')),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
