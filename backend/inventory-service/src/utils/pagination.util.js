/**
 * Centralized Server-Side Pagination & Sorting Utility
 * Validates query parameters, builds Prisma skip/take/orderBy clauses,
 * and generates standard pagination metadata.
 */

const ALLOWED_LIMITS = [10, 25, 50, 100];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Parses and sanitizes page and limit query parameters.
 * @param {Object} query - Express req.query
 * @param {number} defaultLimit - Default limit if not specified (default: 25)
 * @returns {Object} { page, limit, skip, take, isPaginated }
 */
const parsePaginationParams = (query = {}, defaultLimit = DEFAULT_LIMIT) => {
  // If explicitly requested unpaginated (e.g. limit=all or internal lookup)
  if (query.limit === 'all') {
    return {
      page: 1,
      limit: 'all',
      skip: undefined,
      take: undefined,
      isPaginated: false
    };
  }

  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const skip = (page - 1) * limit;
  const take = limit;

  return {
    page,
    limit,
    skip,
    take,
    isPaginated: true
  };
};

/**
 * Builds safe, deterministic Prisma orderBy array with allowed sort fields whitelist
 * and a unique tie-breaker field.
 * @param {Object} options
 * @param {string} options.sortBy - Requested field to sort by
 * @param {string} options.sortOrder - 'asc' or 'desc'
 * @param {Array<string>} options.allowedFields - Whitelist of allowed field names
 * @param {string} options.defaultSortBy - Default sort field
 * @param {string} options.defaultSortOrder - Default order ('asc' or 'desc')
 * @param {string} options.tieBreaker - Stable unique tie-breaker field (default: 'id')
 * @returns {Array<Object>} Prisma orderBy array
 */
const buildSortClause = ({
  sortBy,
  sortOrder,
  allowedFields = [],
  defaultSortBy = 'createdAt',
  defaultSortOrder = 'asc',
  tieBreaker = 'id'
}) => {
  const cleanOrder = (sortOrder && sortOrder.toLowerCase() === 'desc') ? 'desc' : 'asc';
  
  let primaryField = defaultSortBy;
  let primaryOrder = defaultSortOrder;

  if (sortBy && allowedFields.includes(sortBy)) {
    primaryField = sortBy;
    primaryOrder = cleanOrder;
  }

  const orderBy = [];
  orderBy.push({ [primaryField]: primaryOrder });

  // Add deterministic tie-breaker if not already the primary field
  if (tieBreaker && primaryField !== tieBreaker) {
    orderBy.push({ [tieBreaker]: 'asc' });
  }

  return orderBy;
};

/**
 * Generates standardized pagination metadata response.
 * @param {number} totalRecords - Total matching records count
 * @param {number} page - Current page number
 * @param {number|string} limit - Records per page
 * @returns {Object} Standard pagination metadata
 */
const buildPaginationMetadata = (totalRecords = 0, page = 1, limit = DEFAULT_LIMIT) => {
  if (limit === 'all') {
    return {
      page: 1,
      limit: totalRecords,
      totalRecords,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return {
    page: currentPage,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  };
};

module.exports = {
  ALLOWED_LIMITS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePaginationParams,
  buildSortClause,
  buildPaginationMetadata
};
