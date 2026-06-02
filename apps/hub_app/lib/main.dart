import 'package:flutter/material.dart';

void main() => runApp(const HubApp());

class HubApp extends StatelessWidget {
  const HubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'HubSync Hub',
      home: Scaffold(
        body: Center(child: Text('Hub App')),
      ),
    );
  }
}
