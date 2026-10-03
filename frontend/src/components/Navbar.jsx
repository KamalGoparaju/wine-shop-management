import React from 'react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ title }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white sticky top-0 z-10">
      <h2 className="text-xl font-bold tracking-tight text-slate-100">{title}</h2>
      <div className="flex items-center gap-4">
        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Connected: <strong className="text-amber-400">Microservice Gateway</strong>
        </span>
      </div>
    </header>
  );
};

export default Navbar;
