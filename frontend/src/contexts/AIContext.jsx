// src/AIContext.jsx (patch)
import React, { createContext, useContext, useState, useEffect } from "react";

const AIContext = createContext();

export function AIProvider({ children }) {
  const [aiMode, setAiMode] = useState(() => {
    // default to llama (fast, local) so OpenAI 401s do not block dev
    return localStorage.getItem("doculex_ai_mode") || "llama";
  });

  useEffect(() => {
    localStorage.setItem("doculex_ai_mode", aiMode);
  }, [aiMode]);

  return (
    <AIContext.Provider value={{ aiMode, setAiMode }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  return useContext(AIContext);
}
