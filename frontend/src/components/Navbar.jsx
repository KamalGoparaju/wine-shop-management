import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Menu } from 'lucide-react';

const Navbar = ({ title, onToggleSidebar }) => {
  const { user, shops, selectedShop, switchShop } = useAuth();

  const handleShopChange = (e) => {
    const shopId = e.target.value;
    const found = shops.find(s => s.id === shopId);
    if (found) {
      switchShop(found);
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between text-white sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-sm sm:text-lg font-bold tracking-tight text-slate-100 truncate">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Shop Selector Dropdown */}
        {shops && shops.length > 1 ? (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950 border border-amber-600/50 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 shadow-md shadow-amber-950/20 max-w-[180px] sm:max-w-none">
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-amber-400/80 font-bold uppercase tracking-wider leading-none hidden xs:inline">
                Active Shop
              </span>
              <select
                value={selectedShop?.id || ''}
                onChange={handleShopChange}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer truncate pr-1"
                aria-label="Select active wine shop"
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id} className="bg-slate-900 text-white py-1">
                    {shop.name} ({shop.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : selectedShop ? (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs">
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
            <span className="font-semibold text-white truncate max-w-[120px] sm:max-w-none">{selectedShop.name}</span>
          </div>
        ) : null}

        <span className="hidden md:inline-flex text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700">
          Gateway: <strong className="text-amber-400 ml-1">Connected</strong>
        </span>
      </div>
    </header>
  );
};

export default Navbar;
