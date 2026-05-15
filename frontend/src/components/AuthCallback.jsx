import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * AuthCallback - Handles Google OAuth callback
 * Processes session_id from URL fragment and exchanges it for user session
 * 
 * Important: We don't pass user data through navigation state to avoid
 * "postMessage cloning" errors. The dashboard fetches user data via /api/auth/me.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          console.error('No session_id found in URL');
          navigate('/', { replace: true });
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Exchange session_id for user session
        const response = await fetch(`${BACKEND_URL}/api/auth/google/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ session_id: sessionId })
        });

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          throw new Error('Invalid response from server');
        }

        if (!response.ok) {
          throw new Error(data.detail || 'Authentication failed');
        }
        
        // Navigate to appropriate dashboard based on role
        // Don't pass user in state - dashboard will fetch it via /api/auth/me
        const redirectPath = data.redirect || '/dashboard';
        navigate(redirectPath, { 
          replace: true
        });

      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/', { 
          replace: true,
          state: { authError: error.message }
        });
      }
    };

    processAuth();
  }, [navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Signing you in...
        </h2>
        <p className="text-slate-500">
          Please wait while we complete authentication
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
