import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/supabase_provider.dart';

/// A product the shop can order. RLS scopes the catalog to the role's categories
/// (FOH -> Pastry/Retail), so we just read `products`.
class Product {
  final String id;
  final String name;
  final String unit;
  final num leadTimeHours;
  final num? price;
  final String categoryName;
  Product({
    required this.id,
    required this.name,
    required this.unit,
    required this.leadTimeHours,
    required this.price,
    required this.categoryName,
  });
}

final catalogProvider = FutureProvider<List<Product>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  final rows = await supabase
      .from('products')
      .select('id,name,unit,lead_time_hours,price,is_available,product_categories(name,assigned_role)')
      .eq('is_available', true)
      .order('name');
  return (rows as List).map((r) {
    final cat = r['product_categories'] as Map<String, dynamic>?;
    return Product(
      id: r['id'] as String,
      name: r['name'] as String,
      unit: (r['unit'] ?? 'unit') as String,
      leadTimeHours: (r['lead_time_hours'] ?? 24) as num,
      price: r['price'] as num?,
      categoryName: (cat?['name'] ?? 'Other') as String,
    );
  }).toList();
});

class CartLine {
  final Product product;
  int qty;
  CartLine(this.product, this.qty);
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
