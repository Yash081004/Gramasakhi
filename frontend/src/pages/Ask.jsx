import React, { useState } from 'react';
import { Send, X, Plus, Minus } from 'lucide-react';
import { Button, Card, Textarea } from '../components/UIComponents';
import { queryAPI } from '../api';
import { useAI } from '../contexts/AIContext';

export default function Ask() {
  const [isFloating, setIsFloating] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [question, setQuestion] = useState('');
  const [mmr, setMmr] = useState(true);
  const [response, setResponse] = useState('');
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const { aiMode } = useAI();

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResponse('');
    setReferences([]);
    try {
      const res = await queryAPI.query(question, mmr, aiMode);
      setResponse(res.answer || 'No answer returned.');
      const refs = Array.isArray(res.references) ? res.references : [];
      setReferences(
        refs.map((r) => ({
          doc: r.file_name || r.source || r.file_id || 'Document',
          page: (r.page ?? r.page_num ?? 0) + 1,
          score: r.score ?? r.embed_score ?? 0,
        })),
      );
    } catch (e) {
      setResponse(e.message || 'The AI models could not respond right now. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      {!isMinimized && (
        <>
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <input
                type="checkbox"
                checked={mmr}
                onChange={(e) => setMmr(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              Use MMR Selection (Diversity)
            </label>
          </div>

          <Textarea
            placeholder="Ask a question about your documents..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            className="h-24 mb-4"
          />

          <Button variant="primary" fullWidth onClick={handleAsk} disabled={loading || !question.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {loading ? 'Thinking...' : 'Ask'}
          </Button>

          {response && (
            <div className="mt-4 space-y-4 max-w-full">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Answer:</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap">{response}</p>
              </div>
              {references.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">References:</h4>
                  <div className="space-y-2 overflow-hidden">
                    {references.map((ref, i) => (
                      <div key={i} className="text-xs px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-800 dark:text-blue-300 truncate" title={`${ref.doc} (p.${ref.page}) - ${(ref.score * 100).toFixed(0)}% match`}>
                        <span className="font-medium">{ref.doc}</span> (p.{ref.page}) - {(ref.score * 100).toFixed(0)}% match
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  if (isFloating) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card className={`w-96 shadow-2xl transition-all ${isMinimized ? 'h-16' : 'h-auto'}`}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Ask Question</h3>
              <div className="flex gap-2">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                  {isMinimized ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                </button>
                <button onClick={() => setIsFloating(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {content}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ask a Question</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Query your documents using AI-powered RAG retrieval</p>
      </div>
      <Card className="max-w-2xl">
        <div className="p-8">
          {content}
          <Button variant="ghost" onClick={() => setIsFloating(true)} className="mt-6">↘ Open as Floating Window</Button>
        </div>
      </Card>
    </div>
  );
}
