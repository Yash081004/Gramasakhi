import React, { useState } from "react";
import { exportChat, exportAdvanced } from "../api";

export default function ExportButtons({ sessionId, type, dataForExport }) {
  // type: "chat" | "summary" | "report" | "comparison"
  // dataForExport: { content, references, title, filename }

  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]); // no data:mime prefix
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const doExportChat = async (fmt = "pdf") => {
    if (!sessionId) return alert("Open a chat session first");
    setLoading(true);
    try {
      const blob = await exportChat(sessionId, fmt);
      downloadBlob(blob, `chat_${sessionId}.${fmt}`);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const doExportAdvanced = async (fmt = "pdf") => {
    setLoading(true);
    try {
      let logo_b64 = null;
      if (logoFile) {
        logo_b64 = await toBase64(logoFile);
        // strip mime prefix if present
        if (logo_b64.startsWith("data:")) {
          logo_b64 = logo_b64.split(",")[1];
        }
      }

      const payload = {
        content: dataForExport.content,
        references: dataForExport.references || [],
        fmt,
        filename: dataForExport.filename || "doculex_export",
        title: dataForExport.title || dataForExport.filename || "DocuLex Export",
        author: dataForExport.author || localStorage.getItem("doculex_user") || "",
        logo_b64
      };

      const blob = await exportAdvanced(payload);
      downloadBlob(blob, `${payload.filename}.${fmt}`);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div>
        <label style={{ fontSize: 12 }}>Optional Logo:</label>
        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} />
      </div>

      {type === "chat" ? (
        <>
          <button onClick={() => doExportChat("pdf")} disabled={loading}>Export Chat (PDF)</button>
          <button onClick={() => doExportChat("docx")} disabled={loading}>Export Chat (DOCX)</button>
        </>
      ) : (
        <>
          <button onClick={() => doExportAdvanced("pdf")} disabled={loading}>Export as PDF</button>
          <button onClick={() => doExportAdvanced("docx")} disabled={loading}>Export as DOCX</button>
        </>
      )}
      {loading && <span style={{ marginLeft: 8 }}>Exporting…</span>}
    </div>
  );
}
