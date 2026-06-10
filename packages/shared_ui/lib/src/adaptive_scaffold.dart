import 'package:flutter/material.dart';
import 'responsive.dart';

/// One navigation destination — icon pair + label.
class NavDestinationData {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  const NavDestinationData(this.icon, this.selectedIcon, this.label);
}

/// The persistent HubSync navigation menu. Adapts by width:
///  • wide (tablet / landscape monitor) → left [NavigationRail]
///    (extended with labels on very wide displays)
///  • compact (phone portrait) → bottom [NavigationBar]
///
/// Decoupled from go_router: pass [body] (the branch navigator),
/// [selectedIndex], and [onDestinationSelected]. The destination list must be
/// the same length/order the caller uses to resolve [selectedIndex].
class AdaptiveScaffold extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<NavDestinationData> destinations;
  final Widget body;
  final String? brandLabel;

  const AdaptiveScaffold({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
    required this.body,
    this.brandLabel,
  });

  @override
  Widget build(BuildContext context) {
    if (context.isWide) {
      final extended = context.isExpanded;
      return Scaffold(
        body: SafeArea(
          child: Row(
            children: [
              NavigationRail(
                extended: extended,
                labelType: extended ? null : NavigationRailLabelType.all,
                selectedIndex: selectedIndex,
                onDestinationSelected: onDestinationSelected,
                leading: brandLabel == null
                    ? null
                    : Padding(
                        padding: EdgeInsets.fromLTRB(extended ? 16 : 0, 12, extended ? 16 : 0, 18),
                        child: Text(
                          extended ? brandLabel! : brandLabel!.substring(0, 1),
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                destinations: [
                  for (final d in destinations)
                    NavigationRailDestination(
                      icon: Icon(d.icon),
                      selectedIcon: Icon(d.selectedIcon),
                      label: Text(d.label),
                    ),
                ],
              ),
              const VerticalDivider(width: 1, thickness: 1),
              Expanded(child: body),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: onDestinationSelected,
        destinations: [
          for (final d in destinations)
            NavigationDestination(
              icon: Icon(d.icon),
              selectedIcon: Icon(d.selectedIcon),
              label: d.label,
            ),
        ],
      ),
    );
  }
}
