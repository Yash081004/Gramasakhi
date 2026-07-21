import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 lg:ml-0 overflow-hidden">
          {/* Topbar */}
          <Topbar darkMode={darkMode} setDarkMode={setDarkMode} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
