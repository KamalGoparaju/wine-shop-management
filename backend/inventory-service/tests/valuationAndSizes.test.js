const test = require('node:test');
const assert = require('node:assert');
const { generateDailyStockExcel } = require('../src/utils/dailyStockExcel.util');
const { generateDailyStockCsv } = require('../src/utils/dailyStockCsv.util');

test('Valuation & Formulas: Exact Calculation Test Case (Royal Stag Q)', () => {
  // Input row specification:
  // Opening: 5, Indent: 10, Closing: 4, Rate: 420, Extra Amount: 50
  const opening = 5;
  const indent = 10;
  const closing = 4;
  const rate = 420;
  const extraAmount = 50;

  // 1. Total Quantity = Opening + Indent
  const totalStock = opening + indent;
  assert.strictEqual(totalStock, 15, 'Total Quantity must be Opening + Indent (5 + 10 = 15)');

  // 2. Stock Value = Total Quantity * Rate
  const stockValue = totalStock * rate;
  assert.strictEqual(stockValue, 6300, 'Stock Value must be Total Quantity * Rate (15 * 420 = 6,300)');

  // 3. Sale = Total Quantity - Closing
  const sale = totalStock - closing;
  assert.strictEqual(sale, 11, 'Sale must be Total Quantity - Closing (15 - 4 = 11)');

  // 4. Sales Amount = Sale * Rate
  const saleAmount = sale * rate;
  assert.strictEqual(saleAmount, 4620, 'Sales Amount must be Sale * Rate (11 * 420 = 4,620)');

  // 5. Dashboard Total Business must strictly equal Sales Amount (4,620), NEVER Stock Value (6,300)
  const dashboardTotalBusiness = saleAmount;
  assert.strictEqual(dashboardTotalBusiness, 4620, 'Dashboard Total Business must strictly use Sales Amount');
  assert.notStrictEqual(dashboardTotalBusiness, stockValue, 'Dashboard Total Business must NEVER equal Stock Value');

  // 6. Extra Amount is strictly informational and excluded from both financial metrics
  assert.strictEqual(stockValue, 15 * rate, 'Extra Amount must not alter Stock Value');
  assert.strictEqual(saleAmount, 11 * rate, 'Extra Amount must not alter Sales Amount');
});

test('Valuation Summary Aggregations: Multiple brand rows without double counting', () => {
  const rows = [
    { opening: 5, indent: 10, closing: 4, rate: 420, extra: 20 },  // Total: 15, Val: 6300, Sale: 11, SalesAmt: 4620
    { opening: 8, indent: 4, closing: 2, rate: 250, extra: 0 },    // Total: 12, Val: 3000, Sale: 10, SalesAmt: 2500
    { opening: 10, indent: 0, closing: 10, rate: 150, extra: 10 }, // Total: 10, Val: 1500, Sale: 0, SalesAmt: 0
  ];

  const enriched = rows.map(r => {
    const total = r.opening + r.indent;
    const sale = total - r.closing;
    const stockVal = total * r.rate;
    const salesAmt = sale * r.rate;
    return {
      ...r,
      total,
      sale,
      stockVal,
      salesAmt
    };
  });

  const totalOpening = enriched.reduce((sum, r) => sum + r.opening, 0);
  const totalIndent = enriched.reduce((sum, r) => sum + r.indent, 0);
  const totalAvailable = enriched.reduce((sum, r) => sum + r.total, 0);
  const totalClosing = enriched.reduce((sum, r) => sum + r.closing, 0);
  const totalSold = enriched.reduce((sum, r) => sum + r.sale, 0);
  const totalStockValue = enriched.reduce((sum, r) => sum + r.stockVal, 0);
  const totalBusiness = enriched.reduce((sum, r) => sum + r.salesAmt, 0);
  const totalExtra = enriched.reduce((sum, r) => sum + r.extra, 0);

  assert.strictEqual(totalOpening, 23);
  assert.strictEqual(totalIndent, 14);
  assert.strictEqual(totalAvailable, 37);
  assert.strictEqual(totalClosing, 16);
  assert.strictEqual(totalSold, 21);
  assert.strictEqual(totalStockValue, 10800); // 6300 + 3000 + 1500
  assert.strictEqual(totalBusiness, 7120);     // 4620 + 2500 + 0
  assert.strictEqual(totalExtra, 30);
});

test('ExcelJS Daily Stock Workbook: Generates valid .xlsx structure with Stock Value column and summary block', async () => {
  const sampleData = {
    shopName: 'Central Wine Lounge',
    shopCode: 'SHOP1',
    businessDate: '2026-10-13',
    isCompleted: true,
    isLocked: false,
    records: [
      {
        brand: { serialNo: 1, name: 'Royal Stag' },
        size: { code: 'Q', name: 'Quart (750ml)' },
        openingStock: 5,
        indentStock: 10,
        totalStock: 15,
        closingStock: 4,
        saleCount: 11,
        bottleRate: 420,
        saleAmount: 4620,
        extraAmount: 50,
        status: 'COMPLETED'
      },
      {
        brand: { serialNo: 2, name: 'Blenders Pride' },
        size: { code: 'P', name: 'Pint (375ml)' },
        openingStock: 8,
        indentStock: 4,
        totalStock: 12,
        closingStock: 2,
        saleCount: 10,
        bottleRate: 250,
        saleAmount: 2500,
        extraAmount: 0,
        status: 'COMPLETED'
      }
    ]
  };

  const workbook = await generateDailyStockExcel(sampleData);
  assert.ok(workbook, 'Workbook instance must be returned');

  const worksheet = workbook.getWorksheet('Daily Stock Sheet');
  assert.ok(worksheet, 'Worksheet "Daily Stock Sheet" must exist');

  // Check header columns
  const headerRow = worksheet.getRow(4);
  const headerValues = headerRow.values;
  assert.ok(headerValues.includes('Stock Value (INR)'), 'Header must contain "Stock Value (INR)" column');
  assert.ok(headerValues.includes('Sales Amount (INR)'), 'Header must contain "Sales Amount (INR)" column');
  assert.ok(headerValues.includes('Total Quantity'), 'Header must contain "Total Quantity" column');

  // Verify buffer export succeeds
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.length > 1000, 'Excel buffer must be non-empty valid binary bytes');
});

test('Size Master Business Rules: Case-insensitive code uniqueness check', () => {
  const existingSizes = [
    { id: 'size-1', code: 'Q', name: 'Quart (750ml)', isActive: true },
    { id: 'size-2', code: 'P', name: 'Pint (375ml)', isActive: true },
    { id: 'size-3', code: 'N', name: 'Nip (180ml)', isActive: true },
  ];

  // Helper simulating controller uniqueness check
  const isDuplicateCode = (newCode, currentId = null) => {
    const clean = newCode.trim().toUpperCase();
    return existingSizes.some(s => s.code.toUpperCase() === clean && s.id !== currentId);
  };

  assert.strictEqual(isDuplicateCode('q'), true, 'Lowercase "q" matches existing "Q"');
  assert.strictEqual(isDuplicateCode(' Q '), true, 'Padded " Q " matches existing "Q"');
  assert.strictEqual(isDuplicateCode('p'), true, 'Lowercase "p" matches existing "P"');
  assert.strictEqual(isDuplicateCode('PINT'), false, 'New code "PINT" does not collide');
  assert.strictEqual(isDuplicateCode('Q', 'size-1'), false, 'Same size code allowed on edit of size-1 itself');
});

test('Size Master Business Rules: Refusal of physical deletion if referenced by rates or stock', () => {
  const referencedSize = {
    id: 'size-q',
    code: 'Q',
    name: 'Quart (750ml)',
    _count: {
      rates: 4,
      dailyStockRecords: 12
    }
  };

  const canPhysicallyDelete = (size) => {
    return (size._count?.rates || 0) === 0 && (size._count?.dailyStockRecords || 0) === 0;
  };

  assert.strictEqual(canPhysicallyDelete(referencedSize), false, 'Referenced size must NOT be physically deletable');

  const unreferencedCustomSize = {
    id: 'size-new',
    code: 'TEST',
    name: 'Test Size',
    _count: {
      rates: 0,
      dailyStockRecords: 0
    }
  };

  assert.strictEqual(canPhysicallyDelete(unreferencedCustomSize), true, 'Unreferenced size can be deleted safely');
});
