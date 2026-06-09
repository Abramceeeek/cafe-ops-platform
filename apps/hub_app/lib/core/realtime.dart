import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'supabase_provider.dart';

/// Live "tick" over the orders table (RLS-scoped). Inbox/schedule/route data
/// providers `ref.watch` this so they re-fetch their rich nested query whenever
/// a row changes — from this app OR the web — giving web-parity live updates
/// without rewriting the joined queries as streams (`.stream()` can't embed
/// relations).
final ordersTickProvider = StreamProvider.autoDispose((ref) {
  final sb = ref.watch(supabaseProvider);
  return sb.from('orders').stream(primaryKey: ['id']);
});
