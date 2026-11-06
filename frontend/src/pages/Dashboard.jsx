import React, { useEffect, useState, useMemo } from 'react';
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
import { useTheme } from '../context/ThemeContext';

const Dashboard = () => {
  const { selectedShop } = useAuth();
  const { activeTheme } = useTheme();
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

  // Pre-calculate contiguous brand row spans for grouped table display
  const brandRowSpans = useMemo(() => {
    const spans = {};
    dailyRecords.forEach((item, index) => {
      const brandId = item.brandId || item.brand?.id;
      const prevBrandId = index > 0 ? (dailyRecords[index - 1].brandId || dailyRecords[index - 1].brand?.id) : null;
      if (index === 0 || prevBrandId !== brandId) {
        let count = 1;
        for (let j = index + 1; j < dailyRecords.length; j++) {
          const nextBrandId = dailyRecords[j].brandId || dailyRecords[j].brand?.id;
          if (nextBrandId === brandId) count++;
          else break;
        }
        spans[index] = count;
      }
    });
    return spans;
  }, [dailyRecords]);

  return (
    <Layout title={`${selectedShop?.name || 'Shop'} — Daily Operations`}>
      <div className="space-y-4 sm:space-y-6">
        {/* Top Header & Date Selector */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Daily Operations</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border ${
                isClosed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isClosed ? 'CLOSED' : 'OPEN / IN PROGRESS'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Active Shop: <strong style={{ color: activeTheme.primary }}>{selectedShop?.name || 'Loading...'}</strong> ({selectedShop?.code || '—'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: activeTheme.primary }} />
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-transparent text-slate-800 font-mono focus:outline-none cursor-pointer"
                aria-label="Select business date"
              />
            </div>

            <button
              onClick={fetchDashboardData}
              className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors"
              title="Refresh Data"
              aria-label="Refresh Dashboard Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenClosingModal}
              style={!isClosed ? { backgroundColor: activeTheme.primary } : {}}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all ${
                isClosed
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'text-white hover:opacity-95'
              }`}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{isClosed ? 'View / Reopen Closing' : "Close Today's Business"}</span>
            </button>
          </div>
        </div>

        {/* Financial Summary Cards Grid */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
          {/* 1. Total Bottle Sales Amount */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Bottle Sales Amount</span>
              <Coins className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-emerald-700 font-mono truncate" title={`₹${totalBusiness.toFixed(2)}`}>
              ₹{totalBusiness.toFixed(2)}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Gross revenue (Grand Total)</p>
          </div>

          {/* Extra Amount Card (Informational) */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Total Extra Amount</span>
              <Coins className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 font-mono truncate" title={`₹${totalExtraAmount.toFixed(2)}`}>
              ₹{totalExtraAmount.toFixed(2)}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Separate • Excluded from totals</p>
          </div>

          {/* 2. Total Bottles Sold */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Bottles Sold</span>
              <Package className="w-4 h-4 shrink-0" style={{ color: activeTheme.primary }} />
            </div>
            <h3 className="text-base sm:text-lg font-bold font-mono truncate" style={{ color: activeTheme.primary }}>
              {totalBottlesSold}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Physical bottles sold</p>
          </div>

          {/* 3. Total Bottles Remaining */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Bottles Remaining</span>
              <Package className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 font-mono truncate">
              {totalBottlesRemaining}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Closing shelf count</p>
          </div>

          {/* 4. Total Expenses */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Expenses</span>
              <Receipt className="w-4 h-4 text-rose-500 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-rose-600 font-mono truncate" title={`₹${totalExpenses.toFixed(2)}`}>
              ₹{totalExpenses.toFixed(2)}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">{expenses.length} expense item(s)</p>
          </div>

          {/* 5. Online Collection */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Online Collection</span>
              <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-indigo-600 font-mono truncate">
              {isClosed ? `₹${parseFloat(savedClosing.onlineCollection).toFixed(2)}` : (
                <span className="text-xs text-amber-600 font-sans font-semibold">Pending</span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">UPI, QR & POS</p>
          </div>

          {/* 6. Offline Collection */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Offline Collection</span>
              <Banknote className="w-4 h-4 text-teal-600 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-teal-700 font-mono truncate">
              {isClosed ? `₹${parseFloat(savedClosing.offlineCollection).toFixed(2)}` : (
                <span className="text-xs text-amber-600 font-sans font-semibold">Pending</span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Physical cash in drawer</p>
          </div>

          {/* 7. Total Collected */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Collected</span>
              <Coins className="w-4 h-4 shrink-0" style={{ color: activeTheme.primary }} />
            </div>
            <h3 className="text-base sm:text-lg font-bold font-mono truncate" style={{ color: activeTheme.primary }}>
              {isClosed ? `₹${parseFloat(savedClosing.totalCollected).toFixed(2)}` : (
                <span className="text-xs text-slate-400 font-sans font-semibold">Pending Closing</span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Online + Offline Cash</p>
          </div>

          {/* 8. Collection Difference */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Collection Diff</span>
              <Scale className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-bold font-mono truncate">
              {isClosed ? (
                <span className={parseFloat(savedClosing.collectionDifference) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {parseFloat(savedClosing.collectionDifference) >= 0 ? '+' : ''}₹{parseFloat(savedClosing.collectionDifference).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-sans font-semibold">Pending Closing</span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Collected minus Business</p>
          </div>

          {/* 9. Final Net Amount */}
          <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Final Net Amount</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-emerald-800 font-mono truncate" title={isClosed ? `₹${parseFloat(savedClosing.finalAmount).toFixed(2)}` : ''}>
              {isClosed ? `₹${parseFloat(savedClosing.finalAmount).toFixed(2)}` : (
                <span className="text-xs text-emerald-700 font-sans font-semibold">Pending Collection</span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-emerald-600/90 mt-0.5 truncate">Collected minus Expenses</p>
          </div>

          {/* 10. Daily Closing Status Card */}
          <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Closing Status</span>
              {isClosed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Lock className="w-4 h-4 text-amber-500 shrink-0" />}
            </div>
            <h3 className={`text-sm sm:text-base font-extrabold mt-0.5 truncate ${isClosed ? 'text-emerald-700' : 'text-amber-600'}`}>
              {isClosed ? 'CLOSED' : 'OPEN / PENDING'}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
              {isClosed ? `By ${savedClosing.closedBy || 'Admin'}` : 'Awaiting daily closing'}
            </p>
          </div>
        </div>

        {/* Quick Action Navigation Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link
            to="/daily-stock"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs group"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors"
                style={{ backgroundColor: activeTheme.light, color: activeTheme.primary }}
              >
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800 transition-colors truncate">Daily Stock Entry Sheet</h4>
                <p className="text-[11px] text-slate-500 truncate">Enter Opening, Indent & Closing</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" style={{ color: activeTheme.primary }} />
          </Link>

          <Link
            to="/expenses"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800 transition-colors truncate">Daily Expenses</h4>
                <p className="text-[11px] text-slate-500 truncate">Manage transport, bills & transfers</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
          </Link>

          <Link
            to="/closing-history"
            className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800 transition-colors truncate">Closing History & CSV</h4>
                <p className="text-[11px] text-slate-500 truncate">Statements, past closings & exports</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
          </Link>
        </div>

        {/* Daily Stock Summary Table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: activeTheme.primary }} />
              Daily Stock Sheet Overview ({businessDate})
            </h2>
            <Link 
              to="/daily-stock" 
              className="text-xs font-semibold shrink-0 flex items-center gap-1 hover:underline"
              style={{ color: activeTheme.primary }}
            >
              Open Full Daily Sheet →
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading daily stock metrics...</div>
          ) : dailyRecords.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No daily stock recorded for {businessDate}. Click "Open Full Daily Sheet" to enter stock.
            </div>
          ) : (
            <div className="table-grid-wrapper">
              <table className="table-grid min-w-[640px]">
                <thead>
                  <tr>
                    <th className="border-r border-slate-200">Brand</th>
                    <th className="text-center border-r border-slate-200 w-16">Size</th>
                    <th className="text-center font-mono">Opening</th>
                    <th className="text-center font-mono">Indent</th>
                    <th className="text-center font-mono">Total</th>
                    <th className="text-center font-mono">Closing</th>
                    <th className="text-center font-mono" style={{ color: activeTheme.primary }}>Sale</th>
                    <th className="text-right font-mono">Rate</th>
                    <th className="text-right font-mono text-emerald-700">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {dailyRecords.map((r, i) => {
                    const span = brandRowSpans[i];
                    const isFirstOfBrand = span !== undefined;
                    const isLastOfBrand = (i === dailyRecords.length - 1) || ((dailyRecords[i + 1]?.brandId || dailyRecords[i + 1]?.brand?.id) !== (r.brandId || r.brand?.id));

                    return (
                      <tr 
                        key={r.id || i}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isLastOfBrand ? 'border-b-2 border-slate-300' : 'border-b border-slate-100'
                        }`}
                      >
                        {isFirstOfBrand && (
                          <td 
                            rowSpan={span}
                            className="font-sans font-bold text-slate-900 align-middle border-r border-slate-200 bg-white px-3 max-w-[180px] truncate"
                          >
                            {r.brand?.name}
                          </td>
                        )}
                        <td className="text-center font-bold border-r border-slate-200" style={{ color: activeTheme.primary }}>
                          <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-xs">
                            {r.size?.code}
                          </span>
                        </td>
                        <td className="text-center text-slate-600">{r.openingStock}</td>
                        <td className="text-center text-indigo-600 font-bold">{r.indentStock}</td>
                        <td className="text-center font-bold text-slate-900">{r.totalStock}</td>
                        <td className="text-center text-emerald-700 font-bold">{r.closingStock}</td>
                        <td className="text-center font-bold" style={{ color: activeTheme.primary }}>{r.saleCount}</td>
                        <td className="text-right text-slate-600">₹{r.bottleRate}</td>
                        <td className="text-right font-bold text-emerald-700 font-sans">
                          ₹{parseFloat(r.saleAmount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Close Today's Business Modal */}
        {showClosingModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 shrink-0" style={{ color: activeTheme.primary }} />
                    Daily Business Closing
                  </h3>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: activeTheme.primary }}>
                    {selectedShop?.name} — {businessDate}
                  </p>
                </div>
                <button
                  onClick={() => setShowClosingModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {hasIncompleteRecords && !isClosed && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Daily stock sheet for this date is incomplete or in draft.</span>
                  </div>
                  <Link to="/daily-stock" className="text-amber-700 underline font-semibold whitespace-nowrap text-[11px] shrink-0">
                    Go to Sheet →
                  </Link>
                </div>
              )}

              {closingError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{closingError}</span>
                </div>
              )}

              {/* View / Reopen Mode for Already Closed Day */}
              {isClosed ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Business Day Closed & Books Sealed</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Closed on {new Date(savedClosing.closedAt).toLocaleString()} by <strong>{savedClosing.closedBy}</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total Business:</span>
                      <p className="text-sm sm:text-base font-bold text-slate-900">₹{parseFloat(savedClosing.totalBusiness).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total Expenses:</span>
                      <p className="text-sm sm:text-base font-bold text-rose-600">₹{parseFloat(savedClosing.totalExpenses).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Online Collection:</span>
                      <p className="text-sm sm:text-base font-bold text-indigo-600">₹{parseFloat(savedClosing.onlineCollection).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Offline Collection:</span>
                      <p className="text-sm sm:text-base font-bold text-teal-700">₹{parseFloat(savedClosing.offlineCollection).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total Collected:</span>
                      <p className="text-sm sm:text-base font-bold" style={{ color: activeTheme.primary }}>₹{parseFloat(savedClosing.totalCollected).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Final Net Amount:</span>
                      <p className="text-sm sm:text-base font-bold text-emerald-700">₹{parseFloat(savedClosing.finalAmount).toFixed(2)}</p>
                    </div>
                  </div>

                  {savedClosing.notes && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Notes & Audit Trail:</span>
                      <p className="text-slate-700 font-mono whitespace-pre-wrap text-[11px]">{savedClosing.notes}</p>
                    </div>
                  )}

                  {/* Reopening Section */}
                  {!showReopenSection ? (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowClosingModal(false)}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowReopenSection(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors"
                      >
                        <Unlock className="w-4 h-4" />
                        Authorized Reopen / Adjust
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReopenClosing} className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                        <strong>Authorized Reopening:</strong> Reopening unlocks daily stock and closing records for adjustments. An audit trail entry will be recorded with your user ID.
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Reason for Reopening *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="State why books are being reopened (e.g. Cash count correction, missing expense)..."
                          className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs focus-theme resize-none font-sans"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReopenSection(false)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200"
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
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total Business</span>
                      <p className="text-base font-bold text-emerald-700">₹{totalBusiness.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 font-sans">{totalBottlesSold} bottles sold</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total Expenses</span>
                      <p className="text-base font-bold text-rose-600">₹{totalExpenses.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 font-sans">{expenses.length} item(s)</p>
                    </div>
                  </div>

                  {/* Expenses Breakdown Mini Table */}
                  <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-bold uppercase">Recorded Expenses Breakdown</span>
                      <Link to="/expenses" className="text-[11px] text-rose-600 hover:underline flex items-center gap-1 font-sans font-medium">
                        + Add / Edit Expenses <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    {expenses.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">No expenses recorded today.</p>
                    ) : (
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1 font-mono text-[11px]">
                        {expenses.map((exp, idx) => (
                          <div key={exp.id || idx} className="flex justify-between items-center text-slate-700">
                            <span className="font-sans text-slate-600 truncate max-w-[200px]">
                              [{exp.category}] {exp.description} {exp.recipient ? `(${exp.recipient})` : ''}
                            </span>
                            <span className="text-rose-600 font-bold shrink-0 ml-2">₹{parseFloat(exp.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Collection Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
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
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus-theme font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
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
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono text-xs focus-theme font-bold"
                      />
                    </div>
                  </div>

                  {/* Live Reconciled Calculations */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Total Collected (Online + Cash):</span>
                      <span className="font-bold" style={{ color: activeTheme.primary }}>₹{calcTotalCollected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Eligible Expenses Deducted:</span>
                      <span className="text-rose-600">-₹{totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                      <span className="text-emerald-700 font-sans">Final Net Amount (Collected - Expenses):</span>
                      <span className="text-emerald-700 text-sm">₹{calcFinalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-sans">Collection Difference (Collected - Business):</span>
                      <span className={`font-bold ${calcDiff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {calcDiff >= 0 ? '+' : ''}₹{calcDiff.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Closing Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder="Cash handover notes, discrepancy explanation..."
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs focus-theme resize-none font-sans"
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowClosingModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-center transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={hasIncompleteRecords}
                      style={{ backgroundColor: activeTheme.primary }}
                      className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-white font-bold rounded-xl shadow-xs hover:opacity-95 transition-all disabled:opacity-50"
                    >
                      <span>Review Reconciled Totals</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: Final Confirmation Review Screen */
                <div className="space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Review Final Closing Totals Before Sealing Books</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Confirming will lock today's stock records and save the final daily closing. Please verify all figures.
                    </p>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Business Date:</span>
                      <span className="font-bold text-slate-900">{businessDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Active Shop:</span>
                      <span className="font-bold" style={{ color: activeTheme.primary }}>{selectedShop?.name}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-sans">Total Stock Business:</span>
                      <span className="font-bold text-slate-900">₹{totalBusiness.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Online Collection:</span>
                      <span className="font-bold text-indigo-600">₹{onlineNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Offline Collection (Cash):</span>
                      <span className="font-bold text-teal-700">₹{offlineNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-sans">Total Collected:</span>
                      <span className="font-bold" style={{ color: activeTheme.primary }}>₹{calcTotalCollected.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-sans">Total Expenses Deducted:</span>
                      <span className="font-bold text-rose-600">-₹{totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                      <span className="text-emerald-700 font-sans">Final Net Amount:</span>
                      <span className="text-emerald-700">₹{calcFinalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-sans">Collection Difference:</span>
                      <span className={`font-bold ${calcDiff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {calcDiff >= 0 ? '+' : ''}₹{calcDiff.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {closingNotes && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Closing Notes:</span>
                      <p className="text-slate-700 font-mono text-[11px]">{closingNotes}</p>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalStep('INPUT')}
                      disabled={closingSubmitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmClosing}
                      disabled={closingSubmitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{closingSubmitting ? 'Finalizing Closing...' : 'Confirm & Seal Business Day'}</span>
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
