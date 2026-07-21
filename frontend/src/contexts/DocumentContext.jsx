// src/contexts/DocumentContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { documentAPI, getToken } from "../api";
const { getDocuments: apiListDocuments, getDocument: getDocumentDetails } = documentAPI;

const DocumentContext = createContext();

export function DocumentProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    // Do not hit protected /documents if there is no auth token (avoids
    // infinite 401 + redirect loops on public routes like /login).
    const token = getToken && getToken();
    if (!token) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiListDocuments();
      // If API returns { documents: [...] } or array, normalize:
      const docs = Array.isArray(res) ? res : (res.documents || []);
      // force same field name: document_id
      const normalized = docs.map(d => ({
        ...d,
        document_id: d.document_id ?? d.file_id ?? d.id ?? d.fileId ?? d.file_id
      }));
      setDocuments(normalized);
    } catch (e) {
      console.error("fetchDocuments", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function loadDocumentDetails(document_id) {
    try {
      const info = await getDocumentDetails(document_id);
      setCurrentDocument({
        ...info,
        document_id: info.document_id ?? info.file_id ?? document_id
      });
      return info;
    } catch (e) {
      console.error("loadDocumentDetails", e);
      return null;
    }
  }

  return (
    <DocumentContext.Provider value={{
      documents,
      currentDocument,
      setCurrentDocument,
      fetchDocuments,
      loadDocumentDetails,
      loading,
      error
    }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  return useContext(DocumentContext);
}
