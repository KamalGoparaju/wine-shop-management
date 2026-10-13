import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store } from 'lucide-react';

const Navbar = ({ title }) => {
  const { user, shops, selectedShop, switchShop } = useAuth();

  const handleShopChange = (e) => {
    const shopId = e.target.value;
    const found = shops.find(s => s.id === shopId);
    if (found) {
      switchShop(found);
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-100">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Shop Selector Dropdown */}
        {shops && shops.length > 1 ? (
          <div className="flex items-center gap-2 bg-slate-950 border border-amber-600/50 rounded-xl px-3.5 py-1.5 shadow-md shadow-amber-950/20">
            <Store className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider leading-none">
                Active Shop
              </span>
              <select
                value={selectedShop?.id || ''}
                onChange={handleShopChange}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1 mt-0.5"
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
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Store className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-white">{selectedShop.name}</span>
          </div>
        ) : null}

        <span className="hidden sm:inline-flex text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Gateway: <strong className="text-amber-400 ml-1">Connected</strong>
        </span>
      </div>
    </header>
  );
};

export default Navbar;
