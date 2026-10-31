import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import { Box, Search, Eye, Barcode, AlertTriangle, Trash2, Plus } from 'lucide-react';

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

  const handleDelete = async (entry) => {
    if (!window.confirm(`Are you sure you want to cancel and delete stock entry for '${entry.product?.name}' (${entry.totalBottles} bottles)?`)) {
      return;
    }

    try {
      await apiClient.delete(`/inventory/stock/entries/${entry.id}`);
      fetchStockEntries();
    } catch (err) {
      alert(err?.message || 'Failed to delete stock entry. Entries with sold or adjusted bottles cannot be deleted.');
    }
  };

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
      <div className="space-y-4 sm:space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-slate-900/60 p-3.5 sm:p-5 rounded-2xl border border-slate-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Box className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0" />
              Stock Entries & Serial Lookup
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              View received stock batches and lookup individual bottle serial numbers
            </p>
          </div>
          <Link
            to="/stock/entry"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-900/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Stock Entry
          </Link>
        </div>

        {/* Serial Number Scanner Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Barcode className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
            Lookup Physical Bottle Serial Number
          </h2>
          <form onSubmit={handleSerialSearch} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                placeholder="Enter or scan serial number (e.g. RS10001)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-amber-400 font-mono text-xs sm:text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all border border-slate-700 text-center"
            >
              Scan / Search
            </button>
          </form>

          {serialError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{serialError}</span>
            </div>
          )}

          {searchedBottle && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-amber-500/40 text-xs sm:text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-400 font-mono text-base">{searchedBottle.serialNumber}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${
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

        {/* Stock Entries Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/40">
            <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Stock Entry Batches ({entries.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">Loading stock entries...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">No stock entries registered yet.</div>
          ) : (
            <>
              {/* Mobile Entry Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-800/80 p-2 sm:p-3 space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-white text-sm">{entry.product?.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Brand: <strong className="text-amber-400">{entry.product?.brand?.name}</strong>
                        </p>
                      </div>

                      <span className="text-xs font-mono text-slate-500 shrink-0">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2 rounded-lg text-center font-mono text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Boxes</span>
                        <span className="text-slate-200 font-bold">{entry.numberOfBoxes}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Total Bottles</span>
                        <span className="text-emerald-400 font-bold">{entry.totalBottles}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Box Rate</span>
                        <span className="text-slate-300">₹{entry.boxPrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                      <Link
                        to={`/stock/details/${entry.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Serials
                      </Link>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 transition-colors border border-rose-800/40"
                        title="Delete Unused Stock Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
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
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <Link
                            to={`/stock/details/${entry.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Serials
                          </Link>
                          <button
                            onClick={() => handleDelete(entry)}
                            className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 transition-colors border border-rose-800/40"
                            title="Delete Unused Stock Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default StockList;
