import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
export function getToken() {
  return localStorage.getItem('doculex_token');
}

export function setToken(token) {
  localStorage.setItem('doculex_token', token);
}

export function clearTokenAndRedirect() {
  localStorage.removeItem('doculex_token');
  
  try {
    window.dispatchEvent(new CustomEvent("doculex:unauthenticated", { 
      detail: { 
        timestamp: new Date().toISOString(),
        redirectUrl: window.location.pathname
      } 
    }));
  } catch (e) {
    console.warn("Failed to dispatch unauthenticated event:", e);
  }
  
  window.location.href = "/login";
}

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      clearTokenAndRedirect();
    }
    return Promise.reject(error);
  }
);

// Centralized API Client for DocuLex Backend

export const queryAPI = {
  // POST /query - RAG Query
  query: async (question, useMMR = false, model = 'gpt-4') => {
    const response = await api.post('/query', { question, use_mmr: useMMR, model });
    return response.data;
  },
};

export const summarizeAPI = {
  // POST /summarize - Summarize (server expects { topic, use_mmr, model })
  summarize: async (topic, useMMR = false, model = 'gpt-4') => {
    const payload = { topic };
    if (useMMR !== undefined) payload.use_mmr = Boolean(useMMR);
    if (model) payload.model = model;
    const response = await api.post('/summarize', payload);
    return response.data;
  },
};

export const compareAPI = {
  // POST /compare - Compare documents (backend expects { doc_ids: [...], question?, use_mmr, model })
  compare: async (doc1, doc2, question = '', model = 'gpt-4') => {
    const payload = { doc_ids: [doc1, doc2], use_mmr: false };
    if (question && question.trim()) payload.question = question.trim();
    if (model) payload.model = model;
    const response = await api.post('/compare', payload);
    return response.data;
  },
};

export const reportAPI = {
  // POST /report - Generate report (backend expects { topic, use_mmr, model })
  report: async (topic, useMMR = false, model = 'gpt-4') => {
    const payload = { topic };
    if (useMMR !== undefined) payload.use_mmr = Boolean(useMMR);
    if (model) payload.model = model;
    const response = await api.post('/report', payload);
    return response.data;
  },
};

export const searchAPI = {
  // GET /document/search/{file_id} - Search within document
  search: async (fileId, query) => {
    const response = await api.get(`/document/search/${fileId}`, {
      params: { query },
    });
    return response.data;
  },
};

export const chatAPI = {
  // POST /chat - Chat endpoint with streaming support
  chat: async (sessionId, message, model = 'gpt-4') => {
    // Backend exposes POST /chat/message for sending chat messages
    const response = await api.post('/chat/message', {
      session_id: sessionId,
      message,
      model,
    });
    return response.data;
  },

  // Send a message to a chat session
  sendMessage: async (sessionId, message, useMMR = false, model = 'gpt-4') => {
    const response = await api.post('/chat/message', {
      session_id: sessionId,
      message,
      use_mmr: useMMR,
      model,
    });
    return response.data;
  },

  // GET /chat/sessions - List chat sessions
  getSessions: async () => {
    const response = await api.get('/chat/sessions');
    return response.data;
  },

  // POST /chat/sessions - Create new session
  createSession: async (title = 'New Conversation') => {
    const response = await api.post('/chat/sessions', { title });
    return response.data;
  },

  // GET /chat/session/{session_id} - Get session messages (backend uses singular 'session')
  getSession: async (sessionId) => {
    const response = await api.get(`/chat/session/${sessionId}`);
    return response.data;
  },

  // Get messages for a session
  getSessionMessages: async (sessionId) => {
    // Prefer the singular session endpoint which the backend exposes.
    const resp = await api.get(`/chat/session/${sessionId}`);
    const data = resp.data;
    // Normalize various backend shapes to an array of messages
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.messages)) return data.messages;
    if (data && data.session && Array.isArray(data.session.messages)) return data.session.messages;
    // If payload is a single session object containing messages, return messages
    if (data && data.session && Array.isArray(data.session.messages)) return data.session.messages;
    // Otherwise return whatever the backend provided (may be empty)
    return data;
  },

  // Update session title
  updateSession: async (sessionId, title) => {
    const response = await api.put(`/chat/sessions/${sessionId}`, { title });
    return response.data;
  },

  // Delete a session
  deleteSession: async (sessionId) => {
    const response = await api.delete(`/chat/sessions/${sessionId}`);
    return response.data;
  },
};

export const uploadAPI = {
  // POST /upload - Upload document
  upload: async (file, meta = {}, onProgress = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta.scheme_name) formData.append('scheme_name', meta.scheme_name);
    if (meta.ministry) formData.append('ministry', meta.ministry);
    if (meta.state) formData.append('state', meta.state);

    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentComplete);
        }
      },
    });
    return response.data;
  },
};

export const documentAPI = {
  // GET /documents - List all documents
  getDocuments: async () => {
    const response = await api.get('/documents');
    const data = response.data || [];
    // Normalize response to ensure consistent structure
    return Array.isArray(data) ? data : (data.items || data.documents || []);
  },

  // GET /document/{file_id} - Get document details
  getDocument: async (fileId) => {
    const response = await api.get(`/document/${fileId}`);
    return response.data;
  },

  // DELETE /document/delete/{file_id} - Delete document
  deleteDocument: async (fileId) => {
    const response = await api.delete(`/document/delete/${fileId}`);
    return response.data;
  },

  // POST /summarize - Summarize documents
  summarize: async (documents, topic = '', format = 'medium', model = 'gpt-4') => {
    const response = await api.post('/summarize', {
      documents,
      topic,
      format,
      model,
    });
    return response.data;
  },

  // POST /compare - Compare two or more documents
  compare: async (doc1, doc2, question = '', model = 'gpt-4') => {
    const payload = {
      doc_ids: [doc1, doc2],
      use_mmr: false,
      model,
    };
    if (question && question.trim()) {
      payload.question = question.trim();
    }
    const response = await api.post('/compare', payload);
    return response.data;
  },

  // POST /report - Generate report from documents
  generateReport: async (documents, topic, template = 'legal', model = 'gpt-4') => {
    const response = await api.post('/report', {
      documents,
      topic,
      template,
      model,
    });
    return response.data;
  },

  // GET /search or GET /document/search/{file_id} - Search within document
  search: async (query, fileId = null) => {
    if (fileId) {
      const response = await api.get(`/document/search/${fileId}`, {
        params: { query },
      });
      return response.data;
    } else {
      // Global search
      const response = await api.get('/search', {
        params: { q: query },
      });
      return response.data;
    }
  },
};

export const authAPI = {
  // POST /login - User login
  // backend expects OAuth2 form POST to /token; return access_token
  login: async (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    const response = await api.post('/token', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = response.data || {};
    const token = data.access_token || data.token || null;
    if (token) {
      try { localStorage.setItem('doculex_token', token); } catch (e) {}
    }
    return data;
  },

  // POST /register - User registration
  register: async ({ username, email, password, fullName }) => {
    return api.post('/register', { 
      username: username || email,  // Fallback to email if username not provided
      email, 
      password, 
      full_name: fullName 
    });
  },

  // POST /logout - User logout
  logout: async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { success: true };
  },

  // GET /user - Get current user
  getCurrentUser: async () => {
    // Try to decode token locally (backend has no /user endpoint by default)
    const token = localStorage.getItem('doculex_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (e) {
      return null;
    }
  },

  // POST /change-password - Change user password
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};

export const userAPI = {
  // Get user profile locally by decoding JWT payload (backend may not expose /user/profile)
  getProfile: async () => {
    const token = localStorage.getItem('doculex_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // normalize common fields
      return {
        username: payload.username || payload.sub || null,
        id: payload.user_id || payload.userId || payload.sub || null,
        ...payload,
      };
    } catch (e) {
      return null;
    }
  },

  // PUT /user/profile - Update user profile
  updateProfile: async (profile) => {
    const response = await api.put('/user/profile', profile);
    return response.data;
  },

  // GET /user/preferences - Get user preferences
  getPreferences: async () => {
    const response = await api.get('/user/preferences');
    return response.data;
  },

  // PUT /user/preferences - Update user preferences
  updatePreferences: async (preferences) => {
    const response = await api.put('/user/preferences', preferences);
    return response.data;
  },
};

// Utility functions
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function validateFile(file, allowedTypes = [], maxSizeMB = 50) {
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
  }
  
  // Check file size (default 50MB)
  const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB` };
  }
  
  return { valid: true };
}

export default api;
