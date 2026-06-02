import 'package:flutter_test/flutter_test.dart';
import 'package:shop_app/main.dart';

void main() {
  testWidgets('renders Shop App home', (tester) async {
    await tester.pumpWidget(const ShopApp());
    expect(find.text('Shop App'), findsOneWidget);
  });
}
