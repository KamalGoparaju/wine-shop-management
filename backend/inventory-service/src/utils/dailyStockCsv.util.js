// Helper to sanitize and escape CSV cell values with formula injection prevention
const escapeCSV = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Formula injection prevention: if string begins with =, +, -, @, \t, \r, prepend single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Double quotes escape
  str = str.replace(/"/g, '""');
  return `"${str}"`;
};

const generateDailyStockCsv = (data) => {
  const {
    shopCode = 'SHOP',
    businessDate,
    records = []
  } = data;

  const headers = [
    'Shop',
    'Business Date',
    'S.No',
    'Brand',
    'Size',
    'Opening',
    'Indent',
    'Total Quantity',
    'Closing',
    'Sale',
    'Rate',
    'Stock Value',
    'Sales Amount',
    'Remaining Stock Value',
    'Extra Amount',
    'Status'
  ];

  let totalOpening = 0;
  let totalIndent = 0;
  let totalAvailable = 0;
  let totalClosing = 0;
  let totalSale = 0;
  let totalStockValue = 0;
  let totalSalesAmount = 0;
  let totalRemainingStockValue = 0;
  let totalExtra = 0;
  let allCompleted = records.length > 0;

  const rows = records.map((r, idx) => {
    const brandName = (r.brand && r.brand.name) || r.brandName || `Item #${idx + 1}`;
    const sizeName = (r.size && (r.size.name || r.size.code)) || r.sizeName || '-';
    const sNo = r.brand?.serialNo || (idx + 1);

    const opening = parseInt(r.openingStock, 10) || 0;
    const indent = parseInt(r.indentStock, 10) || 0;
    const total = parseInt(r.totalStock, 10) || (opening + indent);
    const hasClosing = r.closingStock !== '' && r.closingStock !== null && r.closingStock !== undefined;
    const closing = hasClosing ? (parseInt(r.closingStock, 10) || 0) : 0;
    const sale = parseInt(r.saleCount, 10) || 0;
    const rate = parseFloat(r.bottleRate) || 0;
    const stockValue = total * rate;
    const saleAmount = parseFloat(r.saleAmount) || (sale * rate);
    const remainingStockValue = hasClosing ? (closing * rate) : null;
    const extra = parseFloat(r.extraAmount) || 0;

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
    totalExtra += extra;

    return [
      escapeCSV(shopCode),
      escapeCSV(businessDate),
      escapeCSV(sNo),
      escapeCSV(brandName),
      escapeCSV(sizeName),
      escapeCSV(opening),
      escapeCSV(indent),
      escapeCSV(total),
      escapeCSV(hasClosing ? closing : 'Pending'),
      escapeCSV(sale),
      escapeCSV(rate.toFixed(2)),
      escapeCSV(stockValue.toFixed(2)),
      escapeCSV(saleAmount.toFixed(2)),
      escapeCSV(hasClosing ? remainingStockValue.toFixed(2) : 'Pending'),
      escapeCSV(extra.toFixed(2)),
      escapeCSV(r.status || 'DRAFT')
    ].join(',');
  });

  const totalsRow = [
    escapeCSV('TOTALS'),
    escapeCSV(''),
    escapeCSV(''),
    escapeCSV(''),
    escapeCSV(''),
    escapeCSV(totalOpening),
    escapeCSV(totalIndent),
    escapeCSV(totalAvailable),
    escapeCSV(totalClosing),
    escapeCSV(totalSale),
    escapeCSV(''),
    escapeCSV(totalStockValue.toFixed(2)),
    escapeCSV(totalSalesAmount.toFixed(2)),
    escapeCSV(totalRemainingStockValue.toFixed(2)),
    escapeCSV(totalExtra.toFixed(2)),
    escapeCSV(allCompleted ? 'COMPLETED' : 'PENDING')
  ].join(',');

  return [headers.map(h => `"${h}"`).join(','), ...rows, totalsRow].join('\r\n');
};

module.exports = {
  escapeCSV,
  generateDailyStockCsv
};
