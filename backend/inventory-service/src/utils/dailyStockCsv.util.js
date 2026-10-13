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
    'Extra Amount',
    'Status'
  ];

  const rows = records.map((r, idx) => {
    const brandName = (r.brand && r.brand.name) || r.brandName || `Item #${idx + 1}`;
    const sizeName = (r.size && (r.size.name || r.size.code)) || r.sizeName || '-';
    const sNo = r.brand?.serialNo || (idx + 1);

    const opening = parseInt(r.openingStock, 10) || 0;
    const indent = parseInt(r.indentStock, 10) || 0;
    const total = parseInt(r.totalStock, 10) || (opening + indent);
    const closing = parseInt(r.closingStock, 10) || 0;
    const sale = parseInt(r.saleCount, 10) || 0;
    const rate = parseFloat(r.bottleRate) || 0;
    const stockValue = total * rate;
    const saleAmount = parseFloat(r.saleAmount) || (sale * rate);
    const extra = parseFloat(r.extraAmount) || 0;

    return [
      escapeCSV(shopCode),
      escapeCSV(businessDate),
      escapeCSV(sNo),
      escapeCSV(brandName),
      escapeCSV(sizeName),
      escapeCSV(opening),
      escapeCSV(indent),
      escapeCSV(total),
      escapeCSV(closing),
      escapeCSV(sale),
      escapeCSV(rate.toFixed(2)),
      escapeCSV(stockValue.toFixed(2)),
      escapeCSV(saleAmount.toFixed(2)),
      escapeCSV(extra.toFixed(2)),
      escapeCSV(r.status || 'DRAFT')
    ].join(',');
  });

  return [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
};

module.exports = {
  escapeCSV,
  generateDailyStockCsv
};
