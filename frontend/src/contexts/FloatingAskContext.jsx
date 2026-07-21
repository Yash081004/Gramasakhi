import React, { createContext, useContext, useState, useCallback } from 'react';

const FloatingAskContext = createContext();

export function FloatingAskProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <FloatingAskContext.Provider value={{ isOpen, open, close, toggle, query, setQuery }}>
      {children}
    </FloatingAskContext.Provider>
  );
}

export function useFloatingAsk() {
  const ctx = useContext(FloatingAskContext);
  if (!ctx) throw new Error('useFloatingAsk must be used within FloatingAskProvider');
  return ctx;
}
