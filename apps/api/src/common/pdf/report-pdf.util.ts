import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

export interface ReportTenant {
  name: string | null;
  legalName: string | null;
  document: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
}

/**
 * Same header/section/grid-table visual language as the Ordem de Serviço PDF
 * (apps/api/src/service-orders/service-orders.service.ts generatePdf) —
 * factored out here so every report under Relatórios looks consistent with
 * it, without touching that already-working, already-tested method.
 */
export function createReportPdf(tenant: ReportTenant | null, reportTitle: string, subtitle?: string) {
  const doc = new PDFDocument({ margin: 50, bufferPages: true, layout: 'landscape' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const marginLeft = doc.page.margins.left;
  const marginTop = doc.page.margins.top;
  const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const brandColor = '#1d4ed8';
  const companyName = tenant?.name || tenant?.legalName || null;

  function drawHeader() {
    const headerTop = marginTop;
    let logoBottom = headerTop;
    if (tenant?.logoUrl) {
      const logoPath = join(process.cwd(), 'uploads', tenant.logoUrl);
      if (existsSync(logoPath)) {
        try {
          doc.image(logoPath, marginLeft, headerTop, { fit: [170, 55] });
          logoBottom = headerTop + 55;
        } catch {
          // arquivo de logo corrompido/ilegível — segue sem quebrar o PDF
        }
      }
    }

    const infoWidth = 260;
    const infoX = marginLeft + contentWidth - infoWidth;
    doc.y = headerTop;
    if (companyName) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text(companyName, infoX, doc.y, { width: infoWidth, align: 'right' });
    }
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    if (tenant?.document) doc.text(tenant.document, infoX, doc.y, { width: infoWidth, align: 'right' });
    if (tenant?.address) doc.text(tenant.address, infoX, doc.y, { width: infoWidth, align: 'right' });
    const contactLine = [tenant?.phone, tenant?.email].filter(Boolean).join(' · ');
    if (contactLine) doc.text(contactLine, infoX, doc.y, { width: infoWidth, align: 'right' });
    const infoBottom = doc.y;

    doc.x = marginLeft;
    doc.y = Math.max(logoBottom, infoBottom) + 10;
    doc.moveTo(marginLeft, doc.y).lineTo(marginLeft + contentWidth, doc.y).strokeColor('#dddddd').lineWidth(1).stroke();
    doc.moveDown();

    doc.fillColor('black').fontSize(16).font('Helvetica-Bold').text(reportTitle);
    if (subtitle) doc.fontSize(10).font('Helvetica').fillColor('#333333').text(subtitle);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    doc.x = marginLeft;
  }

  drawHeader();

  function ensureSpace(height: number) {
    if (doc.y + height > pageBottom) {
      doc.addPage();
      drawHeader();
    }
  }

  function section(title: string) {
    ensureSpace(28);
    const y = doc.y;
    doc.rect(marginLeft, y, contentWidth, 20).fill(brandColor);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11).text(title, marginLeft + 8, y + 5);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    doc.x = marginLeft;
    doc.y = y + 28;
  }

  function field(label: string, value: string) {
    ensureSpace(14);
    doc.x = marginLeft;
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value);
    doc.x = marginLeft;
  }

  /**
   * Bordered spreadsheet-style table (linhas de planilha) with automatic
   * pagination — re-draws the header row (and the report's own header) on
   * every new page, since these reports can have far more rows than an OS's
   * parts table ever does.
   */
  function gridTable(headers: string[], colWidths: number[], rows: string[][]) {
    const rowHeight = 16;
    const colX: number[] = [];
    let acc = marginLeft;
    for (const w of colWidths) {
      colX.push(acc);
      acc += w;
    }

    function drawHeaderRow() {
      ensureSpace(rowHeight * 2);
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555');
      headers.forEach((h, i) => doc.text(h, colX[i] + 4, y + 4, { width: colWidths[i] - 8 }));
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.rect(marginLeft, y, contentWidth, rowHeight).stroke();
      for (let c = 1; c < colX.length; c++) doc.moveTo(colX[c], y).lineTo(colX[c], y + rowHeight).stroke();
      doc.x = marginLeft;
      doc.y = y + rowHeight;
      doc.font('Helvetica').fontSize(8).fillColor('black');
    }

    drawHeaderRow();
    for (const row of rows) {
      if (doc.y + rowHeight > pageBottom) {
        doc.addPage();
        drawHeader();
        drawHeaderRow();
      }
      const y = doc.y;
      row.forEach((cell, i) => doc.text(cell, colX[i] + 4, y + 4, { width: colWidths[i] - 8 }));
      doc.strokeColor('#eeeeee').lineWidth(0.5);
      doc.rect(marginLeft, y, contentWidth, rowHeight).stroke();
      for (let c = 1; c < colX.length; c++) doc.moveTo(colX[c], y).lineTo(colX[c], y + rowHeight).stroke();
      doc.x = marginLeft;
      doc.y = y + rowHeight;
    }
    doc.x = marginLeft;
    doc.moveDown();
  }

  function end(): Promise<Buffer> {
    doc.end();
    return done;
  }

  return { doc, marginLeft, contentWidth, section, field, gridTable, ensureSpace, end };
}
