import React, { useState, useEffect, useRef } from 'react';
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
  X,
  Search,
  LayoutGrid,
  Table as TableIcon,
  UploadCloud
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadAuthenticatedFile } from '../utils/download';
import { useTheme } from '../context/ThemeContext';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import DailyStockImportModal from '../components/stock/DailyStockImportModal';
import ErrorBoundary from '../components/ErrorBoundary';

const DailyStock = () => {
  const { selectedShop } = useAuth();
  const { activeTheme } = useTheme();
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [meta, setMeta] = useState({});

  // Pagination & Search
  const {
    page,
    limit,
    search,
    debouncedSearch,
    setPage,
    setLimit,
    setSearch,
    pagination,
    setPaginationMetadata,
    getNextRequestId,
    isCurrentRequest
  } = usePagination({ initialPage: 1, initialLimit: 25 });

  // Staged edits preserved across page transitions
  const [stagedEdits, setStagedEdits] = useState({});
  const [backendSummary, setBackendSummary] = useState(null);

  // Mobile View Mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('auto'); // 'auto' (cards on mobile, table on desktop), 'cards', 'table'

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

  const applyStagedEdits = (rawRecords, stagedMap) => {
    return (rawRecords || []).map((row) => {
      const key = `${row.brandId}_${row.sizeId}`;
      if (stagedMap && stagedMap[key]) {
        const staged = stagedMap[key];
        const op = staged.openingStock !== undefined ? staged.openingStock : row.openingStock;
        const ind = staged.indentStock !== undefined ? staged.indentStock : row.indentStock;
        const opNum = op === '' ? 0 : (parseInt(op, 10) || 0);
        const indNum = ind === '' ? 0 : (parseInt(ind, 10) || 0);
        const total = opNum + indNum;
        const hasClosing = staged.closingStock !== '' && staged.closingStock !== null && staged.closingStock !== undefined;
        const clNum = hasClosing ? (parseInt(staged.closingStock, 10) || 0) : 0;
        const sale = hasClosing ? Math.max(0, total - clNum) : 0;
        const rate = parseFloat(row.bottleRate) || 0;
        const stockValue = total * rate;
        const saleAmount = hasClosing ? sale * rate : 0;

        return {
          ...row,
          openingStock: op,
          indentStock: ind,
          totalStock: total,
          closingStock: staged.closingStock,
          stockValue,
          saleCount: sale,
          saleAmount,
          extraAmount: staged.extraAmount !== undefined ? staged.extraAmount : row.extraAmount,
          closingError: hasClosing && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
        };
      }
      return row;
    });
  };

  const fetchDailySheet = async (
    targetDate = businessDate,
    targetPage = page,
    targetLimit = limit,
    targetSearch = debouncedSearch
  ) => {
    if (!selectedShop?.id) return;
    const currentShopId = selectedShop.id;
    const reqId = getNextRequestId();
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.get('/inventory/daily-stock', {
        params: {
          date: targetDate,
          shopId: currentShopId,
          page: targetPage,
          limit: targetLimit,
          search: targetSearch
        },
        headers: { 'x-shop-id': currentShopId }
      });

      if (!isCurrentRequest(reqId)) return;

      if (res.success && res.data.shopId === currentShopId) {
        const mergedRecords = applyStagedEdits(res.data.records || [], stagedEdits);
        setItems(mergedRecords);
        if (res.data.summary) {
          setBackendSummary(res.data.summary);
        }
        if (res.data.pagination) {
          setPaginationMetadata(res.data.pagination);
        }
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
      if (isCurrentRequest(reqId)) {
        setError(err?.message || 'Failed to load daily stock sheet.');
      }
    } finally {
      if (isCurrentRequest(reqId)) {
        setLoading(false);
      }
    }
  };

  // Reset staged edits and reset page to 1 when active shop or business date changes
  useEffect(() => {
    setStagedEdits({});
    setPage(1);
  }, [businessDate, selectedShop?.id]);

  useEffect(() => {
    let isCurrent = true;
    const currentShopId = selectedShop?.id;

    if (!currentShopId) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    const reqId = getNextRequestId();

    apiClient.get('/inventory/daily-stock', {
      params: {
        date: businessDate,
        shopId: currentShopId,
        page,
        limit,
        search: debouncedSearch
      },
      headers: { 'x-shop-id': currentShopId }
    })
      .then((res) => {
        if (!isCurrent || !isCurrentRequest(reqId)) return;
        if (res.success && res.data.shopId === currentShopId) {
          const mergedRecords = applyStagedEdits(res.data.records || [], stagedEdits);
          setItems(mergedRecords);
          if (res.data.summary) {
            setBackendSummary(res.data.summary);
          }
          if (res.data.pagination) {
            setPaginationMetadata(res.data.pagination);
          }
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
        if (!isCurrent || !isCurrentRequest(reqId)) return;
        setError(err?.message || 'Failed to load daily stock sheet.');
      })
      .finally(() => {
        if (isCurrent && isCurrentRequest(reqId)) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [businessDate, selectedShop?.id, page, limit, debouncedSearch]);

  const handleOpeningChange = (index, val) => {
    const nextItems = [...items];
    const row = nextItems[index];
    const opening = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    const opNum = val === '' ? 0 : opening;
    const indNum = parseInt(row.indentStock, 10) || 0;
    const total = opNum + indNum;
    const hasClosing = row.closingStock !== '' && row.closingStock !== null && row.closingStock !== undefined;
    const clNum = hasClosing ? parseInt(row.closingStock, 10) || 0 : 0;
    const sale = hasClosing ? Math.max(0, total - clNum) : 0;
    const rate = parseFloat(row.bottleRate) || 0;
    const stockValue = total * rate;
    const saleAmount = hasClosing ? sale * rate : 0;

    nextItems[index] = {
      ...row,
      openingStock: opening,
      totalStock: total,
      stockValue,
      saleCount: sale,
      saleAmount,
      closingError: hasClosing && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
    };
    setItems(nextItems);

    const key = `${row.brandId}_${row.sizeId}`;
    setStagedEdits(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        brandId: row.brandId,
        sizeId: row.sizeId,
        bottleRate: row.bottleRate,
        notes: row.notes,
        openingStock: opening,
        indentStock: row.indentStock,
        closingStock: row.closingStock,
        extraAmount: row.extraAmount
      }
    }));
  };

  const handleIndentChange = (index, val) => {
    const nextItems = [...items];
    const row = nextItems[index];
    const indent = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    const indNum = val === '' ? 0 : indent;
    const opNum = parseInt(row.openingStock, 10) || 0;
    const total = opNum + indNum;
    const hasClosing = row.closingStock !== '' && row.closingStock !== null && row.closingStock !== undefined;
    const clNum = hasClosing ? parseInt(row.closingStock, 10) || 0 : 0;
    const sale = hasClosing ? Math.max(0, total - clNum) : 0;
    const rate = parseFloat(row.bottleRate) || 0;
    const stockValue = total * rate;
    const saleAmount = hasClosing ? sale * rate : 0;

    nextItems[index] = {
      ...row,
      indentStock: indent,
      totalStock: total,
      stockValue,
      saleCount: sale,
      saleAmount,
      closingError: hasClosing && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
    };
    setItems(nextItems);

    const key = `${row.brandId}_${row.sizeId}`;
    setStagedEdits(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        brandId: row.brandId,
        sizeId: row.sizeId,
        bottleRate: row.bottleRate,
        notes: row.notes,
        openingStock: row.openingStock,
        indentStock: indent,
        closingStock: row.closingStock,
        extraAmount: row.extraAmount
      }
    }));
  };

  const handleClosingChange = (index, val) => {
    const nextItems = [...items];
    const row = nextItems[index];
    const total = row.totalStock;
    const hasVal = val !== '';
    const closing = hasVal ? Math.max(0, parseInt(val, 10) || 0) : '';
    const clNum = hasVal ? closing : 0;
    const sale = hasVal ? Math.max(0, total - clNum) : 0;
    const rate = parseFloat(row.bottleRate) || 0;
    const saleAmount = hasVal ? sale * rate : 0;

    nextItems[index] = {
      ...row,
      closingStock: closing,
      saleCount: sale,
      saleAmount,
      closingError: hasVal && clNum > total ? `Closing (${clNum}) exceeds Total (${total})` : null
    };
    setItems(nextItems);

    const key = `${row.brandId}_${row.sizeId}`;
    setStagedEdits(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        brandId: row.brandId,
        sizeId: row.sizeId,
        bottleRate: row.bottleRate,
        notes: row.notes,
        openingStock: row.openingStock,
        indentStock: row.indentStock,
        closingStock: closing,
        extraAmount: row.extraAmount
      }
    }));
  };

  const handleExtraAmountChange = (index, val) => {
    const nextItems = [...items];
    const row = nextItems[index];
    nextItems[index] = {
      ...row,
      extraAmount: val
    };
    setItems(nextItems);

    const key = `${row.brandId}_${row.sizeId}`;
    setStagedEdits(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        brandId: row.brandId,
        sizeId: row.sizeId,
        bottleRate: row.bottleRate,
        notes: row.notes,
        openingStock: row.openingStock,
        indentStock: row.indentStock,
        closingStock: row.closingStock,
        extraAmount: val
      }
    }));
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
      setError(`Cannot save: ${invalidRowsCount} brand row(s) on current page have closing count exceeding total stock.`);
      return;
    }

    if (status === 'COMPLETED' && incompleteCount > 0) {
      setError(`Cannot finalize: ${incompleteCount} brand row(s) on this page are pending physical closing counts. Please enter closing counts for all rows or save as Draft.`);
      return;
    }

    setSaving(true);

    try {
      const itemsMap = new Map();

      // 1. Add all staged edits across any pages
      Object.values(stagedEdits).forEach(staged => {
        const key = `${staged.brandId}_${staged.sizeId}`;
        const op = parseInt(staged.openingStock, 10) || 0;
        const ind = parseInt(staged.indentStock, 10) || 0;
        const tot = op + ind;
        const hasCl = staged.closingStock !== '' && staged.closingStock !== null && staged.closingStock !== undefined;
        const cl = hasCl ? parseInt(staged.closingStock, 10) : 0;
        itemsMap.set(key, {
          brandId: staged.brandId,
          sizeId: staged.sizeId,
          openingStock: op,
          indentStock: ind,
          totalStock: tot,
          closingStock: cl,
          bottleRate: parseFloat(staged.bottleRate) || 0,
          extraAmount: parseFloat(staged.extraAmount) || 0,
          notes: staged.notes || ''
        });
      });

      // 2. Add/override with rows currently on the current page
      items.forEach(item => {
        const key = `${item.brandId}_${item.sizeId}`;
        const op = parseInt(item.openingStock, 10) || 0;
        const ind = parseInt(item.indentStock, 10) || 0;
        const tot = op + ind;
        const hasCl = item.closingStock !== '' && item.closingStock !== null && item.closingStock !== undefined;
        const cl = hasCl ? parseInt(item.closingStock, 10) : 0;
        itemsMap.set(key, {
          brandId: item.brandId,
          sizeId: item.sizeId,
          openingStock: op,
          indentStock: ind,
          totalStock: tot,
          closingStock: cl,
          bottleRate: parseFloat(item.bottleRate) || 0,
          extraAmount: parseFloat(item.extraAmount) || 0,
          notes: item.notes || ''
        });
      });

      const payload = {
        businessDate,
        status,
        shopId: selectedShop?.id,
        items: Array.from(itemsMap.values())
      };

      const res = await apiClient.post('/inventory/daily-stock', payload, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (res.success) {
        setStagedEdits({});
        setSuccessMsg(
          `Daily stock sheet ${status === 'COMPLETED' ? 'finalized' : 'saved as draft'} successfully for ${selectedShop?.name || 'Shop'} (${businessDate})! Authoritative Total Business: ₹${res.data.totalBusiness}`
        );
        fetchDailySheet(businessDate, page, limit, debouncedSearch);
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

  // Authoritative calculations for summary: prefer authoritative backendSummary across entire shop and date
  const totalOpening = backendSummary ? backendSummary.totalOpening : items.reduce((acc, curr) => acc + (parseInt(curr.openingStock, 10) || 0), 0);
  const totalIndent = backendSummary ? backendSummary.totalIndent : items.reduce((acc, curr) => acc + (parseInt(curr.indentStock, 10) || 0), 0);
  const totalStockCount = backendSummary ? backendSummary.totalAvailable : items.reduce((acc, curr) => acc + (parseInt(curr.totalStock, 10) || 0), 0);
  const totalClosing = backendSummary ? backendSummary.totalClosing : items.reduce((acc, curr) => {
    const hasCl = curr.closingStock !== '' && curr.closingStock !== null && curr.closingStock !== undefined;
    return acc + (hasCl ? parseInt(curr.closingStock, 10) : 0);
  }, 0);
  const totalSaleBottles = backendSummary ? backendSummary.totalSold : items.reduce((acc, curr) => acc + (parseInt(curr.saleCount, 10) || 0), 0);
  const totalStockValue = backendSummary ? parseFloat(backendSummary.totalStockValue) || 0 : items.reduce((acc, curr) => acc + ((parseInt(curr.totalStock, 10) || 0) * (parseFloat(curr.bottleRate) || 0)), 0);
  const totalBusinessAmount = backendSummary ? parseFloat(backendSummary.totalBusiness) || 0 : items.reduce((acc, curr) => acc + (parseFloat(curr.saleAmount) || 0), 0);
  const totalRemainingStockValue = backendSummary ? parseFloat(backendSummary.totalRemainingStockValue) || 0 : items.reduce((acc, curr) => {
    const hasCl = curr.closingStock !== '' && curr.closingStock !== null && curr.closingStock !== undefined;
    const cl = hasCl ? parseInt(curr.closingStock, 10) || 0 : 0;
    const r = parseFloat(curr.bottleRate) || 0;
    return acc + (hasCl ? cl * r : 0);
  }, 0);
  const totalExtraAmount = backendSummary ? parseFloat(backendSummary.totalExtraAmount) || 0 : items.reduce((acc, curr) => acc + (parseFloat(curr.extraAmount) || 0), 0);
  const combinedTotalAmount = totalBusinessAmount + totalExtraAmount;

  const allRowsCompleted = backendSummary
    ? backendSummary.reconciliationStatus !== 'PENDING'
    : (items.length > 0 && incompleteCount === 0 && invalidRowsCount === 0);
  const isReconciled = backendSummary
    ? backendSummary.isReconciled
    : (allRowsCompleted && Math.abs(totalStockValue - (totalBusinessAmount + totalRemainingStockValue)) < 0.05);

  return (
    <Layout title="Daily Stock Calculation Sheet">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: activeTheme.primary }} />
                Daily Stock Sheet
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${
                meta.isLocked
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : meta.isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {meta.isLocked ? 'LOCKED / CLOSED' : meta.isCompleted ? 'FINALIZED' : 'DRAFT / IN PROGRESS'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Active Shop: <strong style={{ color: activeTheme.primary }}>{selectedShop?.name || 'Loading...'}</strong> ({selectedShop?.code || '—'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Date Picker & Refresh */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs">
              <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: activeTheme.primary }} />
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-transparent text-slate-800 font-mono text-xs focus:outline-none cursor-pointer"
                aria-label="Select stock date"
              />
            </div>

            <button
              onClick={() => fetchDailySheet(businessDate)}
              className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors"
              title="Reload Sheet"
              aria-label="Reload Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Actions Strip */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf || loading || items.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-100 text-rose-700 text-xs rounded-lg transition-all disabled:opacity-50"
                title="Download Daily Stock Sheet as PDF"
              >
                <FileText className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-bounce' : ''}`} />
                <span className="hidden xs:inline">PDF</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exportingExcel || loading || items.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-100 text-teal-700 text-xs rounded-lg transition-all disabled:opacity-50"
                title="Download Daily Stock Sheet as Excel (.xlsx)"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${exportingExcel ? 'animate-bounce' : ''}`} />
                <span className="hidden xs:inline">Excel</span>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={exportingCsv || loading || items.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-100 text-emerald-700 text-xs rounded-lg transition-all disabled:opacity-50"
                title="Export Daily Stock Sheet to CSV"
              >
                <Download className={`w-3.5 h-3.5 ${exportingCsv ? 'animate-bounce' : ''}`} />
                <span className="hidden xs:inline">CSV</span>
              </button>
            </div>

            {/* Primary Action Buttons */}
            {!meta.isLocked && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
                  title="Import Stock Sheet from Image, PDF, Excel, or CSV with Mandatory Preview"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Import Sheet</span>
                </button>

                <button
                  onClick={handleOpenAddBrandModal}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
                  title="Add New Brand & Configure Sizes"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Brand</span>
                </button>

                <button
                  onClick={() => handleSave('DRAFT')}
                  disabled={saving || loading || items.length === 0}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
                  title="Save current progress as draft"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Draft'}</span>
                </button>

                <button
                  onClick={() => handleSave('COMPLETED')}
                  disabled={saving || loading || items.length === 0}
                  style={{ backgroundColor: activeTheme.primary }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-white font-semibold text-xs rounded-xl shadow-xs hover:opacity-95 transition-all disabled:opacity-50"
                  title="Finalize sheet with verified closing counts"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{saving ? 'Finalizing...' : 'Finalize'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Informational Alerts */}
        {meta.isLocked && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              <strong>Locked Day:</strong> Daily closing has already been executed for this shop and date. Modifying stock records is restricted.
            </span>
          </div>
        )}

        {meta.isInitialSetup && (
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>
              <strong>Initial Opening Setup:</strong> No prior business records found for {selectedShop?.name}. You can enter initial opening balances in the Opening inputs below.
            </span>
          </div>
        )}

        {meta.isNewDay && meta.previousDate && !meta.hasDateGap && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Auto Carry-Forward Active:</strong> Opening bottle balances for this sheet were automatically initialized from previous closing records dated <strong>{meta.previousDate}</strong>.
            </span>
          </div>
        )}

        {meta.hasDateGap && meta.gapWarning && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{meta.gapWarning}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quick KPI Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Opening</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5 truncate">{totalOpening}</p>
          </div>
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Indent</span>
            <p className="text-base sm:text-lg font-bold text-indigo-600 font-mono mt-0.5 truncate">{totalIndent}</p>
          </div>
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500">Available Bottles</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5 truncate">{totalStockCount}</p>
          </div>
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500">Total Closing</span>
              {incompleteCount > 0 && (
                <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-sans border border-amber-200">
                  {incompleteCount} pending
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg font-bold text-emerald-700 font-mono mt-0.5 truncate">{totalClosing}</p>
          </div>
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold uppercase" style={{ color: activeTheme.primary }}>Bottles Sold</span>
            <p className="text-base sm:text-lg font-bold font-mono mt-0.5 truncate" style={{ color: activeTheme.primary }}>{totalSaleBottles}</p>
          </div>
          <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500">Total Stock Value</span>
            <p className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5 truncate" title={`₹${totalStockValue.toFixed(2)}`}>
              ₹{totalStockValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-emerald-700">Sales Amount</span>
            <p className="text-base sm:text-lg font-bold text-emerald-800 font-mono mt-0.5 truncate" title={`₹${totalBusinessAmount.toFixed(2)}`}>
              ₹{totalBusinessAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-indigo-50/70 border border-indigo-200 p-2.5 sm:p-3 rounded-xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-indigo-700">Remaining Value</span>
              {incompleteCount > 0 && (
                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-sans border border-amber-200">
                  Pending
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg font-bold text-indigo-800 font-mono mt-0.5 truncate" title={`₹${totalRemainingStockValue.toFixed(2)}`}>
              ₹{totalRemainingStockValue.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Stock Reconciliation Identity Banner */}
        {items.length > 0 && (
          <div className={`p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs transition-colors ${
            isReconciled
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
              : incompleteCount > 0
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-rose-50/90 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center gap-2">
              {isReconciled ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : incompleteCount > 0 ? (
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div>
                <span className="font-bold">
                  {isReconciled
                    ? 'Reconciliation Identity Verified:'
                    : incompleteCount > 0
                    ? 'Reconciliation Pending:'
                    : 'Reconciliation Discrepancy:'}
                </span>{' '}
                {isReconciled ? (
                  <span className="font-mono text-emerald-900">
                    Total Stock Value (₹{totalStockValue.toFixed(2)}) = Sales Amount (₹{totalBusinessAmount.toFixed(2)}) + Remaining Stock Value (₹{totalRemainingStockValue.toFixed(2)})
                  </span>
                ) : incompleteCount > 0 ? (
                  <span>
                    Closing stock count is pending on <strong>{incompleteCount}</strong> brand row{incompleteCount === 1 ? '' : 's'}. Full reconciliation will verify once all closing entries are completed.
                  </span>
                ) : (
                  <span className="font-mono text-rose-900">
                    Total Stock Value (₹{totalStockValue.toFixed(2)}) does not equal Sales Amount (₹{totalBusinessAmount.toFixed(2)}) + Remaining Stock Value (₹{totalRemainingStockValue.toFixed(2)}).
                  </span>
                )}
              </div>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 uppercase tracking-wide border ${
              isReconciled
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : incompleteCount > 0
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {isReconciled ? '✓ Reconciled' : incompleteCount > 0 ? `${incompleteCount} Pending` : 'Discrepancy'}
            </span>
          </div>
        )}

        {/* Sales & Extra Amount Breakdown Banner */}
        {(pagination?.totalRecords ?? items.length) > 0 && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">Sales & Extra Amount Breakdown:</span>{' '}
                <span className="font-mono text-slate-900 font-semibold">
                  Total Sales Amount (₹{totalBusinessAmount.toFixed(2)}) + Extra Total Amount (₹{totalExtraAmount.toFixed(2)}) = Combined Total Amount (₹{combinedTotalAmount.toFixed(2)})
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-sans italic shrink-0">
              * Extra Amount is informational only &amp; excluded from official closing revenue
            </span>
          </div>
        )}

        {/* View Mode Switcher, Search Bar and Row Header Strip */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Stock Inventory ({pagination?.totalRecords ?? items.length} {(pagination?.totalRecords ?? items.length) === 1 ? 'row' : 'rows'})
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-mono">
              {businessDate}
            </span>
            {Object.keys(stagedEdits).length > 0 && (
              <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>{Object.keys(stagedEdits).length} unsaved staged edit{Object.keys(stagedEdits).length === 1 ? '' : 's'} across pages</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search brand or size..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus-theme transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Auto / Cards / Table */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
              <button
                onClick={() => setViewMode('cards')}
                style={
                  viewMode === 'cards' || (viewMode === 'auto' && window.innerWidth < 768)
                    ? { backgroundColor: activeTheme.primary }
                    : {}
                }
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  viewMode === 'cards' || (viewMode === 'auto' && window.innerWidth < 768)
                    ? 'text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to Mobile Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={
                  viewMode === 'table' || (viewMode === 'auto' && window.innerWidth >= 768)
                    ? { backgroundColor: activeTheme.primary }
                    : {}
                }
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  viewMode === 'table' || (viewMode === 'auto' && window.innerWidth >= 768)
                    ? 'text-white font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to Full Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            <Link
              to="/brands"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 transition-colors"
              title="Navigate to Brand Management page"
            >
              Brand Master →
            </Link>
          </div>
        </div>

        {/* Data Presentation: Card View vs Table View */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: activeTheme.primary }} />
            Loading daily stock sheet...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm space-y-3 shadow-xs">
            <Package className="w-10 h-10 mx-auto text-slate-400" />
            <p>No brands or sizes configured for this shop.</p>
            {!meta.isLocked && (
              <button
                onClick={handleOpenAddBrandModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Your First Brand
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 1. Mobile Cards View (Visible on small screens or when forced) */}
            <div className={`space-y-3 ${viewMode === 'table' ? 'hidden' : viewMode === 'cards' ? 'block' : 'block md:hidden'}`}>
              {items.map((row, idx) => {
                const isInitialRow = meta.isInitialSetup || row.isInitialOpening;
                const isPendingClosing = row.closingStock === '' || row.closingStock === null || row.closingStock === undefined;

                return (
                  <div
                    key={row.id || idx}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xs transition-all ${
                      row.closingError
                        ? 'border-rose-400 bg-rose-50/40'
                        : isPendingClosing
                        ? 'border-amber-300'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Card Header: Brand, Size & Rate */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            #{row.brand?.serialNo || idx + 1}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base">{row.brand?.name}</h3>
                          <span
                            className="font-bold text-xs px-2 py-0.5 rounded-lg border"
                            style={{
                              backgroundColor: activeTheme.light,
                              color: activeTheme.primary,
                              borderColor: activeTheme.border
                            }}
                          >
                            {row.size?.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Selling Rate: <strong className="text-slate-800">₹{row.bottleRate}</strong> / bottle
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Sale Amount</span>
                        <span className="text-base font-bold text-emerald-600 font-mono">
                          ₹{parseFloat(row.saleAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Stock Calculation Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center font-mono">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">Opening</span>
                        {isInitialRow && !meta.isLocked ? (
                          <input
                            type="number"
                            min="0"
                            value={row.openingStock}
                            onChange={(e) => handleOpeningChange(idx, e.target.value)}
                            placeholder="0"
                            className="w-full bg-white border border-indigo-300 rounded-lg py-1 px-1 text-center text-indigo-700 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            aria-label="Initial Opening balance"
                          />
                        ) : (
                          <span className="text-sm font-bold text-slate-700 block mt-1">{row.openingStock}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">Indent (+)</span>
                        <input
                          type="number"
                          min="0"
                          value={row.indentStock}
                          onChange={(e) => handleIndentChange(idx, e.target.value)}
                          disabled={meta.isLocked}
                          placeholder="0"
                          className="w-full bg-white border border-slate-300 rounded-lg py-1 px-1 text-center text-slate-800 font-bold text-sm focus:outline-none focus-theme disabled:opacity-50"
                          aria-label="Indent stock"
                        />
                      </div>

                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500 block font-sans">Total</span>
                        <span className="text-sm font-bold text-slate-900 block mt-1">{row.totalStock}</span>
                      </div>
                    </div>

                    {/* Closing Entry & Result Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                          Physical Closing Count *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={row.closingStock}
                          onChange={(e) => handleClosingChange(idx, e.target.value)}
                          disabled={meta.isLocked}
                          placeholder="Enter Closing Count"
                          className={`w-full bg-white border rounded-xl py-2 px-3 text-center font-mono font-bold text-base focus:outline-none transition-all disabled:opacity-50 ${
                            row.closingError
                              ? 'border-rose-400 text-rose-600 bg-rose-50/40 focus:border-rose-500'
                              : 'border-slate-300 text-slate-900 focus-theme'
                          }`}
                        />
                        {row.closingError && (
                          <p className="text-[10px] text-rose-600 mt-1">{row.closingError}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-[10px] uppercase font-bold block font-sans" style={{ color: activeTheme.primary }}>
                            Bottles Sold
                          </span>
                          <span className="text-base font-bold font-mono" style={{ color: activeTheme.primary }}>
                            {isPendingClosing ? '—' : `${row.saleCount} btls`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block font-sans">Stock Value</span>
                          <span className="text-xs font-bold text-slate-700 font-mono">
                            ₹{((parseInt(row.totalStock, 10) || 0) * (parseFloat(row.bottleRate) || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Remaining Stock Value card item */}
                      <div className="flex items-center justify-between bg-indigo-50/60 p-2 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-[10px] font-bold uppercase text-indigo-800 font-sans">
                          Remaining Stock Value
                        </span>
                        <span className="font-bold font-mono text-indigo-700">
                          {!isPendingClosing ? (
                            `₹${((parseInt(row.closingStock, 10) || 0) * (parseFloat(row.bottleRate) || 0)).toFixed(2)}`
                          ) : (
                            <span className="text-amber-700 font-sans font-medium italic">Pending</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Daily Totals Summary Card */}
              {items.length > 0 && (
                <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-md border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-amber-400">Daily Totals Summary</span>
                    <span className="text-[11px] text-slate-400 font-mono">{pagination?.totalRecords ?? items.length} rows</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Opening</span>
                      <span className="font-bold">{totalOpening}</span>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-[10px] text-indigo-300 block">Indent</span>
                      <span className="font-bold text-indigo-300">{totalIndent}</span>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Available</span>
                      <span className="font-bold">{totalStockCount}</span>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-[10px] text-emerald-300 block">Closing</span>
                      <span className="font-bold text-emerald-300">{totalClosing}</span>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-[10px] text-amber-300 block">Sold Bottles</span>
                      <span className="font-bold text-amber-400">{totalSaleBottles}</span>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Extra Amt</span>
                      <span className="font-bold text-slate-300">₹{totalExtraAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-800 pt-2.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-sans">Total Stock Value:</span>
                      <span className="font-bold font-mono text-white text-sm">₹{totalStockValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 font-semibold font-sans">Total Sales Amount:</span>
                      <span className="font-bold font-mono text-emerald-400 text-sm">₹{totalBusinessAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-400 font-semibold font-sans">Remaining Stock Value:</span>
                      <span className="font-bold font-mono text-indigo-300 text-sm">₹{totalRemainingStockValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
                      <span className="text-slate-400 font-sans">Extra Amount (Info):</span>
                      <span className="font-bold font-mono text-slate-300">₹{totalExtraAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Desktop Tabular View (Visible on tablet/desktop or when forced) */}
            <div className={`table-grid-wrapper ${
              viewMode === 'cards' ? 'hidden' : viewMode === 'table' ? 'block' : 'hidden md:block'
            }`}>
              <table className="table-grid min-w-[960px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="text-center w-12">S.No.</th>
                    <th>Brand Name</th>
                    <th className="text-center w-16">Size</th>
                    <th className="text-center w-20">Opening</th>
                    <th className="text-center w-20">Indent</th>
                    <th className="text-center w-20">Total</th>
                    <th className="text-center w-24">Closing</th>
                    <th className="text-center w-20" style={{ color: activeTheme.primary }}>Sale</th>
                    <th className="text-right w-24">Rate</th>
                    <th className="text-right w-28 text-slate-700">Stock Value (₹)</th>
                    <th className="text-right w-28 text-emerald-700">Amount (₹)</th>
                    <th className="text-right w-32 text-indigo-700">Remaining Stock Value (₹)</th>
                    <th className="text-right w-24 text-slate-500" title="Informational only; excluded from financial totals">
                      Extra Amt*
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {items.map((row, idx) => {
                    const isInitialRow = meta.isInitialSetup || row.isInitialOpening;
                    const isPendingClosing = row.closingStock === '' || row.closingStock === null || row.closingStock === undefined;

                    return (
                      <tr key={row.id || idx}>
                        <td className="text-center font-bold text-slate-500">
                          {row.brand?.serialNo || idx + 1}
                        </td>
                        <td className="font-sans font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{row.brand?.name}</span>
                            {isPendingClosing && !meta.isLocked && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.2 rounded font-sans font-semibold">
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center font-bold" style={{ color: activeTheme.primary }}>
                          {row.size?.code}
                        </td>
                        <td className="text-center text-slate-700">
                          {isInitialRow && !meta.isLocked ? (
                            <input
                              type="number"
                              min="0"
                              value={row.openingStock}
                              onChange={(e) => handleOpeningChange(idx, e.target.value)}
                              placeholder="0"
                              className="w-16 bg-white border border-indigo-300 rounded-lg py-1 px-1.5 text-center text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-bold"
                              title="Enter initial opening balance"
                            />
                          ) : (
                            <span>{row.openingStock}</span>
                          )}
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.indentStock}
                            onChange={(e) => handleIndentChange(idx, e.target.value)}
                            disabled={meta.isLocked}
                            className="w-16 bg-white border border-slate-300 rounded-lg py-1 px-1.5 text-center text-slate-900 focus:outline-none focus-theme font-bold disabled:opacity-50"
                          />
                        </td>
                        <td className="text-center font-bold text-slate-900">
                          {row.totalStock}
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.closingStock}
                            onChange={(e) => handleClosingChange(idx, e.target.value)}
                            disabled={meta.isLocked}
                            placeholder="Count"
                            className={`w-16 bg-white border rounded-lg py-1 px-1.5 text-center font-bold focus:outline-none disabled:opacity-50 ${
                              row.closingError
                                ? 'border-rose-400 text-rose-600 bg-rose-50/40 focus:border-rose-500'
                                : 'border-slate-300 text-slate-900 focus-theme'
                            }`}
                          />
                          {row.closingError && (
                            <div className="text-[9px] text-rose-600 font-sans mt-0.5 whitespace-nowrap">
                              {row.closingError}
                            </div>
                          )}
                        </td>
                        <td className="text-center font-bold" style={{ color: activeTheme.primary }}>
                          {isPendingClosing ? '—' : row.saleCount}
                        </td>
                        <td className="text-right text-slate-600">
                          ₹{row.bottleRate}
                        </td>
                        <td className="text-right font-bold text-slate-800 font-sans">
                          ₹{((parseInt(row.totalStock, 10) || 0) * (parseFloat(row.bottleRate) || 0)).toFixed(2)}
                        </td>
                        <td className="text-right font-bold text-emerald-700 font-sans">
                          ₹{parseFloat(row.saleAmount || 0).toFixed(2)}
                        </td>
                        <td className="text-right font-bold text-indigo-700 font-sans">
                          {!isPendingClosing ? (
                            `₹${((parseInt(row.closingStock, 10) || 0) * (parseFloat(row.bottleRate) || 0)).toFixed(2)}`
                          ) : (
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-normal italic font-sans">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.extraAmount}
                            onChange={(e) => handleExtraAmountChange(idx, e.target.value)}
                            disabled={meta.isLocked}
                            placeholder="0.00"
                            className="w-20 bg-white border border-slate-300 rounded-lg py-1 px-1.5 text-right text-slate-600 focus:outline-none focus-theme text-xs disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Table Footer Totals */}
                <tfoot className="font-mono text-xs bg-slate-100 border-t-2 border-b-2 border-slate-300">
                  <tr className="divide-x divide-slate-200">
                    <td colSpan={3} className="font-sans uppercase font-bold px-3 py-2.5" style={{ color: activeTheme.primary }}>
                      Daily Totals ({pagination?.totalRecords ?? items.length} rows):
                    </td>
                    <td className="text-center text-slate-800 font-bold px-2 py-2.5">{totalOpening}</td>
                    <td className="text-center text-indigo-700 font-bold px-2 py-2.5">{totalIndent}</td>
                    <td className="text-center text-slate-900 font-bold px-2 py-2.5">{totalStockCount}</td>
                    <td className="text-center text-emerald-700 font-bold px-2 py-2.5">{totalClosing}</td>
                    <td className="text-center text-sm font-extrabold px-2 py-2.5" style={{ color: activeTheme.primary }}>{totalSaleBottles}</td>
                    <td className="text-right text-slate-400 px-2 py-2.5">—</td>
                    <td className="text-right text-slate-900 font-extrabold font-sans px-2 py-2.5">
                      ₹{totalStockValue.toFixed(2)}
                    </td>
                    <td className="text-right text-emerald-700 font-extrabold font-sans px-2 py-2.5">
                      ₹{totalBusinessAmount.toFixed(2)}
                    </td>
                    <td className="text-right text-indigo-700 font-extrabold font-sans px-2 py-2.5">
                      ₹{totalRemainingStockValue.toFixed(2)}
                    </td>
                    <td className="text-right text-slate-700 font-bold font-sans px-2 py-2.5" title="Informational only">
                      ₹{totalExtraAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {(pagination?.totalRecords ?? items.length) > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={setLimit}
              disabled={loading}
            />
          </div>
        )}

        {/* Footer Navigation & Closing Prompt */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <p className="text-[11px] sm:text-xs text-slate-500">
            * <strong className="text-slate-700">Extra Amount:</strong> Strictly informational field. 100% excluded from all financial and sales amount calculations.
          </p>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors shrink-0 border border-slate-200"
          >
            Go to Dashboard & Close Business
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Add New Brand & Sizes Modal */}
      {showAddBrandModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="p-2 rounded-xl border"
                  style={{
                    backgroundColor: activeTheme.light,
                    color: activeTheme.primary,
                    borderColor: activeTheme.border
                  }}
                >
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Add New Brand & Sizes</h3>
                  <p className="text-xs text-slate-500">Configure brand details and selling rates</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddBrandModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {modalLoading ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                <RefreshCw
                  className="w-6 h-6 animate-spin mx-auto mb-2"
                  style={{ color: activeTheme.primary }}
                />
                Loading size master and serial counter...
              </div>
            ) : (
              <form onSubmit={handleCreateBrandSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Brand Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      placeholder="e.g. Blenders Pride"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus-theme placeholder-slate-400 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1" title="Auto-assigned sequential serial number">
                      Serial No. (S.No.)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBrandSerialNo}
                      onChange={(e) => setNewBrandSerialNo(e.target.value)}
                      placeholder="Auto"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 font-mono font-bold text-sm focus:outline-none focus-theme text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newBrandDescription}
                    onChange={(e) => setNewBrandDescription(e.target.value)}
                    placeholder="e.g. Premium blended whiskey"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 text-xs focus:outline-none focus-theme placeholder-slate-400"
                  />
                </div>

                {/* Active Status Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="newBrandIsActive"
                    checked={newBrandIsActive}
                    onChange={(e) => setNewBrandIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="newBrandIsActive" className="text-xs text-slate-700 cursor-pointer select-none">
                    Active Brand in Catalog
                  </label>
                </div>

                {/* Sizes and Rates Configuration */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">
                      Applicable Sizes & Rates (₹) *
                    </label>
                    <span className="text-[11px] text-slate-500">Select applicable sizes</span>
                  </div>

                  <div className="space-y-2">
                    {availableSizes.map((sz) => {
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
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">{sz.code}</span>
                                <span className="text-xs text-slate-500">({sz.name})</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">{sz.volumeMl}ml</span>
                            </div>
                          </label>

                          <div className="flex items-center gap-1.5">
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
                            <span className="text-[11px] text-slate-500 hidden xs:inline">/ btl</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Rate Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label
                      className="p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center gap-2"
                      style={newBrandRateScope === 'global' ? { backgroundColor: activeTheme.light, borderColor: activeTheme.border, color: activeTheme.primary } : {}}
                    >
                      <input
                        type="radio"
                        name="rateScope"
                        value="global"
                        checked={newBrandRateScope === 'global'}
                        onChange={() => setNewBrandRateScope('global')}
                      />
                      <span className="truncate font-medium">All Shops (Global)</span>
                    </label>

                    <label
                      className="p-2.5 rounded-xl border cursor-pointer select-none transition-all flex items-center gap-2"
                      style={newBrandRateScope === 'shop' ? { backgroundColor: activeTheme.light, borderColor: activeTheme.border, color: activeTheme.primary } : {}}
                    >
                      <input
                        type="radio"
                        name="rateScope"
                        value="shop"
                        checked={newBrandRateScope === 'shop'}
                        onChange={() => setNewBrandRateScope('shop')}
                      />
                      <span className="truncate font-medium">{selectedShop?.name || 'Active Shop'}</span>
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-4 border-t border-slate-100">
                  <Link
                    to="/brands"
                    className="text-xs hover:underline flex items-center gap-1 font-medium"
                    style={{ color: activeTheme.primary }}
                  >
                    Brand Master →
                  </Link>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddBrandModal(false)}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors text-center border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={modalSubmitting}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all"
                      style={{ backgroundColor: activeTheme.primary }}
                    >
                      {modalSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Save Brand & Rates
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

      {/* Mandatory Preview Before Save Daily Stock Import Modal */}
      {showImportModal && (
        <ErrorBoundary componentName="Daily Stock Import Modal">
          <DailyStockImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            selectedShop={selectedShop}
            defaultDate={businessDate}
            activeTheme={activeTheme}
            onImportSuccess={(data) => {
              setSuccessMsg(
                `Stock import successful! ${data.importedCount} record(s) verified and recorded for ${data.businessDate}. Total bottles sold: ${data.totalBottlesSold}, Total sales: ₹${data.totalSaleAmount}.`
              );
              fetchDailySheet(businessDate);
            }}
          />
        </ErrorBoundary>
      )}
    </Layout>
  );
};

export default DailyStock;
