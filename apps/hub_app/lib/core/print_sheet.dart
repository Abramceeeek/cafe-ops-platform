import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

class PrintLine {
  final String name;
  final String qty; // e.g. "3 kg"
  final String? subhead; // optional category sub-header shown above this line
  PrintLine(this.name, this.qty, {this.subhead});
}

class PrintBlock {
  final String title; // shop name
  final String meta; // status / date / #id
  final String? address;
  final List<PrintLine> lines;
  PrintBlock({required this.title, required this.meta, this.address, required this.lines});
}

/// Builds an A4 sheet (mirroring the web /print page) and opens the system
/// print / share-to-PDF dialog. Specialist = production sheet, courier = route.
///
/// [perShopPages]: start each block on its own page (one shop per page).
/// [totals]: optional final "production totals" page summed across all shops.
Future<void> printSheet({
  required String heading,
  required String subtitle,
  required List<PrintBlock> blocks,
  List<PrintLine>? totals,
  String totalsTitle = 'Production totals — all shops',
  bool perShopPages = false,
}) async {
  final doc = pw.Document();

  pw.Widget blockWidget(PrintBlock b, {bool emphasised = false}) => pw.Container(
        margin: const pw.EdgeInsets.only(bottom: 12),
        decoration: pw.BoxDecoration(
          border: pw.Border.all(width: emphasised ? 2 : 1),
          borderRadius: pw.BorderRadius.circular(4),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: pw.BoxDecoration(
                color: emphasised ? PdfColors.black : PdfColors.grey200,
                border: const pw.Border(bottom: pw.BorderSide(width: 1)),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(b.title,
                      style: pw.TextStyle(
                          fontSize: 14,
                          fontWeight: pw.FontWeight.bold,
                          color: emphasised ? PdfColors.white : PdfColors.black)),
                  if (b.meta.isNotEmpty)
                    pw.Text(b.meta,
                        style: pw.TextStyle(fontSize: 10, color: emphasised ? PdfColors.white : PdfColors.black)),
                ],
              ),
            ),
            if (b.address != null && b.address!.isNotEmpty)
              pw.Padding(
                padding: const pw.EdgeInsets.fromLTRB(10, 4, 10, 0),
                child: pw.Text(b.address!, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
              ),
            pw.Table(
              border: const pw.TableBorder(horizontalInside: pw.BorderSide(width: 0.5, color: PdfColors.grey400)),
              columnWidths: const {
                0: pw.FlexColumnWidth(),
                1: pw.IntrinsicColumnWidth(),
                2: pw.FixedColumnWidth(48),
              },
              children: [
                for (final l in b.lines)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            if (l.subhead != null && l.subhead!.isNotEmpty)
                              pw.Text(l.subhead!.toUpperCase(),
                                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
                            pw.Text(l.name, style: const pw.TextStyle(fontSize: 12)),
                          ],
                        ),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        child: pw.Text(l.qty, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
                      ),
                      pw.Container(
                        decoration: const pw.BoxDecoration(
                            border: pw.Border(left: pw.BorderSide(width: 0.5, color: PdfColors.grey400))),
                        child: pw.Text(' '),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      );

    final content = <pw.Widget>[
      pw.Container(
        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 2))),
        padding: const pw.EdgeInsets.only(bottom: 8),
        margin: const pw.EdgeInsets.only(bottom: 12),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(heading, style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 2),
            pw.Text(subtitle, style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700)),
            pw.Text('bobo & wild · HubSync · ${blocks.length} shop${blocks.length == 1 ? '' : 's'}',
                style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
          ],
        ),
      ),
    ];

  if (blocks.isEmpty) {
    content.add(pw.Text('No orders for this sheet.', style: const pw.TextStyle(fontSize: 12)));
  }
  for (var i = 0; i < blocks.length; i++) {
    if (perShopPages && i > 0) content.add(pw.NewPage());
    content.add(blockWidget(blocks[i]));
  }
  if (totals != null && totals.isNotEmpty) {
    if (perShopPages) content.add(pw.NewPage());
    content.add(blockWidget(PrintBlock(title: totalsTitle, meta: '', lines: totals), emphasised: true));
  }

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(28),
      build: (context) => content,
    ),
  );
  await Printing.layoutPdf(onLayout: (format) async => doc.save());
}
