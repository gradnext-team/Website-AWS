import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import axios from 'axios';
import { trackLogin } from '../../utils/tracking';
import { setUserData } from '../../utils/metaPixel';
import {
  Video, Calendar, Zap, Users, UserCheck, GraduationCap,
  Home, ChevronRight, LogOut, Menu, X, Lock, Crown, User, HelpCircle, Clock, Sparkles, CreditCard, Star, Image as ImageIcon, Trophy, Bell
} from 'lucide-react';
// Premium Phosphor Icons for enhanced UI
import {
  House as PhHome,
  VideoCamera as PhVideo,
  CalendarBlank as PhCalendar,
  Lightning as PhZap,
  UsersThree as PhUsers,
  UserCircleCheck as PhUserCheck,
  GraduationCap as PhGraduationCap,
  SignOut as PhSignOut,
  Crown as PhCrown,
  Sparkle as PhSparkle,
  Question as PhQuestion,
  ChatTeardropDots as PhFeedback,
  ArrowSquareOut as PhArrowOut,
  LockKey as PhLock,
  Phone as PhoneCall
} from '@phosphor-icons/react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import PaymentModal from '../PaymentModal';
import ProfileOnboarding from './ProfileOnboarding';
import MandatoryFeedbackModal from '../MandatoryFeedbackModal';
import NotificationPopup from '../NotificationPopup';
import { usePlansModal } from '../../contexts/PlansModalContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Calculate days left based on plan duration and subscription start date
const calculateDaysLeft = (user, planConfig) => {
  if (!user?.plan || user.plan === 'free_trial') return null;
  
  // Check if plan has unlimited access (no duration_value)
  if (!planConfig?.duration_value) return null;
  
  // Calculate end date based on plan config
  const startDate = new Date(user.subscription_date || user.plan_start_date || user.created_at || Date.now());
  const endDate = new Date(startDate);
  
  const durationValue = planConfig.duration_value;
  const durationUnit = planConfig.duration_unit || 'months';
  
  if (durationUnit === 'days') {
    endDate.setDate(endDate.getDate() + durationValue);
  } else if (durationUnit === 'weeks') {
    endDate.setDate(endDate.getDate() + (durationValue * 7));
  } else { // months
    endDate.setMonth(endDate.getMonth() + durationValue);
  }
  
  const now = new Date();
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Dashboard Context
export const DashboardContext = createContext(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { openPlansModal } = usePlansModal();
  const [user, setUser] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plansMap, setPlansMap] = useState({}); // Map of plan_key to plan config
  const [showProfileOnboarding, setShowProfileOnboarding] = useState(false);
  const [activeCompetitions, setActiveCompetitions] = useState([]); // For Case Competition nav
  const [upcomingWorkshops, setUpcomingWorkshops] = useState([]); // For Workshop upcoming badge
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0); // New: unread notification count

  // Cohort post-payment states
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showCohortWelcome, setShowCohortWelcome] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState('');

  // Support and Feedback modal states
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [supportQuery, setSupportQuery] = useState('');
  const [supportAttachment, setSupportAttachment] = useState(null);
  const [supportAttachmentPreview, setSupportAttachmentPreview] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Handle attachment file selection
  const handleAttachmentChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select an image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setSupportAttachmentPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to backend
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${BACKEND_URL}/api/support/upload-attachment`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      
      setSupportAttachment(res.data.attachment_url);
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      alert('Failed to upload attachment. Please try again.');
      setSupportAttachmentPreview(null);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = () => {
    setSupportAttachment(null);
    setSupportAttachmentPreview(null);
  };

  // Fetch all plans to build the feature access map
  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/resources/plans`);
      const plans = res.data.plans || [];
      const map = {};
      plans.forEach(plan => {
        map[plan.id] = plan; // plan.id is the plan_key
      });
      setPlansMap(map);
      return map;
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      return {};
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Get token from localStorage as fallback for mobile Safari
      const token = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${BACKEND_URL}/api/resources/dashboard-summary`, {
        withCredentials: true,
        headers
      });
      setDashboardData(response.data);
      setUser(response.data.user);
      // Set external_id on Meta Pixel for deduplication (returning authenticated users)
      if (response.data.user?.id) {
        setUserData(response.data.user.id, response.data.user.email);
      }
      trackLogin(); // Track daily return for lead scoring
      return response.data;
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      return null;
    }
  };

  // Refresh user data - useful after booking
  const refreshUser = async () => {
    return await fetchDashboardData();
  };

  // Fetch active competitions for nav visibility
  const fetchActiveCompetitions = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/competitions/competitions/active`, {
        withCredentials: true
      });
      setActiveCompetitions(res.data.competitions || []);
    } catch (error) {
      // Silently fail - competitions feature might not be set up
      console.log('No active competitions');
    }
  };

  // Fetch upcoming workshops for badge
  const fetchUpcomingWorkshops = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/resources/workshops`, {
        withCredentials: true
      });
      const workshops = res.data.workshops || [];
      const upcoming = workshops.filter(w => !w.is_past);
      setUpcomingWorkshops(upcoming);
    } catch (error) {
      console.log('Failed to fetch workshops');
    }
  };

  // Fetch unread notification count
  const fetchUnreadNotificationCount = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/candidate/notifications/unread-count`, {
        withCredentials: true
      });
      setUnreadNotificationCount(res.data.unread_count || 0);
    } catch (error) {
      console.log('Failed to fetch unread notification count');
      setUnreadNotificationCount(0);
    }
  };

  useEffect(() => {
    const initDashboard = async () => {
      try {
        // Handle OAuth redirect tokens from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const sessionToken = urlParams.get('session_token');
        const authToken = urlParams.get('auth_token');
        const authSuccess = urlParams.get('auth_success');
        const authError = urlParams.get('auth_error');
        const upgradeParam = urlParams.get('upgrade');
        const cohortEnrolled = urlParams.get('cohort') === 'enrolled';
        const welcomeParam = urlParams.get('welcome') === '1';
        const setPasswordParam = urlParams.get('set_password') === '1';
        
        console.log('[Dashboard] Init - authSuccess:', authSuccess, 'hasToken:', !!sessionToken);
        
        // Handle upgrade param - open plans modal
        if (upgradeParam === 'true') {
          // Remove the param from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          // Open plans modal after a short delay to ensure context is ready
          setTimeout(() => {
            if (openPlansModal) {
              openPlansModal();
            }
          }, 500);
        }

        // Handle cohort post-payment flags
        if (cohortEnrolled) {
          // Clean up URL params immediately
          window.history.replaceState({}, document.title, window.location.pathname);
          if (welcomeParam) setShowCohortWelcome(true);
          if (setPasswordParam) setShowSetPassword(true);
        }
        
        // Handle OAuth error
        if (authError) {
          console.error('[Dashboard] OAuth error:', authError);
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/', { replace: true });
          return;
        }
        
        if (authSuccess === 'true' && sessionToken) {
          // Store tokens from OAuth redirect
          console.log('[Dashboard] Storing OAuth tokens from redirect...');
          localStorage.setItem('session_token', sessionToken);
          if (authToken) {
            localStorage.setItem('auth_token', authToken);
          }
          // Clean up URL params
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('[Dashboard] OAuth tokens stored successfully');
        }
        
        await fetchPlans();
        console.log('[Dashboard] Plans fetched, now fetching dashboard data...');
        
        const data = await fetchDashboardData();
        console.log('[Dashboard] Dashboard data result:', data ? 'success' : 'failed');
        
        if (!data) {
          // Check if we have a token but API failed - might be token issue
          const token = localStorage.getItem('session_token');
          if (token) {
            console.error('[Dashboard] API failed but token exists - clearing and redirecting');
            localStorage.removeItem('session_token');
            localStorage.removeItem('auth_token');
          }
          navigate('/', { replace: true });
        } else {
          // Check if user is a mentor or admin and redirect to appropriate dashboard
          // Mentors should always go to mentor dashboard, not candidate dashboard
          if (data.user?.is_mentor) {
            navigate('/mentor-dashboard', { replace: true });
            return;
          }
          if (data.user?.is_admin) {
            navigate('/admin', { replace: true });
            return;
          }
          
          // Check if user needs to complete profile onboarding (only for candidates)
          // Skip if we're already showing the set-password modal for cohort users
          if (!data.user?.onboarding_completed && !setPasswordParam) {
            setShowProfileOnboarding(true);
          }
          // If user still has needs_password_setup flag, show set-password modal
          if (data.user?.needs_password_setup) {
            setShowSetPassword(true);
          }
          
          // Fetch active competitions for nav
          await fetchActiveCompetitions();
          
          // Fetch upcoming workshops for badge
          await fetchUpcomingWorkshops();
          
          // Fetch unread notification count
          await fetchUnreadNotificationCount();
        }
        setLoading(false);
      } catch (err) {
        console.error('[Dashboard] Init error caught:', err);
        setLoading(false);
        // Don't redirect on error - show the dashboard with error state instead
      }
    };

    initDashboard().catch(error => {
      console.error('[Dashboard] Init promise error:', error);
      setLoading(false);
      navigate('/', { replace: true });
    });
  }, [navigate]);

  const handleProfileOnboardingComplete = async () => {
    setShowProfileOnboarding(false);
    // Refresh user data to get updated profile
    await fetchDashboardData();
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate('/', { replace: true });
    }
  };

  const getPlanLabel = (plan) => {
    const labels = {
      'free_trial': 'Free Trial',
      'basic': 'Basic',
      'basic_plan': 'Basic',
      'pro': 'Pro',
      'pro_plan': 'Pro',
      'pro_plus': 'Pro Plus',
      'last_mile': 'Last Mile',
      'mid_mile': 'Mid Mile',
      'full_prep': 'Full Prep',
      'cohort_premium': 'Cohort Premium',
      'cohort_elite': 'Cohort Elite',
    };
    return labels[plan] || plan?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Free';
  };

  const getPlanColor = (plan) => {
    // Using brand colors via inline styles would be better, but for badge classes:
    if (plan === 'free_trial') return 'bg-[#EAEAEA] text-[#323232]';
    if (plan?.includes('cohort')) return 'bg-[#DEE3FF] text-[#2E3558]';
    if (['last_mile', 'mid_mile', 'full_prep'].includes(plan)) return 'bg-[#FFE6B7] text-[#2E3558]';
    // Subscription plans (basic_plan, pro_plan, pro_plus)
    if (['basic_plan', 'pro_plan', 'pro_plus', 'basic', 'pro'].includes(plan)) return 'bg-[#DEE3FF] text-[#2E3558]';
    return 'bg-[#DEE3FF] text-[#2E3558]';
  };

  // Check if feature is locked based on user's plan (dynamic from database)
  // NEW: With item-level locking, pages are never completely locked
  // Instead, individual items within pages are locked based on plan status
  const isFeatureLocked = (feature) => {
    const planKey = user?.plan;
    
    // Profile, overview, competition, and workshops are always unlocked for everyone
    if (feature === 'profile' || feature === 'overview' || feature === 'competition' || feature === 'workshops') return false;
    
    // NEW ACCESS CONTROL: Use plan_status.use_item_level_locking
    // When item-level locking is enabled, PAGES are accessible but ITEMS are locked
    // This means isFeatureLocked returns FALSE for pages (they're browsable)
    // The item-level locking is handled within each page component
    const planStatus = dashboardData?.plan_status || {};
    
    // If item-level locking is enabled (expired trial/plan), pages are still accessible
    // The locking happens at the item level within each page
    if (planStatus.use_item_level_locking) {
      // Coaching and peer-practice pages are always browsable
      if (feature === 'coaching' || feature === 'peer-practice') return false;
      // Courses, drills, workshops, materials - pages accessible with item-level locks
      if (['courses', 'drills', 'workshops', 'materials'].includes(feature)) return false;
    }
    
    // Check custom_access from admin - this takes precedence over plan defaults
    const access = dashboardData?.access || {};
    const featureAccessMapping = {
      'courses': 'courses',
      'workshops': 'workshops',
      'drills': 'drills',
      'materials': 'materials',
      'peer-practice': 'peer_practice',
      'coaching': 'coaching',
      'cohort': 'cohort'
    };
    
    const accessKey = featureAccessMapping[feature];
    if (accessKey && access[accessKey] === false) {
      // Workshops are never locked regardless of admin settings
      if (feature === 'workshops') return false;
      return true; // Admin has explicitly revoked access
    }
    
    // Coaching, peer-practice, and workshops are always unlocked (users can browse, but pay to book if needed)
    // Unless explicitly revoked above
    if (feature === 'coaching' || feature === 'peer-practice' || feature === 'workshops') return false;
    
    // Get the plan config from database
    const planConfig = plansMap[planKey];
    
    // If no plan config found, use fallback logic
    if (!planConfig) {
      // Free trial - most features unlocked, only cohort locked
      if (planKey === 'free_trial') {
        const freeFeatures = ['overview', 'courses', 'drills', 'materials', 'profile', 'peer-practice', 'coaching', 'competition', 'workshops'];
        return !freeFeatures.includes(feature);
      }
      return false; // If we can't find the plan, don't lock
    }
    
    const planFeatureKey = featureAccessMapping[feature];
    if (!planFeatureKey) return false;
    
    // Check if the feature is enabled in the plan
    const features = planConfig.features || {};
    return features[planFeatureKey] === false;
  };

  // State for upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');
  
  // State for payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);

  // Fetch available plans for upgrade
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/resources/plans`);
        // Filter out free trial and sort by price
        const paidPlans = (res.data.plans || [])
          .filter(p => p.price > 0)
          .sort((a, b) => a.price - b.price);
        setAvailablePlans(paidPlans);
      } catch (error) {
        console.error('Failed to fetch plans:', error);
      }
    };
    fetchPlans();
  }, []);

  const handleLockedFeatureClick = (featureName) => {
    setLockedFeatureName(featureName);
    // Show the global plans modal
    openPlansModal();
  };
  
  const handleUpgradeClick = (plan) => {
    setSelectedPlan(plan);
    setShowUpgradeModal(false);
    setShowPaymentModal(true);
  };
  
  // Handle plan selection from payment modal
  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };
  
  const handlePaymentSuccess = async (data) => {
    // Refresh user data after successful payment
    await refreshUser();
    setShowPaymentModal(false);
    setSelectedPlan(null);
  };

  const navItems = [
    { icon: PhHome, label: 'Dashboard', path: '/dashboard', exact: true, tourId: 'sidebar-overview', featureKey: 'overview' },
    { icon: PhVideo, label: 'Courses', path: '/dashboard/courses', tourId: 'sidebar-courses', featureKey: 'courses' },
    { icon: PhZap, label: 'Case Drills', path: '/dashboard/drills', tourId: 'sidebar-drills', featureKey: 'drills', beta: true },
    { icon: PhUsers, label: 'Peer Practice', path: '/dashboard/peer-practice', tourId: 'sidebar-peer', featureKey: 'peer-practice' },
    { icon: PhUserCheck, label: 'Coaching', path: '/dashboard/coaching', tourId: 'sidebar-coaching', featureKey: 'coaching', 
      showSessionsBadge: true,
      sessionsRemaining: user?.coaching_sessions_remaining,
      isUnlimited: user?.is_unlimited_coaching
    },
    { icon: PhCalendar, label: 'Workshops', path: '/dashboard/workshops', tourId: 'sidebar-workshops', featureKey: 'workshops',
      showUpcomingBadge: upcomingWorkshops.length > 0,
      upcomingCount: upcomingWorkshops.length
    },
  ];

  // Add cohort nav item for users who have cohort access
  if (dashboardData?.access?.cohort) {
    navItems.push({ icon: PhGraduationCap, label: 'Cohort', path: '/dashboard/cohort', tourId: 'sidebar-cohort', featureKey: 'cohort' });
  }

  // Add Case Competition nav item if there are active competitions
  if (activeCompetitions.length > 0) {
    navItems.push({ 
      icon: Trophy, 
      label: 'Case Competition', 
      path: '/dashboard/competition', 
      tourId: 'sidebar-competition', 
      featureKey: 'competition',
      highlight: true  // Special styling for competition
    });
  }

  // Add profile at the end
  navItems.push({ icon: User, label: 'My Profile', path: '/dashboard/profile', tourId: 'sidebar-profile', featureKey: 'profile' });

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={{ 
      user, 
      dashboardData, 
      setDashboardData, 
      refreshUser,
      showUpgradeModal: openPlansModal,
      refreshUnreadNotifications: fetchUnreadNotificationCount // Add refresh function
    }}>
      <div className="min-h-screen flex bg-white">
        {/* Mandatory Feedback Modal - shows on login if feedback is pending */}
        <MandatoryFeedbackModal userType="candidate" />
        {/* Admin-driven notification popup (close-only, max once/day) */}
        <NotificationPopup audience="candidate" />
        {/* Sidebar Overlay (Mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Fixed position with its own scroll */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
          style={{ borderRight: '1px solid var(--gn-grey-light)' }}
        >
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Logo with new gradnext logo */}
            <div className="p-6" style={{ borderBottom: '1px solid var(--gn-grey-light)' }}>
              <Link to="/" className="flex items-center gap-2">
                <img 
                  src="/gradnext-logo.png" 
                  alt="gradnext" 
                  className="h-8 w-auto"
                />
              </Link>
            </div>

            {/* User Info - Premium Card Style */}
            <div className="p-4" style={{ borderBottom: '1px solid var(--gn-grey-light)' }}>
              <div className="flex items-center gap-3">
                {user?.picture ? (
                  <img
                    src={user.picture.startsWith('data:') || user.picture.startsWith('http') ? user.picture : `${BACKEND_URL}/api${user.picture}`}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-offset-2"
                    style={{ '--tw-ring-color': 'var(--gn-periwinkle-light)' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                {!user?.picture && (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center ring-2 ring-offset-2" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', '--tw-ring-color': 'var(--gn-periwinkle-light)' }}>
                    <span className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>{user?.name?.[0]}</span>
                  </div>
                )}
                {user?.picture && (
                  <div className="w-12 h-12 rounded-full items-center justify-center hidden ring-2 ring-offset-2" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', '--tw-ring-color': 'var(--gn-periwinkle-light)' }}>
                    <span className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>{user?.name?.[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-base" style={{ color: 'var(--gn-rhino)' }}>{user?.name}</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1" style={{ backgroundColor: 'var(--gn-chrome-lightest)', color: 'var(--gn-rhino)' }}>
                    {user?.plan === 'free_trial' ? <Clock className="w-3.5 h-3.5" style={{ color: 'var(--gn-grey-dark)' }} /> : <Crown className="w-3.5 h-3.5" style={{ color: 'var(--gn-chrome-yellow)' }} />}
                    {getPlanLabel(user?.plan)}
                  </span>
                </div>
              </div>
              
              {/* Free Trial Status Banner */}
              {dashboardData?.trial_status?.is_trial && (
                <div className={`mt-3 p-3 rounded-lg ${
                  dashboardData.trial_status.is_expired 
                    ? 'bg-red-50 border border-red-200' 
                    : dashboardData.trial_status.days_remaining <= 3 
                      ? 'border'
                      : ''
                }`} style={!dashboardData.trial_status.is_expired && dashboardData.trial_status.days_remaining > 3 ? { backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' } : dashboardData.trial_status.days_remaining <= 3 && !dashboardData.trial_status.is_expired ? { backgroundColor: 'var(--gn-chrome-lightest)', borderColor: 'var(--gn-chrome-lighter)' } : {}}>
                  {dashboardData.trial_status.is_expired ? (
                    <>
                      <div className="flex items-center gap-2 text-red-700">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-semibold">Trial Expired</span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        Upgrade to continue accessing premium content
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white"
                        onClick={openPlansModal}
                        data-testid="upgrade-expired-btn"
                      >
                        <Crown className="w-3 h-3 mr-1" /> Upgrade
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2" style={{ color: 'var(--gn-grey-dark)' }}>
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">Free Trial</span>
                        </div>
                        <span className="text-sm font-bold" style={{ 
                          color: dashboardData.trial_status.days_remaining <= 1 ? '#DC2626' :
                          dashboardData.trial_status.days_remaining <= 3 ? 'var(--gn-chrome-yellow)' : 'var(--gn-rhino)'
                        }}>
                          {dashboardData.trial_status.days_remaining} day{dashboardData.trial_status.days_remaining !== 1 ? 's' : ''} left
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--gn-grey-light)' }}>
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, ((7 - dashboardData.trial_status.days_remaining) / 7) * 100)}%`,
                            backgroundColor: dashboardData.trial_status.days_remaining <= 1 ? '#DC2626' :
                              dashboardData.trial_status.days_remaining <= 3 ? 'var(--gn-chrome-yellow)' : 'var(--gn-periwinkle)'
                          }}
                        />
                      </div>
                      {dashboardData.trial_status.days_remaining <= 3 && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="mt-2 w-full"
                          style={{ borderColor: 'var(--gn-chrome-lighter)', color: 'var(--gn-chrome-yellow)' }}
                          onClick={openPlansModal}
                          data-testid="upgrade-btn"
                        >
                          <Crown className="w-3 h-3 mr-1" /> Upgrade
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Days Left - NEW LOGIC:
                  - Show for COACHING PROGRAMS (show_coaching_days: true)
                  - HIDE for SUBSCRIPTIONS (show_subscription_days: false) to reduce churn
              */}
              {dashboardData?.plan_status?.has_coaching_program && 
               dashboardData?.plan_status?.show_coaching_days && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  dashboardData?.plan_status?.coaching_program_expired
                    ? 'bg-red-50 border-red-200'
                    : 'bg-emerald-50 border-emerald-100'
                }`}>
                  {dashboardData?.plan_status?.coaching_program_expired ? (
                    <>
                      <div className="flex items-center gap-2 text-red-700">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-semibold">Coaching Program Expired</span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        Renew to continue accessing coaching features
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white"
                        onClick={openPlansModal}
                        data-testid="renew-coaching-btn"
                      >
                        <Crown className="w-3 h-3 mr-1" /> Renew Plan
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">Coaching Program</span>
                        </div>
                        {dashboardData?.plan_status?.coaching_program_days_remaining != null && (() => {
                          const daysLeft = dashboardData.plan_status.coaching_program_days_remaining;
                          const isLow = daysLeft <= 14;
                          const isVeryLow = daysLeft <= 7;
                          
                          return (
                            <span className={`text-sm font-bold ml-2 ${
                              isVeryLow ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              • {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                            </span>
                          );
                        })()}
                      </div>
                      {/* Progress bar for coaching */}
                      {dashboardData?.plan_status?.coaching_program_days_remaining != null && (() => {
                        const daysLeft = dashboardData.plan_status.coaching_program_days_remaining;
                        // Assume coaching is 90 days max (can be adjusted)
                        const totalDays = 90;
                        const daysUsed = totalDays - daysLeft;
                        const progress = Math.min(100, Math.max(0, (daysUsed / totalDays) * 100));
                        
                        return (
                          <div className="mt-2 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                progress > 90 ? 'bg-red-500' : progress > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
              
              {/* Subscription Status - NO days shown (reduces churn) */}
              {dashboardData?.plan_status?.has_subscription && 
               !dashboardData?.plan_status?.is_trial &&
               !dashboardData?.plan_status?.has_coaching_program && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  dashboardData?.plan_status?.subscription_expired 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100'
                }`}>
                  {dashboardData?.plan_status?.subscription_expired ? (
                    <>
                      <div className="flex items-center gap-2 text-red-700">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-semibold">Plan Expired</span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        Renew to continue accessing premium content
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white"
                        onClick={openPlansModal}
                        data-testid="renew-subscription-btn"
                      >
                        <Crown className="w-3 h-3 mr-1" /> Renew Plan
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-medium text-violet-700">
                        {getPlanLabel(user?.plan)} Active
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation - Premium Style matching Mentor Dashboard */}
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.path ? isActive(item.path, item.exact) : false;
                const locked = isFeatureLocked(item.featureKey);

                // Coming soon items - render as non-clickable
                if (item.comingSoon) {
                  return (
                    <div
                      key={item.label}
                      data-tour={item.tourId}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-not-allowed"
                      style={{ color: 'var(--gn-grey)' }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" weight="duotone" style={{ color: 'var(--gn-grey-light)' }} />
                      <span className="font-medium flex-1 text-sm">{item.label}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded" style={{ backgroundColor: 'var(--gn-grey-lightest)', color: 'var(--gn-grey)' }}>
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => {
                      setSidebarOpen(false);
                      if (locked) {
                        // Allow navigation but show upgrade modal
                        handleLockedFeatureClick(item.label);
                      }
                    }}
                    data-tour={item.tourId}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'text-white shadow-md'
                        : 'hover:bg-slate-50'
                    }`}
                    style={active 
                      ? { backgroundColor: 'var(--gn-rhino)' } 
                      : { color: 'var(--gn-grey-dark)' }
                    }
                  >
                    <Icon 
                      className="w-5 h-5 flex-shrink-0" 
                      weight={active ? 'fill' : 'duotone'}
                      style={!active ? { color: 'var(--gn-periwinkle)' } : {}}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.showSessionsBadge && (item.sessionsRemaining > 0 || item.isUnlimited) && (
                      <span 
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${active ? 'bg-white/20 text-white' : ''}`}
                        style={!active ? { 
                          backgroundColor: 'var(--gn-chrome-lighter)', 
                          color: 'var(--gn-rhino)' 
                        } : {}}
                        title="Coaching sessions remaining"
                      >
                        {item.isUnlimited ? '∞' : item.sessionsRemaining}
                      </span>
                    )}
                    {item.showUpcomingBadge && (
                      <span 
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${active ? 'bg-white/20 text-white' : 'text-white'}`}
                        style={!active ? { backgroundColor: 'var(--gn-chrome-yellow)' } : {}}
                        title={`${item.upcomingCount} upcoming workshop${item.upcomingCount !== 1 ? 's' : ''}`}
                      >
                        {item.upcomingCount} Upcoming
                      </span>
                    )}
                    {item.beta && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ${active ? 'bg-white/20 text-white' : 'text-white'}`} style={!active ? { backgroundColor: 'var(--gn-chrome-yellow)' } : {}}>
                        Beta
                      </span>
                    )}
                    {locked && !active && (
                      <PhLock className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                    )}
                    {active && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </Link>
                );
              })}
              
              {/* Logout Button - Premium Style */}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-red-50 group"
                  style={{ color: 'var(--gn-grey-dark)' }}
                  data-testid="logout-btn"
                >
                  <PhSignOut className="w-5 h-5 group-hover:text-red-500 transition-colors" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  <span className="group-hover:text-red-500 transition-colors">Log Out</span>
                </button>
              </div>

              {/* Feedback & Support */}
              <div className="pt-2 space-y-1">
                <button
                  onClick={() => setFeedbackModalOpen(true)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-slate-100"
                  style={{ color: 'var(--gn-grey-dark)' }}
                >
                  <PhFeedback className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  Feedback
                </button>
                <button
                  onClick={() => setSupportModalOpen(true)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-slate-100"
                  style={{ color: 'var(--gn-grey-dark)' }}
                >
                  <PhQuestion className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  Support
                </button>
              </div>
            </nav>

            {/* Upgrade CTA */}
            {user?.plan === 'free_trial' && (
              <div className="p-4" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
                <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--gn-rhino)' }}>
                  <h4 className="font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--gn-chrome-yellow)' }}>
                    <PhCrown className="w-4 h-4" weight="fill" />
                    Upgrade Now
                  </h4>
                  <p className="text-sm mb-3" style={{ color: 'var(--gn-periwinkle-light)' }}>Get full access to all resources</p>
                  <Button 
                    size="sm" 
                    className="w-full bg-white hover:bg-slate-50"
                    style={{ color: 'var(--gn-rhino)' }}
                    onClick={openPlansModal}
                    data-testid="view-plans-btn"
                  >
                    View Plans
                  </Button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - Scrollable with left margin for sidebar and gradient background */}
        <main className="flex-1 min-w-0 lg:ml-72 min-h-screen overflow-y-auto relative">
          {/* Gradient background */}
          <div className="fixed inset-0 lg:left-72 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
          </div>
          
          {/* Top Bar with glass effect */}
          <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl px-4 lg:px-8 h-16 flex items-center justify-between border-b border-white/40 shadow-sm">
            <div className="absolute bottom-0 left-0 w-16 h-0.5" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--gn-grey)' }}>
              <Link to="/dashboard" className="hover:opacity-80" style={{ color: 'var(--gn-grey)' }}>Dashboard</Link>
              {location.pathname !== '/dashboard' && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span className="capitalize" style={{ color: 'var(--gn-rhino)' }}>
                    {location.pathname.split('/').pop().replace('-', ' ')}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <button
                onClick={() => {
                  navigate('/dashboard/notifications');
                  // Badge will be updated after notifications page marks all as read
                }}
                className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-slate-700" />
                {/* Unread badge */}
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center px-1">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              <Link to="/dashboard" state={{ openStrategyCallModal: true }}>
                <Button 
                  size="sm" 
                  className="gap-2 text-white"
                  style={{ backgroundColor: 'var(--gn-rhino)' }}
                  data-testid="book-strategy-call-btn"
                >
                  <PhoneCall className="w-4 h-4" weight="duotone" />
                  Book Strategy Call
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-1">
                  <PhArrowOut className="w-4 h-4" weight="duotone" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>

        {/* Upgrade Modal */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: 'var(--gn-rhino)' }}>
                <Lock className="w-5 h-5" style={{ color: 'var(--gn-chrome-yellow)' }} />
                Upgrade Required
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
                  <Sparkles className="w-10 h-10" style={{ color: 'var(--gn-chrome-yellow)' }} />
                </div>
              </div>
              <p className="text-center mb-2" style={{ color: 'var(--gn-grey-dark)' }}>
                <span className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{lockedFeatureName}</span> is a premium feature.
              </p>
              <p className="text-center text-sm mb-6" style={{ color: 'var(--gn-grey)' }}>
                Upgrade your plan to unlock {lockedFeatureName.toLowerCase()} and get full access to all gradnext resources.
              </p>
              
              {/* Plan benefits */}
              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <h4 className="font-semibold mb-3" style={{ color: 'var(--gn-rhino)' }}>What you&apos;ll get:</h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-light)' }}>
                      <svg className="w-3 h-3" style={{ color: 'var(--gn-rhino)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    Full access to all video courses
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-light)' }}>
                      <svg className="w-3 h-3" style={{ color: 'var(--gn-rhino)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    Live workshops with industry experts
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-light)' }}>
                      <svg className="w-3 h-3" style={{ color: 'var(--gn-rhino)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    Peer practice matching
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-light)' }}>
                      <svg className="w-3 h-3" style={{ color: 'var(--gn-rhino)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    1:1 coaching sessions
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Maybe Later
                </Button>
                <Button 
                  className="flex-1 text-white"
                  style={{ backgroundColor: 'var(--gn-rhino)' }}
                  onClick={() => {
                    // Select the first paid plan as default
                    if (availablePlans.length > 0) {
                      handleUpgradeClick(availablePlans[0]);
                    }
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
              
              {/* Available Plans */}
              {availablePlans.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
                  <p className="text-xs mb-3" style={{ color: 'var(--gn-grey)' }}>Or choose a specific plan:</p>
                  <div className="space-y-2">
                    {availablePlans.slice(0, 3).map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => handleUpgradeClick(plan)}
                        className="w-full p-3 rounded-lg border transition-all text-left flex items-center justify-between hover:border-[#8C9DFF]"
                        style={{ borderColor: 'var(--gn-grey-light)', backgroundColor: 'var(--gn-white)' }}
                      >
                        <div>
                          <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>{plan.name}</span>
                          <span className="text-sm ml-2" style={{ color: 'var(--gn-grey)' }}>({plan.duration})</span>
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>₹{plan.price.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Payment Modal - Only render when open to avoid Razorpay SDK initialization issues */}
        {showPaymentModal && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedPlan(null);
            }}
            plan={selectedPlan}
            user={user}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* Profile Onboarding Modal */}
        <ProfileOnboarding
          isOpen={showProfileOnboarding}
          onComplete={handleProfileOnboardingComplete}
          userName={user?.name}
        />

        {/* Cohort Welcome Dialog - shown to new users who just enrolled */}
        <Dialog open={showCohortWelcome && !showSetPassword} onOpenChange={setShowCohortWelcome}>
          <DialogContent className="max-w-sm rounded-3xl border-periwinkle-lighter bg-white p-0 overflow-hidden">
            <div className="px-8 py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <span className="text-3xl">🎉</span>
              </div>
              <h3 className="font-display mt-5 text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                Welcome to gradnext!
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                Your cohort enrolment is confirmed. Check your email for your welcome pack and session schedule.
              </p>
              <Button
                onClick={() => setShowCohortWelcome(false)}
                className="mt-6 rounded-full bg-rhino px-6 text-white hover:bg-rhino-medium"
              >
                Go to Dashboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Set Password Dialog - shown to auto-created cohort users */}
        <Dialog open={showSetPassword} onOpenChange={(open) => { if (!open) { setShowSetPassword(false); setNewPassword(''); setConfirmPassword(''); setSetPasswordError(''); } }}>
          <DialogContent className="max-w-sm rounded-3xl border-periwinkle-lighter bg-white p-0 overflow-hidden">
            <div className="px-8 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-periwinkle-lighter/60">
                <Lock className="h-5 w-5" style={{ color: 'var(--gn-periwinkle)' }} />
              </div>
              <h3 className="font-display mt-4 text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                Set your password
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Your account was created automatically. Set a password to log in next time.
              </p>
              <div className="mt-5 space-y-3">
                <input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setSetPasswordError(''); }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setSetPasswordError(''); }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-periwinkle"
                />
                {setPasswordError && <p className="text-xs text-red-600">{setPasswordError}</p>}
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  onClick={async () => {
                    if (!newPassword || newPassword.length < 8) { setSetPasswordError('Password must be at least 8 characters'); return; }
                    if (newPassword !== confirmPassword) { setSetPasswordError('Passwords do not match'); return; }
                    setSettingPassword(true);
                    try {
                      const token = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
                      await axios.post(`${BACKEND_URL}/api/auth/set-password`,
                        { new_password: newPassword },
                        { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }
                      );
                      setShowSetPassword(false);
                      setNewPassword('');
                      setConfirmPassword('');
                      setShowCohortWelcome(true);
                    } catch (e) {
                      setSetPasswordError(e?.response?.data?.detail || 'Failed to set password. Try again.');
                    } finally {
                      setSettingPassword(false);
                    }
                  }}
                  disabled={settingPassword}
                  className="rounded-full bg-rhino px-6 text-white hover:bg-rhino-medium"
                >
                  {settingPassword ? 'Setting password…' : 'Set password'}
                </Button>
                <button
                  onClick={() => { setShowSetPassword(false); setShowCohortWelcome(true); }}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  I'll do this later
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Support Query Modal */}
        <Dialog open={supportModalOpen} onOpenChange={(open) => {
          setSupportModalOpen(open);
          if (!open) {
            setSupportQuery('');
            setSupportAttachment(null);
            setSupportAttachmentPreview(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                  <PhQuestion className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                </div>
                <DialogTitle style={{ color: 'var(--gn-rhino)' }}>
                  Contact Support
                </DialogTitle>
              </div>
              <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                Have a question or need help? Write your query below and we'll get back to you soon.
              </p>
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--gn-grey-dark)' }}>
                  Your Query
                </label>
                <textarea
                  value={supportQuery}
                  onChange={(e) => setSupportQuery(e.target.value)}
                  placeholder="Describe your issue or question..."
                  className="w-full min-h-[120px] p-3 rounded-lg resize-none focus:outline-none focus:ring-2"
                  style={{ border: '1px solid var(--gn-periwinkle-lighter)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                  disabled={submittingSupport}
                />
              </div>
              
              {/* Attachment Section */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--gn-grey-dark)' }}>
                  Attach Screenshot <span className="text-xs font-normal" style={{ color: 'var(--gn-grey)' }}>(optional)</span>
                </label>
                
                {supportAttachmentPreview ? (
                  <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}>
                    <img 
                      src={supportAttachmentPreview} 
                      alt="Attachment preview" 
                      className="w-full h-40 object-cover"
                    />
                    <button
                      onClick={removeAttachment}
                      className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                      disabled={submittingSupport}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {uploadingAttachment && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-sm">Uploading...</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label 
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="w-8 h-8 mb-2" style={{ color: 'var(--gn-grey)' }} />
                      <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                        <span className="font-medium" style={{ color: 'var(--gn-periwinkle)' }}>Click to upload</span> a screenshot
                      </p>
                      <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>PNG, JPG, GIF up to 5MB</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAttachmentChange}
                      disabled={submittingSupport || uploadingAttachment}
                    />
                  </label>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSupportModalOpen(false);
                    setSupportQuery('');
                    setSupportAttachment(null);
                    setSupportAttachmentPreview(null);
                  }}
                  disabled={submittingSupport}
                  className="flex-1"
                  style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!supportQuery.trim()) {
                      alert('Please write your query before submitting');
                      return;
                    }
                    setSubmittingSupport(true);
                    try {
                      await axios.post(`${BACKEND_URL}/api/support/query`, {
                        query: supportQuery,
                        user_id: user?.id,
                        user_email: user?.email,
                        user_name: user?.name,
                        attachment_url: supportAttachment
                      }, { withCredentials: true });
                      alert('Your query has been submitted! We will get back to you soon.');
                      setSupportModalOpen(false);
                      setSupportQuery('');
                      setSupportAttachment(null);
                      setSupportAttachmentPreview(null);
                    } catch (error) {
                      console.error('Failed to submit support query:', error);
                      alert('Failed to submit query. Please try again or contact support@gradnext.in');
                    } finally {
                      setSubmittingSupport(false);
                    }
                  }}
                  disabled={submittingSupport || !supportQuery.trim() || uploadingAttachment}
                  className="flex-1 text-white"
                  style={{ backgroundColor: 'var(--gn-rhino)' }}
                >
                  {submittingSupport ? 'Submitting...' : 'Submit Query'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Feedback Modal */}
        <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                  <PhFeedback className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                </div>
                <DialogTitle style={{ color: 'var(--gn-rhino)' }}>
                  Share Your Feedback
                </DialogTitle>
              </div>
              <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--gn-periwinkle)' }} />
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                We'd love to hear your thoughts! Your feedback helps us improve.
              </p>
              
              {/* Rating Section */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--gn-grey-dark)' }}>
                  How would you rate your experience?
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      disabled={submittingFeedback}
                      className="transition-all hover:scale-110 disabled:opacity-50"
                    >
                      <Star
                        className="w-8 h-8"
                        style={{
                          fill: star <= feedbackRating ? 'var(--gn-chrome-yellow)' : 'transparent',
                          color: star <= feedbackRating ? 'var(--gn-chrome-yellow)' : 'var(--gn-grey-light)'
                        }}
                      />
                    </button>
                  ))}
                  {feedbackRating > 0 && (
                    <span className="ml-2 text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>
                      {feedbackRating} {feedbackRating === 1 ? 'star' : 'stars'}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Feedback Text */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--gn-grey-dark)' }}>
                  Your Feedback (Optional)
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share your experience, suggestions, or ideas..."
                  className="w-full min-h-[100px] p-3 rounded-lg resize-none focus:outline-none focus:ring-2"
                  style={{ border: '1px solid var(--gn-periwinkle-lighter)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                  disabled={submittingFeedback}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFeedbackModalOpen(false);
                    setFeedbackText('');
                    setFeedbackRating(0);
                  }}
                  disabled={submittingFeedback}
                  className="flex-1"
                  style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (feedbackRating === 0) {
                      alert('Please select a rating before submitting');
                      return;
                    }
                    setSubmittingFeedback(true);
                    try {
                      await axios.post(`${BACKEND_URL}/api/support/feedback`, {
                        feedback: feedbackText,
                        rating: feedbackRating,
                        user_id: user?.id,
                        user_email: user?.email,
                        user_name: user?.name
                      }, { withCredentials: true });
                      alert('Thank you for your feedback! We appreciate your input.');
                      setFeedbackModalOpen(false);
                      setFeedbackText('');
                      setFeedbackRating(0);
                    } catch (error) {
                      console.error('Failed to submit feedback:', error);
                      alert('Failed to submit feedback. Please try again later.');
                    } finally {
                      setSubmittingFeedback(false);
                    }
                  }}
                  disabled={submittingFeedback || feedbackRating === 0}
                  className="flex-1 text-white"
                  style={{ backgroundColor: 'var(--gn-rhino)' }}
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardContext.Provider>
  );
};

export default DashboardLayout;