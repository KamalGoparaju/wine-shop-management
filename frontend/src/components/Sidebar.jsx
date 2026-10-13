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
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
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

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-amber-900/30 shrink-0">
          🍷
        </div>
        <div className="overflow-hidden">
          <h1 className="font-bold text-white text-lg leading-none">Wine Shop</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">Management System</p>
          {selectedShop && (
            <p className="text-[11px] text-amber-400 font-bold truncate mt-1">
              📍 {selectedShop.name}
            </p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-sm">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
              <ShieldCheck className="w-3 h-3" />
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
