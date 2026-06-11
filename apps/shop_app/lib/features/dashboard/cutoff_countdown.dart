import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_constants/shared_constants.dart';

/// Live countdown to the next daily cut-off (Europe/London, default 16:00),
/// mirroring the web FOH "CutoffCountdown" banner. After the cut-off it counts
/// to tomorrow's. Decorative warm-dark banner — readable in both themes.
class CutoffCountdown extends StatefulWidget {
  final int cutoffHour;
  const CutoffCountdown({super.key, this.cutoffHour = 16});

  @override
  State<CutoffCountdown> createState() => _CutoffCountdownState();
}

class _CutoffCountdownState extends State<CutoffCountdown> {
  Timer? _timer;
  int _secs = 0;

  @override
  void initState() {
    super.initState();
    _tick();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  // London wall-clock from UTC (BST late-Mar..late-Oct = UTC+1), matching the
  // request screen's `_londonHour`.
  DateTime _londonNow() {
    final nowUtc = DateTime.now().toUtc();
    final y = nowUtc.year;
    DateTime lastSunday(int month) {
      final d = DateTime.utc(y, month + 1, 1).subtract(const Duration(days: 1));
      return d.subtract(Duration(days: d.weekday % 7));
    }

    final bst = nowUtc.isAfter(lastSunday(3).add(const Duration(hours: 1))) &&
        nowUtc.isBefore(lastSunday(10).add(const Duration(hours: 1)));
    return nowUtc.add(Duration(hours: bst ? 1 : 0));
  }

  void _tick() {
    final lon = _londonNow();
    var rem = widget.cutoffHour * 3600 - (lon.hour * 3600 + lon.minute * 60 + lon.second);
    if (rem <= 0) rem += 24 * 3600; // cut-off passed → counts to tomorrow's
    if (mounted) setState(() => _secs = rem);
  }

  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFFF6ECDC);
    const accent = Color(0xFFE2A878);
    const sub = Color(0xFFCDB79E);
    final hh = _secs ~/ 3600;
    final mm = (_secs % 3600) ~/ 60;
    final pct = (_secs / (24 * 3600)).clamp(0.02, 1.0).toDouble();
    final closeLabel = '${((widget.cutoffHour + 11) % 12) + 1}:00 ${widget.cutoffHour < 12 ? "AM" : "PM"}';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.rXl),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2A211A), Color(0xFF3C2C1E)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text(
                "CUT-OFF · TOMORROW'S ORDERS",
                style: TextStyle(color: accent, fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 1.3),
              ),
              Icon(Icons.schedule, size: 16, color: accent),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('$hh', style: AppTheme.mono(fontSize: 44, fontWeight: FontWeight.w600, color: ink)),
              Text('h ', style: AppTheme.mono(fontSize: 22, fontWeight: FontWeight.w500, color: ink.withValues(alpha: 0.6))),
              Text(mm.toString().padLeft(2, '0'), style: AppTheme.mono(fontSize: 44, fontWeight: FontWeight.w600, color: ink)),
              Text('m', style: AppTheme.mono(fontSize: 22, fontWeight: FontWeight.w500, color: ink.withValues(alpha: 0.6))),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 5,
              backgroundColor: Colors.white.withValues(alpha: 0.12),
              valueColor: const AlwaysStoppedAnimation(Color(0xFFE2703A)),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Closes $closeLabel', style: const TextStyle(color: sub, fontSize: 12.5)),
              const Flexible(
                child: Text(
                  'Order before cut-off for next-day delivery',
                  textAlign: TextAlign.right,
                  style: TextStyle(color: sub, fontSize: 12.5),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
