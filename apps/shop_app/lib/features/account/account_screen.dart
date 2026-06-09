import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_constants/shared_constants.dart';
import '../../core/supabase_provider.dart';
import '../../core/theme_mode_provider.dart';

class AccountProfile {
  final String name;
  final String role;
  final String shopName;
  final String email;
  AccountProfile(this.name, this.role, this.shopName, this.email);
}

final accountProfileProvider = FutureProvider<AccountProfile>((ref) async {
  final sb = ref.watch(supabaseProvider);
  final user = sb.auth.currentUser;
  final p = await sb
      .from('profiles')
      .select('full_name, role, shops(name)')
      .eq('id', user?.id ?? '')
      .single();
  return AccountProfile(
    (p['full_name'] ?? '') as String,
    (p['role'] ?? '') as String,
    (p['shops']?['name'] ?? '') as String,
    user?.email ?? '',
  );
});

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2);
  return parts.map((w) => w[0].toUpperCase()).join();
}

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(accountProfileProvider);
    final mode = ref.watch(themeModeProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          profile.when(
            loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load profile:\n$e'),
            data: (p) => Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(radius: 24, child: Text(_initials(p.name), style: const TextStyle(fontWeight: FontWeight.bold))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            roleLabel(p.role) + (p.shopName.isNotEmpty ? ' · ${p.shopName}' : ''),
                            style: const TextStyle(color: Colors.grey),
                          ),
                          if (p.email.isNotEmpty)
                            Text(p.email, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Appearance', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(value: ThemeMode.system, label: Text('System'), icon: Icon(Icons.brightness_auto)),
                      ButtonSegment(value: ThemeMode.light, label: Text('Light'), icon: Icon(Icons.light_mode)),
                      ButtonSegment(value: ThemeMode.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode)),
                    ],
                    selected: {mode},
                    onSelectionChanged: (s) => ref.read(themeModeProvider.notifier).state = s.first,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('Sign out'),
              onPressed: () => ref.read(supabaseProvider).auth.signOut(),
            ),
          ),
        ],
      ),
    );
  }
}
