import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { Plus, Search, Edit2, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';

const Products = () => {
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
        setBrands(res.data.brands);
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
        setProducts(res.data.products);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Products</h1>
          <p className="text-sm text-slate-400">Configure product catalog, bottle volumes, and box pricing</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-amber-900/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{p.name}</td>
                    <td className="px-6 py-4 text-slate-400">{p.brand?.name || '—'}</td>
                    <td className="px-6 py-4 font-mono text-amber-400 text-xs">{p.bottleVolume}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-200">{p.bottlesPerBox}</td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400">₹{p.defaultBottlePrice}</td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400">₹{p.defaultBoxPrice}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        p.isActive
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                          : 'bg-rose-950 text-rose-400 border-rose-800/50'
                      }`}>
                        {p.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                          p.isActive
                            ? 'bg-rose-950/40 text-rose-300 border-rose-900/40 hover:bg-rose-900/60'
                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/40 hover:bg-emerald-900/60'
                        }`}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 transition-colors border border-rose-800/40"
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
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
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
                  Brand *
                </label>
                <select
                  required
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>Select Brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Royal Stag Whisky"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Bottle Volume *
                  </label>
                  <input
                    type="text"
                    required
                    value={bottleVolume}
                    onChange={(e) => setBottleVolume(e.target.value)}
                    placeholder="e.g. 750 ML, 180 ML, 1 L"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Bottles Per Box *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bottlesPerBox}
                    onChange={(e) => setBottlesPerBox(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Default Bottle Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={defaultBottlePrice}
                    onChange={(e) => setDefaultBottlePrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Default Box Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={defaultBoxPrice}
                    onChange={(e) => setDefaultBoxPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
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
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Products;
