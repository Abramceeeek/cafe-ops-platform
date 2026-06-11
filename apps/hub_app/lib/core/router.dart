import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_constants/shared_constants.dart';
import 'package:shared_ui/shared_ui.dart';
import 'auth_provider.dart';
import 'notifications.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/inbox/inbox_screen.dart';
import '../features/schedule/schedule_screen.dart';
import '../features/route/route_screen.dart';
import '../features/account/account_screen.dart';
import '../features/catalog/catalog_screen.dart';
import 'supabase_provider.dart';

final _homeKey = GlobalKey<NavigatorState>();
final _inboxKey = GlobalKey<NavigatorState>();
final _scheduleKey = GlobalKey<NavigatorState>();
final _catalogKey = GlobalKey<NavigatorState>();
final _routeKey = GlobalKey<NavigatorState>();
final _accountKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  ref.watch(authStateProvider);
  final roleAsync = ref.watch(currentUserRoleProvider);
  final isCourier = roleAsync.value == UserRole.courier;

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
            destinations: _destinations(isCourier),
            body: navigationShell,
          );
        },
        branches: _branches(isCourier),
      ),
    ],
  );
});

List<StatefulShellBranch> _branches(bool isCourier) => [
      StatefulShellBranch(
        navigatorKey: _homeKey,
        routes: [GoRoute(path: '/', builder: (c, s) => const DashboardScreen())],
      ),
      if (isCourier)
        StatefulShellBranch(
          navigatorKey: _routeKey,
          routes: [GoRoute(path: '/route', builder: (c, s) => const CourierRouteScreen())],
        ),
      if (!isCourier) ...[
        StatefulShellBranch(
          navigatorKey: _inboxKey,
          routes: [GoRoute(path: '/inbox', builder: (c, s) => const InboxScreen())],
        ),
        StatefulShellBranch(
          navigatorKey: _scheduleKey,
          routes: [GoRoute(path: '/schedule', builder: (c, s) => const ScheduleScreen())],
        ),
        StatefulShellBranch(
          navigatorKey: _catalogKey,
          routes: [GoRoute(path: '/catalog', builder: (c, s) => const CatalogScreen())],
        ),
      ],
      StatefulShellBranch(
        navigatorKey: _accountKey,
        routes: [GoRoute(path: '/account', builder: (c, s) => const AccountScreen())],
      ),
    ];

List<NavDestinationData> _destinations(bool isCourier) => [
      const NavDestinationData(Icons.dashboard_outlined, Icons.dashboard, 'Home'),
      if (isCourier)
        const NavDestinationData(Icons.local_shipping_outlined, Icons.local_shipping, 'Route'),
      if (!isCourier) ...[
        const NavDestinationData(Icons.inbox_outlined, Icons.inbox, 'Inbox'),
        const NavDestinationData(Icons.event_note_outlined, Icons.event_note, 'Schedule'),
        const NavDestinationData(Icons.inventory_2_outlined, Icons.inventory_2, 'Catalog'),
      ],
      const NavDestinationData(Icons.person_outline, Icons.person, 'Account'),
    ];
