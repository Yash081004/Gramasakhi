import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, LoadingSpinner, Input, Dialog } from '../UIComponents';
import { Send, MessageCircle, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { chatAPI } from '../../api';

export default function ChatReplace() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const messagesEndRef = useRef(null);

  // ... existing useEffect and other functions (preserve behavior) ...

  const handleRenameSession = async (sessionId, newTitle) => {
    if (!newTitle.trim()) return;
    try {
      await chatAPI.updateSession(sessionId, newTitle);
      await loadSessions();
      setEditingSessionId(null);
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await chatAPI.deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      setShowDeleteConfirm(null);
      await loadSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const renderSessionItem = (session) => (
    <div
      key={session.id || session.session_id}
      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center ${(session.id || session.session_id) === currentSessionId ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
      onClick={() => selectSession(session.id || session.session_id)}
    >
      {editingSessionId === session.id ? (
        <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Input
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameSession(session.id, newSessionTitle);
              } else if (e.key === 'Escape') {
                setEditingSessionId(null);
              }
            }}
            className="flex-1"
            autoFocus
          />
          <Button variant="ghost" size="sm" onClick={() => handleRenameSession(session.id, newSessionTitle)}>
            <Check size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditingSessionId(null)}>
            <X size={16} />
          </Button>
        </div>
      ) : (
        <>
          <span className="truncate flex-1">{session.title || 'Untitled Chat'}</span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-500" onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setNewSessionTitle(session.title || ''); }}>
              <Edit2 size={16} />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(session.id); }}>
              <Trash2 size={16} />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderDeleteConfirm = () => (
    <Dialog isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Chat" description="Are you sure you want to delete this chat? This action cannot be undone." buttons={[{ text: 'Cancel', variant: 'secondary', onClick: () => setShowDeleteConfirm(null) }, { text: 'Delete', variant: 'danger', onClick: () => handleDeleteSession(showDeleteConfirm) }]} />
  );

  // The rest of the original component JSX should be used where this component is mounted.

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Button onClick={createNewSession} className="w-full" disabled={loading}>
            <Plus size={16} className="mr-2" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(renderSessionItem)}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message..." className="flex-1" disabled={!currentSessionId || loading} />
            <Button type="submit" disabled={!input.trim() || !currentSessionId || loading}>
              {loading ? <LoadingSpinner size={16} /> : <Send size={16} />}
            </Button>
          </form>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {renderDeleteConfirm()}
    </div>
  );
}
