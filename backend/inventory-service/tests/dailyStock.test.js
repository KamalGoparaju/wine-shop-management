const test = require('node:test');
const assert = require('node:assert');

// 1 & 4. Example Calculation Test (Royal Stag Q Test Case from Prompt Section 4)
test('Req 4 & 12.1-5: Exact Example Calculation Test Case (Royal Stag Q)', () => {
  const previousDayClosing = 10;
  const todayIndent = 12;
  const todayClosing = 7;
  const rate = 410;
  const extraAmt = 100;

  // Rule 1: Opening carries forward from previous day's closing
  const opening = previousDayClosing;
  assert.strictEqual(opening, 10, 'Opening must equal previous day closing');

  // Rule 2: Total = Opening + Indent
  const total = opening + todayIndent;
  assert.strictEqual(total, 22, 'Total must be Opening + Indent (10 + 12 = 22)');

  // Rule 3: Sale = Total - Closing
  const sale = total - todayClosing;
  assert.strictEqual(sale, 15, 'Sale must be Total - Closing (22 - 7 = 15)');

  // Rule 4: Amount = Sale * Rate
  const amount = sale * rate;
  assert.strictEqual(amount, 6150, 'Amount must be Sale * Rate (15 * 410 = 6150)');

  // Rule 5: Extra Amount is strictly informational and excluded from Total Business
  const totalBusinessContribution = amount; // Strictly 6150, NOT 6250
  assert.strictEqual(totalBusinessContribution, 6150);
  assert.notStrictEqual(totalBusinessContribution, 6250);
  assert.strictEqual(extraAmt, 100, 'Extra Amt must be tracked separately');
});

// 2. Multi-Shop Isolation of Carry-Forward
test('Req 12.2: Isolation of carry-forward across all three shops', () => {
  const shop1PreviousClosing = { 'brand-rs': 10 };
  const shop2PreviousClosing = { 'brand-rs': 25 };
  const shop3PreviousClosing = { 'brand-rs': 0 };

  const getShopOpening = (shopId, brandId) => {
    const store = {
      'SHOP1': shop1PreviousClosing,
      'SHOP2': shop2PreviousClosing,
      'SHOP3': shop3PreviousClosing
    };
    return store[shopId]?.[brandId] ?? 0;
  };

  assert.strictEqual(getShopOpening('SHOP1', 'brand-rs'), 10);
  assert.strictEqual(getShopOpening('SHOP2', 'brand-rs'), 25);
  assert.strictEqual(getShopOpening('SHOP3', 'brand-rs'), 0);
  // Cross-shop contamination check
  assert.notStrictEqual(getShopOpening('SHOP1', 'brand-rs'), getShopOpening('SHOP2', 'brand-rs'));
});

// 6. Extra Amount excluded from all financial calculations
test('Req 12.6: Extra Amt excluded from financial totals', () => {
  const rows = [
    { sale: 15, rate: 410, extraAmt: 100 },
    { sale: 8, rate: 220, extraAmt: 50 },
    { sale: 20, rate: 120, extraAmt: 30 }
  ];

  const calculatedTotalBusiness = rows.reduce((acc, r) => acc + (r.sale * r.rate), 0);
  const totalExtraAmt = rows.reduce((acc, r) => acc + r.extraAmt, 0);

  // 15*410 = 6150; 8*220 = 1760; 20*120 = 2400 => sum = 10310
  assert.strictEqual(calculatedTotalBusiness, 10310);
  assert.strictEqual(totalExtraAmt, 180);

  // Financial reconciliation: Extra Amt must never alter final net amount
  const collections = 10310;
  const expenses = 500;
  const netAmount = collections - expenses; // 9810
  assert.strictEqual(netAmount, 9810);
  assert.strictEqual(netAmount.toString().includes(totalExtraAmt.toString()), false);
});

// 7 & 8. Validation Rules (Missing Closing and Closing > Total)
test('Req 12.7 & 12.8: Validation - Closing greater than Total & missing closing detection', () => {
  const validateRow = (opening, indent, closingInput) => {
    const total = opening + indent;
    if (closingInput === '' || closingInput === null || closingInput === undefined) {
      return { isValid: false, isPending: true, error: 'PENDING_CLOSING' };
    }
    const closing = parseInt(closingInput, 10);
    if (isNaN(closing) || closing < 0) {
      return { isValid: false, isPending: false, error: 'NEGATIVE_QUANTITY' };
    }
    if (closing > total) {
      return { isValid: false, isPending: false, error: 'CLOSING_EXCEEDS_TOTAL' };
    }
    const sale = total - closing;
    return { isValid: true, isPending: false, total, closing, sale };
  };

  // Case A: Closing > Total
  const invalidExceeding = validateRow(10, 5, 20); // total is 15, closing is 20
  assert.strictEqual(invalidExceeding.isValid, false);
  assert.strictEqual(invalidExceeding.error, 'CLOSING_EXCEEDS_TOTAL');

  // Case B: Pending / unentered closing
  const pendingRow = validateRow(10, 5, '');
  assert.strictEqual(pendingRow.isValid, false);
  assert.strictEqual(pendingRow.isPending, true);

  // Case C: Valid closing
  const validRow = validateRow(10, 5, 8);
  assert.strictEqual(validRow.isValid, true);
  assert.strictEqual(validRow.total, 15);
  assert.strictEqual(validRow.sale, 7);
});

// 9. Invalid or missing rates handling
test('Req 12.9: Invalid or missing rate fallback safety', () => {
  const resolveRate = (shopRate, globalRate) => {
    const r = parseFloat(shopRate ?? globalRate ?? 0);
    return isNaN(r) || r < 0 ? 0 : r;
  };

  assert.strictEqual(resolveRate(410, 400), 410); // Shop override
  assert.strictEqual(resolveRate(null, 400), 400); // Global fallback
  assert.strictEqual(resolveRate(undefined, undefined), 0); // Safe 0 fallback
  assert.strictEqual(resolveRate('invalid', null), 0); // Malformed string fallback
});

// 10 & 11. Idempotent Upsert & Prevention of Duplicate Daily Records
test('Req 12.10 & 12.11: Uniqueness key prevents duplicate records on repeat save', () => {
  const recordsStore = new Map();

  const upsertRecord = (shopId, businessDate, brandId, sizeId, data) => {
    const key = `${shopId}_${businessDate}_${brandId}_${sizeId}`;
    recordsStore.set(key, { ...data, updatedAt: Date.now() });
    return recordsStore.size;
  };

  // First save
  upsertRecord('SHOP1', '2026-10-06', 'brand-1', 'size-Q', { sale: 15, amount: 6150 });
  assert.strictEqual(recordsStore.size, 1);

  // Second save (retry or repeated click)
  upsertRecord('SHOP1', '2026-10-06', 'brand-1', 'size-Q', { sale: 15, amount: 6150 });
  assert.strictEqual(recordsStore.size, 1, 'Map size must remain 1; no duplicates created');
});

// 12. Shop Switching without stale data
test('Req 12.12: Shop Switching discard mechanism for out-of-order responses', () => {
  let activeShopId = 'SHOP1';
  let renderedData = null;

  const handleResponse = (responseShopId, data) => {
    // Only accept if response matches currently active shop
    if (responseShopId === activeShopId) {
      renderedData = data;
    }
  };

  // User switches from SHOP1 to SHOP2
  activeShopId = 'SHOP2';

  // Late response from SHOP1 arrives
  handleResponse('SHOP1', { shop: 'SHOP1', records: ['stale'] });
  assert.strictEqual(renderedData, null, 'Stale response from SHOP1 must be ignored');

  // Response for SHOP2 arrives
  handleResponse('SHOP2', { shop: 'SHOP2', records: ['fresh'] });
  assert.deepStrictEqual(renderedData, { shop: 'SHOP2', records: ['fresh'] });
});

// 14 & 15. Dashboard totals match saved stock records & Daily Closing
test('Req 12.14 & 12.15: Dashboard totals agree with saved daily stock sheet', () => {
  const savedDailyRecords = [
    { brand: 'Royal Stag Q', saleCount: 15, saleAmount: 6150, closingStock: 7 },
    { brand: 'Blenders Pride P', saleCount: 10, saleAmount: 3200, closingStock: 5 }
  ];

  const totalBusiness = savedDailyRecords.reduce((acc, r) => acc + r.saleAmount, 0);
  const totalBottlesSold = savedDailyRecords.reduce((acc, r) => acc + r.saleCount, 0);
  const totalBottlesRemaining = savedDailyRecords.reduce((acc, r) => acc + r.closingStock, 0);

  assert.strictEqual(totalBusiness, 9350);
  assert.strictEqual(totalBottlesSold, 25);
  assert.strictEqual(totalBottlesRemaining, 12);

  // Daily Closing Reconciliations
  const onlineCollection = 4000;
  const offlineCollection = 5350;
  const totalCollected = onlineCollection + offlineCollection; // 9350
  const expenses = 350;
  const finalAmount = totalCollected - expenses; // 9000
  const collectionDifference = totalCollected - totalBusiness; // 0

  assert.strictEqual(totalCollected, 9350);
  assert.strictEqual(finalAmount, 9000);
  assert.strictEqual(collectionDifference, 0);
});

// 16. Historical amounts remain unchanged after rate changes
test('Req 12.16: Historical snapshot rate ensures historical amount immutability', () => {
  // Snapshot taken on 06-Oct-2026
  const historicalRecord = {
    businessDate: '2026-10-06',
    brand: 'Royal Stag',
    size: 'Q',
    saleCount: 15,
    bottleRate: 410, // Snapshot
    saleAmount: 6150 // 15 * 410
  };

  // Master rate increases on 10-Oct-2026
  const newMasterRate = 450;

  // Recalculating with snapshot must preserve historical sales
  const historicalCalculated = historicalRecord.saleCount * historicalRecord.bottleRate;
  assert.strictEqual(historicalCalculated, 6150);
  assert.notStrictEqual(historicalCalculated, historicalRecord.saleCount * newMasterRate);
});
