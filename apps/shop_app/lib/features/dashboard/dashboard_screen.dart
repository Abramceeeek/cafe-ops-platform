import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
      body: const Center(
        child: Text('Welcome to the Shop App!\n\nYou have successfully logged in as a Shop Manager.'),
      ),
    );
  }
}
