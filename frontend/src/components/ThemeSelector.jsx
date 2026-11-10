import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Check, Palette } from 'lucide-react';

const ThemeSelector = ({ variant = 'card', className = '' }) => {
  const { activeTheme, selectTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Navbar compact popover variant
  if (variant === 'navbar') {
    return (
      <div className={`relative ${className}`} ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer shadow-2xs"
          title={`Theme: ${activeTheme.name}`}
          aria-label="Change application accent theme"
        >
          <div
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-white shadow-xs shrink-0"
            style={{ backgroundColor: activeTheme.primary }}
          />
          <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 hidden xs:inline shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Accent Theme
              </span>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: activeTheme.light,
                  color: activeTheme.primary
                }}
              >
                {activeTheme.label}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {themes.map((theme) => {
                const isSelected = theme.id === activeTheme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      selectTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-slate-400 scale-105 shadow-sm'
                        : 'hover:scale-110 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: theme.primary }}
                    title={theme.name}
                    aria-label={`Select ${theme.name} theme`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sidebar embedded variant
  if (variant === 'sidebar') {
    return (
      <div className={`p-3 rounded-xl bg-white border border-slate-200 shadow-2xs ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" style={{ color: activeTheme.primary }} />
            Theme Customization
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
            style={{
              backgroundColor: activeTheme.light,
              color: activeTheme.primary,
              borderColor: activeTheme.border
            }}
          >
            {activeTheme.label}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-1.5 pt-0.5">
          {themes.map((theme) => {
            const isSelected = theme.id === activeTheme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                className={`relative w-7 h-7 mx-auto rounded-full flex items-center justify-center transition-all ${
                  isSelected
                    ? 'ring-2 ring-offset-1.5 scale-110 shadow-xs'
                    : 'hover:scale-105 opacity-85 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: theme.primary,
                  outlineColor: isSelected ? theme.primary : 'transparent'
                }}
                title={`${theme.name} (${theme.label})`}
                aria-label={`Select ${theme.name} theme`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Settings Card Variant (Default)
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: activeTheme.primary }} />
            Theme Customization
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select an accent color to personalize the interface while maintaining clean white background clarity.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold self-start sm:self-auto border"
          style={{
            backgroundColor: activeTheme.light,
            color: activeTheme.primary,
            borderColor: activeTheme.border
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: activeTheme.primary }}
          />
          Active: {activeTheme.name}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
        {themes.map((theme) => {
          const isSelected = theme.id === activeTheme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme.id)}
              className={`group flex flex-col items-center gap-1.5 focus:outline-none transition-transform`}
            >
              <div
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-xs ${
                  isSelected
                    ? 'ring-3 ring-offset-2 scale-110 shadow-md'
                    : 'hover:scale-105 opacity-90 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: theme.primary,
                  outlineColor: isSelected ? theme.primary : 'transparent'
                }}
                title={theme.name}
                aria-label={`Select ${theme.name} theme`}
              >
                {isSelected && <Check className="w-5 h-5 text-white stroke-[2.5]" />}
              </div>
              <span
                className={`text-[11px] font-medium transition-colors ${
                  isSelected ? 'font-bold text-slate-900' : 'text-slate-500 group-hover:text-slate-700'
                }`}
              >
                {theme.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
