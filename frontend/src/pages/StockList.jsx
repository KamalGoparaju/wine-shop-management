import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import { 
  Box, 
  Search, 
  Eye, 
  Barcode, 
  AlertTriangle, 
  Trash2, 
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const StockList = () => {
  const { activeTheme } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serialSearch, setSerialSearch] = useState('');
  const [searchedBottle, setSearchedBottle] = useState(null);
  const [serialError, setSerialError] = useState('');

  const {
    page,
    setPage,
    limit,
    setLimit,
    sortBy,
    sortOrder,
    handleSort,
    search,
    setSearch,
    debouncedSearch,
    paginationParams,
    getNextRequestId,
    isCurrentRequest
  } = usePagination({
    initialPage: 1,
    initialLimit: 25,
    initialSortBy: 'createdAt',
    initialSortOrder: 'desc'
  });

  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 25,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const fetchStockEntries = async () => {
    setLoading(true);
    const reqId = getNextRequestId();
    try {
      const res = await apiClient.get('/inventory/stock/entries', { params: paginationParams });
      if (isCurrentRequest(reqId) && res.success) {
        setEntries(res.data.stockEntries || []);
        if (res.data.pagination) {
          setPaginationMeta(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stock entries:', err);
    } finally {
      if (isCurrentRequest(reqId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchStockEntries();
  }, [debouncedSearch, page, limit, sortBy, sortOrder]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Box className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Stock Entries & Serial Lookup
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              View received stock batches and lookup individual bottle serial numbers
            </p>
          </div>
          <Link
            to="/stock/entry"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all self-start sm:self-auto hover:opacity-95"
            style={{ backgroundColor: activeTheme.primary }}
          >
            <Plus className="w-4 h-4" />
            New Stock Entry
          </Link>
        </div>

        {/* Serial Number Scanner Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Barcode className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: activeTheme.primary }} />
            Lookup Physical Bottle Serial Number
          </h2>
          <form onSubmit={handleSerialSearch} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                placeholder="Enter or scan serial number (e.g. RS10001)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 font-mono text-xs sm:text-sm focus:outline-none focus-theme transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all text-center shadow-xs hover:opacity-95"
              style={{ backgroundColor: activeTheme.primary }}
            >
              Scan / Search
            </button>
          </form>

          {serialError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{serialError}</span>
            </div>
          )}

          {searchedBottle && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold font-mono text-base" style={{ color: activeTheme.primary }}>
                  {searchedBottle.serialNumber}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${
                  searchedBottle.status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {searchedBottle.status}
                </span>
              </div>
              <p className="text-slate-700">
                Product: <strong className="text-slate-900">{searchedBottle.product?.name}</strong> ({searchedBottle.product?.brand?.name}) — {searchedBottle.product?.bottleVolume}
              </p>
              <p className="text-slate-500 text-xs font-mono">
                Purchase Price: ₹{searchedBottle.bottlePrice} | Box Number: #{searchedBottle.box?.boxNumber}
              </p>
            </div>
          )}
        </div>

        {/* Stock Entries Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Stock Entry Batches ({paginationMeta.totalRecords})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">Loading stock entries...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">No stock entries registered yet.</div>
          ) : (
            <>
              {/* Mobile Entry Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{entry.product?.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Brand: <strong style={{ color: activeTheme.primary }}>{entry.product?.brand?.name}</strong>
                        </p>
                      </div>

                      <span className="text-xs font-mono text-slate-400 shrink-0">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-slate-200 text-center font-mono text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Boxes</span>
                        <span className="text-slate-800 font-bold">{entry.numberOfBoxes}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Total Bottles</span>
                        <span className="text-emerald-600 font-bold">{entry.totalBottles}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Box Rate</span>
                        <span className="text-slate-700">₹{entry.boxPrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <Link
                        to={`/stock/details/${entry.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-colors shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
                        View Serials
                      </Link>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                        title="Delete Unused Stock Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block table-grid-wrapper">
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th className="w-40">Brand</th>
                      <th className="w-20 text-center">Boxes</th>
                      <th className="w-24 text-center">Bottles/Box</th>
                      <th 
                        className="w-32 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('totalBottles')}
                      >
                        <div className="inline-flex items-center justify-center gap-1">
                          <span>Total Bottles</span>
                          {sortBy === 'totalBottles' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="w-28 text-right">Box Price</th>
                      <th 
                        className="w-32 text-right cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>Date</span>
                          {sortBy === 'createdAt' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="w-36 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="font-bold text-slate-900">{entry.product?.name}</td>
                        <td className="text-slate-600">{entry.product?.brand?.name}</td>
                        <td className="text-center font-bold text-slate-800 font-mono">{entry.numberOfBoxes}</td>
                        <td className="text-center text-slate-600 font-mono">{entry.bottlesPerBox}</td>
                        <td className="text-center font-bold text-emerald-600 font-mono">{entry.totalBottles}</td>
                        <td className="text-right font-mono text-slate-700">₹{entry.boxPrice}</td>
                        <td className="text-right text-xs text-slate-500 font-mono">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </td>
                        <td className="text-right space-x-2 whitespace-nowrap">
                          <Link
                            to={`/stock/details/${entry.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 transition-colors shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
                            View Serials
                          </Link>
                          <button
                            onClick={() => handleDelete(entry)}
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                            title="Delete Unused Stock Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Server-Side Pagination Footer */}
              <Pagination
                pagination={paginationMeta}
                onPageChange={setPage}
                onLimitChange={setLimit}
                disabled={loading}
              />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default StockList;
