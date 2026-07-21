import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, FileText, MessageCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { Card, Button } from '../components/UIComponents';
import { documentAPI, chatAPI } from '../api/client';
import { useNavigate } from 'react-router-dom';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const docs = await documentAPI.getDocuments().catch(() => []);
        const s = await chatAPI.getSessions().catch(() => []);
        if (!mounted) return;
        // Ensure data is arrays
        const normalizedDocs = Array.isArray(docs) ? docs : (docs.items || docs.documents || []);
        const normalizedSessions = Array.isArray(s) ? s : (s.sessions || s.items || []);
        console.log('Dashboard loaded docs:', normalizedDocs, 'sessions:', normalizedSessions);
        setDocuments(normalizedDocs);
        setSessions(normalizedSessions);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setDocuments([]);
        setSessions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { 
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <motion.div initial="hidden" animate="show" variants={container} className="space-y-8">
        
        {/* Welcome Hero */}
        <motion.div variants={item} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-900 p-8 md:p-12 text-white shadow-xl">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary-100 to-white">
              Welcome to GramSakhi
            </h1>
            <p className="text-primary-100/90 text-lg md:text-xl mb-8 font-light">
              Your AI-powered voice assistant for last-mile governance. Ask about government schemes, eligibility, and welfare information seamlessly.
            </p>
            <div className="flex gap-4">
              <Button size="lg" className="bg-white text-primary-900 hover:bg-primary-50 shadow-lg hover:shadow-xl transition-all" onClick={() => navigate('/chat')}>
                <MessageCircle className="h-5 w-5 mr-2" /> Start Chat
              </Button>
            </div>
          </div>
          
          <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <Sparkles className="w-96 h-96" />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Documents */}
          <Card hoverable className="relative overflow-hidden p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-gradient-to-r from-primary-500 to-primary-600 opacity-10 rounded-full" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <FileText className="h-8 w-8 text-primary-500/50" />
                <div className="flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400">
                  <ArrowUpRight className="h-4 w-4" />
                  +{documents.length > 0 ? Math.min(50, Math.round((documents.length / 10) * 10)) + '%' : '0%'}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Documents</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{documents.length}</p>
              </div>
            </div>
          </Card>

          {/* Conversations */}
          <Card hoverable className="relative overflow-hidden p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-gradient-to-r from-secondary-500 to-secondary-600 opacity-10 rounded-full" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <MessageCircle className="h-8 w-8 text-secondary-500/50" />
                <div className="flex items-center gap-1 text-sm font-semibold text-secondary-600 dark:text-secondary-400">
                  <ArrowUpRight className="h-4 w-4" />
                  {sessions.length > 0 ? Math.round((sessions.length / 5) * 10) + '%' : '0%'}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Conversations</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{sessions.length}</p>
              </div>
            </div>
          </Card>

          {/* Analysis (derived) */}
          <Card hoverable className="relative overflow-hidden p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-gradient-to-r from-primary-400 to-primary-500 opacity-10 rounded-full" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-8 w-8 text-primary-400/50" />
                <div className="flex items-center gap-1 text-sm font-semibold text-primary-500 dark:text-primary-400">
                  <ArrowUpRight className="h-4 w-4" />
                  {documents.length > 0 ? Math.round((documents.length / 2)) + '%' : '0%'}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Analysis</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{Math.max(0, Math.round(documents.length * 0.2))}</p>
              </div>
            </div>
          </Card>

          {/* Storage Used */}
          <Card hoverable className="relative overflow-hidden p-6">
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-gradient-to-r from-secondary-400 to-secondary-500 opacity-10 rounded-full" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-8 w-8 text-secondary-400/50" />
                <div className="flex items-center gap-1 text-sm font-semibold text-secondary-500 dark:text-secondary-400">
                  <ArrowUpRight className="h-4 w-4" />
                  Active
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Chunks</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{documents.reduce((sum, d) => sum + (d.chunks || 0), 0)}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Recent Documents & Conversations */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Documents</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => navigate('/documents')}>View All</Button>
                <Button size="sm" variant="secondary" onClick={() => navigate('/upload')}>Upload</Button>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-gray-500">Loading documents...</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded yet.</p>
              ) : (
                documents.slice(0, 6).map((doc) => (
                  <motion.div
                    key={doc.file_id || doc.filename}
                    whileHover={{ x: 4 }}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer gap-4"
                    onClick={() => navigate('/documents')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate" title={doc.file_name || doc.filename || 'Untitled'}>
                        {doc.file_name || doc.filename || 'Untitled'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{doc.chunks || 0} chunks</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">PDF</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Indexed</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Conversations</h3>
              <div>
                <Button size="sm" onClick={() => navigate('/chat')}>Open Chat</Button>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-gray-500">Loading chats...</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-gray-500">No conversations yet.</p>
              ) : (
                sessions.slice(0, 8).map((s) => (
                  <motion.div
                    key={s.id}
                    whileHover={{ x: 4 }}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                    onClick={() => navigate('/chat')}
                  >
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{s.title || 'Conversation'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.updated_at ? new Date(s.updated_at * 1000).toLocaleString() : '—'}</p>
                      <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1 rounded">
                        {(s.messages && s.messages.length) || (s.msg_count) || 0} msgs
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}