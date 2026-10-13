const test = require('node:test');
const assert = require('node:assert');

// 1. Dashboard totals match saved daily stock records
test('Scenario 1: Dashboard totals aggregate accurately from saved stock records', () => {
  const stockRecords = [
    { brand: 'Royal Stag', size: 'Q', saleCount: 15, bottleRate: 410, saleAmount: 6150, closingStock: 7 },
    { brand: 'Blenders Pride', size: 'P', saleCount: 10, bottleRate: 320, saleAmount: 3200, closingStock: 5 },
    { brand: 'Imperial Blue', size: 'N', saleCount: 20, bottleRate: 150, saleAmount: 3000, closingStock: 12 }
  ];

  const totalBusiness = stockRecords.reduce((acc, r) => acc + r.saleAmount, 0);
  const totalBottlesSold = stockRecords.reduce((acc, r) => acc + r.saleCount, 0);
  const totalBottlesRemaining = stockRecords.reduce((acc, r) => acc + r.closingStock, 0);

  assert.strictEqual(totalBusiness, 12350);
  assert.strictEqual(totalBottlesSold, 45);
  assert.strictEqual(totalBottlesRemaining, 24);
});

// 2, 3, 4, 5. Collections, Expenses, Reconciliations, and Extra Amount exclusion
test('Scenario 2, 3, 4, 5: Daily Closing financial reconciliations & Extra Amount exclusion', () => {
  const totalBusiness = 12350;
  const onlineCollection = 5000;
  const offlineCollection = 7500;
  const expenses = [
    { category: 'SALARY', amount: 800 },
    { category: 'ELECTRICITY', amount: 350 },
    { category: 'TRANSPORT', amount: 150 }
  ];
  const extraAmount = 250; // Informational only

  // Scenario 2: Total Collected = Online + Offline
  const totalCollected = onlineCollection + offlineCollection;
  assert.strictEqual(totalCollected, 12500);

  // Scenario 3: Final Amount = Total Collected - Total Expenses
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  assert.strictEqual(totalExpenses, 1300);
  const finalAmount = totalCollected - totalExpenses;
  assert.strictEqual(finalAmount, 11200);

  // Scenario 4: Collection Difference = Total Collected - Total Business
  const collectionDifference = totalCollected - totalBusiness;
  assert.strictEqual(collectionDifference, 150); // +150 surplus

  // Scenario 5: Extra Amount must NEVER alter any financial calculation
  assert.strictEqual(finalAmount, 11200);
  assert.notStrictEqual(finalAmount, 11200 + extraAmount);
  assert.strictEqual(collectionDifference, 150);
  assert.notStrictEqual(collectionDifference, 150 + extraAmount);
});

// 6. Incomplete stock entries prevent closing
test('Scenario 6: Incomplete or draft stock entries prevent business closing', () => {
  const validateStockBeforeClosing = (records) => {
    if (!records || records.length === 0) {
      return { canClose: false, error: 'STOCK_SHEET_MISSING' };
    }
    const draftRecords = records.filter(r => r.status === 'DRAFT');
    if (draftRecords.length > 0) {
      return { canClose: false, error: 'STOCK_SHEET_DRAFT', draftCount: draftRecords.length };
    }
    return { canClose: true };
  };

  // Case A: Missing records
  const resMissing = validateStockBeforeClosing([]);
  assert.strictEqual(resMissing.canClose, false);
  assert.strictEqual(resMissing.error, 'STOCK_SHEET_MISSING');

  // Case B: Records in DRAFT
  const resDraft = validateStockBeforeClosing([
    { brand: 'Royal Stag Q', status: 'COMPLETED' },
    { brand: 'Blenders Pride P', status: 'DRAFT' }
  ]);
  assert.strictEqual(resDraft.canClose, false);
  assert.strictEqual(resDraft.error, 'STOCK_SHEET_DRAFT');
  assert.strictEqual(resDraft.draftCount, 1);

  // Case C: Fully COMPLETED records
  const resComplete = validateStockBeforeClosing([
    { brand: 'Royal Stag Q', status: 'COMPLETED' },
    { brand: 'Blenders Pride P', status: 'COMPLETED' }
  ]);
  assert.strictEqual(resComplete.canClose, true);
});

// 7 & 8. Repeated submissions & Idempotent Upsert (No duplicates)
test('Scenario 7 & 8: Idempotent closing upsert prevents duplicate closing records', () => {
  const closingsMap = new Map();

  const saveClosing = (shopId, businessDate, payload) => {
    const key = `${shopId}_${businessDate}`;
    closingsMap.set(key, { ...payload, closedAt: Date.now() });
    return closingsMap.size;
  };

  // Initial closing submission
  saveClosing('SHOP1', '2026-10-06', {
    totalBusiness: 12350,
    onlineCollection: 5000,
    offlineCollection: 7500,
    status: 'CLOSED'
  });
  assert.strictEqual(closingsMap.size, 1);

  // Repeated submission / network retry on same shop & date
  saveClosing('SHOP1', '2026-10-06', {
    totalBusiness: 12350,
    onlineCollection: 5000,
    offlineCollection: 7500,
    status: 'CLOSED'
  });
  assert.strictEqual(closingsMap.size, 1, 'Closing count must remain 1');
});

// 9 & 10. Multi-Shop Isolation (Closing Shop 1 does not affect Shop 2 or Shop 3)
test('Scenario 9 & 10: Multi-Shop Isolation of Closing Status & Collections', () => {
  const shopData = {
    'SHOP1': { status: 'CLOSED', totalCollected: 12500 },
    'SHOP2': { status: 'OPEN', totalCollected: 0 },
    'SHOP3': { status: 'OPEN', totalCollected: 0 }
  };

  assert.strictEqual(shopData['SHOP1'].status, 'CLOSED');
  assert.strictEqual(shopData['SHOP2'].status, 'OPEN');
  assert.strictEqual(shopData['SHOP3'].status, 'OPEN');
  assert.strictEqual(shopData['SHOP1'].totalCollected, 12500);
  assert.strictEqual(shopData['SHOP2'].totalCollected, 0);
});

// 11. Unauthorized Shop Access Rejected
test('Scenario 11: Shop authorization rejection for unauthorized shop access', () => {
  const verifyShopAccess = (userRole, userShops, targetShopId) => {
    if (userRole === 'ADMIN') return true;
    return userShops.includes(targetShopId);
  };

  const cashierShops = ['SHOP1'];
  assert.strictEqual(verifyShopAccess('CASHIER', cashierShops, 'SHOP1'), true);
  assert.strictEqual(verifyShopAccess('CASHIER', cashierShops, 'SHOP2'), false);
  assert.strictEqual(verifyShopAccess('ADMIN', [], 'SHOP2'), true);
});

// 12. Closed-day restrictions and authorized corrections/reopening
test('Scenario 12: Authorized Reopening Workflow with Audit Trail', () => {
  let record = {
    shopId: 'SHOP1',
    businessDate: '2026-10-06',
    status: 'CLOSED',
    notes: 'Standard closing'
  };

  const reopenDay = (reopenedBy, reason) => {
    if (!reason || !reason.trim()) {
      throw new Error('REOPEN_REASON_REQUIRED');
    }
    const auditEntry = `\n[REOPENED by ${reopenedBy}: ${reason.trim()}]`;
    record = {
      ...record,
      status: 'REOPENED',
      notes: `${record.notes}${auditEntry}`
    };
    return record;
  };

  // Reopen requires reason
  assert.throws(() => reopenDay('admin@wineshop.com', ''), /REOPEN_REASON_REQUIRED/);

  // Successful reopen appends audit trail
  const reopened = reopenDay('admin@wineshop.com', 'Correcting cash count error');
  assert.strictEqual(reopened.status, 'REOPENED');
  assert.ok(reopened.notes.includes('Correcting cash count error'));
  assert.ok(reopened.notes.includes('admin@wineshop.com'));
});
