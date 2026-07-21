import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, Card, Badge, LoadingSpinner } from '../components/UIComponents';
import { Send, FileText } from 'lucide-react';
import { summarizeAPI } from '../api/client';
import { useAI } from '../contexts/AIContext';

export default function Summarize() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const { aiMode } = useAI();

  const handleSummarize = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError('');
    setSummary('');

    try {
      const result = await summarizeAPI.summarize(topic, false, aiMode);
      setSummary(result.summary || result);
    } catch (err) {
      setError(err.message || 'Failed to generate summary');
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
          label="Summarization Topic"
          placeholder="What would you like to summarize? (e.g., Key findings, Technical details)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          icon={FileText}
        />



        <Button
          onClick={handleSummarize}
          disabled={loading || !topic.trim()}
          isLoading={loading}
          fullWidth
          icon={Send}
        >
          {loading ? 'Summarizing...' : 'Generate Summary'}
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
            <p className="text-gray-600 dark:text-gray-400">Generating your summary...</p>
          </div>
        </motion.div>
      )}

      {/* Summary Result */}
      {summary && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Badge variant="success">Generated Summary</Badge>
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Placeholder */}
      {!summary && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12 text-gray-500 dark:text-gray-400"
        >
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Enter a topic to generate a summary</p>
        </motion.div>
      )}
    </div>
  );
}