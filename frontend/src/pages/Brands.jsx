import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Plus, Search, Edit2, CheckCircle, XCircle, AlertCircle, Trash2, Wine, X } from 'lucide-react';

const Brands = () => {
  const { activeTheme } = useTheme();
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/inventory/brands', { params: { search } });
      if (res.success) {
        setBrands(res.data.brands || []);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setName('');
    setDescription('');
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (b) => {
    setEditingBrand(b);
    setName(b.name);
    setDescription(b.description || '');
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (editingBrand) {
        await apiClient.put(`/inventory/brands/${editingBrand.id}`, { name, description });
      } else {
        await apiClient.post('/inventory/brands', { name, description });
      }
      setShowModal(false);
      fetchBrands();
    } catch (err) {
      setError(err?.message || 'Failed to save brand.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (b) => {
    try {
      await apiClient.patch(`/inventory/brands/${b.id}/status`, { isActive: !b.isActive });
      fetchBrands();
    } catch (err) {
      alert(err?.message || 'Failed to toggle brand status.');
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Are you sure you want to delete brand '${b.name}'?`)) {
      return;
    }

    try {
      await apiClient.delete(`/inventory/brands/${b.id}`);
      fetchBrands();
    } catch (err) {
      alert(err?.message || 'Failed to delete brand.');
    }
  };

  return (
    <Layout title="Brand Management">
      <div className="space-y-4 sm:space-y-6">
        {/* Header & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Wine className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Brands Master Catalog
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage wine, whiskey, and spirit brands</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all self-start sm:self-auto hover:opacity-95"
            style={{ backgroundColor: activeTheme.primary }}
          >
            <Plus className="w-4 h-4" />
            Add Brand
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands by name..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus-theme"
            aria-label="Search brands"
          />
        </div>

        {/* Brands List Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Configured Brands ({brands.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">Loading brands...</div>
          ) : brands.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">
              No brands found. Click "Add Brand" to create one.
            </div>
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
                {brands.map((b, idx) => (
                  <div key={b.id} className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-lg border border-slate-300">
                            #{b.serialNo || idx + 1}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm">{b.name}</h3>
                        </div>
                        {b.description && (
                          <p className="text-xs text-slate-500 mt-1">{b.description}</p>
                        )}
                      </div>

                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        b.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}>
                        {b.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-xs text-slate-500">
                        Products: <strong className="text-slate-800 font-mono">{b._count?.products || 0}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(b)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                          title="Edit Brand"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(b)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors border ${
                            b.isActive
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {b.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                          title="Delete Brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block table-grid-wrapper">
                <table className="table-grid">
                  <thead>
                    <tr>
                      <th className="w-16 text-center">S.No.</th>
                      <th className="w-48">Brand Name</th>
                      <th>Description</th>
                      <th className="w-24 text-center">Products</th>
                      <th className="w-28 text-center">Status</th>
                      <th className="w-36 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {brands.map((b, idx) => (
                      <tr key={b.id}>
                        <td className="text-center font-bold text-slate-600 font-mono">
                          #{b.serialNo || idx + 1}
                        </td>
                        <td className="font-bold text-slate-900">{b.name}</td>
                        <td className="text-slate-500">{b.description || '—'}</td>
                        <td className="text-center font-bold text-slate-800">{b._count?.products || 0}</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            b.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}>
                            {b.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {b.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                            title="Edit Brand"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(b)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                              b.isActive
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {b.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(b)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                            title="Delete Brand"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingBrand ? 'Edit Brand' : 'Add New Brand'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Royal Stag"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus-theme"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional brand description..."
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus-theme resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-colors border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all"
                    style={{ backgroundColor: activeTheme.primary }}
                  >
                    {submitting ? 'Saving...' : 'Save Brand'}
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

export default Brands;
