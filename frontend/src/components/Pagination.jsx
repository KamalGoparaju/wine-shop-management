import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * Reusable Server-Side Pagination Component
 * 
 * Supports:
 * - Dynamic page size selection [10, 25, 50, 100]
 * - Showing X-Y of Z records range display
 * - Smart page windowing with ellipsis
 * - Responsive desktop / mobile compact layouts
 * - Dynamic accent color integration from activeTheme
 */
const Pagination = ({
  pagination = {},
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
  disabled = false,
  className = ''
}) => {
  const { activeTheme } = useTheme();

  const {
    page = 1,
    limit = 25,
    totalRecords = 0,
    totalPages = 1,
    hasNextPage = false,
    hasPreviousPage = false
  } = pagination;

  if (!totalRecords || totalRecords <= 0) {
    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
        <div>No records found</div>
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
            disabled={disabled}
            className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div 
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 select-none ${className}`}
    >
      {/* Left: Record Range */}
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span>
          Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startRecord}</span> to{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{endRecord}</span> of{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{totalRecords}</span> records
        </span>
      </div>

      {/* Middle: Rows Per Page */}
      <div className="flex items-center gap-2">
        <label htmlFor="pagination-page-size" className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
          Rows per page:
        </label>
        <select
          id="pagination-page-size"
          value={limit}
          onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
          disabled={disabled}
          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 text-xs cursor-pointer disabled:opacity-50"
          style={{ '--tw-ring-color': activeTheme?.primary || '#059669' }}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Page Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(1)}
          disabled={!hasPreviousPage || disabled}
          aria-label="First Page"
          title="First Page"
          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(page - 1)}
          disabled={!hasPreviousPage || disabled}
          aria-label="Previous Page"
          title="Previous Page"
          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Mobile Page Indicator */}
        <div className="sm:hidden px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
          Page {page} of {totalPages}
        </div>

        {/* Desktop Page Numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-slate-400 dark:text-slate-500 font-bold"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange && onPageChange(p)}
                disabled={disabled}
                aria-current={isCurrent ? 'page' : undefined}
                className={`min-w-[28px] h-7 px-2 flex items-center justify-center rounded-md text-xs font-semibold transition-all ${
                  isCurrent
                    ? 'text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={
                  isCurrent
                    ? {
                        backgroundColor: activeTheme?.primary || '#059669',
                        borderColor: activeTheme?.primary || '#059669'
                      }
                    : undefined
                }
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(page + 1)}
          disabled={!hasNextPage || disabled}
          aria-label="Next Page"
          title="Next Page"
          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(totalPages)}
          disabled={!hasNextPage || disabled}
          aria-label="Last Page"
          title="Last Page"
          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
