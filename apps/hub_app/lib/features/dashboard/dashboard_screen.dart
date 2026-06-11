import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import 'package:shared_ui/shared_ui.dart';
import '../../core/supabase_provider.dart';
import '../../core/auth_provider.dart';
import '../inbox/inbox_providers.dart';

/// Hub home — specialists see awaiting-approval stats + recent requests;
/// couriers get a quick route entry. Matches the web hub dashboard.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentUserRoleProvider).value;
    final isCourier = role == UserRole.courier;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          if (!isCourier)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(pendingOrdersProvider),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(supabaseProvider).auth.signOut(),
          ),
        ],
      ),
      body: isCourier ? const _CourierHome() : const _SpecialistHome(),
    );
  }
}

class _CourierHome extends StatelessWidget {
  const _CourierHome();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return ContentWidth(
      maxWidth: 720,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Deliveries', style: t.textTheme.headlineSmall),
            const SizedBox(height: 12),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Your route', style: t.textTheme.titleLarge),
                  const SizedBox(height: 6),
                  Text(
                    'Open the route to pick up ready orders and confirm deliveries.',
                    style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    icon: const Icon(Icons.local_shipping),
                    label: const Text('Open route'),
                    onPressed: () => context.go('/route'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpecialistHome extends ConsumerWidget {
  const _SpecialistHome();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingOrdersProvider);
    final t = Theme.of(context);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(pendingOrdersProvider),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ContentWidth(
            child: pending.when(
              loading: () => const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.only(top: 48),
                child: Center(child: Text('Failed to load:\n$e', textAlign: TextAlign.center)),
              ),
              data: (orders) {
                final emergencies = orders.where((o) => o.isEmergency).length;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Today at a glance', style: t.textTheme.headlineSmall),
                    const SizedBox(height: 16),
                    GridView.count(
                      crossAxisCount: context.isWide ? 3 : 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.7,
                      children: [
                        _StatCard(label: 'Awaiting approval', value: orders.length),
                        _StatCard(label: 'Emergencies', value: emergencies),
                      ],
                    ),
                    const SizedBox(height: 28),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Pending requests', style: t.textTheme.titleLarge),
                        TextButton(onPressed: () => context.go('/inbox'), child: const Text('Open inbox')),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (orders.isEmpty)
                      const AppCard(
                        child: SizedBox(
                          height: 64,
                          child: Center(child: Text('No pending requests — all clear.')),
                        ),
                      )
                    else
                      ...orders.take(6).map((o) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _PendingRow(order: o),
                          )),
                  ],
                );
              },
            ),
          ),
        ],
      ),
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

class _PendingRow extends StatelessWidget {
  final PendingOrder order;
  const _PendingRow({required this.order});

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
                Row(
                  children: [
                    Flexible(child: Text(order.shopName, style: t.textTheme.titleMedium, overflow: TextOverflow.ellipsis)),
                    if (order.isEmergency) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: t.colorScheme.error,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text('EMERGENCY',
                            style: TextStyle(color: t.colorScheme.onError, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text('for ${order.deliveryDate} · $summary',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          const OrderStatusBadge(status: 'pending_request'),
        ],
      ),
    );
  }
}
