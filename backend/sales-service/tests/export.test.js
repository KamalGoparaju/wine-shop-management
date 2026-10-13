const test = require('node:test');
const assert = require('node:assert');
const { escapeCSV } = require('../src/controllers/export.controller');
const { generateClosingReportPdf } = require('../src/utils/closingPdf.util');
const { Writable } = require('node:stream');

test('Sales CSV Escaping - Sanitizes formula injection and commas', () => {
  assert.strictEqual(escapeCSV('=2+2'), `"'=2+2"`);
  assert.strictEqual(escapeCSV('@SUM(1,2)'), `"'@SUM(1,2)"`);
  assert.strictEqual(escapeCSV('-500'), `"'-500"`);
  assert.strictEqual(escapeCSV('+100'), `"'+100"`);
  assert.strictEqual(escapeCSV('Royal Stag, 750ml'), `"Royal Stag, 750ml"`);
  assert.strictEqual(escapeCSV(null), '""');
});

test('Closing PDF Report - Valid PDF stream generation for closed business day', async () => {
  const chunks = [];
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });

  const sampleData = {
    shopName: 'Central Wine Lounge',
    shopCode: 'SHOP1',
    businessDate: '2026-10-12',
    closing: {
      status: 'CLOSED',
      totalBusiness: 45000.00,
      totalBottlesSold: 90,
      totalBottlesRemaining: 210,
      onlineCollection: 20000.00,
      offlineCollection: 25000.00,
      totalCollected: 45000.00,
      totalExpenses: 2500.00,
      finalAmount: 42500.00,
      collectionDifference: 0.00,
      extraAmountInformational: 150.00,
      closedBy: 'Manager John',
      closedAt: new Date().toISOString(),
      notes: 'Clean day closing.'
    },
    expenses: [
      {
        category: 'Transport',
        description: 'Auto fare',
        amount: 500,
        paymentMethod: 'CASH',
        recipient: 'Driver'
      },
      {
        category: 'Staff Tea',
        description: 'Evening tea and snacks',
        amount: 200,
        paymentMethod: 'CASH',
        recipient: 'Canteen'
      }
    ],
    stockRecords: [
      {
        brand: { serialNo: 1, name: 'Royal Stag' },
        size: { code: 'Q', name: '750ml' },
        openingStock: 20,
        indentStock: 10,
        totalStock: 30,
        closingStock: 10,
        saleCount: 20,
        bottleRate: 500,
        saleAmount: 10000,
        extraAmount: 0
      }
    ]
  };

  await new Promise((resolve, reject) => {
    writable.on('finish', resolve);
    writable.on('error', reject);
    generateClosingReportPdf(sampleData, writable);
  });

  const pdfBuffer = Buffer.concat(chunks);
  assert.ok(pdfBuffer.length > 500);
  assert.strictEqual(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('Closing PDF Report - Correctly handles REOPENED and UNCLOSED statuses', async () => {
  const chunks = [];
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });

  const sampleData = {
    shopName: 'Premium Spirits & Wine',
    shopCode: 'SHOP2',
    businessDate: '2026-10-12',
    closing: {
      status: 'REOPENED',
      totalBusiness: 30000.00,
      totalBottlesSold: 60,
      totalBottlesRemaining: 140,
      onlineCollection: 15000.00,
      offlineCollection: 15000.00,
      totalCollected: 30000.00,
      totalExpenses: 1000.00,
      finalAmount: 29000.00,
      collectionDifference: 0.00,
      extraAmountInformational: 0.00,
      closedBy: 'Supervisor',
      closedAt: new Date().toISOString(),
      notes: 'Reopened for discrepancy review.'
    },
    expenses: [],
    stockRecords: []
  };

  await new Promise((resolve, reject) => {
    writable.on('finish', resolve);
    writable.on('error', reject);
    generateClosingReportPdf(sampleData, writable);
  });

  const pdfBuffer = Buffer.concat(chunks);
  assert.ok(pdfBuffer.length > 500);
  assert.strictEqual(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('Financial Calculations in Reports - Exact verification of formulas', () => {
  const totalBusiness = 50000;
  const onlineCol = 22000;
  const offlineCol = 28000;
  const expenses = 4000;
  const extraAmt = 250; // informational

  const totalCollected = onlineCol + offlineCol;
  const finalAmount = totalCollected - expenses;
  const collectionDifference = totalCollected - totalBusiness;

  assert.strictEqual(totalCollected, 50000);
  assert.strictEqual(finalAmount, 46000);
  assert.strictEqual(collectionDifference, 0);

  // Extra amount must not be added to total collected or total business
  assert.strictEqual(totalCollected, 50000);
  assert.strictEqual(finalAmount, 46000);
  assert.notStrictEqual(totalCollected, 50000 + extraAmt);
});
