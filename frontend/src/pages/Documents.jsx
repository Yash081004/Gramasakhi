import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Badge } from '../components/UIComponents';
import { Upload, FileText, Trash2, Eye, RefreshCw } from 'lucide-react';
import { uploadAPI, documentAPI } from '../api/client';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPreview, setSelectedPreview] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUploadProgress(0);

    try {
      await uploadAPI.upload(file, (progress) => setUploadProgress(progress));
      await loadDocuments();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const loadDocuments = async () => {
    try {
      const data = await documentAPI.getDocuments();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocuments([]);
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;

    try {
      await documentAPI.deleteDocument(docId);
      await loadDocuments();
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete document');
    }
  };

  const viewPreview = async (docId) => {
  try {
    const doc = await documentAPI.getDocument(docId);
    const backendURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

    if (doc.file_name?.endsWith('.pdf') || doc.content_type === 'application/pdf') {
      setSelectedPreview({
        ...doc,
        isPdf: true,
        // Use the new preview endpoint
        pdfUrl: `${backendURL}/documents/${docId}/preview`
      });
    } else {
      setSelectedPreview(doc);
    }
  } catch (err) {
    console.error('Failed to load preview:', err);
  }
};

  return (
    <div className="space-y-8">
      {/* Upload */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Documents</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          Upload and manage your documents
        </p>

        <Card className="border-2 border-dashed border-blue-300 dark:border-blue-700 p-8 text-center cursor-pointer hover:border-blue-500">
          <label className="cursor-pointer flex flex-col items-center space-y-4">
            <Upload className="h-12 w-12 text-blue-500" />
            <div>
              <p className="text-lg font-semibold">Drag and drop your documents</p>
              <p className="text-sm text-gray-500">(PDF only)</p>
            </div>
            <input type="file" accept=".pdf" disabled={loading} onChange={handleUpload} className="hidden" />
          </label>
        </Card>

        {loading && uploadProgress > 0 && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full">
              <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-blue-500" />
            </div>
            <p className="text-sm text-center mt-1">Uploading {uploadProgress}%</p>
          </div>
        )}
      </motion.div>

      {/* Documents List */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Your Documents</h2>
        <Button size="sm" icon={RefreshCw} onClick={loadDocuments}>Refresh</Button>
      </div>

      {documents.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto opacity-50 mb-3" />
          No documents uploaded yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.file_id} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <Badge variant="primary">PDF</Badge>
              </div>

              <h3 className="font-semibold truncate">{doc.file_name}</h3>
              <p className="text-sm text-gray-500">Chunks: {doc.chunks || 0}</p>

              <div className="flex gap-3 mt-4">
                <Button icon={Eye} fullWidth onClick={() => viewPreview(doc.file_id)}>Preview</Button>
                <Button variant="danger" icon={Trash2} onClick={() => deleteDocument(doc.file_id)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ====================== Preview Modal ========================= */}
      {selectedPreview && (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setSelectedPreview(null)}>
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl w-[90vw] max-w-5xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold truncate">
                {selectedPreview.file_name || "Document Preview"}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setSelectedPreview(null)}>Close</Button>
            </div>

            {/* PDF or Text Preview */}
            {selectedPreview.isPdf ? (
              <iframe src={selectedPreview.pdfUrl} className="w-full h-full min-h-[75vh]" />
            ) : (
              <div className="flex justify-center py-6 overflow-y-auto h-[75vh]">
                <div className="bg-white dark:bg-gray-900 shadow-md rounded-lg p-8 w-full max-w-3xl
                                prose prose-neutral dark:prose-invert leading-relaxed whitespace-pre-wrap 
                                text-[15px] border border-gray-200 dark:border-gray-700">

                  <h1 className="text-2xl font-semibold mb-3">
                    {selectedPreview.file_name || "Untitled Document"}
                  </h1>

                  <hr className="mb-4 border-gray-300 dark:border-gray-700" />

                  {selectedPreview.preview || "No preview available"}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
