import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wine, 
  PackageCheck, 
  Box, 
  PlusCircle, 
  BarChart3, 
  LogOut, 
  ShieldCheck,
  ClipboardList,
  Receipt,
  History,
  Store,
  Layers,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen = false, onClose }) => {
  const { user, logout, isAdmin, selectedShop } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Daily Stock', path: '/daily-stock', icon: ClipboardList },
    { name: 'Daily Expenses', path: '/expenses', icon: Receipt },
    { name: 'Closing History', path: '/closing-history', icon: History },
    { name: 'Shop Management', path: '/shops', icon: Store, adminOnly: true },
    { name: 'Brands', path: '/brands', icon: Wine, adminOnly: true },
    { name: 'Size Master', path: '/sizes', icon: Layers, adminOnly: true },
    { name: 'Products', path: '/products', icon: PackageCheck },
    { name: 'Stock Entry', path: '/stock/entry', icon: PlusCircle, adminOnly: true },
    { name: 'Inventory Stock', path: '/stock/list', icon: Box },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
  ];

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Mobile Drawer Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-amber-900/30 shrink-0">
              🍷
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-white text-base sm:text-lg leading-tight truncate">Wine Shop</h1>
              <p className="text-[11px] text-slate-400 font-medium">Management System</p>
              {selectedShop && (
                <p className="text-[10px] text-amber-400 font-bold truncate mt-0.5">
                  📍 {selectedShop.name}
                </p>
              )}
            </div>
          </div>

          {/* Close button visible only on mobile/tablet */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30 font-semibold'
                      : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 safe-pb">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs sm:text-sm font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-amber-400">
                <ShieldCheck className="w-3 h-3" />
                {user?.role || 'User'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
