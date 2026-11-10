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
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

  // Helper to draw table header
  const drawTableHeader = (startY) => {
    doc.rect(30, startY, 782, 22).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');

    const cols = [
      { text: 'S.No', x: 35, width: 22, align: 'left' },
      { text: 'Brand Name', x: 58, width: 130, align: 'left' },
      { text: 'Size', x: 190, width: 60, align: 'left' },
      { text: 'Opening', x: 252, width: 34, align: 'right' },
      { text: 'Indent', x: 288, width: 34, align: 'right' },
      { text: 'Total', x: 324, width: 34, align: 'right' },
      { text: 'Closing', x: 360, width: 36, align: 'right' },
      { text: 'Sale', x: 398, width: 32, align: 'right' },
      { text: 'Rate (INR)', x: 432, width: 40, align: 'right' },
      { text: 'Stock Value', x: 474, width: 68, align: 'right' },
      { text: 'Sales Amount', x: 544, width: 72, align: 'right' },
      { text: 'Extra/Btl', x: 618, width: 48, align: 'right' },
      { text: 'Extra Amt', x: 668, width: 54, align: 'right' },
      { text: 'Remaining Val', x: 724, width: 76, align: 'right' }
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

  // Group contiguous brand rows for unified brand rendering
  const brandGroups = [];
  records.forEach((r, idx) => {
    const brandId = r.brandId || r.brand?.id || (r.brand && r.brand.name) || r.brandName || idx;
    const lastGroup = brandGroups[brandGroups.length - 1];
    if (lastGroup && lastGroup.brandId === brandId) {
      lastGroup.records.push({ ...r, origIdx: idx });
    } else {
      brandGroups.push({
        brandId,
        brandName: (r.brand && r.brand.name) || r.brandName || `Item #${idx + 1}`,
        serialNo: r.brand?.serialNo || (idx + 1),
        records: [{ ...r, origIdx: idx }]
      });
    }
  });

  brandGroups.forEach((group, gIdx) => {
    const groupCount = group.records.length;
    const groupHeight = groupCount * 16;

    // Page break check: if brand group won't fit on this page, push to next page
    if (tableY + groupHeight > 520 && tableY > 120) {
      doc.addPage();
      tableY = drawTableHeader(30);
    }

    const groupStartY = tableY;
    const isEven = gIdx % 2 === 0;
    const rowBg = isEven ? '#f8fafc' : '#ffffff';

    // Draw background for entire brand block
    doc.rect(30, groupStartY, 782, groupHeight).fill(rowBg);

    group.records.forEach((r, rIdx) => {
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
      const extraPerBtl = parseFloat(r.extraPerBottle) || 0;
      const extra = extraPerBtl > 0 ? (sale * extraPerBtl) : (parseFloat(r.extraAmount) || 0);

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

      const sizeName = (r.size && (r.size.name || r.size.code)) || r.sizeName || '-';

      // Row divider: bottom of brand group gets prominent line, sizes get subtle line
      if (rIdx === groupCount - 1) {
        doc.rect(30, tableY + 15, 782, 1).fill('#94a3b8');
      } else {
        doc.rect(190, tableY + 15, 622, 0.5).fill('#e2e8f0');
      }

      // Render size and financial metrics
      doc.fillColor('#6b21a8').fontSize(7.5).font('Helvetica-Bold');
      doc.text(sizeName, 190, tableY + 4, { width: 60, align: 'left' });

      doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');
      doc.text(formatNumber(opening), 252, tableY + 4, { width: 34, align: 'right' });
      doc.text(formatNumber(indent), 288, tableY + 4, { width: 34, align: 'right' });
      doc.text(formatNumber(total), 324, tableY + 4, { width: 34, align: 'right' });
      if (hasClosing) {
        doc.text(formatNumber(closing), 360, tableY + 4, { width: 36, align: 'right' });
      } else {
        doc.font('Helvetica-Oblique').fillColor('#b45309').text('Pending', 360, tableY + 4, { width: 36, align: 'right' });
        doc.font('Helvetica').fillColor('#1e293b');
      }
      doc.font('Helvetica-Bold').text(formatNumber(sale), 398, tableY + 4, { width: 32, align: 'right' });
      doc.font('Helvetica').text(rate.toFixed(2), 432, tableY + 4, { width: 40, align: 'right' });
      doc.font('Helvetica-Bold').text(stockValue.toFixed(2), 474, tableY + 4, { width: 68, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#059669').text(amount.toFixed(2), 544, tableY + 4, { width: 72, align: 'right' });
      doc.font('Helvetica').fillColor('#64748b').text(extraPerBtl > 0 ? extraPerBtl.toFixed(2) : '-', 618, tableY + 4, { width: 48, align: 'right' });
      doc.font('Helvetica').fillColor('#64748b').text(extra > 0 ? extra.toFixed(2) : '-', 668, tableY + 4, { width: 54, align: 'right' });
      if (hasClosing) {
        doc.font('Helvetica-Bold').fillColor('#4338ca').text(remainingStockValue.toFixed(2), 724, tableY + 4, { width: 76, align: 'right' });
      } else {
        doc.font('Helvetica-Oblique').fillColor('#b45309').text('Pending', 724, tableY + 4, { width: 76, align: 'right' });
      }

      tableY += 16;
    });

    // Render S.No and Brand Name once for the entire brand, vertically centered!
    const centerY = groupStartY + Math.max(3, (groupHeight - 10) / 2);

    doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
       .text(String(group.serialNo), 35, centerY, { width: 22, align: 'left' });

    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
       .text(group.brandName, 58, centerY, { width: 130, align: 'left' });

    // Vertical column divider between S.No and Brand Name
    doc.rect(56, groupStartY, 0.5, groupHeight).fill('#e2e8f0');

    // Vertical column divider between Brand Name and Size
    doc.rect(188, groupStartY, 0.5, groupHeight).fill('#cbd5e1');
  });

  // Totals Row (Totals Grid)
  if (tableY > 460) {
    doc.addPage();
    tableY = drawTableHeader(30);
  }

  doc.rect(30, tableY, 782, 22).fill('#0f172a');
  doc.rect(30, tableY, 782, 1.5).fill('#334155');
  doc.rect(30, tableY + 21, 782, 1.5).fill('#334155');

  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
  doc.text('DAILY TOTALS', 35, tableY + 6, { width: 215, align: 'left' });
  doc.text(formatNumber(totalOpening), 252, tableY + 6, { width: 34, align: 'right' });
  doc.text(formatNumber(totalIndent), 288, tableY + 6, { width: 34, align: 'right' });
  doc.text(formatNumber(totalStock), 324, tableY + 6, { width: 34, align: 'right' });
  doc.text(formatNumber(totalClosing), 360, tableY + 6, { width: 36, align: 'right' });
  doc.text(formatNumber(totalSale), 398, tableY + 6, { width: 32, align: 'right' });
  doc.text('-', 432, tableY + 6, { width: 40, align: 'right' });
  doc.text(formatINR(totalStockValue), 474, tableY + 6, { width: 68, align: 'right' });
  doc.text(formatINR(totalAmount), 544, tableY + 6, { width: 72, align: 'right' });
  doc.text('-', 618, tableY + 6, { width: 48, align: 'right' });
  doc.text(formatINR(totalExtra), 668, tableY + 6, { width: 54, align: 'right' });
  doc.text(formatINR(totalRemainingStockValue), 724, tableY + 6, { width: 76, align: 'right' });

  tableY += 28;

  // Financial summary & notes box
  const isReconciled = allCompleted && Math.abs(totalStockValue - (totalAmount + totalRemainingStockValue)) < 0.05;
  const reconcileText = allCompleted
    ? (isReconciled ? `RECONCILIATION VERIFIED: Stock Value (${formatINR(totalStockValue)}) = Sales (${formatINR(totalAmount)}) + Remaining Stock (${formatINR(totalRemainingStockValue)})` : 'RECONCILIATION DISCREPANCY DETECTED')
    : 'RECONCILIATION PENDING: Full reconciliation will verify once all closing counts are entered';

  if (tableY > 460) {
    doc.addPage();
    tableY = 30;
  }

  doc.rect(30, tableY, 782, 68).fill('#f8fafc');
  doc.rect(30, tableY, 782, 68).stroke('#cbd5e1');
  doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
     .text(`Total Stock Value: ${formatINR(totalStockValue)}  |  Total Bottle Sales Amount (Revenue): ${formatINR(totalAmount)}  |  Remaining Stock Value: ${formatINR(totalRemainingStockValue)}`, 40, tableY + 6);
  doc.fillColor(isReconciled ? '#059669' : '#b45309').fontSize(8).font('Helvetica-Bold')
     .text(reconcileText, 40, tableY + 19);
  doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold')
     .text(`Total Bottle Sales Amount: ${formatINR(totalAmount)}  |  Total Extra Amount: ${formatINR(totalExtra)}  (Tracked Separately • Not added to Grand Total)`, 40, tableY + 32);
  doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
     .text(`Available Bottles: ${formatNumber(totalStock)}  |  Sold: ${formatNumber(totalSale)}  |  Closing: ${formatNumber(totalClosing)}  |  Extra Amount Formula: Sale Qty × Extra Per Bottle`, 40, tableY + 45);
  doc.fillColor('#64748b').fontSize(7).font('Helvetica-Oblique')
     .text('* NOTE: Sales Amount represents official daily gross revenue. Extra Amount is recorded separately and strictly excluded from official closing revenue & collections. Stock Value and Remaining Stock Value are inventory asset valuations.', 40, tableY + 56);

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
