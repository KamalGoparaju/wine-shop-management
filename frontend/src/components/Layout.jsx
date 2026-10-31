import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = ({ children, title = 'Dashboard' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Navbar title={title} onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto safe-pb">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
