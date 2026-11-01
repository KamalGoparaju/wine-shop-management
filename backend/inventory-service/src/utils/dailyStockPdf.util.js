const PDFDocument = require('pdfkit');

const formatINR = (val) => {
  const num = parseFloat(val) || 0;
  return 'INR ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (val) => {
  const num = parseInt(val, 10) || 0;
  return num.toLocaleString('en-IN');
};

const generateDailyStockPdf = (data, stream) => {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
    bufferPages: true
  });

  doc.pipe(stream);

  const {
    shopName = 'Wine Shop',
    shopCode = 'SHOP',
    businessDate,
    isCompleted = false,
    isLocked = false,
    records = []
  } = data;

  const statusLabel = isLocked ? 'LOCKED' : (isCompleted ? 'COMPLETED' : 'DRAFT / INCOMPLETE');
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'UTC' }) + ' UTC';

  // Helper to draw table header
  const drawTableHeader = (startY) => {
    doc.rect(30, startY, 782, 22).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');

    const cols = [
      { text: 'S.No', x: 35, width: 22, align: 'left' },
      { text: 'Brand Name', x: 60, width: 145, align: 'left' },
      { text: 'Size', x: 208, width: 38, align: 'left' },
      { text: 'Opening', x: 248, width: 36, align: 'right' },
      { text: 'Indent', x: 286, width: 36, align: 'right' },
      { text: 'Total', x: 324, width: 36, align: 'right' },
      { text: 'Closing', x: 362, width: 38, align: 'right' },
      { text: 'Sale', x: 402, width: 34, align: 'right' },
      { text: 'Rate (INR)', x: 438, width: 44, align: 'right' },
      { text: 'Stock Value', x: 484, width: 72, align: 'right' },
      { text: 'Sales Amount', x: 558, width: 74, align: 'right' },
      { text: 'Remaining Val', x: 634, width: 84, align: 'right' },
      { text: 'Extra Amt', x: 720, width: 55, align: 'right' }
    ];

    cols.forEach(col => {
      doc.text(col.text, col.x, startY + 6, { width: col.width, align: col.align });
    });

    return startY + 22;
  };

  // Helper to draw document title and header banner
  const drawPageHeader = () => {
    // Header banner
    doc.rect(30, 25, 782, 50).fill('#0f172a');
    doc.fillColor('#f59e0b').fontSize(14).font('Helvetica-Bold')
       .text('WINE SHOP MANAGEMENT SYSTEM', 45, 33);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
       .text('DAILY STOCK SHEET REPORT', 45, 52);

    // Shop info & Date
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
       .text(`${shopName} (${shopCode})`, 450, 33, { width: 350, align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
       .text(`Business Date: ${businessDate}  |  Status: ${statusLabel}`, 450, 48, { width: 350, align: 'right' });
    doc.text(`Generated: ${generatedAt}`, 450, 60, { width: 350, align: 'right' });

    let currentY = 82;

    // Draft / Incomplete Warning banner if applicable
    if (!isCompleted) {
      doc.rect(30, currentY, 782, 18).fill('#fef3c7');
      doc.fillColor('#b45309').fontSize(8).font('Helvetica-Bold')
         .text('WARNING: DRAFT / INCOMPLETE STOCK SHEET — Values are preliminary and not yet closed.', 40, currentY + 5, { width: 760, align: 'center' });
      currentY += 24;
    }

    return currentY;
  };

  let tableY = drawPageHeader();
  tableY = drawTableHeader(tableY);

  let totalOpening = 0;
  let totalIndent = 0;
  let totalStock = 0;
  let totalClosing = 0;
  let totalSale = 0;
  let totalStockValue = 0;
  let totalAmount = 0;
  let totalRemainingStockValue = 0;
  let totalExtra = 0;
  let allCompleted = records.length > 0;

  records.forEach((r, idx) => {
    const opening = parseInt(r.openingStock, 10) || 0;
    const indent = parseInt(r.indentStock, 10) || 0;
    const total = parseInt(r.totalStock, 10) || (opening + indent);
    const hasClosing = r.closingStock !== '' && r.closingStock !== null && r.closingStock !== undefined;
    const closing = hasClosing ? (parseInt(r.closingStock, 10) || 0) : 0;
    const sale = parseInt(r.saleCount, 10) || 0;
    const rate = parseFloat(r.bottleRate) || 0;
    const stockValue = total * rate;
    const amount = parseFloat(r.saleAmount) || (sale * rate);
    const remainingStockValue = hasClosing ? (closing * rate) : null;
    const extra = parseFloat(r.extraAmount) || 0;

    totalOpening += opening;
    totalIndent += indent;
    totalStock += total;
    if (hasClosing) {
      totalClosing += closing;
      totalRemainingStockValue += remainingStockValue;
    } else {
      allCompleted = false;
    }
    totalSale += sale;
    totalStockValue += stockValue;
    totalAmount += amount;
    totalExtra += extra;

    // Page break check
    if (tableY > 520) {
      doc.addPage();
      tableY = drawTableHeader(30);
    }

    const rowBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    doc.rect(30, tableY, 782, 16).fill(rowBg);
    doc.rect(30, tableY + 15, 782, 1).fill('#e2e8f0');

    doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');

    const brandName = (r.brand && r.brand.name) || r.brandName || `Item #${idx + 1}`;
    const sizeName = (r.size && (r.size.name || r.size.code)) || r.sizeName || '-';

    doc.text(String(r.brand?.serialNo || idx + 1), 35, tableY + 4, { width: 22, align: 'left' });
    doc.font('Helvetica-Bold').text(brandName, 60, tableY + 4, { width: 145, align: 'left' });
    doc.font('Helvetica').text(sizeName, 208, tableY + 4, { width: 38, align: 'left' });

    doc.text(formatNumber(opening), 248, tableY + 4, { width: 36, align: 'right' });
    doc.text(formatNumber(indent), 286, tableY + 4, { width: 36, align: 'right' });
    doc.text(formatNumber(total), 324, tableY + 4, { width: 36, align: 'right' });
    if (hasClosing) {
      doc.text(formatNumber(closing), 362, tableY + 4, { width: 38, align: 'right' });
    } else {
      doc.font('Helvetica-Oblique').fillColor('#b45309').text('Pending', 362, tableY + 4, { width: 38, align: 'right' });
      doc.font('Helvetica').fillColor('#1e293b');
    }
    doc.font('Helvetica-Bold').text(formatNumber(sale), 402, tableY + 4, { width: 34, align: 'right' });
    doc.font('Helvetica').text(rate.toFixed(2), 438, tableY + 4, { width: 44, align: 'right' });
    doc.font('Helvetica-Bold').text(stockValue.toFixed(2), 484, tableY + 4, { width: 72, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#059669').text(amount.toFixed(2), 558, tableY + 4, { width: 74, align: 'right' });
    if (hasClosing) {
      doc.font('Helvetica-Bold').fillColor('#4338ca').text(remainingStockValue.toFixed(2), 634, tableY + 4, { width: 84, align: 'right' });
    } else {
      doc.font('Helvetica-Oblique').fillColor('#b45309').text('Pending', 634, tableY + 4, { width: 84, align: 'right' });
    }
    doc.font('Helvetica').fillColor('#64748b').text(extra > 0 ? extra.toFixed(2) : '-', 720, tableY + 4, { width: 55, align: 'right' });

    tableY += 16;
  });

  // Totals Row
  if (tableY > 480) {
    doc.addPage();
    tableY = 30;
  }

  doc.rect(30, tableY, 782, 22).fill('#334155');
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('TOTALS', 35, tableY + 6, { width: 210, align: 'left' });
  doc.text(formatNumber(totalOpening), 248, tableY + 6, { width: 36, align: 'right' });
  doc.text(formatNumber(totalIndent), 286, tableY + 6, { width: 36, align: 'right' });
  doc.text(formatNumber(totalStock), 324, tableY + 6, { width: 36, align: 'right' });
  doc.text(formatNumber(totalClosing), 362, tableY + 6, { width: 38, align: 'right' });
  doc.text(formatNumber(totalSale), 402, tableY + 6, { width: 34, align: 'right' });
  doc.text('-', 438, tableY + 6, { width: 44, align: 'right' });
  doc.text(formatINR(totalStockValue), 484, tableY + 6, { width: 72, align: 'right' });
  doc.text(formatINR(totalAmount), 558, tableY + 6, { width: 74, align: 'right' });
  doc.text(formatINR(totalRemainingStockValue), 634, tableY + 6, { width: 84, align: 'right' });
  doc.text(formatINR(totalExtra), 720, tableY + 6, { width: 55, align: 'right' });

  tableY += 28;

  // Financial summary & notes box
  const isReconciled = allCompleted && Math.abs(totalStockValue - (totalAmount + totalRemainingStockValue)) < 0.05;
  const reconcileText = allCompleted
    ? (isReconciled ? `RECONCILIATION VERIFIED: Stock Value (${formatINR(totalStockValue)}) = Sales (${formatINR(totalAmount)}) + Remaining Stock (${formatINR(totalRemainingStockValue)})` : 'RECONCILIATION DISCREPANCY DETECTED')
    : 'RECONCILIATION PENDING: Full reconciliation will verify once all closing counts are entered';

  doc.rect(30, tableY, 782, 54).fill('#f1f5f9');
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
     .text(`Total Stock Value: ${formatINR(totalStockValue)}  |  Total Sales: ${formatINR(totalAmount)}  |  Remaining Stock Value: ${formatINR(totalRemainingStockValue)}`, 40, tableY + 6);
  doc.fillColor(isReconciled ? '#059669' : '#b45309').fontSize(8).font('Helvetica-Bold')
     .text(reconcileText, 40, tableY + 20);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
     .text(`Available Bottles: ${formatNumber(totalStock)}  |  Sold: ${formatNumber(totalSale)}  |  Closing: ${formatNumber(totalClosing)}  |  Extra Amount (Info Only): ${formatINR(totalExtra)}`, 40, tableY + 32);
  doc.fillColor('#64748b').fontSize(7).font('Helvetica')
     .text('* IMPORTANT: Stock Value and Remaining Stock Value are inventory asset valuations, not revenue. Sales Amount represents actual revenue. Extra Amount is excluded from all reconciliations.', 40, tableY + 44);

  // Page numbering in footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
       .text(`Page ${i + 1} of ${pages.count}  •  ${shopName}  •  Business Date: ${businessDate}`, 30, 570, { width: 782, align: 'center' });
  }

  doc.end();
};

module.exports = {
  generateDailyStockPdf
};
