import 'package:flutter/material.dart';
import 'package:shared_constants/shared_constants.dart';

/// Pill status badge matching the web `.status` component — coloured dot +
/// label, tinted background, hairline border. Colours come from the active
/// theme's [HubSyncStatusColors] so light/dark both look right.
class OrderStatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;
  const OrderStatusBadge({super.key, required this.status, this.fontSize = 12});

  static String labelFor(String status) {
    switch (status) {
      case 'pending_request':
        return 'Pending';
      case 'specialist_approved':
        return 'Approved';
      case 'shop_confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In progress';
      case 'packaged':
        return 'Packaged';
      case 'ready_for_courier':
        return 'Ready';
      case 'in_transit':
        return 'In transit';
      case 'delivered':
        return 'Delivered';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replaceAll('_', ' ');
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<HubSyncStatusColors>();
    final (fg, bg, line) = colors?.forStatus(status) ??
        (Theme.of(context).colorScheme.onSurface, Theme.of(context).colorScheme.surface, Theme.of(context).dividerColor);
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 5, 10, 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(
            labelFor(status),
            style: TextStyle(color: fg, fontSize: fontSize, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
