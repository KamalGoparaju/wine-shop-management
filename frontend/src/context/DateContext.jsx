import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DateContext = createContext(null);

export const getTodayLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DateProvider = ({ children }) => {
  const [businessDate, setBusinessDateState] = useState(() => {
    try {
      const saved = localStorage.getItem('wine_shop_business_date');
      // Validate saved date format YYYY-MM-DD
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch {
      // Fallback if localStorage unavailable
    }
    return getTodayLocal();
  });

  const setBusinessDate = useCallback((newDate) => {
    if (!newDate) return;
    setBusinessDateState(newDate);
    try {
      localStorage.setItem('wine_shop_business_date', newDate);
    } catch (err) {
      console.warn('Failed to persist business date to localStorage:', err);
    }
  }, []);

  const todayStr = getTodayLocal();
  const isToday = businessDate === todayStr;

  const resetToToday = useCallback(() => {
    setBusinessDate(getTodayLocal());
  }, [setBusinessDate]);

  return (
    <DateContext.Provider
      value={{
        businessDate,
        setBusinessDate,
        resetToToday,
        getTodayLocal,
        isToday
      }}
    >
      {children}
    </DateContext.Provider>
  );
};

export const useBusinessDate = () => {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useBusinessDate must be used within a DateProvider');
  }
  return context;
};

export default DateContext;
