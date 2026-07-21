import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaChevronDown, 
  FaChevronUp, 
  FaExternalLinkAlt, 
  FaEye,
  FaSearch,
  FaFileAlt,
  FaWaveSquare,
  FaKeyboard,
  FaCode
} from 'react-icons/fa';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const safeText = (v) => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.text || v.citation || JSON.stringify(v);
  return String(v);
};

// ============================================================================
// SHIMMER SKELETON LOADER
// ============================================================================

export function SkeletonLoader({ count = 1, className = 'h-12 w-full rounded' }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`${className} bg-gray-200 dark:bg-gray-700`}
          animate={{
            backgroundPosition: ['200% 0', '-200% 0'],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// ANIMATED SEARCH BAR
// ============================================================================

export function AnimatedSearchBar({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = 'Search...',
  className = '' 
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className={`relative ${className}`}
      animate={{
        boxShadow: isFocused
          ? '0 0 30px rgba(59, 130, 246, 0.3)'
          : '0 0 0px rgba(59, 130, 246, 0)',
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyPress={(e) => e.key === 'Enter' && onSubmit?.()}
        placeholder={placeholder}
        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:outline-none focus:border-blue-500 transition"
      />
      {isFocused && (
        <motion.div
          layoutId="search-glow"
          className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-10 rounded-lg pointer-events-none"
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
        <FaSearch className="text-gray-400" />
      </div>
    </motion.div>
  );
}

// ============================================================================
// HOVER PREVIEW COMPONENT
// ============================================================================

function HoverPreview({ content, children, maxWidth = '280px' }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 150);
  };

  const handleLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), 100);
  };

  return (
    <span 
      className="relative inline-block" 
      onMouseEnter={handleEnter} 
      onMouseLeave={handleLeave}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute z-50 -top-2 left-0 transform -translate-y-full p-3 rounded shadow-lg bg-white dark:bg-gray-800 text-xs border border-gray-200 dark:border-gray-700"
            style={{ 
              width: maxWidth,
              boxShadow: '0 8px 24px rgba(16,24,40,0.12)',
              maxWidth: '90vw'
            }}
          >
            <div className="text-xs leading-snug text-gray-800 dark:text-gray-200 break-words">
              {safeText(content).slice(0, 500) || 'No preview available'}
            </div>
            <div className="absolute -bottom-1 left-4 w-2 h-2 bg-white dark:bg-gray-800 transform rotate-45 border-r border-b border-gray-200 dark:border-gray-700" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ============================================================================
// COLLAPSIBLE PANEL
// ============================================================================

export function Collapsible({ 
  title, 
  defaultOpen = false, 
  children,
  icon: Icon = FaEye
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="w-full">
      <button
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {title}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 transition-transform">
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <FaChevronUp />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-md shadow-sm">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CITATION BLOCK (ADVANCED VERSION)
// ============================================================================

export function CitationBlock({ 
  text = '', 
  citations = [], 
  className = '',
  title = 'References'
}) {
  const items = Array.isArray(citations) ? citations : [citations].filter(Boolean);

  const buildDocumentLink = (c) => {
    if (c && typeof c === 'object' && c.file_id) {
      const pagePart = c.page_num ? `?page=${encodeURIComponent(c.page_num)}` : '';
      return `/document/${encodeURIComponent(c.file_id)}${pagePart}`;
    }
    return null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {text && (
        <p className="text-gray-900 dark:text-gray-100 leading-relaxed text-base">
          {text}
        </p>
      )}

      {items.length > 0 && (
        <Collapsible 
          title={`${title} (${items.length})`} 
          defaultOpen={true}
          icon={FaFileAlt}
        >
          <ul className="space-y-3">
            {items.map((c, idx) => {
              const isString = typeof c === 'string';
              const obj = isString ? null : c || {};
              const source = isString ? c : obj.source || obj.citation || 'Unknown source';
              const page = obj && obj.page_num ? obj.page_num : null;
              const fileId = obj && obj.file_id ? obj.file_id : null;
              const preview = isString ? c : obj.text || c.preview || '';

              const link = buildDocumentLink(obj);

              return (
                <li
                  key={idx}
                  className="flex items-start gap-4 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group"
                >
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium">
                      {idx + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
                          {safeText(source)}
                        </span>

                        {page && (
                          <HoverPreview content={preview}>
                            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                              Page {page}
                            </span>
                          </HoverPreview>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors opacity-0 group-hover:opacity-100"
                            title={`Open ${safeText(source)}${page ? ` — page ${page}` : ''}`}
                          >
                            <FaExternalLinkAlt />
                            <span className="sr-only">Open document</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    {preview ? (
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {safeText(preview).slice(0, 400)}
                        {safeText(preview).length > 400 && (
                          <span className="text-blue-500 ml-1">[...]</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        No preview available
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}

// ============================================================================
// DIFF HIGHLIGHT
// ============================================================================

export function DiffHighlight({ text, type = 'normal' }) {
  const bgColor = {
    added: 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 border border-green-200 dark:border-green-800',
    removed: 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 border border-red-200 dark:border-red-800',
    modified: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
    normal: '',
  }[type];

  return (
    <span className={`px-2 py-1 rounded font-mono ${bgColor}`}>
      {text}
    </span>
  );
}

// ============================================================================
// GRADIENT BORDER
// ============================================================================

export function GradientBorder({ 
  children, 
  className = '',
  gradient = 'from-blue-500 via-purple-500 to-pink-500'
}) {
  return (
    <motion.div
      className={`relative p-0.5 rounded-lg ${className}`}
      whileHover={{ boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-lg opacity-75 blur`} />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg p-4">
        {children}
      </div>
    </motion.div>
  );
}

// ============================================================================
// TILT CARD
// ============================================================================

export function TiltCard({ children, className = '', intensity = 10 }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    setRotateX((y / rect.height) * intensity);
    setRotateY((-x / rect.width) * intensity);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      className={`cursor-pointer ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
      animate={{
        rotateX,
        rotateY,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// FEATURE CARD
// ============================================================================

export function FeatureCard({ 
  icon: Icon, 
  title, 
  subtitle, 
  onClick, 
  className = '',
  gradient = 'from-blue-500 to-purple-600'
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`relative p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-left overflow-hidden transition ${className}`}
      whileHover={{
        scale: 1.03,
        boxShadow: '0 12px 32px rgba(59, 130, 246, 0.15)',
      }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0`}
        whileHover={{ opacity: 0.05 }}
      />

      <div className="relative z-10 space-y-3">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
      </div>
    </motion.button>
  );
}

// ============================================================================
// WAVE LOADER
// ============================================================================

export function WaveLoader({ color = 'from-blue-500 to-purple-600', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-1 py-8 ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className={`w-2 h-8 bg-gradient-to-t ${color} rounded-full`}
          animate={{ scaleY: [1, 1.5, 1] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

export function TypingIndicator({ className = '' }) {
  return (
    <div className={`flex gap-1 items-center py-4 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"
          animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// ADVANCED UI WRAPPER
// ============================================================================

export function AdvancedUI({ 
  content = '', 
  citations = [], 
  title = 'Response',
  className = ''
}) {
  return (
    <div className={`max-w-3xl mx-auto p-4 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="space-y-6"
      >
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FaCode className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
            {content ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <p className="italic text-gray-500">No content provided</p>
            )}
          </div>
        </div>

        {citations.length > 0 && (
          <CitationBlock 
            text="Based on the following sources:" 
            citations={citations} 
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// DEMO COMPONENT (FOR SHOWCASING ALL COMPONENTS)
// ============================================================================

export function ComponentDemo() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        UI Component Library
      </h1>
      
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Skeleton Loader</h2>
        <SkeletonLoader count={3} />
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Animated Search</h2>
        <AnimatedSearchBar 
          value="" 
          onChange={() => {}} 
          placeholder="Try typing something..." 
        />
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Feature Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={FaSearch}
            title="Smart Search"
            subtitle="Find exactly what you need with AI-powered search"
            onClick={() => console.log('Search clicked')}
          />
          <FeatureCard
            icon={FaFileAlt}
            title="Document Analysis"
            subtitle="Extract insights from your documents"
            onClick={() => console.log('Analysis clicked')}
          />
          <FeatureCard
            icon={FaWaveSquare}
            title="Visual Analytics"
            subtitle="See data trends and patterns"
            onClick={() => console.log('Analytics clicked')}
          />
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Wave Loader</h2>
        <WaveLoader />
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Typing Indicator</h2>
        <TypingIndicator />
      </div>
    </div>
  );
}