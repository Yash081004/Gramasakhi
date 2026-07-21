// src/App.jsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import AppShell from "./layout/AppShell";
import { AIProvider } from "./contexts/AIContext";
import { useAuth } from './contexts/AuthContext';
import { ToastProvider } from "./contexts/ToastContext";
import { FloatingAskProvider } from "./contexts/FloatingAskContext";
import FloatingAskButton from "./components/FloatingAskButton";

// Pages
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";
import Ask from "./pages/Ask";
import Summarize from "./pages/Summarize";
import Compare from "./pages/Compare";
import Report from "./pages/Report";
import Search from "./pages/Search";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";
import Analytics from "./pages/Features";

// Auth Pages
import Login from "./auth/Login";
import Register from "./auth/Register";
import ForgotPassword from "./auth/ForgotPassword";
import VerifyOtp from "./auth/VerifyOtp";
import ResetPassword from "./auth/ResetPassword";

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  // Prefer using AuthContext when available
  try {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
  } catch (e) {
    // Fallback to token check if AuthProvider not mounted
    const token = localStorage.getItem("doculex_token");
    if (!token) return <Navigate to="/login" replace />;
  }

  return children;
};

// Layout Wrapper with Floating Ask
const AppLayout = () => {
  return (
    <FloatingAskProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <FloatingAskButton />
    </FloatingAskProvider>
  );
};

export default function App() {
  return (
    <ToastProvider>
        <AIProvider>
          <Routes>
            {/* PUBLIC AUTH ROUTES */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* PROTECTED APP ROUTES */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="documents" element={<Documents />} />
              <Route path="chat" element={<Chat />} />
              <Route path="ask" element={<Ask />} />
              <Route path="summarize" element={<Summarize />} />
              <Route path="compare" element={<Compare />} />
              <Route path="report" element={<Report />} />
              <Route path="search" element={<Search />} />
              <Route path="upload" element={<Upload />} />
              <Route path="features" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AIProvider>

    </ToastProvider>
  );
}