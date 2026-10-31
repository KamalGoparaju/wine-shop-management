import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Plus, Search, Edit2, CheckCircle, XCircle, AlertCircle, Trash2, PackageCheck, X } from 'lucide-react';

const Products = () => {
  const { activeTheme } = useTheme();
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form State
  const [brandId, setBrandId] = useState('');
  const [name, setName] = useState('');
  const [bottleVolume, setBottleVolume] = useState('750 ML');
  const [bottlesPerBox, setBottlesPerBox] = useState(12);
  const [defaultBottlePrice, setDefaultBottlePrice] = useState(150);
  const [defaultBoxPrice, setDefaultBoxPrice] = useState(1800);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchBrands = async () => {
    try {
      const res = await apiClient.get('/inventory/brands', { params: { isActive: 'true' } });
      if (res.success) {
        setBrands(res.data.brands || []);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedBrand) params.brandId = selectedBrand;

      const res = await apiClient.get('/inventory/products', { params });
      if (res.success) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [search, selectedBrand]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setBrandId(brands[0]?.id || '');
    setName('');
    setBottleVolume('750 ML');
    setBottlesPerBox(12);
    setDefaultBottlePrice(150);
    setDefaultBoxPrice(1800);
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setBrandId(p.brandId);
    setName(p.name);
    setBottleVolume(p.bottleVolume);
    setBottlesPerBox(p.bottlesPerBox);
    setDefaultBottlePrice(p.defaultBottlePrice);
    setDefaultBoxPrice(p.defaultBoxPrice);
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        brandId,
        name,
        bottleVolume,
        bottlesPerBox: Number(bottlesPerBox),
        defaultBottlePrice: Number(defaultBottlePrice),
        defaultBoxPrice: Number(defaultBoxPrice)
      };

      if (editingProduct) {
        await apiClient.put(`/inventory/products/${editingProduct.id}`, payload);
      } else {
        await apiClient.post('/inventory/products', payload);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      setError(err?.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (p) => {
    try {
      await apiClient.patch(`/inventory/products/${p.id}/status`, { isActive: !p.isActive });
      fetchProducts();
    } catch (err) {
      alert(err?.message || 'Failed to toggle product status.');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Are you sure you want to delete product '${p.name}'?`)) {
      return;
    }

    try {
      await apiClient.delete(`/inventory/products/${p.id}`);
      fetchProducts();
    } catch (err) {
      alert(err?.message || 'Failed to delete product.');
    }
  };

  return (
    <Layout title="Product Management">
      <div className="space-y-4 sm:space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
              Products Catalog
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Configure product catalog, bottle volumes, and box pricing
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all self-start sm:self-auto hover:opacity-95"
            style={{ backgroundColor: activeTheme.primary }}
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus-theme"
            />
          </div>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs sm:text-sm rounded-xl px-4 py-2.5 focus:outline-none focus-theme cursor-pointer"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Products List Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Configured Products ({products.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">No products found.</div>
          ) : (
            <>
              {/* Mobile Product Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Brand: <strong style={{ color: activeTheme.primary }}>{p.brand?.name || '—'}</strong>
                        </p>
                      </div>

                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        p.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}>
                        {p.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-slate-200 text-center font-mono text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Volume</span>
                        <span className="font-bold" style={{ color: activeTheme.primary }}>{p.bottleVolume}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Btls/Box</span>
                        <span className="text-slate-800">{p.bottlesPerBox}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-sans block">Bottle Rate</span>
                        <span className="text-emerald-600 font-bold">₹{p.defaultBottlePrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500 font-mono">
                        Box: <strong className="text-emerald-600">₹{p.defaultBoxPrice}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`px-2 py-1 text-[10px] font-semibold rounded-lg transition-colors border ${
                            p.isActive
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {p.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Product Name</th>
                      <th className="px-6 py-3.5">Brand</th>
                      <th className="px-6 py-3.5">Volume</th>
                      <th className="px-6 py-3.5 text-center">Bottles/Box</th>
                      <th className="px-6 py-3.5 text-right">Default Bottle Price</th>
                      <th className="px-6 py-3.5 text-right">Default Box Price</th>
                      <th className="px-6 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                        <td className="px-6 py-4 text-slate-600">{p.brand?.name || '—'}</td>
                        <td className="px-6 py-4 font-mono text-xs font-bold" style={{ color: activeTheme.primary }}>{p.bottleVolume}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-800">{p.bottlesPerBox}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-600 font-bold">₹{p.defaultBottlePrice}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-600 font-bold">₹{p.defaultBoxPrice}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}>
                            {p.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                              p.isActive
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {p.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                            title="Delete Product"
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
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
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
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Brand *
                  </label>
                  <select
                    required
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme"
                  >
                    <option value="" disabled>Select Brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Royal Stag Whisky"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Bottle Volume *
                    </label>
                    <input
                      type="text"
                      required
                      value={bottleVolume}
                      onChange={(e) => setBottleVolume(e.target.value)}
                      placeholder="e.g. 750 ML, 180 ML, 1 L"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Bottles Per Box *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={bottlesPerBox}
                      onChange={(e) => setBottlesPerBox(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Default Bottle Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={defaultBottlePrice}
                      onChange={(e) => setDefaultBottlePrice(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Default Box Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={defaultBoxPrice}
                      onChange={(e) => setDefaultBoxPrice(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:outline-none focus-theme font-mono"
                    />
                  </div>
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
                    className="px-4 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all hover:opacity-95"
                    style={{ backgroundColor: activeTheme.primary }}
                  >
                    {submitting ? 'Saving...' : 'Save Product'}
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

export default Products;
