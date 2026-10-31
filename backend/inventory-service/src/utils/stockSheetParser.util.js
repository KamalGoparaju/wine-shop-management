const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');
let Tesseract;
try {
  Tesseract = require('tesseract.js');
} catch (e) {
  console.warn('Tesseract.js not loaded, will fallback gracefully for images:', e.message);
}

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
          return; // Skip the header row itself
        }
      }

      // If we don't have a header map yet, or if values are sparse, check if this is a valid data row
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
        // Fallback positional heuristics:
        // Col 0: S.No or Brand
        // Col 1: Brand or Size
        // Following columns: Opening, Indent, Total, Closing, Sale, Rate, Amount
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

// Parse PDF documents
const parsePdfBuffer = async (buffer, filename) => {
  const data = await pdfParse(buffer);
  const text = data.text || '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const rowsData = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line looks like a table row with numbers
    const tokens = line.split(/\s{2,}|\t/).filter(t => t.trim().length > 0);
    if (tokens.length >= 4) {
      const rawBrand = tokens[0];
      const rawSize = tokens[1];
      const numbers = tokens.slice(2).map(t => parseNumber(t));
      if (rawBrand && !rawBrand.toLowerCase().includes('total') && !rawBrand.toLowerCase().includes('brand')) {
        rowsData.push({
          sourceFileName: filename,
          sourcePageIndex: 1,
          rawBrand,
          rawSize: rawSize || '750ml',
          openingStock: Math.round(numbers[0] || 0),
          indentStock: Math.round(numbers[1] || 0),
          totalStock: Math.round(numbers[2] || (numbers[0] || 0) + (numbers[1] || 0)),
          closingStock: Math.round(numbers[3] || 0),
          saleCount: Math.round(numbers[4] || 0),
          bottleRate: numbers[5] || 0,
          saleAmount: numbers[6] || 0,
          extraAmount: numbers[7] || 0
        });
      }
    }
  }

  return rowsData;
};

// Parse Images using Tesseract OCR with safe timeout fallback
const parseImageBuffer = async (buffer, filename) => {
  const rowsData = [];
  if (!Tesseract) return rowsData;

  try {
    const ocrPromise = Tesseract.recognize(buffer, 'eng');
    // Set a 20 second timeout so it won't hang indefinitely
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR Timeout')), 20000)
    );

    const result = await Promise.race([ocrPromise, timeoutPromise]);
    const text = result && result.data && result.data.text ? result.data.text : '';
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 2);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header lines
      if (line.toLowerCase().includes('brand') || line.toLowerCase().includes('opening') || line.toLowerCase().includes('closing')) {
        continue;
      }
      const parts = line.split(/[\t,|;]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        rowsData.push({
          sourceFileName: filename,
          sourcePageIndex: 1,
          rawBrand: parts[0],
          rawSize: parts[1] || '750ml',
          openingStock: parseNumber(parts[2]),
          indentStock: parseNumber(parts[3] || 0),
          closingStock: parseNumber(parts[4] || 0),
          bottleRate: parseNumber(parts[5] || 0)
        });
      }
    }
  } catch (err) {
    console.warn(`OCR parsing for image ${filename} deferred to manual verification:`, err.message);
  }

  return rowsData;
};

/**
 * Main analyze function that parses files and enriches rows with Master Data
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
    const originalName = file.originalname || `upload_${fileIdx + 1}`;
    const ext = originalName.split('.').pop().toLowerCase();
    const mimeType = file.mimetype || '';
    const isImage = mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    const isPdf = mimeType === 'application/pdf' || ext === 'pdf';
    const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel');

    // Create a base64 preview representation for browser Document Viewer
    let previewUrl = null;
    if (isImage) {
      previewUrl = `data:${mimeType || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
    }

    let extracted = [];
    if (isSpreadsheet) {
      extracted = await parseSpreadsheetBuffer(file.buffer, originalName);
    } else if (isPdf) {
      extracted = await parsePdfBuffer(file.buffer, originalName);
    } else if (isImage) {
      extracted = await parseImageBuffer(file.buffer, originalName);
    }

    fileSummaries.push({
      fileName: originalName,
      fileSize: file.size,
      fileType: isImage ? 'IMAGE' : isPdf ? 'PDF' : 'SPREADSHEET',
      rowCount: extracted.length,
      previewUrl
    });

    rawExtractedRows.push(...extracted);
  }

  // If no rows were parsed from images (e.g. handwritten paper sheets),
  // we generate pre-seeded brand rows or allow the operator to transcribe directly in the Document Viewer!
  if (rawExtractedRows.length === 0 && fileSummaries.some(f => f.fileType === 'IMAGE')) {
    // Populate active brands so the user can easily review and enter quantities side-by-side with the image
    for (const brand of activeBrands.slice(0, 20)) {
      const defaultSize = activeSizes.find(s => s.code === '750ml' || s.code === '750') || activeSizes[0];
      rawExtractedRows.push({
        sourceFileName: fileSummaries[0].fileName,
        sourcePageIndex: 1,
        rawBrand: brand.name,
        rawSize: defaultSize ? defaultSize.code : '750ml',
        openingStock: 0,
        indentStock: 0,
        totalStock: 0,
        closingStock: 0,
        saleCount: 0,
        bottleRate: 0,
        saleAmount: 0,
        extraAmount: 0
      });
    }
  }

  // Validate, match against master, and apply formulas
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
      sourceFileName: row.sourceFileName || 'Uploaded Sheet',
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
  parsePdfBuffer,
  parseImageBuffer,
  analyzeStockFiles
};
