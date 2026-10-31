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
import { useTheme } from '../context/ThemeContext';

const Sidebar = ({ isOpen = false, onClose }) => {
  const { user, logout, isAdmin, selectedShop } = useAuth();
  const { activeTheme } = useTheme();

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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Mobile Drawer Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 text-slate-700 flex flex-col h-full transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3 overflow-hidden">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-xs shrink-0 transition-colors"
              style={{ backgroundColor: activeTheme.primary }}
            >
              🍷
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight truncate">Wine Shop</h1>
              <p className="text-[11px] text-slate-500 font-medium">Management System</p>
              {selectedShop && (
                <p 
                  className="text-[10px] font-bold truncate mt-0.5"
                  style={{ color: activeTheme.primary }}
                >
                  📍 {selectedShop.name}
                </p>
              )}
            </div>
          </div>

          {/* Close button visible only on mobile/tablet */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto bg-white">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: activeTheme.light,
                        color: activeTheme.primary,
                        borderColor: activeTheme.primary
                      }
                    : {}
                }
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'font-bold border-l-4 shadow-xs'
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 safe-pb">
          <div className="flex items-center gap-3 mb-3">
            <div 
              className="w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 transition-colors"
              style={{
                backgroundColor: activeTheme.light,
                color: activeTheme.primary,
                borderColor: activeTheme.border
              }}
            >
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{user?.name || 'Administrator'}</p>
              <span 
                className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium"
                style={{ color: activeTheme.primary }}
              >
                <ShieldCheck className="w-3 h-3" />
                {user?.role || 'User'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors"
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
