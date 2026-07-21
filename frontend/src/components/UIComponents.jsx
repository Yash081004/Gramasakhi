import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Loader } from 'lucide-react';

// ============ BUTTON COMPONENT ============
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  isLoading = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:shadow-primary-500/30 active:scale-95',
    secondary: 'bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:shadow-lg hover:shadow-secondary-500/30 active:scale-95',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50',
    danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/30',
    outline: 'border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900/50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center font-semibold rounded-lg
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {Icon && <Icon className="h-4 w-4 mr-2" />}
          {children}
        </>
      )}
    </motion.button>
  );
}

// ============ INPUT COMPONENT ============
export function Input({
  label,
  icon: Icon,
  error,
  className = '',
  ...props
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400 dark:text-gray-600" />
          </div>
        )}
        <input
          className={`
            w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
            placeholder:text-gray-500 dark:placeholder:text-gray-400
            focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30
            transition-all duration-200
            ${Icon ? 'pl-10' : ''} ${error ? 'border-red-500 focus:border-red-500' : ''} ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-600 dark:text-red-400 text-sm mt-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ============ TEXTAREA COMPONENT ============
export function Textarea({
  label,
  error,
  className = '',
  ...props
}) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
          placeholder:text-gray-500 dark:placeholder:text-gray-400
          focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30
          transition-all duration-200 resize-none
          ${error ? 'border-red-500' : ''} ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
      )}
    </div>
  );
}

// ============ CARD COMPONENT ============
export function Card({
  children,
  className = '',
  hoverable = false,
  ...props
}) {
  return (
    <motion.div
      whileHover={hoverable ? { y: -2 } : {}}
      className={`
        rounded-2xl border border-white/20 dark:border-white/10
        bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-glass dark:shadow-glass-dark
        ${hoverable ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer' : ''}
        transition-shadow duration-200
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============ BADGE COMPONENT ============
export function Badge({
  children,
  variant = 'default',
  className = '',
  ...props
}) {
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100',
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
  };

  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
        ${variants[variant]} ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}

// ============ DROPDOWN COMPONENT ============
export function Dropdown({
  label,
  items,
  value,
  onChange,
  icon: Icon,
  className = '',
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative w-full ${className}`}>
      <motion.button
        onClick={() => setOpen(!open)}
        className={`
          w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800 text-left text-gray-900 dark:text-gray-100
          hover:border-gray-300 dark:hover:border-gray-600 transition-all
          flex items-center justify-between
        `}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{value || label}</span>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
          >
            {items.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                className={`
                  w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors ${value === item.value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-gray-100'}
                `}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ ALERT COMPONENT ============
export function Alert({
  message,
  variant = 'info',
  onClose,
  className = '',
}) {
  const variants = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    info: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-800 dark:text-primary-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        flex items-center justify-between px-4 py-3 rounded-lg border
        ${variants[variant]} ${className}
      `}
    >
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-2 p-1 hover:bg-black/10 rounded">
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

// ============ MODAL COMPONENT ============
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <Card className="w-full max-w-lg">
              <div className="p-6">
                {title && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                    <button
                      onClick={onClose}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <div className="mb-6">{children}</div>
                {actions && (
                  <div className="flex gap-3 justify-end">
                    {actions.map((action, idx) => (
                      <Button
                        key={idx}
                        variant={action.variant || 'secondary'}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============ TABS COMPONENT ============
export function Tabs({
  tabs,
  activeTab,
  setActiveTab,
  onChange,
  variant = 'default',
}) {
  const handleTabChange = (tabId) => {
    if (setActiveTab) {
      setActiveTab(tabId);
    } else if (onChange) {
      onChange(tabId);
    }
  };

  return (
    <div>
      <div className={`
        flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto
        ${variant === 'pills' ? 'gap-3' : ''}
      `}>
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`
              px-4 py-3 font-semibold text-sm transition-colors relative whitespace-nowrap
              flex items-center gap-2
              ${activeTab === tab.id
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600 rounded-t-full"
              />
            )}
          </motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          {tabs.find((t) => t.id === activeTab)?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============ SKELETON LOADER ============
export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  className = '',
  count = 1,
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`
            bg-gray-200 dark:bg-gray-700 rounded-lg mb-3
            ${width} ${height} ${className}
          `}
        />
      ))}
    </>
  );
}

// ============ LOADING SPINNER ============
export function LoadingSpinner({
  size = 'md',
  className = '',
}) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={`
        border-2 border-gray-200 dark:border-gray-700 border-t-primary-600
        rounded-full ${sizes[size]} ${className}
      `}
    />
  );
}
