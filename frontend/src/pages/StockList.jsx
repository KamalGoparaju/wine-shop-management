import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import { Box, Search, Eye, Barcode, AlertTriangle } from 'lucide-react';

const StockList = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serialSearch, setSerialSearch] = useState('');
  const [searchedBottle, setSearchedBottle] = useState(null);
  const [serialError, setSerialError] = useState('');

  const fetchStockEntries = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/inventory/stock/entries');
      if (res.success) {
        setEntries(res.data.stockEntries || []);
      }
    } catch (err) {
      console.error('Failed to fetch stock entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockEntries();
  }, []);

  const handleSerialSearch = async (e) => {
    e.preventDefault();
    if (!serialSearch.trim()) return;

    setSerialError('');
    setSearchedBottle(null);

    try {
      const res = await apiClient.get(`/inventory/stock/bottles/${serialSearch.trim()}`);
      if (res.success) {
        setSearchedBottle(res.data.bottle);
      }
    } catch (err) {
      setSerialError(err?.message || 'Bottle serial number not found.');
    }
  };

  return (
    <Layout title="Inventory Stock Management">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Stock Entries & Serial Lookup</h1>
          <p className="text-sm text-slate-400">View stock batches and scan individual bottle serial numbers</p>
        </div>
        <Link
          to="/stock/entry"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-900/20 transition-all"
        >
          + New Stock Entry
        </Link>
      </div>

      {/* Serial Number Scanner Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3">
          <Barcode className="w-5 h-5 text-amber-500" />
          Lookup Physical Bottle Serial Number
        </h2>
        <form onSubmit={handleSerialSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={serialSearch}
              onChange={(e) => setSerialSearch(e.target.value)}
              placeholder="Enter or scan serial number (e.g. RS10001)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-amber-400 font-mono text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl transition-all border border-slate-700"
          >
            Scan / Search
          </button>
        </form>

        {serialError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{serialError}</span>
          </div>
        )}

        {searchedBottle && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-400 font-mono text-base">{searchedBottle.serialNumber}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                searchedBottle.status === 'IN_STOCK' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'
              }`}>
                {searchedBottle.status}
              </span>
            </div>
            <p className="text-slate-300">
              Product: <strong>{searchedBottle.product?.name}</strong> ({searchedBottle.product?.brand?.name}) — {searchedBottle.product?.bottleVolume}
            </p>
            <p className="text-slate-400 text-xs font-mono">
              Purchase Price: ₹{searchedBottle.bottlePrice} | Box Number: #{searchedBottle.box?.boxNumber}
            </p>
          </div>
        )}
      </div>

      {/* Stock Entries Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <h2 className="text-base font-bold text-white">Stock Entry History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading stock entries...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No stock entries registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Product Name</th>
                  <th className="px-6 py-3.5">Brand</th>
                  <th className="px-6 py-3.5 text-center">Boxes</th>
                  <th className="px-6 py-3.5 text-center">Bottles/Box</th>
                  <th className="px-6 py-3.5 text-center">Total Bottles</th>
                  <th className="px-6 py-3.5 text-right">Box Price</th>
                  <th className="px-6 py-3.5 text-right">Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{entry.product?.name}</td>
                    <td className="px-6 py-4 text-slate-400">{entry.product?.brand?.name}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-200">{entry.numberOfBoxes}</td>
                    <td className="px-6 py-4 text-center text-slate-400">{entry.bottlesPerBox}</td>
                    <td className="px-6 py-4 text-center font-bold text-emerald-400 font-mono">{entry.totalBottles}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">₹{entry.boxPrice}</td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/stock/details/${entry.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Serials
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StockList;
