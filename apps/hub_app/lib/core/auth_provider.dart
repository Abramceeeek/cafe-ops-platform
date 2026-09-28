import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_constants/shared_constants.dart';
import 'supabase_provider.dart';

final authStateProvider = StreamProvider<AuthState>((ref) {
  final supabase = ref.watch(supabaseProvider);
  return supabase.auth.onAuthStateChange;
});

final currentUserProvider = Provider<User?>((ref) {
  final authState = ref.watch(authStateProvider).value;
  return authState?.session?.user ?? ref.watch(supabaseProvider).auth.currentUser;
});

final currentUserRoleProvider = FutureProvider<UserRole?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;

  final supabase = ref.watch(supabaseProvider);
  final response = await supabase
      .from(AppConstants.profilesTable)
      .select('role, is_active')
      .eq('id', user.id)
      .single();

  // RLS treats an inactive profile as having no role (every list comes back empty),
  // so the app does too: the router's role guard signs it out.
  if (response['is_active'] == false) return null;
  return UserRole.fromString(response['role'] as String);
});
