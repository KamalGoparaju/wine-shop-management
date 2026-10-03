import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Package, Box, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [summary, setSummary] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, entriesRes] = await Promise.all([
        apiClient.get('/inventory/stock/summary').catch(() => ({ data: { stockSummary: [] } })),
        apiClient.get('/inventory/stock/entries').catch(() => ({ data: { stockEntries: [] } }))
      ]);

      if (sumRes.success) {
        setSummary(sumRes.data.stockSummary || []);
      }
      if (entriesRes.success) {
        setRecentEntries(entriesRes.data.stockEntries || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalProducts = summary.length;
  const totalBottles = summary.reduce((acc, curr) => acc + (curr.inStockBottlesCount || 0), 0);
  const totalBoxes = summary.reduce((acc, curr) => acc + parseFloat(curr.equivalentBoxes || 0), 0).toFixed(1);

  return (
    <Layout title="Dashboard & Stock Overview">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Stock Dashboard</h1>
          <p className="text-sm text-slate-400">Real-time inventory metrics and bottle serial tracking</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-2xl font-bold">
            📦
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Products</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalProducts}</h3>
            <p className="text-xs text-slate-500 mt-1">Cataloged wine & spirit items</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
            🍷
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In-Stock Bottles</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalBottles}</h3>
            <p className="text-xs text-emerald-400 font-medium mt-1">Individual physical serials registered</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-5 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl font-bold">
            📥
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Equivalent Boxes</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalBoxes}</h3>
            <p className="text-xs text-slate-500 mt-1">Calculated from product box sizes</p>
          </div>
        </div>
      </div>

      {/* Stock Summary Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Current Stock by Product</h2>
            <Link to="/stock/list" className="text-xs font-semibold text-amber-500 hover:text-amber-400">
              View All Stock →
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Loading stock summary...</div>
          ) : summary.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No products or stock entries registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Volume</th>
                    <th className="px-4 py-3 text-right">In-Stock Bottles</th>
                    <th className="px-4 py-3 text-right">Equiv. Boxes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {summary.map((item) => (
                    <tr key={item.productId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-white">{item.productName}</td>
                      <td className="px-4 py-3.5 text-slate-400">{item.brandName}</td>
                      <td className="px-4 py-3.5 text-slate-400">{item.bottleVolume}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-400">{item.inStockBottlesCount}</td>
                      <td className="px-4 py-3.5 text-right text-slate-300 font-mono">{item.equivalentBoxes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Stock Entries */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">Recent Stock Entries</h2>
          {recentEntries.length === 0 ? (
            <p className="text-slate-500 text-xs py-4">No recent stock entries recorded.</p>
          ) : (
            <div className="space-y-4">
              {recentEntries.slice(0, 5).map((entry) => (
                <Link
                  key={entry.id}
                  to={`/stock/details/${entry.id}`}
                  className="block p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition-all"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-white text-sm">
                      {entry.product?.name || 'Product'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                      {entry.totalBottles} BOTTLES
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {entry.numberOfBoxes} Boxes × {entry.bottlesPerBox} / box
                  </p>
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
