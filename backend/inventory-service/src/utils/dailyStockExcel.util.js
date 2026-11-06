const ExcelJS = require('exceljs');

const formatNumber = (val) => parseInt(val, 10) || 0;
const formatFloat = (val) => parseFloat(val) || 0;

/**
 * Generates an Excel (.xlsx) workbook stream for Daily Stock Sheet
 */
const generateDailyStockExcel = async (data, res) => {
  const {
    shopName = 'Wine Shop',
    shopCode = 'SHOP',
    businessDate,
    records = []
  } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Wine Shop Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Daily Stock Sheet', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // 1. Title Banner
  worksheet.mergeCells('A1:Q1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = 'WINE SHOP MANAGEMENT SYSTEM — DAILY STOCK SHEET';
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 28;

  // 2. Metadata row
  worksheet.mergeCells('A2:Q2');
  const metaRow = worksheet.getCell('A2');
  metaRow.value = `Shop: ${shopName} (${shopCode})  |  Business Date: ${businessDate}  |  Generated: ${new Date().toLocaleString('en-IN')}`;
  metaRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  metaRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  metaRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  worksheet.addRow([]); // Blank spacer

  // 3. Table Column Headers
  const headers = [
    'Shop',
    'Business Date',
    'S.No',
    'Brand Name',
    'Size',
    'Opening',
    'Indent',
    'Total Quantity',
    'Closing',
    'Sale',
    'Rate (INR)',
    'Stock Value (INR)',
    'Bottle Sales Amount (INR)',
    'Extra Per Bottle (INR)',
    'Extra Amount (INR)',
    'Remaining Stock Value (INR)',
    'Status'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FFD97706' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  // 4. Data Rows
  let totalOpening = 0;
  let totalIndent = 0;
  let totalAvailable = 0;
  let totalClosing = 0;
  let totalSale = 0;
  let totalStockValue = 0;
  let totalSalesAmount = 0;
  let totalRemainingStockValue = 0;
  let totalExtraAmount = 0;
  let allCompleted = records.length > 0;

  records.forEach((r, idx) => {
    const opening = formatNumber(r.openingStock);
    const indent = formatNumber(r.indentStock);
    const total = formatNumber(r.totalStock) || (opening + indent);
    const hasClosing = r.closingStock !== '' && r.closingStock !== null && r.closingStock !== undefined;
    const closing = hasClosing ? formatNumber(r.closingStock) : 0;
    const sale = formatNumber(r.saleCount);
    const rate = formatFloat(r.bottleRate);
    const stockValue = total * rate;
    const saleAmount = formatFloat(r.saleAmount) || (sale * rate);
    const remainingStockValue = hasClosing ? closing * rate : null;
    const extraPerBtl = formatFloat(r.extraPerBottle);
    const extra = extraPerBtl > 0 ? (sale * extraPerBtl) : formatFloat(r.extraAmount);

    totalOpening += opening;
    totalIndent += indent;
    totalAvailable += total;
    if (hasClosing) {
      totalClosing += closing;
      totalRemainingStockValue += remainingStockValue;
    } else {
      allCompleted = false;
    }
    totalSale += sale;
    totalStockValue += stockValue;
    totalSalesAmount += saleAmount;
    totalExtraAmount += extra;

    const brandName = (r.brand && r.brand.name) || r.brandName || `Brand #${idx + 1}`;
    const sizeName = (r.size && (r.size.name || r.size.code)) || r.sizeName || '-';
    const sNo = r.brand?.serialNo || (idx + 1);

    const row = worksheet.addRow([
      shopCode,
      businessDate,
      sNo,
      brandName,
      sizeName,
      opening,
      indent,
      total,
      hasClosing ? closing : 'Pending',
      sale,
      rate,
      stockValue,
      saleAmount,
      extraPerBtl,
      extra,
      hasClosing ? remainingStockValue : 'Pending',
      r.status || 'DRAFT'
    ]);

    row.height = 18;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Alignments & Number formats
      if (colNumber === 1 || colNumber === 2 || colNumber === 17) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { bold: true };
      } else if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { bold: true };
      } else if (colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber >= 6 && colNumber <= 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (colNumber === 9 && !hasClosing) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { italic: true, color: { argb: 'FFD97706' } };
        } else {
          cell.numFmt = '#,##0';
        }
        if (colNumber === 10) cell.font = { bold: true, color: { argb: 'FFD97706' } };
      } else if (colNumber >= 11 && colNumber <= 16) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (colNumber === 16 && !hasClosing) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { italic: true, color: { argb: 'FFD97706' } };
        } else {
          cell.numFmt = '₹#,##0.00';
        }
        if (colNumber === 12) cell.font = { bold: true, color: { argb: 'FF1E293B' } }; // Stock Value
        if (colNumber === 13) cell.font = { bold: true, color: { argb: 'FF059669' } }; // Bottle Sales Amount
        if (colNumber === 14) cell.font = { bold: true, color: { argb: 'FFD97706' } }; // Extra Per Bottle
        if (colNumber === 15) cell.font = { bold: true, color: { argb: 'FF64748B' } }; // Extra Amount
        if (colNumber === 16 && hasClosing) cell.font = { bold: true, color: { argb: 'FF4338CA' } }; // Remaining Stock Value
      }
    });
  });

  // Group contiguous brand rows and merge S.No (Col C / 3) and Brand Name (Col D / 4)
  const brandGroups = [];
  records.forEach((r, idx) => {
    const brandId = r.brandId || r.brand?.id || (r.brand && r.brand.name) || r.brandName || idx;
    const lastGroup = brandGroups[brandGroups.length - 1];
    if (lastGroup && lastGroup.brandId === brandId) {
      lastGroup.endIdx = idx;
      lastGroup.count++;
    } else {
      brandGroups.push({
        brandId,
        startIdx: idx,
        endIdx: idx,
        count: 1
      });
    }
  });

  const startRowNumber = 5; // Header is row 4, first data row is row 5

  brandGroups.forEach(group => {
    const fromRow = startRowNumber + group.startIdx;
    const toRow = startRowNumber + group.endIdx;

    if (group.count > 1) {
      // Merge S.No (Col 3 / C)
      worksheet.mergeCells(`C${fromRow}:C${toRow}`);
      const snoCell = worksheet.getCell(`C${fromRow}`);
      snoCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Merge Brand Name (Col 4 / D)
      worksheet.mergeCells(`D${fromRow}:D${toRow}`);
      const brandCell = worksheet.getCell(`D${fromRow}`);
      brandCell.alignment = { vertical: 'middle', horizontal: 'left' };
    }

    // Set distinct border under the last row of each brand group
    const lastRow = worksheet.getRow(toRow);
    for (let c = 1; c <= 17; c++) {
      const cell = lastRow.getCell(c);
      cell.border = {
        ...cell.border,
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }
      };
    }
  });

  // 5. Daily Totals Row (Totals Grid)
  const totalsRow = worksheet.addRow([
    'DAILY TOTALS',
    '',
    '',
    '',
    '',
    totalOpening,
    totalIndent,
    totalAvailable,
    totalClosing,
    totalSale,
    '',
    totalStockValue,
    totalSalesAmount,
    '',
    totalExtraAmount,
    totalRemainingStockValue,
    allCompleted ? 'COMPLETED' : 'PENDING'
  ]);
  totalsRow.height = 24;

  worksheet.mergeCells(`A${totalsRow.number}:E${totalsRow.number}`);

  totalsRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
    if (colNumber === 1) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (colNumber >= 6 && colNumber <= 10) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else if (colNumber >= 12 && colNumber <= 16) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '₹#,##0.00';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  worksheet.addRow([]); // Blank spacer

  // 6. Executive Summary Card Section
  const summaryHeaderRow = worksheet.addRow(['EXECUTIVE STOCK & SALES VALUATION SUMMARY']);
  summaryHeaderRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  summaryHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  worksheet.mergeCells(`A${summaryHeaderRow.number}:F${summaryHeaderRow.number}`);

  const isReconciled = allCompleted && Math.abs(totalStockValue - (totalSalesAmount + totalRemainingStockValue)) < 0.05;
  const combinedTotal = totalSalesAmount + totalExtraAmount;

  const summaryItems = [
    ['Total Opening Bottles:', totalOpening, '#,##0'],
    ['Total Indent Bottles:', totalIndent, '#,##0'],
    ['Total Available Bottles (Opening + Indent):', totalAvailable, '#,##0'],
    ['Total Closing Bottles Remaining:', totalClosing, '#,##0'],
    ['Total Bottles Sold:', totalSale, '#,##0'],
    ['Total Available Stock Valuation (Total Qty × Rate):', totalStockValue, '₹#,##0.00'],
    ['Total Daily Bottle Sales Amount (Revenue):', totalSalesAmount, '₹#,##0.00'],
    ['Total Remaining Stock Valuation (Closing Qty × Rate):', totalRemainingStockValue, '₹#,##0.00'],
    ['Reconciliation Identity (Stock Value = Sales + Remaining):', isReconciled ? 'VERIFIED (Exact Match)' : 'PENDING (Unentered Closings)', '@'],
    ['Total Extra Amount (Recorded Separately):', totalExtraAmount, '₹#,##0.00'],
    ['Combined Informational Total (Sales + Extra Amount):', combinedTotal, '₹#,##0.00'],
    ['Sales & Extra Amount Breakdown Formula:', `Bottle Sales Amount (₹${totalSalesAmount.toFixed(2)}) + Extra Total Amount (₹${totalExtraAmount.toFixed(2)}) = Combined Total Amount (₹${combinedTotal.toFixed(2)})`, '@']
  ];

  summaryItems.forEach(([label, value, numFmt]) => {
    const sRow = worksheet.addRow([label, '', '', '', value]);
    worksheet.mergeCells(`A${sRow.number}:D${sRow.number}`);
    worksheet.mergeCells(`E${sRow.number}:F${sRow.number}`);
    sRow.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
    sRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    sRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    const isSales = label.includes('Bottle Sales Amount');
    const isRemaining = label.includes('Remaining Stock');
    const isReconcile = label.includes('Reconciliation');
    const isCombined = label.includes('Combined Informational Total');

    const valCell = sRow.getCell(5);
    valCell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: isSales
        ? { argb: 'FF059669' }
        : isRemaining
        ? { argb: 'FF4338CA' }
        : isCombined
        ? { argb: 'FF0F172A' }
        : isReconcile
        ? (isReconciled ? { argb: 'FF059669' } : { argb: 'FFD97706' })
        : { argb: 'FF1E293B' }
    };
    valCell.numFmt = numFmt;
    valCell.alignment = { vertical: 'middle', horizontal: (isReconcile || typeof value === 'string') ? 'center' : 'right' };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });

  const noteRow = worksheet.addRow(['* Notice: Total Stock Value represents available inventory valuation before deducting sales. Total Bottle Sales Amount represents official daily gross sales revenue. Total Remaining Stock Value represents inventory on hand at close. Total Stock Value = Total Bottle Sales Amount + Total Remaining Stock Value. Extra Amount is calculated automatically (Sale Quantity × Extra Per Bottle) and recorded separately for tracking, strictly excluded from official closing revenue & collections.']);
  worksheet.mergeCells(`A${noteRow.number}:Q${noteRow.number}`);
  noteRow.getCell(1).font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: 'FF64748B' } };

  // 7. Column Widths
  worksheet.columns = [
    { width: 12 }, // Shop
    { width: 14 }, // Business Date
    { width: 8 },  // S.No
    { width: 28 }, // Brand Name
    { width: 12 }, // Size
    { width: 12 }, // Opening
    { width: 12 }, // Indent
    { width: 16 }, // Total Quantity
    { width: 12 }, // Closing
    { width: 12 }, // Sale
    { width: 14 }, // Rate
    { width: 20 }, // Stock Value
    { width: 22 }, // Bottle Sales Amount
    { width: 18 }, // Extra Per Bottle
    { width: 18 }, // Extra Amount
    { width: 22 }, // Remaining Stock Value
    { width: 14 }  // Status
  ];

  // Write workbook to HTTP stream if res provided
  if (res) {
    await workbook.xlsx.write(res);
  }
  return workbook;
};

module.exports = {
  generateDailyStockExcel
};
