import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';

/// Root navigator key — lets notification taps navigate without a BuildContext.
final rootNavigatorKey = GlobalKey<NavigatorState>();

/// Messenger key — lets foreground pushes surface an in-app banner.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Background/terminated handler. The server sends a `notification` block, so
/// Android renders these in the system tray itself — this exists only to satisfy
/// the `onBackgroundMessage` contract. Must be a top-level/static function.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

/// Foreground display + tap routing. Call once after the first frame so the
/// navigator and messenger keys are mounted (handles cold-start taps too).
void setupNotificationHandlers() {
  try {
    FirebaseMessaging.onMessage.listen(_showForeground);
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _route(m.data));
    FirebaseMessaging.instance.getInitialMessage().then((m) {
      if (m != null) _route(m.data);
    });
  } catch (_) {
    // Firebase optional — push handling is best-effort.
  }
}

void _showForeground(RemoteMessage message) {
  final n = message.notification;
  final messenger = scaffoldMessengerKey.currentState;
  if (n == null || messenger == null) return;
  final text = [n.title, n.body].where((s) => s != null && s.isNotEmpty).join(' — ');
  messenger.showSnackBar(SnackBar(
    content: Text(text.isEmpty ? 'New update' : text),
    action: SnackBarAction(label: 'View', onPressed: () => _route(message.data)),
  ));
}

/// Hub roles land on the screen that owns the order at this status.
void _route(Map<String, dynamic> data) {
  final ctx = rootNavigatorKey.currentContext;
  if (ctx == null) return;
  final dest = switch (data['status']?.toString()) {
    'pending_request' => '/inbox',
    'ready_for_courier' => '/route',
    _ => '/',
  };
  ctx.go(dest);
}
