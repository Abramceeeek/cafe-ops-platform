import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import 'package:shared_ui/shared_ui.dart';
import 'auth_provider.dart';
import 'notifications.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/request/request_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/standing/standing_orders_screen.dart';
import '../features/account/account_screen.dart';
import 'supabase_provider.dart';

final _homeKey = GlobalKey<NavigatorState>();
final _requestKey = GlobalKey<NavigatorState>();
final _ordersKey = GlobalKey<NavigatorState>();
final _standingKey = GlobalKey<NavigatorState>();
final _accountKey = GlobalKey<NavigatorState>();

const _destinations = <NavDestinationData>[
  NavDestinationData(Icons.dashboard_outlined, Icons.dashboard, 'Home'),
  NavDestinationData(Icons.add_shopping_cart_outlined, Icons.add_shopping_cart, 'Request'),
  NavDestinationData(Icons.receipt_long_outlined, Icons.receipt_long, 'Orders'),
  NavDestinationData(Icons.event_repeat_outlined, Icons.event_repeat, 'Standing'),
  NavDestinationData(Icons.person_outline, Icons.person, 'Account'),
];

final routerProvider = Provider<GoRouter>((ref) {
  ref.watch(authStateProvider);
  final roleAsync = ref.watch(currentUserRoleProvider);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
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
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AdaptiveScaffold(
            brandLabel: 'HubSync',
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: (index) => navigationShell.goBranch(
              index,
              initialLocation: index == navigationShell.currentIndex,
            ),
            destinations: _destinations,
            body: navigationShell,
          );
        },
        branches: [
          StatefulShellBranch(
            navigatorKey: _homeKey,
            routes: [GoRoute(path: '/', builder: (c, s) => const DashboardScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: _requestKey,
            routes: [GoRoute(path: '/request', builder: (c, s) => const RequestScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: _ordersKey,
            routes: [GoRoute(path: '/orders', builder: (c, s) => const OrdersScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: _standingKey,
            routes: [GoRoute(path: '/standing-orders', builder: (c, s) => const StandingOrdersScreen())],
          ),
          StatefulShellBranch(
            navigatorKey: _accountKey,
            routes: [GoRoute(path: '/account', builder: (c, s) => const AccountScreen())],
          ),
        ],
      ),
    ],
  );
});
