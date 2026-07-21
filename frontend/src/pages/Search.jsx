import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, Card, Badge, LoadingSpinner } from '../components/UIComponents';
import { Search, FileText } from 'lucide-react';
import { searchAPI, documentAPI } from '../api/client';

export default function DocSearch() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!selectedDocId || !query.trim()) {
      setError('Please select a document and enter a search term');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const data = await searchAPI.search(selectedDocId, query);
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || 'Failed to search document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadDocs() {
      try {
        const docs = await documentAPI.getDocuments();
        setDocuments(Array.isArray(docs) ? docs : docs.items || docs.documents || []);
      } catch (err) {
        console.error('Failed to load documents for Search page:', err);
      }
    }
    loadDocs();
  }, []);

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
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Select Document
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Choose a document...</option>
              {documents.map((doc) => (
                <option key={doc.file_id || doc.id} value={doc.file_id || doc.id}>
                  {doc.file_name || doc.name || doc.filename || doc.source}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Search Term"
            placeholder="Enter keywords or phrases..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            icon={Search}
          />
        </div>

        <Button
          onClick={handleSearch}
          disabled={loading || !selectedDocId || !query.trim()}
          isLoading={loading}
          fullWidth
          icon={Search}
        >
          {loading ? 'Searching...' : 'Search Document'}
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
            <p className="text-gray-600 dark:text-gray-400">Searching document...</p>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {results.length > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </h3>
          </div>

          <div className="space-y-3">
            {results.map((result, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Chunk {result.chunk_id || idx + 1}
                    </h4>
                    {result.score && (
                      <Badge variant="primary">
                        Match: {(result.score * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {result.text || result.highlight}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && query && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12 text-gray-500 dark:text-gray-400"
        >
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No results found for "{query}"</p>
          <p className="text-sm mt-2">Try different keywords or check your document selection</p>
        </motion.div>
      )}

      {/* Placeholder */}
      {!loading && results.length === 0 && !query && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12 text-gray-500 dark:text-gray-400"
        >
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a document and enter search terms to begin</p>
        </motion.div>
      )}
    </div>
  );
}
