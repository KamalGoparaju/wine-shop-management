import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { activeTheme } = useTheme();
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
        await refreshShops();
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
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Store className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
                Shop Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                ADMIN CONSOLE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Configure business names, locations, and branding across all 3 shops.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchShops}
              className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors"
              title="Refresh Shops List"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {pageError && (
          <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-rose-600" />
            <span>{pageError}</span>
          </div>
        )}

        {pageSuccess && (
          <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-emerald-600" />
            <span>{pageSuccess}</span>
          </div>
        )}

        {/* Shops Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4" style={{ color: activeTheme.primary }} />
              Configured Shops ({shopsList.length})
            </h2>
            <span className="text-[11px] text-slate-500">
              Active: <strong style={{ color: activeTheme.primary }}>{selectedShop?.name}</strong> ({selectedShop?.code})
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: activeTheme.primary }} />
              <p className="text-sm">Loading shop configurations...</p>
            </div>
          ) : shopsList.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Store className="w-12 h-12 mx-auto text-slate-400 mb-2 opacity-50" />
              <p className="text-sm font-medium">No shops found in database.</p>
            </div>
          ) : (
            <>
              {/* Mobile Shop Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
                {shopsList.map((shop) => {
                  const isCurrent = selectedShop?.id === shop.id;
                  return (
                    <div 
                      key={shop.id} 
                      className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                        isCurrent 
                          ? 'border shadow-xs' 
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                      style={isCurrent ? { backgroundColor: activeTheme.light, borderColor: activeTheme.border } : {}}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-300">
                              {shop.code}
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm">{shop.name}</h3>
                          </div>
                          {isCurrent && (
                            <span
                              className="inline-block text-[10px] border px-1.5 py-0.5 rounded font-mono font-medium mt-1 bg-white"
                              style={{ color: activeTheme.primary, borderColor: activeTheme.border }}
                            >
                              CURRENT ACTIVE SHOP
                            </span>
                          )}
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          shop.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}>
                          {shop.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{shop.address || 'No physical address configured'}</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                        <span>Updated: {new Date(shop.updatedAt).toLocaleDateString()}</span>

                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEdit(shop)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 text-xs font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs text-slate-700">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold tracking-wider">
                      <th className="py-3.5 px-4">Shop Code</th>
                      <th className="py-3.5 px-4">Configured Shop Name</th>
                      <th className="py-3.5 px-4">Physical Address / Location</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4">Created At</th>
                      <th className="py-3.5 px-4">Last Modified</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {shopsList.map((shop) => {
                      const isCurrent = selectedShop?.id === shop.id;
                      return (
                        <tr 
                          key={shop.id}
                          className={`hover:bg-slate-50/80 transition-colors ${isCurrent ? 'bg-slate-50/80' : ''}`}
                          style={isCurrent ? { backgroundColor: activeTheme.light } : {}}
                        >
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-300">
                              {shop.code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-sans font-bold text-slate-900 text-sm">
                            <div className="flex items-center gap-2">
                              <span>{shop.name}</span>
                              {isCurrent && (
                                <span
                                  className="text-[10px] border px-1.5 py-0.5 rounded font-mono font-normal bg-white"
                                  style={{ color: activeTheme.primary, borderColor: activeTheme.border }}
                                >
                                  CURRENT
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-sans text-slate-600 max-w-xs truncate">
                            {shop.address ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {shop.address}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No address provided</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              shop.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-rose-50 text-rose-700 border-rose-300'
                            }`}>
                              {shop.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-sans text-[11px]">
                            {new Date(shop.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-sans text-[11px]">
                            {new Date(shop.updatedAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-sans">
                            {isAdmin ? (
                              <button
                                onClick={() => handleOpenEdit(shop)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 text-xs font-medium"
                              >
                                <Edit3 className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
                                Edit
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Restricted</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Edit Shop Modal */}
        {editingShop && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="p-2 border rounded-xl"
                    style={{
                      backgroundColor: activeTheme.light,
                      borderColor: activeTheme.border,
                      color: activeTheme.primary
                    }}
                  >
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">Edit Shop Details</h3>
                    <p className="text-xs font-mono font-bold" style={{ color: activeTheme.primary }}>Code: {editingShop.code}</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseEdit}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveShop} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">
                    Shop Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Royal Wine & Liquor Shop 1"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus-theme text-xs sm:text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This name will appear on the navigation bar, closing statements, and printed reports.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">
                    Physical Address / Location
                  </label>
                  <textarea
                    rows={3}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="e.g. Plot 42, Main Road, Market Complex..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus-theme resize-none text-xs sm:text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="editIsActive" className="text-slate-700 font-semibold cursor-pointer select-none">
                    Active Shop (available for switching and sales)
                  </label>
                </div>

                <div className="flex justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 transition-all hover:opacity-95"
                    style={{ backgroundColor: activeTheme.primary }}
                  >
                    <Save className="w-4 h-4" />
                    <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
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
