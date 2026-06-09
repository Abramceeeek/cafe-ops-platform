import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import '../../core/supabase_provider.dart';
import '../../core/auth_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentUserRoleProvider).value;
    final isCourier = role == UserRole.courier;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Hub Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              ref.read(supabaseProvider).auth.signOut();
            },
          )
        ],
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Welcome to the Hub App!'),
            const SizedBox(height: 24),
            if (isCourier)
              FilledButton.icon(
                icon: const Icon(Icons.local_shipping),
                label: const Text('Route'),
                onPressed: () => context.go('/route'),
              )
            else ...[
              FilledButton.icon(
                icon: const Icon(Icons.inbox),
                label: const Text('Inbox'),
                onPressed: () => context.go('/inbox'),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                icon: const Icon(Icons.calendar_today),
                label: const Text('Schedule'),
                onPressed: () => context.go('/schedule'),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                icon: const Icon(Icons.inventory_2_outlined),
                label: const Text('Catalog'),
                onPressed: () => context.go('/catalog'),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton.icon(
              icon: const Icon(Icons.person_outline),
              label: const Text('Account'),
              onPressed: () => context.go('/account'),
            ),
          ],
        ),
      ),
    );
  }
}
