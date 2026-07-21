import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Tabs } from '../components/UIComponents';
import QueryDocument from '../pages/Ask';
import Summarize from '../pages/Summarize';
import Compare from '../pages/Compare';
import Report from '../pages/Report';
import DocSearch from '../pages/Search';
import Chat from '../pages/Chat';

const features = [
  {
    id: 'ask',
    label: 'Ask',
    icon: '🔍',
    description: 'Query your documents with AI',
    component: QueryDocument,
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: '📝',
    description: 'Generate concise summaries',
    component: Summarize,
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: '⚖️',
    description: 'Compare multiple documents',
    component: Compare,
  },
  {
    id: 'report',
    label: 'Report',
    icon: '📊',
    description: 'Generate detailed reports',
    component: Report,
  },
  {
    id: 'search',
    label: 'Search',
    icon: '🔎',
    description: 'Full-text document search',
    component: DocSearch,
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: '💬',
    description: 'Chat with your documents',
    component: Chat,
  },
];

export default function Features() {
  const [activeTab, setActiveTab] = useState('ask');
  const [queryTab, setQueryTab] = useState(null);

  const location = useLocation();

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const tab = params.get('tab');
      if (tab && features.some((f) => f.id === tab)) {
        setActiveTab(tab);
        setQueryTab(tab);
      }
    } catch (e) {
      // ignore
    }
  }, [location.search]);

  const activeFeature = features.find((f) => f.id === activeTab);
  const ActiveComponent = activeFeature?.component;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Features</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Unlock the power of AI across your documents
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8"
      >
        <Tabs tabs={features} activeTab={activeTab} setActiveTab={setActiveTab} />
      </motion.div>

      {/* Content */}
      <div className="max-w-6xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 lg:p-8 min-h-96">
              {ActiveComponent ? (
                <ActiveComponent />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">Feature component not found</p>
                </div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}


