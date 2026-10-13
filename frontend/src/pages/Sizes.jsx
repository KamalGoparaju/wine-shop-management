import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { 
  Plus, 
  Search, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Trash2, 
  Layers, 
  RefreshCw, 
  Info,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Sizes = () => {
  const [sizes, setSizes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [loading, setLoading] = useState(true);
  
  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSize, setEditingSize] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Conflict / Deletion Prevention Modal
  const [blockedDeleteSize, setBlockedDeleteSize] = useState(null);
  const [deactivatingBlocked, setDeactivatingBlocked] = useState(false);

  // Global Page Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSizes = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = {
        includeInactive: 'true',
        search: search.trim() || undefined
      };
      if (statusFilter === 'active') params.isActive = 'true';
      if (statusFilter === 'inactive') params.isActive = 'false';

      const res = await apiClient.get('/inventory/sizes', { params });
      if (res.success) {
        setSizes(res.data.sizes || []);
      }
    } catch (err) {
      console.error('Failed to fetch sizes:', err);
      setErrorMsg(err?.message || 'Failed to load bottle sizes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSizes();
  }, [search, statusFilter]);

  const handleOpenCreate = () => {
    setEditingSize(null);
    setCode('');
    setName('');
    setVolumeMl('');
    setDescription('');
    setIsActive(true);
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (s) => {
    setEditingSize(s);
    setCode(s.code);
    setName(s.name);
    setVolumeMl(s.volumeMl !== null && s.volumeMl !== undefined ? String(s.volumeMl) : '');
    setDescription(s.description || '');
    setIsActive(s.isActive);
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setFormError('Size code is required (e.g., Q, P, N, 750ML).');
      return;
    }
    if (!cleanName) {
      setFormError('Display name is required (e.g., Quart (750ml)).');
      return;
    }

    let parsedVolume = null;
    if (volumeMl !== '') {
      parsedVolume = parseInt(volumeMl, 10);
      if (isNaN(parsedVolume) || parsedVolume < 0) {
        setFormError('Volume in ml must be a valid non-negative number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        code: cleanCode,
        name: cleanName,
        volumeMl: parsedVolume,
        description: description.trim() || null,
        isActive
      };

      if (editingSize) {
        await apiClient.put(`/inventory/sizes/${editingSize.id}`, payload);
        setSuccessMsg(`Size "${cleanCode}" updated successfully!`);
      } else {
        await apiClient.post('/inventory/sizes', payload);
        setSuccessMsg(`Size "${cleanCode}" created successfully!`);
      }

      setShowModal(false);
      fetchSizes();
    } catch (err) {
      setFormError(err?.message || 'Failed to save size.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (s) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const nextStatus = !s.isActive;
      await apiClient.patch(`/inventory/sizes/${s.id}/status`, { isActive: nextStatus });
      setSuccessMsg(`Size "${s.code}" ${nextStatus ? 'activated' : 'deactivated'} successfully!`);
      fetchSizes();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to toggle size status.');
    }
  };

  const handleDelete = async (s) => {
    setErrorMsg('');
    setSuccessMsg('');

    // Pre-check if referenced
    const ratesCount = s._count?.rates || 0;
    const stockCount = s._count?.dailyStockRecords || 0;

    if (ratesCount > 0 || stockCount > 0) {
      setBlockedDeleteSize(s);
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete size "${s.code}" (${s.name})?`)) {
      return;
    }

    try {
      await apiClient.delete(`/inventory/sizes/${s.id}`);
      setSuccessMsg(`Size "${s.code}" deleted permanently.`);
      fetchSizes();
    } catch (err) {
      if (err?.error === 'SIZE_IN_USE') {
        setBlockedDeleteSize(s);
      } else {
        setErrorMsg(err?.message || 'Failed to delete size.');
      }
    }
  };

  const handleDeactivateInstead = async () => {
    if (!blockedDeleteSize) return;
    setDeactivatingBlocked(true);
    try {
      await apiClient.patch(`/inventory/sizes/${blockedDeleteSize.id}/status`, { isActive: false });
      setSuccessMsg(`Size "${blockedDeleteSize.code}" has been deactivated safely. Historical records remain intact.`);
      setBlockedDeleteSize(null);
      fetchSizes();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to deactivate size.');
    } finally {
      setDeactivatingBlocked(false);
    }
  };

  return (
    <Layout title="Reusable Size Master">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-amber-500" />
              Size Master
            </h1>
            <p className="text-sm text-slate-400">
              Manage standard bottle sizes, volumes, and active statuses across all wine shops
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-amber-950/30 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add New Size
          </button>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code (e.g. Q, P) or display name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  statusFilter === 'all'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Sizes
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  statusFilter === 'active'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Active Only
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  statusFilter === 'inactive'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Inactive Only
              </button>
            </div>

            <button
              onClick={fetchSizes}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Refresh Sizes"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sizes Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading bottle sizes...</div>
          ) : sizes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs space-y-2">
              <p>No bottle sizes found matching the current search criteria.</p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Size
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3 text-center">S.No.</th>
                    <th className="px-4 py-3">Code / Abbr</th>
                    <th className="px-4 py-3">Display Name</th>
                    <th className="px-4 py-3 text-right">Volume</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-center">Referenced In</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {sizes.map((s, idx) => {
                    const ratesCount = s._count?.rates || 0;
                    const stockCount = s._count?.dailyStockRecords || 0;
                    const isReferenced = ratesCount > 0 || stockCount > 0;

                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-950/60 text-amber-400 border border-amber-800/50">
                            {s.code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-white">
                          {s.name}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                          {s.volumeMl ? `${s.volumeMl} ml` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 max-w-xs truncate">
                          {s.description || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span 
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                              isReferenced
                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                            title={`${ratesCount} brand rate(s), ${stockCount} daily stock record(s)`}
                          >
                            <span>{ratesCount} rates</span>
                            <span>•</span>
                            <span>{stockCount} stock</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                              s.isActive
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-800'
                            }`}
                            title="Click to toggle status"
                          >
                            {s.isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                              title="Edit Size"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(s)}
                              className={`p-1.5 rounded-lg transition-colors border ${
                                isReferenced
                                  ? 'bg-slate-800/60 text-slate-500 border-slate-800 hover:text-rose-400'
                                  : 'bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border-rose-900/40'
                              }`}
                              title={isReferenced ? 'Referenced in catalog (safe deactivation advised)' : 'Delete Size'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Quick Navigation Footer */}
        <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Active sizes configured here are dynamically loaded when configuring sizes & rates on the <strong>Daily Stock Sheet</strong> and <strong>Brand Management</strong>.
            </span>
          </div>
          <Link
            to="/daily-stock"
            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold shrink-0"
          >
            Go to Daily Stock Sheet
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Add / Edit Size Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                {editingSize ? `Edit Size: ${editingSize.code}` : 'Add New Bottle Size'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Size Code / Abbreviation <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q, P, N, PINT, 750ML"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500 uppercase"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Short unique abbreviation used in table headers and reports.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Display Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quart (750ml), Pint (375ml), Nip (180ml)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Volume in Milliliters (ml)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 750, 375, 180, 1000"
                  value={volumeMl}
                  onChange={(e) => setVolumeMl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Optional bottle capacity in milliliters. Used for standard sorting.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional size notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-slate-300 font-semibold cursor-pointer">
                  Active (available for brand rate configuration and daily stock sheet)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors font-semibold shadow-md shadow-amber-950/30 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingSize ? 'Update Size' : 'Create Size'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocked Deletion / Safe Deactivation Advising Modal */}
      {blockedDeleteSize && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800/60">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Size Cannot Be Deleted
                </h3>
                <p className="text-xs text-rose-400 font-mono">
                  {blockedDeleteSize.code} — {blockedDeleteSize.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This bottle size is currently linked to{' '}
              <strong className="text-amber-400">{blockedDeleteSize._count?.rates || 0} brand selling rate(s)</strong> and{' '}
              <strong className="text-amber-400">{blockedDeleteSize._count?.dailyStockRecords || 0} historical daily stock record(s)</strong>.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <p className="font-semibold text-slate-200">Recommended Action: Safe Deactivation</p>
              <p className="text-[11px]">
                Permanently deleting this size would corrupt historical financial records. You can safely <strong>deactivate</strong> it so it will no longer appear when configuring new brands or opening sheets.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setBlockedDeleteSize(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
              {blockedDeleteSize.isActive && (
                <button
                  onClick={handleDeactivateInstead}
                  disabled={deactivatingBlocked}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-950/30 transition-all disabled:opacity-50"
                >
                  {deactivatingBlocked ? 'Deactivating...' : 'Deactivate Size Instead'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Sizes;
