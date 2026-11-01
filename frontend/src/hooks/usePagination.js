import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom Hook for Server-Side Pagination, Debounced Search, and Safe Sorting
 * 
 * Features:
 * - Debounces search input (default 350ms) to prevent keystroke API flooding
 * - Automatically resets to page 1 on search, filter, or sort changes
 * - Handles sort column toggling (asc -> desc)
 * - Protects against out-of-order stale API responses using request tracking IDs
 */
export const usePagination = (initialOptions = {}) => {
  const {
    initialPage = 1,
    initialLimit = 25,
    initialSortBy = '',
    initialSortOrder = 'asc',
    initialSearch = '',
    debounceMs = 350
  } = initialOptions;

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const setPaginationMetadata = useCallback((meta) => {
    if (meta) {
      setPagination(prev => ({
        ...prev,
        ...meta,
        page: meta.page !== undefined ? meta.page : prev.page,
        limit: meta.limit !== undefined ? meta.limit : prev.limit,
        totalRecords: meta.totalRecords !== undefined ? meta.totalRecords : prev.totalRecords,
        totalPages: meta.totalPages !== undefined ? meta.totalPages : prev.totalPages,
        hasNextPage: meta.hasNextPage !== undefined ? meta.hasNextPage : prev.hasNextPage,
        hasPreviousPage: meta.hasPreviousPage !== undefined ? meta.hasPreviousPage : prev.hasPreviousPage
      }));
    }
  }, []);

  // Debounce search input and reset to page 1
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [search, debounceMs]);

  // Handle sort column toggle
  const handleSort = useCallback((field) => {
    setSortBy((prevSortBy) => {
      if (prevSortBy === field) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortOrder('asc');
      }
      return field;
    });
    setPage(1);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Handle rows per page change
  const handleLimitChange = useCallback((newLimit) => {
    setLimit(newLimit);
    setPage(1);
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  }, []);

  // Stale response discard protection
  const requestIdRef = useRef(0);
  const getNextRequestId = useCallback(() => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  }, []);

  const isCurrentRequest = useCallback((reqId) => {
    return reqId === requestIdRef.current;
  }, []);

  // Explicit reset to page 1 (for shop switching or custom filter resets)
  const resetPage = useCallback(() => {
    setPage(1);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  return {
    page,
    setPage,
    limit,
    setLimit: handleLimitChange,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    handleSort,
    search,
    setSearch,
    debouncedSearch,
    resetPage,
    getNextRequestId,
    isCurrentRequest,
    pagination,
    setPaginationMetadata,
    setPaginationMeta: setPaginationMetadata,
    paginationParams: {
      page,
      limit,
      search: debouncedSearch.trim() || undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined
    }
  };
};

export default usePagination;
