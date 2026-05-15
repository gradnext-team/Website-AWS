import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin, useGoogleLogin } from '@react-oauth/google';
import { Mail, Lock, User, Loader2, ArrowRight, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { trackLogin, trackSignUp, setUserData, getMetaHeaders } from '../utils/metaPixel';
import { trackGoogleAdsLogin, trackGoogleAdsSignUp } from '../utils/googleAds';
import { trackLogin as mixpanelTrackLogin, identifyUser } from '../utils/mixpanel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Detect if user is on mobile Safari (most problematic for OAuth popups)
const isMobileSafari = () => {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notChrome = !/CriOS/.test(ua);
  return iOS && webkit && notChrome;
};

// Detect if user is on any mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

const LoginModal = ({ isOpen, onClose, onSuccess, skipNavigation = false }) => {
  const navigate = useNavigate();
  
  // Main tabs: 'login' or 'signup'
  const [activeTab, setActiveTab] = useState('signup');
  
  // Steps: 'form', 'otp', 'forgot', 'reset'
  const [step, setStep] = useState('form');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [googleOAuthInProgress, setGoogleOAuthInProgress] = useState(false);

  // Store state before Google OAuth for mobile Safari
  useEffect(() => {
    // Check if we're returning from a Google OAuth flow
    const pendingOAuth = sessionStorage.getItem('google_oauth_pending');
    if (pendingOAuth && isOpen) {
      sessionStorage.removeItem('google_oauth_pending');
      // The OAuth popup should have completed - just keep modal open
    }
  }, [isOpen]);

  // Safe error setter that filters out postMessage errors
  const setSafeError = (errorMessage) => {
    if (!errorMessage) {
      setError('');
      return;
    }
    
    // Filter out postMessage errors - these are benign Google OAuth SDK issues
    const errorStr = typeof errorMessage === 'string' ? errorMessage : errorMessage.toString();
    if (errorStr.toLowerCase().includes('postmessage') || 
        errorStr.toLowerCase().includes('request object could not be cloned')) {
      console.warn('Suppressed postMessage error:', errorStr);
      return; // Don't show to user
    }
    
    setError(errorMessage);
  };

  const resetForm = () => {
    setActiveTab('signup');
    setStep('form');
    setEmail('');
    setPassword('');
    setName('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setSafeError('');
    setOtpSent(false);
    setShowPassword(false);
  };

  // Reset state when modal closes or tab changes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Add error listener to catch and suppress postMessage errors
  useEffect(() => {
    const handleError = (event) => {
      if (event.error && event.error.message) {
        const msg = event.error.message.toLowerCase();
        if (msg.includes('postmessage') || msg.includes('request object could not be cloned')) {
          event.preventDefault();
          event.stopPropagation();
          console.warn('Suppressed postMessage error in LoginModal');
          return false;
        }
      }
    };

    window.addEventListener('error', handleError, true);
    return () => window.removeEventListener('error', handleError, true);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setStep('form');
    setSafeError('');
    setOtp('');
  };

  // Login with email/password
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setSafeError('Please enter email and password');
      return;
    }

    setLoading(true);
    setSafeError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, create a generic error
        throw new Error('Invalid email or password');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid email or password');
      }

      // Ensure we're not passing Response objects
      const userData = data.user ? { ...data.user } : data.user;
      
      // Set external_id on Meta Pixel for deduplication with server CAPI
      if (userData?.id) {
        setUserData(userData.id, userData.email);
      }
      
      // Track login event with Meta Pixel
      trackLogin({ method: 'email' });
      // Track login event with Google Ads
      trackGoogleAdsLogin({ method: 'email' });
      // Track login event with Mixpanel
      mixpanelTrackLogin(userData, 'email');
      
      if (onSuccess) onSuccess(userData);
      if (!skipNavigation) navigate(data.redirect || '/dashboard');
      onClose();
    } catch (err) {
      setSafeError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP for signup
  const handleSendSignupOTP = async (e) => {
    e.preventDefault();
    if (!email || !name) {
      setSafeError('Please enter your name and email');
      return;
    }

    setLoading(true);
    setSafeError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup' })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Failed to send verification code. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send verification code');
      }

      if (!data.is_new_user) {
        setSafeError('Email already registered. Please login instead.');
        return;
      }

      setOtpSent(true);
      setStep('otp');
    } catch (err) {
      setSafeError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Complete signup with OTP and password
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setSafeError('Please enter the 6-digit code');
      return;
    }
    if (!password || password.length < 6) {
      setSafeError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setSafeError('Passwords do not match');
      return;
    }

    setLoading(true);
    setSafeError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
        credentials: 'include',
        body: JSON.stringify({ email, name, password, otp })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Signup failed. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Signup failed');
      }

      // Set external_id on Meta Pixel for deduplication with server CAPI
      if (data.user?.id) {
        setUserData(data.user.id, data.user.email);
      }

      // Track signup event with Meta Pixel
      trackSignUp({ method: 'email' });
      // Track signup event with Google Ads
      trackGoogleAdsSignUp({ method: 'email' });

      if (onSuccess) onSuccess(data.user);
      if (!skipNavigation) navigate(data.redirect || '/dashboard');
      onClose();
    } catch (err) {
      setSafeError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP for password reset
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setSafeError('Please enter your email');
      return;
    }

    setLoading(true);
    setSafeError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Failed to send reset code. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send reset code');
      }

      setOtpSent(true);
      setStep('reset');
    } catch (err) {
      setSafeError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset password with OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setSafeError('Please enter the 6-digit code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setSafeError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSafeError('Passwords do not match');
      return;
    }

    setLoading(true);
    setSafeError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp, new_password: newPassword })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Password reset failed. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Password reset failed');
      }

      if (onSuccess) onSuccess(data.user);
      if (!skipNavigation) navigate(data.redirect || '/dashboard');
      onClose();
    } catch (err) {
      setSafeError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setLoading(true);
    setSafeError('');

    try {
      const endpoint = step === 'reset' ? '/api/auth/forgot-password' : '/api/auth/send-otp';
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: activeTab })
      });

      if (!response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          throw new Error('Failed to resend code');
        }
        throw new Error(data.detail || 'Failed to resend code');
      }

      setOtp('');
      alert('New verification code sent!');
    } catch (err) {
      setSafeError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-In success
  const handleGoogleSuccess = async (credentialResponse) => {
    // Guard against invalid credential responses
    if (!credentialResponse || !credentialResponse.credential) {
      console.error('Invalid credential response:', credentialResponse);
      setSafeError('Google sign-in failed. Please try again.');
      return;
    }

    setLoading(true);
    setSafeError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialResponse.credential })
      });

      let data;
      try {
        const responseText = await response.text();
        console.log('Raw response:', responseText.substring(0, 500)); // Log first 500 chars
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        console.error('Response status:', response.status);
        throw new Error(`Invalid response from server (Status: ${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Google sign-in failed');
      }

      // Store session tokens
      if (data.session_token) localStorage.setItem('session_token', data.session_token);
      if (data.auth_token) localStorage.setItem('auth_token', data.auth_token);

      // Ensure we're not passing Response objects
      const userData = data.user ? { ...data.user } : data.user;
      
      // Set external_id on Meta Pixel for deduplication with server CAPI
      if (userData?.id) {
        setUserData(userData.id, userData.email);
      }
      
      // Track Google login/signup with Meta Pixel
      // Check if it's a new user (signup) or existing user (login)
      if (data.is_new_user) {
        trackSignUp({ method: 'google' });
        trackGoogleAdsSignUp({ method: 'google' });
      } else {
        trackLogin({ method: 'google' });
        trackGoogleAdsLogin({ method: 'google' });
      }
      // Track with Mixpanel
      mixpanelTrackLogin(userData, 'google');
      
      if (onSuccess) onSuccess(userData);
      
      // Close modal first, then navigate
      onClose();
      
      // Small delay before navigation on mobile to ensure modal closes
      if (isMobileDevice()) {
        setTimeout(() => {
          if (!skipNavigation) navigate(data.redirect || '/dashboard');
        }, 100);
      } else {
        if (!skipNavigation) navigate(data.redirect || '/dashboard');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setSafeError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (error) => {
    // Handle the postMessage cloning error gracefully
    // This error can occur when the Google OAuth popup fails to communicate properly
    console.log('Google sign-in error (may be benign):', error);
    
    // Check if it's the postMessage cloning error - this is often a false positive
    // The error occurs in Google's SDK but doesn't prevent authentication
    if (error && typeof error === 'object') {
      // Don't show error for popup closed scenarios
      if (error.type === 'popup_closed' || error.error === 'popup_closed_by_user') {
        return; // User just closed the popup, not an error
      }
      
      // Don't show error for postMessage cloning - it's a known Google OAuth SDK issue
      if (error.message && error.message.includes('postMessage')) {
        console.log('Ignoring postMessage cloning error (Google OAuth SDK issue)');
        return;
      }
      
      // Check for specific error types that we can ignore
      if (error.type === 'idpiframe_initialization_failed' && error.details && error.details.includes('postMessage')) {
        console.log('Ignoring iframe initialization postMessage error');
        return;
      }
    }
    
    // Only show error message for actual failures
    setSafeError('Google sign-in failed. Please try again or use email/password.');
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-lg p-0 overflow-hidden" 
        style={{ maxWidth: '520px' }}
        preventAutoFocus={isMobileDevice()}
      >
        {/* Header with gradient background */}
        <div 
          className="px-8 pt-8 pb-6"
          style={{ 
            background: 'linear-gradient(180deg, rgba(140, 157, 255, 0.08) 0%, rgba(140, 157, 255, 0.02) 50%, white 100%)'
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
              {step === 'forgot' && 'Forgot Password'}
              {step === 'reset' && 'Reset Password'}
              {step === 'form' && (activeTab === 'login' ? 'Welcome Back' : 'Create Account')}
              {step === 'otp' && 'Verify Email'}
            </DialogTitle>
            <DialogDescription className="text-center" style={{ color: 'var(--gn-grey)' }}>
              {step === 'forgot' && 'Enter your email to receive a reset code'}
              {step === 'reset' && `Enter the code sent to ${email}`}
              {step === 'form' && activeTab === 'login' && 'Sign in to continue your interview prep'}
              {step === 'form' && activeTab === 'signup' && 'Start your journey to consulting success'}
              {step === 'otp' && `We sent a verification code to ${email}`}
            </DialogDescription>
          </DialogHeader>

          {/* Tab Switcher - only show on form step */}
          {step === 'form' && (
            <div className="flex mt-6 gap-4 justify-center">
              <button
                onClick={() => handleTabChange('login')}
                className="relative pb-2 text-base font-semibold transition-colors"
                style={{ color: activeTab === 'login' ? 'var(--gn-rhino)' : 'var(--gn-grey)' }}
              >
                Login
                {activeTab === 'login' && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}
                  />
                )}
              </button>
              <button
                onClick={() => handleTabChange('signup')}
                className="relative pb-2 text-base font-semibold transition-colors"
                style={{ color: activeTab === 'signup' ? 'var(--gn-rhino)' : 'var(--gn-grey)' }}
              >
                Sign Up
                {activeTab === 'signup' && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}
                  />
                )}
              </button>
            </div>
          )}
        </div>

        <div className="px-8 pb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* LOGIN FORM */}
          {step === 'form' && activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Google Sign In — placed at the top so mobile users don't have to scroll */}
              <div className="flex justify-center w-full">
                <div className="w-full" style={{ minHeight: '44px' }}>
                  {isMobileSafari() ? (
                    <Button
                      type="button"
                      onClick={() => {
                        window.location.href = `${BACKEND_URL}/api/auth/google/login`;
                      }}
                      className="w-full h-11 flex items-center justify-center gap-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                      data-testid="google-signin-btn-login"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </Button>
                  ) : (
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      useOneTap={false}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="rectangular"
                      width="100%"
                      auto_select={false}
                      ux_mode="popup"
                      prompt_parent_id="google-signin-container-login"
                    />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white" style={{ color: 'var(--gn-grey)' }}>or sign in with email</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                    style={{ color: 'var(--gn-grey)' }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep('forgot')}
                  className="text-sm font-medium hover:opacity-80"
                  style={{ color: 'var(--gn-periwinkle)' }}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Login'}
              </Button>
            </form>
          )}

          {/* SIGNUP FORM - Step 1: Name & Email */}
          {step === 'form' && activeTab === 'signup' && (
            <form onSubmit={handleSendSignupOTP} className="space-y-4">
              {/* Google Sign Up — placed at the top so mobile users don't have to scroll */}
              <div className="flex justify-center w-full">
                <div className="w-full" style={{ minHeight: '44px' }}>
                  {isMobileSafari() ? (
                    <Button
                      type="button"
                      onClick={() => {
                        window.location.href = `${BACKEND_URL}/api/auth/google/login`;
                      }}
                      className="w-full h-11 flex items-center justify-center gap-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                      data-testid="google-signin-btn-signup"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </Button>
                  ) : (
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      useOneTap={false}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="rectangular"
                      width="100%"
                      auto_select={false}
                      ux_mode="popup"
                      prompt_parent_id="google-signup-container"
                    />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white" style={{ color: 'var(--gn-grey)' }}>or sign up with email</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="pl-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* SIGNUP FORM - Step 2: OTP & Password */}
          {step === 'otp' && activeTab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Verification Code</label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="h-14 text-center text-xl tracking-[0.5em] font-mono border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Create Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                    style={{ color: 'var(--gn-grey)' }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="flex items-center hover:opacity-80"
                  style={{ color: 'var(--gn-grey)' }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="font-medium hover:opacity-80"
                  style={{ color: 'var(--gn-periwinkle)' }}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD - Enter Email */}
          {step === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Code'}
              </Button>

              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full text-sm flex items-center justify-center hover:opacity-80"
                style={{ color: 'var(--gn-grey)' }}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to login
              </button>
            </form>
          )}

          {/* RESET PASSWORD - Enter OTP & New Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Reset Code</label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="h-14 text-center text-xl tracking-[0.5em] font-mono border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                    style={{ color: 'var(--gn-grey)' }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--gn-rhino)' }}>Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10 h-12 border-slate-200 focus:border-[var(--gn-periwinkle)] focus:ring-[var(--gn-periwinkle)]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full h-12 text-base font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep('forgot')}
                  className="flex items-center hover:opacity-80"
                  style={{ color: 'var(--gn-grey)' }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="font-medium hover:opacity-80"
                  style={{ color: 'var(--gn-periwinkle)' }}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Scrolling Logos at Bottom */}
        <div 
          className="relative overflow-hidden py-4 border-t"
          style={{ borderColor: 'rgba(140, 157, 255, 0.15)', background: 'rgba(140, 157, 255, 0.03)' }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10"></div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10"></div>
          
          <div className="flex animate-scroll-logos-modal">
            {[1, 2].map((set) => (
              <div key={set} className="flex items-center gap-8 shrink-0 px-4">
                <img src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/iey697kq_image.png" alt="McKinsey" className="h-4 object-contain opacity-40 grayscale" />
                <img src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/6kt0kjbt_image.png" alt="Bain" className="h-4 object-contain opacity-40 grayscale" />
                <img src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/qpzhjb32_image.png" alt="BCG" className="h-4 object-contain opacity-40 grayscale" />
                <img src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/4blcvs2r_image.png" alt="Kearney" className="h-5 object-contain opacity-40 grayscale" />
                <img src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/j5bobe8l_image.png" alt="Strategy&" className="h-4 object-contain opacity-40 grayscale" />
                <img src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/fv6fonfo_image.png" alt="EY Parthenon" className="h-4 object-contain opacity-40 grayscale" />
              </div>
            ))}
          </div>
          
          <style>{`
            @keyframes scroll-logos-modal {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-scroll-logos-modal {
              animation: scroll-logos-modal 20s linear infinite;
            }
          `}</style>
        </div>
      </DialogContent>
    </Dialog>
    </GoogleOAuthProvider>
  );
};

export default LoginModal;
