import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Plus, Search, Edit2, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';

const Brands = () => {
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
        setBrands(res.data.brands);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Brands</h1>
          <p className="text-sm text-slate-400">Manage wine and liquor brands in catalog</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-900/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Brand
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands by name..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Brands Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading brands...</div>
        ) : brands.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No brands found. Click "Add Brand" to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Brand Name</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5 text-center">Products</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{b.name}</td>
                    <td className="px-6 py-4 text-slate-400">{b.description || '—'}</td>
                    <td className="px-6 py-4 text-center font-bold text-amber-400">{b._count?.products || 0}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        b.isActive
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                          : 'bg-rose-950 text-rose-400 border-rose-800/50'
                      }`}>
                        {b.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Edit Brand"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(b)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                          b.isActive
                            ? 'bg-rose-950/40 text-rose-300 border-rose-900/40 hover:bg-rose-900/60'
                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/40 hover:bg-emerald-900/60'
                        }`}
                      >
                        {b.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 transition-colors border border-rose-800/40"
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
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingBrand ? 'Edit Brand' : 'Add New Brand'}
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Royal Stag"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional brand description..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-900/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Brands;
