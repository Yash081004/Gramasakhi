import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, LoadingSpinner, Input, Modal } from '../components/UIComponents';
import { Send, MessageCircle, Plus, Edit2, Trash2, X, Check, MoreVertical, Sparkles } from 'lucide-react';
import { chatAPI } from '../api/client';

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [useMMR, setUseMMR] = useState(false);
  const messagesEndRef = useRef(null);

  // Load sessions from backend
  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await chatAPI.getSessions();
      // normalize sessions list
      const items = Array.isArray(data) ? data : data.items || data.sessions || [];
      setSessions(items);
    } catch (err) {
      console.error('Failed to load chat sessions', err);
    } finally {
      setLoading(false);
    }
  };

  // Create a new session
  const createNewSession = async () => {
    try {
      setLoading(true);
      const created = await chatAPI.createSession('New Conversation');
      const id = created.id || created.session_id || created.session?.id || created.session_id;
      await loadSessions();
      if (id) {
        selectSession(id);
      }
    } catch (err) {
      console.error('Failed to create session', err);
    } finally {
      setLoading(false);
    }
  };

  // Select session and load messages
  const selectSession = async (sessionId) => {
    try {
      setCurrentSessionId(sessionId);
      setLoading(true);
      const resp = await chatAPI.getSessionMessages(sessionId).catch(async () => {
        // fallback to singular session fetch
        const s = await chatAPI.getSession(sessionId).catch(() => null);
        return s?.messages || s?.chat || [];
      });
      const msgs = resp?.messages || resp || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
      // scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error('Failed to load session messages', err);
    } finally {
      setLoading(false);
    }
  };

  // Submit message
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!input.trim() || !currentSessionId) return;
    const text = input.trim();
    // optimistic UI: append user message
    const userMsg = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await chatAPI.sendMessage(currentSessionId, text, useMMR);
      const reply = res.reply || res.message || res.response || (res.data && res.data.reply) || '';
      if (reply) {
        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      }
      // reload sessions to reflect latest timestamps
      await loadSessions();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setLoading(false);
    }
  };

  // ... existing useEffect and other functions ...

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

  // Add this to the JSX return, inside the sessions list rendering
  // Replace the existing session list item with this:
  const renderSessionItem = (session) => (
    <div
      key={session.id || session.session_id}
      className={`group p-3 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex justify-between items-center transition-colors ${
        (session.id || session.session_id) === currentSessionId ? 'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800/50' : 'border border-transparent'
      }`}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRenameSession(session.id, newSessionTitle)}
          >
            <Check size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingSessionId(null)}
          >
            <X size={16} />
          </Button>
        </div>
      ) : (
        <>
          <span className="truncate flex-1">
            {session.title || 'Untitled Chat'}
          </span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-primary-500"
              onClick={(e) => {
                e.stopPropagation();
                setEditingSessionId(session.id);
                setNewSessionTitle(session.title || '');
              }}
            >
              <Edit2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(session.id);
              }}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Add the delete confirmation dialog at the bottom of the JSX return
  const renderDeleteConfirm = () => (
    <Modal
      isOpen={!!showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(null)}
      title="Delete Chat"
      actions={[
        {
          label: 'Cancel',
          variant: 'secondary',
          onClick: () => setShowDeleteConfirm(null),
        },
        {
          label: 'Delete',
          variant: 'danger',
          onClick: () => handleDeleteSession(showDeleteConfirm),
        },
      ]}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Are you sure you want to delete this chat? This action cannot be undone.
      </p>
    </Modal>
  );

  // Update the return statement to include the new components
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <Button
              onClick={createNewSession}
              className="w-full"
              disabled={loading}
            >
              <Plus size={16} className="mr-2" />
              New Chat
            </Button>
            <div className="flex items-center justify-between px-2 py-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center">
                <Sparkles size={14} className="mr-2" />
                <span>MMR</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={useMMR}
                  onChange={(e) => setUseMMR(e.target.checked)}
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
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
            <div
              key={i}
              className={`mb-4 ${
                msg.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block p-4 rounded-2xl max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md rounded-br-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700/50 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form
            onSubmit={handleSubmit}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={!currentSessionId || loading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || !currentSessionId || loading}
            >
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