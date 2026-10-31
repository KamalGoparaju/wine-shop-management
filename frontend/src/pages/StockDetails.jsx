import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { ArrowLeft, Box, Barcode, CheckCircle, AlertTriangle, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const StockDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { activeTheme } = useTheme();

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
        <div className="p-12 text-center text-slate-500 text-sm">Loading entry details...</div>
      </Layout>
    );
  }

  if (!entry) {
    return (
      <Layout title="Stock Entry Details">
        <div className="p-12 text-center text-slate-500 text-sm">Stock entry not found.</div>
      </Layout>
    );
  }

  return (
    <Layout title={`Stock Entry #${entry.id.substring(0, 8)}`}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Link
            to="/stock/list"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Stock List
          </Link>
          <button
            onClick={handleDeleteEntry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl border border-rose-200 transition-colors self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete Stock Entry
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: activeTheme.primary }}>
                {entry.product?.brand?.name}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{entry.product?.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">Volume: {entry.product?.bottleVolume}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 font-sans">Boxes</p>
                <p className="text-base sm:text-xl font-bold text-slate-900 font-mono">{entry.numberOfBoxes}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 font-sans">Bottles/Box</p>
                <p className="text-base sm:text-xl font-bold text-slate-900 font-mono">{entry.bottlesPerBox}</p>
              </div>
              <div
                className="px-3 py-2 rounded-xl text-center border"
                style={{
                  backgroundColor: activeTheme.light,
                  borderColor: activeTheme.border,
                  color: activeTheme.primary
                }}
              >
                <p className="text-[10px] uppercase font-bold font-sans opacity-80">Total Bottles</p>
                <p className="text-base sm:text-xl font-bold font-mono">{entry.totalBottles}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
            <div>Purchase Box Price: <strong className="text-slate-900 font-mono">₹{entry.boxPrice}</strong></div>
            <div>Purchase Bottle Price: <strong className="text-slate-900 font-mono">₹{entry.bottlePrice}</strong></div>
            <div>Entry Date: <strong className="text-slate-900 font-mono">{new Date(entry.createdAt).toLocaleDateString()}</strong></div>
            <div>Notes: <strong className="text-slate-800">{entry.notes || 'None'}</strong></div>
          </div>
        </div>

        {/* Boxes & Physical Bottle Serial Numbers Breakdown */}
        <h2 className="text-base sm:text-lg font-bold text-slate-900">Boxes & Bottle Serial Numbers Breakdown</h2>

        <div className="space-y-4 sm:space-y-6">
          {entry.boxes?.map((box) => (
            <div key={box.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm border"
                  style={{
                    backgroundColor: activeTheme.light,
                    borderColor: activeTheme.border,
                    color: activeTheme.primary
                  }}
                >
                  #{box.boxNumber}
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Box #{box.boxNumber}</h3>
                <span className="text-xs text-slate-500">({box.bottles?.length || 0} bottles)</span>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                {box.bottles?.map((bottle) => (
                  <div
                    key={bottle.id}
                    className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-mono font-bold text-xs sm:text-sm" style={{ color: activeTheme.primary }}>
                        {bottle.serialNumber}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono">Price: ₹{bottle.bottlePrice}</div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        bottle.status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        bottle.status === 'SOLD' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {bottle.status}
                      </span>
                      <button
                        onClick={() => handleOpenAdjust(bottle)}
                        className="text-[11px] text-slate-500 hover:text-slate-900 underline"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Adjust Bottle Status</h3>
                  <p className="text-xs font-mono mt-0.5" style={{ color: activeTheme.primary }}>
                    {adjustingBottle.serialNumber} ({adjustingBottle.status})
                  </p>
                </div>
                <button
                  onClick={() => setAdjustingBottle(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {adjustError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{adjustError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    New Status *
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme transition-colors"
                  >
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="RETURNED">RETURNED</option>
                    <option value="ADJUSTED">ADJUSTED</option>
                    <option value="IN_STOCK">IN_STOCK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Reason for Adjustment *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why status is being changed..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme resize-none font-sans transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAdjustingBottle(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl disabled:opacity-50 transition-all shadow-xs hover:opacity-95"
                    style={{ backgroundColor: activeTheme.primary }}
                  >
                    {submitting ? 'Saving...' : 'Confirm Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StockDetails;
