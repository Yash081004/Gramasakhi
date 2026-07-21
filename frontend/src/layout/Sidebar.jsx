import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Sparkles,
  MessageCircle,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Search,
  BarChart3,
  GitCompare,
  BookOpen,
} from 'lucide-react';

const getMenuItems = (isAdmin) => {
  const baseFeatures = [
    { id: 'ask', label: 'Ask', icon: MessageCircle },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
  ];
  
  if (isAdmin) {
    baseFeatures.push(
      { id: 'summarize', label: 'Summarize', icon: BookOpen },
      { id: 'compare', label: 'Compare', icon: GitCompare },
      { id: 'report', label: 'Report', icon: BarChart3 }
    );
  }

  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    {
      id: 'features',
      label: 'Features',
      icon: Sparkles,
      path: '/features',
      subItems: baseFeatures,
    }
  ];

  if (isAdmin) {
    items.push({ id: 'documents', label: 'Documents', icon: FileText, path: '/documents' });
  }
  
  items.push({ id: 'settings', label: 'Settings', icon: Settings, path: '/settings' });
  
  return items;
};

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const location = useLocation();
  const { user } = useAuth();
  const menuItems = getMenuItems(user?.is_admin);

  const isActive = (path) => location.pathname === path;

  const MenuItem = ({ item }) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedMenu === item.id;

    if (hasSubItems) {
      return (
        <div key={item.id}>
          <motion.button
            whileHover={{ x: 4 }}
            onClick={() => setExpandedMenu(isExpanded ? null : item.id)}
            className={`
              w-full flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer
              transition-colors duration-200
              ${isActive(item.path)
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }
            `}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && (
              <>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {hasSubItems && isExpanded && !isCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {item.subItems.map((subItem) => (
                  <Link
                    key={subItem.id}
                    to={`${item.path}?tab=${subItem.id}`}
                    className="flex items-center gap-3 px-4 py-2 ml-6 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <subItem.icon className="h-4 w-4" />
                    <span className="font-medium">{subItem.label}</span>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`
          flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer
          transition-colors duration-200
          ${isActive(item.path)
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shadow-sm'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }
        `}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <span className="text-sm font-medium">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <>
      <motion.button
        className="fixed top-4 left-4 lg:hidden z-40 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <Menu className="h-6 w-6" /> : <X className="h-6 w-6" />}
      </motion.button>

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? '80px' : '280px' }}
        transition={{ duration: 0.3 }}
        className="hidden lg:flex flex-col h-screen bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none"
      >
        <motion.div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-500"
              >
                GramSakhi
              </motion.div>
            )}
            <motion.button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </motion.button>
          </div>
        </motion.div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-1">
          {menuItems.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </nav>

        <motion.div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <AuthLogout isCollapsed={isCollapsed} />
        </motion.div>
      </motion.aside>

      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 z-30 w-64 h-screen bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 lg:hidden overflow-y-auto shadow-glass"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-500">
                GramSakhi
              </div>
            </div>
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => (
                <MenuItem key={item.id} item={item} />
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
              <AuthLogout isCollapsed={isCollapsed} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AuthLogout({ isCollapsed }) {
  const { logout } = useAuth();
  return (
    <motion.button
      whileHover={{ x: 4 }}
      onClick={() => logout()}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
    >
      <LogOut className="h-5 w-5" />
      {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
    </motion.button>
  );
}


