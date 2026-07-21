// components/Upload.jsx
import React, { useState, useCallback } from "react";
import { uploadAPI } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function Upload({ onUploaded }) {
  // onUploaded(fileMeta) optional callback
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [schemeName, setSchemeName] = useState("");
  const [ministry, setMinistry] = useState("");
  const [stateName, setStateName] = useState("");
  const { user } = useAuth();

  // max file size in bytes (25MB default)
  const MAX_SIZE_BYTES = 25 * 1024 * 1024;

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    setFiles((prev) => [...prev, ...droppedFiles]);
    setErr("");
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    setErr("");
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'border-blue-500');
  }, []);

  function validateFile(f) {
    // Validate type: PDF only
    if (
      f.type !== "application/pdf" &&
      !f.name.toLowerCase().endsWith(".pdf")
    ) {
      setErr("Only PDF files are supported. Please select a .pdf file.");
      return false;
    }
    // Validate size
    if (f.size > MAX_SIZE_BYTES) {
      setErr(
        `File is too large. Maximum allowed size is ${Math.round(
          MAX_SIZE_BYTES / (1024 * 1024)
        )} MB.`
      );
      return false;
    }
    return true;
  }

  function onChoose(e) {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate each file
    const validFiles = [];
    for (const f of selectedFiles) {
      if (validateFile(f)) {
        validFiles.push(f);
      } else {
        // Clear the input if any file is invalid
        e.target.value = '';
        setFiles([]);
        return;
      }
    }
    
    setFiles(validFiles);
  }

  async function doUpload() {
    setErr("");
    if (!files.length) {
      setErr("Please choose PDF files first.");
      return;
    }
    
    // For now, we'll upload the first file only (to match original behavior)
    // In a multi-file upload, you'd need to iterate through files
    const file = files[0];
    
    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadAPI.upload(
        file,
        { scheme_name: schemeName, ministry, state: stateName },
        (p) => { setProgress(p); }
      );
      setProgress(100);
      setUploading(false);
      setFiles([]);
      setSchemeName("");
      setMinistry("");
      setStateName("");
      if (onUploaded) onUploaded(result);
    } catch (e) {
      setUploading(false);
      setErr(e.response?.data?.detail || e.message || "Upload failed");
    }
  }

  if (!user || !user.is_admin) return null;

  return (
    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-4 md:px-5 md:py-5 mb-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
            ⬆
          </div>
          <div>
            <h3 className="text-sm font-semibold">Upload documents (PDF)</h3>
            <p className="text-xs text-gray-600">
              Drag &amp; drop or choose a PDF (max 25MB). Content is indexed
              for Ask, Summarize, Compare and Chat.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <div className="text-gray-600 mb-1">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <span className="text-sm">Drag & drop files here or click to browse</span>
              </div>
            </label>
          </div>
          
          <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
            <input type="text" placeholder="Scheme Name (e.g. PM-KISAN)" value={schemeName} onChange={e => setSchemeName(e.target.value)} className="w-full text-sm p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
            <input type="text" placeholder="Ministry (e.g. Agriculture)" value={ministry} onChange={e => setMinistry(e.target.value)} className="w-full text-sm p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
            <input type="text" placeholder="State (Optional)" value={stateName} onChange={e => setStateName(e.target.value)} className="w-full text-sm p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800" />
          </div>
          
          <div className="flex gap-2 justify-end">
            <button
              onClick={doUpload}
              disabled={!files.length || uploading}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs md:text-sm font-medium text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button
              onClick={() => {
                setFiles([]);
                setErr("");
              }}
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, index) => (
            <div key={index} className="text-xs text-gray-700 bg-white/50 rounded p-2">
              <span className="font-medium">File {index + 1}:</span> {file.name} —{" "}
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          ))}
        </div>
      )}

      {err && <p className="msg mt-1 text-xs text-red-600">{err}</p>}

      {uploading && (
        <div className="mt-3">
          <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-blue-100">
            <div
              className="h-2 bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-600">{progress}%</div>
        </div>
      )}
    </div>
  );
}