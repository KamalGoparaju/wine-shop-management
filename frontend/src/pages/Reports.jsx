import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { DollarSign, ShoppingCart, Award, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Reports = () => {
  const { activeTheme } = useTheme();
  const [salesReport, setSalesReport] = useState(null);
  const [stockReport, setStockReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [salesRes, stockRes] = await Promise.all([
        apiClient.get('/sales/reports/summary').catch(() => null),
        apiClient.get('/inventory/stock/reports/stock').catch(() => null)
      ]);

      if (salesRes && salesRes.success) {
        setSalesReport(salesRes.data);
      }
      if (stockRes && stockRes.success) {
        setStockReport(stockRes.data);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const summary = salesReport?.summary || {};
  const payment = salesReport?.paymentBreakdown || {};
  const stock = stockReport || {};
  const status = stock.statusCounts || {};

  return (
    <Layout title="Analytics & Business Reports">
      <div className="space-y-4 sm:space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Financial & Stock Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Inventory valuation, sales performance, and bottle status distribution
            </p>
          </div>
          <button
            onClick={fetchReports}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 shadow-2xs transition-all self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: activeTheme.primary }} />
            <span>Refresh Reports</span>
          </button>
        </div>

        {/* Sales KPI Cards */}
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            Sales & Revenue KPIs
          </h2>

          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Revenue</p>
              <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 font-mono mt-1 truncate">
                ₹{summary.todayRevenue || '0.00'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">{summary.todaySalesCount || 0} sales transactions today</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">This Month's Revenue</p>
              <h3 className="text-xl sm:text-2xl font-bold font-mono mt-1 truncate" style={{ color: activeTheme.primary }}>
                ₹{summary.monthRevenue || '0.00'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">{summary.monthSalesCount || 0} sales this month</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue All-Time</p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1 truncate">
                ₹{summary.totalRevenue || '0.00'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">{summary.totalSalesCount || 0} lifetime invoices</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Bottles Sold</p>
              <h3 className="text-xl sm:text-2xl font-bold text-blue-600 mt-1 truncate font-mono">
                {summary.todayBottlesSold || 0}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Physical serials marked SOLD</p>
            </div>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: activeTheme.primary }} />
            Payment Method Breakdown
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">💵 Cash Sales</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1">{payment.CASH || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">💳 Card Sales</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1">{payment.CARD || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">📱 UPI / QR</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1">{payment.UPI || 0}</p>
            </div>
            <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">🌐 Other</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 font-mono mt-1">{payment.OTHER || 0}</p>
            </div>
          </div>
        </div>

        {/* Inventory Stock Valuation & Bottle Status Summary */}
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
            Inventory Valuation & Status Distribution
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Inventory Valuation</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs sm:text-sm text-slate-600">In-Stock Inventory Value</span>
                  <span className="text-base sm:text-lg font-bold text-emerald-600 font-mono">₹{stock.inStockValuation || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs sm:text-sm text-slate-600">Total Registered Catalog Value</span>
                  <span className="text-base sm:text-lg font-bold font-mono" style={{ color: activeTheme.primary }}>
                    ₹{stock.totalInventoryValuation || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs sm:text-sm text-slate-600">Total Physical Bottles Tracked</span>
                  <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">{stock.totalBottlesRegistered || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Bottle Status Distribution</h3>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-700">IN_STOCK</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-800 font-mono">{status.IN_STOCK || 0}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="text-xs font-semibold text-blue-700">SOLD</span>
                  <span className="text-xs sm:text-sm font-bold text-blue-800 font-mono">{status.SOLD || 0}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-rose-50/70 border border-rose-200">
                  <span className="text-xs font-semibold text-rose-700">DAMAGED</span>
                  <span className="text-xs sm:text-sm font-bold text-rose-800 font-mono">{status.DAMAGED || 0}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">RETURNED / ADJUSTED</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">{(status.RETURNED || 0) + (status.ADJUSTED || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
