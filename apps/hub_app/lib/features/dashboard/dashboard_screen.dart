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
            FilledButton.icon(
              icon: const Icon(Icons.inbox),
              label: const Text('Inbox'),
              onPressed: () => context.go('/inbox'),
            ),
          ],
        ),
      ),
    );
  }
}
