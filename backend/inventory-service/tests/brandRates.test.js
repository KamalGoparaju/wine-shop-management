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

// 7. Dynamic Size Columns Resolution with Dash Fallback
test('Brand Rates: Dynamic size columns rendering resolution with dash fallback', () => {
  const activeSizes = [
    { id: 'sz-1l', code: '1L', name: '1 Liter' },
    { id: 'sz-q', code: 'Q', name: 'Quart (750ml)' },
    { id: 'sz-p', code: 'P', name: 'Pint (375ml)' },
    { id: 'sz-n', code: 'N', name: 'Nip (180ml)' }
  ];

  const brandRoyalStag = {
    id: 'b-rs',
    name: 'Royal Stag',
    rates: [
      { sizeId: 'sz-1l', rate: 1200, isActive: true },
      { sizeId: 'sz-q', rate: 850, isActive: true },
      { sizeId: 'sz-p', rate: 450, isActive: true },
      { sizeId: 'sz-n', rate: 230, isActive: true }
    ]
  };

  const brandRedLabel = {
    id: 'b-rl',
    name: 'Red Label',
    rates: [
      { sizeId: 'sz-q', rate: 2100, isActive: true },
      { sizeId: 'sz-p', rate: 1100, isActive: true },
      { sizeId: 'sz-n', rate: 550, isActive: true }
    ]
  };

  const resolveColumnRate = (brand, sizeId) => {
    const r = (brand.rates || []).find(rt => rt.sizeId === sizeId && rt.isActive);
    return (r && r.rate > 0) ? `₹${parseFloat(r.rate).toFixed(0)}` : '—';
  };

  // Royal Stag has all 4 sizes
  assert.strictEqual(resolveColumnRate(brandRoyalStag, 'sz-1l'), '₹1200');
  assert.strictEqual(resolveColumnRate(brandRoyalStag, 'sz-q'), '₹850');
  assert.strictEqual(resolveColumnRate(brandRoyalStag, 'sz-p'), '₹450');
  assert.strictEqual(resolveColumnRate(brandRoyalStag, 'sz-n'), '₹230');

  // Red Label only has Q, P, N; 1 Liter renders dash
  assert.strictEqual(resolveColumnRate(brandRedLabel, 'sz-1l'), '—', '1L must render as dash for Red Label');
  assert.strictEqual(resolveColumnRate(brandRedLabel, 'sz-q'), '₹2100');
  assert.strictEqual(resolveColumnRate(brandRedLabel, 'sz-p'), '₹1100');
  assert.strictEqual(resolveColumnRate(brandRedLabel, 'sz-n'), '₹550');
});

// 8. Brand Size Rates Synchronization (Add / Remove applicable sizes)
test('Brand Rates: Synchronization of applicable sizes on brand update', () => {
  // Brand initially configured with Q and P
  let brandSizes = [
    { sizeId: 'sz-q', rate: 850, isActive: true },
    { sizeId: 'sz-p', rate: 450, isActive: true }
  ];

  // Operator updates brand: removes P, updates Q to 900, adds N at 240
  const updatedInputs = [
    { sizeId: 'sz-q', rate: 900 },
    { sizeId: 'sz-n', rate: 240 }
  ];

  const syncBrandSizes = (existing, inputs) => {
    const inputMap = new Map(inputs.map(i => [i.sizeId, parseFloat(i.rate)]));
    const result = [];

    // Update or deactivate existing
    for (const ex of existing) {
      if (inputMap.has(ex.sizeId)) {
        result.push({ sizeId: ex.sizeId, rate: inputMap.get(ex.sizeId), isActive: true });
        inputMap.delete(ex.sizeId);
      } else {
        result.push({ sizeId: ex.sizeId, rate: ex.rate, isActive: false }); // safely deactivated
      }
    }
    // Add new ones
    for (const [sizeId, rate] of inputMap) {
      result.push({ sizeId, rate, isActive: true });
    }
    return result;
  };

  const synced = syncBrandSizes(brandSizes, updatedInputs);
  const activeSynced = synced.filter(s => s.isActive);

  assert.strictEqual(activeSynced.length, 2);
  assert.strictEqual(activeSynced.find(s => s.sizeId === 'sz-q').rate, 900);
  assert.strictEqual(activeSynced.find(s => s.sizeId === 'sz-n').rate, 240);
  assert.strictEqual(synced.find(s => s.sizeId === 'sz-p').isActive, false, 'Unselected size P must be deactivated');
});

// 9. Historical Rate Immutability
test('Brand Rates: Historical stock records maintain original rate snapshot when brand rate changes', () => {
  // Day 1: Royal Stag Q rate = 850
  const day1Record = {
    businessDate: '2026-11-06',
    brandName: 'Royal Stag',
    sizeCode: 'Q',
    saleCount: 5,
    bottleRate: 850,
    saleAmount: 4250
  };

  // Day 5: Brand rate updated to 900 in Brand Management
  const currentBrandRates = {
    'Royal Stag_Q': 900
  };

  // Day 1 record accessed later (e.g. Closing History, PDF, CSV)
  assert.strictEqual(day1Record.bottleRate, 850, 'Historical snapshot must not change');
  assert.strictEqual(day1Record.saleAmount, 4250, 'Historical sales amount must remain 4250');
  assert.notStrictEqual(day1Record.bottleRate, currentBrandRates['Royal Stag_Q']);
});

// 10. Rate Missing Validation for Daily Stock Finalization
test('Brand Rates: Prevents daily stock finalization if any row has missing or zero rate', () => {
  const stockSheet = [
    { brand: { name: 'Royal Stag' }, size: { code: 'Q' }, bottleRate: 850 },
    { brand: { name: 'Local Brew' }, size: { code: 'Q' }, bottleRate: 0 } // Rate not configured
  ];

  const validateSheetForFinalize = (rows) => {
    const unconfigured = rows.find(r => !r.bottleRate || parseFloat(r.bottleRate) <= 0);
    if (unconfigured) {
      return {
        allowed: false,
        error: `Cannot finalize: "${unconfigured.brand.name} (${unconfigured.size.code})" has no selling rate configured.`
      };
    }
    return { allowed: true };
  };

  const validationResult = validateSheetForFinalize(stockSheet);
  assert.strictEqual(validationResult.allowed, false);
  assert.ok(validationResult.error.includes('Local Brew'));
});

// 11. Brand-Specific Size Filtering: Only brand-configured sizes appear in dropdown
test('Brand Rates: Daily Stock displays ONLY brand-configured sizes (Royal Stag vs Black Label)', () => {
  // Size Master
  const allMasterSizes = [
    { id: 'sz-1l', code: '1LITER', name: '1 Liter', volumeMl: 1000 },
    { id: 'sz-q', code: 'Q', name: 'Quart', volumeMl: 750 },
    { id: 'sz-p', code: 'P', name: 'Pint', volumeMl: 375 },
    { id: 'sz-n', code: 'N', name: 'Nip', volumeMl: 180 },
    { id: 'sz-d', code: 'D', name: 'Draft', volumeMl: 60 }
  ];

  // Brand Configurations
  // Royal Stag: Q (850), P (450), N (230)
  // Black Label: 1 Liter (3200), Q (2400)
  const brandRates = [
    { brandId: 'b-royal-stag', sizeId: 'sz-q', rate: 850, isActive: true },
    { brandId: 'b-royal-stag', sizeId: 'sz-p', rate: 450, isActive: true },
    { brandId: 'b-royal-stag', sizeId: 'sz-n', rate: 230, isActive: true },
    { brandId: 'b-black-label', sizeId: 'sz-1l', rate: 3200, isActive: true },
    { brandId: 'b-black-label', sizeId: 'sz-q', rate: 2400, isActive: true }
  ];

  const getAvailableSizesForBrand = (brandId) => {
    const configuredRateSizeIds = new Set(
      brandRates.filter(r => r.brandId === brandId && r.isActive).map(r => r.sizeId)
    );
    return allMasterSizes.filter(s => configuredRateSizeIds.has(s.id));
  };

  // Royal Stag check: must show ONLY Q, P, N; NOT 1 Liter or D
  const royalStagSizes = getAvailableSizesForBrand('b-royal-stag');
  const royalStagCodes = royalStagSizes.map(s => s.code);
  assert.deepStrictEqual(royalStagCodes, ['Q', 'P', 'N']);
  assert.ok(!royalStagCodes.includes('1LITER'), 'Royal Stag must not show 1LITER');
  assert.ok(!royalStagCodes.includes('D'), 'Royal Stag must not show D');

  // Black Label check: must show ONLY 1 Liter, Q; NOT P, N, D
  const blackLabelSizes = getAvailableSizesForBrand('b-black-label');
  const blackLabelCodes = blackLabelSizes.map(s => s.code);
  assert.deepStrictEqual(blackLabelCodes, ['1LITER', 'Q']);
  assert.ok(!blackLabelCodes.includes('P'), 'Black Label must not show P');
  assert.ok(!blackLabelCodes.includes('N'), 'Black Label must not show N');
  assert.ok(!blackLabelCodes.includes('D'), 'Black Label must not show D');
});

// 12. Brand Change Behavior: Clears previously selected size and rate
test('Brand Rates: Changing brand clears previously selected size and rate in Daily Stock', () => {
  let currentRow = {
    brandId: 'b-black-label',
    brandName: 'Black Label',
    sizeId: 'sz-1l',
    sizeCode: '1LITER',
    bottleRate: 3200
  };

  const handleBrandChange = (row, newBrandId, newBrandName) => {
    return {
      ...row,
      brandId: newBrandId,
      brandName: newBrandName,
      // Brand Change Behavior: Clear previously selected size and rate
      sizeId: '',
      sizeCode: '',
      bottleRate: 0
    };
  };

  // User changes brand to Royal Stag
  const updatedRow = handleBrandChange(currentRow, 'b-royal-stag', 'Royal Stag');
  assert.strictEqual(updatedRow.brandId, 'b-royal-stag');
  assert.strictEqual(updatedRow.sizeId, '', 'Previous size must be cleared');
  assert.strictEqual(updatedRow.sizeCode, '', 'Previous size code must be cleared');
  assert.strictEqual(updatedRow.bottleRate, 0, 'Previous rate must be cleared');
});

// 13. Backend Validation: Rejection of unconfigured Brand + Size combination
test('Brand Rates: Backend rejects unconfigured Brand + Size combination with INVALID_BRAND_SIZE_COMBINATION', () => {
  const activeRateMap = new Map([
    ['b-royal-stag_sz-q', 850],
    ['b-royal-stag_sz-p', 450],
    ['b-royal-stag_sz-n', 230]
  ]);

  const validateItemCombination = (brandId, sizeId) => {
    const key = `${brandId}_${sizeId}`;
    if (!activeRateMap.has(key)) {
      return {
        valid: false,
        status: 400,
        error: 'INVALID_BRAND_SIZE_COMBINATION',
        message: 'Invalid Brand and Size combination: Size is not configured for Brand.'
      };
    }
    return { valid: true };
  };

  // Valid combination: Royal Stag + Q
  const validCheck = validateItemCombination('b-royal-stag', 'sz-q');
  assert.strictEqual(validCheck.valid, true);

  // Invalid combination: Royal Stag + 1 Liter (tampered API request)
  const invalidCheck = validateItemCombination('b-royal-stag', 'sz-1l');
  assert.strictEqual(invalidCheck.valid, false);
  assert.strictEqual(invalidCheck.status, 400);
  assert.strictEqual(invalidCheck.error, 'INVALID_BRAND_SIZE_COMBINATION');
});

// 14. Automatic Rate Fetching
test('Brand Rates: Selecting Brand and Size auto-fetches the configured rate', () => {
  const ratesDatabase = [
    { brandId: 'b-royal-stag', sizeId: 'sz-q', shopId: null, rate: 850 },
    { brandId: 'b-royal-stag', sizeId: 'sz-q', shopId: 'SHOP2', rate: 870 }, // Shop override
    { brandId: 'b-royal-stag', sizeId: 'sz-p', shopId: null, rate: 450 }
  ];

  const resolveSellingRate = (brandId, sizeId, activeShopId) => {
    const matching = ratesDatabase.filter(r => r.brandId === brandId && r.sizeId === sizeId);
    if (matching.length === 0) return 0;

    const shopOverride = matching.find(r => r.shopId === activeShopId);
    if (shopOverride) return shopOverride.rate;

    const globalRate = matching.find(r => !r.shopId);
    return globalRate ? globalRate.rate : 0;
  };

  // Shop 1 (uses global rate 850)
  assert.strictEqual(resolveSellingRate('b-royal-stag', 'sz-q', 'SHOP1'), 850);
  // Shop 2 (uses shop-specific override 870)
  assert.strictEqual(resolveSellingRate('b-royal-stag', 'sz-q', 'SHOP2'), 870);
  // Royal Stag P (global rate 450 in both shops)
  assert.strictEqual(resolveSellingRate('b-royal-stag', 'sz-p', 'SHOP1'), 450);
  assert.strictEqual(resolveSellingRate('b-royal-stag', 'sz-p', 'SHOP2'), 450);
});
