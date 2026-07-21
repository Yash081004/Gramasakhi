import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Zap, Copy, BarChart3, Lightbulb } from 'lucide-react';
import { useFloatingAsk } from '../contexts/FloatingAskContext';
import { useNavigate } from 'react-router-dom';

const suggestions = [
  { icon: Zap, label: 'Summarize this doc', action: '/summarize' },
  { icon: Copy, label: 'Compare two cases', action: '/compare' },
  { icon: BarChart3, label: 'Draft a report', action: '/report' },
  { icon: Lightbulb, label: 'Extract key points', action: '/chat' },
];

export default function FloatingAskButton() {
  const navigate = useNavigate();
  const { isOpen, open, close, query, setQuery } = useFloatingAsk();
  const [inputValue, setInputValue] = useState('');

  const handleSuggestion = (action) => {
    navigate(action);
    close();
  };

  const handleAsk = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setQuery(inputValue);
      // Don't navigate, let the FloatingAsk component handle the query
      setInputValue('');
      close();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={open}
        className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center"
        whileHover={{ scale: 1.1, boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)' }}
        whileTap={{ scale: 0.95 }}
        animate={isOpen ? { scale: 0 } : { scale: 1 }}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 bg-black/30 backdrop-blur z-40"
            />

            {/* Chat Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-32 right-8 z-50 w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold">GramSakhi AI</h3>
                </div>
                <button
                  onClick={close}
                  className="text-white/80 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ask me anything about your documents or legal research
                </p>

                {/* Input */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                    placeholder="Ask me anything..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <button
                    onClick={handleAsk}
                    disabled={!inputValue.trim()}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
                  >
                    Ask
                  </button>
                </div>

                {/* Suggestions */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Suggestions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestions.map((sug, i) => {
                      const Icon = sug.icon;
                      return (
                        <motion.button
                          key={i}
                          onClick={() => handleSuggestion(sug.action)}
                          whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(59, 130, 246, 0.1)' }}
                          className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition text-left"
                        >
                          <Icon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{sug.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
