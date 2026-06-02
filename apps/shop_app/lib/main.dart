import 'package:flutter/material.dart';

void main() => runApp(const ShopApp());

class ShopApp extends StatelessWidget {
  const ShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'HubSync Shop',
      home: Scaffold(
        body: Center(child: Text('Shop App')),
      ),
    );
  }
}
