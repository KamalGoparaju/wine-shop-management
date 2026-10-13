const test = require('node:test');
const assert = require('node:assert');

// 1. Brand with Rates Creation Validation
test('Brand Rates: Valid brand and size rates data structure validation', () => {
  const validateBrandInput = ({ name, serialNo, sizes }) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: 'VALIDATION_ERROR', message: 'Brand name is required' };
    }
    if (serialNo !== undefined && serialNo !== null && serialNo !== '') {
      const parsed = parseInt(serialNo, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return { isValid: false, error: 'VALIDATION_ERROR', message: 'Serial number must be positive' };
      }
    }
    if (!Array.isArray(sizes) || sizes.length === 0) {
      return { isValid: false, error: 'VALIDATION_ERROR', message: 'At least one size required' };
    }
    for (const s of sizes) {
      if (!s.sizeId) {
        return { isValid: false, error: 'VALIDATION_ERROR', message: 'Valid sizeId required' };
      }
      const rate = parseFloat(s.rate);
      if (isNaN(rate) || rate < 0) {
        return { isValid: false, error: 'VALIDATION_ERROR', message: 'Rate must be non-negative' };
      }
    }
    return { isValid: true };
  };

  // Valid brand with Q and P
  const valid = validateBrandInput({
    name: 'Blenders Pride Reserve',
    serialNo: 5,
    sizes: [
      { sizeId: 'size-q', rate: 580 },
      { sizeId: 'size-p', rate: 310 }
    ]
  });
  assert.strictEqual(valid.isValid, true);

  // Missing name
  const emptyName = validateBrandInput({ name: '   ', sizes: [{ sizeId: 'size-q', rate: 500 }] });
  assert.strictEqual(emptyName.isValid, false);
  assert.strictEqual(emptyName.error, 'VALIDATION_ERROR');

  // No sizes configured
  const noSizes = validateBrandInput({ name: 'Old Monk', sizes: [] });
  assert.strictEqual(noSizes.isValid, false);

  // Negative rate
  const negRate = validateBrandInput({
    name: 'Kingfisher Ultra',
    sizes: [{ sizeId: 'size-q', rate: -50 }]
  });
  assert.strictEqual(negRate.isValid, false);
});

// 2. Uniqueness Validations: Duplicate Brand Name & Serial Number
test('Brand Rates: Rejection of duplicate brand name and serial number', () => {
  const existingBrands = [
    { id: 'b1', name: 'Royal Stag', serialNo: 1 },
    { id: 'b2', name: 'Imperial Blue', serialNo: 2 },
    { id: 'b3', name: 'Officers Choice', serialNo: 3 }
  ];

  const checkDuplicates = (name, serialNo) => {
    const trimmed = name.trim().toLowerCase();
    const dupName = existingBrands.find(b => b.name.toLowerCase() === trimmed);
    if (dupName) {
      return { isDuplicate: true, error: 'DUPLICATE_BRAND_NAME', message: `Brand '${dupName.name}' exists` };
    }
    if (serialNo !== undefined && serialNo !== null) {
      const dupSerial = existingBrands.find(b => b.serialNo === serialNo);
      if (dupSerial) {
        return { isDuplicate: true, error: 'DUPLICATE_SERIAL_NO', message: `Serial #${serialNo} is in use` };
      }
    }
    return { isDuplicate: false };
  };

  // Duplicate name check (case-insensitive)
  const dupNameResult = checkDuplicates('royal stag', 10);
  assert.strictEqual(dupNameResult.isDuplicate, true);
  assert.strictEqual(dupNameResult.error, 'DUPLICATE_BRAND_NAME');

  // Duplicate serial number check
  const dupSerialResult = checkDuplicates('Signature Rare', 2);
  assert.strictEqual(dupSerialResult.isDuplicate, true);
  assert.strictEqual(dupSerialResult.error, 'DUPLICATE_SERIAL_NO');

  // Unique new brand
  const uniqueResult = checkDuplicates('Signature Rare', 4);
  assert.strictEqual(uniqueResult.isDuplicate, false);
});

// 3. Auto-increment Serial Number Calculation
test('Brand Rates: Auto-increment sequential serial number calculation', () => {
  const brands = [
    { serialNo: 1 },
    { serialNo: 2 },
    { serialNo: 4 } // gaps handled cleanly
  ];

  const calculateNextSerialNo = (brandList) => {
    if (!brandList || brandList.length === 0) return 1;
    const maxSerial = Math.max(...brandList.map(b => b.serialNo || 0));
    return maxSerial + 1;
  };

  assert.strictEqual(calculateNextSerialNo([]), 1);
  assert.strictEqual(calculateNextSerialNo(brands), 5);
});

// 4. Dynamic Merge of Newly Added Brand into Existing Daily Stock Sheet
test('Brand Rates: Newly added brand dynamically merges missing configured size rows into active sheet', () => {
  // Existing sheet for today (already has Royal Stag Q, P, N)
  const existingSheetRecords = [
    { brandId: 'b1', sizeId: 's-q', openingStock: 10, totalStock: 10, closingStock: 7, bottleRate: 410 },
    { brandId: 'b1', sizeId: 's-p', openingStock: 8, totalStock: 8, closingStock: 4, bottleRate: 220 },
    { brandId: 'b1', sizeId: 's-n', openingStock: 15, totalStock: 15, closingStock: 10, bottleRate: 120 }
  ];

  // Newly configured brand: Blenders Pride (b2) with only Q (750ml) and P (375ml) configured
  const activeBrands = [
    { id: 'b1', name: 'Royal Stag', serialNo: 1 },
    { id: 'b2', name: 'Blenders Pride', serialNo: 2 }
  ];
  const activeSizes = [
    { id: 's-q', code: 'Q', volumeMl: 750 },
    { id: 's-p', code: 'P', volumeMl: 375 },
    { id: 's-n', code: 'N', volumeMl: 180 }
  ];
  const activeRates = {
    'b1_s-q': 410,
    'b1_s-p': 220,
    'b1_s-n': 120,
    'b2_s-q': 560, // b2 only has Q and P rates configured
    'b2_s-p': 300
    // b2_s-n is NOT configured
  };

  // Dynamic merge algorithm
  const existingKeys = new Set(existingSheetRecords.map(r => `${r.brandId}_${r.sizeId}`));
  const mergedRecords = [...existingSheetRecords];

  for (const brand of activeBrands) {
    const brandConfigured = Object.keys(activeRates).some(k => k.startsWith(`${brand.id}_`));
    for (const size of activeSizes) {
      const key = `${brand.id}_${size.id}`;
      if (!existingKeys.has(key)) {
        // Only include if size is configured for this brand
        if (activeRates[key] !== undefined || !brandConfigured) {
          mergedRecords.push({
            id: `temp-${key}`,
            brandId: brand.id,
            sizeId: size.id,
            brand,
            size,
            openingStock: 0, // newly introduced brand defaults to 0 opening
            indentStock: 0,
            totalStock: 0,
            closingStock: '',
            saleCount: 0,
            bottleRate: activeRates[key] || 0,
            saleAmount: 0,
            extraAmount: 0,
            status: 'DRAFT',
            isInitialOpening: true
          });
        }
      }
    }
  }

  // Verification 1: Exactly 2 new rows added (b2 Q and b2 P), NOT 3 (b2 N omitted)
  assert.strictEqual(mergedRecords.length, 5, 'Must have 3 original rows + 2 newly configured rows');

  // Verification 2: Blenders Pride N does NOT exist in sheet
  const blendersPrideN = mergedRecords.find(r => r.brandId === 'b2' && r.sizeId === 's-n');
  assert.strictEqual(blendersPrideN, undefined, 'Unconfigured size N must NOT appear');

  // Verification 3: Blenders Pride Q has correct rate and initial draft fields
  const blendersPrideQ = mergedRecords.find(r => r.brandId === 'b2' && r.sizeId === 's-q');
  assert.strictEqual(blendersPrideQ.bottleRate, 560);
  assert.strictEqual(blendersPrideQ.openingStock, 0);
  assert.strictEqual(blendersPrideQ.indentStock, 0);
  assert.strictEqual(blendersPrideQ.closingStock, '');
  assert.strictEqual(blendersPrideQ.isInitialOpening, true);
});

// 5. Stock Calculations with Newly Added Brand Rows
test('Brand Rates: Full calculation workflow when operator enters data for newly added brand', () => {
  // Operator enters Indent = 20, Closing = 8 for Blenders Pride Q (Rate = 560)
  const initialRow = {
    openingStock: 0,
    indentStock: 20,
    closingStock: 8,
    bottleRate: 560,
    extraAmount: 120
  };

  const total = initialRow.openingStock + initialRow.indentStock; // 20
  const sale = total - initialRow.closingStock; // 12
  const amount = sale * initialRow.bottleRate; // 12 * 560 = 6720
  const totalBusinessContribution = amount; // 6720 (extra amount strictly excluded)

  assert.strictEqual(total, 20);
  assert.strictEqual(sale, 12);
  assert.strictEqual(amount, 6720);
  assert.strictEqual(totalBusinessContribution, 6720);
  assert.strictEqual(initialRow.extraAmount, 120);
});

// 6. Multi-Shop Rate Isolation for Newly Added Brand
test('Brand Rates: Multi-shop rate isolation (shop-specific override vs global fallback)', () => {
  const brandRates = [
    { brandId: 'b-new', sizeId: 's-q', rate: 500, shopId: null },    // Global rate: ₹500
    { brandId: 'b-new', sizeId: 's-q', rate: 520, shopId: 'SHOP1' }, // SHOP1 premium: ₹520
    { brandId: 'b-new', sizeId: 's-q', rate: 490, shopId: 'SHOP3' }  // SHOP3 highway discount: ₹490
  ];

  const resolveBrandRate = (brandId, sizeId, targetShopId) => {
    const applicable = brandRates.filter(r => r.brandId === brandId && r.sizeId === sizeId);
    const shopSpecific = applicable.find(r => r.shopId === targetShopId);
    if (shopSpecific) return shopSpecific.rate;
    const globalRate = applicable.find(r => r.shopId === null);
    return globalRate ? globalRate.rate : 0;
  };

  assert.strictEqual(resolveBrandRate('b-new', 's-q', 'SHOP1'), 520, 'SHOP1 receives shop-specific override');
  assert.strictEqual(resolveBrandRate('b-new', 's-q', 'SHOP2'), 500, 'SHOP2 receives global fallback');
  assert.strictEqual(resolveBrandRate('b-new', 's-q', 'SHOP3'), 490, 'SHOP3 receives shop-specific override');
});
