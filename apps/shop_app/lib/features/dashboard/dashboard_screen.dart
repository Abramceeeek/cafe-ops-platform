import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/supabase_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shop Dashboard'),
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
            const Text('Welcome to the Shop App!'),
            const SizedBox(height: 24),
            FilledButton.icon(
              icon: const Icon(Icons.add_shopping_cart),
              label: const Text('New Request'),
              onPressed: () => context.go('/request'),
            ),
          ],
        ),
      ),
    );
  }
}
