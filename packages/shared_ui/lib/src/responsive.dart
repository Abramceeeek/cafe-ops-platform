import 'package:flutter/widgets.dart';

/// Material window size-class breakpoints used across HubSync.
/// compact (<600) = phone portrait; medium (>=600) = tablet / landscape
/// → rail nav; expanded (>=1000) → extended rail.
class Breakpoints {
  Breakpoints._();
  static const double medium = 600;
  static const double expanded = 1000;
  static const double contentMaxWidth = 1200;
}

extension ResponsiveContext on BuildContext {
  double get _w => MediaQuery.sizeOf(this).width;

  /// Phone portrait — use a bottom nav bar.
  bool get isCompact => _w < Breakpoints.medium;

  /// Tablet / landscape big screen — use a navigation rail.
  bool get isWide => _w >= Breakpoints.medium;

  /// Large display — rail can be extended (icon + label).
  bool get isExpanded => _w >= Breakpoints.expanded;
}

/// Centres + width-caps page content on large screens so cards stay readable.
class ContentWidth extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  const ContentWidth({super.key, required this.child, this.maxWidth = Breakpoints.contentMaxWidth});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
