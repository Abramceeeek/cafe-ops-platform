import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import 'auth_provider.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/inbox/inbox_screen.dart';
import '../features/schedule/schedule_screen.dart';
import '../features/route/route_screen.dart';
import '../features/account/account_screen.dart';
import '../features/catalog/catalog_screen.dart';
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
      GoRoute(
        path: '/inbox',
        builder: (context, state) => const InboxScreen(),
      ),
      GoRoute(
        path: '/schedule',
        builder: (context, state) => const ScheduleScreen(),
      ),
      GoRoute(
        path: '/route',
        builder: (context, state) => const CourierRouteScreen(),
      ),
      GoRoute(
        path: '/account',
        builder: (context, state) => const AccountScreen(),
      ),
      GoRoute(
        path: '/catalog',
        builder: (context, state) => const CatalogScreen(),
      ),
    ],
  );
});
