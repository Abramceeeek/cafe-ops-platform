import 'package:flutter_test/flutter_test.dart';
import 'package:hub_app/main.dart';

void main() {
  testWidgets('renders Hub App home', (tester) async {
    await tester.pumpWidget(const HubApp());
    expect(find.text('Hub App'), findsOneWidget);
  });
}
