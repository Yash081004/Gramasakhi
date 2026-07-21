import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';
import { Card, Button } from '../components/UIComponents';
import { uploadAPI } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploaded, setUploaded] = useState([]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const newUploaded = [];

    for (const file of files) {
      try {
        await uploadAPI.upload(file, (progress) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: progress }));
        });
        newUploaded.push(file.name);
      } catch (err) {
        console.error(`Failed to upload ${file.name}`, err);
      }
    }

    setUploaded(newUploaded);
    setFiles([]);
    setUploadProgress({});
    setUploading(false);
  };

  // Filter out duplicate files by name and size
  const handleDropWithDuplicates = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    
    setFiles((prev) => {
      const existingFiles = new Set(prev.map(f => `${f.name}-${f.size}`));
      const newFiles = droppedFiles.filter(f => !existingFiles.has(`${f.name}-${f.size}`));
      return [...prev, ...newFiles];
    });
  };

  const handleFileSelectWithDuplicates = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    setFiles((prev) => {
      const existingFiles = new Set(prev.map(f => `${f.name}-${f.size}`));
      const newFiles = selectedFiles.filter(f => !existingFiles.has(`${f.name}-${f.size}`));
      return [...prev, ...newFiles];
    });
    
    // Reset file input to allow selecting the same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload Documents</h1>
        <p className="text-gray-600 dark:text-gray-400">Upload legal documents, case files, or research papers for analysis</p>
      </div>

      {uploaded.length > 0 ? (
        /* Success State */
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex items-center justify-center"
        >
          <Card className="p-12 text-center space-y-6 max-w-md">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl"
            >
              ✨
            </motion.div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Complete!</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {uploaded.length} document{uploaded.length > 1 ? 's' : ''} successfully uploaded
            </p>
            <div className="space-y-2">
              {uploaded.map((name, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {name}
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="secondary" onClick={() => setUploaded([])}>
                Upload More
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        /* Upload Area */
        <>
          {/* Drag & Drop Zone */}
          <motion.div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropWithDuplicates} 
            className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 transition cursor-pointer hover:border-blue-500"
          >
            <div className="h-full flex flex-col items-center justify-center space-y-6 text-center">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Upload className="w-16 h-16 text-blue-500 mx-auto" />
              </motion.div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Drag documents here or click to browse
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Supported formats: PDF, DOCX, TXT, MD (max 50MB per file)
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Select Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelectWithDuplicates}
                accept=".pdf,.docx,.txt,.md"
              />
            </div>
          </motion.div>

          {/* File List */}
          {files.length > 0 && (
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Files to Upload ({files.length})</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {files.map((file, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>

                    {uploadProgress[file.name] !== undefined && uploading ? (
                      <div className="w-24">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress[file.name]}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">{uploadProgress[file.name]}%</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => removeFile(i)}
                        disabled={uploading}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Upload Button */}
              <motion.button
                onClick={handleUploadAll}
                disabled={uploading || files.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition"
              >
                {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length > 1 ? 's' : ''}`}
              </motion.button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}