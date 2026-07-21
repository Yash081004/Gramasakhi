import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, Card, Badge, LoadingSpinner } from '../components/UIComponents';
import { Send, FileText } from 'lucide-react';
import { reportAPI } from '../api/client';
import { useAI } from '../contexts/AIContext';

export default function Report() {
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const { aiMode } = useAI();

  const handleGenerateReport = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError('');
    setReport('');

    try {
      const result = await reportAPI.report(topic, false, aiMode);
      setReport(result.report || result);
    } catch (err) {
      // Try to extract useful error info from axios/fetch
      const msg = err?.response?.data?.detail || err?.message || 'Failed to generate report';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <Input
          label="Report Topic"
          placeholder="e.g., Comprehensive risk analysis, Market opportunity assessment"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          icon={FileText}
        />

        <Input
          label="Report Outline (Optional)"
          placeholder="Define sections and structure. Leave blank for auto-generated outline."
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
        />



        <Button
          onClick={handleGenerateReport}
          disabled={loading || !topic.trim()}
          isLoading={loading}
          fullWidth
          icon={Send}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </Button>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300"
        >
          {error}
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-12"
        >
          <div className="text-center space-y-4">
            <LoadingSpinner />
            <p className="text-gray-600 dark:text-gray-400">Generating your report...</p>
          </div>
        </motion.div>
      )}

      {/* Report Result */}
      {report && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Badge variant="primary">Generated Report</Badge>
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {report}
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Placeholder */}
      {!report && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12 text-gray-500 dark:text-gray-400"
        >
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Enter a topic to generate a comprehensive report</p>
        </motion.div>
      )}
    </div>
  );
}