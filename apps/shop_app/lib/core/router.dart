import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import 'auth_provider.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/request/request_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/templates/templates_screen.dart';
import '../features/account/account_screen.dart';
import 'supabase_provider.dart';

final routerProvider = Provider<GoRouter>((ref) {
  ref.watch(authStateProvider);
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
        // Role Guard: Shop App only allows FOH and Kitchen managers
        if (role != UserRole.fohManager && role != UserRole.kitchenManager) {
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
      GoRoute(
        path: '/request',
        builder: (context, state) => const RequestScreen(),
      ),
      GoRoute(
        path: '/orders',
        builder: (context, state) => const OrdersScreen(),
      ),
      GoRoute(
        path: '/templates',
        builder: (context, state) => const TemplatesScreen(),
      ),
      GoRoute(
        path: '/account',
        builder: (context, state) => const AccountScreen(),
      ),
    ],
  );
});
