import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// HubSync · bobo & wild design system, ported from `.design/.../theme.css`.
/// Warm artisanal-utilitarian. Terracotta accent. Light = shop/admin,
/// dark = hub kitchen displays. Status colours match spec §11.1.
///
/// Fonts: Newsreader (display/serif), Hanken Grotesk (sans/body),
/// IBM Plex Mono (numbers/IDs) — loaded via google_fonts (fetched once, then
/// cached on device; the apps require live connectivity anyway).
class AppTheme {
  AppTheme._();

  // ── radii (--r-xs … --r-xl) ────────────────────────────────────────────
  static const double rXs = 7;
  static const double rSm = 10;
  static const double r = 14;
  static const double rLg = 18;
  static const double rXl = 24;

  static ThemeData get lightTheme => _build(_LightTokens());
  static ThemeData get darkTheme => _build(_DarkTokens());

  /// IBM Plex Mono style for order IDs, quantities, timers.
  static TextStyle mono({double? fontSize, FontWeight? fontWeight, Color? color, double? letterSpacing}) =>
      GoogleFonts.ibmPlexMono(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
      );

  static ThemeData _build(_Tokens t) {
    final scheme = ColorScheme.fromSeed(
      seedColor: t.terra,
      brightness: t.brightness,
    ).copyWith(
      primary: t.terra,
      onPrimary: t.onTerra,
      primaryContainer: t.terraTint,
      onPrimaryContainer: t.terraDeep,
      secondary: t.terraSoft,
      onSecondary: t.onTerra,
      surface: t.surface,
      onSurface: t.ink,
      surfaceContainerLowest: t.surface,
      surfaceContainerLow: t.surface2,
      surfaceContainer: t.surface2,
      surfaceContainerHigh: t.surface3,
      surfaceContainerHighest: t.paper2,
      onSurfaceVariant: t.muted,
      outline: t.line2,
      outlineVariant: t.line,
      error: t.stBadFg,
      onError: t.onTerra,
    );

    final textTheme = _textTheme(scheme);

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: t.paper,
      canvasColor: t.paper,
      textTheme: textTheme,
      // ThemeData.fontFamily is set by the google_fonts text theme already.
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        backgroundColor: t.paper,
        foregroundColor: t.ink,
        titleTextStyle: GoogleFonts.newsreader(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          color: t.ink,
          letterSpacing: -0.2,
        ),
      ),
      dividerTheme: DividerThemeData(color: t.line, thickness: 1, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: t.surface2,
        contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(color: t.line2, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(color: t.line2, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(color: t.terra, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: t.terra,
          foregroundColor: t.onTerra,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
          textStyle: GoogleFonts.hankenGrotesk(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: t.ink,
          side: BorderSide(color: t.line2, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
          textStyle: GoogleFonts.hankenGrotesk(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: t.surface,
        indicatorColor: t.terraTint,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.all(
          GoogleFonts.hankenGrotesk(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: t.surface,
        indicatorColor: t.terraTint,
        selectedIconTheme: IconThemeData(color: t.terraDeep),
        selectedLabelTextStyle: GoogleFonts.hankenGrotesk(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: t.terraDeep,
        ),
        unselectedLabelTextStyle: GoogleFonts.hankenGrotesk(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: t.muted,
        ),
        unselectedIconTheme: IconThemeData(color: t.muted),
      ),
      extensions: [t.statusColors],
    );
  }

  static TextTheme _textTheme(ColorScheme scheme) {
    final sans = GoogleFonts.hankenGroteskTextTheme();
    final base = sans.apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );
    TextStyle serif(TextStyle? s, FontWeight w) =>
        GoogleFonts.newsreader(textStyle: s, fontWeight: w, letterSpacing: -0.2);
    TextStyle sansW(TextStyle? s, FontWeight w) =>
        GoogleFonts.hankenGrotesk(textStyle: s, fontWeight: w, letterSpacing: -0.1);
    return base.copyWith(
      displayLarge: serif(base.displayLarge, FontWeight.w500),
      displayMedium: serif(base.displayMedium, FontWeight.w500),
      displaySmall: serif(base.displaySmall, FontWeight.w500),
      headlineLarge: serif(base.headlineLarge, FontWeight.w600),
      headlineMedium: serif(base.headlineMedium, FontWeight.w600),
      headlineSmall: serif(base.headlineSmall, FontWeight.w600),
      titleLarge: sansW(base.titleLarge, FontWeight.w700),
      titleMedium: sansW(base.titleMedium, FontWeight.w700),
      titleSmall: sansW(base.titleSmall, FontWeight.w600),
      labelLarge: sansW(base.labelLarge, FontWeight.w700),
      bodyLarge: sansW(base.bodyLarge, FontWeight.w500),
      bodyMedium: sansW(base.bodyMedium, FontWeight.w400),
    );
  }
}

/// Status badge colours (5 states × fg/bg/line), carried on [ThemeData] so any
/// screen can render web-matching badges via
/// `Theme.of(context).extension<HubSyncStatusColors>()`.
@immutable
class HubSyncStatusColors extends ThemeExtension<HubSyncStatusColors> {
  final Color pendFg, pendBg, pendLine;
  final Color progFg, progBg, progLine;
  final Color readyFg, readyBg, readyLine;
  final Color doneFg, doneBg, doneLine;
  final Color badFg, badBg, badLine;

  const HubSyncStatusColors({
    required this.pendFg, required this.pendBg, required this.pendLine,
    required this.progFg, required this.progBg, required this.progLine,
    required this.readyFg, required this.readyBg, required this.readyLine,
    required this.doneFg, required this.doneBg, required this.doneLine,
    required this.badFg, required this.badBg, required this.badLine,
  });

  /// (foreground, background, border) for an order status `value` string.
  (Color, Color, Color) forStatus(String status) {
    switch (status) {
      case 'pending_request':
        return (pendFg, pendBg, pendLine);
      case 'in_progress':
      case 'packaged':
        return (progFg, progBg, progLine);
      case 'specialist_approved':
      case 'shop_confirmed':
      case 'ready_for_courier':
      case 'in_transit':
        return (readyFg, readyBg, readyLine);
      case 'delivered':
        return (doneFg, doneBg, doneLine);
      case 'rejected':
      case 'cancelled':
        return (badFg, badBg, badLine);
      default:
        return (pendFg, pendBg, pendLine);
    }
  }

  @override
  HubSyncStatusColors copyWith({
    Color? pendFg, Color? pendBg, Color? pendLine,
    Color? progFg, Color? progBg, Color? progLine,
    Color? readyFg, Color? readyBg, Color? readyLine,
    Color? doneFg, Color? doneBg, Color? doneLine,
    Color? badFg, Color? badBg, Color? badLine,
  }) {
    return HubSyncStatusColors(
      pendFg: pendFg ?? this.pendFg, pendBg: pendBg ?? this.pendBg, pendLine: pendLine ?? this.pendLine,
      progFg: progFg ?? this.progFg, progBg: progBg ?? this.progBg, progLine: progLine ?? this.progLine,
      readyFg: readyFg ?? this.readyFg, readyBg: readyBg ?? this.readyBg, readyLine: readyLine ?? this.readyLine,
      doneFg: doneFg ?? this.doneFg, doneBg: doneBg ?? this.doneBg, doneLine: doneLine ?? this.doneLine,
      badFg: badFg ?? this.badFg, badBg: badBg ?? this.badBg, badLine: badLine ?? this.badLine,
    );
  }

  @override
  HubSyncStatusColors lerp(HubSyncStatusColors? other, double t) {
    if (other == null) return this;
    return HubSyncStatusColors(
      pendFg: Color.lerp(pendFg, other.pendFg, t)!, pendBg: Color.lerp(pendBg, other.pendBg, t)!, pendLine: Color.lerp(pendLine, other.pendLine, t)!,
      progFg: Color.lerp(progFg, other.progFg, t)!, progBg: Color.lerp(progBg, other.progBg, t)!, progLine: Color.lerp(progLine, other.progLine, t)!,
      readyFg: Color.lerp(readyFg, other.readyFg, t)!, readyBg: Color.lerp(readyBg, other.readyBg, t)!, readyLine: Color.lerp(readyLine, other.readyLine, t)!,
      doneFg: Color.lerp(doneFg, other.doneFg, t)!, doneBg: Color.lerp(doneBg, other.doneBg, t)!, doneLine: Color.lerp(doneLine, other.doneLine, t)!,
      badFg: Color.lerp(badFg, other.badFg, t)!, badBg: Color.lerp(badBg, other.badBg, t)!, badLine: Color.lerp(badLine, other.badLine, t)!,
    );
  }
}

// ── token sets ─────────────────────────────────────────────────────────────

abstract class _Tokens {
  Brightness get brightness;
  Color get paper;
  Color get paper2;
  Color get surface;
  Color get surface2;
  Color get surface3;
  Color get ink;
  Color get muted;
  Color get line;
  Color get line2;
  Color get terra;
  Color get terraDeep;
  Color get terraSoft;
  Color get terraTint;
  Color get onTerra;
  Color get stBadFg;
  HubSyncStatusColors get statusColors;
}

class _LightTokens implements _Tokens {
  @override
  Brightness get brightness => Brightness.light;
  @override
  Color get paper => const Color(0xFFF4EEE3);
  @override
  Color get paper2 => const Color(0xFFECE3D4);
  @override
  Color get surface => const Color(0xFFFFFFFF);
  @override
  Color get surface2 => const Color(0xFFFBF7EF);
  @override
  Color get surface3 => const Color(0xFFF6F0E5);
  @override
  Color get ink => const Color(0xFF241D17);
  @override
  Color get muted => const Color(0xFF8B7E70);
  @override
  Color get line => const Color(0xFFE6DCCC);
  @override
  Color get line2 => const Color(0xFFD9CDB9);
  @override
  Color get terra => const Color(0xFFC2410C);
  @override
  Color get terraDeep => const Color(0xFF97320A);
  @override
  Color get terraSoft => const Color(0xFFE2703A);
  @override
  Color get terraTint => const Color(0xFFF8E6D9);
  @override
  Color get onTerra => const Color(0xFFFFFFFF);
  @override
  Color get stBadFg => const Color(0xFFAE2018);
  @override
  HubSyncStatusColors get statusColors => const HubSyncStatusColors(
        pendFg: Color(0xFF9A6207), pendBg: Color(0xFFFAECCB), pendLine: Color(0xFFEBD49A),
        progFg: Color(0xFF1F57AE), progBg: Color(0xFFDEE8F8), progLine: Color(0xFFBFD2F0),
        readyFg: Color(0xFFC2410C), readyBg: Color(0xFFF8E1D2), readyLine: Color(0xFFEFC6AB),
        doneFg: Color(0xFF15713A), doneBg: Color(0xFFD9EEDD), doneLine: Color(0xFFB6DCBE),
        badFg: Color(0xFFAE2018), badBg: Color(0xFFF7DCD7), badLine: Color(0xFFEEC2BA),
      );
}

class _DarkTokens implements _Tokens {
  @override
  Brightness get brightness => Brightness.dark;
  @override
  Color get paper => const Color(0xFF16120D);
  @override
  Color get paper2 => const Color(0xFF0F0C08);
  @override
  Color get surface => const Color(0xFF211B14);
  @override
  Color get surface2 => const Color(0xFF2A231B);
  @override
  Color get surface3 => const Color(0xFF322A20);
  @override
  Color get ink => const Color(0xFFF3ECDF);
  @override
  Color get muted => const Color(0xFF9E9180);
  @override
  Color get line => const Color(0xFF34291E);
  @override
  Color get line2 => const Color(0xFF463928);
  @override
  Color get terra => const Color(0xFFE2703A);
  @override
  Color get terraDeep => const Color(0xFFC2410C);
  @override
  Color get terraSoft => const Color(0xFFEE8C5C);
  @override
  Color get terraTint => const Color(0xFF3A2519);
  @override
  Color get onTerra => const Color(0xFFFFFFFF);
  @override
  Color get stBadFg => const Color(0xFFF0796C);
  @override
  HubSyncStatusColors get statusColors => const HubSyncStatusColors(
        pendFg: Color(0xFFE7B24B), pendBg: Color(0xFF3A2D11), pendLine: Color(0xFF5C4717),
        progFg: Color(0xFF6FA0E8), progBg: Color(0xFF15233C), progLine: Color(0xFF26426E),
        readyFg: Color(0xFFF08A4B), readyBg: Color(0xFF3C2412), readyLine: Color(0xFF6A3E1C),
        doneFg: Color(0xFF5FC07E), doneBg: Color(0xFF14301D), doneLine: Color(0xFF1F5232),
        badFg: Color(0xFFF0796C), badBg: Color(0xFF381713), badLine: Color(0xFF642921),
      );
}
