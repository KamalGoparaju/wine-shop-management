import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token and x-shop-id
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const savedShop = localStorage.getItem('selectedShop');
    if (savedShop) {
      try {
        const shop = JSON.parse(savedShop);
        if (shop && shop.id) {
          config.headers['x-shop-id'] = shop.id;
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auth errors & error normalization
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    let normalizedError;
    if (error.response) {
      if (typeof error.response.data === 'string') {
        normalizedError = {
          status,
          message:
            status === 502 || status === 503 || status === 504
              ? 'Server is starting up or temporarily busy. Please try again in a few seconds.'
              : error.response.data || 'Server error',
          data: error.response.data
        };
      } else if (error.response.data && typeof error.response.data === 'object') {
        normalizedError = {
          status,
          message: error.response.data.message || error.response.data.error || 'Server request failed',
          ...error.response.data
        };
      } else {
        normalizedError = { status, message: error.message || 'Server error' };
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
      normalizedError = {
        status: 0,
        message: 'Unable to reach the server. The Render backend may be waking up from sleep. Please wait ~30s and try again.'
      };
    } else {
      normalizedError = {
        status: 0,
        message: error.message || 'Network request failed'
      };
    }

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
