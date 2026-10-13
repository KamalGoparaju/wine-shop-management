const PDFDocument = require('pdfkit');

const formatINR = (val) => {
  const num = parseFloat(val) || 0;
  return 'INR ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (val) => {
  const num = parseInt(val, 10) || 0;
  return num.toLocaleString('en-IN');
};

const generateClosingReportPdf = (data, stream) => {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    bufferPages: true
  });

  doc.pipe(stream);

  const {
    shopName = 'Wine Shop',
    shopCode = 'SHOP',
    businessDate,
    closing = null,
    stockRecords = [],
    expenses = []
  } = data;

  const status = closing ? closing.status : 'UNCLOSED';
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'UTC' }) + ' UTC';

  // 1. Header Banner
  doc.rect(36, 30, 523, 50).fill('#0f172a');
  doc.fillColor('#f59e0b').fontSize(14).font('Helvetica-Bold')
     .text('WINE SHOP MANAGEMENT SYSTEM', 50, 40);
  doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
     .text('DAILY BUSINESS CLOSING & AUDIT REPORT', 50, 58);

  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
     .text(`${shopName} (${shopCode})`, 250, 40, { width: 295, align: 'right' });
  doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
     .text(`Business Date: ${businessDate}  |  Status: ${status}`, 250, 56, { width: 295, align: 'right' });
  doc.text(`Generated: ${generatedAt}`, 250, 68, { width: 295, align: 'right' });

  let currentY = 90;

  // 2. Status Notice Banner
  if (status === 'REOPENED') {
    doc.rect(36, currentY, 523, 20).fill('#fef2f2');
    doc.fillColor('#dc2626').fontSize(8).font('Helvetica-Bold')
       .text('NOTICE: This business day has been REOPENED for audit/corrections.', 45, currentY + 5, { width: 505, align: 'center' });
    currentY += 26;
  } else if (status === 'UNCLOSED') {
    doc.rect(36, currentY, 523, 20).fill('#fffbeb');
    doc.fillColor('#d97706').fontSize(8).font('Helvetica-Bold')
       .text('NOTICE: Daily Business Closing has NOT yet been finalized for this date.', 45, currentY + 5, { width: 505, align: 'center' });
    currentY += 26;
  }

  // 3. Financial Summary Grid
  doc.rect(36, currentY, 523, 90).fill('#f8fafc');
  doc.rect(36, currentY, 523, 90).stroke('#cbd5e1');

  doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold')
     .text('FINANCIAL STATEMENT & RECONCILIATION', 46, currentY + 8);

  const totalBusiness = closing ? parseFloat(closing.totalBusiness) : stockRecords.reduce((acc, r) => acc + (parseFloat(r.saleAmount) || 0), 0);
  const totalStockValue = stockRecords.reduce((acc, r) => acc + ((parseInt(r.totalStock, 10) || 0) * (parseFloat(r.bottleRate) || 0)), 0);
  const onlineCol = closing ? parseFloat(closing.onlineCollection) : 0;
  const offlineCol = closing ? parseFloat(closing.offlineCollection) : 0;
  const totalCol = closing ? parseFloat(closing.totalCollected) : (onlineCol + offlineCol);
  const totalExp = closing ? parseFloat(closing.totalExpenses) : expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const finalAmt = closing ? parseFloat(closing.finalAmount) : (totalCol - totalExp);
  const colDiff = closing ? parseFloat(closing.collectionDifference) : (totalCol - totalBusiness);
  const extraAmt = closing ? parseFloat(closing.extraAmountInformational) : stockRecords.reduce((acc, r) => acc + (parseFloat(r.extraAmount) || 0), 0);

  // Column 1: Sales Business & Inventory Valuation
  doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
     .text('Total Daily Business (Revenue):', 46, currentY + 22)
     .font('Helvetica-Bold').fillColor('#0f172a')
     .text(formatINR(totalBusiness), 46, currentY + 32);

  if (totalStockValue > 0) {
    doc.font('Helvetica').fillColor('#64748b')
       .text('Total Stock Valuation (Available):', 46, currentY + 44)
       .font('Helvetica-Bold').fillColor('#475569')
       .text(formatINR(totalStockValue), 46, currentY + 54);
  }

  doc.font('Helvetica').fillColor('#64748b')
     .text('Bottles Sold / In Stock:', 46, currentY + 66)
     .font('Helvetica-Bold').fillColor('#0f172a')
     .text(`${closing ? formatNumber(closing.totalBottlesSold) : '-'} / ${closing ? formatNumber(closing.totalBottlesRemaining) : '-'}`, 46, currentY + 76);

  // Column 2: Collections
  doc.font('Helvetica').fillColor('#64748b')
     .text('Online Collection:', 220, currentY + 22)
     .font('Helvetica-Bold').fillColor('#0f172a')
     .text(formatINR(onlineCol), 220, currentY + 32);

  doc.font('Helvetica').fillColor('#64748b')
     .text('Offline / Cash Collection:', 220, currentY + 48)
     .font('Helvetica-Bold').fillColor('#0f172a')
     .text(formatINR(offlineCol), 220, currentY + 58);

  // Column 3: Reconciliations
  doc.font('Helvetica').fillColor('#64748b')
     .text('Total Collected:', 395, currentY + 22)
     .font('Helvetica-Bold').fillColor('#059669')
     .text(formatINR(totalCol), 395, currentY + 32);

  doc.font('Helvetica').fillColor('#64748b')
     .text('Total Expenses Deducted:', 395, currentY + 48)
     .font('Helvetica-Bold').fillColor('#dc2626')
     .text(formatINR(totalExp), 395, currentY + 58);

  currentY += 98;

  // Final Net Row
  doc.rect(36, currentY, 523, 26).fill('#0f172a');
  doc.fillColor('#f8fafc').fontSize(8.5).font('Helvetica-Bold')
     .text('FINAL NET CASH IN DRAWER: ' + formatINR(finalAmt), 46, currentY + 8);
  doc.fillColor(colDiff >= 0 ? '#34d399' : '#f87171').fontSize(8.5).font('Helvetica-Bold')
     .text(`Collection Diff: ${formatINR(colDiff)} (${colDiff >= 0 ? 'Surplus' : 'Deficit'})`, 350, currentY + 8, { width: 195, align: 'right' });

  currentY += 34;

  // Informational Extra Amount note
  doc.rect(36, currentY, 523, 22).fill('#f1f5f9');
  doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
     .text(`* Informational Extra Amount: ${formatINR(extraAmt)} (strictly excluded from sales business and final collections).`, 46, currentY + 6);

  currentY += 28;

  // Closing Sign-off Audit details
  if (closing) {
    doc.rect(36, currentY, 523, 26).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
       .text(`Closed By: ${closing.closedBy || 'Authorized Manager'}  |  Timestamp: ${new Date(closing.closedAt).toLocaleString()}`, 46, currentY + 5);
    if (closing.notes) {
      doc.text(`Closing Notes: ${closing.notes}`, 46, currentY + 15);
    }
    currentY += 32;
  }

  // 4. Itemized Expenses Breakdown Table
  if (expenses.length > 0) {
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
       .text(`ITEMIZED EXPENSES (${expenses.length} records)`, 36, currentY);
    currentY += 12;

    doc.rect(36, currentY, 523, 16).fill('#334155');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('Category', 42, currentY + 4, { width: 90 });
    doc.text('Description', 140, currentY + 4, { width: 190 });
    doc.text('Mode', 340, currentY + 4, { width: 60 });
    doc.text('Recipient', 410, currentY + 4, { width: 70 });
    doc.text('Amount (INR)', 485, currentY + 4, { width: 70, align: 'right' });
    currentY += 16;

    expenses.forEach((exp, idx) => {
      if (currentY > 740) {
        doc.addPage();
        currentY = 40;
      }
      const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(36, currentY, 523, 14).fill(bg);
      doc.rect(36, currentY + 13, 523, 1).fill('#f1f5f9');

      doc.fillColor('#1e293b').fontSize(7).font('Helvetica');
      doc.text(exp.category || '-', 42, currentY + 3, { width: 90 });
      doc.text(exp.description || '-', 140, currentY + 3, { width: 190 });
      doc.text(exp.paymentMethod || 'CASH', 340, currentY + 3, { width: 60 });
      doc.text(exp.recipient || '-', 410, currentY + 3, { width: 70 });
      doc.font('Helvetica-Bold').text(parseFloat(exp.amount).toFixed(2), 485, currentY + 3, { width: 70, align: 'right' });
      currentY += 14;
    });

    currentY += 10;
  }

  // 5. Itemized Stock Breakdown Table
  if (stockRecords.length > 0) {
    if (currentY > 580) {
      doc.addPage();
      currentY = 40;
    }

    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
       .text(`BRAND & SIZE STOCK BREAKDOWN (${stockRecords.length} items)`, 36, currentY);
    currentY += 12;

    const drawStockHeader = (y) => {
      doc.rect(36, y, 523, 16).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold');
      doc.text('S.No', 38, y + 4, { width: 20 });
      doc.text('Brand', 60, y + 4, { width: 115 });
      doc.text('Size', 178, y + 4, { width: 38 });
      doc.text('Opn', 218, y + 4, { width: 22, align: 'right' });
      doc.text('Ind', 242, y + 4, { width: 22, align: 'right' });
      doc.text('Tot', 266, y + 4, { width: 24, align: 'right' });
      doc.text('Cls', 292, y + 4, { width: 22, align: 'right' });
      doc.text('Sale', 316, y + 4, { width: 22, align: 'right' });
      doc.text('Rate', 340, y + 4, { width: 36, align: 'right' });
      doc.text('Stock Val', 378, y + 4, { width: 54, align: 'right' });
      doc.text('Amount', 434, y + 4, { width: 54, align: 'right' });
      doc.text('Extra', 490, y + 4, { width: 32, align: 'right' });
      return y + 16;
    };

    currentY = drawStockHeader(currentY);

    stockRecords.forEach((r, idx) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = drawStockHeader(40);
      }

      const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.rect(36, currentY, 523, 13).fill(bg);
      doc.rect(36, currentY + 12, 523, 1).fill('#e2e8f0');

      const brandName = (r.brand && r.brand.name) || r.brandName || `Item #${idx + 1}`;
      const sizeName = (r.size && (r.size.name || r.size.code)) || r.sizeName || '-';
      const op = parseInt(r.openingStock, 10) || 0;
      const ind = parseInt(r.indentStock, 10) || 0;
      const tot = parseInt(r.totalStock, 10) || (op + ind);
      const cls = parseInt(r.closingStock, 10) || 0;
      const sl = parseInt(r.saleCount, 10) || 0;
      const rt = parseFloat(r.bottleRate || 0);
      const sv = tot * rt;
      const sa = parseFloat(r.saleAmount || 0) || (sl * rt);
      const ex = parseFloat(r.extraAmount || 0);

      doc.fillColor('#1e293b').fontSize(6.5).font('Helvetica');
      doc.text(String(r.brand?.serialNo || idx + 1), 38, currentY + 3, { width: 20 });
      doc.font('Helvetica-Bold').text(brandName, 60, currentY + 3, { width: 115 });
      doc.font('Helvetica').text(sizeName, 178, currentY + 3, { width: 38 });
      doc.text(String(op), 218, currentY + 3, { width: 22, align: 'right' });
      doc.text(String(ind), 242, currentY + 3, { width: 22, align: 'right' });
      doc.text(String(tot), 266, currentY + 3, { width: 24, align: 'right' });
      doc.text(String(cls), 292, currentY + 3, { width: 22, align: 'right' });
      doc.font('Helvetica-Bold').text(String(sl), 316, currentY + 3, { width: 22, align: 'right' });
      doc.font('Helvetica').text(rt.toFixed(2), 340, currentY + 3, { width: 36, align: 'right' });
      doc.font('Helvetica-Bold').text(sv.toFixed(2), 378, currentY + 3, { width: 54, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#059669').text(sa.toFixed(2), 434, currentY + 3, { width: 54, align: 'right' });
      doc.font('Helvetica').fillColor('#64748b').text(ex > 0 ? ex.toFixed(2) : '-', 490, currentY + 3, { width: 32, align: 'right' });

      currentY += 13;
    });
  }

  // Footer on all pages
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
       .text(`Page ${i + 1} of ${pages.count}  •  ${shopName}  •  Business Date: ${businessDate}  •  Status: ${status}`, 36, 792, { width: 523, align: 'center' });
  }

  doc.end();
};

module.exports = {
  generateClosingReportPdf
};
