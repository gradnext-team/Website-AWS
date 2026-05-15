import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "@/index.css";
import App from "@/App";
import { getFbpCookie, getFbcCookie } from "@/utils/metaPixel";

// Configure axios to send auth token from localStorage if available
axios.interceptors.request.use(
  (config) => {
    // Always include credentials for cookies
    config.withCredentials = true;
    
    // Also try to add Authorization header from localStorage as fallback
    const token = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add Meta tracking cookies as headers for server-side event deduplication
    const fbp = getFbpCookie();
    const fbc = getFbcCookie();
    if (fbp) config.headers['X-Meta-Fbp'] = fbp;
    if (fbc) config.headers['X-Meta-Fbc'] = fbc;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Suppress React error overlay for non-critical concurrent rendering warnings
if (process.env.NODE_ENV === 'development') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('concurrent rendering') || 
       args[0].includes('synchronously rendering'))
    ) {
      return; // Suppress this specific warning
    }
    originalConsoleError.apply(console, args);
  };
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
