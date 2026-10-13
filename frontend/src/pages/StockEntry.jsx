import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Package, Barcode, CheckCircle2, AlertTriangle, ArrowRight, Wand2, Trash2, Grid, AlignLeft, Clipboard } from 'lucide-react';

const StockEntry = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [numberOfBoxes, setNumberOfBoxes] = useState(2);
  const [bottlesPerBox, setBottlesPerBox] = useState(3);
  const [boxPrice, setBoxPrice] = useState(450);
  const [bottlePrice, setBottlePrice] = useState(150);
  const [notes, setNotes] = useState('');

  // Entry Mode: 'per_bottle' (Default) or 'bulk_paste'
  const [entryMode, setEntryMode] = useState('per_bottle');

  // Per-Bottle Grid State: Array of arrays [ [box0_b0, box0_b1...], [box1_b0...] ]
  const [serialsGrid, setSerialsGrid] = useState([
    ['RS10001', 'RS10002', 'RS10003'],
    ['RS10004', 'RS10005', 'RS10006']
  ]);

  // Bulk Paste State
  const [bulkText, setBulkText] = useState('RS10001\nRS10002\nRS10003\nRS10004\nRS10005\nRS10006');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // References for inputs to handle Enter key auto-advance
  const inputRefs = useRef({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiClient.get('/inventory/products', { params: { isActive: 'true' } });
        if (res.success && res.data.products.length > 0) {
          setProducts(res.data.products);
          const firstProd = res.data.products[0];
          setSelectedProductId(firstProd.id);
          setBottlesPerBox(firstProd.bottlesPerBox);
          setBoxPrice(firstProd.defaultBoxPrice);
          setBottlePrice(firstProd.defaultBottlePrice);
        }
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Sync grid dimensions when numberOfBoxes or bottlesPerBox changes
  useEffect(() => {
    const numBoxes = Math.max(1, parseInt(numberOfBoxes, 10) || 1);
    const numBottles = Math.max(1, parseInt(bottlesPerBox, 10) || 1);

    setSerialsGrid(prevGrid => {
      const newGrid = [];
      for (let b = 0; b < numBoxes; b++) {
        const boxRow = [];
        for (let p = 0; p < numBottles; p++) {
          boxRow.push(prevGrid[b]?.[p] || '');
        }
        newGrid.push(boxRow);
      }
      return newGrid;
    });
  }, [numberOfBoxes, bottlesPerBox]);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setBottlesPerBox(prod.bottlesPerBox);
      setBoxPrice(prod.defaultBoxPrice);
      setBottlePrice(prod.defaultBottlePrice);
    }
  };

  // Rule 1: Total Expected Bottles Calculation
  const totalBottles = (parseInt(numberOfBoxes, 10) || 0) * (parseInt(bottlesPerBox, 10) || 0);

  // Extract flattened serial list depending on active mode
  const getActiveSerialList = () => {
    if (entryMode === 'per_bottle') {
      return serialsGrid.flatMap(row => row.map(s => s.trim())).filter(Boolean);
    } else {
      return bulkText
        .split(/[\n,\r]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  };

  const currentSerials = getActiveSerialList();
  const filledCount = currentSerials.length;

  // Check for duplicates
  const serialCounts = {};
  currentSerials.forEach(s => {
    serialCounts[s] = (serialCounts[s] || 0) + 1;
  });
  const duplicateSerials = Object.keys(serialCounts).filter(s => serialCounts[s] > 1);
  const hasDuplicates = duplicateSerials.length > 0;

  const isValidCount = filledCount === totalBottles && totalBottles > 0 && !hasDuplicates;

  // Update specific bottle in grid
  const handleBottleSerialChange = (boxIdx, bottleIdx, val) => {
    setSerialsGrid(prev => {
      const next = prev.map(row => [...row]);
      next[boxIdx][bottleIdx] = val;
      return next;
    });
  };

  // Auto-advance focus to next bottle input when Enter is pressed
  const handleKeyDown = (e, boxIdx, bottleIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const numBottles = parseInt(bottlesPerBox, 10);
      const numBoxes = parseInt(numberOfBoxes, 10);

      let nextBox = boxIdx;
      let nextBottle = bottleIdx + 1;

      if (nextBottle >= numBottles) {
        nextBottle = 0;
        nextBox = boxIdx + 1;
      }

      if (nextBox < numBoxes) {
        const nextKey = `${nextBox}-${nextBottle}`;
        if (inputRefs.current[nextKey]) {
          inputRefs.current[nextKey].focus();
        }
      }
    }
  };

  // Helper: Auto-fill sequential serials for a specific box
  const handleAutoFillBox = (boxIdx) => {
    const startVal = serialsGrid[boxIdx]?.[0]?.trim();
    if (!startVal) {
      alert(`Please enter a starting serial number in Box ${boxIdx + 1} - Bottle 1 first.`);
      return;
    }

    // Match trailing numbers: e.g. "RS10001" -> prefix "RS", num "10001"
    const match = startVal.match(/^(.*?)(\d+)$/);
    if (!match) {
      alert('Serial number must end with digits to auto-fill sequentially (e.g. RS10001).');
      return;
    }

    const prefix = match[1];
    const numStr = match[2];
    const numLen = numStr.length;
    let startNum = parseInt(numStr, 10);

    const numBottles = parseInt(bottlesPerBox, 10);
    const newBoxRow = [];

    for (let i = 0; i < numBottles; i++) {
      const currentNum = startNum + i;
      const paddedNum = String(currentNum).padStart(numLen, '0');
      newBoxRow.push(`${prefix}${paddedNum}`);
    }

    setSerialsGrid(prev => {
      const next = prev.map(row => [...row]);
      next[boxIdx] = newBoxRow;
      return next;
    });
  };

  // Helper: Clear a specific box
  const handleClearBox = (boxIdx) => {
    const numBottles = parseInt(bottlesPerBox, 10);
    setSerialsGrid(prev => {
      const next = prev.map(row => [...row]);
      next[boxIdx] = Array(numBottles).fill('');
      return next;
    });
  };

  // Helper: Paste lines into a specific box
  const handlePasteBox = (boxIdx, e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const lines = pastedText.split(/[\n,\r]+/).map(s => s.trim()).filter(Boolean);

    if (lines.length > 0) {
      const numBottles = parseInt(bottlesPerBox, 10);
      setSerialsGrid(prev => {
        const next = prev.map(row => [...row]);
        for (let i = 0; i < numBottles; i++) {
          next[boxIdx][i] = lines[i] || next[boxIdx][i] || '';
        }
        return next;
      });
    }
  };

  // Sync grid to bulk text when switching modes
  const handleToggleMode = (mode) => {
    if (mode === 'bulk_paste' && entryMode === 'per_bottle') {
      const list = serialsGrid.flatMap(row => row.map(s => s.trim())).filter(Boolean);
      setBulkText(list.join('\n'));
    } else if (mode === 'per_bottle' && entryMode === 'bulk_paste') {
      const list = bulkText.split(/[\n,\r]+/).map(s => s.trim()).filter(Boolean);
      const numBoxes = Math.max(1, parseInt(numberOfBoxes, 10) || 1);
      const numBottles = Math.max(1, parseInt(bottlesPerBox, 10) || 1);

      let idx = 0;
      const newGrid = [];
      for (let b = 0; b < numBoxes; b++) {
        const row = [];
        for (let p = 0; p < numBottles; p++) {
          row.push(list[idx] || '');
          idx++;
        }
        newGrid.push(row);
      }
      setSerialsGrid(newGrid);
    }
    setEntryMode(mode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const serialsToSubmit = getActiveSerialList();

    if (serialsToSubmit.length !== totalBottles) {
      setError(`Serial number count (${serialsToSubmit.length}) does not match expected total bottles (${totalBottles}).`);
      return;
    }

    if (hasDuplicates) {
      setError(`Duplicate serial numbers found: ${duplicateSerials.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/inventory/stock/entries', {
        productId: selectedProductId,
        numberOfBoxes: Number(numberOfBoxes),
        bottlesPerBox: Number(bottlesPerBox),
        boxPrice: Number(boxPrice),
        bottlePrice: Number(bottlePrice),
        serialNumbers: serialsToSubmit,
        notes
      });

      if (res.success) {
        navigate(`/stock/details/${res.data.stockEntryId}`);
      }
    } catch (err) {
      setError(err?.message || 'Failed to submit stock entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="New Stock Entry">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Stock Entry</h1>
          <p className="text-sm text-slate-400">Receive stock boxes and enter physical serial numbers for every bottle</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-sm flex items-center gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Product & Quantity Setup */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Package className="w-5 h-5 text-amber-500" />
              Product Selection & Quantity Calculation
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                Product *
              </label>
              {loading ? (
                <div className="text-slate-500 text-sm py-2">Loading products...</div>
              ) : (
                <select
                  required
                  value={selectedProductId}
                  onChange={handleProductChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 font-semibold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand?.name}) — {p.bottleVolume} ({p.bottlesPerBox} bottles/box)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Number of Boxes *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={numberOfBoxes}
                  onChange={(e) => setNumberOfBoxes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Bottles Per Box *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={bottlesPerBox}
                  onChange={(e) => setBottlesPerBox(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Calculated Total Bottles Output */}
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 flex flex-col justify-center text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Total Expected Bottles</span>
                <span className="text-2xl font-extrabold text-white mt-0.5 font-mono">
                  {numberOfBoxes} × {bottlesPerBox} = <span className="text-amber-400">{totalBottles}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Purchase Box Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={boxPrice}
                  onChange={(e) => setBoxPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-emerald-400 font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Purchase Bottle Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={bottlePrice}
                  onChange={(e) => setBottlePrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-emerald-400 font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Physical Serial Numbers Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-white">Bottle Serial Numbers Entry</h2>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleToggleMode('per_bottle')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    entryMode === 'per_bottle'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  Per-Bottle Grid
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMode('bulk_paste')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    entryMode === 'bulk_paste'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  Bulk Paste Mode
                </button>
              </div>
            </div>

            {/* Counter & Warning Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <span>Total Progress:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold font-mono border ${
                  isValidCount
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border-amber-800'
                }`}>
                  {filledCount} / {totalBottles} Bottles Entered
                </span>
              </div>

              {hasDuplicates && (
                <div className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Duplicate Serials: {duplicateSerials.join(', ')}</span>
                </div>
              )}
            </div>

            {/* MODE A: PER-BOTTLE GRID */}
            {entryMode === 'per_bottle' ? (
              <div className="space-y-6">
                {serialsGrid.map((boxRow, boxIdx) => (
                  <div key={boxIdx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                      <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Box #{boxIdx + 1} ({boxRow.filter(Boolean).length} / {bottlesPerBox} bottles filled)
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAutoFillBox(boxIdx)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 rounded-lg text-xs font-medium transition-all"
                          title="Auto-fill sequential serial numbers starting from Bottle 1"
                        >
                          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                          Auto-Fill Box
                        </button>

                        <button
                          type="button"
                          onClick={() => handleClearBox(boxIdx)}
                          className="p-1 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition-colors"
                          title="Clear Box Serials"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Per-Bottle Grid Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                      {boxRow.map((val, bottleIdx) => {
                        const globalBottleNumber = (boxIdx * bottlesPerBox) + bottleIdx + 1;
                        const isDup = val.trim() && serialCounts[val.trim()] > 1;

                        return (
                          <div key={bottleIdx} className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-400">
                              Bottle #{globalBottleNumber} <span className="text-slate-500">(Box {boxIdx + 1}, #{bottleIdx + 1})</span>
                            </label>
                            <div className="relative">
                              <input
                                ref={el => inputRefs.current[`${boxIdx}-${bottleIdx}`] = el}
                                type="text"
                                value={val}
                                onChange={(e) => handleBottleSerialChange(boxIdx, bottleIdx, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, boxIdx, bottleIdx)}
                                onPaste={(e) => bottleIdx === 0 && handlePasteBox(boxIdx, e)}
                                placeholder={`Serial #${globalBottleNumber}`}
                                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors ${
                                  isDup
                                    ? 'border-rose-500 bg-rose-950/30 text-rose-300'
                                    : val.trim()
                                      ? 'border-emerald-800/60 bg-emerald-950/20'
                                      : 'border-slate-800'
                                }`}
                              />
                              {val.trim() && !isDup && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                              )}
                              {isDup && (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* MODE B: BULK PASTE MODE */
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Paste bottle serial numbers (one per line or separated by commas). Numbers will be automatically grouped into Box 1, Box 2, etc.
                </p>
                <textarea
                  required
                  rows={8}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="RS10001&#10;RS10002&#10;RS10003&#10;..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                Notes / Shipment Reference (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Supplier invoice #, batch notes..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="submit"
              disabled={submitting || !isValidCount}
              className="flex items-center gap-2 px-6 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50 text-sm"
            >
              {submitting ? 'Submitting Entry...' : 'Complete Stock Entry'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default StockEntry;
