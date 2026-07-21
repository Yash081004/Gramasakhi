import React, { useState } from "react";
import { queryDocument } from "../api";
import { useAI } from "../AIContext";

export default function FloatingAsk() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const { aiMode } = useAI();

  async function doQuery(e) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await queryDocument(q, false, aiMode);
      setAnswer(res.answer || "No answer returned.");
    } catch (e) {
      setAnswer(
        e.message ||
          "The AI models could not respond right now. Please try again shortly."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Small floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 inline-flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Ask GramSakhi"
        >
          ?
        </button>
      )}

      {/* Floating window */}
      {open && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 w-[90vw] max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-semibold">
                DL
              </span>
              <div>
                <p className="text-xs font-semibold">Ask GramSakhi</p>
                <p className="text-[10px] text-gray-500">
                  Quick question over your documents
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="px-3 pt-2 pb-3 space-y-2">
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/60 resize-none"
              placeholder="Ask a quick question about your documents…"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-400">
                Model: <strong>{aiMode}</strong>
              </span>
              <form onSubmit={doQuery} className="relative">
                <button
                  type="submit"
                  disabled={!question.trim() || loading}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Thinking…" : "Ask"}
                </button>
              </form>
            </div>

            {answer && (
              <div className="mt-1 max-h-32 overflow-auto rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-gray-800 whitespace-pre-wrap border border-slate-100">
                {answer}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


