import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_ui/shared_ui.dart';
import '../../core/supabase_provider.dart';
import '../orders/orders_screen.dart' show shopOrdersProvider, ShopOrder;

/// Shop home — stat cards + recent orders, matching the web FOH dashboard.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  static const _activeStatuses = {
    'pending_request',
    'specialist_approved',
    'shop_confirmed',
    'in_progress',
    'packaged',
    'ready_for_courier',
    'in_transit',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(shopOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(shopOrdersProvider),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(supabaseProvider).auth.signOut(),
          ),
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
        data: (orders) {
          final active = orders.where((o) => _activeStatuses.contains(o.status)).length;
          final inTransit = orders.where((o) => o.status == 'in_transit').length;
          final delivered = orders.where((o) => o.status == 'delivered').length;
          final declined = orders.where((o) => o.status == 'rejected').length;
          final recent = orders.take(6).toList();
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(shopOrdersProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ContentWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Today at a glance', style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 16),
                      _StatGrid(stats: [
                        ('Active orders', active),
                        ('Out for delivery', inTransit),
                        ('Delivered', delivered),
                        ('Declined', declined),
                      ]),
                      const SizedBox(height: 28),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Recent orders', style: Theme.of(context).textTheme.titleLarge),
                          TextButton(onPressed: () => context.go('/orders'), child: const Text('View all')),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (recent.isEmpty)
                        const AppCard(
                          child: SizedBox(
                            height: 64,
                            child: Center(child: Text('No orders yet.')),
                          ),
                        )
                      else
                        ...recent.map((o) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _OrderRow(order: o),
                            )),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        icon: const Icon(Icons.add_shopping_cart),
                        label: const Text('New request'),
                        onPressed: () => context.go('/request'),
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
  }
}

class _StatGrid extends StatelessWidget {
  final List<(String, int)> stats;
  const _StatGrid({required this.stats});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: context.isWide ? 4 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.7,
      children: [for (final s in stats) _StatCard(label: s.$1, value: s.$2)],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final int value;
  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AppCard(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$value', style: t.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label, style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}

class _OrderRow extends StatelessWidget {
  final ShopOrder order;
  const _OrderRow({required this.order});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final summary = order.items.isEmpty ? '—' : order.items.map((i) => i.name).take(3).join(', ');
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('for ${order.deliveryDate}', style: t.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  summary,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          OrderStatusBadge(status: order.status),
        ],
      ),
    );
  }
}
