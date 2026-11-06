import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Trash2, 
  Wine, 
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers
} from 'lucide-react';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';

const Brands = () => {
  const { activeTheme } = useTheme();
  const { selectedShop } = useAuth();
  const [brands, setBrands] = useState([]);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [rateScope, setRateScope] = useState('global'); // 'global' | 'shop'
  const [sizeConfigs, setSizeConfigs] = useState({}); // { [sizeId]: { selected: boolean, rate: string } }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serialLookupLoading, setSerialLookupLoading] = useState(false);
  const [serialLookupMessage, setSerialLookupMessage] = useState(null);

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
    paginationParams,
    getNextRequestId,
    isCurrentRequest
  } = usePagination({
    initialPage: 1,
    initialLimit: 25,
    initialSortBy: 'serialNo',
    initialSortOrder: 'asc'
  });

  const [paginationMeta, setPaginationMeta] = useState({
    page: 1,
    limit: 25,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });

  // Fetch active sizes dynamically from Size Master (Single Source of Truth)
  const fetchAvailableSizes = async () => {
    try {
      const res = await apiClient.get('/inventory/sizes', {
        params: { isActive: 'true', sortBy: 'volumeMl', sortOrder: 'desc' }
      });
      if (res.success) {
        setAvailableSizes(res.data.sizes || []);
      }
    } catch (err) {
      console.error('Failed to load sizes from Size Master:', err);
    }
  };

  const fetchBrands = async () => {
    setLoading(true);
    const reqId = getNextRequestId();
    try {
      const res = await apiClient.get('/inventory/brands', { 
        params: paginationParams,
        headers: { 'x-shop-id': selectedShop?.id }
      });
      if (isCurrentRequest(reqId) && res.success) {
        setBrands(res.data.brands || []);
        if (res.data.pagination) {
          setPaginationMeta(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      if (isCurrentRequest(reqId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAvailableSizes();
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [debouncedSearch, page, limit, sortBy, sortOrder, selectedShop?.id]);

  // Helper to extract the selling rate for a specific size on a brand
  const getBrandRateForSize = (brand, sizeId) => {
    if (!brand || !brand.rates || !Array.isArray(brand.rates)) return null;
    const applicable = brand.rates.filter(r => r.sizeId === sizeId && r.isActive);
    if (applicable.length === 0) return null;

    // Prefer shop-specific override if active shop is selected
    if (selectedShop?.id) {
      const shopRate = applicable.find(r => r.shopId === selectedShop.id);
      if (shopRate && shopRate.rate !== undefined && shopRate.rate !== null) {
        return parseFloat(shopRate.rate);
      }
    }

    // Global fallback
    const globalRate = applicable.find(r => !r.shopId);
    if (globalRate && globalRate.rate !== undefined && globalRate.rate !== null) {
      return parseFloat(globalRate.rate);
    }

    // First active rate if no explicit shop or global match
    return parseFloat(applicable[0].rate);
  };

  const handleOpenCreate = async () => {
    setEditingBrand(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setRateScope('global');
    setError('');
    setSerialLookupMessage(null);

    try {
      const serialRes = await apiClient.get('/inventory/brands/next-serial');
      if (serialRes.success && serialRes.data?.nextSerialNo) {
        setSerialNo(serialRes.data.nextSerialNo);
        setSerialLookupMessage({
          type: 'new',
          text: `Serial #${serialRes.data.nextSerialNo} is suggested for your new brand.`
        });
      } else {
        setSerialNo('');
      }
    } catch (err) {
      setSerialNo('');
    }

    const configs = {};
    availableSizes.forEach(s => {
      configs[s.id] = { selected: false, rate: '' };
    });
    setSizeConfigs(configs);
    setShowModal(true);
  };

  const handleOpenEdit = (b) => {
    setEditingBrand(b);
    setName(b.name);
    setDescription(b.description || '');
    setSerialNo(b.serialNo || '');
    setIsActive(b.isActive !== undefined ? b.isActive : true);
    setRateScope('global');
    setError('');
    setSerialLookupMessage({
      type: 'found',
      text: `Editing Brand #${b.serialNo}: "${b.name}".`
    });

    const configs = {};
    availableSizes.forEach(s => {
      const rateVal = getBrandRateForSize(b, s.id);
      if (rateVal !== null && rateVal >= 0) {
        configs[s.id] = {
          selected: true,
          rate: String(rateVal)
        };
      } else {
        configs[s.id] = { selected: false, rate: '' };
      }
    });
    setSizeConfigs(configs);
    setShowModal(true);
  };

  // Auto-fetch brand details & configured rates when user enters a Serial Number
  const handleSerialLookup = async (val) => {
    setSerialNo(val);
    setError('');

    const parsed = parseInt(val, 10);
    if (!val || isNaN(parsed) || parsed <= 0) {
      setEditingBrand(null);
      setSerialLookupMessage(null);
      return;
    }

    setSerialLookupLoading(true);
    try {
      const res = await apiClient.get(`/inventory/brands/by-serial/${parsed}`, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success && res.data?.brand) {
        const b = res.data.brand;
        setEditingBrand(b);
        setName(b.name || '');
        setDescription(b.description || '');
        setIsActive(b.isActive !== undefined ? b.isActive : true);

        // Populate configured sizes and their selling rates!
        const configs = {};
        availableSizes.forEach(s => {
          const rateVal = getBrandRateForSize(b, s.id);
          if (rateVal !== null && rateVal >= 0) {
            configs[s.id] = { selected: true, rate: String(rateVal) };
          } else {
            configs[s.id] = { selected: false, rate: '' };
          }
        });
        setSizeConfigs(configs);

        setSerialLookupMessage({
          type: 'found',
          text: `Found existing Brand #${b.serialNo}: "${b.name}" — rates & details auto-loaded.`
        });
      } else {
        // Serial number does not belong to any existing brand -> available for new brand
        setEditingBrand(null);
        setSerialLookupMessage({
          type: 'new',
          text: `Serial #${parsed} is available for a new brand.`
        });
      }
    } catch (err) {
      console.error('Serial lookup error:', err);
    } finally {
      setSerialLookupLoading(false);
    }
  };

  const toggleSizeSelection = (sizeId) => {
    setSizeConfigs(prev => ({
      ...prev,
      [sizeId]: {
        ...prev[sizeId],
        selected: !prev[sizeId]?.selected
      }
    }));
  };

  const handleRateChange = (sizeId, val) => {
    setSizeConfigs(prev => ({
      ...prev,
      [sizeId]: {
        ...prev[sizeId],
        rate: val
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Brand name is required.');
      return;
    }

    const selectedSizes = Object.entries(sizeConfigs)
      .filter(([_, cfg]) => cfg.selected)
      .map(([sizeId, cfg]) => ({
        sizeId,
        rate: parseFloat(cfg.rate),
        shopId: rateScope === 'shop' ? selectedShop?.id : null
      }));

    if (selectedSizes.length === 0) {
      setError('Please select at least one applicable bottle size for this brand.');
      return;
    }

    for (const s of selectedSizes) {
      if (isNaN(s.rate) || s.rate < 0) {
        setError('Please enter a valid non-negative selling rate for each selected size.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description ? description.trim() : null,
        serialNo: serialNo !== '' && serialNo !== null && serialNo !== undefined ? parseInt(serialNo, 10) : undefined,
        isActive,
        sizes: selectedSizes,
        rateScope
      };

      if (editingBrand) {
        await apiClient.put(`/inventory/brands/${editingBrand.id}`, payload, {
          headers: { 'x-shop-id': selectedShop?.id }
        });
      } else {
        await apiClient.post('/inventory/brands/with-rates', payload, {
          headers: { 'x-shop-id': selectedShop?.id }
        });
      }

      setShowModal(false);
      fetchBrands();
    } catch (err) {
      setError(err?.message || 'Failed to save brand.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSizeFromBrand = async (sizeId, sizeCode) => {
    if (editingBrand) {
      const confirmed = window.confirm(
        `Remove size "${sizeCode}" from brand "${editingBrand.name}"? This size will no longer appear on daily stock sheets for this brand.`
      );
      if (!confirmed) return;

      try {
        const res = await apiClient.delete(`/inventory/brands/${editingBrand.id}/sizes/${sizeId}`, {
          headers: { 'x-shop-id': selectedShop?.id },
          params: { scope: rateScope }
        });
        if (res.success) {
          setSizeConfigs(prev => ({
            ...prev,
            [sizeId]: { selected: false, rate: '' }
          }));
          fetchBrands();
        }
      } catch (err) {
        setError(err?.message || 'Failed to remove size from brand.');
      }
    } else {
      setSizeConfigs(prev => ({
        ...prev,
        [sizeId]: { selected: false, rate: '' }
      }));
    }
  };

  const handleQuickRemoveSizeFromBrand = async (brand, size) => {
    const confirmed = window.confirm(
      `Remove size "${size.code}" from brand "${brand.name}"?`
    );
    if (!confirmed) return;

    try {
      const res = await apiClient.delete(`/inventory/brands/${brand.id}/sizes/${size.id}`, {
        headers: { 'x-shop-id': selectedShop?.id }
      });
      if (res.success) {
        fetchBrands();
      }
    } catch (err) {
      console.error('Failed to quick-remove size from brand:', err);
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
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage wine, whiskey, and spirit brands with bottle sizes and selling rates</p>
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
            placeholder="Search brands by name or S.No..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus-theme"
            aria-label="Search brands"
          />
        </div>

        {/* Brands List Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Configured Brands ({paginationMeta.totalRecords})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">Loading brands and rates...</div>
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
                            #{b.serialNo || (page - 1) * limit + idx + 1}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm font-sans">{b.name}</h3>
                        </div>
                        {b.description && (
                          <p className="text-xs text-slate-500 mt-1 font-sans">{b.description}</p>
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

                    {/* Configured Sizes & Rates Chips */}
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 font-sans">
                        Configured Sizes & Rates:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSizes.map((sz) => {
                          const rate = getBrandRateForSize(b, sz.id);
                          if (rate === null || rate <= 0) return null;
                          return (
                            <span key={sz.id} className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-800">
                              <span className="font-bold font-sans text-slate-900">{sz.code}:</span>
                              <span className="font-semibold text-emerald-700">₹{rate.toFixed(0)}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                        title="Edit Brand & Rates"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(b)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border ${
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
                ))}
              </div>

              {/* Desktop Dynamic Table (>= md) */}
              <div className="hidden md:block table-grid-wrapper overflow-x-auto">
                <table className="table-grid min-w-full font-sans">
                  <thead>
                    <tr>
                      <th 
                        className="w-16 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('serialNo')}
                      >
                        <div className="inline-flex items-center justify-center gap-1">
                          <span>S.No.</span>
                          {sortBy === 'serialNo' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="w-56 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Brand Name</span>
                          {sortBy === 'name' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>

                      {/* Dynamic Size Columns from Size Master */}
                      {availableSizes.map((sz) => (
                        <th key={sz.id} className="text-right px-3 py-2.5 whitespace-nowrap min-w-[90px]">
                          <span title={`${sz.name} (${sz.volumeMl}ml)`}>{sz.name || sz.code}</span>
                        </th>
                      ))}

                      <th 
                        className="w-24 text-center cursor-pointer select-none hover:bg-slate-100 transition-colors"
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
                      <th className="w-36 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {brands.map((b, idx) => (
                      <tr key={b.id}>
                        <td className="text-center font-bold text-slate-600 font-mono">
                          #{b.serialNo || (page - 1) * limit + idx + 1}
                        </td>
                        <td className="font-bold text-slate-900">
                          <div>
                            <span>{b.name}</span>
                            {b.description && (
                              <p className="text-[11px] text-slate-400 font-normal truncate max-w-[220px]" title={b.description}>
                                {b.description}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Dynamic Size Rate Cells */}
                        {availableSizes.map((sz) => {
                          const rate = getBrandRateForSize(b, sz.id);
                          return (
                            <td key={sz.id} className="text-right font-mono px-3 py-2 whitespace-nowrap">
                              {rate !== null && rate > 0 ? (
                                <div className="inline-flex items-center justify-end gap-1 group">
                                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md text-xs">
                                    ₹{rate.toFixed(0)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickRemoveSizeFromBrand(b, sz)}
                                    title={`Remove ${sz.code} from ${b.name}`}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-sans font-bold select-none">—</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            b.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}>
                            {b.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {b.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right space-x-1.5 whitespace-nowrap font-sans">
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                            title="Edit Brand & Rates"
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
                        </td>
                      </tr>
                    ))}
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

        {/* Create / Edit Brand & Sizes Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: activeTheme.light, color: activeTheme.primary }}
                  >
                    {editingBrand ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 font-sans">
                      {editingBrand ? 'Edit Brand & Sizes' : 'Add New Brand & Sizes'}
                    </h3>
                    <p className="text-xs text-slate-500 font-sans">Configure brand details and bottle selling rates</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Brand Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Royal Stag"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus-theme font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Serial No. (S.No.)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={serialNo}
                        onChange={(e) => handleSerialLookup(e.target.value)}
                        placeholder="Auto"
                        className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus-theme font-mono font-bold ${
                          editingBrand ? 'border-indigo-400 bg-indigo-50/30 text-indigo-900' : 'border-slate-300 text-slate-900'
                        }`}
                      />
                      {serialLookupLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {serialLookupMessage && (
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 font-sans ${
                    serialLookupMessage.type === 'found'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {serialLookupMessage.type === 'found' ? (
                      <CheckCircle className="w-4 h-4 shrink-0 text-indigo-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    )}
                    <span>{serialLookupMessage.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Premium blended whiskey"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus-theme font-sans"
                  />
                </div>

                {/* Active Status Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="brandIsActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="brandIsActive" className="text-xs text-slate-700 cursor-pointer select-none font-medium font-sans">
                    Active Brand in Catalog
                  </label>
                </div>

                {/* Applicable Sizes & Rates Configuration */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">
                      Applicable Sizes & Rates (₹) *
                    </label>
                    <span className="text-[11px] text-slate-500">Select applicable sizes</span>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {availableSizes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-3 text-center">No active sizes found in Size Master.</p>
                    ) : (
                      availableSizes.map((sz) => {
                        const cfg = sizeConfigs[sz.id] || { selected: false, rate: '' };
                        return (
                          <div
                            key={sz.id}
                            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-between gap-2 sm:gap-3 ${
                              cfg.selected
                                ? 'border-slate-300 shadow-xs'
                                : 'bg-slate-50/60 border-slate-200 opacity-60'
                            }`}
                            style={cfg.selected ? { backgroundColor: activeTheme.light, borderColor: activeTheme.border } : {}}
                          >
                            <label className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                              <input
                                type="checkbox"
                                checked={cfg.selected}
                                onChange={() => toggleSizeSelection(sz.id)}
                                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                              />
                              <div>
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="font-bold text-slate-900 text-sm font-mono">{sz.code}</span>
                                  <span className="text-xs text-slate-500">({sz.name})</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{sz.volumeMl}ml</span>
                              </div>
                            </label>

                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="text-xs text-slate-500 font-bold">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={!cfg.selected}
                                value={cfg.rate}
                                onChange={(e) => handleRateChange(sz.id, e.target.value)}
                                placeholder="Rate"
                                className={`w-24 sm:w-28 bg-white border rounded-lg py-1.5 px-2 text-right font-mono text-sm focus:outline-none transition-all ${
                                  cfg.selected
                                    ? 'border-slate-300 text-slate-900 focus-theme font-bold'
                                    : 'border-slate-200 text-slate-400 opacity-40'
                                }`}
                              />
                              <span className="text-[11px] text-slate-500 hidden xs:inline font-sans">/ btl</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSizeFromBrand(sz.id, sz.code);
                                }}
                                title={`Remove ${sz.code} size from this brand`}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Rate Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                    <label
                      className="p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center gap-2"
                      style={rateScope === 'global' ? { backgroundColor: activeTheme.light, borderColor: activeTheme.border, color: activeTheme.primary } : {}}
                    >
                      <input
                        type="radio"
                        name="brandRateScope"
                        value="global"
                        checked={rateScope === 'global'}
                        onChange={() => setRateScope('global')}
                      />
                      <span className="truncate font-medium">All Shops (Global)</span>
                    </label>

                    <label
                      className="p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center gap-2"
                      style={rateScope === 'shop' ? { backgroundColor: activeTheme.light, borderColor: activeTheme.border, color: activeTheme.primary } : {}}
                    >
                      <input
                        type="radio"
                        name="brandRateScope"
                        value="shop"
                        checked={rateScope === 'shop'}
                        onChange={() => setRateScope('shop')}
                      />
                      <span className="truncate font-medium">{selectedShop?.name || 'Active Shop'}</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100 font-sans">
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
                    className="px-5 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all"
                    style={{ backgroundColor: activeTheme.primary }}
                  >
                    {submitting ? 'Saving...' : editingBrand ? 'Update Brand' : 'Save Brand'}
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
