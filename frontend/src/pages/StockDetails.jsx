import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { ArrowLeft, Box, Barcode, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const StockDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjustingBottle, setAdjustingBottle] = useState(null);
  const [newStatus, setNewStatus] = useState('DAMAGED');
  const [reason, setReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/inventory/stock/entries/${id}`);
      if (res.success) {
        setEntry(res.data.stockEntry);
      }
    } catch (err) {
      console.error('Failed to fetch stock entry details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleOpenAdjust = (bottle) => {
    setAdjustingBottle(bottle);
    setNewStatus('DAMAGED');
    setReason('');
    setAdjustError('');
  };

  const handleSubmitAdjustment = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setAdjustError('Reason is required for status adjustment.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/inventory/adjustments', {
        bottleId: adjustingBottle.id,
        newStatus,
        reason: reason.trim(),
        adjustedBy: user?.name || user?.id || 'Admin'
      });

      if (res.success) {
        setAdjustingBottle(null);
        fetchDetails();
      }
    } catch (err) {
      setAdjustError(err?.message || 'Failed to submit adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!window.confirm(`Are you sure you want to cancel and delete this entire stock entry (${entry.totalBottles} bottles)?`)) {
      return;
    }

    try {
      await apiClient.delete(`/inventory/stock/entries/${entry.id}`);
      window.location.href = '/stock/list';
    } catch (err) {
      alert(err?.message || 'Cannot delete stock entry: some bottles have already been sold or modified.');
    }
  };

  if (loading) {
    return (
      <Layout title="Stock Entry Details">
        <div className="p-8 text-center text-slate-500">Loading entry details...</div>
      </Layout>
    );
  }

  if (!entry) {
    return (
      <Layout title="Stock Entry Details">
        <div className="p-8 text-center text-slate-500">Stock entry not found.</div>
      </Layout>
    );
  }

  return (
    <Layout title={`Stock Entry #${entry.id.substring(0, 8)}`}>
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/stock/list"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Stock List
        </Link>
        <button
          onClick={handleDeleteEntry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 text-xs font-semibold rounded-xl border border-rose-800/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Stock Entry
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
              {entry.product?.brand?.name}
            </span>
            <h1 className="text-2xl font-bold text-white mt-0.5">{entry.product?.name}</h1>
            <p className="text-xs text-slate-400 mt-1">Volume: {entry.product?.bottleVolume}</p>
          </div>

          <div className="flex gap-4">
            <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Boxes</p>
              <p className="text-xl font-bold text-white font-mono">{entry.numberOfBoxes}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Bottles / Box</p>
              <p className="text-xl font-bold text-white font-mono">{entry.bottlesPerBox}</p>
            </div>
            <div className="bg-amber-950/40 border border-amber-800/40 px-4 py-2 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold text-amber-400">Total Bottles</p>
              <p className="text-xl font-bold text-amber-300 font-mono">{entry.totalBottles}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
          <div>Purchase Box Price: <strong className="text-emerald-400 font-mono">₹{entry.boxPrice}</strong></div>
          <div>Purchase Bottle Price: <strong className="text-emerald-400 font-mono">₹{entry.bottlePrice}</strong></div>
          <div>Entry Date: <strong className="text-slate-200 font-mono">{new Date(entry.createdAt).toLocaleString()}</strong></div>
          <div>Notes: <strong className="text-slate-200">{entry.notes || 'None'}</strong></div>
        </div>
      </div>

      {/* Boxes & Physical Bottle Serial Numbers Breakdown */}
      <h2 className="text-lg font-bold text-white mb-4">Boxes & Bottle Serial Numbers Breakdown</h2>

      <div className="space-y-6">
        {entry.boxes?.map((box) => (
          <div key={box.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm">
                #{box.boxNumber}
              </div>
              <h3 className="text-base font-bold text-white">Box #{box.boxNumber}</h3>
              <span className="text-xs text-slate-400">({box.bottles?.length || 0} bottles)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {box.bottles?.map((bottle) => (
                <div
                  key={bottle.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-mono font-bold text-amber-400 text-sm">{bottle.serialNumber}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Price: ₹{bottle.bottlePrice}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      bottle.status === 'IN_STOCK' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50' :
                      bottle.status === 'SOLD' ? 'bg-indigo-950 text-indigo-400 border-indigo-800/50' :
                      'bg-rose-950 text-rose-400 border-rose-800/50'
                    }`}>
                      {bottle.status}
                    </span>
                    <button
                      onClick={() => handleOpenAdjust(bottle)}
                      className="text-[11px] text-slate-400 hover:text-white underline"
                    >
                      Adjust
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Adjust Status Modal */}
      {adjustingBottle && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Adjust Bottle Status</h3>
            <p className="text-xs text-amber-400 font-mono mb-4">
              Serial Number: {adjustingBottle.serialNumber} (Current: {adjustingBottle.status})
            </p>

            {adjustError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  New Status *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="RETURNED">RETURNED</option>
                  <option value="ADJUSTED">ADJUSTED</option>
                  <option value="IN_STOCK">IN_STOCK</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason for Adjustment *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why status is being changed..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingBottle(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default StockDetails;
