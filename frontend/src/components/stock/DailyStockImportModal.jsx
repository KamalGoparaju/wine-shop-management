import React, { useState, useMemo } from 'react';
import apiClient from '../../api/client';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  X,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Search,
  Check,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Building
} from 'lucide-react';

const DailyStockImportModal = ({
  isOpen,
  onClose,
  selectedShop,
  defaultDate,
  onImportSuccess,
  activeTheme
}) => {
  // Wizard Step: 1 = Upload Spreadsheet, 2 = Verify & Edit Ledger, 3 = Confirm
  const [currentStep, setCurrentStep] = useState(1);
  const [businessDate, setBusinessDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Staged Preview State
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileSummaries, setFileSummaries] = useState([]);
  const [stagedRows, setStagedRows] = useState([]);
  const [masterBrands, setMasterBrands] = useState([]);
  const [masterSizes, setMasterSizes] = useState([]);
  const [existingRecordCount, setExistingRecordCount] = useState(0);

  // Filter & Search in Preview
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'NEEDS_REVIEW' | 'INVALID' | 'VERIFIED'
  const [searchBrand, setSearchBrand] = useState('');

  // Confirmation Step State
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'replace' | 'append_only'
  const [importStatus, setImportStatus] = useState('DRAFT'); // 'DRAFT' | 'COMPLETED'
  const [operatorConfirmed, setOperatorConfirmed] = useState(false);

  if (!isOpen) return null;

  // File selection handlers (strictly Excel and CSV)
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    const validExtensions = ['xlsx', 'xls', 'csv'];
    const filtered = newFiles.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return validExtensions.includes(ext);
    });

    if (filtered.length < newFiles.length) {
      setErrorMessage('Unsupported file format. Please upload only Excel (.xlsx, .xls) or CSV (.csv) spreadsheets.');
    } else {
      setErrorMessage('');
    }

    setFiles(prev => [...prev, ...filtered].slice(0, 5)); // Max 5 spreadsheet files
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Step 1 -> Step 2: Trigger Backend Staging Analysis
  const handleAnalyzeFiles = async () => {
    if (files.length === 0) {
      setErrorMessage('Please upload at least one Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setAnalyzing(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('businessDate', businessDate);
      formData.append('shopId', selectedShop?.id);
      files.forEach(f => {
        formData.append('files', f);
      });

      const response = await apiClient.post('/inventory/daily-stock/import/analyze', formData, {
        headers: {
          'x-shop-id': selectedShop?.id,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.success && response.data) {
        setFileSummaries(response.data.fileSummaries || []);
        setStagedRows(response.data.rows || []);
        setMasterBrands(response.data.masterData?.brands || []);
        setMasterSizes(response.data.masterData?.sizes || []);
        setExistingRecordCount(response.data.existingRecordCount || 0);
        setCurrentStep(2); // Advance to preview
      } else {
        setErrorMessage(response.message || 'Failed to analyze uploaded spreadsheets.');
      }
    } catch (err) {
      console.error('Import analysis error:', err);
      setErrorMessage(err?.message || 'Server error while analyzing spreadsheet data.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Cell editing & instant math recalculation in Step 2
  const handleRowChange = (rowId, field, value) => {
    setStagedRows(prevRows => {
      return prevRows.map(row => {
        if (row.id !== rowId) return row;

        const updated = { ...row, [field]: value };

        // Recalculate brand if selected from dropdown
        if (field === 'brandId') {
          const brandObj = masterBrands.find(b => b.id === value);
          updated.brandName = brandObj ? brandObj.name : '';
        }

        // Recalculate size if selected from dropdown
        if (field === 'sizeId') {
          const sizeObj = masterSizes.find(s => s.id === value);
          updated.sizeCode = sizeObj ? sizeObj.code : '';
        }

        // Parse numerical values
        const opening = Math.max(0, parseInt(updated.openingStock, 10) || 0);
        const indent = Math.max(0, parseInt(updated.indentStock, 10) || 0);
        const closing = Math.max(0, parseInt(updated.closingStock, 10) || 0);
        const rate = parseFloat(updated.bottleRate) || 0;
        const extra = parseFloat(updated.extraAmount) || 0;

        const total = opening + indent;
        const sale = Math.max(0, total - closing);
        const stockValue = parseFloat((total * rate).toFixed(2));
        const saleAmount = parseFloat((sale * rate).toFixed(2));

        updated.openingStock = opening;
        updated.indentStock = indent;
        updated.totalStock = total;
        updated.closingStock = closing;
        updated.saleCount = sale;
        updated.bottleRate = rate;
        updated.stockValue = stockValue;
        updated.saleAmount = saleAmount;
        updated.extraAmount = extra;

        // Validation rule check
        const issues = [];
        if (!updated.brandId) issues.push('Please select a valid Brand');
        if (!updated.sizeId) issues.push('Please select a valid Size');
        if (closing > total) issues.push(`Closing (${closing}) exceeds Total (${total})`);

        updated.validationIssues = issues;
        if (issues.length > 0) {
          updated.status = issues.some(i => i.includes('exceeds')) ? 'INVALID' : 'NEEDS_REVIEW';
        } else {
          updated.status = 'VERIFIED';
        }

        return updated;
      });
    });
  };

  const handleDeleteRow = (rowId) => {
    setStagedRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleAddNewRow = () => {
    const defaultBrand = masterBrands[0] || null;
    const defaultSize = masterSizes[0] || null;
    const newRow = {
      id: `manual_${Date.now()}`,
      sourceFileName: 'Manual Entry',
      sourcePageIndex: 1,
      brandId: defaultBrand ? defaultBrand.id : '',
      brandName: defaultBrand ? defaultBrand.name : '',
      sizeId: defaultSize ? defaultSize.id : '',
      sizeCode: defaultSize ? defaultSize.code : '',
      openingStock: 0,
      indentStock: 0,
      totalStock: 0,
      closingStock: 0,
      saleCount: 0,
      bottleRate: 0,
      stockValue: 0,
      saleAmount: 0,
      extraAmount: 0,
      status: defaultBrand && defaultSize ? 'VERIFIED' : 'NEEDS_REVIEW',
      validationIssues: []
    };
    setStagedRows(prev => [newRow, ...prev]);
  };

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalRows = stagedRows.length;
    const verified = stagedRows.filter(r => r.status === 'VERIFIED').length;
    const needsReview = stagedRows.filter(r => r.status === 'NEEDS_REVIEW' || r.status === 'BRAND_NOT_FOUND' || r.status === 'SIZE_NOT_FOUND').length;
    const invalid = stagedRows.filter(r => r.status === 'INVALID').length;
    const duplicate = stagedRows.filter(r => r.status === 'DUPLICATE').length;

    let totalBottlesSold = 0;
    let totalSaleAmount = 0;
    let totalStockValue = 0;

    stagedRows.forEach(r => {
      if (r.status !== 'INVALID') {
        totalBottlesSold += (r.saleCount || 0);
        totalSaleAmount += (r.saleAmount || 0);
        totalStockValue += (r.stockValue || 0);
      }
    });

    return {
      totalRows,
      verified,
      needsReview,
      invalid,
      duplicate,
      totalBottlesSold,
      totalSaleAmount: totalSaleAmount.toFixed(2),
      totalStockValue: totalStockValue.toFixed(2)
    };
  }, [stagedRows]);

  // Filtered rows for the editable ledger grid
  const filteredRows = useMemo(() => {
    return stagedRows.filter(r => {
      if (filterStatus === 'VERIFIED' && r.status !== 'VERIFIED') return false;
      if (filterStatus === 'NEEDS_REVIEW' && r.status !== 'NEEDS_REVIEW' && r.status !== 'BRAND_NOT_FOUND' && r.status !== 'SIZE_NOT_FOUND') return false;
      if (filterStatus === 'INVALID' && r.status !== 'INVALID') return false;

      if (searchBrand.trim()) {
        const query = searchBrand.toLowerCase();
        const brandMatch = (r.brandName || r.rawBrand || '').toLowerCase().includes(query);
        const sizeMatch = (r.sizeCode || r.rawSize || '').toLowerCase().includes(query);
        if (!brandMatch && !sizeMatch) return false;
      }
      return true;
    });
  }, [stagedRows, filterStatus, searchBrand]);

  // Step 2 -> Step 3: Advance to Final Confirmation
  const handleProceedToConfirmation = () => {
    if (summaryMetrics.invalid > 0) {
      setErrorMessage(`Please correct the ${summaryMetrics.invalid} invalid row(s) (e.g. closing count exceeding total) before importing.`);
      return;
    }
    if (stagedRows.length === 0) {
      setErrorMessage('No rows available to import.');
      return;
    }
    setErrorMessage('');
    setCurrentStep(3);
  };

  // Step 3: Atomic Confirmation Commit to Database
  const handleConfirmAndImport = async () => {
    if (!operatorConfirmed) {
      setErrorMessage('Please check the verification acknowledgement box before confirming.');
      return;
    }

    setImporting(true);
    setErrorMessage('');

    try {
      const payload = {
        businessDate,
        shopId: selectedShop?.id,
        importMode,
        status: importStatus,
        items: stagedRows
      };

      const response = await apiClient.post('/inventory/daily-stock/import/confirm', payload, {
        headers: { 'x-shop-id': selectedShop?.id }
      });

      if (response.success) {
        onImportSuccess?.(response.data);
        onClose();
      } else {
        setErrorMessage(response.message || 'Failed to commit stock import.');
      }
    } catch (err) {
      console.error('Final import commit error:', err);
      setErrorMessage(err?.message || 'Server error while saving imported stock sheet.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Stepper */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Import Spreadsheet Stock Sheet
                <span className="text-xs font-normal text-slate-500">
                  ({selectedShop?.name || 'Active Shop'} • {businessDate})
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Excel & CSV import with mandatory preview & verification before database write
              </p>
            </div>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
              currentStep === 1 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' : 'text-slate-500'
            }`}>
              <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[10px]">1</span>
              <span>Upload</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
              currentStep === 2 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' : 'text-slate-500'
            }`}>
              <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[10px]">2</span>
              <span>Verify & Edit</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
              currentStep === 3 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' : 'text-slate-500'
            }`}>
              <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[10px]">3</span>
              <span>Confirm & Save</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Wizard Step Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* STEP 1: UPLOAD & STAGE */}
          {currentStep === 1 && (
            <div className="space-y-5">
              {/* Target Meta Config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <span className="text-slate-500">Destination Shop:</span>
                    <strong className="block text-slate-800">{selectedShop?.name || 'Selected Shop'} ({selectedShop?.code || '—'})</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="flex-1">
                    <span className="text-slate-500">Target Stock Date:</span>
                    <input
                      type="date"
                      value={businessDate}
                      onChange={(e) => setBusinessDate(e.target.value)}
                      className="block mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Drag and Drop Zone (Excel and CSV only) */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                  isDraggingFile
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="mx-auto w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Drag & Drop stock spreadsheets here, or <span className="text-teal-700 underline font-semibold">browse files</span>
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Upload daily stock Excel spreadsheets (.xlsx, .xls) or CSV files. Values will be parsed, matched to Brand and Size Masters, and verified.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 font-medium">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-teal-800">
                    Excel (.xlsx, .xls)
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-teal-800">
                    CSV (.csv)
                  </span>
                </div>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Selected Spreadsheets ({files.length} / 5)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 block truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx); }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety Notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">Zero Direct Save Guarantee:</span>
                  <p className="text-[11px] text-amber-800">
                    Clicking "Analyze & Preview" only parses spreadsheet rows into an editable workspace. No stock balances or closing entries will be saved to production records until you review the calculations and explicitly confirm.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: STAGED PREVIEW & EDITABLE FULL-WIDTH LEDGER GRID */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Extracted Rows</span>
                  <p className="text-base font-bold text-slate-800 font-mono mt-0.5">{summaryMetrics.totalRows}</p>
                </div>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Verified</span>
                  <p className="text-base font-bold text-emerald-700 font-mono mt-0.5">{summaryMetrics.verified}</p>
                </div>
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Needs Review</span>
                  <p className="text-base font-bold text-amber-700 font-mono mt-0.5">{summaryMetrics.needsReview}</p>
                </div>
                <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Invalid</span>
                  <p className="text-base font-bold text-rose-700 font-mono mt-0.5">{summaryMetrics.invalid}</p>
                </div>
                <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-sky-700 uppercase">Bottles Sold</span>
                  <p className="text-base font-bold text-sky-700 font-mono mt-0.5">{summaryMetrics.totalBottlesSold}</p>
                </div>
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">Total Sales</span>
                  <p className="text-base font-bold text-indigo-700 font-mono mt-0.5">₹{summaryMetrics.totalSaleAmount}</p>
                </div>
              </div>

              {/* Full Width Ledger Table */}
              <div className="flex flex-col space-y-3">
                {/* Ledger Toolbar & Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  {/* Status Filters */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterStatus === 'ALL'
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({summaryMetrics.totalRows})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('NEEDS_REVIEW')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterStatus === 'NEEDS_REVIEW'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      Review ({summaryMetrics.needsReview})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('INVALID')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterStatus === 'INVALID'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Invalid ({summaryMetrics.invalid})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('VERIFIED')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterStatus === 'VERIFIED'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Verified ({summaryMetrics.verified})
                    </button>
                  </div>

                  {/* Search & Add Row */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                      <input
                        type="text"
                        value={searchBrand}
                        onChange={(e) => setSearchBrand(e.target.value)}
                        placeholder="Search brand/size..."
                        className="pl-8 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewRow}
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-medium shadow-xs transition-colors"
                      title="Add row manually"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>

                {/* Grid Table Container */}
                <div className="table-grid-wrapper max-h-[460px] overflow-y-auto">
                  <table className="table-grid w-full text-xs">
                    <thead>
                      <tr>
                        <th className="w-8 text-center">#</th>
                        <th className="min-w-[150px]">Brand</th>
                        <th className="min-w-[80px]">Size</th>
                        <th className="w-16 text-right">Opening</th>
                        <th className="w-16 text-right">Indent</th>
                        <th className="w-16 text-right bg-slate-100">Total</th>
                        <th className="w-16 text-right">Closing</th>
                        <th className="w-16 text-right bg-emerald-50 text-emerald-800">Sale</th>
                        <th className="w-16 text-right">Rate</th>
                        <th className="w-20 text-right">Stock Value</th>
                        <th className="w-20 text-right">Amount</th>
                        <th className="w-16 text-right">Extra Amt</th>
                        <th className="w-16 text-center">Status</th>
                        <th className="w-8 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="text-center py-6 text-slate-400 italic">
                            No records match the current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => {
                          const isInvalid = row.status === 'INVALID';
                          const needsReview = row.status === 'NEEDS_REVIEW' || row.status === 'BRAND_NOT_FOUND' || row.status === 'SIZE_NOT_FOUND';

                          return (
                            <tr
                              key={row.id}
                              className={`transition-colors ${
                                isInvalid ? 'bg-rose-50/50' : needsReview ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Brand Selector */}
                              <td>
                                {masterBrands.length > 0 ? (
                                  <select
                                    value={row.brandId || ''}
                                    onChange={(e) => handleRowChange(row.id, 'brandId', e.target.value)}
                                    className={`w-full px-1.5 py-1 text-xs rounded border ${
                                      !row.brandId ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold' : 'border-slate-200 bg-white'
                                    } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                                  >
                                    <option value="">-- Choose Brand --</option>
                                    {masterBrands.map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="font-semibold text-slate-800">{row.brandName || row.rawBrand}</span>
                                )}
                              </td>

                              {/* Size Selector */}
                              <td>
                                {masterSizes.length > 0 ? (
                                  <select
                                    value={row.sizeId || ''}
                                    onChange={(e) => handleRowChange(row.id, 'sizeId', e.target.value)}
                                    className={`w-full px-1 py-1 text-xs rounded border ${
                                      !row.sizeId ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold' : 'border-slate-200 bg-white'
                                    } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                                  >
                                    <option value="">-- Size --</option>
                                    {masterSizes.map(s => (
                                      <option key={s.id} value={s.id}>{s.code}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="font-mono text-slate-600">{row.sizeCode || row.rawSize}</span>
                                )}
                              </td>

                              {/* Opening */}
                              <td className="text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.openingStock}
                                  onChange={(e) => handleRowChange(row.id, 'openingStock', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              {/* Indent */}
                              <td className="text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.indentStock}
                                  onChange={(e) => handleRowChange(row.id, 'indentStock', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              {/* Total (Calculated) */}
                              <td className="text-right font-mono font-bold text-slate-800 bg-slate-100">
                                {row.totalStock}
                              </td>

                              {/* Closing */}
                              <td className="text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.closingStock}
                                  onChange={(e) => handleRowChange(row.id, 'closingStock', e.target.value)}
                                  className={`w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border ${
                                    row.closingStock > row.totalStock
                                      ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold'
                                      : 'border-slate-200'
                                  } focus:outline-none focus:ring-1 focus:ring-emerald-500`}
                                />
                              </td>

                              {/* Sale (Calculated) */}
                              <td className="text-right font-mono font-bold bg-emerald-50 text-emerald-800">
                                {row.saleCount}
                              </td>

                              {/* Rate */}
                              <td className="text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.bottleRate}
                                  onChange={(e) => handleRowChange(row.id, 'bottleRate', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              {/* Stock Value */}
                              <td className="text-right font-mono text-slate-600">
                                ₹{row.stockValue?.toFixed(2)}
                              </td>

                              {/* Sale Amount (Calculated) */}
                              <td className="text-right font-mono font-bold text-slate-800">
                                ₹{row.saleAmount?.toFixed(2)}
                              </td>

                              {/* Extra Amount */}
                              <td className="text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={row.extraAmount}
                                  onChange={(e) => handleRowChange(row.id, 'extraAmount', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  title="Informational only (excluded from total business)"
                                />
                              </td>

                              {/* Status Chip */}
                              <td className="text-center">
                                {isInvalid ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 cursor-help"
                                    title={row.validationIssues?.join('\n') || 'Invalid calculation'}
                                  >
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    Error
                                  </span>
                                ) : needsReview ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 cursor-help"
                                    title={row.validationIssues?.join('\n') || 'Needs review'}
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    Review
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    OK
                                  </span>
                                )}
                              </td>

                              {/* Delete Row */}
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(row.id)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  title="Delete row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRE-IMPORT RECONCILIATION & CONFIRMATION */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800">Final Verification & Reconciliation</h4>
                <p className="text-xs text-slate-500">
                  Please review the aggregated spreadsheet import summary below before committing changes into the daily stock register.
                </p>
              </div>

              {/* Summary Reconciliation Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">Target Shop:</span>
                    <strong className="text-slate-800 font-semibold">{selectedShop?.name || 'Selected Shop'} ({selectedShop?.code || '—'})</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Business Date:</span>
                    <strong className="text-slate-800 font-mono font-semibold">{businessDate}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center py-1">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Approved Items</span>
                    <strong className="text-lg font-bold text-slate-800 font-mono">{summaryMetrics.totalRows}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Bottles Sold</span>
                    <strong className="text-lg font-bold text-emerald-700 font-mono">{summaryMetrics.totalBottlesSold}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Sales</span>
                    <strong className="text-lg font-bold text-indigo-700 font-mono">₹{summaryMetrics.totalSaleAmount}</strong>
                  </div>
                </div>

                {/* Conflict / Existing Records Strategy */}
                {existingRecordCount > 0 && (
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Notice: {existingRecordCount} stock record(s) already exist for this date.</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        importMode === 'merge' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <strong className="block text-slate-800">Merge & Update</strong>
                          <span className="text-[10px] text-slate-500">Update existing entries</span>
                        </div>
                      </label>

                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        importMode === 'append_only' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'append_only'}
                          onChange={() => setImportMode('append_only')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <strong className="block text-slate-800">Append Only</strong>
                          <span className="text-[10px] text-slate-500">Skip existing brand rows</span>
                        </div>
                      </label>

                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                        importMode === 'replace' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200 bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <strong className="block text-slate-800">Replace All</strong>
                          <span className="text-[10px] text-slate-500">Overwrite day's draft</span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Import Status Choice */}
                <div className="pt-2 text-xs flex items-center justify-between">
                  <span className="text-slate-600">Save imported records as:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importStatus"
                        checked={importStatus === 'DRAFT'}
                        onChange={() => setImportStatus('DRAFT')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-700">Draft (In Progress)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importStatus"
                        checked={importStatus === 'COMPLETED'}
                        onChange={() => setImportStatus('COMPLETED')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-700">Completed (Finalized)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Explicit Affirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={operatorConfirmed}
                  onChange={(e) => setOperatorConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-emerald-950 font-medium">
                  I confirm that I have verified the extracted values against the uploaded spreadsheet, and all totals, closing counts, and rates are verified.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setCurrentStep(prev => prev - 1);
                }}
                disabled={analyzing || importing}
                className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{currentStep === 3 ? 'Back to Verification' : 'Back to Upload'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={analyzing || importing}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleAnalyzeFiles}
                disabled={files.length === 0 || analyzing}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Spreadsheet...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze & Preview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleProceedToConfirmation}
                disabled={stagedRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <span>Proceed to Confirmation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleConfirmAndImport}
                disabled={!operatorConfirmed || importing}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing Records...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Import Stock</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyStockImportModal;
