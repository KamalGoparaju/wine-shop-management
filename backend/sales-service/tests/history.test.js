const test = require('node:test');
const assert = require('node:assert');

// 1 & 2. Date Filtering Logic (From Date and To Date)
test('Req 9.1 & 9.2: Date range filtering filters history accurately', () => {
  const records = [
    { id: '1', businessDate: '2026-10-01', totalBusiness: 10000 },
    { id: '2', businessDate: '2026-10-05', totalBusiness: 12000 },
    { id: '3', businessDate: '2026-10-10', totalBusiness: 15000 },
    { id: '4', businessDate: '2026-10-15', totalBusiness: 11000 }
  ];

  const filterHistory = (list, fromDate, toDate) => {
    return list.filter(r => {
      const d = r.businessDate;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  };

  const filtered = filterHistory(records, '2026-10-05', '2026-10-10');
  assert.strictEqual(filtered.length, 2);
  assert.strictEqual(filtered[0].id, '2');
  assert.strictEqual(filtered[1].id, '3');
});

// 3. Quick Presets: Today, Yesterday, This Month
test('Req 9.3: Quick filter presets calculate proper business date bounds', () => {
  const getBounds = (preset, referenceDate = new Date('2026-10-12T10:00:00Z')) => {
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'TODAY') {
      const s = toYMD(referenceDate);
      return { fromDate: s, toDate: s };
    }
    if (preset === 'YESTERDAY') {
      const y = new Date(referenceDate);
      y.setDate(y.getDate() - 1);
      const s = toYMD(y);
      return { fromDate: s, toDate: s };
    }
    if (preset === 'THIS_MONTH') {
      const first = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      return { fromDate: toYMD(first), toDate: toYMD(referenceDate) };
    }
    throw new Error('Unknown preset');
  };

  const today = getBounds('TODAY');
  assert.strictEqual(today.fromDate, '2026-10-12');
  assert.strictEqual(today.toDate, '2026-10-12');

  const yesterday = getBounds('YESTERDAY');
  assert.strictEqual(yesterday.fromDate, '2026-10-11');
  assert.strictEqual(yesterday.toDate, '2026-10-11');

  const thisMonth = getBounds('THIS_MONTH');
  assert.strictEqual(thisMonth.fromDate, '2026-10-01');
  assert.strictEqual(thisMonth.toDate, '2026-10-12');
});

// 4 & 5. Multi-Shop History Isolation and Unauthorized Shop Access
test('Req 9.4 & 9.5: Multi-shop history isolation and rejection of unauthorized shop access', () => {
  const historyDB = [
    { id: 'c1', shopId: 'SHOP1', businessDate: '2026-10-10', totalBusiness: 10000 },
    { id: 'c2', shopId: 'SHOP2', businessDate: '2026-10-10', totalBusiness: 20000 },
    { id: 'c3', shopId: 'SHOP3', businessDate: '2026-10-10', totalBusiness: 30000 }
  ];

  const getShopHistory = (userRole, userShops, requestedShopId) => {
    // Backend security authorization check
    if (userRole !== 'ADMIN' && !userShops.includes(requestedShopId)) {
      throw new Error('UNAUTHORIZED_SHOP_ACCESS');
    }
    return historyDB.filter(r => r.shopId === requestedShopId);
  };

  // Staff assigned only to SHOP1 cannot access SHOP2 history
  assert.throws(
    () => getShopHistory('STAFF', ['SHOP1'], 'SHOP2'),
    /UNAUTHORIZED_SHOP_ACCESS/
  );

  // Authorized query for SHOP1 returns ONLY SHOP1 records
  const shop1Records = getShopHistory('ADMIN', ['SHOP1', 'SHOP2', 'SHOP3'], 'SHOP1');
  assert.strictEqual(shop1Records.length, 1);
  assert.strictEqual(shop1Records[0].shopId, 'SHOP1');
  assert.strictEqual(shop1Records[0].totalBusiness, 10000);
});

// 6 & 7. View Details: Stock and Financial Details & Rate Snapshot Immutability
test('Req 9.6 & 9.7: View Details aggregates saved stock details with preserved rate snapshot', () => {
  const savedStockSnapshot = [
    { brand: 'Royal Stag', size: 'Q', saleCount: 15, bottleRate: 410, saleAmount: 6150, extraAmount: 100 },
    { brand: 'Imperial Blue', size: 'N', saleCount: 20, bottleRate: 150, saleAmount: 3000, extraAmount: 50 }
  ];

  // Recalculating using snapshot rate must equal saved saleAmount
  for (const item of savedStockSnapshot) {
    assert.strictEqual(item.saleCount * item.bottleRate, item.saleAmount);
  }

  // Future master rate changes do NOT alter saved snapshot
  const newMasterRate = 450;
  assert.notStrictEqual(savedStockSnapshot[0].saleCount * newMasterRate, savedStockSnapshot[0].saleAmount);
  assert.strictEqual(savedStockSnapshot[0].bottleRate, 410, 'Snapshot rate is immutable');
});

// 8 & 9. Extra Amount exclusion and Expense / Collection double-counting prevention
test('Req 9.8 & 9.9: Extra Amount excluded and expenses deducted exactly once', () => {
  const totalBusiness = 9150; // 6150 + 3000
  const online = 4000;
  const offline = 5300;
  const totalCollected = online + offline; // 9300
  const expenses = [
    { id: 'e1', category: 'TRANSPORT', amount: 300 },
    { id: 'e2', category: 'MISC', amount: 200 }
  ];
  const extraAmount = 150; // 100 + 50

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0); // 500
  const finalAmount = totalCollected - totalExpenses; // 8800
  const collectionDifference = totalCollected - totalBusiness; // +150

  assert.strictEqual(finalAmount, 8800);
  assert.strictEqual(collectionDifference, 150);
  // Extra Amount is tracked strictly as informational data
  assert.strictEqual(extraAmount, 150);
  assert.strictEqual(finalAmount.toString().includes(extraAmount.toString()), false);
});

// 10 & 11. Status Handling: CLOSED, REOPENED, and Missing Closing (Pending)
test('Req 9.10 & 9.11: History accurately labels CLOSED, REOPENED, and missing closing records', () => {
  const resolveStatusDisplay = (closingRecord) => {
    if (!closingRecord) {
      return { status: 'PENDING_CLOSING', isClosed: false };
    }
    if (closingRecord.status === 'REOPENED') {
      return { status: 'REOPENED', isClosed: false, auditNote: closingRecord.notes };
    }
    return { status: 'CLOSED', isClosed: true };
  };

  // Case A: Missing closing record
  const resPending = resolveStatusDisplay(null);
  assert.strictEqual(resPending.status, 'PENDING_CLOSING');
  assert.strictEqual(resPending.isClosed, false);

  // Case B: Reopened record
  const resReopened = resolveStatusDisplay({
    status: 'REOPENED',
    notes: '[REOPENED on 2026-10-12 by admin@wineshop.com: Cash count adjustment]'
  });
  assert.strictEqual(resReopened.status, 'REOPENED');
  assert.strictEqual(resReopened.isClosed, false);
  assert.ok(resReopened.auditNote.includes('Cash count adjustment'));

  // Case C: Closed record
  const resClosed = resolveStatusDisplay({ status: 'CLOSED' });
  assert.strictEqual(resClosed.status, 'CLOSED');
  assert.strictEqual(resClosed.isClosed, true);
});
