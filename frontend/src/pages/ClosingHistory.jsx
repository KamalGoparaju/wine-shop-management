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
  Info 
} from 'lucide-react';
import { downloadAuthenticatedFile } from '../utils/download';

const ClosingHistory = () => {
  const { selectedShop } = useAuth();
  
  // Date filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

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

  const fetchHistory = async () => {
    if (!selectedShop?.id) return;
    const currentShopId = selectedShop.id;
    setLoading(true);

    try {
      const res = await apiClient.get('/sales/closing/history', {
        params: { fromDate, toDate, shopId: currentShopId },
        headers: { 'x-shop-id': currentShopId }
      });
      if (res.success) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch closing history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const currentShopId = selectedShop?.id;

    if (!currentShopId) return;

    // Reset table state immediately on shop switch
    setHistory([]);
    setSelectedRecord(null);
    setLoading(true);

    apiClient.get('/sales/closing/history', {
      params: { fromDate, toDate, shopId: currentShopId },
      headers: { 'x-shop-id': currentShopId }
    })
      .then((res) => {
        if (!isCurrent) return;
        if (res.success) {
          setHistory(res.data.history || []);
        }
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Failed to fetch closing history:', err);
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [fromDate, toDate, selectedShop?.id]);

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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <History className="w-6 h-6 text-amber-500" />
              Daily Business History & Reports
            </h1>
            <p className="text-sm text-slate-400">
              Active Shop: <strong className="text-amber-400">{selectedShop?.name}</strong> ({selectedShop?.code})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Presets */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={setFilterToday}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium transition-colors"
              >
                Today
              </button>
              <button
                onClick={setFilterYesterday}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={setFilterThisMonth}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium transition-colors"
              >
                This Month
              </button>
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white font-medium transition-colors border-l border-slate-800"
              >
                Clear
              </button>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300">
              <Calendar className="w-4 h-4 text-amber-500" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={fetchHistory}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exportingCsv || loading || history.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${exportingCsv ? 'animate-bounce' : ''}`} />
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || history.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className={`w-4 h-4 ${exportingExcel ? 'animate-bounce' : ''}`} />
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              Saved Daily Closings ({history.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              {fromDate} — {toDate}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading closing history...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No daily closing records found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th className="px-3.5 py-3">Date</th>
                    <th className="px-2.5 py-3 text-center">Sold</th>
                    <th className="px-2.5 py-3 text-center">Rem.</th>
                    <th className="px-3 py-3 text-right">Total Business</th>
                    <th className="px-3 py-3 text-right text-rose-400">Expenses</th>
                    <th className="px-3 py-3 text-right">Online</th>
                    <th className="px-3 py-3 text-right">Cash</th>
                    <th className="px-3.5 py-3 text-right font-bold text-amber-400">Total Coll.</th>
                    <th className="px-3.5 py-3 text-right font-bold text-emerald-400">Final Amt</th>
                    <th className="px-3 py-3 text-right">Diff</th>
                    <th className="px-3 py-3 text-right text-slate-400">Extra Amt*</th>
                    <th className="px-3 py-3 text-center font-sans">Status</th>
                    <th className="px-3 py-3 font-sans">Closed By</th>
                    <th className="px-3.5 py-3 text-right font-sans">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((r) => {
                    const diff = parseFloat(r.collectionDifference);
                    const isReopened = r.status === 'REOPENED';

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors whitespace-nowrap">
                        <td className="px-3.5 py-3.5 font-bold text-white">
                          {new Date(r.businessDate).toISOString().slice(0, 10)}
                        </td>
                        <td className="px-2.5 py-3.5 text-center font-bold text-amber-400">
                          {r.totalBottlesSold}
                        </td>
                        <td className="px-2.5 py-3.5 text-center text-slate-400">
                          {r.totalBottlesRemaining}
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold text-white">
                          ₹{parseFloat(r.totalBusiness).toFixed(2)}
                        </td>
                        <td className="px-3 py-3.5 text-right text-rose-400">
                          ₹{parseFloat(r.totalExpenses).toFixed(2)}
                        </td>
                        <td className="px-3 py-3.5 text-right text-indigo-400">
                          ₹{parseFloat(r.onlineCollection).toFixed(2)}
                        </td>
                        <td className="px-3 py-3.5 text-right text-teal-400">
                          ₹{parseFloat(r.offlineCollection).toFixed(2)}
                        </td>
                        <td className="px-3.5 py-3.5 text-right font-bold text-amber-400">
                          ₹{parseFloat(r.totalCollected).toFixed(2)}
                        </td>
                        <td className="px-3.5 py-3.5 text-right font-bold text-emerald-400">
                          ₹{parseFloat(r.finalAmount).toFixed(2)}
                        </td>
                        <td className={`px-3 py-3.5 text-right font-bold ${
                          diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {diff > 0 ? `+₹${diff.toFixed(2)}` : `₹${diff.toFixed(2)}`}
                        </td>
                        <td className="px-3 py-3.5 text-right text-slate-500">
                          ₹{parseFloat(r.extraAmountInformational || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-3.5 text-center font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isReopened
                              ? 'bg-amber-950 text-amber-400 border-amber-800'
                              : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-sans text-slate-400 truncate max-w-[120px]">
                          {r.closedBy || 'Admin'}
                        </td>
                        <td className="px-3.5 py-3.5 text-right font-sans whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleExportPdf(r)}
                              disabled={exportingPdfId === (r.id || r.businessDate)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 text-xs rounded-lg transition-colors border border-slate-700 font-medium disabled:opacity-50"
                              title="Download Daily Closing PDF"
                            >
                              <FileText className={`w-3.5 h-3.5 ${exportingPdfId === (r.id || r.businessDate) ? 'animate-bounce' : ''}`} />
                              {exportingPdfId === (r.id || r.businessDate) ? '...' : 'PDF'}
                            </button>
                            <button
                              onClick={() => handleOpenDetails(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors border border-slate-700 font-medium"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View Details Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    Daily Business Closing Statement
                  </h3>
                  <p className="text-xs text-amber-400 font-medium mt-0.5">
                    {selectedShop?.name} — {new Date(selectedRecord.businessDate).toISOString().slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportPdf(selectedRecord)}
                    disabled={exportingPdfId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs rounded-xl font-medium transition-colors disabled:opacity-50"
                    title="Download as PDF"
                  >
                    <FileText className={`w-3.5 h-3.5 ${exportingPdfId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10)) ? 'animate-bounce' : ''}`} />
                    {exportingPdfId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10)) ? 'Generating...' : 'PDF'}
                  </button>
                  <button
                    onClick={() => handleExportSingleExcel(selectedRecord)}
                    disabled={exportingExcelId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800 text-xs rounded-xl font-medium transition-colors disabled:opacity-50"
                    title="Download as Excel"
                  >
                    <FileSpreadsheet className={`w-3.5 h-3.5 ${exportingExcelId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10)) ? 'animate-bounce' : ''}`} />
                    {exportingExcelId === (selectedRecord.id || new Date(selectedRecord.businessDate).toISOString().slice(0, 10)) ? 'Generating...' : 'Excel'}
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status and Timestamp Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Closing Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selectedRecord.status === 'REOPENED'
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  }`}>
                    {selectedRecord.status}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] font-mono">
                  Closed on {new Date(selectedRecord.closedAt).toLocaleString()} by <strong>{selectedRecord.closedBy}</strong>
                </div>
              </div>

              {modalMsg.error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalMsg.error}</span>
                </div>
              )}

              {modalMsg.success && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{modalMsg.success}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800 text-xs">
                <button
                  onClick={() => setDetailTab('FINANCIAL')}
                  className={`flex items-center gap-2 px-4 py-2.5 font-bold transition-all border-b-2 ${
                    detailTab === 'FINANCIAL'
                      ? 'border-amber-500 text-amber-400 bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  Financial Closing & Expenses ({detailExpenses.length})
                </button>
                <button
                  onClick={() => setDetailTab('STOCK')}
                  className={`flex items-center gap-2 px-4 py-2.5 font-bold transition-all border-b-2 ${
                    detailTab === 'STOCK'
                      ? 'border-amber-500 text-amber-400 bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Daily Stock Breakdown ({detailStock.length} Brands/Sizes)
                </button>
              </div>

              {detailLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs">Loading detailed records...</div>
              ) : detailTab === 'FINANCIAL' ? (
                /* Tab 1: Financial & Expenses Statement */
                <div className="space-y-4 text-xs">
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold">Total Stock Business</span>
                      <p className="text-base font-bold text-white">₹{parseFloat(selectedRecord.totalBusiness).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold">Total Collected</span>
                      <p className="text-base font-bold text-amber-400">₹{parseFloat(selectedRecord.totalCollected).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold">Total Expenses</span>
                      <p className="text-base font-bold text-rose-400">₹{parseFloat(selectedRecord.totalExpenses).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 font-bold">Final Net Amount</span>
                      <p className="text-base font-extrabold text-emerald-400">₹{parseFloat(selectedRecord.finalAmount).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Reconciled Breakdown */}
                  <div className="divide-y divide-slate-800 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono space-y-2">
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-400 font-sans">Online Collection (UPI / POS / Card):</span>
                      <span className="text-indigo-400">₹{parseFloat(selectedRecord.onlineCollection).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-400 font-sans">Offline Collection (Cash):</span>
                      <span className="text-teal-400">₹{parseFloat(selectedRecord.offlineCollection).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-400 font-sans">Collection Difference (Collected - Business):</span>
                      <span className={`font-bold ${parseFloat(selectedRecord.collectionDifference) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {parseFloat(selectedRecord.collectionDifference) >= 0 ? '+' : ''}₹{parseFloat(selectedRecord.collectionDifference).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-500 font-sans">Extra Amount (Informational Only):</span>
                      <span className="text-slate-500">₹{parseFloat(selectedRecord.extraAmountInformational || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Itemized Expenses Breakdown */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-rose-400" />
                      Itemized Expenses Deducted ({detailExpenses.length})
                    </h4>
                    {detailExpenses.length === 0 ? (
                      <p className="text-slate-500 italic text-[11px]">No expenses recorded on this date.</p>
                    ) : (
                      <div className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {detailExpenses.map((exp, idx) => (
                          <div key={exp.id || idx} className="py-2 flex justify-between items-center text-slate-300">
                            <div>
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 font-sans mr-2">
                                {exp.category}
                              </span>
                              <span className="font-sans font-medium text-white">{exp.description}</span>
                              {exp.recipient && (
                                <span className="text-slate-500 text-[10px] ml-1.5 font-sans">
                                  (to {exp.recipient})
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-rose-400">₹{parseFloat(exp.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Closing Notes & Audit Trail */}
                  {selectedRecord.notes && (
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Notes & Audit Trail:</span>
                      <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap">{selectedRecord.notes}</p>
                    </div>
                  )}

                  {/* Authorized Reopening Section */}
                  {selectedRecord.status === 'CLOSED' && !showReopenForm && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowReopenForm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/50 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Authorized Reopen / Adjust This Day
                      </button>
                    </div>
                  )}

                  {showReopenForm && (
                    <form onSubmit={handleReopenSubmit} className="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span>Reopen Business Day for Adjustments</span>
                      </div>
                      <p className="text-[11px] text-amber-300/80">
                        Enter a reason for reopening. An audit trail entry will be created.
                      </p>
                      <textarea
                        rows={2}
                        required
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="State reason for reopening (e.g., missed expense receipt, physical count correction)..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-amber-500 resize-none font-sans"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReopenForm(false)}
                          className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
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
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-300 font-mono">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-2.5 text-center">S.No.</th>
                            <th className="px-3.5 py-2.5">Brand</th>
                            <th className="px-2.5 py-2.5 text-center">Size</th>
                            <th className="px-2.5 py-2.5 text-center">Opening</th>
                            <th className="px-2.5 py-2.5 text-center">Indent</th>
                            <th className="px-2.5 py-2.5 text-center">Total</th>
                            <th className="px-2.5 py-2.5 text-center">Closing</th>
                            <th className="px-2.5 py-2.5 text-center text-amber-400">Sale</th>
                            <th className="px-3 py-2.5 text-right">Rate</th>
                            <th className="px-3.5 py-2.5 text-right text-emerald-400">Amount (₹)</th>
                            <th className="px-3 py-2.5 text-right text-slate-500">Extra Amt*</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {detailStock.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-slate-800/40">
                              <td className="px-3 py-2.5 text-center text-slate-400 font-bold">
                                {row.brand?.serialNo || idx + 1}
                              </td>
                              <td className="px-3.5 py-2.5 font-sans font-bold text-white">
                                {row.brand?.name}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-bold text-amber-400">
                                {row.size?.code}
                              </td>
                              <td className="px-2.5 py-2.5 text-center">{row.openingStock}</td>
                              <td className="px-2.5 py-2.5 text-center text-indigo-400">{row.indentStock}</td>
                              <td className="px-2.5 py-2.5 text-center font-bold text-white">{row.totalStock}</td>
                              <td className="px-2.5 py-2.5 text-center text-emerald-400 font-bold">{row.closingStock}</td>
                              <td className="px-2.5 py-2.5 text-center text-amber-400 font-bold">{row.saleCount}</td>
                              <td className="px-3 py-2.5 text-right text-slate-400">₹{row.bottleRate}</td>
                              <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400 font-sans">
                                ₹{parseFloat(row.saleAmount || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-500">
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
              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Statement
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl"
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
