import React, { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [shops, setShops] = useState(() => {
    const savedShops = localStorage.getItem('shops');
    return savedShops ? JSON.parse(savedShops) : [];
  });
  const [selectedShop, setSelectedShop] = useState(() => {
    const savedShop = localStorage.getItem('selectedShop');
    return savedShop ? JSON.parse(savedShop) : null;
  });
  const [loading, setLoading] = useState(true);

  // Sync shops and maintain valid selectedShop
  const syncShops = (newShops) => {
    if (!Array.isArray(newShops)) return;
    setShops(newShops);
    localStorage.setItem('shops', JSON.stringify(newShops));

    if (newShops.length > 0) {
      const currentShopId = selectedShop?.id;
      const matched = newShops.find(s => s.id === currentShopId);
      const active = matched || newShops[0];
      setSelectedShop(active);
      localStorage.setItem('selectedShop', JSON.stringify(active));
    } else {
      setSelectedShop(null);
      localStorage.removeItem('selectedShop');
    }
  };

  useEffect(() => {
    if (token) {
      apiClient.get('/auth/me')
        .then((res) => {
          if (res.success) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            if (res.data.shops) {
              syncShops(res.data.shops);
            }
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.shops) {
        syncShops(res.data.shops);
      }
    }
    return res;
  };

  const switchShop = (shop) => {
    if (!shop || !shop.id) return;
    setSelectedShop(shop);
    localStorage.setItem('selectedShop', JSON.stringify(shop));
  };

  const refreshShops = async () => {
    try {
      const res = await apiClient.get('/auth/shops');
      if (res.success && res.data?.shops) {
        syncShops(res.data.shops);
        return res.data.shops;
      }
    } catch (err) {
      console.error('Failed to refresh shops:', err);
    }
    return [];
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setShops([]);
    setSelectedShop(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('shops');
    localStorage.removeItem('selectedShop');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        shops,
        selectedShop,
        switchShop,
        refreshShops,
        login,
        logout,
        loading,
        isAdmin: user?.role === 'ADMIN'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
