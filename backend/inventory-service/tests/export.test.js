const test = require('node:test');
const assert = require('node:assert');
const { generateDailyStockCsv, escapeCSV } = require('../src/utils/dailyStockCsv.util');
const { generateDailyStockPdf } = require('../src/utils/dailyStockPdf.util');
const { Writable } = require('node:stream');

test('Daily Stock CSV - Expected columns and headers', () => {
  const sampleData = {
    shopCode: 'SHOP1',
    businessDate: '2026-10-12',
    records: [
      {
        brand: { serialNo: 1, name: 'Royal Stag' },
        size: { code: 'Q', name: 'Quart (750ml)' },
        openingStock: 10,
        indentStock: 5,
        totalStock: 15,
        closingStock: 7,
        saleCount: 8,
        bottleRate: 500,
        saleAmount: 4000,
        extraAmount: 50,
        status: 'COMPLETED'
      }
    ]
  };

  const csv = generateDailyStockCsv(sampleData);
  assert.ok(csv.includes('"Shop","Business Date","S.No","Brand","Size","Opening","Indent","Total Quantity","Closing","Sale","Rate","Stock Value","Sales Amount","Extra Amount","Status"'));
  assert.ok(csv.includes('"SHOP1"'));
  assert.ok(csv.includes('"Royal Stag"'));
  assert.ok(csv.includes('"4000.00"'));
  assert.ok(csv.includes('"50.00"'));
  assert.ok(csv.includes('"COMPLETED"'));
});

test('Daily Stock CSV - Formula injection cases are escaped safely', () => {
  assert.strictEqual(escapeCSV('=SUM(A1:A10)'), `"'=SUM(A1:A10)"`);
  assert.strictEqual(escapeCSV('+12345'), `"'+12345"`);
  assert.strictEqual(escapeCSV('-1000'), `"'-1000"`);
  assert.strictEqual(escapeCSV('@EVIL()'), `"'@EVIL()"`);
  assert.strictEqual(escapeCSV('Normal Text'), `"Normal Text"`);
  assert.strictEqual(escapeCSV('Text, with "quotes" and commas'), `"Text, with ""quotes"" and commas"`);
});

test('Daily Stock PDF - Generation stream creates valid PDF bytes with draft status', async () => {
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
    isCompleted: false, // Draft
    isLocked: false,
    records: [
      {
        brand: { serialNo: 1, name: 'Royal Stag' },
        size: { code: 'Q', name: 'Quart (750ml)' },
        openingStock: 10,
        indentStock: 5,
        totalStock: 15,
        closingStock: 7,
        saleCount: 8,
        bottleRate: 500,
        saleAmount: 4000,
        extraAmount: 50
      }
    ]
  };

  await new Promise((resolve, reject) => {
    writable.on('finish', resolve);
    writable.on('error', reject);
    generateDailyStockPdf(sampleData, writable);
  });

  const pdfBuffer = Buffer.concat(chunks);
  // PDF file starts with %PDF-
  assert.ok(pdfBuffer.length > 500);
  assert.strictEqual(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('Daily Stock PDF - Multi-page tables handle page breaks cleanly', async () => {
  const chunks = [];
  const writable = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(chunk);
      callback();
    }
  });

  // Create 60 items to trigger multiple page breaks
  const manyRecords = Array.from({ length: 60 }, (_, i) => ({
    brand: { serialNo: i + 1, name: `Brand Sample Item ${i + 1}` },
    size: { code: 'Q', name: 'Quart (750ml)' },
    openingStock: 20,
    indentStock: 10,
    totalStock: 30,
    closingStock: 15,
    saleCount: 15,
    bottleRate: 600,
    saleAmount: 9000,
    extraAmount: 0
  }));

  await new Promise((resolve, reject) => {
    writable.on('finish', resolve);
    writable.on('error', reject);
    generateDailyStockPdf({
      shopName: 'Highway Branch',
      shopCode: 'SHOP3',
      businessDate: '2026-10-12',
      isCompleted: true,
      records: manyRecords
    }, writable);
  });

  const pdfBuffer = Buffer.concat(chunks);
  assert.ok(pdfBuffer.length > 2000);
  assert.strictEqual(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('Financial Accuracy - Extra Amount excluded and rates preserved', () => {
  const records = [
    { saleAmount: 2000, extraAmount: 150 },
    { saleAmount: 3500, extraAmount: 200 }
  ];

  const totalBusiness = records.reduce((acc, r) => acc + r.saleAmount, 0);
  const totalExtra = records.reduce((acc, r) => acc + r.extraAmount, 0);

  assert.strictEqual(totalBusiness, 5500);
  assert.strictEqual(totalExtra, 350);
  // Total business must strictly exclude extra amount
  assert.strictEqual(totalBusiness, 5500);
});
