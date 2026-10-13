import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Downloads a binary file (PDF, CSV) securely with auth headers and shop scoping.
 * @param {string} endpoint - API path relative to baseURL or full path, e.g. '/inventory/daily-stock/export/pdf'
 * @param {object} params - Query parameters, e.g. { date, shopId }
 * @param {string} fallbackFilename - Fallback filename if Content-Disposition is missing
 */
export const downloadAuthenticatedFile = async (endpoint, params = {}, fallbackFilename = 'report') => {
  const token = localStorage.getItem('token');
  const savedShop = localStorage.getItem('selectedShop');
  let shopId = params.shopId;
  
  if (!shopId && savedShop) {
    try {
      shopId = JSON.parse(savedShop)?.id;
    } catch (e) {}
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await axios.get(url, {
    params: {
      ...params,
      ...(shopId && { shopId })
    },
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(shopId && { 'x-shop-id': shopId })
    },
    responseType: 'blob'
  });

  // Extract filename from Content-Disposition header if available
  let filename = fallbackFilename;
  const disposition = response.headers['content-disposition'];
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream'
  });

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};
