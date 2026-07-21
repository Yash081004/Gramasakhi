import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Badge, LoadingSpinner } from '../components/UIComponents';
import { Send, Scale } from 'lucide-react';
import { compareAPI, documentAPI } from '../api/client';

export default function Compare() {
  const [documents, setDocuments] = useState([]);
  const [doc1Id, setDoc1Id] = useState('');
  const [doc2Id, setDoc2Id] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(true);
  const [comparison, setComparison] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await documentAPI.getDocuments();
        setDocuments(Array.isArray(docs) ? docs : docs.items || []);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setDocLoading(false);
      }
    }
    loadDocs();
  }, []);

  const handleCompare = async () => {
    if (!doc1Id || !doc2Id) {
      setError('Please select both documents');
      return;
    }

    setLoading(true);
    setError('');
    setComparison('');

    try {
      console.log('Comparing:', { doc1Id, doc2Id, question });
      const result = await compareAPI.compare(doc1Id, doc2Id, question, 'gpt-4');
      console.log('Compare result:', result);
      setComparison(result.comparison || result);
    } catch (err) {
      console.error('Compare error:', err);
      let errorMsg = 'Failed to compare documents';
      if (err.response?.data?.detail) {
        errorMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errorMsg = err.message;
      }
      console.error('Error message:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (docLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Document 1 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Document 1
            </label>
            <select
              value={doc1Id}
              onChange={(e) => setDoc1Id(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Select a document</option>
              {documents.map((doc) => (
                <option key={doc.file_id} value={doc.file_id}>
                  {doc.file_name}
                </option>
              ))}
            </select>
          </div>

          {/* Document 2 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Document 2
            </label>
            <select
              value={doc2Id}
              onChange={(e) => setDoc2Id(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Select a document</option>
              {documents.map((doc) => (
                <option key={doc.file_id} value={doc.file_id}>
                  {doc.file_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Question */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Comparison Focus (Optional)
          </label>
          <textarea
            placeholder="e.g., What are the key differences? Focus on revenue trends..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              focus:outline-none focus:border-blue-500 transition-all resize-none h-20"
          />
        </div>

        <Button
          onClick={handleCompare}
          disabled={loading || !doc1Id || !doc2Id}
          isLoading={loading}
          fullWidth
          icon={Send}
        >
          {loading ? 'Comparing...' : 'Compare Documents'}
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
            <p className="text-gray-600 dark:text-gray-400">Comparing documents...</p>
          </div>
        </motion.div>
      )}

      {/* Comparison Result */}
      {comparison && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Badge variant="primary">Comparison Result</Badge>
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {comparison}
              </p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Placeholder */}
      {!comparison && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12 text-gray-500 dark:text-gray-400"
        >
          <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select two documents and click Compare to analyze their differences</p>
        </motion.div>
      )}
    </div>
  );
}
