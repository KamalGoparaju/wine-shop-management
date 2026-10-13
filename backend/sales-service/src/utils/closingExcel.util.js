const ExcelJS = require('exceljs');

const formatNumber = (val) => parseInt(val, 10) || 0;
const formatFloat = (val) => parseFloat(val) || 0;

/**
 * Generates an Excel (.xlsx) workbook for Daily Closing History or a Single Day Report
 */
const generateClosingHistoryExcel = async (data, res) => {
  const {
    shopName = 'Wine Shop',
    shopCode = 'SHOP',
    dateRangeLabel = 'All Dates',
    records = [],
    expenses = [],
    stockRecords = []
  } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Wine Shop Management System';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // Sheet 1: Closing History Summary
  // -------------------------------------------------------------
  const historySheet = workbook.addWorksheet('Closing History', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Title Banner
  historySheet.mergeCells('A1:O1');
  const titleCell = historySheet.getCell('A1');
  titleCell.value = 'WINE SHOP MANAGEMENT SYSTEM — DAILY CLOSING & AUDIT HISTORY';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  historySheet.getRow(1).height = 28;

  // Metadata
  historySheet.mergeCells('A2:O2');
  const metaCell = historySheet.getCell('A2');
  metaCell.value = `Shop: ${shopName} (${shopCode})  |  Date Range: ${dateRangeLabel}  |  Generated: ${new Date().toLocaleString('en-IN')}`;
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFCBD5E1' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  historySheet.getRow(2).height = 20;

  historySheet.addRow([]); // Blank spacer

  const headers = [
    'Shop',
    'Business Date',
    'Closing Status',
    'Bottles Sold',
    'Bottles Remaining',
    'Total Business (INR)',
    'Online Collection',
    'Offline / Cash',
    'Total Collected',
    'Total Expenses',
    'Collection Diff',
    'Final Amount (Net)',
    'Extra Amount (Info)',
    'Closed By',
    'Closed At'
  ];

  const headerRow = historySheet.addRow(headers);
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

  let sumSold = 0;
  let sumRemaining = 0;
  let sumBusiness = 0;
  let sumOnline = 0;
  let sumOffline = 0;
  let sumCollected = 0;
  let sumExpenses = 0;
  let sumDiff = 0;
  let sumFinal = 0;
  let sumExtra = 0;

  records.forEach((r, idx) => {
    const sold = formatNumber(r.totalBottlesSold);
    const rem = formatNumber(r.totalBottlesRemaining);
    const business = formatFloat(r.totalBusiness);
    const online = formatFloat(r.onlineCollection);
    const offline = formatFloat(r.offlineCollection);
    const collected = formatFloat(r.totalCollected);
    const expenses = formatFloat(r.totalExpenses);
    const diff = formatFloat(r.collectionDifference);
    const finalAmt = formatFloat(r.finalAmount);
    const extra = formatFloat(r.extraAmountInformational);

    sumSold += sold;
    sumRemaining += rem;
    sumBusiness += business;
    sumOnline += online;
    sumOffline += offline;
    sumCollected += collected;
    sumExpenses += expenses;
    sumDiff += diff;
    sumFinal += finalAmt;
    sumExtra += extra;

    const row = historySheet.addRow([
      shopCode,
      new Date(r.businessDate).toISOString().slice(0, 10),
      r.status,
      sold,
      rem,
      business,
      online,
      offline,
      collected,
      expenses,
      diff,
      finalAmt,
      extra,
      r.closedBy || 'Manager',
      r.closedAt ? new Date(r.closedAt).toLocaleString() : '-'
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

      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = {
          bold: true,
          color: r.status === 'CLOSED' ? { argb: 'FF059669' } : { argb: 'FFD97706' }
        };
      } else if (colNumber === 4 || colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
      } else if (colNumber >= 6 && colNumber <= 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '₹#,##0.00';
        if (colNumber === 6) cell.font = { bold: true };
        if (colNumber === 9) cell.font = { bold: true, color: { argb: 'FF059669' } };
        if (colNumber === 10) cell.font = { bold: true, color: { argb: 'FFDC2626' } };
        if (colNumber === 12) cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Totals Row
  const totalsRow = historySheet.addRow([
    'TOTALS',
    '',
    '',
    sumSold,
    sumRemaining,
    sumBusiness,
    sumOnline,
    sumOffline,
    sumCollected,
    sumExpenses,
    sumDiff,
    sumFinal,
    sumExtra,
    '',
    ''
  ]);
  totalsRow.height = 22;

  totalsRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
    if (colNumber === 4 || colNumber === 5) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else if (colNumber >= 6 && colNumber <= 13) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '₹#,##0.00';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  historySheet.columns = [
    { width: 12 }, // Shop
    { width: 14 }, // Date
    { width: 14 }, // Status
    { width: 14 }, // Sold
    { width: 16 }, // Remaining
    { width: 20 }, // Total Business
    { width: 18 }, // Online Col
    { width: 18 }, // Offline Col
    { width: 18 }, // Total Col
    { width: 18 }, // Total Exp
    { width: 16 }, // Col Diff
    { width: 20 }, // Final Amount
    { width: 16 }, // Extra Amt
    { width: 16 }, // Closed By
    { width: 22 }  // Closed At
  ];

  // -------------------------------------------------------------
  // Sheet 2: Itemized Expenses (if provided)
  // -------------------------------------------------------------
  if (expenses.length > 0) {
    const expenseSheet = workbook.addWorksheet('Itemized Expenses');
    
    // Header banner
    expenseSheet.mergeCells('A1:I1');
    const expTitle = expenseSheet.getCell('A1');
    expTitle.value = `ITEMIZED EXPENSES — ${shopName} (${shopCode})`;
    expTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    expTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    expenseSheet.getRow(1).height = 24;

    const expHeaders = [
      'Shop',
      'Business Date',
      'Category',
      'Description',
      'Payment Method',
      'Recipient',
      'Amount (INR)',
      'Created By',
      'Created At'
    ];

    const expHeaderRow = expenseSheet.addRow(expHeaders);
    expHeaderRow.height = 20;
    expHeaderRow.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let totalExpAmt = 0;
    expenses.forEach((e, idx) => {
      const amt = formatFloat(e.amount);
      totalExpAmt += amt;

      const r = expenseSheet.addRow([
        shopCode,
        new Date(e.businessDate).toISOString().slice(0, 10),
        e.category,
        e.description,
        e.paymentMethod,
        e.recipient || '-',
        amt,
        e.createdBy || 'Staff',
        e.createdAt ? new Date(e.createdAt).toLocaleString() : '-'
      ]);

      const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      r.eachCell((cell, col) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (col === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##0.00';
          cell.font = { bold: true };
        }
      });
    });

    // Expenses total row
    const expTotalRow = expenseSheet.addRow(['TOTAL EXPENSES', '', '', '', '', '', totalExpAmt, '', '']);
    expTotalRow.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      if (col === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '₹#,##0.00';
      }
    });

    expenseSheet.columns = [
      { width: 12 },
      { width: 14 },
      { width: 16 },
      { width: 28 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 22 }
    ];
  }

  // -------------------------------------------------------------
  // Sheet 3: Brand Stock Breakdown (if single date closing export)
  // -------------------------------------------------------------
  if (stockRecords.length > 0) {
    const stockSheet = workbook.addWorksheet('Stock Breakdown');

    stockSheet.mergeCells('A1:L1');
    const stkTitle = stockSheet.getCell('A1');
    stkTitle.value = `BRAND & SIZE STOCK BREAKDOWN — ${shopName} (${shopCode})`;
    stkTitle.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    stkTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    stkTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    stockSheet.getRow(1).height = 24;

    const stkHeaders = [
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
      'Extra Amount'
    ];

    const stkHeaderRow = stockSheet.addRow(stkHeaders);
    stkHeaderRow.height = 20;
    stkHeaderRow.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    stockRecords.forEach((r, idx) => {
      const op = formatNumber(r.openingStock);
      const ind = formatNumber(r.indentStock);
      const tot = formatNumber(r.totalStock) || (op + ind);
      const cls = formatNumber(r.closingStock);
      const sl = formatNumber(r.saleCount);
      const rt = formatFloat(r.bottleRate);
      const sv = tot * rt;
      const sa = formatFloat(r.saleAmount) || (sl * rt);
      const ex = formatFloat(r.extraAmount);

      const row = stockSheet.addRow([
        r.brand?.serialNo || (idx + 1),
        (r.brand && r.brand.name) || r.brandName || `Item #${idx + 1}`,
        (r.size && (r.size.name || r.size.code)) || r.sizeName || '-',
        op,
        ind,
        tot,
        cls,
        sl,
        rt,
        sv,
        sa,
        ex
      ]);

      const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      row.eachCell((cell, col) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        if (col >= 4 && col <= 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else if (col >= 9 && col <= 12) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##0.00';
        }
      });
    });

    stockSheet.columns = [
      { width: 8 },
      { width: 28 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
      { width: 14 }
    ];
  }

  await workbook.xlsx.write(res);
};

module.exports = {
  generateClosingHistoryExcel
};
