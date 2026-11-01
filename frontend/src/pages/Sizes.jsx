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
  ArrowRight,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const Sizes = () => {
  const { activeTheme } = useTheme();
  const [sizes, setSizes] = useState([]);
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
    initialSortBy: 'volumeMl',
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

  const fetchSizes = async () => {
    setLoading(true);
    setErrorMsg('');
    const reqId = getNextRequestId();
    try {
      const params = {
        ...paginationParams,
        includeInactive: 'true'
      };
      if (statusFilter === 'active') params.isActive = 'true';
      if (statusFilter === 'inactive') params.isActive = 'false';

      const res = await apiClient.get('/inventory/sizes', { params });
      if (isCurrentRequest(reqId) && res.success) {
        setSizes(res.data.sizes || []);
        if (res.data.pagination) {
          setPaginationMeta(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sizes:', err);
      if (isCurrentRequest(reqId)) {
        setErrorMsg(err?.message || 'Failed to load bottle sizes.');
      }
    } finally {
      if (isCurrentRequest(reqId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSizes();
  }, [debouncedSearch, statusFilter, page, limit, sortBy, sortOrder]);

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
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Size Master
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage standard bottle sizes, volumes, and active statuses across all wine shops
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all self-start sm:self-auto hover:opacity-95"
            style={{ backgroundColor: activeTheme.primary }}
          >
            <Plus className="w-4 h-4" />
            Add New Size
          </button>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code (e.g. Q, P) or display name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-theme transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  statusFilter === 'all'
                    ? 'text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={statusFilter === 'all' ? { backgroundColor: activeTheme.primary } : {}}
              >
                All Sizes
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  statusFilter === 'active'
                    ? 'text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={statusFilter === 'active' ? { backgroundColor: activeTheme.primary } : {}}
              >
                Active Only
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  statusFilter === 'inactive'
                    ? 'text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={statusFilter === 'inactive' ? { backgroundColor: activeTheme.primary } : {}}
              >
                Inactive Only
              </button>
            </div>

            <button
              onClick={fetchSizes}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors shrink-0"
              title="Refresh Sizes"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sizes List Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Bottle Sizes ({paginationMeta.totalRecords})
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">Loading bottle sizes...</div>
          ) : sizes.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <p>No bottle sizes found matching the current search criteria.</p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 font-semibold hover:underline"
                style={{ color: activeTheme.primary }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Size
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Size Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
                {sizes.map((s, idx) => {
                  const ratesCount = s._count?.rates || 0;
                  const stockCount = s._count?.dailyStockRecords || 0;
                  const isReferenced = ratesCount > 0 || stockCount > 0;

                  return (
                    <div key={s.id} className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-lg border border-slate-300">
                            #{(page - 1) * limit + idx + 1}
                          </span>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold border"
                            style={{
                              backgroundColor: activeTheme.light,
                              color: activeTheme.primary,
                              borderColor: activeTheme.border
                            }}
                          >
                            {s.code}
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                            <span className="text-[11px] font-mono text-slate-500">
                              {s.volumeMl ? `${s.volumeMl} ml` : 'Standard'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors shrink-0 ${
                            s.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {s.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {s.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      {s.description && (
                        <p className="text-xs text-slate-500">{s.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                        <span 
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                            isReferenced
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {ratesCount} rates • {stockCount} stock
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
                            title="Edit Size"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className={`p-1.5 rounded-lg transition-colors border ${
                              isReferenced
                                ? 'bg-slate-100 text-slate-400 border-slate-200 hover:text-rose-600'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                            }`}
                            title={isReferenced ? 'Referenced in catalog' : 'Delete Size'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block table-grid-wrapper">
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th className="w-16 text-center">S.No.</th>
                      <th 
                        className="w-32 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('code')}
                      >
                        <div className="inline-flex items-center justify-center gap-1">
                          <span>Code / Abbr</span>
                          {sortBy === 'code' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="w-48 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Display Name</span>
                          {sortBy === 'name' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="w-28 text-right cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('volumeMl')}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <span>Volume</span>
                          {sortBy === 'volumeMl' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th>Description</th>
                      <th className="w-36 text-center">Referenced In</th>
                      <th 
                        className="w-28 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('isActive')}
                      >
                        <div className="inline-flex items-center justify-center gap-1">
                          <span>Status</span>
                          {sortBy === 'isActive' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th className="w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-sans">
                    {sizes.map((s, idx) => {
                      const ratesCount = s._count?.rates || 0;
                      const stockCount = s._count?.dailyStockRecords || 0;
                      const isReferenced = ratesCount > 0 || stockCount > 0;

                      return (
                        <tr key={s.id}>
                          <td className="text-center text-slate-500 font-mono">
                            {(page - 1) * limit + idx + 1}
                          </td>
                          <td className="text-center">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold border"
                              style={{
                                backgroundColor: activeTheme.light,
                                color: activeTheme.primary,
                                borderColor: activeTheme.border
                              }}
                            >
                              {s.code}
                            </span>
                          </td>
                          <td className="font-bold text-slate-900">
                            {s.name}
                          </td>
                          <td className="text-right font-mono text-slate-600">
                            {s.volumeMl ? `${s.volumeMl} ml` : '—'}
                          </td>
                          <td className="text-slate-500 max-w-xs truncate">
                            {s.description || '—'}
                          </td>
                          <td className="text-center">
                            <span 
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                                isReferenced
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
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
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
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
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
                                title="Edit Size"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(s)}
                                className={`p-1.5 rounded-lg transition-colors border ${
                                  isReferenced
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:text-rose-600'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
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

        {/* Quick Navigation Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 shadow-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" style={{ color: activeTheme.primary }} />
            <span>
              Active sizes configured here are dynamically loaded when configuring sizes & rates on the <strong className="text-slate-700">Daily Stock Sheet</strong>.
            </span>
          </div>
          <Link
            to="/daily-stock"
            className="inline-flex items-center gap-1 font-semibold shrink-0 hover:underline"
            style={{ color: activeTheme.primary }}
          >
            Go to Daily Stock Sheet
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Add / Edit Size Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5" style={{ color: activeTheme.primary }} />
                {editingSize ? `Edit Size: ${editingSize.code}` : 'Add New Bottle Size'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Size Code / Abbreviation <span style={{ color: activeTheme.primary }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q, P, N, PINT, 750ML"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus-theme uppercase text-xs sm:text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Short unique abbreviation used in table headers and reports.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Display Name <span style={{ color: activeTheme.primary }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quart (750ml), Pint (375ml), Nip (180ml)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus-theme text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Volume in Milliliters (ml)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 750, 375, 180, 1000"
                  value={volumeMl}
                  onChange={(e) => setVolumeMl(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus-theme text-xs sm:text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Optional bottle capacity in milliliters. Used for standard sorting.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional size notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus-theme resize-none text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                />
                <label htmlFor="isActiveToggle" className="text-slate-700 font-semibold cursor-pointer select-none">
                  Active (available for brand rate configuration and daily stock sheet)
                </label>
              </div>

              <div className="flex justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-xs sm:text-sm border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white rounded-xl transition-colors font-semibold shadow-xs disabled:opacity-50 text-xs sm:text-sm hover:opacity-95"
                  style={{ backgroundColor: activeTheme.primary }}
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Size Cannot Be Deleted
                </h3>
                <p className="text-xs text-rose-600 font-mono font-bold">
                  {blockedDeleteSize.code} — {blockedDeleteSize.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This bottle size is currently linked to{' '}
              <strong className="text-slate-900">{blockedDeleteSize._count?.rates || 0} brand selling rate(s)</strong> and{' '}
              <strong className="text-slate-900">{blockedDeleteSize._count?.dailyStockRecords || 0} historical daily stock record(s)</strong>.
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">Recommended Action: Safe Deactivation</p>
              <p className="text-[11px]">
                Permanently deleting this size would corrupt historical financial records. You can safely <strong>deactivate</strong> it so it will no longer appear when configuring new brands or opening sheets.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setBlockedDeleteSize(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
              {blockedDeleteSize.isActive && (
                <button
                  onClick={handleDeactivateInstead}
                  disabled={deactivatingBlocked}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
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
