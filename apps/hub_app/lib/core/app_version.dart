import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'supabase_provider.dart';

/// Stamped by CI via --dart-define: the commit count of the commit this build (or
/// code-push patch) was made from, plus its short SHA. 0 / 'dev' for local builds,
/// which the update gate never blocks.
const appCodeVersion = int.fromEnvironment('APP_CODE_VERSION');
const appGitSha = String.fromEnvironment('APP_GIT_SHA', defaultValue: 'dev');
const _appKey = 'hub';

class UpdateInfo {
  final String url;
  final String? message;
  const UpdateInfo(this.url, this.message);
}

/// Non-null when this build is older than app_versions.min_version. Any failure
/// resolves to null — a flaky network must never lock staff out of the app.
final updateRequiredProvider = FutureProvider<UpdateInfo?>((ref) async {
  if (appCodeVersion == 0) return null;
  try {
    final row = await ref
        .read(supabaseProvider)
        .from('app_versions')
        .select('min_version, ios_url, android_url, message')
        .eq('app', _appKey)
        .maybeSingle();
    if (row == null || appCodeVersion >= (row['min_version'] as int)) return null;
    final url = defaultTargetPlatform == TargetPlatform.iOS ? row['ios_url'] : row['android_url'];
    return UpdateInfo(
      (url ?? 'https://cafe-ops-platform.vercel.app/download') as String,
      row['message'] as String?,
    );
  } catch (_) {
    return null;
  }
});

class UpdateRequiredScreen extends StatelessWidget {
  final UpdateInfo info;
  const UpdateRequiredScreen({super.key, required this.info});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.system_update, size: 56),
                const SizedBox(height: 16),
                Text('Update required', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(
                  info.message ?? 'This version of HubSync is out of date. Install the latest version to keep working.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  icon: const Icon(Icons.download),
                  label: const Text('Get the update'),
                  onPressed: () => launchUrl(Uri.parse(info.url), mode: LaunchMode.externalApplication),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
