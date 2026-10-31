const ExcelJS = require('exceljs');

// Levenshtein similarity distance (0 to 1)
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const str1 = String(s1).toLowerCase().trim();
  const str2 = String(s2).toLowerCase().trim();
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;

  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  const distance = track[str2.length][str1.length];
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// Normalize size strings
const normalizeSize = (rawSize, activeSizes) => {
  if (!rawSize) return null;
  const s = String(rawSize).trim().toLowerCase();

  // Try direct match with code or name
  for (const size of activeSizes) {
    const code = size.code.toLowerCase();
    const name = size.name.toLowerCase();
    if (s === code || s === name) return size;
    if (size.volumeMl && (s === `${size.volumeMl}` || s === `${size.volumeMl}ml`)) return size;
  }

  // Common aliases
  const aliasMap = {
    '750': '750ml',
    '750ml': '750ml',
    'f': '750ml',
    'full': '750ml',
    'bottle': '750ml',
    '375': '375ml',
    '375ml': '375ml',
    'p': '375ml',
    'pint': '375ml',
    'half': '375ml',
    '180': '180ml',
    '180ml': '180ml',
    'q': '180ml',
    'qtr': '180ml',
    'quarter': '180ml',
    'nip': '180ml',
    'n': '180ml',
    '650': '650ml',
    '650ml': '650ml',
    '500': '500ml',
    '500ml': '500ml',
    'can': '500ml',
    '1000': '1000ml',
    '1000ml': '1000ml',
    '1l': '1000ml',
    '1 ltr': '1000ml',
    'ltr': '1000ml',
    '2000': '2000ml',
    '2000ml': '2000ml',
    '2l': '2000ml'
  };

  const mappedTarget = aliasMap[s];
  if (mappedTarget) {
    const matched = activeSizes.find(sz =>
      sz.code.toLowerCase() === mappedTarget ||
      sz.name.toLowerCase().includes(mappedTarget) ||
      (sz.volumeMl && `${sz.volumeMl}ml` === mappedTarget)
    );
    if (matched) return matched;
  }

  // Fallback fuzzy search on size
  let bestSize = null;
  let bestSim = 0;
  for (const size of activeSizes) {
    const sim = Math.max(
      stringSimilarity(s, size.code),
      stringSimilarity(s, size.name),
      size.volumeMl ? stringSimilarity(s, `${size.volumeMl}ml`) : 0
    );
    if (sim > bestSim && sim >= 0.7) {
      bestSim = sim;
      bestSize = size;
    }
  }

  return bestSize;
};

// Match brand against master list
const matchBrand = (rawBrand, activeBrands) => {
  if (!rawBrand) return null;
  const b = String(rawBrand).trim();
  const bClean = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Exact match (case insensitive)
  for (const brand of activeBrands) {
    if (brand.name.trim().toLowerCase() === b.toLowerCase()) {
      return { brand, confidence: 1.0 };
    }
  }

  // 2. Cleaned match or contains
  for (const brand of activeBrands) {
    const nameClean = brand.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (nameClean === bClean) {
      return { brand, confidence: 0.98 };
    }
    if (bClean.startsWith(nameClean) || nameClean.startsWith(bClean)) {
      return { brand, confidence: 0.92 };
    }
  }

  // 3. Fuzzy Levenshtein match
  let bestBrand = null;
  let bestSim = 0;
  for (const brand of activeBrands) {
    const nameClean = brand.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const sim = stringSimilarity(bClean, nameClean);
    if (sim > bestSim) {
      bestSim = sim;
      bestBrand = brand;
    }
  }

  if (bestBrand && bestSim >= 0.75) {
    return { brand: bestBrand, confidence: bestSim };
  }

  return null;
};

// Clean numeric text
const parseNumber = (val, defaultValue = 0) => {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultValue : num;
};

// Parse Excel / CSV Worksheets
const parseSpreadsheetBuffer = async (buffer, filename) => {
  const workbook = new ExcelJS.Workbook();
  const rowsData = [];

  const isCsv = filename.toLowerCase().endsWith('.csv');
  if (isCsv) {
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    await workbook.csv.read(bufferStream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  workbook.eachSheet((worksheet, sheetId) => {
    let headerMap = null;

    worksheet.eachRow((row, rowNumber) => {
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = cell.value;
        if (val && typeof val === 'object' && val.text) val = val.text;
        if (val && typeof val === 'object' && val.result !== undefined) val = val.result;
        values[colNumber - 1] = val !== undefined && val !== null ? String(val).trim() : '';
      });

      // Attempt to identify header row
      if (!headerMap) {
        const rowStr = values.join(' ').toLowerCase();
        if (
          rowStr.includes('brand') ||
          rowStr.includes('item') ||
          rowStr.includes('particular') ||
          rowStr.includes('opening') ||
          rowStr.includes('closing') ||
          rowStr.includes('sale')
        ) {
          headerMap = {};
          values.forEach((v, idx) => {
            const h = v.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (h.includes('brand') || h.includes('item') || h.includes('particular') || h.includes('desc')) {
              headerMap.brand = idx;
            } else if (h.includes('size') || h.includes('volume') || h.includes('ml') || h.includes('pack')) {
              headerMap.size = idx;
            } else if (h.includes('open') || h.includes('op')) {
              headerMap.opening = idx;
            } else if (h.includes('indent') || h.includes('recd') || h.includes('receipt') || h.includes('inward')) {
              headerMap.indent = idx;
            } else if (h.includes('tot') || h.includes('avail')) {
              headerMap.total = idx;
            } else if (h.includes('clos') || h.includes('cl') || h.includes('bal')) {
              headerMap.closing = idx;
            } else if (h.includes('sale') || h.includes('sold') || h.includes('issue')) {
              headerMap.sale = idx;
            } else if (h.includes('rate') || h.includes('price') || h.includes('mrp')) {
              headerMap.rate = idx;
            } else if (h.includes('amt') || h.includes('amount') || h.includes('value')) {
              headerMap.amount = idx;
            } else if (h.includes('extra') || h.includes('spl')) {
              headerMap.extra = idx;
            }
          });
          return; // Skip header row
        }
      }

      // Check if valid data row
      const nonEmpty = values.filter(v => v !== '');
      if (nonEmpty.length < 2) return;

      // Extract row data
      let rawBrand = '';
      let rawSize = '';
      let opening = 0;
      let indent = 0;
      let total = 0;
      let closing = 0;
      let sale = 0;
      let rate = 0;
      let amount = 0;
      let extra = 0;

      if (headerMap && headerMap.brand !== undefined) {
        rawBrand = values[headerMap.brand] || '';
        rawSize = headerMap.size !== undefined ? values[headerMap.size] || '' : '';
        opening = headerMap.opening !== undefined ? parseNumber(values[headerMap.opening]) : 0;
        indent = headerMap.indent !== undefined ? parseNumber(values[headerMap.indent]) : 0;
        total = headerMap.total !== undefined ? parseNumber(values[headerMap.total]) : 0;
        closing = headerMap.closing !== undefined ? parseNumber(values[headerMap.closing]) : 0;
        sale = headerMap.sale !== undefined ? parseNumber(values[headerMap.sale]) : 0;
        rate = headerMap.rate !== undefined ? parseNumber(values[headerMap.rate]) : 0;
        amount = headerMap.amount !== undefined ? parseNumber(values[headerMap.amount]) : 0;
        extra = headerMap.extra !== undefined ? parseNumber(values[headerMap.extra]) : 0;
      } else {
        // Positional fallback
        if (isNaN(parseFloat(values[0])) && values[0].length > 1) {
          rawBrand = values[0];
          rawSize = values[1] || '';
          opening = parseNumber(values[2]);
          indent = parseNumber(values[3]);
          closing = parseNumber(values[5] || values[4]);
        } else {
          rawBrand = values[1] || '';
          rawSize = values[2] || '';
          opening = parseNumber(values[3]);
          indent = parseNumber(values[4]);
          total = parseNumber(values[5]);
          closing = parseNumber(values[6]);
          sale = parseNumber(values[7]);
          rate = parseNumber(values[8]);
          amount = parseNumber(values[9]);
        }
      }

      if (rawBrand && rawBrand.toLowerCase() !== 'total' && rawBrand.toLowerCase() !== 'grand total') {
        rowsData.push({
          sourceFileName: filename,
          sourcePageIndex: sheetId,
          rawBrand,
          rawSize,
          openingStock: Math.round(opening),
          indentStock: Math.round(indent),
          totalStock: Math.round(total),
          closingStock: Math.round(closing),
          saleCount: Math.round(sale),
          bottleRate: rate,
          saleAmount: amount,
          extraAmount: extra
        });
      }
    });
  });

  return rowsData;
};

/**
 * Main analyze function that parses spreadsheet files and enriches rows with Master Data
 */
const analyzeStockFiles = async ({ files, shopId, activeBrands, activeSizes, activeRates }) => {
  // Build lookup maps for rates: `${brandId}_${sizeId}` -> rate
  const rateMap = {};
  for (const r of activeRates) {
    const key = `${r.brandId}_${r.sizeId}`;
    if (!rateMap[key] || r.shopId === shopId) {
      rateMap[key] = parseFloat(r.rate);
    }
  }

  const rawExtractedRows = [];
  const fileSummaries = [];

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    const originalName = file.originalname || `spreadsheet_${fileIdx + 1}.xlsx`;
    const ext = originalName.split('.').pop().toLowerCase();
    const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext);

    if (!isSpreadsheet) {
      continue;
    }

    const extracted = await parseSpreadsheetBuffer(file.buffer, originalName);

    fileSummaries.push({
      fileName: originalName,
      fileSize: file.size,
      fileType: 'SPREADSHEET',
      rowCount: extracted.length
    });

    rawExtractedRows.push(...extracted);
  }

  // Validate, match against master, and apply authoritative formulas
  const seenCombos = new Map();
  const processedRows = rawExtractedRows.map((row, index) => {
    const id = `item_${Date.now()}_${index}`;
    const validationIssues = [];

    // 1. Brand matching
    const brandMatch = matchBrand(row.rawBrand, activeBrands);
    const matchedBrand = brandMatch ? brandMatch.brand : null;
    if (!matchedBrand) {
      validationIssues.push(`Brand "${row.rawBrand}" not found in Brand Master`);
    }

    // 2. Size matching
    const matchedSize = normalizeSize(row.rawSize, activeSizes);
    if (!matchedSize) {
      validationIssues.push(`Size "${row.rawSize || 'Unknown'}" not found in Size Master`);
    }

    // 3. Rate determination
    let rate = parseNumber(row.bottleRate, 0);
    if (matchedBrand && matchedSize) {
      const rateKey = `${matchedBrand.id}_${matchedSize.id}`;
      const systemRate = rateMap[rateKey];
      if (systemRate !== undefined && systemRate > 0) {
        if (rate > 0 && Math.abs(rate - systemRate) > 0.01) {
          validationIssues.push(`Doc rate ₹${rate.toFixed(2)} differs from Master rate ₹${systemRate.toFixed(2)} (using Master)`);
        }
        rate = systemRate;
      } else if (rate === 0) {
        validationIssues.push(`No rate configured for ${matchedBrand.name} (${matchedSize.code})`);
      }
    }

    // 4. Quantities & Formulas
    let opening = parseNumber(row.openingStock, 0);
    let indent = parseNumber(row.indentStock, 0);
    let closing = parseNumber(row.closingStock, 0);

    if (opening < 0) {
      validationIssues.push('Opening stock cannot be negative');
      opening = 0;
    }
    if (indent < 0) {
      validationIssues.push('Indent stock cannot be negative');
      indent = 0;
    }
    if (closing < 0) {
      validationIssues.push('Closing stock cannot be negative');
      closing = 0;
    }

    // Calculated derived values
    const total = opening + indent;
    if (closing > total) {
      validationIssues.push(`Closing stock (${closing}) cannot exceed Total stock (${total})`);
    }

    const sale = Math.max(0, total - closing);
    const stockValue = total * rate;
    const saleAmount = sale * rate;
    const extraAmount = parseNumber(row.extraAmount, 0);

    // 5. Duplicate Detection
    const comboKey = matchedBrand && matchedSize ? `${matchedBrand.id}_${matchedSize.id}` : null;
    let isDuplicate = false;
    if (comboKey) {
      if (seenCombos.has(comboKey)) {
        isDuplicate = true;
        validationIssues.push(`Duplicate row: ${matchedBrand.name} (${matchedSize.code}) appears multiple times in batch`);
      } else {
        seenCombos.set(comboKey, index);
      }
    }

    // 6. Overall Status Determination
    let status = 'VERIFIED';
    if (!matchedBrand) {
      status = 'BRAND_NOT_FOUND';
    } else if (!matchedSize) {
      status = 'SIZE_NOT_FOUND';
    } else if (isDuplicate) {
      status = 'DUPLICATE';
    } else if (closing > total || opening < 0 || indent < 0 || closing < 0) {
      status = 'INVALID';
    } else if (validationIssues.length > 0) {
      status = 'NEEDS_REVIEW';
    }

    return {
      id,
      sourceFileName: row.sourceFileName || 'Uploaded Spreadsheet',
      sourcePageIndex: row.sourcePageIndex || 1,
      rawBrand: row.rawBrand,
      rawSize: row.rawSize,
      brandId: matchedBrand ? matchedBrand.id : '',
      brandName: matchedBrand ? matchedBrand.name : row.rawBrand || '',
      sizeId: matchedSize ? matchedSize.id : '',
      sizeCode: matchedSize ? matchedSize.code : row.rawSize || '',
      openingStock: opening,
      indentStock: indent,
      totalStock: total,
      closingStock: closing,
      saleCount: sale,
      bottleRate: rate,
      stockValue: parseFloat(stockValue.toFixed(2)),
      saleAmount: parseFloat(saleAmount.toFixed(2)),
      extraAmount: parseFloat(extraAmount.toFixed(2)),
      status,
      validationIssues
    };
  });

  return {
    fileSummaries,
    rows: processedRows
  };
};

module.exports = {
  stringSimilarity,
  normalizeSize,
  matchBrand,
  parseNumber,
  parseSpreadsheetBuffer,
  analyzeStockFiles
};
