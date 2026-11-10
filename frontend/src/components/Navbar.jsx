import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBusinessDate } from '../context/DateContext';
import { Store, Menu, Calendar } from 'lucide-react';
import ThemeSelector from './ThemeSelector';

const Navbar = ({ title, onToggleSidebar }) => {
  const { user, shops, selectedShop, switchShop } = useAuth();
  const { activeTheme } = useTheme();
  const { businessDate, setBusinessDate, resetToToday, isToday } = useBusinessDate();

  const handleShopChange = (e) => {
    const shopId = e.target.value;
    const found = shops.find((s) => s.id === shopId);
    if (found) {
      switchShop(found);
    }
  };

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-2 sm:px-4 md:px-6 flex items-center justify-between text-slate-800 sticky top-0 z-30 shrink-0 shadow-xs gap-1.5 sm:gap-3">
      {/* Left side: Hamburger Toggle (Mobile/Tablet) + Title (Desktop/Tablet) */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 md:flex-1 md:min-w-0">
        {/* Mobile Hamburger Menu Toggle - NEVER shrunk, guaranteed visible on mobile & tablet */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 sm:p-2 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all shrink-0 active:scale-95 shadow-2xs cursor-pointer"
          aria-label="Open navigation menu"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Title: hidden on mobile to give room to shop & date controls, visible on md+ */}
        <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 truncate hidden md:block">
          {title}
        </h2>
      </div>

      {/* Right side: Shop Selector + Global Business Date Picker + Theme Selector + Gateway Status */}
      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-3 shrink-0">
        {/* Shop Selector Dropdown */}
        {shops && shops.length > 1 ? (
          <div
            className="flex items-center gap-1 sm:gap-2 bg-slate-50 border rounded-xl px-1.5 sm:px-2.5 py-1 sm:py-1.5 shadow-2xs max-w-[110px] xs:max-w-[145px] sm:max-w-[190px] md:max-w-none transition-colors"
            style={{ borderColor: activeTheme.border }}
          >
            <Store
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
              style={{ color: activeTheme.primary }}
            />
            <div className="flex flex-col min-w-0">
              <span
                className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-none hidden sm:inline"
                style={{ color: activeTheme.primary }}
              >
                Active Shop
              </span>
              <select
                value={selectedShop?.id || ''}
                onChange={handleShopChange}
                className="bg-transparent text-slate-800 font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer truncate pr-0.5 sm:pr-1"
                aria-label="Select active wine shop"
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id} className="bg-white text-slate-800 py-1">
                    {shop.name} ({shop.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : selectedShop ? (
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs max-w-[110px] xs:max-w-[140px] sm:max-w-none">
            <Store
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
              style={{ color: activeTheme.primary }}
            />
            <span className="font-semibold text-slate-800 truncate text-[11px] sm:text-xs">
              {selectedShop.name}
            </span>
          </div>
        ) : null}

        {/* Global Business Date Selector in Header */}
        <div
          className="flex items-center gap-1 sm:gap-2 bg-slate-50 border rounded-xl px-1.5 sm:px-2.5 py-1 sm:py-1.5 shadow-2xs transition-colors"
          style={{ borderColor: activeTheme.border }}
        >
          <Calendar
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
            style={{ color: activeTheme.primary }}
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span
                className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider leading-none hidden sm:inline"
                style={{ color: activeTheme.primary }}
              >
                Date
              </span>
              {!isToday && (
                <button
                  type="button"
                  onClick={resetToToday}
                  className="text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors leading-none cursor-pointer"
                  title="Jump to today"
                >
                  Today
                </button>
              )}
            </div>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => {
                if (e.target.value) setBusinessDate(e.target.value);
              }}
              className="bg-transparent text-slate-800 font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer w-[95px] xs:w-[105px] sm:w-[125px]"
              aria-label="Select global business date"
            />
          </div>
        </div>

        {/* Dynamic Theme Color Selector in Navbar */}
        <ThemeSelector variant="navbar" />

        <span className="hidden md:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Gateway: <strong className="text-slate-800 font-semibold ml-0.5">Online</strong>
        </span>
      </div>
    </header>
  );
};

export default Navbar;
