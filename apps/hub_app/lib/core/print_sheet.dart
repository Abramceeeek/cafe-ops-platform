import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

class PrintLine {
  final String name;
  final String qty; // e.g. "3 kg"
  PrintLine(this.name, this.qty);
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
Future<void> printSheet({
  required String heading,
  required String subtitle,
  required List<PrintBlock> blocks,
}) async {
  final doc = pw.Document();
  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(28),
      build: (context) => [
        pw.Container(
          decoration: const pw.BoxDecoration(
            border: pw.Border(bottom: pw.BorderSide(width: 2)),
          ),
          padding: const pw.EdgeInsets.only(bottom: 8),
          margin: const pw.EdgeInsets.only(bottom: 12),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(heading, style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 2),
              pw.Text(subtitle, style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey700)),
              pw.Text('bobo & wild · HubSync · ${blocks.length} order${blocks.length == 1 ? '' : 's'}',
                  style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
            ],
          ),
        ),
        if (blocks.isEmpty) pw.Text('No orders for this sheet.', style: const pw.TextStyle(fontSize: 12)),
        for (final b in blocks)
          pw.Container(
            margin: const pw.EdgeInsets.only(bottom: 12),
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 1), borderRadius: pw.BorderRadius.circular(4)),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: const pw.BoxDecoration(
                    color: PdfColors.grey200,
                    border: pw.Border(bottom: pw.BorderSide(width: 1)),
                  ),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(b.title, style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
                      pw.Text(b.meta, style: const pw.TextStyle(fontSize: 10)),
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
                          pw.Padding(padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5), child: pw.Text(l.name, style: const pw.TextStyle(fontSize: 12))),
                          pw.Padding(
                            padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            child: pw.Text(l.qty, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
                          ),
                          pw.Container(
                            decoration: const pw.BoxDecoration(border: pw.Border(left: pw.BorderSide(width: 0.5, color: PdfColors.grey400))),
                            child: pw.Text(' '),
                          ),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
      ],
    ),
  );
  await Printing.layoutPdf(onLayout: (format) async => doc.save());
}
