import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  Calendar, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Info,
  TrendingUp,
  Package,
  ArrowRight,
  Download,
  FileText,
  FileSpreadsheet,
  Plus,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadAuthenticatedFile } from '../utils/download';

const DailyStock = () => {
  const { selectedShop } = useAuth();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [meta, setMeta] = useState({});

  // Add Brand & Sizes Modal state
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [availableSizes, setAvailableSizes] = useState([]);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandSerialNo, setNewBrandSerialNo] = useState('');
  const [newBrandDescription, setNewBrandDescription] = useState('');
  const [newBrandIsActive, setNewBrandIsActive] = useState(true);
  const [newBrandRateScope, setNewBrandRateScope] = useState('global');
  const [sizeConfigs, setSizeConfigs] = useState({});

  const handleExportPdf = async () => {
    if (!selectedShop?.id) return;
    setExportingPdf(true);
    setError('');
    try {
      await downloadAuthenticatedFile('/inventory/daily-stock/export/pdf', {
        date: businessDate,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `daily_stock_${selectedShop.code || 'SHOP'}_${businessDate}.pdf`);
    } catch (err) {
      console.error('Export PDF error:', err);
      setError('Failed to generate daily stock PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedShop?.id) return;
    setExportingCsv(true);
    setError('');
    try {
      await downloadAuthenticatedFile('/inventory/daily-stock/export/csv', {
        date: businessDate,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `daily_stock_${selectedShop.code || 'SHOP'}_${businessDate}.csv`);
    } catch (err) {
      console.error('Export CSV error:', err);
      setError('Failed to export daily stock CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedShop?.id) return;
    setExportingExcel(true);
    setError('');
    try {
      await downloadAuthenticatedFile('/inventory/daily-stock/export/excel', {
        date: businessDate,
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        shopCode: selectedShop.code
      }, `daily_stock_${selectedShop.code || 'SHOP'}_${businessDate}.xlsx`);
    } catch (err) {
      console.error('Export Excel error:', err);
      setError('Failed to export daily stock Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  const fetchDailySheet = async (date) => {
    if (!selectedShop?.id) return;
    const currentShopId = selectedShop.id;
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await apiClient.get('/inventory/daily-stock', {
        params: { date, shopId: currentShopId },
        headers: { 'x-shop-id': currentShopId }
      });

      if (res.success && res.data.shopId === currentShopId) {
        setItems(res.data.records || []);
        setMeta({
          isNewDay: res.data.isNewDay,
          isInitialSetup: res.data.isInitialSetup,
          hasDateGap: res.data.hasDateGap,
          gapWarning: res.data.gapWarning,
          isLocked: res.data.isLocked,
          isCompleted: res.data.isCompleted,
          previousDate: res.data.previousDate
        });
      }
    } catch (err) {
      setError(err?.message || 'Failed to load daily stock sheet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const currentShopId = selectedShop?.id;

    if (!currentShopId) return;

    // Reset table immediately on shop switch to clear stale data
    setItems([]);
    setLoading(true);
    setError('');
    setSuccessMsg('');

    apiClient.get('/inventory/daily-stock', {
      params: { date: businessDate, shopId: currentShopId },
      headers: { 'x-shop-id': currentShopId }
    })
      .then((res) => {
        // Prevent late API responses from overwriting the new shop's data
        if (!isCurrent) return;
        if (res.success && res.data.shopId === currentShopId) {
          setItems(res.data.records || []);
          setMeta({
            isNewDay: res.data.isNewDay,
            isInitialSetup: res.data.isInitialSetup,
            hasDateGap: res.data.hasDateGap,
            gapWarning: res.data.gapWarning,
            isLocked: res.data.isLocked,
            isCompleted: res.data.isCompleted,
            previousDate: res.data.previousDate
          });
        }
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err?.message || 'Failed to load daily stock sheet.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [businessDate, selectedShop?.id]);

  const handleOpeningChange = (index, val) => {
    const nextItems = [...items];
    const opening = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    const opNum = val === '' ? 0 : opening;
    const indNum = parseInt(nextItems[index].indentStock, 10) || 0;
    const total = opNum + indNum;
    const hasClosing = nextItems[index].closingStock !== '' && nextItems[index].closingStock !== null && nextItems[index].closingStock !== undefined;
    const clNum = hasClosing ? parseInt(nextItems[index].closingStock, 10) || 0 : 0;
    const sale = hasClosing ? Math.max(0, total - clNum) : 0;
    const rate = parseFloat(nextItems[index].bottleRate) || 0;
    const stockValue = total * rate;
    const saleAmount = hasClosing ? sale * rate : 0;

    nextItems[index] = {
      ...nextItems[index],
      openingStock: opening,
      totalStock: total,
      stockValue,
      saleCount: sale,
      saleAmount,
      closingError: hasClosing && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
    };
    setItems(nextItems);
  };

  const handleIndentChange = (index, val) => {
    const nextItems = [...items];
    const indent = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    const indNum = val === '' ? 0 : indent;
    const opNum = parseInt(nextItems[index].openingStock, 10) || 0;
    const total = opNum + indNum;
    const hasClosing = nextItems[index].closingStock !== '' && nextItems[index].closingStock !== null && nextItems[index].closingStock !== undefined;
    const clNum = hasClosing ? parseInt(nextItems[index].closingStock, 10) || 0 : 0;
    const sale = hasClosing ? Math.max(0, total - clNum) : 0;
    const rate = parseFloat(nextItems[index].bottleRate) || 0;
    const stockValue = total * rate;
    const saleAmount = hasClosing ? sale * rate : 0;

    nextItems[index] = {
      ...nextItems[index],
      indentStock: indent,
      totalStock: total,
      stockValue,
      saleCount: sale,
      saleAmount,
      closingError: hasClosing && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
    };
    setItems(nextItems);
  };

  const handleClosingChange = (index, val) => {
    const nextItems = [...items];
    const total = nextItems[index].totalStock;
    const hasVal = val !== '';
    const closing = hasVal ? Math.max(0, parseInt(val, 10) || 0) : '';
    const clNum = hasVal ? closing : 0;
    const sale = hasVal ? Math.max(0, total - clNum) : 0;
    const rate = parseFloat(nextItems[index].bottleRate) || 0;
    const saleAmount = hasVal ? sale * rate : 0;

    nextItems[index] = {
      ...nextItems[index],
      closingStock: closing,
      saleCount: sale,
      saleAmount,
      closingError: hasVal && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
    };
    setItems(nextItems);
  };

  const handleExtraAmountChange = (index, val) => {
    const nextItems = [...items];
    nextItems[index] = {
      ...nextItems[index],
      extraAmount: val
    };
    setItems(nextItems);
  };

  const incompleteCount = items.filter(
    it => it.closingStock === '' || it.closingStock === null || it.closingStock === undefined
  ).length;

  const invalidRowsCount = items.filter(
    it => it.closingError !== null && it.closingError !== undefined
  ).length;

  const handleSave = async (status = 'DRAFT') => {
    setError('');
    setSuccessMsg('');

    if (invalidRowsCount > 0) {
      setError(`Cannot save: ${invalidRowsCount} brand row(s) have closing count exceeding total stock.`);
      return;
    }

    if (status === 'COMPLETED' && incompleteCount > 0) {
      setError(`Cannot finalize: ${incompleteCount} brand row(s) are pending physical closing counts. Please enter closing counts for all rows or save as Draft.`);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        businessDate,
        status,
        shopId: selectedShop?.id,
        items: items.map(item => {
          const op = parseInt(item.openingStock, 10) || 0;
          const ind = parseInt(item.indentStock, 10) || 0;
          const tot = op + ind;
          const hasCl = item.closingStock !== '' && item.closingStock !== null && item.closingStock !== undefined;
          const cl = hasCl ? parseInt(item.closingStock, 10) : 0;
          return {
            brandId: item.brandId,
            sizeId: item.sizeId,
            openingStock: op,
            indentStock: ind,
            totalStock: tot,
            closingStock: cl,
            bottleRate: parseFloat(item.bottleRate) || 0,
            extraAmount: parseFloat(item.extraAmount) || 0,
            notes: item.notes || ''
          };
        })
      };

      const res = await apiClient.post('/inventory/daily-stock', payload, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success) {
        setSuccessMsg(
          `Daily stock sheet ${status === 'COMPLETED' ? 'finalized' : 'saved as draft'} successfully for ${selectedShop?.name || 'Shop'} (${businessDate})! Saved Total Business: ₹${res.data.totalBusiness}`
        );
        fetchDailySheet(businessDate);
      }
    } catch (err) {
      setError(err?.message || 'Failed to save daily stock entries.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddBrandModal = async () => {
    setNewBrandName('');
    setNewBrandDescription('');
    setNewBrandIsActive(true);
    setNewBrandRateScope('global');
    setModalError('');
    setShowAddBrandModal(true);
    setModalLoading(true);

    try {
      const [sizesRes, serialRes] = await Promise.all([
        apiClient.get('/inventory/sizes'),
        apiClient.get('/inventory/brands/next-serial')
      ]);

      const sizes = sizesRes?.success ? (sizesRes.data.sizes || []) : [];
      setAvailableSizes(sizes);

      const initialConfigs = {};
      sizes.forEach(s => {
        initialConfigs[s.id] = { selected: true, rate: '' };
      });
      setSizeConfigs(initialConfigs);

      if (serialRes?.success && serialRes.data?.nextSerialNo) {
        setNewBrandSerialNo(serialRes.data.nextSerialNo);
      }
    } catch (err) {
      console.error('Failed to load sizes or serial number:', err);
      setModalError('Failed to initialize brand form. Please try again.');
    } finally {
      setModalLoading(false);
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

  const handleCreateBrandSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!newBrandName.trim()) {
      setModalError('Brand name is required.');
      return;
    }

    const selectedSizes = Object.entries(sizeConfigs)
      .filter(([_, cfg]) => cfg.selected)
      .map(([sizeId, cfg]) => ({
        sizeId,
        rate: parseFloat(cfg.rate),
        shopId: newBrandRateScope === 'shop' ? selectedShop?.id : null
      }));

    if (selectedSizes.length === 0) {
      setModalError('Please select at least one applicable size.');
      return;
    }

    for (const s of selectedSizes) {
      if (isNaN(s.rate) || s.rate < 0) {
        setModalError('Please enter a valid non-negative selling rate for each selected size.');
        return;
      }
    }

    setModalSubmitting(true);
    try {
      const payload = {
        name: newBrandName.trim(),
        description: newBrandDescription.trim(),
        serialNo: newBrandSerialNo !== '' ? parseInt(newBrandSerialNo, 10) : undefined,
        isActive: newBrandIsActive,
        sizes: selectedSizes
      };

      const res = await apiClient.post('/inventory/brands/with-rates', payload, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success) {
        setShowAddBrandModal(false);
        setSuccessMsg(
          `Brand "${newBrandName.trim()}" added successfully with ${selectedSizes.length} configured size(s)! Rows are now available on the Daily Stock Sheet.`
        );
        fetchDailySheet(businessDate);
      }
    } catch (err) {
      setModalError(err?.message || 'Failed to create brand.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Authoritative calculations for summary
  const totalOpening = items.reduce((acc, curr) => acc + (parseInt(curr.openingStock, 10) || 0), 0);
  const totalIndent = items.reduce((acc, curr) => acc + (parseInt(curr.indentStock, 10) || 0), 0);
  const totalStockCount = items.reduce((acc, curr) => acc + (parseInt(curr.totalStock, 10) || 0), 0);
  const totalClosing = items.reduce((acc, curr) => {
    const hasCl = curr.closingStock !== '' && curr.closingStock !== null && curr.closingStock !== undefined;
    return acc + (hasCl ? parseInt(curr.closingStock, 10) : 0);
  }, 0);
  const totalSaleBottles = items.reduce((acc, curr) => acc + (parseInt(curr.saleCount, 10) || 0), 0);
  const totalStockValue = items.reduce((acc, curr) => acc + ((parseInt(curr.totalStock, 10) || 0) * (parseFloat(curr.bottleRate) || 0)), 0);
  const totalBusinessAmount = items.reduce((acc, curr) => acc + (parseFloat(curr.saleAmount) || 0), 0);
  const totalExtraAmount = items.reduce((acc, curr) => acc + (parseFloat(curr.extraAmount) || 0), 0);

  return (
    <Layout title="Daily Stock Calculation Sheet">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-amber-500" />
                Daily Stock Sheet
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                meta.isLocked
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : meta.isCompleted
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {meta.isLocked ? 'LOCKED / CLOSED' : meta.isCompleted ? 'FINALIZED' : 'DRAFT / IN PROGRESS'}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Active Shop: <strong className="text-amber-400">{selectedShop?.name || 'Loading...'}</strong> ({selectedShop?.code})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => fetchDailySheet(businessDate)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Reload Sheet"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Actions */}
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf || loading || items.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 border border-slate-700 font-medium text-xs rounded-xl transition-all disabled:opacity-50"
                title="Download Daily Stock Sheet as PDF"
              >
                <FileText className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-bounce' : ''}`} />
                {exportingPdf ? 'Generating...' : 'PDF'}
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exportingExcel || loading || items.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 border border-slate-700 font-medium text-xs rounded-xl transition-all disabled:opacity-50"
                title="Download Daily Stock Sheet as Excel (.xlsx)"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${exportingExcel ? 'animate-bounce' : ''}`} />
                {exportingExcel ? 'Exporting...' : 'Excel'}
              </button>

              <button
                onClick={handleExportCsv}
                disabled={exportingCsv || loading || items.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-slate-700 font-medium text-xs rounded-xl transition-all disabled:opacity-50"
                title="Export Daily Stock Sheet to CSV"
              >
                <Download className={`w-3.5 h-3.5 ${exportingCsv ? 'animate-bounce' : ''}`} />
                {exportingCsv ? 'Exporting...' : 'CSV'}
              </button>
            </div>

            {!meta.isLocked && (
              <>
                <button
                  onClick={handleOpenAddBrandModal}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/30 transition-all"
                  title="Add New Brand & Configure Sizes"
                >
                  <Plus className="w-4 h-4" />
                  Add New Brand
                </button>

                <button
                  onClick={() => handleSave('DRAFT')}
                  disabled={saving || loading || items.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
                  title="Save current progress as draft"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>

                <button
                  onClick={() => handleSave('COMPLETED')}
                  disabled={saving || loading || items.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50"
                  title="Finalize sheet with verified closing counts"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? 'Finalizing...' : 'Finalize Sheet'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Informational Alerts */}
        {meta.isLocked && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>Locked Day:</strong> Daily closing has already been executed for this shop and date. Modifying stock records is restricted.
            </span>
          </div>
        )}

        {meta.isInitialSetup && (
          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>
              <strong>Initial Opening Setup:</strong> No prior business records found for {selectedShop?.name}. You can enter initial opening balances in the Opening column below.
            </span>
          </div>
        )}

        {meta.isNewDay && meta.previousDate && !meta.hasDateGap && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Auto Carry-Forward Active:</strong> Opening bottle balances for this sheet were automatically initialized from previous closing records dated <strong>{meta.previousDate}</strong>.
            </span>
          </div>
        )}

        {meta.hasDateGap && meta.gapWarning && (
          <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-600/50 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{meta.gapWarning}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quick KPI Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Opening</span>
            <p className="text-lg font-bold text-white font-mono mt-0.5">{totalOpening}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Indent</span>
            <p className="text-lg font-bold text-indigo-400 font-mono mt-0.5">{totalIndent}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-slate-400">Available Bottles</span>
            <p className="text-lg font-bold text-white font-mono mt-0.5">{totalStockCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total Closing</span>
              {incompleteCount > 0 && (
                <span className="text-[9px] text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded font-sans">
                  {incompleteCount} pending
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{totalClosing}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-amber-400">Bottles Sold</span>
            <p className="text-lg font-bold text-amber-400 font-mono mt-0.5">{totalSaleBottles}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-amber-300">Total Stock Value</span>
            <p className="text-lg font-bold text-amber-300 font-mono mt-0.5">₹{totalStockValue.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 border border-amber-500/30 p-3 rounded-xl bg-gradient-to-br from-slate-900 to-amber-950/30">
            <span className="text-[10px] font-bold uppercase text-emerald-400">Total Business</span>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">₹{totalBusinessAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Action strip directly above stock table */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Stock Inventory ({items.length} row{items.length === 1 ? '' : 's'})
            </span>
            <span className="text-xs text-slate-600">•</span>
            <span className="text-xs text-slate-400 font-mono">
              {businessDate}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!meta.isLocked && (
              <button
                onClick={handleOpenAddBrandModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-950/20 transition-all"
                title="Add New Brand & Configure Sizes"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Brand
              </button>
            )}

            <Link
              to="/brands"
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700/60 transition-colors"
              title="Navigate to Brand Management page"
            >
              Brand Management →
            </Link>
          </div>
        </div>

        {/* Tabular Daily Stock Sheet */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Loading daily stock sheet...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm space-y-3">
              <Package className="w-10 h-10 mx-auto text-slate-600" />
              <p>No brands or sizes configured for this shop.</p>
              {!meta.isLocked && (
                <button
                  onClick={handleOpenAddBrandModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Brand
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3 text-center">S.No.</th>
                    <th className="px-4 py-3">Brand Name</th>
                    <th className="px-3 py-3 text-center">Size</th>
                    <th className="px-3 py-3 text-center">Opening</th>
                    <th className="px-3 py-3 text-center">Indent</th>
                    <th className="px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">Closing</th>
                    <th className="px-3 py-3 text-center text-amber-400">Sale</th>
                    <th className="px-3.5 py-3 text-right">Rate</th>
                    <th className="px-3.5 py-3 text-right text-amber-300">Stock Value (₹)</th>
                    <th className="px-4 py-3 text-right text-emerald-400">Amount (₹)</th>
                    <th className="px-3 py-3 text-right text-slate-400" title="Informational only; excluded from financial totals">
                      Extra Amt*
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {items.map((row, idx) => {
                    const isInitialRow = meta.isInitialSetup || row.isInitialOpening;
                    const isPendingClosing = row.closingStock === '' || row.closingStock === null || row.closingStock === undefined;

                    return (
                      <tr key={row.id || idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3.5 py-3 text-center font-bold text-slate-400">
                          {row.brand?.serialNo || idx + 1}
                        </td>
                        <td className="px-4 py-3 font-sans font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{row.brand?.name}</span>
                            {isPendingClosing && !meta.isLocked && (
                              <span className="text-[9px] bg-amber-950/70 text-amber-400 border border-amber-800/50 px-1.5 py-0.2 rounded font-sans font-semibold">
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-amber-400">
                          {row.size?.code}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-300">
                          {isInitialRow && !meta.isLocked ? (
                            <input
                              type="number"
                              min="0"
                              value={row.openingStock}
                              onChange={(e) => handleOpeningChange(idx, e.target.value)}
                              placeholder="0"
                              className="w-16 bg-slate-950 border border-indigo-700/60 rounded-lg py-1 px-1.5 text-center text-indigo-300 focus:outline-none focus:border-indigo-400 font-bold"
                              title="Enter initial opening balance"
                            />
                          ) : (
                            <span>{row.openingStock}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.indentStock}
                            onChange={(e) => handleIndentChange(idx, e.target.value)}
                            disabled={meta.isLocked}
                            className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-1 px-1.5 text-center text-white focus:outline-none focus:border-amber-500 font-bold disabled:opacity-50"
                          />
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-white">
                          {row.totalStock}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.closingStock}
                            onChange={(e) => handleClosingChange(idx, e.target.value)}
                            disabled={meta.isLocked}
                            placeholder="Count"
                            className={`w-16 bg-slate-950 border rounded-lg py-1 px-1.5 text-center font-bold focus:outline-none disabled:opacity-50 ${
                              row.closingError
                                ? 'border-rose-500 text-rose-400 bg-rose-950/20 focus:border-rose-400'
                                : 'border-slate-800 text-emerald-400 focus:border-amber-500'
                            }`}
                          />
                          {row.closingError && (
                            <div className="text-[9px] text-rose-400 font-sans mt-0.5 whitespace-nowrap">
                              {row.closingError}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-amber-400">
                          {isPendingClosing ? '—' : row.saleCount}
                        </td>
                        <td className="px-3.5 py-3 text-right text-slate-400">
                          ₹{row.bottleRate}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold text-amber-300 font-sans">
                          ₹{((parseInt(row.totalStock, 10) || 0) * (parseFloat(row.bottleRate) || 0)).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400 font-sans">
                          ₹{parseFloat(row.saleAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.extraAmount}
                            onChange={(e) => handleExtraAmountChange(idx, e.target.value)}
                            disabled={meta.isLocked}
                            placeholder="0.00"
                            className="w-20 bg-slate-950 border border-slate-800 rounded-lg py-1 px-1.5 text-right text-slate-400 focus:outline-none focus:border-amber-500 text-xs disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Table Footer Totals */}
                <tfoot className="bg-slate-950 text-slate-200 font-bold border-t-2 border-slate-800 font-mono">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-sans text-xs uppercase text-amber-400 font-bold">
                      Daily Totals:
                    </td>
                    <td className="px-3 py-3 text-center text-slate-300">{totalOpening}</td>
                    <td className="px-3 py-3 text-center text-indigo-400">{totalIndent}</td>
                    <td className="px-3 py-3 text-center text-white">{totalStockCount}</td>
                    <td className="px-3 py-3 text-center text-emerald-400">{totalClosing}</td>
                    <td className="px-3 py-3 text-center text-amber-400 text-sm font-extrabold">{totalSaleBottles}</td>
                    <td className="px-3.5 py-3 text-right text-slate-400">—</td>
                    <td className="px-3.5 py-3 text-right text-amber-300 text-sm font-extrabold font-sans">
                      ₹{totalStockValue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 text-sm font-extrabold font-sans">
                      ₹{totalBusinessAmount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400 text-xs font-sans">
                      ₹{totalExtraAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer Navigation & Closing Prompt */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs text-slate-400">
            * <strong className="text-slate-300">Extra Amount:</strong> Strictly informational field. 100% excluded from all financial and sales amount calculations.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors"
            >
              Go to Dashboard & Close Business
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Add New Brand & Sizes Modal */}
      {showAddBrandModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add New Brand & Sizes</h3>
                  <p className="text-xs text-slate-400">Configure brand details and selling rates</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddBrandModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            {modalLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                Loading size master and serial counter...
              </div>
            ) : (
              <form onSubmit={handleCreateBrandSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Brand Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      placeholder="e.g. Blenders Pride"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1" title="Auto-assigned sequential serial number">
                      Serial No. (S.No.)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBrandSerialNo}
                      onChange={(e) => setNewBrandSerialNo(e.target.value)}
                      placeholder="Auto"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newBrandDescription}
                    onChange={(e) => setNewBrandDescription(e.target.value)}
                    placeholder="e.g. Premium blended whiskey"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-600 text-xs"
                  />
                </div>

                {/* Active Status Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="newBrandIsActive"
                    checked={newBrandIsActive}
                    onChange={(e) => setNewBrandIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-950 cursor-pointer"
                  />
                  <label htmlFor="newBrandIsActive" className="text-xs text-slate-300 cursor-pointer select-none">
                    Active Brand in Catalog
                  </label>
                </div>

                {/* Sizes and Rates Configuration */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300 uppercase">
                      Applicable Sizes & Selling Rates (₹) *
                    </label>
                    <span className="text-[11px] text-slate-400">Select applicable sizes</span>
                  </div>

                  <div className="space-y-2">
                    {availableSizes.map((sz) => {
                      const cfg = sizeConfigs[sz.id] || { selected: false, rate: '' };
                      return (
                        <div
                          key={sz.id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            cfg.selected
                              ? 'bg-slate-950/80 border-emerald-700/60 shadow-sm'
                              : 'bg-slate-950/30 border-slate-800/80 opacity-60'
                          }`}
                        >
                          <label className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                            <input
                              type="checkbox"
                              checked={cfg.selected}
                              onChange={() => toggleSizeSelection(sz.id)}
                              className="w-4 h-4 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-sm">{sz.code}</span>
                                <span className="text-xs text-slate-400">({sz.name})</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">{sz.volumeMl}ml</span>
                            </div>
                          </label>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!cfg.selected}
                              value={cfg.rate}
                              onChange={(e) => handleRateChange(sz.id, e.target.value)}
                              placeholder="Rate"
                              className={`w-28 bg-slate-900 border rounded-lg py-1.5 px-2.5 text-right font-mono text-sm focus:outline-none transition-all ${
                                cfg.selected
                                  ? 'border-emerald-600/70 text-emerald-300 focus:border-emerald-400'
                                  : 'border-slate-800 text-slate-600 opacity-40'
                              }`}
                            />
                            <span className="text-[11px] text-slate-500">/ btl</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Rate Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center gap-2 ${
                      newBrandRateScope === 'global'
                        ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}>
                      <input
                        type="radio"
                        name="rateScope"
                        value="global"
                        checked={newBrandRateScope === 'global'}
                        onChange={() => setNewBrandRateScope('global')}
                        className="text-amber-500"
                      />
                      <span>All Shops (Global)</span>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center gap-2 ${
                      newBrandRateScope === 'shop'
                        ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}>
                      <input
                        type="radio"
                        name="rateScope"
                        value="shop"
                        checked={newBrandRateScope === 'shop'}
                        onChange={() => setNewBrandRateScope('shop')}
                        className="text-amber-500"
                      />
                      <span className="truncate">{selectedShop?.name || 'Active Shop'}</span>
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <Link
                    to="/brands"
                    className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                  >
                    Brand Master →
                  </Link>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddBrandModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/30 disabled:opacity-50 transition-all"
                    >
                      {modalSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Saving Brand...
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Save Brand & Sizes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DailyStock;
