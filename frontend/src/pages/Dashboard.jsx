import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Package, 
  Calendar, 
  RefreshCw, 
  ClipboardList, 
  Receipt, 
  History, 
  Lock, 
  Unlock,
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  ArrowLeft,
  X,
  CreditCard,
  Banknote,
  Coins,
  Scale,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { selectedShop } = useAuth();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [dailyRecords, setDailyRecords] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [closingInfo, setClosingInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Closing Modal State
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [modalStep, setModalStep] = useState('INPUT'); // 'INPUT' | 'CONFIRM'
  const [onlineCollection, setOnlineCollection] = useState('');
  const [offlineCollection, setOfflineCollection] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingSubmitting, setClosingSubmitting] = useState(false);
  const [closingError, setClosingError] = useState('');

  // Reopen State
  const [showReopenSection, setShowReopenSection] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  const fetchDashboardData = async () => {
    if (!selectedShop?.id) return;
    const currentShopId = selectedShop.id;
    setLoading(true);

    try {
      const [stockRes, expRes, closeRes] = await Promise.all([
        apiClient.get('/inventory/daily-stock', { 
          params: { date: businessDate, shopId: currentShopId },
          headers: { 'x-shop-id': currentShopId }
        }).catch(() => null),
        apiClient.get('/sales/expenses', { 
          params: { date: businessDate, shopId: currentShopId },
          headers: { 'x-shop-id': currentShopId }
        }).catch(() => null),
        apiClient.get('/sales/closing/status', { 
          params: { date: businessDate, shopId: currentShopId },
          headers: { 'x-shop-id': currentShopId }
        }).catch(() => null)
      ]);

      if (stockRes && stockRes.success && stockRes.data.shopId === currentShopId) {
        setDailyRecords(stockRes.data.records || []);
      }
      if (expRes && expRes.success) {
        setExpenses(expRes.data.expenses || []);
      }
      if (closeRes && closeRes.success) {
        setClosingInfo(closeRes.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const currentShopId = selectedShop?.id;

    if (!currentShopId) return;

    // Clear stale data immediately on shop switch
    setDailyRecords([]);
    setExpenses([]);
    setClosingInfo(null);
    setLoading(true);

    Promise.all([
      apiClient.get('/inventory/daily-stock', { 
        params: { date: businessDate, shopId: currentShopId },
        headers: { 'x-shop-id': currentShopId }
      }).catch(() => null),
      apiClient.get('/sales/expenses', { 
        params: { date: businessDate, shopId: currentShopId },
        headers: { 'x-shop-id': currentShopId }
      }).catch(() => null),
      apiClient.get('/sales/closing/status', { 
        params: { date: businessDate, shopId: currentShopId },
        headers: { 'x-shop-id': currentShopId }
      }).catch(() => null)
    ])
      .then(([stockRes, expRes, closeRes]) => {
        // Discard responses from previous shops
        if (!isCurrent) return;

        if (stockRes && stockRes.success && stockRes.data.shopId === currentShopId) {
          setDailyRecords(stockRes.data.records || []);
        }
        if (expRes && expRes.success) {
          setExpenses(expRes.data.expenses || []);
        }
        if (closeRes && closeRes.success) {
          setClosingInfo(closeRes.data);
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [businessDate, selectedShop?.id]);

  // Derived Daily Metrics
  const totalBusiness = dailyRecords.reduce((acc, curr) => acc + (parseFloat(curr.saleAmount) || 0), 0);
  const totalBottlesSold = dailyRecords.reduce((acc, curr) => acc + (parseInt(curr.saleCount, 10) || 0), 0);
  const totalBottlesRemaining = dailyRecords.reduce((acc, curr) => acc + (parseInt(curr.closingStock, 10) || 0), 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const totalExtraAmount = dailyRecords.reduce((acc, curr) => acc + (parseFloat(curr.extraAmount) || 0), 0);

  const isClosed = closingInfo?.isClosed;
  const savedClosing = closingInfo?.closing;

  // Live closing calculations
  const onlineNum = Math.max(0, parseFloat(onlineCollection) || 0);
  const offlineNum = Math.max(0, parseFloat(offlineCollection) || 0);
  const calcTotalCollected = onlineNum + offlineNum;
  const calcFinalAmount = calcTotalCollected - totalExpenses;
  const calcDiff = calcTotalCollected - totalBusiness;

  const hasIncompleteRecords = dailyRecords.length === 0 || dailyRecords.some(r => r.status === 'DRAFT');

  const handleOpenClosingModal = () => {
    setModalStep('INPUT');
    setOnlineCollection(savedClosing?.onlineCollection ? String(savedClosing.onlineCollection) : '');
    setOfflineCollection(savedClosing?.offlineCollection ? String(savedClosing.offlineCollection) : '');
    setClosingNotes(savedClosing?.notes || '');
    setClosingError('');
    setShowReopenSection(false);
    setReopenReason('');
    setShowClosingModal(true);
  };

  const handleProceedToReview = (e) => {
    e.preventDefault();
    setClosingError('');

    if (dailyRecords.length === 0) {
      setClosingError('Cannot close business: No daily stock sheet records found for this date. Please enter and finalize the daily stock sheet first.');
      return;
    }

    const draftCount = dailyRecords.filter(r => r.status === 'DRAFT').length;
    if (draftCount > 0) {
      setClosingError(`Cannot close business: ${draftCount} stock record(s) are still in DRAFT. Please complete physical closing counts on the Daily Stock Sheet first.`);
      return;
    }

    if (onlineNum < 0 || offlineNum < 0) {
      setClosingError('Collection amounts cannot be negative.');
      return;
    }

    setModalStep('CONFIRM');
  };

  const handleConfirmClosing = async () => {
    setClosingError('');
    setClosingSubmitting(true);

    try {
      const payload = {
        businessDate,
        totalBusiness,
        totalBottlesSold,
        totalBottlesRemaining,
        onlineCollection: onlineNum,
        offlineCollection: offlineNum,
        extraAmountInformational: totalExtraAmount,
        notes: closingNotes
      };

      const res = await apiClient.post('/sales/closing', payload, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success) {
        setShowClosingModal(false);
        fetchDashboardData();
      }
    } catch (err) {
      setClosingError(err?.message || 'Failed to execute daily business closing.');
      setModalStep('INPUT');
    } finally {
      setClosingSubmitting(false);
    }
  };

  const handleReopenClosing = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setClosingError('Please enter a specific reason for reopening the closed day.');
      return;
    }

    setReopenSubmitting(true);
    setClosingError('');

    try {
      const res = await apiClient.post('/sales/closing/reopen', {
        businessDate,
        reason: reopenReason.trim()
      }, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success) {
        setShowClosingModal(false);
        fetchDashboardData();
      }
    } catch (err) {
      setClosingError(err?.message || 'Failed to reopen business day.');
    } finally {
      setReopenSubmitting(false);
    }
  };

  return (
    <Layout title={`${selectedShop?.name || 'Shop'} — Daily Operations`}>
      <div className="space-y-6">
        {/* Top Header & Date Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Daily Operations Dashboard</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isClosed
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                {isClosed ? 'CLOSED' : 'OPEN / IN PROGRESS'}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Active Shop: <strong className="text-amber-400">{selectedShop?.name}</strong> ({selectedShop?.code})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-amber-500" />
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={fetchDashboardData}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenClosingModal}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all ${
                isClosed
                  ? 'bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
              }`}
            >
              <Lock className="w-4 h-4" />
              {isClosed ? 'View / Reopen Closing' : "Close Today's Business"}
            </button>
          </div>
        </div>

        {/* 10 Required Financial Summary Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Total Business */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Business</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-emerald-400 font-mono">₹{totalBusiness.toFixed(2)}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">From daily stock sheet</p>
          </div>

          {/* 2. Total Bottles Sold */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Bottles Sold</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-amber-400 font-mono">{totalBottlesSold}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Physical bottles sold</p>
          </div>

          {/* 3. Total Bottles Remaining */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Bottles Remaining</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">{totalBottlesRemaining}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Closing shelf count</p>
          </div>

          {/* 4. Total Expenses */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Expenses</span>
              <Receipt className="w-4 h-4 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-rose-400 font-mono">₹{totalExpenses.toFixed(2)}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{expenses.length} expense item(s)</p>
          </div>

          {/* 5. Online Collection */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Online Collection</span>
              <CreditCard className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-indigo-400 font-mono">
              {isClosed ? `₹${parseFloat(savedClosing.onlineCollection).toFixed(2)}` : (
                <span className="text-xs text-amber-400 font-sans font-semibold">Pending</span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">UPI, QR & POS</p>
          </div>

          {/* 6. Offline Collection */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Offline Collection</span>
              <Banknote className="w-4 h-4 text-teal-400" />
            </div>
            <h3 className="text-lg font-bold text-teal-400 font-mono">
              {isClosed ? `₹${parseFloat(savedClosing.offlineCollection).toFixed(2)}` : (
                <span className="text-xs text-amber-400 font-sans font-semibold">Pending</span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Physical cash in drawer</p>
          </div>

          {/* 7. Total Collected */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Collected</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-amber-400 font-mono">
              {isClosed ? `₹${parseFloat(savedClosing.totalCollected).toFixed(2)}` : (
                <span className="text-xs text-slate-400 font-sans font-semibold">Pending Closing</span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Online + Offline Cash</p>
          </div>

          {/* 8. Collection Difference */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Collection Diff</span>
              <Scale className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold font-mono">
              {isClosed ? (
                <span className={parseFloat(savedClosing.collectionDifference) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {parseFloat(savedClosing.collectionDifference) >= 0 ? '+' : ''}₹{parseFloat(savedClosing.collectionDifference).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-sans font-semibold">Pending Closing</span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Collected minus Business</p>
          </div>

          {/* 9. Final Net Amount */}
          <div className="bg-slate-900 border border-emerald-500/30 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/30 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Final Net Amount</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-extrabold text-emerald-300 font-mono">
              {isClosed ? `₹${parseFloat(savedClosing.finalAmount).toFixed(2)}` : (
                <span className="text-xs text-emerald-400/80 font-sans font-semibold">Pending Collection</span>
              )}
            </h3>
            <p className="text-[11px] text-emerald-500 mt-0.5">Collected minus Expenses</p>
          </div>

          {/* 10. Daily Closing Status Card */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Closing Status</span>
              {isClosed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
            </div>
            <h3 className={`text-base font-extrabold mt-0.5 ${isClosed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isClosed ? 'CLOSED' : 'OPEN / PENDING'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isClosed ? `By ${savedClosing.closedBy || 'Admin'}` : 'Awaiting daily closing'}
            </p>
          </div>
        </div>

        {/* Quick Action Navigation Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/daily-stock"
            className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all shadow-md group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">Daily Stock Entry Sheet</h4>
                <p className="text-xs text-slate-400">Enter Opening, Indent & Closing</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to="/expenses"
            className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 transition-all shadow-md group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">Daily Expenses</h4>
                <p className="text-xs text-slate-400">Manage transport, bills & transfers</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
          </Link>

          <Link
            to="/closing-history"
            className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all shadow-md group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">Closing History & CSV</h4>
                <p className="text-xs text-slate-400">Statements, past closings & exports</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Daily Stock Summary Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              Daily Stock Sheet Overview ({businessDate})
            </h2>
            <Link to="/daily-stock" className="text-xs font-semibold text-amber-500 hover:text-amber-400">
              Open Full Daily Sheet →
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs">Loading daily stock metrics...</div>
          ) : dailyRecords.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No daily stock recorded for {businessDate}. Click "Open Full Daily Sheet" to enter stock.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-3 py-3 text-center">Size</th>
                    <th className="px-3 py-3 text-center font-mono">Opening</th>
                    <th className="px-3 py-3 text-center font-mono">Indent</th>
                    <th className="px-3 py-3 text-center font-mono">Total</th>
                    <th className="px-3 py-3 text-center font-mono">Closing</th>
                    <th className="px-3 py-3 text-center font-mono text-amber-400">Sale</th>
                    <th className="px-3.5 py-3 text-right font-mono">Rate</th>
                    <th className="px-4 py-3 text-right font-mono text-emerald-400">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {dailyRecords.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-sans font-bold text-white">{r.brand?.name}</td>
                      <td className="px-3 py-3 text-center text-amber-400 font-bold">{r.size?.code}</td>
                      <td className="px-3 py-3 text-center text-slate-400">{r.openingStock}</td>
                      <td className="px-3 py-3 text-center text-indigo-400">{r.indentStock}</td>
                      <td className="px-3 py-3 text-center font-bold text-white">{r.totalStock}</td>
                      <td className="px-3 py-3 text-center text-emerald-400 font-bold">{r.closingStock}</td>
                      <td className="px-3 py-3 text-center text-amber-400 font-bold">{r.saleCount}</td>
                      <td className="px-3.5 py-3 text-right text-slate-400">₹{r.bottleRate}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 font-sans">
                        ₹{parseFloat(r.saleAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Close Today's Business Modal */}
        {showClosingModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-amber-500" />
                    Daily Business Closing
                  </h3>
                  <p className="text-xs text-amber-400 font-medium mt-0.5">
                    {selectedShop?.name} — {businessDate}
                  </p>
                </div>
                <button
                  onClick={() => setShowClosingModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {hasIncompleteRecords && !isClosed && (
                <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-700/50 text-amber-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Daily stock sheet for this date is incomplete or not finalized.</span>
                  </div>
                  <Link to="/daily-stock" className="text-amber-400 underline font-semibold whitespace-nowrap text-[11px]">
                    Go to Sheet →
                  </Link>
                </div>
              )}

              {closingError && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{closingError}</span>
                </div>
              )}

              {/* View / Reopen Mode for Already Closed Day */}
              {isClosed ? (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Business Day Closed & Books Sealed</span>
                    </div>
                    <p className="text-[11px] text-emerald-400/80">
                      Closed on {new Date(savedClosing.closedAt).toLocaleString()} by <strong>{savedClosing.closedBy}</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Business:</span>
                      <p className="text-base font-bold text-white">₹{parseFloat(savedClosing.totalBusiness).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Expenses:</span>
                      <p className="text-base font-bold text-rose-400">₹{parseFloat(savedClosing.totalExpenses).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Online Collection:</span>
                      <p className="text-base font-bold text-indigo-400">₹{parseFloat(savedClosing.onlineCollection).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Offline Collection:</span>
                      <p className="text-base font-bold text-teal-400">₹{parseFloat(savedClosing.offlineCollection).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Collected:</span>
                      <p className="text-base font-bold text-amber-400">₹{parseFloat(savedClosing.totalCollected).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Final Net Amount:</span>
                      <p className="text-base font-bold text-emerald-400">₹{parseFloat(savedClosing.finalAmount).toFixed(2)}</p>
                    </div>
                  </div>

                  {savedClosing.notes && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Notes & Audit Trail:</span>
                      <p className="text-slate-300 font-mono whitespace-pre-wrap text-[11px]">{savedClosing.notes}</p>
                    </div>
                  )}

                  {/* Reopening Section */}
                  {!showReopenSection ? (
                    <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowClosingModal(false)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReopenSection(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-700/80 hover:bg-amber-600 text-white rounded-xl font-bold"
                      >
                        <Unlock className="w-4 h-4" />
                        Authorized Reopen / Adjust
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReopenClosing} className="space-y-3 pt-3 border-t border-slate-800">
                      <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-300 text-xs">
                        <strong>Authorized Reopening:</strong> Reopening unlocks daily stock and closing records for adjustments. An audit trail entry will be recorded with your user ID.
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                          Reason for Reopening *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="State why books are being reopened (e.g. Cash count correction, missing expense)..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-amber-500 resize-none font-sans"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReopenSection(false)}
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={reopenSubmitting}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl disabled:opacity-50"
                        >
                          {reopenSubmitting ? 'Reopening...' : 'Confirm Reopen'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : modalStep === 'INPUT' ? (
                /* Step 1: Input Collections and Review Expenses */
                <form onSubmit={handleProceedToReview} className="space-y-4 text-xs">
                  {/* Read-only Pre-calculated Metrics */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Business</span>
                      <p className="text-base font-bold text-emerald-400">₹{totalBusiness.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-500 font-sans">{totalBottlesSold} bottles sold</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total Expenses</span>
                      <p className="text-base font-bold text-rose-400">₹{totalExpenses.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-500 font-sans">{expenses.length} item(s)</p>
                    </div>
                  </div>

                  {/* Expenses Breakdown Mini Table */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase">Recorded Expenses Breakdown</span>
                      <Link to="/expenses" className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 font-sans">
                        + Add / Edit Expenses <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    {expenses.length === 0 ? (
                      <p className="text-slate-500 italic text-[11px]">No expenses recorded today.</p>
                    ) : (
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1 font-mono text-[11px]">
                        {expenses.map((exp, idx) => (
                          <div key={exp.id || idx} className="flex justify-between items-center text-slate-300">
                            <span className="font-sans text-slate-400">
                              [{exp.category}] {exp.description} {exp.recipient ? `(to ${exp.recipient})` : ''}
                            </span>
                            <span className="text-rose-400 font-bold">₹{parseFloat(exp.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Collection Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Online Collection (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={onlineCollection}
                        onChange={(e) => setOnlineCollection(e.target.value)}
                        placeholder="UPI, QR, Card"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                        Offline Collection (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={offlineCollection}
                        onChange={(e) => setOfflineCollection(e.target.value)}
                        placeholder="Physical Cash"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
                      />
                    </div>
                  </div>

                  {/* Live Reconciled Calculations */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Total Collected (Online + Cash):</span>
                      <span className="font-bold text-amber-400">₹{calcTotalCollected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Eligible Expenses Deducted:</span>
                      <span className="text-rose-400">-₹{totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                      <span className="text-emerald-400 font-sans">Final Net Amount (Collected - Expenses):</span>
                      <span className="text-emerald-400 text-sm">₹{calcFinalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2">
                      <span className="text-slate-400 font-sans">Collection Difference (Collected - Business):</span>
                      <span className={`font-bold ${calcDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {calcDiff >= 0 ? '+' : ''}₹{calcDiff.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Closing Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder="Cash handover notes, discrepancy explanation..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-amber-500 resize-none font-sans"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowClosingModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={hasIncompleteRecords}
                      className="flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50"
                    >
                      Review Reconciled Totals
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Final Confirmation Review Screen */
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Review Final Closing Totals Before Sealing Books</span>
                    </div>
                    <p className="text-[11px] text-amber-300/80">
                      Confirming will lock today's stock records and save the final daily closing. Please verify all figures.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Business Date:</span>
                      <span className="font-bold text-white">{businessDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Active Shop:</span>
                      <span className="font-bold text-amber-400">{selectedShop?.name}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/80 pt-2">
                      <span className="text-slate-400 font-sans">Total Stock Business:</span>
                      <span className="font-bold text-white">₹{totalBusiness.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Online Collection:</span>
                      <span className="font-bold text-indigo-400">₹{onlineNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Offline Collection (Cash):</span>
                      <span className="font-bold text-teal-400">₹{offlineNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/80 pt-2">
                      <span className="text-slate-400 font-sans">Total Collected:</span>
                      <span className="font-bold text-amber-400">₹{calcTotalCollected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Total Expenses Deducted:</span>
                      <span className="font-bold text-rose-400">-₹{totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/80 pt-2 font-bold text-sm">
                      <span className="text-emerald-400 font-sans">Final Net Amount:</span>
                      <span className="text-emerald-400">₹{calcFinalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/80 pt-2">
                      <span className="text-slate-400 font-sans">Collection Difference:</span>
                      <span className={`font-bold ${calcDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {calcDiff >= 0 ? '+' : ''}₹{calcDiff.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {closingNotes && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Closing Notes:</span>
                      <p className="text-slate-300 font-mono text-[11px]">{closingNotes}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalStep('INPUT')}
                      disabled={closingSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmClosing}
                      disabled={closingSubmitting}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {closingSubmitting ? 'Finalizing Closing...' : 'Confirm & Seal Business Day'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
