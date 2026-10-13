import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  Store, 
  Edit3, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  MapPin, 
  Calendar, 
  ShieldCheck,
  Building
} from 'lucide-react';

const ShopManagement = () => {
  const { selectedShop, refreshShops, isAdmin } = useAuth();
  const [shopsList, setShopsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  // Edit Modal State
  const [editingShop, setEditingShop] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchShops = async () => {
    setLoading(true);
    setPageError('');
    try {
      const res = await apiClient.get('/auth/shops');
      if (res.success && res.data?.shops) {
        setShopsList(res.data.shops);
      }
    } catch (err) {
      setPageError(err?.message || 'Failed to load shops.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleOpenEdit = (shop) => {
    setEditingShop(shop);
    setEditName(shop.name || '');
    setEditAddress(shop.address || '');
    setEditIsActive(shop.isActive ?? true);
    setModalError('');
  };

  const handleCloseEdit = () => {
    setEditingShop(null);
    setEditName('');
    setEditAddress('');
    setModalError('');
  };

  const handleSaveShop = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setModalError('Shop name cannot be empty. Please enter a valid display name.');
      return;
    }

    if (!editingShop?.id) return;

    setSubmitting(true);
    setModalError('');
    setPageSuccess('');

    try {
      const res = await apiClient.put(`/auth/shops/${editingShop.id}`, {
        name: editName.trim(),
        address: editAddress.trim() || null,
        isActive: editIsActive
      });

      if (res.success) {
        setPageSuccess(`Shop "${res.data.shop.code}" updated successfully to "${res.data.shop.name}".`);
        // Refresh global navbar shop selector and AuthContext
        await refreshShops();
        // Refresh local table
        await fetchShops();
        handleCloseEdit();
      }
    } catch (err) {
      setModalError(err?.message || 'Failed to update shop details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Shop Name & Location Management">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Store className="w-6 h-6 text-amber-500" />
                Shop Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800">
                ADMIN CONSOLE
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Configure business names, locations, and branding across all 3 shops.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchShops}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Refresh Shops List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {pageError && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{pageError}</span>
          </div>
        )}

        {pageSuccess && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{pageSuccess}</span>
          </div>
        )}

        {/* Shops Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-500" />
              Configured Shops ({shopsList.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              Active Shop: <strong className="text-amber-400">{selectedShop?.name}</strong> ({selectedShop?.code})
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-sm">Loading shop configurations...</p>
            </div>
          ) : shopsList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Store className="w-12 h-12 mx-auto text-slate-600 mb-2 opacity-50" />
              <p className="text-sm font-medium">No shops found in database.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold tracking-wider">
                    <th className="py-3.5 px-4">Shop Code</th>
                    <th className="py-3.5 px-4">Configured Shop Name</th>
                    <th className="py-3.5 px-4">Physical Address / Location</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Created At</th>
                    <th className="py-3.5 px-4">Last Modified</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {shopsList.map((shop) => {
                    const isCurrent = selectedShop?.id === shop.id;
                    return (
                      <tr 
                        key={shop.id}
                        className={`hover:bg-slate-800/40 transition-colors ${isCurrent ? 'bg-amber-950/10' : ''}`}
                      >
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-800 text-amber-400 border border-slate-700">
                            {shop.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans font-bold text-white text-sm">
                          <div className="flex items-center gap-2">
                            <span>{shop.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-normal">
                                CURRENT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-400 max-w-xs truncate">
                          {shop.address ? (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              {shop.address}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">No address provided</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            shop.isActive
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border-rose-800'
                          }`}>
                            {shop.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-sans text-[11px]">
                          {new Date(shop.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-sans text-[11px]">
                          {new Date(shop.updatedAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-sans">
                          {isAdmin ? (
                            <button
                              onClick={() => handleOpenEdit(shop)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors border border-slate-700 text-xs font-medium"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              Edit
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Restricted</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Shop Modal */}
        {editingShop && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-amber-500" />
                    Edit Shop Details
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure display name and address for shop code: <strong className="text-amber-400">{editingShop.code}</strong>
                  </p>
                </div>
                <button
                  onClick={handleCloseEdit}
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveShop} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Shop Code (Stable Identifier)
                  </label>
                  <input
                    type="text"
                    value={editingShop.code}
                    disabled
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
                    title="Shop Code is a permanent identifier and cannot be altered"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Permanent system identifier linked to historical transactions.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Shop Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Central Wine Lounge & Spirits"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This name will appear on the header selector, dashboard, and PDF/CSV reports.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Physical Address / Branch Location
                  </label>
                  <textarea
                    rows={3}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="e.g. Main Market Road, City Centre, Near Bus Terminal"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 transition-colors resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="editIsActive" className="text-xs text-slate-300 cursor-pointer font-medium">
                    Shop is Active and available for operations
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {submitting ? 'Saving...' : 'Save Changes'}
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

export default ShopManagement;
