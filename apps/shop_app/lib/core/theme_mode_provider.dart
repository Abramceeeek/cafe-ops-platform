import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// App-wide light/dark/system selection. Mirrors the web's appearance toggle.
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
