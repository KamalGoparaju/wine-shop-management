import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'green',
    name: 'Emerald Green',
    primary: '#059669',
    hover: '#047857',
    active: '#065F46',
    light: '#ECFDF5',
    border: '#A7F3D0',
    ring: 'rgba(5, 150, 105, 0.25)',
    rgb: '5, 150, 105',
    label: 'Green'
  },
  {
    id: 'blue',
    name: 'Classic Blue',
    primary: '#2675D8',
    hover: '#1D4ED8',
    active: '#1E40AF',
    light: '#EFF6FF',
    border: '#BFDBFE',
    ring: 'rgba(38, 117, 216, 0.25)',
    rgb: '38, 117, 216',
    label: 'Blue'
  },
  {
    id: 'orange',
    name: 'Warm Orange',
    primary: '#EA580C',
    hover: '#C2410C',
    active: '#9A3412',
    light: '#FFF7ED',
    border: '#FED7AA',
    ring: 'rgba(234, 88, 12, 0.25)',
    rgb: '234, 88, 12',
    label: 'Orange'
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    primary: '#7C3AED',
    hover: '#6D28D9',
    active: '#5B21B6',
    light: '#F5F3FF',
    border: '#DDD6FE',
    ring: 'rgba(124, 58, 237, 0.25)',
    rgb: '124, 58, 237',
    label: 'Purple'
  },
  {
    id: 'teal',
    name: 'Deep Teal',
    primary: '#0F8175',
    hover: '#0D6E64',
    active: '#115E59',
    light: '#F0FDFA',
    border: '#99F6E4',
    ring: 'rgba(15, 129, 117, 0.25)',
    rgb: '15, 129, 117',
    label: 'Teal'
  },
  {
    id: 'pink',
    name: 'Rose Pink',
    primary: '#C2185B',
    hover: '#AD1457',
    active: '#880E4F',
    light: '#FDF2F8',
    border: '#FBCFE8',
    ring: 'rgba(194, 24, 91, 0.25)',
    rgb: '194, 24, 91',
    label: 'Pink'
  }
];

const ThemeContext = createContext();

export const applyThemeToDocument = (theme) => {
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-primary-hover', theme.hover);
  root.style.setProperty('--color-primary-active', theme.active);
  root.style.setProperty('--color-primary-light', theme.light);
  root.style.setProperty('--color-primary-border', theme.border);
  root.style.setProperty('--color-primary-ring', theme.ring);
  root.style.setProperty('--color-primary-rgb', theme.rgb);
  root.setAttribute('data-theme', theme.id);
};

export const ThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('wine_shop_accent_theme') || 'green';
  });

  const activeTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  useEffect(() => {
    applyThemeToDocument(activeTheme);
    localStorage.setItem('wine_shop_accent_theme', activeTheme.id);
  }, [activeTheme]);

  const selectTheme = (id) => {
    const matched = THEMES.find((t) => t.id === id);
    if (matched) {
      setThemeId(matched.id);
      applyThemeToDocument(matched);
      localStorage.setItem('wine_shop_accent_theme', matched.id);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        activeTheme,
        themeId: activeTheme.id,
        selectTheme,
        themes: THEMES
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
