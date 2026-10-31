const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {
  stringSimilarity,
  normalizeSize,
  matchBrand,
  parseNumber,
  parseSpreadsheetBuffer,
  analyzeStockFiles
} = require('../src/utils/stockSheetParser.util');

test('Import Verification: Levenshtein similarity metric', () => {
  assert.equal(stringSimilarity('Blenders Pride', 'Blenders Pride'), 1.0);
  assert.ok(stringSimilarity('Blenders Pride', 'Blenders') >= 0.8);
  assert.ok(stringSimilarity('Royal Stag', 'Royal Stagg') >= 0.85);
  assert.ok(stringSimilarity('Royal Stag', 'Kingfisher') < 0.5);
});

test('Import Verification: Size normalization and alias mapping', () => {
  const activeSizes = [
    { id: 'sz-1', code: '750ml', name: 'Bottle 750ml', volumeMl: 750 },
    { id: 'sz-2', code: '375ml', name: 'Half 375ml', volumeMl: 375 },
    { id: 'sz-3', code: '180ml', name: 'Quarter 180ml', volumeMl: 180 }
  ];

  assert.equal(normalizeSize('750', activeSizes)?.code, '750ml');
  assert.equal(normalizeSize('Full', activeSizes)?.code, '750ml');
  assert.equal(normalizeSize('f', activeSizes)?.code, '750ml');
  assert.equal(normalizeSize('375ml', activeSizes)?.code, '375ml');
  assert.equal(normalizeSize('pint', activeSizes)?.code, '375ml');
  assert.equal(normalizeSize('qtr', activeSizes)?.code, '180ml');
  assert.equal(normalizeSize('nip', activeSizes)?.code, '180ml');
  assert.equal(normalizeSize('UnknownSize', activeSizes), null);
});

test('Import Verification: Brand matching with fuzzy fallback', () => {
  const activeBrands = [
    { id: 'b-1', name: 'Royal Stag', serialNo: 1 },
    { id: 'b-2', name: 'Blenders Pride', serialNo: 2 },
    { id: 'b-3', name: 'Signature Premier', serialNo: 3 }
  ];

  // Exact match
  const m1 = matchBrand('Royal Stag', activeBrands);
  assert.equal(m1?.brand.name, 'Royal Stag');
  assert.equal(m1?.confidence, 1.0);

  // Minor typos / case differences
  const m2 = matchBrand('royal stag', activeBrands);
  assert.equal(m2?.brand.name, 'Royal Stag');

  // Trailing noise
  const m3 = matchBrand('Blenders Pride Whisky', activeBrands);
  assert.equal(m3?.brand.name, 'Blenders Pride');
});

test('Import Verification: Spreadsheet parsing and formula integrity without DB write', async () => {
  // Create an in-memory workbook with test rows
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Daily Stock');
  sheet.addRow(['Brand', 'Size', 'Opening', 'Indent', 'Total', 'Closing', 'Sale', 'Rate', 'Amount']);
  sheet.addRow(['Royal Stag', '750ml', 10, 5, 15, 8, 7, 600, 4200]);
  sheet.addRow(['Blenders Pride', '180ml', 20, 10, 30, 25, 5, 250, 1250]);

  const buffer = await workbook.xlsx.writeBuffer();
  const file = {
    originalname: 'test_sheet.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(buffer),
    size: buffer.length
  };

  const activeBrands = [
    { id: 'b-1', name: 'Royal Stag', serialNo: 1 },
    { id: 'b-2', name: 'Blenders Pride', serialNo: 2 }
  ];
  const activeSizes = [
    { id: 'sz-1', code: '750ml', name: 'Bottle 750ml', volumeMl: 750 },
    { id: 'sz-3', code: '180ml', name: 'Quarter 180ml', volumeMl: 180 }
  ];
  const activeRates = [
    { brandId: 'b-1', sizeId: 'sz-1', rate: '600.00', shopId: 'SHOP1' },
    { brandId: 'b-2', sizeId: 'sz-3', rate: '250.00', shopId: 'SHOP1' }
  ];

  const analysis = await analyzeStockFiles({
    files: [file],
    shopId: 'SHOP1',
    activeBrands,
    activeSizes,
    activeRates
  });

  assert.equal(analysis.rows.length, 2);
  assert.equal(analysis.rows[0].brandName, 'Royal Stag');
  assert.equal(analysis.rows[0].totalStock, 15);
  assert.equal(analysis.rows[0].saleCount, 7);
  assert.equal(analysis.rows[0].bottleRate, 600);
  assert.equal(analysis.rows[0].saleAmount, 4200);
  assert.equal(analysis.rows[0].status, 'VERIFIED');

  assert.equal(analysis.rows[1].brandName, 'Blenders Pride');
  assert.equal(analysis.rows[1].totalStock, 30);
  assert.equal(analysis.rows[1].saleCount, 5);
  assert.equal(analysis.rows[1].saleAmount, 1250);
  assert.equal(analysis.rows[1].status, 'VERIFIED');
});
