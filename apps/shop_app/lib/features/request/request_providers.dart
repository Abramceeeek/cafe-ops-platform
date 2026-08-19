import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';

class ModOption {
  final String id;
  final String name;
  ModOption(this.id, this.name);
}

class ModGroup {
  final String id;
  final String name;
  final bool isRequired;
  final List<ModOption> options;
  ModGroup(this.id, this.name, this.isRequired, this.options);
}

/// A product the shop can order. RLS scopes the catalog to the role's categories
/// (FOH -> Pastry/Retail), so we just read `products`.
class Product {
  final String id;
  final String name;
  final String unit;
  final num leadTimeHours;
  final num? price;
  final String categoryName;
  final List<ModGroup> modifierGroups;
  Product({
    required this.id,
    required this.name,
    required this.unit,
    required this.leadTimeHours,
    required this.price,
    required this.categoryName,
    required this.modifierGroups,
  });
}

final catalogProvider = FutureProvider<List<Product>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  final rows = await supabase
      .from('products')
      .select('id,name,unit,lead_time_hours,price,is_available,'
          'product_categories(name,assigned_role),'
          'modifier_groups(id,name,is_required,display_order,modifier_options(id,name,display_order))')
      .eq('is_available', true)
      .isFilter('archived_at', null)
      .order('name');
  return (rows as List).map((r) {
    final cat = r['product_categories'] as Map<String, dynamic>?;
    final groups = ((r['modifier_groups'] as List?) ?? []).map((g) {
      final gm = g as Map<String, dynamic>;
      final opts = ((gm['modifier_options'] as List?) ?? []).map((o) {
        final om = o as Map<String, dynamic>;
        return ModOption(om['id'] as String, (om['name'] ?? '') as String);
      }).toList();
      return ModGroup(gm['id'] as String, (gm['name'] ?? '') as String, gm['is_required'] == true, opts);
    }).toList();
    return Product(
      id: r['id'] as String,
      name: r['name'] as String,
      unit: (r['unit'] ?? 'unit') as String,
      leadTimeHours: (r['lead_time_hours'] ?? 24) as num,
      price: r['price'] as num?,
      categoryName: (cat?['name'] ?? 'Other') as String,
      modifierGroups: groups,
    );
  }).toList();
});

/// One chosen modifier option, carrying the names the submit RPC stores.
class SelectedMod {
  final String optionId;
  final String groupName;
  final String optionName;
  SelectedMod(this.optionId, this.groupName, this.optionName);
}

class CartLine {
  final Product product;
  int qty;
  String? note;
  // group id -> chosen option for that group
  final Map<String, SelectedMod> mods;
  CartLine(this.product, this.qty, {this.note, Map<String, SelectedMod>? mods}) : mods = mods ?? {};

  List<SelectedMod> get modList => mods.values.toList();
}

class CartNotifier extends StateNotifier<List<CartLine>> {
  CartNotifier() : super([]);

  void add(Product p) {
    final i = state.indexWhere((l) => l.product.id == p.id);
    if (i >= 0) {
      state[i].qty += 1;
      state = [...state];
    } else {
      state = [...state, CartLine(p, 1)];
    }
  }

  /// Add (or replace) a line with chosen modifiers + note. Keyed by product id —
  /// one modifier combination per product per request (mirrors the simple flow).
  void setLine(Product p, int qty, Map<String, SelectedMod> mods, String? note) {
    final i = state.indexWhere((l) => l.product.id == p.id);
    if (qty <= 0) {
      state = state.where((l) => l.product.id != p.id).toList();
      return;
    }
    final line = CartLine(p, qty, note: note, mods: mods);
    if (i >= 0) {
      final next = [...state];
      next[i] = line;
      state = next;
    } else {
      state = [...state, line];
    }
  }

  void setQty(String id, int qty) {
    if (qty <= 0) {
      state = state.where((l) => l.product.id != id).toList();
    } else {
      state = state.map((l) => l.product.id == id ? (l..qty = qty) : l).toList();
    }
  }

  int qtyOf(String id) {
    for (final l in state) {
      if (l.product.id == id) return l.qty;
    }
    return 0;
  }

  num get maxLead =>
      state.fold<num>(0, (m, l) => l.product.leadTimeHours > m ? l.product.leadTimeHours : m);

  void clear() => state = [];
}

final cartProvider = StateNotifierProvider<CartNotifier, List<CartLine>>((ref) => CartNotifier());
