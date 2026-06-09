import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Best-effort: request notification permission, get the FCM token, and store it
/// on the signed-in user's profile (via the set_fcm_token RPC). Never throws —
/// push is non-critical, so failures must not block the app.
Future<void> registerPushToken(SupabaseClient sb) async {
  try {
    if (sb.auth.currentUser == null) return;
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();
    final token = await messaging.getToken();
    if (token != null) {
      await sb.rpc('set_fcm_token', params: {'p_token': token});
    }
  } catch (_) {
    // ignore — push registration is best-effort
  }
}
