/**
 * DocuLex Design System - Advanced Modern UI Tokens
 * Inspired by: Linear, Notion, Vercel, ChatGPT, Stripe Dashboard
 * Features: Glassmorphism, smooth animations, light/dark modes
 */

// Color palette
export const colors = {
  primary: {
    50: '#f0f4ff',
    100: '#e6ecff',
    200: '#c7d9ff',
    300: '#a8c5ff',
    400: '#6f9aff',
    500: '#3b82f6',
    600: '#2d56cc',
    700: '#1f3aa3',
    800: '#162575',
    900: '#0d1847',
  },
  secondary: {
    50: '#f5f0ff',
    100: '#e8dcff',
    200: '#d1b8ff',
    300: '#b894ff',
    400: '#9457ff',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#3f0f5c',
  },
  accent: {
    cyan: '#06b6d4',
    emerald: '#10b981',
    orange: '#f97316',
    rose: '#f43f5e',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#0a0e27',
  },
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

// Typography system
export const typography = {
  fontFamily: {
    display: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
};

// Spacing scale
export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
};

// Shadow system
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  md: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  glow: '0 0 20px rgba(59, 130, 246, 0.3)',
  'glow-purple': '0 0 30px rgba(139, 92, 246, 0.2)',
};

// Border radius system
export const borderRadius = {
  none: '0',
  sm: '6px',
  base: '8px',
  md: '10px',
  lg: '12px',
  xl: '14px',
  '2xl': '20px',
  full: '9999px',
};

// Transition timings
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// Glassmorphism effects
export const glass = {
  light: 'backdrop-blur-md bg-white/70 border border-white/20',
  dark: 'backdrop-blur-md bg-gray-900/50 border border-gray-700/30',
  ultra: 'backdrop-blur-xl bg-white/50 border border-white/10',
};

// Gradients
export const gradients = {
  'blue-purple': 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
  'cyan-blue': 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'purple-rose': 'linear-gradient(135deg, #8b5cf6 0%, #f43f5e 100%)',
};
