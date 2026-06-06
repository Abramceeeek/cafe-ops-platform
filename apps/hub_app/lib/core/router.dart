import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import 'auth_provider.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import 'supabase_provider.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final roleAsync = ref.watch(currentUserRoleProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final user = ref.read(supabaseProvider).auth.currentUser;
      final isLoggingIn = state.matchedLocation == '/login';

      if (user == null) {
        return isLoggingIn ? null : '/login';
      }

      if (roleAsync is AsyncData) {
        final role = roleAsync.value;
        // Role Guard: Hub App allows specialists and couriers
        final isHubRole = role == UserRole.meatSpecialist ||
            role == UserRole.breadBaker ||
            role == UserRole.pastryChef ||
            role == UserRole.courier;

        if (!isHubRole) {
          // If unauthorized, we sign them out to prevent getting stuck
          ref.read(supabaseProvider).auth.signOut();
          return '/login';
        }

        if (isLoggingIn) return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
    ],
  );
});
