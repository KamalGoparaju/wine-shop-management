import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  History, 
  Download, 
  Calendar, 
  Eye, 
  FileText, 
  FileSpreadsheet,
  CheckCircle2, 
  Printer, 
  X, 
  AlertCircle, 
  Receipt, 
  ClipboardList, 
  RefreshCw, 
  Coins, 
  Package, 
  Unlock, 
  Info,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { downloadAuthenticatedFile } from '../utils/download';
import { useTheme } from '../context/ThemeContext';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const ClosingHistory = () => {
  const { selectedShop } = useAuth();
  const { activeTheme } = useTheme();
  
  // Date filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('all');

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState(null);
  const [exportingExcelId, setExportingExcelId] = useState(null);

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailTab, setDetailTab] = useState('FINANCIAL'); // 'FINANCIAL' | 'STOCK'
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStock, setDetailStock] = useState([]);
  const [detailExpenses, setDetailExpenses] = useState([]);

  // Reopen in Modal State
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState({ error: '', success: '' });

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
    resetPage,
    paginationParams,
    getNextRequestId,
    isCurrentRequest
  } = usePagination({
    initialPage: 1,
    initialLimit: 25,
    initialSortBy: 'businessDate',
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

  const fetchHistory = async () => {
    if (!selectedShop?.id) return;
    const currentShopId = selectedShop.id;
    setLoading(true);
    const reqId = getNextRequestId();

    try {
      const params = {
        ...paginationParams,
        fromDate,
        toDate,
        shopId: currentShopId
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const res = await apiClient.get('/sales/closing/history', {
        params,
        headers: { 'x-shop-id': currentShopId }
      });
      if (isCurrentRequest(reqId) && res.success) {
        setHistory(res.data.history || []);
        if (res.data.pagination) {
          setPaginationMeta(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch closing history:', err);
    } finally {
      if (isCurrentRequest(reqId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fromDate, toDate, statusFilter, selectedShop?.id, page, limit, sortBy, sortOrder]);

  // Quick Date Filter Presets
  const setFilterToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setFromDate(today);
    setToDate(today);
  };

  const setFilterYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    setFromDate(yStr);
    setToDate(yStr);
  };

  const setFilterThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    setFromDate(firstDay);
    setToDate(today);
  };

  const clearFilters = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(new Date().toISOString().slice(0, 10));
  };

  // Open Details Modal and fetch itemized stock & expenses
  const handleOpenDetails = async (record) => {
    setSelectedRecord(record);
    setDetailTab('FINANCIAL');
    setDetailLoading(true);
    setShowReopenForm(false);
    setReopenReason('');
    setModalMsg({ error: '', success: '' });

    const dateStr = new Date(record.businessDate).toISOString().slice(0, 10);
    const shopId = selectedShop?.id;

    try {
      const [stockRes, expRes] = await Promise.all([
        apiClient.get('/inventory/daily-stock', {
          params: { date: dateStr, shopId },
          headers: { 'x-shop-id': shopId }
        }).catch(() => null),
        apiClient.get('/sales/expenses', {
          params: { date: dateStr, shopId },
          headers: { 'x-shop-id': shopId }
        }).catch(() => null)
      ]);

      if (stockRes && stockRes.success) {
        setDetailStock(stockRes.data.records || []);
      } else {
        setDetailStock([]);
      }

      if (expRes && expRes.success) {
        setDetailExpenses(expRes.data.expenses || []);
      } else {
        setDetailExpenses([]);
      }
    } catch (e) {
      console.error('Failed to load detail breakdowns:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  // Authorized Reopen Submission
  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setModalMsg({ error: 'Please enter a valid reason for reopening.', success: '' });
      return;
    }

    setReopenLoading(true);
    setModalMsg({ error: '', success: '' });
    const dateStr = new Date(selectedRecord.businessDate).toISOString().slice(0, 10);

    try {
      const res = await apiClient.post('/sales/closing/reopen', {
        businessDate: dateStr,
        reason: reopenReason.trim()
      }, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success) {
        setModalMsg({ error: '', success: 'Business day reopened successfully!' });
        setSelectedRecord(res.data.closing);
        setShowReopenForm(false);
        fetchHistory();
      }
    } catch (err) {
      setModalMsg({ error: err?.message || 'Failed to reopen business day.', success: '' });
    } finally {
      setReopenLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedShop?.id) return;
    setExportingCsv(true);
    try {
      await downloadAuthenticatedFile('/sales/export/csv', {
        fromDate,
        toDate,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `closing_history_${selectedShop.code || 'SHOP'}_${fromDate}_to_${toDate}.csv`);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedShop?.id) return;
    setExportingExcel(true);
    try {
      await downloadAuthenticatedFile('/sales/export/excel', {
        fromDate,
        toDate,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `closing_history_${selectedShop.code || 'SHOP'}_${fromDate}_to_${toDate}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportSingleExcel = async (record) => {
    if (!selectedShop?.id || !record) return;
    const dateStr = new Date(record.businessDate).toISOString().slice(0, 10);
    const opKey = record.id || dateStr;
    setExportingExcelId(opKey);
    try {
      await downloadAuthenticatedFile('/sales/export/closing/excel', {
        date: dateStr,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `daily_closing_${selectedShop.code || 'SHOP'}_${dateStr}.xlsx`);
    } catch (err) {
      console.error('Failed to export closing Excel:', err);
    } finally {
      setExportingExcelId(null);
    }
  };

  const handleExportPdf = async (record) => {
    if (!selectedShop?.id || !record) return;
    const dateStr = new Date(record.businessDate).toISOString().slice(0, 10);
    const opKey = record.id || dateStr;
    setExportingPdfId(opKey);
    try {
      await downloadAuthenticatedFile('/sales/export/closing/pdf', {
        date: dateStr,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `daily_closing_${selectedShop.code || 'SHOP'}_${dateStr}.pdf`);
    } catch (err) {
      console.error('Failed to export closing PDF:', err);
    } finally {
      setExportingPdfId(null);
    }
  };

  return (
    <Layout title="Daily Business Closing History">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Daily Business History & Reports
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Active Shop: <strong style={{ color: activeTheme.primary }}>{selectedShop?.name}</strong> ({selectedShop?.code})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Presets */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs overflow-x-auto max-w-full">
              <button
                onClick={setFilterToday}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 text-slate-700 font-medium transition-colors shrink-0"
              >
                Today
              </button>
              <button
                onClick={setFilterYesterday}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 text-slate-700 font-medium transition-colors shrink-0"
              >
                Yesterday
              </button>
              <button
                onClick={setFilterThisMonth}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 text-slate-700 font-medium transition-colors shrink-0"
              >
                This Month
              </button>
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 font-medium transition-colors border-l border-slate-200 shrink-0"
              >
                Clear
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: activeTheme.primary }} />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-slate-800 font-mono text-xs focus:outline-none cursor-pointer"
                aria-label="From date"
              />
              <span className="text-slate-400 text-[11px]">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-slate-800 font-mono text-xs focus:outline-none cursor-pointer"
                aria-label="To date"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="CLOSED">Closed</option>
                <option value="REOPENED">Reopened</option>
              </select>
            </div>

            <button
              onClick={fetchHistory}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors"
              title="Refresh History"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exportingCsv || loading || history.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              style={{ backgroundColor: activeTheme.primary }}
            >
              <Download className={`w-3.5 h-3.5 ${exportingCsv ? 'animate-bounce' : ''}`} />
              <span className="hidden xs:inline">Export CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || history.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${exportingExcel ? 'animate-bounce' : ''}`} />
              <span className="hidden xs:inline">Export Excel</span>
            </button>
          </div>
        </div>

        {/* History Records Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4" style={{ color: activeTheme.primary }} />
              Saved Daily Closings ({paginationMeta.totalRecords})
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              {fromDate} — {toDate}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading closing history...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No daily closing records found for the selected date range.
            </div>
          ) : (
            <>
              {/* Mobile History Cards (< lg) */}
              <div className="lg:hidden p-3 space-y-3">
                {history.map((r) => {
                  const diff = parseFloat(r.collectionDifference);
                  const isReopened = r.status === 'REOPENED';
                  const dateStr = new Date(r.businessDate).toISOString().slice(0, 10);

                  return (
                    <div key={r.id} className="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900 font-mono">{dateStr}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">Closed by: {r.closedBy || 'Admin'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isReopened
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}>
                          {r.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-sans block">Total Business</span>
                          <span className="font-bold text-slate-900">₹{parseFloat(r.totalBusiness).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-sans block">Total Expenses</span>
                          <span className="font-bold text-rose-600">₹{parseFloat(r.totalExpenses).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-sans block">Total Collected</span>
                          <span className="font-bold text-slate-800">₹{parseFloat(r.totalCollected).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-500 font-sans block">Final Net Amount</span>
                          <span className="font-extrabold text-emerald-600">₹{parseFloat(r.finalAmount).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                        <span className={`font-mono text-xs font-bold ${
                          diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          Diff: {diff > 0 ? `+₹${diff.toFixed(2)}` : `₹${diff.toFixed(2)}`}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleExportPdf(r)}
                            disabled={exportingPdfId === (r.id || r.businessDate)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-rose-700 text-xs rounded-lg transition-colors border border-slate-200 font-medium disabled:opacity-50"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                          <button
                            onClick={() => handleOpenDetails(r)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors"
                            style={{ backgroundColor: activeTheme.primary }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Full Table (>= lg) */}
              <div className="hidden lg:block table-grid-wrapper">
                <table className="table-grid font-mono">
                  <thead>
                    <tr>
                      <th 
                        className="w-28 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('businessDate')}
                      >
                        <div className="inline-flex items-center gap-1 font-sans">
                          <span>Date</span>
                          {sortBy === 'businessDate' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="w-16 text-center" style={{ color: activeTheme.primary }}>Sold</th>
                      <th className="w-16 text-center">Rem.</th>
                      <th className="text-right">Total Business</th>
                      <th className="text-right text-rose-600">Expenses</th>
                      <th className="text-right text-indigo-600">Online</th>
                      <th className="text-right text-teal-600">Cash</th>
                      <th className="text-right font-bold text-slate-800">Total Coll.</th>
                      <th 
                        className="text-right font-bold text-emerald-700 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('finalAmount')}
                      >
                        <div className="inline-flex items-center justify-end gap-1 font-sans">
                          <span>Final Amt</span>
                          {sortBy === 'finalAmount' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="text-right">Diff</th>
                      <th className="text-right text-slate-500">Extra Amt*</th>
                      <th className="text-center font-sans w-24">Status</th>
                      <th className="font-sans w-28">Closed By</th>
                      <th className="text-right font-sans w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {history.map((r) => {
                      const diff = parseFloat(r.collectionDifference);
                      const isReopened = r.status === 'REOPENED';

                      return (
                        <tr key={r.id}>
                          <td className="font-bold text-slate-900">
                            {new Date(r.businessDate).toISOString().slice(0, 10)}
                          </td>
                          <td className="text-center font-bold" style={{ color: activeTheme.primary }}>
                            {r.totalBottlesSold}
                          </td>
                          <td className="text-center text-slate-600">
                            {r.totalBottlesRemaining}
                          </td>
                          <td className="text-right font-bold text-slate-900">
                            ₹{parseFloat(r.totalBusiness).toFixed(2)}
                          </td>
                          <td className="text-right text-rose-600">
                            ₹{parseFloat(r.totalExpenses).toFixed(2)}
                          </td>
                          <td className="text-right text-indigo-600">
                            ₹{parseFloat(r.onlineCollection).toFixed(2)}
                          </td>
                          <td className="text-right text-teal-700">
                            ₹{parseFloat(r.offlineCollection).toFixed(2)}
                          </td>
                          <td className="text-right font-bold text-slate-800">
                            ₹{parseFloat(r.totalCollected).toFixed(2)}
                          </td>
                          <td className="text-right font-bold text-emerald-700">
                            ₹{parseFloat(r.finalAmount).toFixed(2)}
                          </td>
                          <td className={`text-right font-bold ${
                            diff === 0 ? 'text-slate-500' : diff > 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {diff > 0 ? `+₹${diff.toFixed(2)}` : `₹${diff.toFixed(2)}`}
                          </td>
                          <td className="text-right text-slate-500">
                            ₹{parseFloat(r.extraAmountInformational || 0).toFixed(2)}
                          </td>
                          <td className="text-center font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isReopened
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="font-sans text-slate-600 truncate max-w-[120px]">
                            {r.closedBy || 'Admin'}
                          </td>
                          <td className="text-right font-sans whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleExportPdf(r)}
                                disabled={exportingPdfId === (r.id || r.businessDate)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-rose-700 text-xs rounded-lg transition-colors border border-slate-200 font-medium disabled:opacity-50"
                                title="Download Daily Closing PDF"
                              >
                                <FileText className={`w-3.5 h-3.5 ${exportingPdfId === (r.id || r.businessDate) ? 'animate-bounce' : ''}`} />
                                <span>{exportingPdfId === (r.id || r.businessDate) ? '...' : 'PDF'}</span>
                              </button>
                              <button
                                onClick={() => handleOpenDetails(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg transition-colors border border-slate-200 font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

        {/* View Details Statement Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 shrink-0" style={{ color: activeTheme.primary }} />
                    Daily Business Closing Statement
                  </h3>
                  <p className="text-xs font-medium mt-0.5" style={{ color: activeTheme.primary }}>
                    {selectedShop?.name} — {new Date(selectedRecord.businessDate).toISOString().slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportPdf(selectedRecord)}
                    disabled={exportingPdfId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs rounded-xl font-medium transition-colors disabled:opacity-50"
                    title="Download as PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">PDF</span>
                  </button>
                  <button
                    onClick={() => handleExportSingleExcel(selectedRecord)}
                    disabled={exportingExcelId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs rounded-xl font-medium transition-colors disabled:opacity-50"
                    title="Download as Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Excel</span>
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 transition-colors ml-1"
                    aria-label="Close details"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status and Timestamp Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Closing Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selectedRecord.status === 'REOPENED'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  }`}>
                    {selectedRecord.status}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] font-mono">
                  Closed on {new Date(selectedRecord.closedAt).toLocaleString()} by <strong className="text-slate-700">{selectedRecord.closedBy}</strong>
                </div>
              </div>

              {modalMsg.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalMsg.error}</span>
                </div>
              )}

              {modalMsg.success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{modalMsg.success}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 text-xs overflow-x-auto">
                <button
                  onClick={() => setDetailTab('FINANCIAL')}
                  className={`flex items-center gap-2 px-4 py-2.5 font-bold transition-all border-b-2 whitespace-nowrap ${
                    detailTab === 'FINANCIAL'
                      ? 'border-b-2 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                  style={detailTab === 'FINANCIAL' ? { borderColor: activeTheme.primary, color: activeTheme.primary, backgroundColor: activeTheme.light } : {}}
                >
                  <Coins className="w-4 h-4" />
                  Financial Closing & Expenses ({detailExpenses.length})
                </button>
                <button
                  onClick={() => setDetailTab('STOCK')}
                  className={`flex items-center gap-2 px-4 py-2.5 font-bold transition-all border-b-2 whitespace-nowrap ${
                    detailTab === 'STOCK'
                      ? 'border-b-2 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                  style={detailTab === 'STOCK' ? { borderColor: activeTheme.primary, color: activeTheme.primary, backgroundColor: activeTheme.light } : {}}
                >
                  <ClipboardList className="w-4 h-4" />
                  Daily Stock Breakdown ({detailStock.length})
                </button>
              </div>

              {detailLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs">Loading detailed records...</div>
              ) : detailTab === 'FINANCIAL' ? (
                /* Tab 1: Financial & Expenses Statement */
                <div className="space-y-4 text-xs">
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Stock Business</span>
                      <p className="text-sm sm:text-base font-bold text-slate-900">₹{parseFloat(selectedRecord.totalBusiness).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Collected</span>
                      <p className="text-sm sm:text-base font-bold text-slate-800">₹{parseFloat(selectedRecord.totalCollected).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Expenses</span>
                      <p className="text-sm sm:text-base font-bold text-rose-600">₹{parseFloat(selectedRecord.totalExpenses).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold block">Final Net Amount</span>
                      <p className="text-sm sm:text-base font-extrabold text-emerald-600">₹{parseFloat(selectedRecord.finalAmount).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Reconciled Breakdown */}
                  <div className="divide-y divide-slate-200 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 font-mono space-y-2">
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-600 font-sans">Online Collection (UPI / POS):</span>
                      <span className="text-indigo-600 font-bold">₹{parseFloat(selectedRecord.onlineCollection).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-600 font-sans">Offline Collection (Cash):</span>
                      <span className="text-teal-600 font-bold">₹{parseFloat(selectedRecord.offlineCollection).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-600 font-sans">Collection Difference:</span>
                      <span className={`font-bold ${parseFloat(selectedRecord.collectionDifference) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {parseFloat(selectedRecord.collectionDifference) >= 0 ? '+' : ''}₹{parseFloat(selectedRecord.collectionDifference).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-400 font-sans">Extra Amount (Informational Only):</span>
                      <span className="text-slate-400">₹{parseFloat(selectedRecord.extraAmountInformational || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Itemized Expenses Breakdown */}
                  <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-rose-600" />
                      Itemized Expenses Deducted ({detailExpenses.length})
                    </h4>
                    {detailExpenses.length === 0 ? (
                      <p className="text-slate-500 italic text-[11px]">No expenses recorded on this date.</p>
                    ) : (
                      <div className="divide-y divide-slate-200/60 font-mono text-[11px]">
                        {detailExpenses.map((exp, idx) => (
                          <div key={exp.id || idx} className="py-2 flex justify-between items-center text-slate-700">
                            <div>
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 text-slate-700 font-sans mr-2">
                                {exp.category}
                              </span>
                              <span className="font-sans font-medium text-slate-900">{exp.description}</span>
                              {exp.recipient && (
                                <span className="text-slate-500 text-[10px] ml-1.5 font-sans">
                                  (to {exp.recipient})
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-rose-600 shrink-0 ml-2">₹{parseFloat(exp.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Closing Notes & Audit Trail */}
                  {selectedRecord.notes && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Notes & Audit Trail:</span>
                      <p className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap">{selectedRecord.notes}</p>
                    </div>
                  )}

                  {/* Authorized Reopening Section */}
                  {selectedRecord.status === 'CLOSED' && !showReopenForm && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowReopenForm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Authorized Reopen / Adjust This Day
                      </button>
                    </div>
                  )}

                  {showReopenForm && (
                    <form onSubmit={handleReopenSubmit} className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Reopen Business Day for Adjustments</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Enter a reason for reopening. An audit trail entry will be created.
                      </p>
                      <textarea
                        rows={2}
                        required
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="State reason for reopening (e.g., missed expense receipt, physical count correction)..."
                        className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReopenForm(false)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={reopenLoading}
                          className="px-4 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs disabled:opacity-50"
                        >
                          {reopenLoading ? 'Reopening...' : 'Confirm Reopen'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Tab 2: Brand & Size Stock Breakdown Table */
                <div className="space-y-3 text-xs">
                  {detailStock.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-8">No daily stock records found for this date.</p>
                  ) : (
                    <div className="table-grid-wrapper">
                      <table className="table-grid font-mono min-w-[700px]">
                        <thead>
                          <tr>
                            <th className="w-12 text-center">S.No.</th>
                            <th>Brand</th>
                            <th className="w-16 text-center" style={{ color: activeTheme.primary }}>Size</th>
                            <th className="w-16 text-center">Opening</th>
                            <th className="w-16 text-center">Indent</th>
                            <th className="w-16 text-center">Total</th>
                            <th className="w-16 text-center">Closing</th>
                            <th className="w-16 text-center" style={{ color: activeTheme.primary }}>Sale</th>
                            <th className="w-20 text-right">Rate</th>
                            <th className="w-24 text-right text-emerald-700">Bottle Sales (₹)</th>
                            <th className="w-20 text-right text-amber-600">Extra / Btl (₹)</th>
                            <th className="w-20 text-right text-slate-400">Extra Amt (₹)*</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {detailStock.map((row, idx) => (
                            <tr key={row.id || idx}>
                              <td className="text-center text-slate-500 font-bold">
                                {row.brand?.serialNo || idx + 1}
                              </td>
                              <td className="font-sans font-bold text-slate-900">
                                {row.brand?.name}
                              </td>
                              <td className="text-center font-bold" style={{ color: activeTheme.primary }}>
                                {row.size?.code}
                              </td>
                              <td className="text-center text-slate-600">{row.openingStock}</td>
                              <td className="text-center text-indigo-600 font-bold">{row.indentStock}</td>
                              <td className="text-center font-bold text-slate-900">{row.totalStock}</td>
                              <td className="text-center text-emerald-700 font-bold">{row.closingStock}</td>
                              <td className="text-center font-bold" style={{ color: activeTheme.primary }}>{row.saleCount}</td>
                              <td className="text-right text-slate-600">₹{row.bottleRate}</td>
                              <td className="text-right font-bold text-emerald-700 font-sans">
                                ₹{parseFloat(row.saleAmount || 0).toFixed(2)}
                              </td>
                              <td className="text-right font-semibold text-amber-600">
                                ₹{parseFloat(row.extraPerBottle || 0).toFixed(2)}
                              </td>
                              <td className="text-right text-slate-400">
                                ₹{parseFloat(row.extraAmount || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Statement
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="w-full sm:w-auto px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium rounded-xl text-center transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ClosingHistory;
