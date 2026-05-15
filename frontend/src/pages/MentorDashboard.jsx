import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
// Lucide icons for general UI
import { 
  ChevronRight, TrendingUp, Edit3,
  Send, Save, Link2, Link2Off, RefreshCw,
  Camera, Upload, History, FileText, X, Ban, ChevronLeft,
  Settings2, Eye, Globe, Menu, MapPin,
  Image as ImageIcon,
  // Icons still used in other parts of the component
  Star, Calendar, CalendarDays, MessageSquare, CheckCircle2, AlertCircle,
  Users, ExternalLink, GraduationCap, Briefcase, HelpCircle, DollarSign, Clock
} from 'lucide-react';
// Notification Bell
import { MentorNotificationBell } from '../components/MentorNotificationBell';
// Phosphor icons for premium sidebar and main UI (duotone style)
import {
  ChartBar as PhChartBar,
  CalendarBlank as PhCalendar,
  Clock as PhClock,
  CurrencyDollar as PhDollarSign,
  Star as PhStar,
  ChatTeardropDots as PhMessageSquare,
  CheckCircle as PhCheckCircle,
  Warning as PhWarning,
  User as PhUser,
  UserCircle as PhUserCircle,
  SignOut as PhSignOut,
  GraduationCap as PhGraduationCap,
  Briefcase as PhBriefcase,
  Question as PhQuestion,
  Users as PhUsers,
  CalendarCheck as PhCalendarCheck,
  Wallet as PhWallet,
  Trophy as PhTrophy,
  TrendUp as PhTrendUp,
  ArrowSquareOut as PhArrowOut
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

// Import the weekly availability selector with From/To dropdowns
import { WeeklyAvailabilitySelector } from '../components/TimeSlotPicker';
import { getTimezoneAbbr, formatTimeWithTimezone, istToViewer, format12hWithAbbr } from '../utils/timezone';
import TimezoneSelect from '../components/dashboard/TimezoneSelect';
import MandatoryFeedbackModal from '../components/MandatoryFeedbackModal';
import NotificationPopup from '../components/NotificationPopup';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Utility function to ensure meeting links have proper protocol
const formatMeetingLink = (link) => {
  if (!link) return null;
  return link.startsWith('http://') || link.startsWith('https://') 
    ? link 
    : `https://${link}`;
};

const MentorDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isMentor, setIsMentor] = useState(false);
  const [stats, setStats] = useState(null);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [pendingFeedbacks, setPendingFeedbacks] = useState([]);
  const [candidateFeedbacks, setCandidateFeedbacks] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessionsSubTab, setSessionsSubTab] = useState('upcoming'); // 'upcoming' or 'past'
  
  // Date filter state for dashboard
  const [dateFilter, setDateFilter] = useState('this_month'); // 'this_month', 'last_month', 'last_3_months', 'all_time', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  
  // View feedback modal state
  const [viewFeedbackModalOpen, setViewFeedbackModalOpen] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState(null);
  
  // Profile state
  const [mentorProfile, setMentorProfile] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [logoRepository, setLogoRepository] = useState([]);
  
  // Candidates state
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [loadingCandidateDetails, setLoadingCandidateDetails] = useState(false);
  const [candidateProfileOpen, setCandidateProfileOpen] = useState(false);
  
  // Google Calendar state
  const [calendarStatus, setCalendarStatus] = useState({
    connected: false,
    email: null,
    last_synced: null,
    sync_stale: false,
    loading: true
  });
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  
  // Feedback modal state
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [feedbackData, setFeedbackData] = useState({
    session_type: '',
    case_type: '',
    ratings: {}, // Dynamic ratings object
    rating_overall: 0,
    areas_of_strength: [],
    areas_of_improvement: [],
    qualitative_feedback: ''
  });
  
  // Session type options
  const sessionTypeOptions = [
    'Case session',
    'PEI session',
    'CV review session',
    'FIT session',
    'General discussion'
  ];
  
  // Dynamic rating configurations per session type
  const getRatingConfig = (sessionType) => {
    switch (sessionType) {
      case 'Case session':
        return [
          { key: 'rating_problem_understanding', label: 'Problem Understanding & Initial Scoping' },
          { key: 'rating_framework_structure', label: 'Framework and Structure' },
          { key: 'rating_case_math', label: 'Case Math' },
          { key: 'rating_business_judgment', label: 'Business Judgment and Insights' },
          { key: 'rating_communication_synthesis', label: 'Communication and Synthesis' },
          { key: 'rating_overall', label: 'Overall', isOverall: true }
        ];
      case 'PEI session':
        return [
          { key: 'rating_leadership_story', label: 'Leadership Story' },
          { key: 'rating_connection_growth', label: 'Connection Growth' },
          { key: 'rating_drive_story', label: 'Drive Story' },
          { key: 'rating_growth_story', label: 'Growth Story' },
          { key: 'rating_overall', label: 'Overall', isOverall: true }
        ];
      case 'CV review session':
        return [
          { key: 'rating_cv_layout', label: 'Overall CV Layout and Formatting' },
          { key: 'rating_experience_clarity', label: 'Clarity of Experience Descriptions' },
          { key: 'rating_quantification', label: 'Quantification of Achievements' },
          { key: 'rating_relevance_prioritization', label: 'Relevance and Prioritization of Content' },
          { key: 'rating_language_grammar', label: 'Language and Grammar' },
          { key: 'rating_overall', label: 'Overall', isOverall: true }
        ];
      case 'FIT session':
        return [
          { key: 'rating_self_introduction', label: 'Self-Introduction and Presence' },
          { key: 'rating_leadership_examples', label: 'Leadership Examples' },
          { key: 'rating_teamwork', label: 'Teamwork and Collaboration' },
          { key: 'rating_motivation_drive', label: 'Motivation and Drive' },
          { key: 'rating_cultural_fit', label: 'Cultural Fit Demonstration' },
          { key: 'rating_overall', label: 'Overall', isOverall: true }
        ];
      case 'General discussion':
        return [
          { key: 'rating_overall', label: 'Overall', isOverall: true }
        ];
      default:
        return [
          { key: 'rating_overall', label: 'Overall', isOverall: true }
        ];
    }
  };
  
  // Dynamic areas options per session type
  const getAreasConfig = (sessionType) => {
    switch (sessionType) {
      case 'Case session':
        return {
          hasAreas: true,
          options: [
            'Problem understanding & initial scoping',
            'Framework and structure',
            'Case math',
            'Hypothesis-driven approach',
            'Business judgment and insights',
            'Communication and synthesis'
          ]
        };
      case 'PEI session':
        return {
          hasAreas: true,
          options: [
            'Story structure (STAR format)',
            'Articulating personal impact',
            'Quantifying achievements',
            'Self-awareness and learnings',
            'Authenticity and delivery'
          ]
        };
      case 'FIT session':
        return {
          hasAreas: true,
          options: [
            'Self-introduction and presence',
            'Leadership examples',
            'Teamwork and collaboration',
            'Motivation and drive',
            'Handling weakness/failure questions',
            'Cultural fit demonstration'
          ]
        };
      case 'CV review session':
      case 'General discussion':
      default:
        return {
          hasAreas: false,
          options: []
        };
    }
  };
  
  // Session action modals state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleAvailability, setRescheduleAvailability] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Session check-in state
  const [joiningSession, setJoiningSession] = useState(null);

  // Support modal state
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportQuery, setSupportQuery] = useState('');
  const [supportAttachment, setSupportAttachment] = useState(null);
  const [supportAttachmentPreview, setSupportAttachmentPreview] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [submittingSupport, setSubmittingSupport] = useState(false);

  // Handle attachment file selection for support
  const handleSupportAttachmentChange = async (e) => {
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

  const removeSupportAttachment = () => {
    setSupportAttachment(null);
    setSupportAttachmentPreview(null);
  };

  const handleSubmitSupport = async () => {
    if (!supportQuery.trim()) {
      alert('Please write your query before submitting');
      return;
    }
    setSubmittingSupport(true);
    try {
      await axios.post(`${BACKEND_URL}/api/support/query`, {
        query: supportQuery,
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
  };

  // Platform Feedback modal state (different from session feedback)
  const [platformFeedbackModalOpen, setPlatformFeedbackModalOpen] = useState(false);
  const [platformFeedbackText, setPlatformFeedbackText] = useState('');
  const [platformFeedbackRating, setPlatformFeedbackRating] = useState(0);
  const [submittingPlatformFeedback, setSubmittingPlatformFeedback] = useState(false);

  const handleSubmitPlatformFeedback = async () => {
    if (!platformFeedbackText.trim()) {
      alert('Please write your feedback before submitting');
      return;
    }
    if (platformFeedbackRating === 0) {
      alert('Please select a rating');
      return;
    }
    setSubmittingPlatformFeedback(true);
    try {
      await axios.post(`${BACKEND_URL}/api/support/feedback`, {
        feedback: platformFeedbackText,
        rating: platformFeedbackRating
      }, { withCredentials: true });
      alert('Thank you for your feedback! We appreciate your input.');
      setPlatformFeedbackModalOpen(false);
      setPlatformFeedbackText('');
      setPlatformFeedbackRating(0);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingPlatformFeedback(false);
    }
  };

  // Availability modal state
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [newAvailability, setNewAvailability] = useState([]);
  
  // Editable availability for the calendar view
  const [editableAvailability, setEditableAvailability] = useState([]);
  
  // Blocked days and max sessions state
  const [blockedDays, setBlockedDays] = useState([]);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState(5);
  const [minimumBookingHours, setMinimumBookingHours] = useState(12);  // Default 12 hours
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(new Date());
  
  // Cancellation policy state
  const [cancellationPolicy, setCancellationPolicy] = useState({ mentor_hours: 4, candidate_hours: 4 });
  
  // Sidebar state for mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle OAuth redirect tokens from URL params (Mobile Safari)
  useEffect(() => {
    const sessionToken = searchParams.get('session_token');
    const authSuccess = searchParams.get('auth_success');
    const authError = searchParams.get('auth_error');
    
    // Handle OAuth error
    if (authError) {
      console.error('[MentorDashboard] OAuth error:', authError);
      window.history.replaceState({}, document.title, '/mentor-dashboard');
      navigate('/', { replace: true });
      return;
    }
    
    if (authSuccess === 'true' && sessionToken) {
      // Store tokens from OAuth redirect
      localStorage.setItem('session_token', sessionToken);
      // Clean up URL params
      window.history.replaceState({}, document.title, '/mentor-dashboard');
      console.log('[MentorDashboard] OAuth tokens stored from redirect');
    }
  }, [searchParams, navigate]);

  // Check URL params for calendar connection status
  useEffect(() => {
    const calendarConnected = searchParams.get('calendar_connected');
    const calendarError = searchParams.get('calendar_error');
    
    if (calendarConnected === 'true') {
      alert('Google Calendar connected successfully! Your availability will now sync with your calendar.');
      // Clear the URL params
      window.history.replaceState({}, '', '/mentor-dashboard');
    }
    
    if (calendarError) {
      alert(`Failed to connect Google Calendar: ${calendarError}`);
      window.history.replaceState({}, '', '/mentor-dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    const verifyMentor = async () => {
      try {
        // Get token from localStorage as fallback for mobile Safari
        const token = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const verifyRes = await axios.get(`${BACKEND_URL}/api/mentor-dashboard/verify`, {
          withCredentials: true,
          headers
        });
        
        if (verifyRes.data.is_mentor) {
          setIsMentor(true);
          await loadDashboardData();
          await loadCalendarStatus();
        } else {
          // Not a mentor - redirect to candidate dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Not a mentor:', error);
        // If verification fails (not logged in or other error), redirect to home
        if (error.response?.status === 401) {
          navigate('/', { replace: true });
        } else {
          // User is logged in but not a mentor - redirect to candidate dashboard
          navigate('/dashboard', { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };

    verifyMentor();
  }, [navigate]);

  const loadCalendarStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentor-calendar/status`, {
        withCredentials: true
      });
      setCalendarStatus({
        ...response.data,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load calendar status:', error);
      setCalendarStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentor-calendar/auth/start`, {
        withCredentials: true
      });
      
      if (response.data.authorization_url) {
        // Redirect to Google OAuth
        window.location.href = response.data.authorization_url;
      }
    } catch (error) {
      console.error('Failed to start calendar auth:', error);
      alert(error.response?.data?.detail || 'Failed to connect Google Calendar');
      setConnectingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Calendar? Your availability will no longer sync automatically.')) {
      return;
    }
    
    try {
      await axios.delete(`${BACKEND_URL}/api/mentor-calendar/disconnect`, {
        withCredentials: true
      });
      setCalendarStatus({
        connected: false,
        email: null,
        last_synced: null,
        sync_stale: false,
        loading: false
      });
      alert('Google Calendar disconnected successfully.');
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      alert('Failed to disconnect Google Calendar');
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/mentor-calendar/sync`, {}, {
        withCredentials: true
      });
      
      // Refresh status after sync
      await loadCalendarStatus();
      
      alert(`Calendar synced successfully! Checked ${response.data.calendars_checked} calendar(s).`);
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      if (error.response?.status === 401) {
        alert('Your calendar authorization has expired. Please reconnect your Google Calendar.');
        setCalendarStatus(prev => ({ ...prev, connected: false }));
      } else {
        alert(error.response?.data?.detail || 'Failed to sync calendar');
      }
    } finally {
      setSyncingCalendar(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [statsRes, upcomingRes, pastRes, pendingRes, feedbacksRes, availRes, paymentsRes, profileRes, candidatesRes, policyRes, logosRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/stats`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/sessions/upcoming`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/sessions/past`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/sessions/pending-feedback`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/candidate-feedbacks`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/availability`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/payments`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/profile`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentor-dashboard/candidates`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/public/cancellation-policy`, { withCredentials: true }).catch(() => ({ data: { mentor_hours: 4, candidate_hours: 4 } })),
        axios.get(`${BACKEND_URL}/api/mentors/logos`, { withCredentials: true }).catch(() => ({ data: { logos: [] } }))
      ]);

      setStats(statsRes.data);
      setUpcomingSessions(upcomingRes.data);
      setPastSessions(pastRes.data);
      setPendingFeedbacks(pendingRes.data);
      setCandidateFeedbacks(feedbacksRes.data);
      setCancellationPolicy(policyRes.data);
      setLogoRepository(logosRes.data.logos || []);
      
      // Handle new availability response format
      const availData = availRes.data;
      if (availData.availability) {
        // New format with blocked_days and max_sessions
        setAvailability(availData.availability);
        setBlockedDays(availData.blocked_days || []);
        setMaxSessionsPerDay(availData.max_sessions_per_day || 5);
        setMinimumBookingHours(availData.minimum_booking_hours || 12);
      } else {
        // Old format - just array of availability
        setAvailability(availData);
      }
      
      setPayments(paymentsRes.data);
      setMentorProfile(profileRes.data);
      setProfileForm(profileRes.data);
      setCandidates(candidatesRes.data);
      
      // Initialize minimum booking hours from mentor profile if available
      if (profileRes.data.minimum_booking_hours !== undefined) {
        setMinimumBookingHours(profileRes.data.minimum_booking_hours);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await axios.put(`${BACKEND_URL}/api/mentor-dashboard/profile`, profileForm, {
        withCredentials: true
      });
      setMentorProfile(profileForm);
      setIsEditingProfile(false);
      alert('Changes sent for approval.');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert(error.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const loadCandidateDetails = async (candidateId) => {
    setLoadingCandidateDetails(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentor-dashboard/candidates/${candidateId}`, {
        withCredentials: true
      });
      setCandidateDetails(response.data);
    } catch (error) {
      console.error('Failed to load candidate details:', error);
      alert('Failed to load candidate details');
    } finally {
      setLoadingCandidateDetails(false);
    }
  };

  const handleViewCandidateProfile = async (candidateId, candidateName) => {
    setCandidateProfileOpen(true);
    setCandidateDetails(null); // Clear previous data
    setSelectedCandidate({ id: candidateId, name: candidateName });
    await loadCandidateDetails(candidateId);
  };

  const handleCandidateSelect = (candidate) => {
    setSelectedCandidate(candidate);
    loadCandidateDetails(candidate.id);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackSession) return;
    
    const isCaseSession = feedbackData.session_type === 'Case session';
    const areasConfig = getAreasConfig(feedbackData.session_type);
    const ratingConfig = getRatingConfig(feedbackData.session_type);
    
    // Validate required fields
    if (!feedbackData.session_type) {
      alert('Please select a session type');
      return;
    }
    if (isCaseSession && !feedbackData.case_type) {
      alert('Please select a case type');
      return;
    }
    if (!feedbackData.rating_overall) {
      alert('Please provide an overall rating');
      return;
    }
    
    // Check all required ratings are filled
    const missingRatings = ratingConfig.filter(r => !r.isOverall && !feedbackData.ratings[r.key]);
    if (missingRatings.length > 0) {
      alert(`Please rate: ${missingRatings.map(r => r.label).join(', ')}`);
      return;
    }
    
    // Check areas only for session types that require them
    if (areasConfig.hasAreas) {
      if (feedbackData.areas_of_strength.length === 0) {
        alert('Please select at least one area of strength');
        return;
      }
      if (feedbackData.areas_of_improvement.length === 0) {
        alert('Please select at least one area of improvement');
        return;
      }
    }
    
    try {
      // Prepare the feedback payload with all ratings flattened
      const feedbackPayload = {
        booking_id: feedbackSession.id,
        session_type: feedbackData.session_type,
        case_type: isCaseSession ? feedbackData.case_type : null,
        rating_overall: feedbackData.rating_overall,
        areas_of_strength: areasConfig.hasAreas ? feedbackData.areas_of_strength : [],
        areas_of_improvement: areasConfig.hasAreas ? feedbackData.areas_of_improvement : [],
        qualitative_feedback: feedbackData.qualitative_feedback,
        // Include all dynamic ratings
        ...feedbackData.ratings
      };
      
      await axios.post(`${BACKEND_URL}/api/mentor-dashboard/feedback`, feedbackPayload, { withCredentials: true });

      alert('Feedback submitted successfully!');
      await loadDashboardData();
      setIsFeedbackOpen(false);
      setFeedbackSession(null);
      setFeedbackData({
        session_type: '',
        case_type: '',
        ratings: {},
        rating_overall: 0,
        areas_of_strength: [],
        areas_of_improvement: [],
        qualitative_feedback: ''
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert(error.response?.data?.detail || 'Failed to submit feedback. Please try again.');
    }
  };

  const handleUpdateAvailability = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/mentor-dashboard/availability`, {
        availability: newAvailability
      }, { withCredentials: true });

      await loadDashboardData();
      setIsAvailabilityOpen(false);
    } catch (error) {
      console.error('Failed to update availability:', error);
    }
  };

  // Session action handlers
  const handleCancelSession = async () => {
    if (!selectedSession) return;
    setActionLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/mentors/bookings/${selectedSession.id}/cancel`, {
        reason: cancelReason
      }, { withCredentials: true });
      
      await loadDashboardData();
      setCancelModalOpen(false);
      setSelectedSession(null);
      setCancelReason('');
      alert('Session cancelled successfully');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to cancel session');
    } finally {
      setActionLoading(false);
    }
  };

  const openRescheduleModal = async (session) => {
    setSelectedSession(session);
    setRescheduleDate('');
    setRescheduleSlot('');
    setRescheduleModalOpen(true);
    
    // Fetch availability for this mentor (ourselves)
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentors/${mentorProfile?.id}/availability`, {
        withCredentials: true
      });
      setRescheduleAvailability(response.data || []);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      setRescheduleAvailability([]);
    }
  };

  const handleRescheduleSession = async () => {
    if (!selectedSession || !rescheduleDate || !rescheduleSlot) return;
    setActionLoading(true);
    try {
      await axios.put(`${BACKEND_URL}/api/mentors/bookings/${selectedSession.id}/reschedule`, {
        new_date: rescheduleDate,
        new_time_slot: rescheduleSlot
      }, { withCredentials: true });
      
      await loadDashboardData();
      setRescheduleModalOpen(false);
      setSelectedSession(null);
      setRescheduleDate('');
      setRescheduleSlot('');
      alert('Session rescheduled successfully');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to reschedule session');
    } finally {
      setActionLoading(false);
    }
  };

  // Initialize weekly availability (Mon-Sun) from existing data
  useEffect(() => {
    if (!loading && isMentor) {
      // Convert availability to weekly format
      // Check if availability is already in weekly format (has 'day' property)
      if (availability && availability.length > 0 && availability[0].day) {
        setEditableAvailability(availability);
      } else {
        // Initialize empty weekly availability
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weeklyAvail = daysOfWeek.map(day => ({ day, slots: [] }));
        setEditableAvailability(weeklyAvail);
      }
    }
     
  }, [availability, loading, isMentor]);

  // Save weekly availability to backend
  const handleSaveAvailability = async () => {
    try {
      // Format: [{ day: "Monday", slots: [{from: "09:00", to: "17:00"}] }]
      const availabilityToSave = editableAvailability
        .filter(day => day.slots && day.slots.length > 0)
        .map(day => ({
          day: day.day,
          slots: day.slots
        }));
      
      await axios.put(`${BACKEND_URL}/api/mentor-dashboard/availability`, {
        availability: availabilityToSave,
        blocked_days: blockedDays,
        max_sessions_per_day: maxSessionsPerDay,
        minimum_booking_hours: minimumBookingHours
      }, { withCredentials: true });

      await loadDashboardData();
      alert('Availability saved successfully!');
    } catch (error) {
      console.error('Failed to save availability:', error);
      alert('Failed to save availability. Please try again.');
    }
  };

  // Toggle a specific day as blocked/unblocked
  const toggleBlockedDay = (dateStr) => {
    setBlockedDays(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  // Get calendar days for the current month view
  const getCalendarDays = () => {
    const year = selectedCalendarMonth.getFullYear();
    const month = selectedCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    const days = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      // Use local date formatting to avoid timezone conversion issues
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      const hasAvailability = editableAvailability.some(
        a => a.day === dayName && a.slots && a.slots.length > 0
      );
      days.push({
        date: i,
        dateStr,
        dayName,
        hasAvailability,
        isBlocked: blockedDays.includes(dateStr),
        isPast: date < new Date(new Date().setHours(0, 0, 0, 0))
      });
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    setSelectedCalendarMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  // Check if session is within the join window (10 mins before to 15 mins after)
  // Session times are stored in IST (Asia/Kolkata, UTC+5:30)
  const isSessionJoinable = (session) => {
    const timeField = session.time || session.time_slot || '00:00';
    // Parse the session time as IST (stored timezone)
    const istDateTimeStr = `${session.date}T${timeField}:00+05:30`;
    const sessionDateTime = new Date(istDateTimeStr);
    const now = new Date();
    const windowStart = new Date(sessionDateTime.getTime() - 10 * 60 * 1000); // 10 mins before
    const windowEnd = new Date(sessionDateTime.getTime() + 15 * 60 * 1000);   // 15 mins after
    return now >= windowStart && now <= windowEnd;
  };

  // Get time until session is joinable
  const getTimeUntilJoinable = (session) => {
    const timeField = session.time || session.time_slot || '00:00';
    // Parse the session time as IST (stored timezone)
    const istDateTimeStr = `${session.date}T${timeField}:00+05:30`;
    const sessionDateTime = new Date(istDateTimeStr);
    const windowStart = new Date(sessionDateTime.getTime() - 10 * 60 * 1000);
    const now = new Date();
    const diffMs = windowStart - now;
    if (diffMs <= 0) return null;
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins > 60) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
    return `${diffMins}m`;
  };

  // Check if session is past the feedback window (30 mins after session)
  const isSessionPastJoinWindow = (session) => {
    const timeField = session.time || session.time_slot || '00:00';
    // Parse the session time as IST (stored timezone)
    const istDateTimeStr = `${session.date}T${timeField}:00+05:30`;
    const sessionDateTime = new Date(istDateTimeStr);
    const feedbackWindowStart = new Date(sessionDateTime.getTime() + 30 * 60 * 1000); // 30 mins after
    const now = new Date();
    return now >= feedbackWindowStart;
  };
  
  // Check if session is within cancellation/reschedule policy window
  const canCancelOrReschedule = (session) => {
    const timeField = session.time || session.time_slot || '00:00';
    // Parse the session time as IST (stored timezone)
    const istDateTimeStr = `${session.date}T${timeField}:00+05:30`;
    const sessionDateTime = new Date(istDateTimeStr);
    const now = new Date();
    const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);
    const policyHours = cancellationPolicy.mentor_hours || 4;
    return hoursUntilSession >= policyHours;
  };

  // Check if feedback is required (session ended and no feedback submitted)
  const needsFeedback = (session) => {
    return isSessionPastJoinWindow(session) && !session.feedback_submitted;
  };

  // View candidate feedback for a session
  const handleViewCandidateFeedback = async (session) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/feedback/candidate/${session.id}`,
        { withCredentials: true }
      );
      setViewingFeedback({
        ...response.data,
        session_info: {
          candidate_name: session.candidate_name,
          date: session.date,
          time: session.time,
          session_type: session.session_type
        }
      });
      setViewFeedbackModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      alert('Could not load feedback. Please try again.');
    }
  };

  // Join session - check in and get meet link
  const handleJoinSession = async (session) => {
    setJoiningSession(session.id);
    try {
      // Strategy calls with a meet_link - open directly and then check in
      if (session.booking_type === 'strategy_call' && session.meet_link) {
        window.open(formatMeetingLink(session.meet_link), '_blank');
        // Still do check-in in background to track attendance
        try {
          await axios.post(
            `${BACKEND_URL}/api/sessions/${session.id}/check-in`,
            {},
            { withCredentials: true }
          );
          loadDashboardData();
        } catch (e) {
          // Non-critical - meeting already opened
          console.warn('Check-in tracking failed (non-critical):', e);
        }
        setJoiningSession(null);
        return;
      }
      
      const response = await axios.post(
        `${BACKEND_URL}/api/sessions/${session.id}/check-in`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success && response.data.meet_link) {
        // Open the meeting link in a new tab
        window.open(formatMeetingLink(response.data.meet_link), '_blank');
        // Refresh session data to update check-in status
        loadDashboardData();
      } else if (response.data.success) {
        // Check-in successful but no meet link
        alert('You have checked in successfully!\n\nThe meeting link will be shared shortly. Please check your email or WhatsApp.\n\nIf you don\'t receive the link, email support@gradnext.co');
        loadDashboardData();
      } else {
        alert('Could not get meeting link. Please try again.');
      }
    } catch (error) {
      console.error('Failed to join session:', error);
      alert(error.response?.data?.detail || 'Failed to join session. Please try again.');
    } finally {
      setJoiningSession(null);
    }
  };

  // Mentor feedback form state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackSessionData, setFeedbackSessionData] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [mentorFeedback, setMentorFeedback] = useState({
    case_type: '',
    rating_scoping_questions: 3,
    rating_case_structure: 3,
    rating_case_math: 3,
    case_math_tested: true,
    rating_communication: 3,
    rating_business_acumen: 3,
    rating_overall: 3,
    qualitative_feedback: ''
  });

  const openFeedbackFormModal = (session) => {
    setFeedbackSessionData(session);
    setMentorFeedback({
      case_type: '',
      rating_scoping_questions: 3,
      rating_case_structure: 3,
      rating_case_math: 3,
      case_math_tested: true,
      rating_communication: 3,
      rating_business_acumen: 3,
      rating_overall: 3,
      qualitative_feedback: ''
    });
    setFeedbackModalOpen(true);
  };

  const handleSubmitMentorFeedback = async () => {
    if (!feedbackSessionData) return;
    
    // Validate required fields
    if (!mentorFeedback.case_type) {
      alert('Please select a case type');
      return;
    }
    
    setSubmittingFeedback(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/feedback/mentor-to-candidate`,
        {
          booking_id: feedbackSessionData.id,
          ...mentorFeedback,
          rating_case_math: mentorFeedback.case_math_tested ? mentorFeedback.rating_case_math : null
        },
        { withCredentials: true }
      );
      
      setFeedbackModalOpen(false);
      loadDashboardData();
      alert('Feedback submitted successfully!');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Open completion modal
  const openFeedbackModal = (session) => {
    // Don't open feedback modal for strategy calls
    if (session.booking_type === 'strategy_call') {
      return;
    }
    
    setFeedbackSession(session);
    // Pre-fill session type from the booking
    setFeedbackData(prev => ({
      ...prev,
      session_type: session.session_type || 'General discussion',
      case_type: '' // Reset case type when opening
    }));
    setIsFeedbackOpen(true);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isMentor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Mentor Access Required</h1>
          <p className="text-slate-500 mb-6">
            This dashboard is only accessible to registered mentors.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  // Get date range based on filter selection
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    switch (dateFilter) {
      case 'this_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: endOfToday  // Include all of today
        };
      case 'last_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        };
      case 'last_3_months':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 3, 1),
          end: endOfToday
        };
      case 'custom':
        return {
          start: customDateRange.start ? new Date(customDateRange.start) : null,
          end: customDateRange.end ? new Date(customDateRange.end + 'T23:59:59') : null
        };
      case 'all_time':
      default:
        return { start: null, end: null };
    }
  };

  // Filter sessions by date range
  const filterSessionsByDate = (sessions) => {
    const { start, end } = getDateRange();
    if (!start && !end) return sessions;
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      if (start && sessionDate < start) return false;
      if (end && sessionDate > end) return false;
      return true;
    });
  };

  // Calculate earnings metrics based on filtered sessions
  const calculateEarningsMetrics = () => {
    // Use mentor's actual hourly rate from admin panel - no default fallback
    // If hourly_rate is not set, show 0 to indicate admin needs to set it
    const hourlyRate = mentorProfile?.hourly_rate || 0;
    const strategyCallRate = mentorProfile?.strategy_call_rate || 0;
    
    // Filter past sessions (completed ones) by date
    const filteredCompletedSessions = filterSessionsByDate(
      pastSessions.filter(s => s.status === 'completed')
    );
    
    // Total sessions done in the date range
    const totalSessionsDone = filteredCompletedSessions.length;
    
    // Total earnings = sessions done × hourly rate
    const totalEarnings = totalSessionsDone * hourlyRate;
    
    // Sessions without mentor feedback (payment on hold)
    const sessionsWithoutFeedback = filteredCompletedSessions.filter(
      s => !s.mentor_feedback_submitted && !s.feedback_submitted
    );
    const paymentOnHold = sessionsWithoutFeedback.length * hourlyRate;
    
    // Payment due = total earnings - payment on hold
    const paymentDue = totalEarnings - paymentOnHold;
    
    // Calculate average rating for filtered sessions
    const sessionsWithRating = filteredCompletedSessions.filter(s => s.candidate_rating || s.rating);
    const totalRating = sessionsWithRating.reduce((sum, s) => sum + (s.candidate_rating || s.rating || 0), 0);
    const filteredAverageRating = sessionsWithRating.length > 0 
      ? (totalRating / sessionsWithRating.length).toFixed(1) 
      : null;
    
    // Use overall rating from stats API (includes historical data) when no filter is applied
    const { start, end } = getDateRange();
    const isNoFilter = !start && !end;
    
    // Format rating to always show 1 decimal place
    const formatRating = (rating) => {
      if (rating === null || rating === undefined) return null;
      return Number(rating).toFixed(1);
    };
    
    // Always show the overall rating from stats (which includes historical data)
    // This is the mentor's actual rating - it shouldn't change based on date filter
    let displayRating = null;
    if (stats?.average_rating != null) {
      displayRating = formatRating(stats.average_rating);
    } else if (filteredAverageRating !== null) {
      displayRating = filteredAverageRating;
    }
    
    // Total reviews is always from stats (overall)
    const displayReviewCount = stats?.total_reviews || sessionsWithRating.length;
    
    // Use overall sessions from stats API (includes historical data) when no filter is applied
    const displaySessionsDone = isNoFilter && stats?.completed_sessions 
      ? stats.completed_sessions 
      : totalSessionsDone;
    
    return {
      totalSessionsDone: displaySessionsDone,
      totalEarnings,
      paymentOnHold,
      paymentDue,
      sessionsWithoutFeedback: sessionsWithoutFeedback.length,
      sessionsWithFeedback: totalSessionsDone - sessionsWithoutFeedback.length,
      filteredAverageRating: displayRating,
      filteredReviewCount: displayReviewCount
    };
  };

  const earningsMetrics = calculateEarningsMetrics();

  // Get filter label for display
  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'this_month':
        return 'This Month';
      case 'last_month':
        return 'Last Month';
      case 'last_3_months':
        return 'Last 3 Months';
      case 'all_time':
        return 'All Time';
      case 'custom':
        return 'Custom Range';
      default:
        return 'This Month';
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: PhChartBar },
    { id: 'sessions', label: 'Sessions', icon: PhCalendar },
    { id: 'feedbacks', label: 'Feedbacks', icon: PhMessageSquare },
    { id: 'availability', label: 'Availability', icon: PhClock },
    { id: 'payments', label: 'Payments', icon: PhWallet },
    { id: 'profile', label: 'My Profile', icon: PhUserCircle },
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAFBFF' }}>
      {/* Mandatory Feedback Modal - shows on login if feedback is pending */}
      <MandatoryFeedbackModal userType="mentor" />
      {/* Admin-driven notification popup (close-only, max once/day) */}
      <NotificationPopup audience="mentor" />
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Left Panel - Premium Design */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ borderRight: '1px solid var(--gn-grey-light)' }}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo */}
          <div className="p-6" style={{ borderBottom: '1px solid var(--gn-grey-light)' }}>
            <img 
              src="/gradnext-logo.png" 
              alt="gradnext" 
              className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/')}
            />
          </div>

          {/* Mentor Info - Premium Card */}
          <div className="p-4" style={{ borderBottom: '1px solid var(--gn-grey-light)' }}>
            <div className="flex items-center gap-3">
              {mentorProfile?.picture ? (
                <img
                  src={mentorProfile.picture.startsWith('data:') || mentorProfile.picture.startsWith('http') ? mentorProfile.picture : `${BACKEND_URL}/api${mentorProfile.picture}`}
                  alt={mentorProfile.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-offset-2"
                  style={{ '--tw-ring-color': 'var(--gn-periwinkle-light)' }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center ring-2 ring-offset-2" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', '--tw-ring-color': 'var(--gn-periwinkle-light)' }}>
                  <span className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.name?.[0] || 'M'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate text-base" style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.name || 'Mentor'}</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1" style={{ backgroundColor: 'var(--gn-chrome-lightest)', color: 'var(--gn-rhino)' }}>
                  <PhTrophy className="w-3.5 h-3.5" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                  Mentor
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items - Premium Style */}
          <nav className="flex-1 p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'hover:bg-slate-50'
                  }`}
                  style={isActive 
                    ? { backgroundColor: 'var(--gn-rhino)' } 
                    : { color: 'var(--gn-grey-dark)' }
                  }
                >
                  <Icon 
                    className="w-5 h-5" 
                    weight={isActive ? "fill" : "duotone"}
                    style={!isActive ? { color: 'var(--gn-periwinkle)' } : {}}
                  />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout Button - Premium */}
          <div className="p-4" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
            <button
              onClick={async () => {
                try {
                  await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
                  navigate('/');
                } catch (error) {
                  console.error('Logout failed:', error);
                  navigate('/');
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-red-50 transition-all duration-200 group"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              <PhSignOut className="w-5 h-5 group-hover:text-red-500 transition-colors" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
              <span className="group-hover:text-red-500 transition-colors">Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2.5 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow"
        style={{ border: '1px solid var(--gn-grey-light)' }}
      >
        <Menu className="w-6 h-6" style={{ color: 'var(--gn-rhino)' }} />
      </button>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-72">
        {/* Top Bar - Premium Design */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm px-6 py-5" style={{ borderBottom: '1px solid var(--gn-grey-light)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                  {(() => {
                    const ActiveIcon = tabs.find(t => t.id === activeTab)?.icon || PhChartBar;
                    return <ActiveIcon className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />;
                  })()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                    {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
                  </h1>
                  <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>
                    Manage your mentoring sessions and availability
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <MentorNotificationBell />
              
              <Button 
                onClick={() => setSupportModalOpen(true)}
                variant="outline"
                className="hidden sm:flex items-center gap-2 rounded-xl hover:shadow-md transition-all"
                style={{ borderColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
              >
                <PhQuestion className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                Support
              </Button>
              <Button 
                onClick={() => setPlatformFeedbackModalOpen(true)}
                variant="outline"
                className="hidden sm:flex items-center gap-2 rounded-xl hover:shadow-md transition-all"
                style={{ borderColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
              >
                <PhStar className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                Feedback
              </Button>
              <Button 
                onClick={() => navigate('/')}
                className="hidden sm:flex items-center gap-2 rounded-xl text-white hover:shadow-md transition-all"
                style={{ backgroundColor: 'var(--gn-rhino)' }}
              >
                <PhArrowOut className="w-4 h-4" weight="duotone" />
                Back to Site
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
        {/* Dashboard Tab (formerly Overview) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Date Filter */}
            <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl p-4" style={{ border: '1px solid var(--gn-grey-light)' }}>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>Filter by:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'last_3_months', label: 'Last 3 Months' },
                  { id: 'all_time', label: 'All Time' },
                  { id: 'custom', label: 'Custom' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setDateFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      dateFilter === filter.id 
                        ? 'text-white' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    style={dateFilter === filter.id ? { backgroundColor: 'var(--gn-periwinkle)' } : {}}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>

            {/* Earnings Stats Grid - Premium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Earnings */}
              <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                    <PhDollarSign className="w-6 h-6" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Total Earnings</span>
                    <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>{getFilterLabel()}</p>
                  </div>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                  ₹{earningsMetrics.totalEarnings.toLocaleString()}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <PhTrendUp className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-success)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--gn-success)' }}>Your earnings</span>
                </div>
              </div>

              {/* Payment on Hold */}
              <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-chrome-lighter)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
                    <PhWarning className="w-6 h-6" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Payment on Hold</span>
                    <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>Feedback pending</p>
                  </div>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--gn-chrome-yellow)' }}>
                  ₹{earningsMetrics.paymentOnHold.toLocaleString()}
                </p>
                {earningsMetrics.sessionsWithoutFeedback > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="mt-3 w-full rounded-xl text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => { setActiveTab('sessions'); setSessionsSubTab('past'); }}
                  >
                    Complete Feedback
                  </Button>
                )}
              </div>

              {/* Payment Due */}
              <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid #D1FAE5' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                    <PhCheckCircle className="w-6 h-6" weight="duotone" style={{ color: '#059669' }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Payment Due</span>
                    <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>Ready for payout</p>
                  </div>
                </div>
                <p className="text-3xl font-bold" style={{ color: '#059669' }}>
                  ₹{earningsMetrics.paymentDue.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Additional Stats Row - Premium Style */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                    <PhCalendar className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Sessions</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{earningsMetrics.totalSessionsDone}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>{getFilterLabel()}</p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
                    <PhStar className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Rating</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                    {earningsMetrics.filteredAverageRating !== null 
                      ? earningsMetrics.filteredAverageRating 
                      : '-'}
                  </p>
                  <span className="text-xs" style={{ color: 'var(--gn-grey)' }}>({earningsMetrics.filteredReviewCount || 0} reviews)</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                    <PhUsers className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Upcoming</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{upcomingSessions.length}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>Sessions scheduled</p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
                    <MessageSquare className="w-5 h-5" style={{ color: 'var(--gn-chrome)' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>Pending Feedbacks</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{pendingFeedbacks.length}</p>
              </div>
            </div>

            {/* Pending Feedbacks Alert */}
            {pendingFeedbacks.length > 0 && (
              <div className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--gn-chrome-lightest)', border: '1px solid var(--gn-chrome-lighter)' }}>
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" style={{ color: 'var(--gn-chrome)' }} />
                  <span style={{ color: 'var(--gn-rhino)' }}>
                    You have {pendingFeedbacks.length} session{pendingFeedbacks.length > 1 ? 's' : ''} waiting for feedback - payments are on hold until feedback is submitted
                  </span>
                </div>
                <Button size="sm" onClick={() => { setActiveTab('sessions'); setSessionsSubTab('past'); }} style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}>
                  Give Feedback
                </Button>
              </div>
            )}

            {/* Quick Summary Cards - Premium Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upcoming Sessions Summary */}
              <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                      <PhCalendar className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                    </div>
                    <h3 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Upcoming Sessions</h3>
                  </div>
                  <span className="text-2xl font-bold px-3 py-1 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-periwinkle)' }}>{upcomingSessions.length}</span>
                </div>
                {upcomingSessions.length > 0 ? (
                  <div className="space-y-2 p-3 rounded-xl" style={{ backgroundColor: '#FAFBFF' }}>
                    <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                      Next: <span className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{upcomingSessions[0]?.candidate_name}</span>
                    </p>
                    <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>
                      {upcomingSessions[0]?.date} at {upcomingSessions[0]?.time}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>No upcoming sessions</p>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-4 w-full rounded-xl hover:shadow-md transition-all"
                  onClick={() => { setActiveTab('sessions'); setSessionsSubTab('upcoming'); }}
                  style={{ borderColor: 'var(--gn-periwinkle)', color: 'var(--gn-rhino)' }}
                >
                  View All Sessions
                </Button>
              </div>

              {/* Past Sessions Summary */}
              <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow" style={{ border: '1px solid var(--gn-grey-light)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
                      <PhCheckCircle className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                    </div>
                    <h3 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Completed Sessions</h3>
                  </div>
                  <span className="text-2xl font-bold px-3 py-1 rounded-xl" style={{ backgroundColor: 'var(--gn-chrome-lightest)', color: 'var(--gn-chrome-yellow)' }}>{pastSessions.length}</span>
                </div>
                <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: '#FAFBFF', color: pendingFeedbacks.length > 0 ? 'var(--gn-chrome-yellow)' : 'var(--gn-grey-dark)' }}>
                  {pendingFeedbacks.length > 0 
                    ? `⚠️ ${pendingFeedbacks.length} pending feedback`
                    : '✅ All feedback submitted'
                  }
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-4 w-full"
                  onClick={() => { setActiveTab('sessions'); setSessionsSubTab('past'); }}
                  style={{ borderColor: 'var(--gn-periwinkle)', color: 'var(--gn-rhino)' }}
                >
                  View Past Sessions
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Subtabs */}
            <div className="tab-container-3d rounded-xl p-1 inline-flex">
              <button
                onClick={() => setSessionsSubTab('upcoming')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sessionsSubTab === 'upcoming'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Upcoming Sessions ({upcomingSessions.length})
              </button>
              <button
                onClick={() => setSessionsSubTab('past')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sessionsSubTab === 'past'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Past Sessions ({pastSessions.length})
              </button>
            </div>

            {/* Upcoming Sessions Content */}
            {sessionsSubTab === 'upcoming' && (
              <div className="bg-white rounded-xl border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Upcoming Sessions</h2>
              </div>
              {upcomingSessions.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No upcoming sessions</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <img
                            src={session.candidate_picture || `https://ui-avatars.com/api/?name=${session.candidate_name}&background=0D8ABC&color=fff`}
                            alt={session.candidate_name}
                            className="w-12 h-12 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                            onClick={() => handleViewCandidateProfile(session.candidate_id, session.candidate_name)}
                          />
                          <div>
                            <div 
                              className="flex items-center gap-2 cursor-pointer group"
                              onClick={() => handleViewCandidateProfile(session.candidate_id, session.candidate_name)}
                            >
                              <h3 className="font-semibold text-blue-600 group-hover:text-blue-800 group-hover:underline transition-colors">
                                {session.candidate_name}
                              </h3>
                              <ExternalLink className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                session.booking_type === 'strategy_call' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {session.session_type || 'General discussion'}
                              </span>
                              {session.case_type && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                  {session.case_type}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">• {session.duration}</span>
                            </div>
                            {/* Candidate Notes */}
                            {session.candidate_notes && (
                              <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs text-slate-600 max-w-md">
                                <span className="font-medium text-slate-700">Notes: </span>
                                {session.candidate_notes}
                              </div>
                            )}
                            {/* Check-in status indicators */}
                            {(session.mentor_checked_in || session.candidate_checked_in) && (
                              <div className="flex items-center gap-2 mt-1">
                                {session.mentor_checked_in && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> You joined
                                  </span>
                                )}
                                {session.candidate_checked_in && (
                                  <span className="text-xs text-blue-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Candidate joined
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Feedback status indicators */}
                            {session.candidate_feedback_submitted && (
                              <div className="mt-1">
                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                  <Star className="w-3 h-3" /> Candidate rated you
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {session.was_rescheduled && (
                            <div className="mb-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                <RefreshCw className="w-3 h-3" /> Rescheduled
                              </span>
                            </div>
                          )}
                          {session.was_rescheduled && session.previous_date && (
                            <p className="text-sm text-slate-400 line-through">
                              {session.previous_date} at {session.previous_time_slot}
                            </p>
                          )}
                          <p className={`font-medium ${session.was_rescheduled ? 'text-green-600' : 'text-slate-900'}`}>
                            {session.date}
                          </p>
                          <p
                            className={`text-sm ${session.was_rescheduled ? 'text-green-600' : 'text-slate-500'}`}
                            title={`Stored as ${session.time} IST`}
                          >
                            {(() => {
                              const tz = mentorProfile?.timezone || 'Asia/Kolkata';
                              if (!session.time) return '';
                              const conv = istToViewer(session.date, session.time, tz);
                              return format12hWithAbbr(conv.time, tz);
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Session Action Buttons */}
                      <div className="flex items-center gap-2 ml-16">
                        {/* Show Fill Feedback button if 30+ mins past session, otherwise show Join buttons */}
                        {isSessionPastJoinWindow(session) ? (
                          // Session is past - show feedback button
                          session.feedback_submitted ? (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Feedback Submitted
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => openFeedbackFormModal(session)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              data-testid={`fill-feedback-${session.id}`}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              Fill Feedback
                            </Button>
                          )
                        ) : isSessionJoinable(session) ? (
                          <Button
                            size="sm"
                            onClick={() => handleJoinSession(session)}
                            disabled={joiningSession === session.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`join-session-${session.id}`}
                          >
                            {joiningSession === session.id ? (
                              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <ExternalLink className="w-4 h-4 mr-1" />
                            )}
                            {session.mentor_checked_in ? 'Rejoin' : 'Join Now'}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {getTimeUntilJoinable(session) ? (
                              <>Join opens in {getTimeUntilJoinable(session)}</>
                            ) : (
                              <>Join window closed</>
                            )}
                          </span>
                        )}
                        
                        {!isSessionPastJoinWindow(session) && canCancelOrReschedule(session) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRescheduleModal(session)}
                              className="text-amber-600 border-amber-200 hover:bg-amber-50"
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Reschedule
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSession(session);
                                setCancelModalOpen(true);
                              }}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                        
                        {!isSessionPastJoinWindow(session) && !canCancelOrReschedule(session) && (
                          <span className="text-xs text-slate-500">
                            Cannot cancel/reschedule (less than {cancellationPolicy.mentor_hours || 4}h notice)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Past Sessions Content */}
            {sessionsSubTab === 'past' && (
              <div className="bg-white rounded-xl border border-slate-100">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-900">Past Sessions</h2>
                </div>
                {pastSessions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No past sessions yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pastSessions.map((session) => (
                      <div key={session.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <img
                              src={session.candidate_picture || `https://ui-avatars.com/api/?name=${session.candidate_name}&background=0D8ABC&color=fff`}
                              alt={session.candidate_name}
                              className="w-12 h-12 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                              onClick={() => handleViewCandidateProfile(session.candidate_id, session.candidate_name)}
                            />
                            <div>
                              <div 
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => handleViewCandidateProfile(session.candidate_id, session.candidate_name)}
                              >
                                <h3 className="font-semibold text-blue-600 group-hover:text-blue-800 group-hover:underline transition-colors">
                                  {session.candidate_name}
                                </h3>
                                <ExternalLink className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  session.booking_type === 'strategy_call' 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {session.session_type || 'General discussion'}
                                </span>
                                {session.case_type && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                    {session.case_type}
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">{session.date} at {session.time}</span>
                              </div>
                              {/* Candidate feedback indicator */}
                              {session.candidate_feedback_submitted && (
                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit mt-1">
                                  <Star className="w-3 h-3" /> Candidate rated you
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Completion status badge */}
                            {(session.status === 'cancelled' || session.completion_status) && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                session.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : session.completion_status === 'completed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : session.completion_status === 'no_show_candidate'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {session.status === 'cancelled' ? 'Cancelled' :
                                 session.completion_status === 'completed' ? 'Completed' :
                                 session.completion_status === 'no_show_candidate' ? 'No-show' :
                                 session.completion_status === 'no_show_mentor' ? 'Missed' : 'Cancelled'}
                              </span>
                            )}
                            
                            {/* Action buttons - hide for cancelled sessions */}
                            {session.status !== 'cancelled' && (
                            <div className="flex items-center gap-2">
                              {/* View candidate feedback button */}
                              {session.candidate_feedback_submitted && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleViewCandidateFeedback(session)}
                                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View Feedback
                                </Button>
                              )}
                              
                              {/* Give/Sent feedback status - Hidden for strategy calls */}
                              {session.booking_type !== 'strategy_call' && (
                                session.feedback_submitted ? (
                                  <span className="flex items-center gap-1 text-emerald-600 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Feedback sent
                                  </span>
                                ) : (
                                  <Button size="sm" onClick={() => openFeedbackModal(session)}>
                                    Give Feedback
                                  </Button>
                                )
                              )}
                            </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Feedbacks Tab */}
        {activeTab === 'feedbacks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Candidate Feedbacks</h2>
                <p className="text-sm text-slate-500">What candidates say about you</p>
              </div>
              <div className="divide-y divide-slate-100">
                {candidateFeedbacks.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No feedbacks received yet</p>
                  </div>
                ) : (
                  candidateFeedbacks.map((feedback) => (
                    <div key={feedback.id} className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{feedback.candidate_name}</h3>
                          <p className="text-sm text-slate-500">{feedback.date}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {renderStars(feedback.rating_overall)}
                        </div>
                      </div>
                      {feedback.other_feedback && (
                        <p className="text-slate-600 italic">&ldquo;{feedback.other_feedback}&rdquo;</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <div className="space-y-6">
            {/* Google Calendar Integration - Compact Header */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    calendarStatus.connected ? 'bg-emerald-100' : 'bg-slate-100'
                  }`}>
                    {calendarStatus.connected ? (
                      <Link2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Link2Off className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Google Calendar</h3>
                    {calendarStatus.connected ? (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Synced with {calendarStatus.email}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Connect to auto-block busy times</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {calendarStatus.loading ? (
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : calendarStatus.connected ? (
                    <>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={handleSyncCalendar}
                        disabled={syncingCalendar}
                        data-testid="sync-calendar-btn"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingCalendar ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDisconnectCalendar}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        data-testid="disconnect-calendar-btn"
                      >
                        <Link2Off className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={handleConnectCalendar}
                      disabled={connectingCalendar}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90"
                      data-testid="connect-calendar-btn"
                    >
                      {connectingCalendar ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'Connect'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Weekly Availability & Settings */}
              <div className="space-y-6">
                {/* Weekly Availability */}
                <div className="bg-white rounded-xl border border-slate-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Weekly Schedule</h2>
                      <p className="text-xs text-slate-500">Set your recurring availability</p>
                    </div>
                  </div>
                  <WeeklyAvailabilitySelector
                    availability={editableAvailability}
                    onChange={setEditableAvailability}
                    showWeeklyTemplate={true}
                  />
                </div>
                  
                {/* Timezone Indicator */}
                <div className="p-3 bg-blue-50 rounded-lg mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      Your timezone: <strong>{getTimezoneAbbr(mentorProfile?.timezone || 'Asia/Kolkata')}</strong>
                    </span>
                  </div>
                  <span className="text-xs text-blue-500">
                    All times shown in your local timezone
                  </span>
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleSaveAvailability} 
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90" 
                  data-testid="save-availability-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save All Changes
                </Button>
              </div>

              {/* Right Column - Calendar View */}
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Calendar View</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth(-1)}
                      data-testid="prev-month-btn"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
                      {selectedCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth(1)}
                      data-testid="next-month-btn"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500"></div>
                    <span className="text-slate-600">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-slate-600">Blocked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-slate-200"></div>
                    <span className="text-slate-600">No Availability</span>
                  </div>
                  {calendarStatus.connected && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-blue-500"></div>
                      <span className="text-slate-600">Calendar Synced</span>
                    </div>
                  )}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day Headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar Days */}
                  {getCalendarDays().map((day, idx) => (
                    <div key={idx} className="aspect-square">
                      {day ? (
                        <button
                          onClick={() => !day.isPast && toggleBlockedDay(day.dateStr)}
                          disabled={day.isPast}
                          className={`w-full h-full rounded-lg text-sm font-medium transition-all relative flex flex-col items-center justify-center ${
                            day.isPast
                              ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                              : day.isBlocked
                              ? 'bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-300'
                              : day.hasAvailability
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-2 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                          data-testid={`calendar-day-${day.dateStr}`}
                        >
                          <span>{day.date}</span>
                          {day.isBlocked && (
                            <Ban className="w-3 h-3 absolute bottom-1 right-1 text-red-500" />
                          )}
                          {calendarStatus.connected && !day.isBlocked && day.hasAvailability && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute bottom-1 right-1" />
                          )}
                        </button>
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Block Days Instructions */}
                <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-700">
                    <strong>Tip:</strong> Click any date to block/unblock it. Blocked days won&apos;t show any availability to candidates, even if you have weekly slots set.
                  </p>
                </div>

                {/* Blocked Days Summary */}
                {blockedDays.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Blocked Days ({blockedDays.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {blockedDays.sort().slice(0, 10).map(dateStr => (
                        <span
                          key={dateStr}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full"
                        >
                          {new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          <button
                            onClick={() => toggleBlockedDay(dateStr)}
                            className="hover:text-red-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {blockedDays.length > 10 && (
                        <span className="text-xs text-slate-500">+{blockedDays.length - 10} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Session Settings */}
                <div className="mt-6 p-4 rounded-lg" style={{ border: '1px solid var(--gn-grey-light)', backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Settings2 className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Session Settings</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Maximum Sessions Per Day */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                        Maximum Sessions Per Day
                      </label>
                      <p className="text-xs mb-2" style={{ color: 'var(--gn-grey-dark)' }}>
                        Limit the number of sessions you can have in a single day
                      </p>
                      <Select 
                        value={maxSessionsPerDay.toString()} 
                        onValueChange={(v) => setMaxSessionsPerDay(parseInt(v))}
                      >
                        <SelectTrigger className="w-full bg-white" data-testid="max-sessions-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20].map(n => (
                            <SelectItem key={n} value={n.toString()}>
                              {n} session{n > 1 ? 's' : ''} per day
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Minimum Booking Hours */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                        Minimum Advance Notice (Hours)
                      </label>
                      <p className="text-xs mb-2" style={{ color: 'var(--gn-grey-dark)' }}>
                        Require candidates to book at least this many hours in advance
                      </p>
                      <Select 
                        value={minimumBookingHours.toString()} 
                        onValueChange={(v) => setMinimumBookingHours(parseInt(v))}
                      >
                        <SelectTrigger className="w-full bg-white" data-testid="min-booking-hours-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 6, 12, 24, 48, 72].map(n => (
                            <SelectItem key={n} value={n.toString()}>
                              {n} hour{n > 1 ? 's' : ''} notice
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: '1px solid var(--gn-grey-light)' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                    <PhUserCircle className="w-5 h-5" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>My Profile</h2>
                    <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>Manage your profile information</p>
                  </div>
                </div>
                {!isEditingProfile ? (
                  <Button 
                    onClick={() => setIsEditingProfile(true)} 
                    variant="outline"
                    className="rounded-xl"
                    style={{ borderColor: 'var(--gn-periwinkle)', color: 'var(--gn-rhino)' }}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => { setIsEditingProfile(false); setProfileForm(mentorProfile); }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={savingProfile} 
                      className="rounded-xl text-white"
                      style={{ backgroundColor: 'var(--gn-rhino)' }}
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                {/* Profile Picture */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <img
                      src={profileForm.picture || profileForm.profile_picture || '/default-avatar.png'}
                      alt="Profile"
                      className="w-32 h-32 rounded-2xl object-cover"
                      style={{ border: '3px solid var(--gn-periwinkle-lighter)' }}
                    />
                    {isEditingProfile && (
                      <label 
                        className="absolute bottom-2 right-2 p-2 rounded-xl text-white cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--gn-rhino)' }}
                      >
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setProfileForm({ ...profileForm, picture: reader.result, profile_picture: reader.result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {isEditingProfile && (
                    <p className="text-xs mt-2" style={{ color: 'var(--gn-grey)' }}>Click camera to upload</p>
                  )}
                  
                  {/* Top Coach Badge */}
                  {mentorProfile?.is_top_coach && (
                    <div className="mt-3 px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
                      <PhTrophy className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--gn-rhino)' }}>Top Coach</span>
                    </div>
                  )}
                  
                  {/* Strategy Calls Badge/Status */}
                  <div className="mt-3">
                    {mentorProfile?.can_take_strategy_calls ? (
                      <div className="px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                        <Calendar className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--gn-rhino)' }}>Strategy Calls Enabled</span>
                      </div>
                    ) : mentorProfile?.strategy_call_approval_pending ? (
                      <div className="px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-amber-50">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">Approval Pending</span>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const response = await axios.post(`${BACKEND_URL}/api/strategy-calls/mentor/toggle-strategy-calls`, 
                              { enable: true }, 
                              { withCredentials: true }
                            );
                            if (response.data.approval_pending) {
                              setMentorProfile(prev => ({ ...prev, strategy_call_approval_pending: true }));
                              alert('Request submitted! Admin will review your request.');
                            } else if (response.data.can_take_strategy_calls) {
                              setMentorProfile(prev => ({ ...prev, can_take_strategy_calls: true }));
                            }
                          } catch (error) {
                            alert(error.response?.data?.detail || 'Failed to request strategy calls');
                          }
                        }}
                        className="px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-dashed transition-all hover:bg-slate-50"
                        style={{ borderColor: 'var(--gn-grey-light)' }}
                      >
                        <Calendar className="w-4 h-4" style={{ color: 'var(--gn-grey)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Enable Strategy Calls</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Details - 3 columns */}
                <div className="md:col-span-3 space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
                      <PhUser className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                      Basic Information
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Full Name *</label>
                        {isEditingProfile ? (
                          <Input
                            value={profileForm.name || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            className="rounded-xl"
                          />
                        ) : (
                          <p className="font-medium" style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.name || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Email *</label>
                        <p className="font-medium" style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.email || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Phone</label>
                        {isEditingProfile ? (
                          <Input
                            value={profileForm.phone || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            placeholder="+91 9876543210"
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.phone || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Location</label>
                        {isEditingProfile ? (
                          <Input
                            value={profileForm.location || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                            placeholder="Mumbai, India"
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.location || '-'}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>LinkedIn Profile</label>
                        {isEditingProfile ? (
                          <Input
                            value={profileForm.linkedin || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                            placeholder="https://linkedin.com/in/yourprofile"
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>
                            {mentorProfile?.linkedin ? (
                              <a href={mentorProfile.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--gn-periwinkle)' }}>
                                {mentorProfile.linkedin}
                              </a>
                            ) : '-'}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <TimezoneSelect
                          value={mentorProfile?.timezone}
                          onChange={(tz) => setMentorProfile((p) => ({ ...(p || {}), timezone: tz }))}
                          endpoint="/api/mentor-dashboard/profile/timezone"
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>
                          Sessions and your availability are shown in this timezone. Storage stays canonical (IST) so candidates see their own local time too.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Professional Experience */}
                  <div className="pt-4" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
                      <PhBriefcase className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                      Professional Experience
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Consulting Position</label>
                        {isEditingProfile ? (
                          <Input
                            value={profileForm.consulting_position || profileForm.title || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, consulting_position: e.target.value, title: e.target.value })}
                            placeholder="e.g., Senior Consultant"
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.consulting_position || mentorProfile?.title || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Consulting Firm</label>
                        {isEditingProfile ? (
                          <select
                            value={profileForm.consulting_firm || profileForm.company || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, consulting_firm: e.target.value, company: e.target.value })}
                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                          >
                            <option value="">Select consulting firm...</option>
                            {logoRepository.filter(l => l.category === 'consulting' || l.category === 'consulting_firm' || l.category === 'company').map((logo) => (
                              <option key={logo.id} value={logo.name}>{logo.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.consulting_firm || mentorProfile?.company || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Current Company</label>
                        {isEditingProfile ? (
                          <select
                            value={profileForm.current_company || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, current_company: e.target.value })}
                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                          >
                            <option value="">Select current company...</option>
                            {logoRepository.map((logo) => (
                              <option key={logo.id} value={logo.name}>{logo.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.current_company || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Years of Experience</label>
                        {isEditingProfile ? (
                          <Input
                            type="number"
                            value={profileForm.years_experience || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, years_experience: e.target.value })}
                            placeholder="e.g., 5"
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.years_experience ? `${mentorProfile.years_experience} years` : '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Previous Company 1 <span className="text-xs font-normal" style={{ color: 'var(--gn-grey)' }}>(optional)</span></label>
                        {isEditingProfile ? (
                          <select
                            value={profileForm.previous_company_1 || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, previous_company_1: e.target.value })}
                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                          >
                            <option value="">Select previous company...</option>
                            {logoRepository.map((logo) => (
                              <option key={logo.id} value={logo.name}>{logo.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.previous_company_1 || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Previous Company 2 <span className="text-xs font-normal" style={{ color: 'var(--gn-grey)' }}>(optional)</span></label>
                        {isEditingProfile ? (
                          <select
                            value={profileForm.previous_company_2 || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, previous_company_2: e.target.value })}
                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                          >
                            <option value="">Select previous company...</option>
                            {logoRepository.map((logo) => (
                              <option key={logo.id} value={logo.name}>{logo.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.previous_company_2 || '-'}</p>
                        )}
                      </div>
                      {isEditingProfile && (
                        <div className="md:col-span-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="consulting_is_current"
                            checked={profileForm.consulting_is_current || false}
                            onChange={(e) => setProfileForm({ ...profileForm, consulting_is_current: e.target.checked })}
                            className="rounded"
                            style={{ accentColor: 'var(--gn-periwinkle)' }}
                          />
                          <label htmlFor="consulting_is_current" className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                            Currently working at consulting firm
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="pt-4" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
                      <PhGraduationCap className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-periwinkle)' }} />
                      Profile Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Headline</label>
                        {isEditingProfile ? (
                          <Input
                            value={profileForm.headline || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
                            placeholder="A short tagline about you"
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-rhino)' }}>{mentorProfile?.headline || '-'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Bio / About</label>
                        {isEditingProfile ? (
                          <Textarea
                            value={profileForm.bio || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                            rows={4}
                            placeholder="Tell candidates about your experience and what you can help with..."
                            className="rounded-xl"
                          />
                        ) : (
                          <p style={{ color: 'var(--gn-grey-dark)' }}>{mentorProfile?.bio || 'No bio added yet'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Expertise / Specializations</label>
                        {isEditingProfile ? (
                          <Input
                            value={(profileForm.expertise || []).join(', ')}
                            onChange={(e) => setProfileForm({ ...profileForm, expertise: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            placeholder="Case Interviews, Market Sizing, Profitability (comma-separated)"
                            className="rounded-xl"
                          />
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {(mentorProfile?.expertise || []).length > 0 ? (
                              mentorProfile.expertise.map((exp, i) => (
                                <span 
                                  key={i} 
                                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                                  style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
                                >
                                  {exp}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--gn-grey)' }}>No expertise added</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 border border-slate-100">
                <h3 className="text-sm text-slate-500 mb-1">Total Earnings</h3>
                <p className="text-3xl font-bold text-slate-900">₹{(stats?.total_earnings || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-100">
                <h3 className="text-sm text-slate-500 mb-1">This Month</h3>
                <p className="text-3xl font-bold text-emerald-600">₹{(stats?.this_month_earnings || 0).toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                <h3 className="text-sm text-amber-600 mb-1">Payment Pending</h3>
                <p className="text-3xl font-bold text-amber-700">
                  ₹{payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </p>
                <p className="text-xs text-amber-500">{payments.filter(p => p.status === 'pending').length} sessions</p>
              </div>
              <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                <h3 className="text-sm text-red-600 mb-1">On Hold</h3>
                <p className="text-3xl font-bold text-red-700">
                  ₹{payments.filter(p => p.status === 'on_hold').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </p>
                <p className="text-xs text-red-500">{payments.filter(p => p.status === 'on_hold').length} sessions - awaiting feedback</p>
              </div>
            </div>

            {/* Payment Status Legend */}
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Payment Status Guide</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Pending</span>
                  <span className="text-slate-600">Session completed, feedback submitted - awaiting payment</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">On Hold</span>
                  <span className="text-slate-600">Session completed - please submit feedback to release payment</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Paid</span>
                  <span className="text-slate-600">Payment has been processed</span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-xl border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No payment history yet. Completed sessions will appear here.
                  </div>
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{payment.description}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-slate-500">{payment.date} {payment.time_slot && `at ${payment.time_slot}`}</p>
                          <span className="text-xs text-slate-400">•</span>
                          <p className="text-sm text-slate-500">{payment.session_type}</p>
                        </div>
                        {payment.status === 'on_hold' && (
                          <p className="text-xs text-red-500 mt-1">⚠️ Submit feedback to release this payment</p>
                        )}
                        {payment.paid_at && (
                          <p className="text-xs text-green-600 mt-1">Paid on {new Date(payment.paid_at).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-lg ${
                          payment.status === 'paid' ? 'text-emerald-600' : 
                          payment.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          ₹{payment.amount.toLocaleString()}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          payment.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : payment.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {payment.status_label || payment.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Feedback Modal */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Feedback for {feedbackSession?.candidate_name}</DialogTitle>
          </DialogHeader>
          {feedbackSession && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  Feedback for <strong>{feedbackSession.candidate_name}</strong>
                </p>
                <p className="text-sm text-slate-500">
                  {feedbackSession.date} at {feedbackSession.time}
                </p>
              </div>

              {/* Session Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Session Type <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={feedbackData.session_type} 
                  onValueChange={(v) => setFeedbackData({
                    ...feedbackData, 
                    session_type: v, 
                    case_type: v !== 'Case session' ? '' : feedbackData.case_type,
                    ratings: {}, // Reset ratings when session type changes
                    areas_of_strength: [], // Reset areas when session type changes
                    areas_of_improvement: []
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {feedbackSession.session_type && feedbackSession.session_type !== feedbackData.session_type && (
                  <p className="text-xs text-amber-600 mt-1">
                    Originally booked as: {feedbackSession.session_type}
                  </p>
                )}
              </div>

              {/* Case Type - Only show for Case sessions */}
              {feedbackData.session_type === 'Case session' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Case Type <span className="text-red-500">*</span>
                  </label>
                  <Select 
                    value={feedbackData.case_type} 
                    onValueChange={(v) => setFeedbackData({...feedbackData, case_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select case type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Profitability">Profitability</SelectItem>
                      <SelectItem value="Market Entry">Market Entry</SelectItem>
                      <SelectItem value="Guesstimate">Guesstimate</SelectItem>
                      <SelectItem value="Pricing">Pricing</SelectItem>
                      <SelectItem value="Growth">Growth</SelectItem>
                      <SelectItem value="M&A">M&A</SelectItem>
                      <SelectItem value="Unconventional">Unconventional</SelectItem>
                      <SelectItem value="Random">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic Ratings based on Session Type */}
              {feedbackData.session_type && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">
                    Performance Ratings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getRatingConfig(feedbackData.session_type).map((ratingItem) => (
                      <div key={ratingItem.key} className={ratingItem.isOverall ? 'md:col-span-2 pt-3 border-t' : ''}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          {ratingItem.label} <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                if (ratingItem.isOverall) {
                                  setFeedbackData({...feedbackData, rating_overall: n});
                                } else {
                                  setFeedbackData({
                                    ...feedbackData, 
                                    ratings: {...feedbackData.ratings, [ratingItem.key]: n}
                                  });
                                }
                              }}
                              className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                                (ratingItem.isOverall ? feedbackData.rating_overall : feedbackData.ratings[ratingItem.key]) >= n
                                  ? ratingItem.isOverall 
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'bg-amber-400 border-amber-400 text-white'
                                  : 'border-slate-200 text-slate-400 hover:border-amber-300'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Areas of Strength/Improvement - Only for session types that need them */}
              {feedbackData.session_type && getAreasConfig(feedbackData.session_type).hasAreas && (
                <>
                  {/* Areas of Strength - Multi-select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Areas of Strength <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {getAreasConfig(feedbackData.session_type).options.map((area) => {
                        const isSelected = feedbackData.areas_of_strength.includes(area);
                        const isDisabled = feedbackData.areas_of_improvement.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              const current = feedbackData.areas_of_strength;
                              if (current.includes(area)) {
                                setFeedbackData({...feedbackData, areas_of_strength: current.filter(a => a !== area)});
                              } else {
                                setFeedbackData({...feedbackData, areas_of_strength: [...current, area]});
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${
                              isDisabled
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                                : isSelected
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-200 text-slate-600 hover:border-emerald-300'
                            }`}
                            title={isDisabled ? 'Already selected in Areas of Improvement' : ''}
                          >
                            {area}
                          </button>
                        );
                      })}
                    </div>
                    {feedbackData.areas_of_strength.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Select at least one strength</p>
                    )}
                  </div>

                  {/* Areas of Improvement - Multi-select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Areas of Improvement <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {getAreasConfig(feedbackData.session_type).options.map((area) => {
                        const isSelected = feedbackData.areas_of_improvement.includes(area);
                        const isDisabled = feedbackData.areas_of_strength.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              const current = feedbackData.areas_of_improvement;
                              if (current.includes(area)) {
                                setFeedbackData({...feedbackData, areas_of_improvement: current.filter(a => a !== area)});
                              } else {
                                setFeedbackData({...feedbackData, areas_of_improvement: [...current, area]});
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${
                              isDisabled
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                                : isSelected
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'border-slate-200 text-slate-600 hover:border-amber-300'
                            }`}
                            title={isDisabled ? 'Already selected in Areas of Strength' : ''}
                          >
                            {area}
                          </button>
                        );
                      })}
                    </div>
                    {feedbackData.areas_of_improvement.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Select at least one area to improve</p>
                    )}
                  </div>
                </>
              )}

              {/* Qualitative Feedback */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Other Feedback & Next Steps (Optional)
                </label>
                <Textarea
                  value={feedbackData.qualitative_feedback}
                  onChange={(e) => setFeedbackData({...feedbackData, qualitative_feedback: e.target.value})}
                  placeholder="Any additional feedback, areas of improvement, or suggested next steps..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeedbackOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={
                !feedbackData.session_type || 
                !feedbackData.rating_overall || 
                (getAreasConfig(feedbackData.session_type).hasAreas && feedbackData.areas_of_strength.length === 0) || 
                (getAreasConfig(feedbackData.session_type).hasAreas && feedbackData.areas_of_improvement.length === 0) ||
                (feedbackData.session_type === 'Case session' && !feedbackData.case_type)
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Session Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600">
              Are you sure you want to cancel the session with <strong>{selectedSession?.candidate_name}</strong> on {selectedSession?.date} at {selectedSession?.time}?
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Reason for cancellation (optional)</label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let the candidate know why you're cancelling..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Keep Session
            </Button>
            <Button 
              onClick={handleCancelSession}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'Cancelling...' : 'Cancel Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Session Modal */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Reschedule Session</DialogTitle>
            <p className="text-slate-600 text-sm mt-2">
              Rescheduling session with <strong>{selectedSession?.candidate_name}</strong>
              <span className="block text-slate-500 mt-1">
                Current: {selectedSession?.date} at {selectedSession?.time}
              </span>
            </p>
          </DialogHeader>
          
          {/* Two-column layout: Dates on left, Times on right */}
          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Left Column - Dates */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                Select New Date
              </label>
              <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-2 pb-2" style={{ maxHeight: 'calc(85vh - 220px)' }}>
                {rescheduleAvailability
                  .filter(a => a.slots?.length > 0)
                  .map((slot) => (
                    <button
                      key={slot.date}
                      onClick={() => {
                        setRescheduleDate(slot.date);
                        setRescheduleSlot('');
                      }}
                      className={`p-3 text-sm rounded-lg border-2 transition-all ${
                        rescheduleDate === slot.date
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="font-semibold text-base">{slot.day?.slice(0, 3)}</div>
                      <div className="text-xs opacity-90">{slot.date?.slice(5)}</div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Right Column - Times */}
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-1.5" />
                {rescheduleDate ? 'Select New Time' : 'Select a date first'}
              </label>
              {rescheduleDate ? (
                <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-2 pb-2" style={{ maxHeight: 'calc(85vh - 220px)' }}>
                  {rescheduleAvailability
                    .find(a => a.date === rescheduleDate)
                    ?.slots?.filter(s => !rescheduleAvailability.find(a => a.date === rescheduleDate)?.booked_slots?.includes(s))
                    .map((time) => (
                      <button
                        key={time}
                        onClick={() => setRescheduleSlot(time)}
                        className={`p-3 text-sm rounded-lg border-2 transition-all font-medium ${
                          rescheduleSlot === time
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Please select a date to see available times</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setRescheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRescheduleSession}
              disabled={!rescheduleDate || !rescheduleSlot || actionLoading}
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Reschedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mentor Feedback Modal */}
      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Feedback for Candidate</DialogTitle>
          </DialogHeader>
          {feedbackSessionData && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  Feedback for <strong>{feedbackSessionData.candidate_name}</strong>
                </p>
                <p className="text-sm text-slate-500">
                  {feedbackSessionData.date} at {feedbackSessionData.time}
                </p>
              </div>

              {/* Case Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Case Type <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={mentorFeedback.case_type} 
                  onValueChange={(v) => setMentorFeedback(f => ({ ...f, case_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Profitability">Profitability</SelectItem>
                    <SelectItem value="Market Entry">Market Entry</SelectItem>
                    <SelectItem value="Guesstimate">Guesstimate</SelectItem>
                    <SelectItem value="Pricing">Pricing</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="M&A">M&A</SelectItem>
                    <SelectItem value="Unconventional">Unconventional</SelectItem>
                    <SelectItem value="Random">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ratings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scoping Questions */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Scoping Questions <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMentorFeedback(f => ({ ...f, rating_scoping_questions: n }))}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                          mentorFeedback.rating_scoping_questions >= n
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'border-slate-200 text-slate-400 hover:border-amber-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Case Structure */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Case Setup & Structure <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMentorFeedback(f => ({ ...f, rating_case_structure: n }))}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                          mentorFeedback.rating_case_structure >= n
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'border-slate-200 text-slate-400 hover:border-amber-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Case Math */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Case Math
                    <label className="ml-3 inline-flex items-center gap-1 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={!mentorFeedback.case_math_tested}
                        onChange={(e) => setMentorFeedback(f => ({ ...f, case_math_tested: !e.target.checked }))}
                        className="rounded"
                      />
                      Did not test this in the session
                    </label>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!mentorFeedback.case_math_tested}
                        onClick={() => setMentorFeedback(f => ({ ...f, rating_case_math: n }))}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                          !mentorFeedback.case_math_tested
                            ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                            : mentorFeedback.rating_case_math >= n
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'border-slate-200 text-slate-400 hover:border-amber-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Communication */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Communication & Confidence <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMentorFeedback(f => ({ ...f, rating_communication: n }))}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                          mentorFeedback.rating_communication >= n
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'border-slate-200 text-slate-400 hover:border-amber-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Business Acumen */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Business Acumen & Creativity <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMentorFeedback(f => ({ ...f, rating_business_acumen: n }))}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                          mentorFeedback.rating_business_acumen >= n
                            ? 'bg-amber-400 border-amber-400 text-white'
                            : 'border-slate-200 text-slate-400 hover:border-amber-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overall Rating */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Overall Rating <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMentorFeedback(f => ({ ...f, rating_overall: n }))}
                        className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                          mentorFeedback.rating_overall >= n
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-slate-200 text-slate-400 hover:border-blue-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Qualitative Feedback */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Other Feedback & Next Steps (Optional)
                </label>
                <Textarea
                  value={mentorFeedback.qualitative_feedback}
                  onChange={(e) => setMentorFeedback(f => ({ ...f, qualitative_feedback: e.target.value }))}
                  placeholder="Any additional feedback, areas of improvement, or suggested next steps..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitMentorFeedback}
              disabled={submittingFeedback || !mentorFeedback.case_type}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Candidate Feedback Modal */}
      <Dialog open={viewFeedbackModalOpen} onOpenChange={setViewFeedbackModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-600" />
              Candidate Feedback
            </DialogTitle>
          </DialogHeader>
          {viewingFeedback && (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  Feedback from <strong>{viewingFeedback.session_info?.candidate_name}</strong>
                </p>
                <p className="text-sm text-slate-500">
                  {viewingFeedback.session_info?.date} • {viewingFeedback.session_info?.session_type}
                </p>
              </div>

              {/* Mentor Followed Instructions */}
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Followed Session Instructions</span>
                {viewingFeedback.mentor_followed_instructions ? (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Yes
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <X className="w-3 h-3" /> No
                  </span>
                )}
              </div>

              {/* Ratings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Facilitation Style</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${
                          n <= viewingFeedback.rating_facilitation_style
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium">{viewingFeedback.rating_facilitation_style}/5</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Feedback Quality</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${
                          n <= viewingFeedback.rating_feedback_quality
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium">{viewingFeedback.rating_feedback_quality}/5</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Overall Rating</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${
                          n <= viewingFeedback.rating_overall
                            ? 'text-blue-500 fill-blue-500'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm font-medium">{viewingFeedback.rating_overall}/5</span>
                  </div>
                </div>
              </div>

              {/* Additional Comments */}
              {viewingFeedback.other_feedback && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-700 mb-1">Additional Comments</p>
                  <p className="text-sm text-slate-600">{viewingFeedback.other_feedback}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewFeedbackModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidate Profile Modal - Comprehensive view of candidate history */}
      <Dialog open={candidateProfileOpen} onOpenChange={setCandidateProfileOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" />
              Candidate Profile
            </DialogTitle>
          </DialogHeader>
          
          {loadingCandidateDetails ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-slate-600">Loading candidate profile...</span>
            </div>
          ) : candidateDetails ? (
            <div className="space-y-6">
              {/* Candidate Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
                <div className="flex items-start gap-4">
                  <img
                    src={candidateDetails.candidate.picture || `https://ui-avatars.com/api/?name=${candidateDetails.candidate.name}&background=0D8ABC&color=fff&size=128`}
                    alt={candidateDetails.candidate.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900">{candidateDetails.candidate.name}</h2>
                      {candidateDetails.candidate.linkedin_url && (
                        <a
                          href={candidateDetails.candidate.linkedin_url.startsWith('http') ? candidateDetails.candidate.linkedin_url : `https://${candidateDetails.candidate.linkedin_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{candidateDetails.candidate.email}</p>
                    
                    {/* Location & Education */}
                    <div className="flex flex-wrap gap-3 mt-3">
                      {candidateDetails.candidate.location && (
                        <span className="flex items-center gap-1 text-sm text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {candidateDetails.candidate.location}
                        </span>
                      )}
                      {(candidateDetails.candidate.ug_college || candidateDetails.candidate.pg_college) && (
                        <span className="flex items-center gap-1 text-sm text-slate-600">
                          <GraduationCap className="w-4 h-4 text-slate-400" />
                          {candidateDetails.candidate.pg_college && !candidateDetails.candidate.no_pg
                            ? `${candidateDetails.candidate.pg_college}${candidateDetails.candidate.pg_incoming ? ' (Incoming)' : ''}`
                            : candidateDetails.candidate.ug_college
                          }
                        </span>
                      )}
                      {candidateDetails.candidate.current_company && (
                        <span className="flex items-center gap-1 text-sm text-slate-600">
                          <Briefcase className="w-4 h-4 text-slate-400" />
                          {candidateDetails.candidate.current_role ? `${candidateDetails.candidate.current_role} at ` : ''}{candidateDetails.candidate.current_company}
                        </span>
                      )}
                    </div>
                    
                    {/* Target Firms */}
                    {candidateDetails.candidate?.target_firms?.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-slate-500">Targeting:</span>
                        <div className="flex flex-wrap gap-1">
                          {candidateDetails.candidate.target_firms.slice(0, 5).map((firm, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                              {firm}
                            </span>
                          ))}
                          {candidateDetails.candidate.target_firms.length > 5 && (
                            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                              +{candidateDetails.candidate.target_firms.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-blue-600">{candidateDetails.stats.completed_coaching_sessions}</p>
                  <p className="text-xs text-slate-500">Coaching Sessions Done</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-purple-600">{candidateDetails.stats.completed_peer_sessions}</p>
                  <p className="text-xs text-slate-500">Peer Sessions Done</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="text-2xl font-bold text-slate-800">
                      {candidateDetails.stats.avg_mentor_rating || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Avg Coach Rating</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-5 h-5 text-purple-400 fill-purple-400" />
                    <span className="text-2xl font-bold text-slate-800">
                      {candidateDetails.stats.avg_peer_rating || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Avg Peer Rating</p>
                </div>
              </div>

              {/* Aggregated Areas of Strength & Improvement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Top Areas of Strength
                  </h4>
                  {candidateDetails.aggregated_areas?.strengths?.length > 0 ? (
                    <div className="space-y-2">
                      {candidateDetails.aggregated_areas.strengths.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm text-green-700">{item.area}</span>
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                            {item.count}x mentioned
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-600 italic">No feedback yet</p>
                  )}
                </div>

                {/* Improvements */}
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Areas for Improvement
                  </h4>
                  {candidateDetails.aggregated_areas?.improvements?.length > 0 ? (
                    <div className="space-y-2">
                      {candidateDetails.aggregated_areas.improvements.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm text-amber-700">{item.area}</span>
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                            {item.count}x mentioned
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600 italic">No feedback yet</p>
                  )}
                </div>
              </div>

              {/* Session History with You */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Sessions with You ({candidateDetails.stats.sessions_with_me})
                  </h4>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {candidateDetails.coaching_sessions && candidateDetails.coaching_sessions.filter(s => s.mentor_id === mentorProfile?.id || s.mentor_name === mentorProfile?.name).length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {candidateDetails.coaching_sessions
                        .filter(s => s.mentor_id === mentorProfile?.id || s.mentor_name === mentorProfile?.name)
                        .slice(0, 10)
                        .map((session, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-800">{session.date} at {session.time_slot}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {session.session_type || 'General'}
                                </span>
                                {session.case_type && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    {session.case_type}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              session.status === 'completed' ? 'bg-green-100 text-green-700' :
                              session.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {session.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="p-4 text-sm text-slate-500 text-center">No sessions with you yet</p>
                  )}
                </div>
              </div>

              {/* All Mentor Feedback History */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="p-4 border-b border-slate-100">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    All Coach Feedback ({candidateDetails.mentor_feedbacks?.length || 0})
                  </h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {candidateDetails.mentor_feedbacks?.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {candidateDetails.mentor_feedbacks.map((fb, idx) => (
                        <div key={idx} className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-500">
                                {fb.created_at ? new Date(fb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date N/A'}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {fb.session_type}
                              </span>
                              {fb.case_type && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                  {fb.case_type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="font-semibold text-slate-800">{fb.rating_overall}/5</span>
                            </div>
                          </div>
                          
                          {/* Areas of Strength - Clear label */}
                          {fb.areas_of_strength?.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Strengths:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {fb.areas_of_strength.map((area, i) => (
                                  <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md border border-green-200">
                                    {area}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Areas of Improvement - Clear label */}
                          {fb.areas_of_improvement?.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Needs Improvement:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {fb.areas_of_improvement.map((area, i) => (
                                  <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md border border-amber-200">
                                    {area}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {fb.qualitative_feedback && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                              <p className="text-xs font-medium text-slate-500 mb-1">Coach Notes:</p>
                              <p className="text-sm text-slate-600 line-clamp-3">
                                {fb.qualitative_feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-4 text-sm text-slate-500 text-center">No coach feedback yet</p>
                  )}
                </div>
              </div>

              {/* Peer Feedback History */}
              {candidateDetails.peer_feedbacks?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="p-4 border-b border-slate-100">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      Peer Feedback ({candidateDetails.peer_feedbacks?.length || 0})
                    </h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <div className="divide-y divide-slate-100">
                      {candidateDetails.peer_feedbacks.slice(0, 10).map((fb, idx) => (
                        <div key={idx} className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{fb.from_name}</span>
                              <span className="text-xs text-slate-400">{fb.session_date}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-purple-400 fill-purple-400" />
                              <span className="text-sm font-medium text-slate-700">{fb.rating_overall}/5</span>
                            </div>
                          </div>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {fb.session_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-500">No candidate data available</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandidateProfileOpen(false)}>
              Close
            </Button>
          </DialogFooter>
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
                <HelpCircle className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
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
              <Textarea
                value={supportQuery}
                onChange={(e) => setSupportQuery(e.target.value)}
                placeholder="Describe your issue or question..."
                className="w-full min-h-[120px]"
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
                    onClick={removeSupportAttachment}
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
                    onChange={handleSupportAttachmentChange}
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
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitSupport}
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

      {/* Platform Feedback Modal */}
      <Dialog open={platformFeedbackModalOpen} onOpenChange={(open) => {
        setPlatformFeedbackModalOpen(open);
        if (!open) {
          setPlatformFeedbackText('');
          setPlatformFeedbackRating(0);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <Star className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
              </div>
              <DialogTitle style={{ color: 'var(--gn-rhino)' }}>
                Share Your Feedback
              </DialogTitle>
            </div>
            <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              We'd love to hear your thoughts! Your feedback helps us improve the platform.
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
                    onClick={() => setPlatformFeedbackRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                    disabled={submittingPlatformFeedback}
                  >
                    <Star
                      className={`w-8 h-8 ${star <= platformFeedbackRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--gn-grey-dark)' }}>
                Your Feedback
              </label>
              <Textarea
                value={platformFeedbackText}
                onChange={(e) => setPlatformFeedbackText(e.target.value)}
                placeholder="Tell us what you think about gradnext..."
                className="w-full min-h-[120px]"
                disabled={submittingPlatformFeedback}
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setPlatformFeedbackModalOpen(false);
                  setPlatformFeedbackText('');
                  setPlatformFeedbackRating(0);
                }}
                disabled={submittingPlatformFeedback}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitPlatformFeedback}
                disabled={submittingPlatformFeedback || !platformFeedbackText.trim() || platformFeedbackRating === 0}
                className="flex-1 text-white"
                style={{ backgroundColor: 'var(--gn-rhino)' }}
              >
                {submittingPlatformFeedback ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MentorDashboard;
