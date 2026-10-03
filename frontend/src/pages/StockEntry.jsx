import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Package, Calculator, Barcode, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

const StockEntry = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [numberOfBoxes, setNumberOfBoxes] = useState(2);
  const [bottlesPerBox, setBottlesPerBox] = useState(3);
  const [boxPrice, setBoxPrice] = useState(450);
  const [bottlePrice, setBottlePrice] = useState(150);
  const [serialNumbersText, setSerialNumbersText] = useState('RS10001\nRS10002\nRS10003\nRS10004\nRS10005\nRS10006');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // Rule 1: Backend & Frontend Total Bottle Calculation
  const totalBottles = (parseInt(numberOfBoxes, 10) || 0) * (parseInt(bottlesPerBox, 10) || 0);

  // Parse entered serial numbers
  const enteredSerials = serialNumbersText
    .split(/[\n,\r]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const isValidCount = enteredSerials.length === totalBottles && totalBottles > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Rule 2 validation: Serial count check
    if (enteredSerials.length !== totalBottles) {
      setError(`Serial number count (${enteredSerials.length}) does not match expected total bottles (${totalBottles}).`);
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
        serialNumbers: enteredSerials,
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Stock Entry</h1>
          <p className="text-sm text-slate-400">Receive stock boxes and register physical bottle serial numbers</p>
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

              {/* Rule 1: Calculated Total Bottles Output */}
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Barcode className="w-5 h-5 text-amber-500" />
                Bottle Serial Numbers (Bulk Paste)
              </h2>

              {/* Counter Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                isValidCount
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                  : 'bg-amber-950 text-amber-400 border-amber-800/50'
              }`}>
                {isValidCount ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                Entered: {enteredSerials.length} / Expected: {totalBottles}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Paste or scan bottle serial numbers (one per line or separated by commas). Numbers will automatically be grouped into Box 1, Box 2, etc.
            </p>

            <textarea
              required
              rows={6}
              value={serialNumbersText}
              onChange={(e) => setSerialNumbersText(e.target.value)}
              placeholder="RS10001&#10;RS10002&#10;RS10003&#10;..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500 leading-relaxed"
            />

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
