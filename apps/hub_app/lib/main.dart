import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_constants/shared_constants.dart';
import 'core/router.dart';
import 'core/push.dart';
import 'core/notifications.dart';
import 'core/theme_mode_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Provide at build/run time (keeps secrets out of the repo):
  //   flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
  const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  await Supabase.initialize(
    url: supabaseUrl,
    // ignore: deprecated_member_use
    anonKey: supabaseAnonKey,
  );

  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (_) {
    // Firebase is optional; don't block startup if it isn't configured.
  }
  final sb = Supabase.instance.client;
  if (sb.auth.currentUser != null) registerPushToken(sb);
  sb.auth.onAuthStateChange.listen((d) {
    if (d.event == AuthChangeEvent.signedIn) registerPushToken(sb);
  });

  runApp(const ProviderScope(child: HubApp()));
}

class HubApp extends ConsumerStatefulWidget {
  const HubApp({super.key});

  @override
  ConsumerState<HubApp> createState() => _HubAppState();
}

class _HubAppState extends ConsumerState<HubApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => setupNotificationHandlers());
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: scaffoldMessengerKey,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ref.watch(themeModeProvider),
      routerConfig: router,
      builder: (context, child) {
        // Bigger type on large wall-mounted displays; phones stay at 1.0.
        final width = MediaQuery.sizeOf(context).width;
        final scale = (width / 700).clamp(1.0, 1.3).toDouble();
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        );
      },
    );
  }
}
