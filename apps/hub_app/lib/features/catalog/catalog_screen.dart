import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';
import '../../core/auth_provider.dart';

class CatProduct {
  final String id;
  final String name;
  final String unit;
  final num leadTimeHours;
  final num? price;
  final bool isAvailable;
  final String categoryId;
  final bool isArchived;
  final String? unavailableNote;
  CatProduct({
    required this.id,
    required this.name,
    required this.unit,
    required this.leadTimeHours,
    required this.price,
    required this.isAvailable,
    required this.categoryId,
    required this.isArchived,
    required this.unavailableNote,
  });
}

class CatCategory {
  final String id;
  final String name;
  final List<CatProduct> products;
  final List<CatProduct> archived;
  CatCategory(this.id, this.name, this.products, this.archived);
}

/// Categories assigned to the current specialist + their products. RLS scopes
/// writes to these same categories (migration 0030). Mirrors the web Catalog.
final catalogManageProvider = FutureProvider<List<CatCategory>>((ref) async {
  final sb = ref.watch(supabaseProvider);
  final role = ref.watch(currentUserRoleProvider).value?.value;
  final cats = await sb.from('product_categories').select('id, name, assigned_role').order('display_order');
  final prods = await sb
      .from('products')
      .select('id, name, unit, lead_time_hours, is_available, category_id, price, archived_at, unavailable_note')
      .order('name');
  final mine = (cats as List).where((c) => c['assigned_role'] == role).toList();
  return mine.map((c) {
    final cid = c['id'] as String;
    final items = (prods as List).where((p) => p['category_id'] == cid).map((p) {
      return CatProduct(
        id: p['id'] as String,
        name: (p['name'] ?? '') as String,
        unit: (p['unit'] ?? '') as String,
        leadTimeHours: (p['lead_time_hours'] ?? 24) as num,
        price: p['price'] as num?,
        isAvailable: p['is_available'] == true,
        categoryId: cid,
        isArchived: p['archived_at'] != null,
        unavailableNote: p['unavailable_note'] as String?,
      );
    }).toList();
    return CatCategory(
      cid,
      (c['name'] ?? '') as String,
      items.where((p) => !p.isArchived).toList(),
      items.where((p) => p.isArchived).toList(),
    );
  }).toList();
});

class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  Future<void> _toast(BuildContext context, String msg) async {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _toggle86(BuildContext context, WidgetRef ref, CatProduct p) async {
    try {
      await ref.read(supabaseProvider).from('products').update({'is_available': !p.isAvailable}).eq('id', p.id);
      if (!context.mounted) return;
      ref.invalidate(catalogManageProvider);
      _toast(context, p.isAvailable ? '${p.name} marked out of stock' : '${p.name} restored');
    } catch (e) {
      if (context.mounted) _toast(context, 'Failed: $e');
    }
  }

  /// A product that has ever been ordered cannot be removed from the table (order
  /// history references it), so archive_product deletes the never-ordered ones and
  /// archives the rest, clearing both out of standing orders and templates. Order
  /// history is never touched.
  Future<void> _delete(BuildContext context, WidgetRef ref, CatProduct p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete product?'),
        content: Text('"${p.name}" disappears from the catalog and from every shop\'s '
            'ordering list. Past orders keep it.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final res = await ref.read(supabaseProvider).rpc('archive_product', params: {'p_product_id': p.id});
      if (!context.mounted) return;
      ref.invalidate(catalogManageProvider);
      final map = (res as Map?) ?? const {};
      final orders = (map['order_items'] ?? 0) as num;
      _toast(
        context,
        map['action'] == 'deleted'
            ? '${p.name} deleted'
            : '${p.name} archived — kept on $orders past order line${orders == 1 ? '' : 's'}',
      );
    } catch (e) {
      if (context.mounted) _toast(context, 'Failed: $e');
    }
  }

  Future<void> _restore(BuildContext context, WidgetRef ref, CatProduct p) async {
    try {
      await ref.read(supabaseProvider).rpc('restore_product', params: {'p_product_id': p.id});
      if (!context.mounted) return;
      ref.invalidate(catalogManageProvider);
      _toast(context, '${p.name} restored — available to order again');
    } catch (e) {
      if (context.mounted) _toast(context, 'Failed: $e');
    }
  }

  Future<void> _edit(BuildContext context, WidgetRef ref, CatProduct p, List<CatCategory> cats) async {
    final values = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _ProductDialog(title: 'Edit product', initial: p, categories: cats),
    );
    if (values == null) return;
    try {
      // Only the categories assigned to this specialist are offered, and the
      // products UPDATE policy (0030) refuses anything else anyway.
      await ref.read(supabaseProvider).from('products').update({
        'name': values['name'],
        'unit': values['unit'],
        'lead_time_hours': values['lead'],
        'price': values['price'],
        'category_id': values['category_id'],
        'unavailable_note': values['note'],
      }).eq('id', p.id);
      if (!context.mounted) return;
      ref.invalidate(catalogManageProvider);
      _toast(context, 'Saved');
    } catch (e) {
      if (context.mounted) _toast(context, 'Failed: $e');
    }
  }

  Future<void> _add(BuildContext context, WidgetRef ref, List<CatCategory> cats) async {
    if (cats.isEmpty) {
      _toast(context, 'No category assigned to you.');
      return;
    }
    final values = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _ProductDialog(title: 'Add product', categories: cats),
    );
    if (values == null) return;
    try {
      await ref.read(supabaseProvider).from('products').insert({
        'name': values['name'],
        'category_id': values['category_id'],
        'unit': values['unit'],
        'lead_time_hours': values['lead'],
        'price': values['price'],
        'unavailable_note': values['note'],
      });
      if (!context.mounted) return;
      ref.invalidate(catalogManageProvider);
      _toast(context, 'Product added');
    } catch (e) {
      if (context.mounted) _toast(context, 'Failed: $e');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogManageProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Catalog'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(catalogManageProvider))],
      ),
      floatingActionButton: catalog.maybeWhen(
        data: (cats) => FloatingActionButton.extended(
          onPressed: () => _add(context, ref, cats),
          icon: const Icon(Icons.add),
          label: const Text('Product'),
        ),
        orElse: () => null,
      ),
      body: catalog.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (cats) {
          if (cats.isEmpty) return const Center(child: Text('No category assigned to you.'));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(catalogManageProvider),
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                for (final c in cats)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${c.name}  ·  ${c.products.length} product${c.products.length == 1 ? '' : 's'}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          const Divider(),
                          if (c.products.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Text('No products in this category.', style: TextStyle(color: Colors.grey)),
                            ),
                          for (final p in c.products)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(p.name),
                              subtitle: Text(
                                '${p.price != null ? '£${p.price!.toStringAsFixed(2)}' : 'no price'} · per ${p.unit} · ${p.leadTimeHours}h'
                                '${p.isAvailable ? '' : ' · OUT OF STOCK'}',
                                style: TextStyle(color: p.isAvailable ? null : Colors.red),
                              ),
                              trailing: PopupMenuButton<String>(
                                onSelected: (v) {
                                  if (v == 'edit') _edit(context, ref, p, cats);
                                  if (v == '86') _toggle86(context, ref, p);
                                  if (v == 'delete') _delete(context, ref, p);
                                },
                                itemBuilder: (_) => [
                                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                  PopupMenuItem(value: '86', child: Text(p.isAvailable ? 'Mark out of stock' : 'Restore')),
                                  const PopupMenuItem(value: 'delete', child: Text('Delete')),
                                ],
                              ),
                            ),
                          if (c.archived.isNotEmpty)
                            ExpansionTile(
                              tilePadding: EdgeInsets.zero,
                              title: Text('Archived (${c.archived.length})',
                                  style: const TextStyle(fontSize: 14, color: Colors.grey)),
                              subtitle: const Text('Off the ordering list, still on past orders.',
                                  style: TextStyle(fontSize: 12, color: Colors.grey)),
                              children: [
                                for (final p in c.archived)
                                  ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(p.name),
                                    subtitle: Text(
                                      '${p.price != null ? '£${p.price!.toStringAsFixed(2)}' : 'no price'} · per ${p.unit} · ${p.leadTimeHours}h',
                                    ),
                                    trailing: TextButton(
                                      onPressed: () => _restore(context, ref, p),
                                      child: const Text('Restore'),
                                    ),
                                  ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Add/Edit product form. Returns {name, unit, lead, price, note, category_id?} or null.
class _ProductDialog extends StatefulWidget {
  final String title;
  final CatProduct? initial;
  final List<CatCategory>? categories;
  const _ProductDialog({required this.title, this.initial, this.categories});
  @override
  State<_ProductDialog> createState() => _ProductDialogState();
}

class _ProductDialogState extends State<_ProductDialog> {
  late final TextEditingController _name;
  late final TextEditingController _unit;
  late final TextEditingController _lead;
  late final TextEditingController _price;
  late final TextEditingController _note;
  String? _categoryId;

  @override
  void initState() {
    super.initState();
    final p = widget.initial;
    _name = TextEditingController(text: p?.name ?? '');
    _unit = TextEditingController(text: p?.unit ?? 'kg');
    _lead = TextEditingController(text: (p?.leadTimeHours ?? 24).toString());
    _price = TextEditingController(text: p?.price != null ? p!.price.toString() : '');
    _note = TextEditingController(text: p?.unavailableNote ?? '');
    _categoryId = p?.categoryId ??
        (widget.categories != null && widget.categories!.isNotEmpty ? widget.categories!.first.id : null);
  }

  @override
  void dispose() {
    _name.dispose();
    _unit.dispose();
    _lead.dispose();
    _price.dispose();
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _name.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Name required')));
      return;
    }
    final priceText = _price.text.trim();
    Navigator.pop(context, {
      'name': name,
      'unit': _unit.text.trim().isEmpty ? 'unit' : _unit.text.trim(),
      'lead': int.tryParse(_lead.text.trim()) ?? 24,
      'price': priceText.isEmpty ? null : num.tryParse(priceText),
      'note': _note.text.trim().isEmpty ? null : _note.text.trim(),
      if (widget.categories != null) 'category_id': _categoryId,
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.categories != null)
              DropdownButtonFormField<String>(
                initialValue: _categoryId,
                decoration: const InputDecoration(labelText: 'Category'),
                items: widget.categories!
                    .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                    .toList(),
                onChanged: (v) => setState(() => _categoryId = v),
              ),
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
            TextField(controller: _unit, decoration: const InputDecoration(labelText: 'Unit (kg, loaf, unit…)')),
            TextField(
              controller: _lead,
              decoration: const InputDecoration(labelText: 'Lead time (hours)'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: _price,
              decoration: const InputDecoration(labelText: 'Price (£)', hintText: '0.00'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            TextField(
              controller: _note,
              decoration: const InputDecoration(
                labelText: 'Out-of-stock note',
                hintText: 'Shown to shops when this is off',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _submit, child: const Text('Save')),
      ],
    );
  }
}
