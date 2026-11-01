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
  worksheet.mergeCells('A1:P1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = 'WINE SHOP MANAGEMENT SYSTEM — DAILY STOCK SHEET';
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 28;

  // 2. Metadata row
  worksheet.mergeCells('A2:P2');
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
    'Sales Amount (INR)',
    'Remaining Stock Value (INR)',
    'Extra Amount',
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
    const extra = formatFloat(r.extraAmount);

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
      hasClosing ? remainingStockValue : 'Pending',
      extra,
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
      if (colNumber === 1 || colNumber === 2 || colNumber === 16) {
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
      } else if (colNumber >= 11 && colNumber <= 15) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (colNumber === 14 && !hasClosing) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { italic: true, color: { argb: 'FFD97706' } };
        } else {
          cell.numFmt = '₹#,##0.00';
        }
        if (colNumber === 12) cell.font = { bold: true, color: { argb: 'FF1E293B' } }; // Stock Value
        if (colNumber === 13) cell.font = { bold: true, color: { argb: 'FF059669' } }; // Sales Amount
        if (colNumber === 14 && hasClosing) cell.font = { bold: true, color: { argb: 'FF4338CA' } }; // Remaining Stock Value
      }
    });
  });

  // 5. Daily Totals Row
  const totalsRow = worksheet.addRow([
    'TOTALS',
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
    totalRemainingStockValue,
    totalExtraAmount,
    allCompleted ? 'COMPLETED' : 'PENDING'
  ]);
  totalsRow.height = 22;

  totalsRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
    if (colNumber >= 6 && colNumber <= 10) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else if (colNumber >= 12 && colNumber <= 15) {
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
  worksheet.mergeCells(`A${summaryHeaderRow.number}:D${summaryHeaderRow.number}`);

  const isReconciled = allCompleted && Math.abs(totalStockValue - (totalSalesAmount + totalRemainingStockValue)) < 0.05;

  const summaryItems = [
    ['Total Opening Bottles:', totalOpening, '#,##0'],
    ['Total Indent Bottles:', totalIndent, '#,##0'],
    ['Total Available Bottles (Opening + Indent):', totalAvailable, '#,##0'],
    ['Total Closing Bottles Remaining:', totalClosing, '#,##0'],
    ['Total Bottles Sold:', totalSale, '#,##0'],
    ['Total Available Stock Valuation (Total Qty × Rate):', totalStockValue, '₹#,##0.00'],
    ['Total Daily Sales Amount (Bottles Sold × Rate):', totalSalesAmount, '₹#,##0.00'],
    ['Total Remaining Stock Valuation (Closing Qty × Rate):', totalRemainingStockValue, '₹#,##0.00'],
    ['Reconciliation Identity (Stock Value = Sales + Remaining):', isReconciled ? 'VERIFIED (Exact Match)' : 'PENDING (Unentered Closings)', '@'],
    ['Extra Amount Recorded (Informational Only):', totalExtraAmount, '₹#,##0.00']
  ];

  summaryItems.forEach(([label, value, numFmt]) => {
    const sRow = worksheet.addRow([label, value]);
    worksheet.mergeCells(`A${sRow.number}:C${sRow.number}`);
    sRow.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
    sRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    sRow.getCell(4).value = value;
    const isSales = label.includes('Sales Amount');
    const isRemaining = label.includes('Remaining Stock');
    const isReconcile = label.includes('Reconciliation');
    sRow.getCell(4).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: isSales
        ? { argb: 'FF059669' }
        : isRemaining
        ? { argb: 'FF4338CA' }
        : isReconcile
        ? (isReconciled ? { argb: 'FF059669' } : { argb: 'FFD97706' })
        : { argb: 'FF1E293B' }
    };
    sRow.getCell(4).numFmt = numFmt;
    sRow.getCell(4).alignment = { vertical: 'middle', horizontal: isReconcile ? 'center' : 'right' };
    sRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    sRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });

  const noteRow = worksheet.addRow(['* Notice: Total Stock Value represents available inventory valuation before deducting sales. Total Sales Amount represents gross sales revenue. Total Remaining Stock Value represents inventory on hand at close. Total Stock Value = Total Sales Amount + Total Remaining Stock Value. Extra Amount is excluded from all financial reconciliations.']);
  worksheet.mergeCells(`A${noteRow.number}:P${noteRow.number}`);
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
    { width: 20 }, // Sales Amount
    { width: 22 }, // Remaining Stock Value
    { width: 14 }, // Extra Amount
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
