import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { DollarSign, ShoppingCart, Award, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';

const Reports = () => {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Reports & Financial Analytics</h1>
          <p className="text-sm text-slate-400">Inventory valuation, sales performance, and bottle status distribution</p>
        </div>
        <button
          onClick={fetchReports}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Reports
        </button>
      </div>

      {/* Sales KPI Cards */}
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        Sales & Revenue KPIs
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Revenue</p>
          <h3 className="text-2xl font-bold text-emerald-400 font-mono mt-1">₹{summary.todayRevenue || '0.00'}</h3>
          <p className="text-xs text-slate-500 mt-1">{summary.todaySalesCount || 0} sales transactions today</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month's Revenue</p>
          <h3 className="text-2xl font-bold text-amber-400 font-mono mt-1">₹{summary.monthRevenue || '0.00'}</h3>
          <p className="text-xs text-slate-500 mt-1">{summary.monthSalesCount || 0} sales this month</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue All-Time</p>
          <h3 className="text-2xl font-bold text-white font-mono mt-1">₹{summary.totalRevenue || '0.00'}</h3>
          <p className="text-xs text-slate-500 mt-1">{summary.totalSalesCount || 0} lifetime invoices</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Bottles Sold</p>
          <h3 className="text-2xl font-bold text-indigo-400 mt-1">{summary.todayBottlesSold || 0}</h3>
          <p className="text-xs text-slate-500 mt-1">Physical serials marked SOLD</p>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-amber-500" />
        Payment Method Breakdown
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase">💵 Cash Sales</span>
          <p className="text-xl font-bold text-white mt-1">{payment.CASH || 0}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase">💳 Card Sales</span>
          <p className="text-xl font-bold text-white mt-1">{payment.CARD || 0}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase">📱 UPI / QR</span>
          <p className="text-xl font-bold text-white mt-1">{payment.UPI || 0}</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase">🌐 Other Methods</span>
          <p className="text-xl font-bold text-white mt-1">{payment.OTHER || 0}</p>
        </div>
      </div>

      {/* Inventory Stock Valuation & Bottle Status Summary */}
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-indigo-400" />
        Inventory Valuation & Bottle Status Distribution
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Inventory Valuation</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-sm text-slate-400">In-Stock Inventory Value</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">₹{stock.inStockValuation || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-sm text-slate-400">Total Registered Catalog Value</span>
              <span className="text-lg font-bold text-amber-400 font-mono">₹{stock.totalInventoryValuation || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-sm text-slate-400">Total Physical Bottles Tracked</span>
              <span className="text-lg font-bold text-white font-mono">{stock.totalBottlesRegistered || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Bottle Status Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/30">
              <span className="text-xs font-semibold text-emerald-400">IN_STOCK</span>
              <span className="text-sm font-bold text-emerald-300 font-mono">{status.IN_STOCK || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/30">
              <span className="text-xs font-semibold text-indigo-400">SOLD</span>
              <span className="text-sm font-bold text-indigo-300 font-mono">{status.SOLD || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/30">
              <span className="text-xs font-semibold text-rose-400">DAMAGED</span>
              <span className="text-sm font-bold text-rose-300 font-mono">{status.DAMAGED || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">RETURNED / ADJUSTED</span>
              <span className="text-sm font-bold text-slate-300 font-mono">{(status.RETURNED || 0) + (status.ADJUSTED || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
