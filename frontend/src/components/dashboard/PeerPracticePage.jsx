import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import { 
  Users, Lock, Clock, Calendar, ArrowRight, MessageSquare, 
  UserPlus, Star, Target, CheckCircle2, X, Send, RefreshCw, Trash2,
  ExternalLink, AlertCircle, Edit2, Eye, EyeOff, Building2, GraduationCap,
  Link2, Link2Off, Settings2, CalendarDays, FileText, ChevronLeft, ChevronRight,
  Filter, Search, Save, Upload, Camera, ThumbsUp, Globe, Briefcase, MapPin,
  Crown, Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { WeeklyAvailabilitySelector, validateAvailability } from '../TimeSlotPicker';
import { 
  getBrowserTimezone, 
  getTimezoneAbbr, 
  formatTimeWithTimezone,
  formatDateTimeWithTz,
  istToViewer,
  format12hWithAbbr,
} from '../../utils/timezone';
import ProfileCompletionModal from './ProfileCompletionModal';
import '../../styles/cardStyles.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to check if a session is in a cancelled state
const isSessionCancelled = (status) => {
  const cancelledStatuses = ['cancelled', 'candidate_cancelled', 'mentor_cancelled', 'cancelled_by_candidate', 'cancelled_by_mentor', 'cancelled_by_admin', 'declined'];
  return cancelledStatuses.includes(status);
};

// Helper function to check if a session is in a rescheduled state
const isSessionRescheduled = (status) => {
  const rescheduledStatuses = ['rescheduled', 'mentor_rescheduled', 'candidate_rescheduled', 'reschedule_pending'];
  return rescheduledStatuses.includes(status);
};

// Helper function to check if a session is in a no-show state
const isSessionNoShow = (status) => {
  const noShowStatuses = ['no_show', 'mentor_no_show', 'candidate_no_show', 'both_no_show'];
  return noShowStatuses.includes(status);
};

// Helper function to check if session is in a terminal state (shouldn't show action buttons)
const isSessionTerminal = (status) => {
  return isSessionCancelled(status) || isSessionRescheduled(status) || isSessionNoShow(status);
};

// Utility function to ensure meeting links have proper protocol
const formatMeetingLink = (link) => {
  if (!link) return null;
  return link.startsWith('http://') || link.startsWith('https://') 
    ? link 
    : `https://${link}`;
};

// Session type options for peer practice
const sessionTypeOptions = [
  'Case session',
  'PEI session',
  'CV review session',
  'FIT session',
  'General discussion'
];

// Dynamic rating configurations per session type (same as mentor)
const getPeerRatingConfig = (sessionType) => {
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

// Dynamic areas options per session type (same as mentor)
const getPeerAreasConfig = (sessionType) => {
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

// LinkedIn logo URL (provided by user)
const LINKEDIN_LOGO_URL = "https://customer-assets.emergentagent.com/job_b7e32175-b0f1-4a43-8db8-a2da6302008c/artifacts/h32u385j_image.png";

// Common target firms for consulting
const TARGET_FIRMS = [
  'McKinsey', 'BCG', 'Bain', 'Deloitte', 'Accenture', 'Kearney', 
  'Roland Berger', 'Oliver Wyman', 'Strategy&', 'EY-Parthenon',
  'KPMG', 'LEK', 'Simon-Kucher', 'Monitor Deloitte', 'Other'
];

// Star Rating Component for feedback
const StarRating = ({ value, onChange, label }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-slate-700">{label}</Label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 hover:scale-110 transition-transform"
        >
          <Star
            className={`w-7 h-7 ${
              star <= value
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300 hover:text-amber-200'
            }`}
          />
        </button>
      ))}
    </div>
  </div>
);

// Render stars helper (for display only)
const renderStars = (rating) => {
  return [...Array(5)].map((_, i) => (
    <Star
      key={i}
      className={`w-4 h-4 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
    />
  ));
};

const PeerPracticePage = () => {
  const { dashboardData, user, refreshUser, showUpgradeModal } = useDashboard();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('find-peers');
  
  // Data state
  const [peers, setPeers] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Feedback state - mentor-style feedback for evaluating partner's performance
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackSession, setFeedbackSession] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [peerFeedback, setPeerFeedback] = useState({
    session_type: '',
    case_type: '',
    ratings: {}, // Dynamic ratings object
    rating_overall: 0,
    areas_of_strength: [],
    areas_of_improvement: [],
    qualitative_feedback: ''
  });
  
  // View feedback state
  const [viewFeedbackOpen, setViewFeedbackOpen] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState(null);
  
  // Profile completion modal state
  const [profileCompletionOpen, setProfileCompletionOpen] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [profileData, setProfileData] = useState({});
  
  // Instructions modal state
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  
  // Session credits state (monthly system)
  const [sessionCredits, setSessionCredits] = useState({
    has_access: true,
    sessions_per_month: 0,
    sessions_used: 0,
    sessions_remaining: 0,
    is_unlimited: false,
    is_mentor: false,
    billing_start: null,
    billing_end: null,
    next_reset: null
  });
  
  // Filter state for Find Peers
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlanCategory, setFilterPlanCategory] = useState('all');
  const [filterUniversity, setFilterUniversity] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [sortBy, setSortBy] = useState('earliest'); // 'earliest' or 'rating'
  const [currentPage, setCurrentPage] = useState(1);
  const PEERS_PER_PAGE = 12; // Show 12 peers per page (4x3 grid)
  
  // Time slot filter state for Peer Practice
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterFromTime, setFilterFromTime] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterToTime, setFilterToTime] = useState('');
  const [timeFilteredPeerIds, setTimeFilteredPeerIds] = useState(null); // null = no filter, Set = filtered IDs
  const [timeFilterLoading, setTimeFilterLoading] = useState(false);
  
  // Unique universities/colleges for filter dropdown - include UG, PG, and university fields
  const uniqueUniversities = [...new Set(
    peers.flatMap(p => [p.university, p.ug_college, p.pg_college].filter(Boolean))
  )].sort();
  
  // Booking state
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [peerAvailability, setPeerAvailability] = useState([]);
  const [peerNoCredits, setPeerNoCredits] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Pre-booking form state (same as coaching)
  const [sessionType, setSessionType] = useState('');
  const [caseType, setCaseType] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  
  // Profile state
  const [isPictureModalOpen, setIsPictureModalOpen] = useState(false); // For picture upload popup
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [settingUpAvailability, setSettingUpAvailability] = useState(false); // For setup flow
  
  // Availability state
  const [editableAvailability, setEditableAvailability] = useState([]);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState(3);
  const [blockedDays, setBlockedDays] = useState([]);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(new Date());
  
  // Google Calendar state
  const [calendarStatus, setCalendarStatus] = useState({
    connected: false,
    email: null,
    last_synced: null,
    loading: true
  });
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  
  // Reschedule state
  const [rescheduleSession, setRescheduleSession] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleAvailability, setRescheduleAvailability] = useState([]);
  const [rescheduleAvailabilityLoading, setRescheduleAvailabilityLoading] = useState(false);
  const [approvingReschedule, setApprovingReschedule] = useState(null);
  
  // Cancel state
  const [cancelSession, setCancelSession] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  
  // Cancellation policy state
  const [cancellationPolicy, setCancellationPolicy] = useState({ candidate_hours: 4 });
  
  // Session join state
  const [joiningSession, setJoiningSession] = useState(null);
  
  // Track if we've checked peer access
  const [peerAccessChecked, setPeerAccessChecked] = useState(false);

  // Handle calendar connection callback and tab parameter
  useEffect(() => {
    const calendarConnected = searchParams.get('calendar_connected');
    const calendarError = searchParams.get('calendar_error');
    const tabParam = searchParams.get('tab');
    
    if (calendarConnected === 'true') {
      alert('Google Calendar connected successfully!');
      navigate('/dashboard/peer-practice', { replace: true });
      fetchCalendarStatus();
    } else if (calendarError) {
      alert(`Failed to connect calendar: ${calendarError}`);
      navigate('/dashboard/peer-practice', { replace: true });
    }
    
    // Handle tab parameter from URL (e.g., ?tab=sessions)
    if (tabParam) {
      const tabMap = {
        'sessions': 'my-sessions',
        'my-sessions': 'my-sessions',
        'peers': 'find-peers',
        'find-peers': 'find-peers',
        'availability': 'availability'
      };
      const mappedTab = tabMap[tabParam] || 'find-peers';
      setActiveTab(mappedTab);
    }
  }, [searchParams, navigate]);

  // Fetch all data - always fetch session credits first to check peer-specific access
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel for speed
        const [creditsRes, peersRes, sessionsRes, profileRes, calendarRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/peers/session-credits`, { withCredentials: true }),
          axios.get(`${BACKEND_URL}/api/peers/list`, { withCredentials: true }).catch(() => ({ data: [] })),
          axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true }).catch(() => ({ data: [] })),
          axios.get(`${BACKEND_URL}/api/peers/my-profile`, { withCredentials: true }).catch(() => ({ data: { has_profile: false } })),
          axios.get(`${BACKEND_URL}/api/peers/calendar/status`, { withCredentials: true }).catch(() => ({ data: { connected: false } }))
        ]);
        
        setSessionCredits(creditsRes.data);
        setPeerAccessChecked(true);
        
        // Always set sessions - user may have existing sessions even without current access
        setMySessions(sessionsRes.data);
        
        // If user doesn't have peer practice access, still show their existing sessions but don't load other data
        if (!creditsRes.data.has_access) {
          // Still load profile if exists (for viewing existing sessions)
          if (profileRes.data.has_profile) {
            setMyProfile(profileRes.data.profile);
          }
          // If user has existing sessions but no access, switch to My Sessions tab
          if (sessionsRes.data && sessionsRes.data.length > 0) {
            setActiveTab('my-sessions');
          }
          setLoading(false);
          return;
        }
        
        // Set all fetched data for users with access
        setPeers(peersRes.data);
        
        if (profileRes.data.has_profile) {
          const profile = profileRes.data.profile;
          setMyProfile(profile);
          setMaxSessionsPerDay(profile.max_sessions_per_day || 3);
          setBlockedDays(profile.blocked_dates || []);
          
          const converted = convertSlotsToWeeklyFormat(profile.weekly_availability || []);
          setEditableAvailability(converted);
        }
        
        setCalendarStatus({
          ...calendarRes.data,
          loading: false
        });
      } catch (error) {
        console.error('Failed to fetch peer data:', error);
        setPeerAccessChecked(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchCancellationPolicy();
  }, []);

  // Fetch cancellation policy
  const fetchCancellationPolicy = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/public/cancellation-policy`, { withCredentials: true });
      console.log('PeerPractice: Cancellation policy loaded:', response.data);
      setCancellationPolicy(response.data);
    } catch (error) {
      console.log('Using default cancellation policy:', error.message);
    }
  };

  // Check if session can be cancelled/rescheduled based on policy
  const canCancelOrReschedule = (session) => {
    const sessionDateTime = new Date(`${session.date}T${session.time_slot || '00:00'}:00`);
    const now = new Date();
    const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);
    const policyHours = cancellationPolicy?.candidate_hours || 4;
    return hoursUntilSession >= policyHours;
  };

  // Fetch/refresh my profile data
  const fetchMyProfile = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/my-profile`, { withCredentials: true });
      if (response.data.has_profile) {
        const profile = response.data.profile;
        setMyProfile(profile);
        setMaxSessionsPerDay(profile.max_sessions_per_day || 3);
        setBlockedDays(profile.blocked_dates || []);
        const converted = convertSlotsToWeeklyFormat(profile.weekly_availability || []);
        setEditableAvailability(converted);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  // Refresh session credits after booking
  const refreshSessionCredits = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/session-credits`, { withCredentials: true });
      setSessionCredits(response.data);
    } catch (error) {
      console.error('Failed to refresh session credits:', error);
    }
  };

  const fetchCalendarStatus = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/calendar/status`, { withCredentials: true });
      setCalendarStatus({ ...response.data, loading: false });
    } catch (error) {
      setCalendarStatus(prev => ({ ...prev, loading: false }));
    }
  };

  // Availability format converters
  const convertSlotsToWeeklyFormat = (slots) => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const grouped = {};
    
    slots.forEach(slot => {
      const dayName = dayNames[slot.day_of_week];
      if (!grouped[dayName]) {
        grouped[dayName] = [];
      }
      grouped[dayName].push({ from: slot.start_time, to: slot.end_time });
    });
    
    return Object.entries(grouped).map(([day, daySlots]) => ({
      day,
      slots: daySlots
    }));
  };

  const convertWeeklyFormatToSlots = (weeklyFormat) => {
    const dayIndex = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6 };
    const slots = [];
    
    weeklyFormat.forEach(dayData => {
      const day_of_week = dayIndex[dayData.day];
      if (day_of_week !== undefined && dayData.slots) {
        dayData.slots.forEach(slot => {
          slots.push({
            day_of_week,
            start_time: slot.from,
            end_time: slot.to
          });
        });
      }
    });
    
    return slots;
  };

  // Session time helpers
  const isSessionJoinable = (session) => {
    const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
    const now = new Date();
    const diffMinutes = (sessionDateTime - now) / (1000 * 60);
    return diffMinutes <= 15 && diffMinutes >= -90;
  };

  const isSessionPastJoinWindow = (session) => {
    const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
    const now = new Date();
    const diffMinutes = (sessionDateTime - now) / (1000 * 60);
    return diffMinutes < -90;
  };

  const getTimeUntilJoinable = (session) => {
    const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
    const now = new Date();
    const diffMinutes = Math.floor((sessionDateTime - now) / (1000 * 60));
    
    if (diffMinutes > 60 * 24) {
      const days = Math.floor(diffMinutes / (60 * 24));
      return `${days}d`;
    } else if (diffMinutes > 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h`;
    } else if (diffMinutes > 15) {
      return `${diffMinutes - 15}m`;
    }
    return null;
  };

  // Apply time slot filter for peers - fetch availability and filter
  const applyPeerTimeSlotFilter = async () => {
    if (!filterFromDate || !filterFromTime || !filterToDate || !filterToTime) {
      alert('Please fill in all date and time fields');
      return;
    }
    
    setTimeFilterLoading(true);
    try {
      // Create datetime strings for comparison
      const fromDateTime = new Date(`${filterFromDate}T${filterFromTime}`);
      const toDateTime = new Date(`${filterToDate}T${filterToTime}`);
      
      if (fromDateTime >= toDateTime) {
        alert('End date/time must be after start date/time');
        setTimeFilterLoading(false);
        return;
      }
      
      // Fetch availability for all peers and filter
      const peerIds = peers.map(p => p.id);
      const availableInRange = new Set();
      
      // Batch fetch availability for all peers
      const availabilityPromises = peerIds.map(async (peerId) => {
        try {
          const response = await axios.get(`${BACKEND_URL}/api/peers/availability/${peerId}`, {
            withCredentials: true,
          });
          // Peer API returns { available_slots: [{ date, time, ... }] }
          const slots = response.data?.available_slots || [];
          
          // Check if any slot falls within the time range
          for (const slot of slots) {
            const slotDateTime = new Date(`${slot.date}T${slot.time}`);
            if (slotDateTime >= fromDateTime && slotDateTime <= toDateTime) {
              availableInRange.add(peerId);
              return; // Found a match, no need to check more
            }
          }
        } catch (error) {
          console.error(`Failed to fetch availability for peer ${peerId}:`, error);
        }
      });
      
      await Promise.all(availabilityPromises);
      setTimeFilteredPeerIds(availableInRange);
    } catch (error) {
      console.error('Failed to apply time filter:', error);
    } finally {
      setTimeFilterLoading(false);
    }
  };
  
  // Clear time slot filter for peers
  const clearPeerTimeSlotFilter = () => {
    setFilterFromDate('');
    setFilterFromTime('');
    setFilterToDate('');
    setFilterToTime('');
    setTimeFilteredPeerIds(null);
    setShowTimeFilter(false);
  };

  // Filter peers
  // Memoize filtered peers to avoid recalculation on every render
  const filteredPeers = useMemo(() => {
    return peers.filter(peer => {
      // Time slot filter (if applied)
      if (timeFilteredPeerIds !== null && !timeFilteredPeerIds.has(peer.id)) {
        return false;
      }
      // Search query - check name and all college fields
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = peer.name?.toLowerCase().includes(query);
        const matchesUni = peer.university?.toLowerCase().includes(query);
        const matchesUG = peer.ug_college?.toLowerCase().includes(query);
        const matchesPG = peer.pg_college?.toLowerCase().includes(query);
        if (!matchesName && !matchesUni && !matchesUG && !matchesPG) {
          return false;
        }
      }
      if (filterPlanCategory !== 'all' && peer.plan_category !== filterPlanCategory) return false;
      // University filter - check all college fields
      if (filterUniversity !== 'all') {
        const matchesUni = peer.university === filterUniversity;
        const matchesUG = peer.ug_college === filterUniversity;
        const matchesPG = peer.pg_college === filterUniversity;
        if (!matchesUni && !matchesUG && !matchesPG) return false;
      }
      if (filterRating !== 'all') {
        const minRating = parseInt(filterRating);
        if (peer.peer_rating < minRating) return false;
      }
      if (filterStage !== 'all' && peer.preparation_stage !== filterStage) return false;
      return true;
    });
  }, [peers, searchQuery, filterPlanCategory, filterUniversity, filterRating, filterStage, timeFilteredPeerIds]);

  // Memoize sorted peers
  const sortedPeers = useMemo(() => {
    return [...filteredPeers].sort((a, b) => {
      if (sortBy === 'rating') {
        // Sort by rating (highest first), then by name
        const ratingA = a.peer_rating || 0;
        const ratingB = b.peer_rating || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'sessions') {
        // Sort by number of sessions done (highest first)
        const sessionsA = a.peer_sessions_done || 0;
        const sessionsB = b.peer_sessions_done || 0;
        if (sessionsB !== sessionsA) return sessionsB - sessionsA;
        return a.name.localeCompare(b.name);
      } else {
        // Sort by earliest availability (default) - now using earliest_slot from API
        const slotA = a.earliest_slot;
        const slotB = b.earliest_slot;
        
        // Peers without availability go to the end
        if (!slotA && !slotB) return a.name.localeCompare(b.name);
        if (!slotA) return 1;
        if (!slotB) return -1;
        
        // Compare dates first, then times
        const dateCompare = slotA.date.localeCompare(slotB.date);
        if (dateCompare !== 0) return dateCompare;
        return slotA.time.localeCompare(slotB.time);
      }
    });
  }, [filteredPeers, sortBy]);

  // Paginate sorted peers
  const totalPages = Math.ceil(sortedPeers.length / PEERS_PER_PAGE);
  const paginatedPeers = useMemo(() => {
    const startIndex = (currentPage - 1) * PEERS_PER_PAGE;
    return sortedPeers.slice(startIndex, startIndex + PEERS_PER_PAGE);
  }, [sortedPeers, currentPage, PEERS_PER_PAGE]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterPlanCategory, filterUniversity, filterRating, filterStage, sortBy]);

  // Memoize session calculations
  const { upcomingSessions, pendingRequests, pastSessions } = useMemo(() => {
    const now = new Date();
    const joinWindowMinutes = 90; // Session stays in upcoming until 90 min after start
    
    const upcoming = mySessions.filter(s => {
      const sessionDate = new Date(`${s.date}T${s.time_slot}`);
      const joinWindowEnd = new Date(sessionDate.getTime() + joinWindowMinutes * 60 * 1000);
      return joinWindowEnd >= now && !isSessionTerminal(s.status);
    }).sort((a, b) => new Date(`${a.date}T${a.time_slot}`) - new Date(`${b.date}T${b.time_slot}`));
    
    const pending = upcoming.filter(s => 
      s.status === 'pending' && s.partner_id === user?.id
    );
    
    const past = mySessions.filter(s => {
      const sessionDate = new Date(`${s.date}T${s.time_slot}`);
      const joinWindowEnd = new Date(sessionDate.getTime() + joinWindowMinutes * 60 * 1000);
      return joinWindowEnd < now || isSessionTerminal(s.status);
    }).sort((a, b) => new Date(`${b.date}T${b.time_slot}`) - new Date(`${a.date}T${a.time_slot}`));
    
    return { upcomingSessions: upcoming, pendingRequests: pending, pastSessions: past };
  }, [mySessions, user?.id]);

  // Approve/Decline handlers
  const [approvingSession, setApprovingSession] = useState(null);
  
  const handleApproveSession = async (sessionId) => {
    setApprovingSession(sessionId);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/sessions/${sessionId}/approve`, {}, { withCredentials: true });
      // Refresh sessions
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      await refreshSessionCredits();
      alert('Session approved! Calendar invite sent to both participants.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to approve session');
    } finally {
      setApprovingSession(null);
    }
  };
  
  const handleDeclineSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to decline this session? Both users will have their credits restored.')) {
      return;
    }
    setApprovingSession(sessionId);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/sessions/${sessionId}/decline`, {}, { withCredentials: true });
      // Refresh sessions
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      await refreshSessionCredits();
      alert('Session declined. Credits restored.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to decline session');
    } finally {
      setApprovingSession(null);
    }
  };

  // Feedback handlers
  const openFeedbackModal = (session) => {
    setFeedbackSession(session);
    setPeerFeedback({
      case_type: '',
      rating_scoping_questions: 3,
      rating_case_structure: 3,
      rating_quantitative: 3,
      quantitative_tested: true,
      rating_communication: 3,
      rating_business_acumen: 3,
      rating_overall: 3,
      qualitative_feedback: ''
    });
    setFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackSession) return;
    
    const areasConfig = getPeerAreasConfig(peerFeedback.session_type);
    const ratingConfig = getPeerRatingConfig(peerFeedback.session_type);
    const isCaseSession = peerFeedback.session_type === 'Case session';
    
    // Validate required fields
    if (!peerFeedback.session_type) {
      alert('Please select a session type');
      return;
    }
    if (isCaseSession && !peerFeedback.case_type) {
      alert('Please select a case type');
      return;
    }
    if (!peerFeedback.rating_overall) {
      alert('Please provide an overall rating');
      return;
    }
    
    // Check all required ratings are filled
    const missingRatings = ratingConfig.filter(r => !r.isOverall && !peerFeedback.ratings[r.key]);
    if (missingRatings.length > 0) {
      alert(`Please rate: ${missingRatings.map(r => r.label).join(', ')}`);
      return;
    }
    
    // Check areas only for session types that require them
    if (areasConfig.hasAreas) {
      if (peerFeedback.areas_of_strength.length === 0) {
        alert('Please select at least one area of strength');
        return;
      }
      if (peerFeedback.areas_of_improvement.length === 0) {
        alert('Please select at least one area of improvement');
        return;
      }
    }
    
    setSubmittingFeedback(true);
    try {
      // Prepare the feedback payload with all ratings flattened
      const feedbackPayload = {
        session_id: feedbackSession.id,
        session_type: peerFeedback.session_type,
        case_type: isCaseSession ? peerFeedback.case_type : null,
        rating_overall: peerFeedback.rating_overall,
        areas_of_strength: areasConfig.hasAreas ? peerFeedback.areas_of_strength : [],
        areas_of_improvement: areasConfig.hasAreas ? peerFeedback.areas_of_improvement : [],
        qualitative_feedback: peerFeedback.qualitative_feedback,
        // Include all dynamic ratings
        ...peerFeedback.ratings
      };
      
      await axios.post(`${BACKEND_URL}/api/peers/feedback`, feedbackPayload, { withCredentials: true });
      
      setFeedbackModalOpen(false);
      setFeedbackSession(null);
      setPeerFeedback({
        session_type: '',
        case_type: '',
        ratings: {},
        rating_overall: 0,
        areas_of_strength: [],
        areas_of_improvement: [],
        qualitative_feedback: ''
      });
      
      // Refresh sessions
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      
      alert('Thank you! Your feedback has been submitted.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleViewFeedback = async (session) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/sessions/${session.id}/feedback`, { withCredentials: true });
      setViewingFeedback({
        ...response.data,
        partner_name: session.partner_name,
        session_date: session.date,
        session_time: session.time_slot
      });
      setViewFeedbackOpen(true);
    } catch (error) {
      alert('Could not load feedback. Please try again.');
    }
  };

  // Join session with tracking via check-in endpoint
  const handleJoinSession = async (session) => {
    setJoiningSession(session.id);
    try {
      // Use the new check-in endpoint that tracks attendance and returns meet link
      const response = await axios.post(
        `${BACKEND_URL}/api/sessions/peer/${session.id}/check-in`, 
        {}, 
        { withCredentials: true }
      );
      
      if (response.data.success && response.data.meet_link) {
        // Open meet link in new tab
        window.open(formatMeetingLink(response.data.meet_link), '_blank');
        
        // Refresh sessions to update check-in status
        const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
        setMySessions(sessionsRes.data);
      } else if (session.meet_link) {
        // Fallback to stored meet link
        window.open(formatMeetingLink(session.meet_link), '_blank');
      } else {
        alert('Meeting link not available. Please contact support.');
      }
    } catch (error) {
      console.error('Failed to check-in:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to join session.';
      
      // If check-in window related error, show specific message
      if (errorMessage.includes('opens') || errorMessage.includes('closed')) {
        alert(errorMessage);
      } else if (session.meet_link) {
        // If other error but we have meet link, still try to open it
        window.open(formatMeetingLink(session.meet_link), '_blank');
      } else {
        alert(errorMessage);
      }
    } finally {
      setJoiningSession(null);
    }
  };

  // Check if session needs feedback (past join window)
  const needsFeedback = (session) => {
    const sessionDateTime = new Date(`${session.date}T${session.time_slot}`);
    const feedbackWindowStart = new Date(sessionDateTime.getTime() + 30 * 60 * 1000); // 30 mins after start
    return new Date() >= feedbackWindowStart && !session.feedback_submitted && session.status === 'confirmed';
  };

  // Booking handlers
  const openBookingModal = async (peer) => {
    setSelectedPeer(peer);
    setBookingDate(null);
    setBookingSlot(null);
    setPeerNoCredits(false);
    // Reset pre-booking form
    setSessionType('');
    setCaseType('');
    setSessionNotes('');
    // Fetch peer's availability
    await fetchPeerAvailability(peer.id);
  };

  const fetchPeerAvailability = async (peerId) => {
    setAvailabilityLoading(true);
    setPeerAvailability([]);
    setPeerNoCredits(false);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/availability/${peerId}`, {
        withCredentials: true,
      });
      
      // Check if peer has no credits
      if (response.data.no_credits) {
        setPeerNoCredits(true);
        setPeerAvailability([]);
        return;
      }
      
      // Transform the availability data to match coaching format
      // Group by date with available time slots
      const availabilityByDate = {};
      (response.data.available_slots || []).forEach(slot => {
        if (!availabilityByDate[slot.date]) {
          availabilityByDate[slot.date] = {
            date: slot.date,
            slots: [],
            booked_slots: []
          };
        }
        availabilityByDate[slot.date].slots.push(slot.time);
      });
      setPeerAvailability(Object.values(availabilityByDate));
    } catch (error) {
      console.error('Failed to fetch peer availability:', error);
      setPeerAvailability([]);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleBookSession = async () => {
    if (!bookingDate || !bookingSlot || !sessionType) return;
    
    // Validate case type is selected if session type is Case session
    if (sessionType === 'Case session' && !caseType) {
      alert('Please select a case type for your case session.');
      return;
    }
    
    setBookingLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/book`, {
        partner_id: selectedPeer.id,
        date: bookingDate,
        time_slot: bookingSlot,
        session_type: sessionType,
        case_type: sessionType === 'Case session' ? caseType : null,
        notes: sessionNotes || null
      }, { withCredentials: true });
      
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      
      // Refresh session credits
      await refreshSessionCredits();
      
      setSelectedPeer(null);
      alert('Session booked successfully! Calendar invite sent to your email.');
      setActiveTab('my-sessions');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to book session');
    } finally {
      setBookingLoading(false);
    }
  };

  // Reschedule handlers
  const openRescheduleModal = async (session) => {
    setRescheduleSession(session);
    setRescheduleDate('');
    setRescheduleSlot('');
    setRescheduleAvailability([]);
    
    // Determine the OTHER person's ID (not the current user)
    // If current user is the requester, fetch partner's availability
    // If current user is the partner, fetch requester's availability
    const otherUserId = session.requester_id === user?.id 
      ? session.partner_id 
      : session.requester_id;
    
    // Fetch the other person's availability
    setRescheduleAvailabilityLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/availability/${otherUserId}`, {
        withCredentials: true,
      });
      // Transform the availability data to match booking format
      const availabilityByDate = {};
      (response.data.available_slots || []).forEach(slot => {
        if (!availabilityByDate[slot.date]) {
          availabilityByDate[slot.date] = {
            date: slot.date,
            slots: []
          };
        }
        availabilityByDate[slot.date].slots.push(slot.time);
      });
      setRescheduleAvailability(Object.values(availabilityByDate));
    } catch (error) {
      console.error('Failed to fetch partner availability:', error);
      setRescheduleAvailability([]);
    } finally {
      setRescheduleAvailabilityLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleSession || !rescheduleDate || !rescheduleSlot) return;
    
    setRescheduleLoading(true);
    try {
      await axios.put(`${BACKEND_URL}/api/peers/sessions/${rescheduleSession.id}/reschedule`, {
        date: rescheduleDate,
        time_slot: rescheduleSlot
      }, { withCredentials: true });
      
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      
      setRescheduleSession(null);
      alert('Reschedule request sent! Waiting for partner approval.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to reschedule');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleApproveReschedule = async (sessionId) => {
    setApprovingReschedule(sessionId);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/sessions/${sessionId}/approve-reschedule`, {}, { withCredentials: true });
      // Refresh sessions
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      alert('Reschedule approved! Session updated with new time.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to approve reschedule');
    } finally {
      setApprovingReschedule(null);
    }
  };

  const handleDeclineReschedule = async (sessionId) => {
    if (!window.confirm('Are you sure you want to decline this reschedule request? The session will keep the original time.')) {
      return;
    }
    setApprovingReschedule(sessionId);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/sessions/${sessionId}/decline-reschedule`, {}, { withCredentials: true });
      // Refresh sessions
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      alert('Reschedule declined. Session remains at original time.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to decline reschedule');
    } finally {
      setApprovingReschedule(null);
    }
  };

  // Cancel handler
  const handleCancelSession = async () => {
    if (!cancelSession) return;
    
    setCancelLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/peers/sessions/${cancelSession.id}`, { withCredentials: true });
      
      const sessionsRes = await axios.get(`${BACKEND_URL}/api/peers/my-sessions`, { withCredentials: true });
      setMySessions(sessionsRes.data);
      await refreshSessionCredits();
      
      setCancelSession(null);
      alert('Session cancelled successfully');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to cancel session');
    } finally {
      setCancelLoading(false);
    }
  };

  // Helper to convert numeric cases_done to range string
  const convertCasesToRange = (cases) => {
    if (typeof cases === 'string' && ['0-5', '5-10', '10-20', '20-30', '30+'].includes(cases)) {
      return cases;
    }
    const num = parseInt(cases) || 0;
    if (num >= 30) return '30+';
    if (num >= 20) return '20-30';
    if (num >= 10) return '10-20';
    if (num >= 5) return '5-10';
    return '0-5';
  };

  const handleToggleListing = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/peers/toggle-listing`, {}, { withCredentials: true });
      setMyProfile(prev => ({ ...prev, is_listed: response.data.is_listed }));
      
      const peersRes = await axios.get(`${BACKEND_URL}/api/peers/list`, { withCredentials: true });
      setPeers(peersRes.data);
      
      alert(response.data.message);
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      
      // Check if this is a profile completion error with missing fields
      if (errorDetail && typeof errorDetail === 'object' && errorDetail.missing_fields) {
        // Open the profile completion modal with missing fields highlighted
        setMissingFields(errorDetail.missing_fields);
        setProfileData(errorDetail.profile_data || {});
        setProfileCompletionOpen(true);
      } else {
        // Show generic error
        const message = typeof errorDetail === 'string' ? errorDetail : 
                        errorDetail?.message || 'Failed to update listing status';
        alert(message);
      }
    }
  };

  // Handler for when profile completion modal finishes successfully
  const handleProfileCompleted = () => {
    // Refresh the profile data
    fetchMyProfile();
    // Switch to the availability tab directly
    setActiveTab('availability');
  };

  // Availability handlers
  const handleSaveAvailability = async () => {
    // Validate availability before saving
    const validation = validateAvailability(editableAvailability);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    setAvailabilitySaving(true);
    try {
      const slots = convertWeeklyFormatToSlots(editableAvailability);
      
      await axios.post(`${BACKEND_URL}/api/peers/set-availability`, {
        slots: slots,
        max_sessions_per_day: maxSessionsPerDay,
        blocked_dates: blockedDays
      }, { withCredentials: true });
      
      setMyProfile(prev => ({
        ...prev,
        weekly_availability: slots,
        max_sessions_per_day: maxSessionsPerDay,
        blocked_dates: blockedDays
      }));
      
      // If user is not listed yet and has a picture, offer to list them
      const hasPicture = myProfile?.picture || myProfile?.profile_picture || user?.picture;
      if (!myProfile?.is_listed && hasPicture && slots.length > 0) {
        const shouldList = window.confirm('Availability saved! Would you like to make your profile visible now so other peers can find you?');
        if (shouldList) {
          try {
            const response = await axios.post(`${BACKEND_URL}/api/peers/toggle-listing`, {}, { withCredentials: true });
            setMyProfile(prev => ({ ...prev, is_listed: response.data.is_listed }));
            alert('Great! Your profile is now visible to other peers.');
          } catch (listError) {
            alert('Availability saved, but could not list profile. Please try the "Make Profile Visible" button.');
          }
        } else {
          alert('Availability saved! You can make your profile visible anytime using the button above.');
        }
      } else {
        alert('Availability saved successfully!');
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to save availability');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  // Calendar handlers
  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/peers/calendar/auth/start`, { withCredentials: true });
      if (response.data.authorization_url) {
        window.location.href = response.data.authorization_url;
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to start calendar connection');
      setConnectingCalendar(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/calendar/sync`, {}, { withCredentials: true });
      await fetchCalendarStatus();
      alert('Calendar synced successfully!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to sync calendar');
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Calendar?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/peers/calendar/disconnect`, { withCredentials: true });
      setCalendarStatus({
        connected: false,
        email: null,
        last_synced: null,
        loading: false
      });
      alert('Calendar disconnected successfully');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to disconnect calendar');
    }
  };

  // Calendar view helpers
  const navigateMonth = (direction) => {
    const newMonth = new Date(selectedCalendarMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setSelectedCalendarMonth(newMonth);
  };

  const toggleBlockedDay = (dateStr) => {
    setBlockedDays(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    );
  };

  const getCalendarDays = () => {
    const year = selectedCalendarMonth.getFullYear();
    const month = selectedCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      const dayIndex = (date.getDay() + 6) % 7; // Convert to Monday=0
      
      const hasAvailability = editableAvailability.some(a => a.day === dayName && a.slots?.length > 0);
      const isBlocked = blockedDays.includes(dateStr);
      const isPast = date < today;
      
      days.push({
        day: d,
        dateStr,
        dayName,
        hasAvailability,
        isBlocked,
        isPast
      });
    }
    
    return days;
  };

  // Loading state
  if (loading || !peerAccessChecked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Check if admin has revoked peer practice access
  const hasPeerAccessRevoked = dashboardData?.access?.peer_practice === false;
  const isAdminRestricted = dashboardData?.admin_restricted?.peer_practice === true;
  
  // No peer practice access view - based on admin override or plan's peer_to_peer feature
  // Also check if plan is expired (from sessionCredits response)
  const isPlanExpiredForPeerPractice = sessionCredits.plan_expired || false;
  
  // Only show full lock screen for admin restrictions or mentors
  // For expired plans, we keep the page browsable but disable booking/listing
  if (hasPeerAccessRevoked || sessionCredits.is_mentor) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            {isAdminRestricted ? "Access Restricted" : "Peer Practice Not Available"}
          </h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {isAdminRestricted 
              ? "Your access to Peer Practice has been restricted by admin. Please contact support."
              : "As a mentor, peer practice sessions are not available. You can conduct coaching sessions instead."}
          </p>
        </div>
      </div>
    );
  }
  
  // Check if user can book sessions (not expired and has access or has credits)
  const canBookPeerSessions = sessionCredits.has_access && !isPlanExpiredForPeerPractice;
  const canListProfile = sessionCredits.has_access && !isPlanExpiredForPeerPractice;

  // Handle setting up availability - creates profile from user data or updates existing
  const handleSetupAvailability = async () => {
    // Check if user has profile picture
    if (!user?.picture) {
      setIsPictureModalOpen(true);
      return;
    }
    
    setSettingUpAvailability(true);
    try {
      // Prepare profile data
      const profileData = {
        name: user?.name || '',
        university: user?.ug_college || user?.pg_college || '',
        firms_targeting: user?.target_firms || [],
        cases_done: '0-5',
        profile_picture: user?.picture || ''
      };
      
      // Check if profile already exists
      if (myProfile) {
        // Profile exists, use update endpoint
        const response = await axios.put(`${BACKEND_URL}/api/peers/update-profile`, profileData, { 
          withCredentials: true 
        });
        setMyProfile(response.data.profile);
      } else {
        // Try to create profile, if it already exists use update
        try {
          const response = await axios.post(`${BACKEND_URL}/api/peers/create-profile`, profileData, { 
            withCredentials: true 
          });
          setMyProfile(response.data.profile);
        } catch (createError) {
          // If profile already exists, use update endpoint
          if (createError.response?.data?.detail?.includes('already exists')) {
            const response = await axios.put(`${BACKEND_URL}/api/peers/update-profile`, profileData, { 
              withCredentials: true 
            });
            setMyProfile(response.data.profile);
          } else {
            throw createError;
          }
        }
      }
      
      setActiveTab('availability');
    } catch (error) {
      console.error('Failed to setup profile:', error);
      alert(error.response?.data?.detail || 'Failed to set up peer practice. Please try again.');
    } finally {
      setSettingUpAvailability(false);
    }
  };

  // Handle picture upload from modal then redirect to availability setup
  const handlePictureUploadAndContinue = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, etc.)');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }
    
    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await axios.post(`${BACKEND_URL}/api/profile/upload-picture`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }
      
      setIsPictureModalOpen(false);
      
      // If user already has a profile, update it and redirect to availability
      if (myProfile) {
        // Update peer profile picture
        await axios.put(`${BACKEND_URL}/api/peers/update-profile`, {
          ...myProfile,
          profile_picture: uploadResponse.data.picture_url
        }, { withCredentials: true });
        
        setMyProfile(prev => ({ ...prev, picture: uploadResponse.data.picture_url }));
        
        // Redirect to availability tab to set up availability
        setActiveTab('availability');
        
        // Show message to set up availability
        alert('Profile picture uploaded! Please set up your availability to get listed for peer practice.');
      } else {
        // No profile yet, continue with availability setup
        handleSetupAvailability();
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to upload picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  // Picture Upload Modal
  const renderPictureUploadModal = () => (
    <Dialog open={isPictureModalOpen} onOpenChange={setIsPictureModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            Upload Profile Picture
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4 border-2 border-dashed border-slate-300">
            <Camera className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-600 mb-2">
            Upload a profile picture to continue.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            After uploading, you&apos;ll be able to set up your availability and get listed for peer practice.
          </p>
          
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePictureUploadAndContinue}
            className="hidden"
            id="picture-upload-input"
          />
          <label htmlFor="picture-upload-input">
            <Button
              asChild
              disabled={uploadingPicture}
              className="bg-[#2E3558] hover:bg-[#363EA7] cursor-pointer"
            >
              <span>
                {uploadingPicture ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Photo
                  </>
                )}
              </span>
            </Button>
          </label>
          <p className="text-xs text-slate-500 mt-3">
            JPG, PNG or WebP, max 5MB
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  // No profile view - only show for users who have access and can set up
  // For expired users without profile, skip to the main view so they can browse peers
  if (!myProfile && !isPlanExpiredForPeerPractice) {
    return (
      <div className="space-y-6">
        <div className="card-3d-base rounded-2xl p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#DEE3FF] flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-[#2E3558]" />
          </div>
          <h2 className="text-2xl font-bold page-title-dark mb-3">Set Up Your Availability</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Configure your available time slots to connect with other candidates for 1.5-hour practice sessions.
          </p>
          <Button 
            onClick={handleSetupAvailability}
            disabled={settingUpAvailability}
            className="bg-[#2E3558] hover:bg-[#363EA7]"
            data-testid="setup-availability-btn"
          >
            {settingUpAvailability ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Setting Up...
              </>
            ) : (
              <>
                <Calendar className="w-5 h-5 mr-2" />
                Set Up Availability
              </>
            )}
          </Button>
        </div>
        
        {/* Picture Upload Modal */}
        {renderPictureUploadModal()}
      </div>
    );
  }

  // Main tabbed view
  return (
    <div className="space-y-6">
      
      {/* Instructions Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setInstructionsOpen(true)}
          variant="outline"
          size="sm"
          style={{ color: 'var(--gn-periwinkle)', borderColor: 'var(--gn-periwinkle-light)' }}
        >
          <FileText className="w-4 h-4 mr-2" />
          How Peer Sessions Work
        </Button>
      </div>
      
      {/* Profile Visibility Status Bar - Only show when user has a profile */}
      {myProfile && (
        <div className="card-3d-base rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {myProfile.is_listed ? (
                <>
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}></div>
                  <span className="text-sm font-medium card-header-dark">Your profile is currently live</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                  <span className="text-sm font-medium text-slate-500">Your profile is hidden from other users</span>
                </>
              )}
            </div>
            {/* Toggle Listing Button - greyed out with upgrade option for expired plans */}
            {!canListProfile ? (
              <div className="flex items-center gap-2">
                <Button 
                  disabled
                  variant="outline"
                  size="sm"
                  className="text-slate-400 border-slate-200 cursor-not-allowed"
                  data-testid="toggle-listing-btn"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  {isPlanExpiredForPeerPractice ? 'Plan Expired' : 'Upgrade Required'}
                </Button>
                <Button 
                  onClick={showUpgradeModal}
                  size="sm"
                  className="text-white"
                  style={{ backgroundColor: 'var(--gn-rhino)' }}
                  data-testid="upgrade-listing-btn"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {isPlanExpiredForPeerPractice ? 'Renew' : 'Upgrade'}
                </Button>
              </div>
            ) : (
              <Button 
                variant={myProfile.is_listed ? "outline" : "default"}
                size="sm" 
                onClick={handleToggleListing}
                className={myProfile.is_listed 
                  ? 'text-[#FFA601] border-[#FFD68A] hover:bg-[#FFE6B7]' 
                  : 'bg-[#2E3558] hover:bg-[#363EA7] text-white'}
                data-testid="toggle-listing-btn"
              >
                {myProfile.is_listed ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide Profile
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Make Profile Visible
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* No Profile Message for expired users */}
      {!myProfile && isPlanExpiredForPeerPractice && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">You haven&apos;t set up your peer profile yet</p>
              <p className="text-xs text-amber-600">Renew your plan to create your profile and start booking sessions</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="border-b border-slate-100">
          <div className="flex">
            {[
              { id: 'find-peers', label: 'Find Peers', icon: Users },
              { id: 'my-sessions', label: 'My Sessions', icon: Calendar },
              { id: 'availability', label: 'Availability', icon: Clock }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'my-sessions' && upcomingSessions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                    {upcomingSessions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Session Credits Banner */}
          {activeTab === 'find-peers' && (
            <>
              {!sessionCredits.has_access ? (
                /* No access - show upgrade banner */
                <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-[#DEE3FF] rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-[#2E3558]" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 text-lg">Unlock Peer Practice</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {sessionCredits.is_mentor 
                          ? "Mentors don't have access to peer practice sessions."
                          : "Upgrade to start practicing with other candidates and improve your case-solving skills together."}
                      </p>
                      {!sessionCredits.is_mentor && (
                        <Button 
                          className="mt-4 bg-[#2E3558] hover:bg-[#363EA7]"
                          onClick={showUpgradeModal}
                          data-testid="upgrade-for-peers-btn"
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          View Plans
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : sessionCredits.sessions_remaining === 0 && !sessionCredits.is_unlimited ? (
                /* Has access but no credits left this month - show upgrade banner */
                <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-[#FFE6B7] rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-[#FFA601]" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 text-lg">No Credits Left This Month</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Upgrade your plan to access more peer practice sessions.
                      </p>
                      <Button 
                        className="mt-4 bg-[#2E3558] hover:bg-[#363EA7]"
                        onClick={showUpgradeModal}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        View Plans
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Has access and has credits - show remaining sessions */
                <div className="mb-6 p-4 bg-[#DEE3FF] border border-[#B1BCFF] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#B1BCFF] flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#2E3558]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#2E3558]">Monthly Session Credits</p>
                        <p className="text-sm text-[#5961ED]">
                          {sessionCredits.is_unlimited 
                            ? "Unlimited sessions"
                            : `${sessionCredits.sessions_remaining} of ${sessionCredits.sessions_per_month || 0} credit${(sessionCredits.sessions_per_month || 0) !== 1 ? 's' : ''} remaining`}
                        </p>
                      </div>
                    </div>
                    {!sessionCredits.is_unlimited && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          Billing period: <span className="font-medium">{sessionCredits.billing_start ? new Date(sessionCredits.billing_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - {sessionCredits.billing_end ? new Date(sessionCredits.billing_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Resets: <span className="font-medium text-green-600">{sessionCredits.next_reset ? new Date(sessionCredits.next_reset + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Next month'}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  {!sessionCredits.is_unlimited && sessionCredits.sessions_remaining === 0 && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>No credits left this month.</strong> Your credits will reset on {sessionCredits.next_reset ? new Date(sessionCredits.next_reset + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'next month'}. You cannot book new sessions until then.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Find Peers Tab */}
          {activeTab === 'find-peers' && (
            <div className="space-y-6">
              {/* Search */}
              <div className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or university..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="peer-search-input"
                  />
                </div>
              </div>

              {/* Filters & Sort Section */}
              <div className="flex flex-wrap gap-6 items-start">
                {/* Filters Group */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Filters</span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <Select value={filterPlanCategory} onValueChange={setFilterPlanCategory}>
                      <SelectTrigger className="w-[140px] bg-white" data-testid="filter-plan-category">
                        <SelectValue placeholder="All Plans" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Plans</SelectItem>
                        <SelectItem value="Subscription">Subscription</SelectItem>
                        <SelectItem value="Coaching">Coaching</SelectItem>
                        <SelectItem value="Cohort">Cohort</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterUniversity} onValueChange={setFilterUniversity}>
                      <SelectTrigger className="w-[160px] bg-white" data-testid="filter-university">
                        <SelectValue placeholder="All Universities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Universities</SelectItem>
                        {uniqueUniversities.map(uni => (
                          <SelectItem key={uni} value={uni}>{uni}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterRating} onValueChange={setFilterRating}>
                      <SelectTrigger className="w-[130px] bg-white" data-testid="filter-rating">
                        <SelectValue placeholder="All Ratings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Ratings</SelectItem>
                        <SelectItem value="5">5 Stars</SelectItem>
                        <SelectItem value="4">4+ Stars</SelectItem>
                        <SelectItem value="3">3+ Stars</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStage} onValueChange={setFilterStage}>
                      <SelectTrigger className="w-[130px] bg-white" data-testid="filter-stage">
                        <SelectValue placeholder="All Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Time Slot Filter Toggle */}
                    <Button 
                      variant={showTimeFilter ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setShowTimeFilter(!showTimeFilter)}
                      className={showTimeFilter ? "bg-blue-600 hover:bg-blue-700" : ""}
                      data-testid="peer-time-filter-toggle"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Time Slot
                      {timeFilteredPeerIds !== null && (
                        <span className="ml-1 px-1.5 py-0.5 bg-white text-blue-600 rounded-full text-xs font-bold">
                          {timeFilteredPeerIds.size}
                        </span>
                      )}
                    </Button>
                  </div>
                  
                  {/* Time Slot Filter Panel */}
                  {showTimeFilter && (
                    <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Filter by Available Time Slot</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">From Date</label>
                          <Input
                            type="date"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="bg-white"
                            data-testid="peer-filter-from-date"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">From Time</label>
                          <Input
                            type="time"
                            value={filterFromTime}
                            onChange={(e) => setFilterFromTime(e.target.value)}
                            className="bg-white"
                            data-testid="peer-filter-from-time"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">To Date</label>
                          <Input
                            type="date"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                            min={filterFromDate || new Date().toISOString().split('T')[0]}
                            className="bg-white"
                            data-testid="peer-filter-to-date"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">To Time</label>
                          <Input
                            type="time"
                            value={filterToTime}
                            onChange={(e) => setFilterToTime(e.target.value)}
                            className="bg-white"
                            data-testid="peer-filter-to-time"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          onClick={applyPeerTimeSlotFilter}
                          disabled={timeFilterLoading || !filterFromDate || !filterFromTime || !filterToDate || !filterToTime}
                          className="bg-blue-600 hover:bg-blue-700"
                          data-testid="apply-peer-time-filter"
                        >
                          {timeFilterLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4 mr-1" />
                              Apply Filter
                            </>
                          )}
                        </Button>
                        {timeFilteredPeerIds !== null && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={clearPeerTimeSlotFilter}
                            data-testid="clear-peer-time-filter"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>
                      {timeFilteredPeerIds !== null && (
                        <p className="text-xs text-blue-700 mt-2">
                          Found {timeFilteredPeerIds.size} peer{timeFilteredPeerIds.size !== 1 ? 's' : ''} available in this time window
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Sort Group */}
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-4 h-4 text-blue-500 rotate-90" />
                    <span className="text-sm font-medium text-slate-700">Sort By</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full bg-white border-blue-200" data-testid="sort-by">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="earliest">Earliest Availability</SelectItem>
                        <SelectItem value="rating">Highest Rating</SelectItem>
                        <SelectItem value="sessions">Most Sessions Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Peer Cards */}
              {sortedPeers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No peers found matching your filters</p>
                </div>
              ) : (
                <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedPeers.map((peer) => (
                    <div 
                      key={peer.id} 
                      className="card-3d-base rounded-xl p-6 cursor-pointer flex flex-col h-full relative" 
                      data-testid={`peer-card-${peer.id}`}
                    >
                      {/* Top right: LinkedIn logo only */}
                      {peer.linkedin_url && (
                        <div className="absolute top-4 right-4">
                          <a 
                            href={peer.linkedin_url.startsWith('http') ? peer.linkedin_url : `https://${peer.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View LinkedIn Profile"
                            data-testid={`peer-linkedin-${peer.id}`}
                          >
                            <img 
                              src={LINKEDIN_LOGO_URL}
                              alt="LinkedIn"
                              className="h-5 w-5 object-contain"
                            />
                          </a>
                        </div>
                      )}

                      <div className="flex items-start gap-4 mb-4">
                        <img 
                          src={peer.picture} 
                          alt={peer.name} 
                          className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" 
                        />
                        <div className={`flex-1 ${peer.linkedin_url ? 'pr-10' : ''}`}>
                          <h3 className="font-semibold text-slate-900">{peer.name}</h3>
                          {/* Colleges - UG, PG on same line */}
                          {(peer.ug_college || peer.pg_college || peer.university) && (
                            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                              <GraduationCap className="w-4 h-4 flex-shrink-0" />
                              <span>
                                {peer.ug_college && peer.pg_college && !peer.no_pg
                                  ? `${peer.ug_college}, ${peer.pg_college}${peer.pg_incoming ? ' (Incoming)' : ''}`
                                  : peer.pg_college && !peer.no_pg
                                    ? `${peer.pg_college}${peer.pg_incoming ? ' (Incoming)' : ''}`
                                    : peer.ug_college || peer.university
                                }
                              </span>
                            </div>
                          )}
                          {/* Location */}
                          {peer.location && (
                            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              <span>{peer.location}</span>
                            </div>
                          )}
                          {/* Years of Experience */}
                          {peer.years_of_experience > 0 && (
                            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                              <Briefcase className="w-4 h-4 flex-shrink-0" />
                              <span>{peer.years_of_experience} {peer.years_of_experience === 1 ? 'year' : 'years'} experience</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            {/* Plan Category Tag */}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              peer.plan_category === 'Coaching' ? 'bg-purple-100 text-purple-700' :
                              peer.plan_category === 'Cohort' ? 'bg-amber-100 text-amber-700' :
                              peer.plan_category === 'Subscription' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-200 text-slate-600'
                            }`}>
                              {peer.plan_category}
                            </span>
                            {/* Plan Name Tag */}
                            {peer.plan_name && peer.plan_name !== peer.plan_category && peer.plan_name !== 'Free Trial' && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                                {peer.plan_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Rating and Sessions Stats */}
                      <div className="flex items-center gap-4 text-sm mb-3">
                        {/* Average Rating */}
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-slate-700 font-medium">
                            {peer.peer_rating !== null && peer.peer_rating !== undefined 
                              ? peer.peer_rating.toFixed(1)
                              : 'N/A'}
                          </span>
                          <span className="text-slate-500 text-xs ml-0.5">avg</span>
                        </div>
                        {/* Total Completed Sessions */}
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700 font-medium">{peer.peer_sessions_done || 0}</span>
                          <span className="text-slate-500 text-xs ml-0.5">sessions</span>
                        </div>
                      </div>

                      {/* Earliest Availability - use from API response */}
                      <div className="flex items-center gap-2 text-sm mb-3">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        {peer.earliest_slot ? (
                          <span className="text-emerald-600 font-medium">
                            Next: {new Date(peer.earliest_slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {format12hWithAbbr(istToViewer(peer.earliest_slot.date, peer.earliest_slot.time, user?.timezone || 'Asia/Kolkata').time, user?.timezone || 'Asia/Kolkata')}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No availability set</span>
                        )}
                      </div>

                      {/* Preparation Level Tag */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          peer.preparation_stage === 'advanced' ? 'bg-emerald-50 text-emerald-700' :
                          peer.preparation_stage === 'intermediate' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {peer.preparation_stage ? peer.preparation_stage.charAt(0).toUpperCase() + peer.preparation_stage.slice(1) : 'Beginner'}
                        </span>
                      </div>

                      {/* Spacer to push button to bottom */}
                      <div className="flex-grow"></div>

                      {/* Book Session Button - greyed out with upgrade option for expired plans */}
                      {!canBookPeerSessions ? (
                        <div className="w-full space-y-2 mt-auto">
                          <Button 
                            disabled
                            className="w-full bg-slate-300 text-slate-500 cursor-not-allowed"
                            data-testid={`book-peer-${peer.id}`}
                          >
                            <Calendar className="w-4 h-4 mr-2" /> 
                            {isPlanExpiredForPeerPractice ? 'Plan Expired' : 'Upgrade to Book'}
                          </Button>
                          <Button 
                            onClick={showUpgradeModal}
                            variant="outline"
                            className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                            data-testid={`upgrade-peer-${peer.id}`}
                          >
                            <ArrowRight className="w-4 h-4 mr-2" /> 
                            {isPlanExpiredForPeerPractice ? 'Renew Plan' : 'Upgrade'}
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => openBookingModal(peer)} 
                          disabled={!sessionCredits.is_unlimited && sessionCredits.sessions_remaining <= 0}
                          className="w-full bg-[#2E3558] hover:bg-[#363EA7] text-white mt-auto"
                          data-testid={`book-peer-${peer.id}`}
                        >
                          <Calendar className="w-4 h-4 mr-2" /> 
                          {(!sessionCredits.is_unlimited && sessionCredits.sessions_remaining <= 0)
                            ? 'No Credits Left'
                            : 'Book Session'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                      Showing {((currentPage - 1) * PEERS_PER_PAGE) + 1}-{Math.min(currentPage * PEERS_PER_PAGE, sortedPeers.length)} of {sortedPeers.length} peers
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-slate-600 px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          )}

          {/* My Sessions Tab */}
          {activeTab === 'my-sessions' && (
            <div className="space-y-6">
              {/* Upcoming Sessions */}
              <div>
                <h3 className="text-lg font-semibold page-title-dark mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Upcoming Sessions
                  {upcomingSessions.length > 0 && (
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{upcomingSessions.length}</span>
                  )}
                  {pendingRequests.length > 0 && (
                    <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingRequests.length} pending</span>
                  )}
                </h3>
                
                {upcomingSessions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No upcoming sessions</p>
                    <Button variant="link" onClick={() => setActiveTab('find-peers')} className="mt-2">
                      Find practice partners
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingSessions.map(session => {
                      // Determine the OTHER person's details based on who's viewing
                      const isRequester = session.requester_id === user?.id;
                      const otherPersonName = isRequester ? session.partner_name : session.requester_name;
                      const otherPersonPicture = isRequester ? session.partner_picture : session.requester_picture;
                      const otherPersonId = isRequester ? session.partner_id : session.requester_id;
                      
                      return (
                      <div key={session.id} className={`rounded-lg p-4 ${
                        session.status === 'pending' 
                          ? 'bg-amber-50/50 border border-amber-200' 
                          : session.status === 'reschedule_pending'
                            ? 'bg-purple-50/50 border border-purple-200'
                            : 'bg-blue-50/50 border border-blue-100'
                      }`} data-testid={`session-${session.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <img 
                              src={otherPersonPicture || `https://ui-avatars.com/api/?name=${otherPersonName}&background=random`}
                              alt={otherPersonName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-slate-900">{otherPersonName}</h4>
                                {session.status === 'pending' && (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                                    {!isRequester ? 'Needs Your Approval' : 'Awaiting Response'}
                                  </span>
                                )}
                                {session.status === 'reschedule_pending' && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                                    {session.reschedule_requested_by === user?.id ? 'Reschedule Awaiting Response' : 'Reschedule Needs Your Approval'}
                                  </span>
                                )}
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {session.session_type || 'General'}
                                </span>
                                {session.case_type && (
                                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                    {session.case_type}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                                <Calendar className="w-4 h-4" />
                                <span>{session.date} at {format12hWithAbbr(istToViewer(session.date, session.time_slot, user?.timezone || 'Asia/Kolkata').time, user?.timezone || 'Asia/Kolkata')}</span>
                                <span className="text-xs text-slate-400">(1.5 hrs)</span>
                              </div>
                              {/* Show proposed reschedule time if pending */}
                              {session.status === 'reschedule_pending' && session.proposed_date && (
                                <div className="flex items-center gap-2 text-sm text-purple-600 mt-1">
                                  <RefreshCw className="w-4 h-4" />
                                  <span>Proposed: {session.proposed_date} at {format12hWithAbbr(istToViewer(session.proposed_date, session.proposed_time_slot, user?.timezone || 'Asia/Kolkata').time, user?.timezone || 'Asia/Kolkata')}</span>
                                </div>
                              )}
                              {session.was_rescheduled && session.status !== 'reschedule_pending' && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-1">
                                  <RefreshCw className="w-3 h-3" /> Rescheduled
                                </span>
                              )}
                              {session.requester_notes && (
                                <p className="text-xs text-slate-500 mt-1 italic">&quot;{session.requester_notes}&quot;</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Approve/Decline buttons for pending sessions where user is the partner */}
                            {session.status === 'pending' && session.partner_id === user?.id ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveSession(session.id)}
                                  disabled={approvingSession === session.id}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  data-testid={`approve-session-${session.id}`}
                                >
                                  {approvingSession === session.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeclineSession(session.id)}
                                  disabled={approvingSession === session.id}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  data-testid={`decline-session-${session.id}`}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Decline
                                </Button>
                              </>
                            ) : session.status === 'pending' ? (
                              // Requester sees waiting status with cancel option
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
                                  Waiting for approval...
                                </span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => setCancelSession(session)}
                                  className="text-red-600"
                                  data-testid={`cancel-pending-${session.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : session.status === 'reschedule_pending' && session.reschedule_requested_by !== user?.id ? (
                              // User needs to approve/decline reschedule (they didn't request it)
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveReschedule(session.id)}
                                  disabled={approvingReschedule === session.id}
                                  className="bg-purple-600 hover:bg-purple-700 text-white"
                                  data-testid={`approve-reschedule-${session.id}`}
                                >
                                  {approvingReschedule === session.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                  )}
                                  Approve Reschedule
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeclineReschedule(session.id)}
                                  disabled={approvingReschedule === session.id}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  data-testid={`decline-reschedule-${session.id}`}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Decline
                                </Button>
                              </>
                            ) : session.status === 'reschedule_pending' ? (
                              // User requested reschedule - waiting for partner's response
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full">
                                  Waiting for reschedule approval...
                                </span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => setCancelSession(session)}
                                  className="text-red-600"
                                  data-testid={`cancel-reschedule-session-${session.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              // Confirmed sessions - show join button and other actions
                              <>
                                {/* Join Button with Timer */}
                                {!needsFeedback(session) && !session.feedback_submitted && (
                                  <div className="flex flex-col items-center">
                                    <Button
                                      size="sm"
                                      onClick={() => handleJoinSession(session)}
                                      disabled={!isSessionJoinable(session) || joiningSession === session.id}
                                      className={isSessionJoinable(session) 
                                        ? "bg-green-600 hover:bg-green-700 text-white" 
                                        : "bg-slate-300 text-slate-500 cursor-not-allowed"
                                      }
                                      data-testid={`join-session-${session.id}`}
                                    >
                                      {joiningSession === session.id ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <ExternalLink className="w-4 h-4 mr-1" />
                                      )}
                                      {isSessionJoinable(session) ? 'Join Now' : 'Join'}
                                    </Button>
                                    {!isSessionJoinable(session) && getTimeUntilJoinable(session) && (
                                      <span className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Live in {getTimeUntilJoinable(session)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Feedback Button - show after session time */}
                                {needsFeedback(session) && (
                                  <Button
                                    size="sm"
                                    onClick={() => openFeedbackModal(session)}
                                    className="bg-amber-500 hover:bg-amber-600 text-white"
                                    data-testid={`feedback-session-${session.id}`}
                                  >
                                    <Star className="w-4 h-4 mr-1" />
                                    Rate Session
                                  </Button>
                                )}
                                
                                {/* Feedback Submitted */}
                                {session.feedback_submitted && (
                                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Rated
                                  </span>
                                )}
                                
                                {/* View Feedback button if partner gave feedback */}
                                {session.partner_feedback_received && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleViewFeedback(session)}
                                    className="text-blue-600 border-blue-200"
                                    data-testid={`view-feedback-${session.id}`}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View Feedback
                                  </Button>
                                )}
                                
                                {/* Always show reschedule and cancel buttons */}
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => openRescheduleModal(session)}
                                  className="text-amber-600"
                                  data-testid={`reschedule-session-${session.id}`}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => setCancelSession(session)}
                                  className="text-red-600"
                                  data-testid={`cancel-session-${session.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>

              {/* Past Sessions */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Past Sessions
                </h3>
                
                {pastSessions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No past sessions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastSessions.map(session => {
                      // Determine the OTHER person's details based on who's viewing
                      const isRequester = session.requester_id === user?.id;
                      const otherPersonName = isRequester ? session.partner_name : session.requester_name;
                      const otherPersonPicture = isRequester ? session.partner_picture : session.requester_picture;
                      
                      return (
                      <div key={session.id} className={`border rounded-lg p-4 ${isSessionTerminal(session.status) ? 'bg-slate-50 opacity-60' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <img 
                              src={otherPersonPicture || `https://ui-avatars.com/api/?name=${otherPersonName}&background=random`}
                              alt={otherPersonName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-slate-900">{otherPersonName}</h4>
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  {session.session_type || 'General'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                <Calendar className="w-4 h-4" />
                                <span>{session.date} at {format12hWithAbbr(istToViewer(session.date, session.time_slot, user?.timezone || 'Asia/Kolkata').time, user?.timezone || 'Asia/Kolkata')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isSessionTerminal(session.status) ? (
                              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">{session.status?.replace(/_/g, ' ')}</span>
                            ) : session.feedback_submitted ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Rated
                              </span>
                            ) : isSessionPastJoinWindow(session) ? (
                              <Button
                                size="sm"
                                onClick={() => openFeedbackModal(session)}
                                className="bg-[#2E3558] hover:bg-[#363EA7] text-white"
                                data-testid={`feedback-session-${session.id}`}
                              >
                                <FileText className="w-4 h-4 mr-1" /> Rate
                              </Button>
                            ) : null}
                            
                            {/* View Feedback button - shows if partner submitted feedback about you */}
                            {session.partner_feedback_received && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleViewFeedback(session)}
                                className="text-blue-600 border-blue-200"
                                data-testid={`view-feedback-past-${session.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View Feedback
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Availability Tab */}
          {activeTab === 'availability' && (
            <div className="space-y-6">
              {/* Google Calendar Integration */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      calendarStatus.connected ? 'bg-emerald-100' : 'bg-slate-200'
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
                        <Button variant="outline" size="sm" onClick={handleSyncCalendar} disabled={syncingCalendar} data-testid="sync-calendar-btn">
                          <RefreshCw className={`w-4 h-4 ${syncingCalendar ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDisconnectCalendar} className="text-red-600 border-red-200" data-testid="disconnect-calendar-btn">
                          <Link2Off className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={handleConnectCalendar} disabled={connectingCalendar} className="bg-gradient-to-r from-blue-600 to-cyan-500" data-testid="connect-calendar-btn">
                        {connectingCalendar ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Connect'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Weekly Schedule & Settings */}
                <div className="space-y-6">
                  {/* Weekly Schedule */}
                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-slate-900">Weekly Schedule</h2>
                      <p className="text-xs text-slate-500">Set your recurring availability for 1.5-hour sessions</p>
                    </div>
                    <WeeklyAvailabilitySelector
                      availability={editableAvailability}
                      onChange={setEditableAvailability}
                      showWeeklyTemplate={true}
                    />
                  </div>

                  {/* Session Settings */}
                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings2 className="w-5 h-5 text-slate-600" />
                      <h2 className="text-lg font-semibold text-slate-900">Session Settings</h2>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Max Sessions Per Day</label>
                      <p className="text-xs text-slate-500 mb-2">Limit the number of peer sessions in a single day</p>
                      <Select value={maxSessionsPerDay.toString()} onValueChange={(v) => setMaxSessionsPerDay(parseInt(v))}>
                        <SelectTrigger data-testid="max-sessions-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} session{n > 1 ? 's' : ''} per day</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Timezone Indicator */}
                  <div className="p-3 bg-blue-50 rounded-lg mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700">
                        Your timezone: <strong>{getTimezoneAbbr(user?.timezone || 'Asia/Kolkata')}</strong>
                      </span>
                    </div>
                    <span className="text-xs text-blue-500">
                      All times shown in your local timezone
                    </span>
                  </div>

                  {/* Save Button */}
                  <Button onClick={handleSaveAvailability} disabled={availabilitySaving} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500" data-testid="save-availability-btn">
                    {availabilitySaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
                      <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)} data-testid="prev-month-btn">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
                        {selectedCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => navigateMonth(1)} data-testid="next-month-btn">
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
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">{day}</div>
                    ))}
                    
                    {getCalendarDays().map((day, idx) => (
                      <div key={idx} className="aspect-square">
                        {day ? (
                          <button
                            onClick={() => !day.isPast && toggleBlockedDay(day.dateStr)}
                            disabled={day.isPast}
                            className={`w-full h-full rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
                              day.isPast ? 'bg-slate-50 text-slate-300 cursor-not-allowed' :
                              day.isBlocked ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                              day.hasAvailability ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                              'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            data-testid={`calendar-day-${day.dateStr}`}
                          >
                            {day.day}
                          </button>
                        ) : (
                          <div className="w-full h-full"></div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 mt-4 text-center">Click on a day to block/unblock it</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal - Same UI as Coaching */}
      <Dialog open={!!selectedPeer} onOpenChange={() => setSelectedPeer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Book Session with {selectedPeer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Timezone Indicator */}
            <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">
                Times shown in <strong>{getTimezoneAbbr(user?.timezone || 'Asia/Kolkata')}</strong>
              </span>
            </div>
            
            {availabilityLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <span className="text-slate-600 block">Loading availability...</span>
                  <span className="text-xs text-slate-400">Checking partner&apos;s calendar</span>
                </div>
              </div>
            ) : peerAvailability.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-slate-600 text-center">
                <p>No availability found for this peer.</p>
                <p className="text-sm mt-1">They may not have set their availability yet.</p>
              </div>
            ) : (
              <>
                {/* Session Info */}
                <div className="p-3 bg-blue-50 rounded-lg text-blue-800 text-sm">
                  <p className="font-medium">1.5-hour peer practice session</p>
                  <p className="text-xs mt-1">Practice cases together and give each other feedback</p>
                </div>

                {/* Session Type Selection */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Session Type <span className="text-red-500">*</span></label>
                  <Select value={sessionType} onValueChange={setSessionType}>
                    <SelectTrigger data-testid="session-type-select">
                      <SelectValue placeholder="Select session type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Case session">Case Session</SelectItem>
                      <SelectItem value="Fit Interview">Fit Interview</SelectItem>
                      <SelectItem value="PEI session">PEI Session</SelectItem>
                      <SelectItem value="General discussion">General Discussion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Case Type Selection - only shown for Case sessions */}
                {sessionType === 'Case session' && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Case Type <span className="text-red-500">*</span></label>
                    <Select value={caseType} onValueChange={setCaseType}>
                      <SelectTrigger data-testid="case-type-select">
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
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Additional Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Additional Comments (Optional)</label>
                  <Textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Any specific topics, areas of focus, or preparation you'd like to cover..."
                    className="min-h-[60px]"
                    data-testid="session-notes-input"
                  />
                </div>

                {/* Date and Time Selection - Side by Side Layout */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Dates on Left */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-2">Select Date</label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {peerAvailability.length > 0 ? (
                          peerAvailability.map((slot) => (
                            <button
                              key={slot.date}
                              onClick={() => { setBookingDate(slot.date); setBookingSlot(null); }}
                              className={`p-1.5 text-xs rounded-lg border transition-colors ${
                                bookingDate === slot.date
                                  ? 'bg-[#2E3558] text-white border-[#2E3558]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#B1BCFF]'
                              }`}
                              data-testid={`date-${slot.date}`}
                            >
                              {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 col-span-2 text-center py-2">No dates available</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Time Slots on Right */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-2">Select Time (24h)</label>
                      {bookingDate ? (
                        <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {peerAvailability
                            .find(a => a.date === bookingDate)
                            ?.slots
                            ?.filter((time) => {
                              // Filter out past times for today
                              const now = new Date();
                              const today = now.toISOString().split('T')[0];
                              if (bookingDate !== today) return true;
                              
                              // For today, filter out times that have passed
                              const [hours, minutes] = time.split(':').map(Number);
                              const slotMinutes = hours * 60 + minutes;
                              const currentMinutes = now.getHours() * 60 + now.getMinutes();
                              return slotMinutes > currentMinutes;
                            })
                            ?.map((time) => {
                              const viewerTz = user?.timezone || 'Asia/Kolkata';
                              const conv = istToViewer(bookingDate, time, viewerTz);
                              const display = format12hWithAbbr(conv.time, viewerTz);
                              return (
                                <button
                                  key={time}
                                  onClick={() => setBookingSlot(time)}
                                  title={`Stored as ${time} IST`}
                                  className={`p-1.5 text-xs rounded-lg border transition-colors ${
                                    bookingSlot === time
                                      ? 'bg-[#2E3558] text-white border-[#2E3558]'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-[#B1BCFF]'
                                  }`}
                                  data-testid={`time-${time}`}
                                >
                                  {display}
                                </button>
                              );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Select a date first</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedPeer(null)}>Cancel</Button>
                  <Button 
                    onClick={handleBookSession} 
                    disabled={!bookingDate || !bookingSlot || !sessionType || (sessionType === 'Case session' && !caseType) || bookingLoading}
                    className="bg-[#2E3558] hover:bg-[#363EA7]"
                    data-testid="confirm-booking-btn"
                  >
                    {bookingLoading ? 'Booking...' : 'Book Session (1.5 hrs)'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal - Dynamic feedback form based on session type */}
      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Feedback for Partner</DialogTitle>
          </DialogHeader>
          {feedbackSession && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  Feedback for <strong>{
                    feedbackSession.requester_id === user?.id 
                      ? feedbackSession.partner_name 
                      : feedbackSession.requester_name
                  }</strong>
                </p>
                <p className="text-sm text-slate-500">
                  {feedbackSession.date} at {feedbackSession.time_slot}
                </p>
              </div>

              {/* Session Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Session Type <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={peerFeedback.session_type} 
                  onValueChange={(v) => setPeerFeedback({
                    ...peerFeedback, 
                    session_type: v, 
                    case_type: v !== 'Case session' ? '' : peerFeedback.case_type,
                    ratings: {},
                    areas_of_strength: [],
                    areas_of_improvement: []
                  })}
                >
                  <SelectTrigger data-testid="feedback-session-type">
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Case Type - Only show for Case sessions */}
              {peerFeedback.session_type === 'Case session' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Case Type <span className="text-red-500">*</span>
                  </label>
                  <Select 
                    value={peerFeedback.case_type} 
                    onValueChange={(v) => setPeerFeedback(f => ({ ...f, case_type: v }))}
                  >
                    <SelectTrigger data-testid="feedback-case-type">
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
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic Ratings based on Session Type */}
              {peerFeedback.session_type && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">
                    Performance Ratings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getPeerRatingConfig(peerFeedback.session_type).map((ratingItem) => (
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
                                  setPeerFeedback(f => ({...f, rating_overall: n}));
                                } else {
                                  setPeerFeedback(f => ({
                                    ...f, 
                                    ratings: {...f.ratings, [ratingItem.key]: n}
                                  }));
                                }
                              }}
                              className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                                (ratingItem.isOverall ? peerFeedback.rating_overall : peerFeedback.ratings[ratingItem.key]) >= n
                                  ? ratingItem.isOverall 
                                    ? 'bg-[#2E3558] border-[#2E3558] text-white'
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
              {peerFeedback.session_type && getPeerAreasConfig(peerFeedback.session_type).hasAreas && (
                <>
                  {/* Areas of Strength - Multi-select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Areas of Strength <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {getPeerAreasConfig(peerFeedback.session_type).options.map((area) => {
                        const isSelected = peerFeedback.areas_of_strength.includes(area);
                        const isDisabled = peerFeedback.areas_of_improvement.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              const current = peerFeedback.areas_of_strength;
                              if (current.includes(area)) {
                                setPeerFeedback(f => ({...f, areas_of_strength: current.filter(a => a !== area)}));
                              } else {
                                setPeerFeedback(f => ({...f, areas_of_strength: [...current, area]}));
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
                    {peerFeedback.areas_of_strength.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Select at least one strength</p>
                    )}
                  </div>

                  {/* Areas of Improvement - Multi-select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Areas of Improvement <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {getPeerAreasConfig(peerFeedback.session_type).options.map((area) => {
                        const isSelected = peerFeedback.areas_of_improvement.includes(area);
                        const isDisabled = peerFeedback.areas_of_strength.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              const current = peerFeedback.areas_of_improvement;
                              if (current.includes(area)) {
                                setPeerFeedback(f => ({...f, areas_of_improvement: current.filter(a => a !== area)}));
                              } else {
                                setPeerFeedback(f => ({...f, areas_of_improvement: [...current, area]}));
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
                    {peerFeedback.areas_of_improvement.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Select at least one area to improve</p>
                    )}
                  </div>
                </>
              )}

              {/* Qualitative Feedback */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Feedback & Next Steps (Optional)
                </label>
                <Textarea
                  value={peerFeedback.qualitative_feedback}
                  onChange={(e) => setPeerFeedback(f => ({ ...f, qualitative_feedback: e.target.value }))}
                  placeholder="Any additional feedback, areas of improvement, or suggested next steps..."
                  rows={4}
                  data-testid="feedback-qualitative"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={
                submittingFeedback || 
                !peerFeedback.session_type || 
                !peerFeedback.rating_overall ||
                (getPeerAreasConfig(peerFeedback.session_type).hasAreas && peerFeedback.areas_of_strength.length === 0) ||
                (getPeerAreasConfig(peerFeedback.session_type).hasAreas && peerFeedback.areas_of_improvement.length === 0) ||
                (peerFeedback.session_type === 'Case session' && !peerFeedback.case_type)
              }
              className="bg-[#2E3558] hover:bg-[#363EA7]"
              data-testid="submit-feedback"
            >
              {submittingFeedback && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Feedback Modal - See what your partner said about you (mentor-style) */}
      <Dialog open={viewFeedbackOpen} onOpenChange={setViewFeedbackOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Feedback from {viewingFeedback?.feedback_from}
            </DialogTitle>
          </DialogHeader>
          {viewingFeedback?.has_feedback ? (
            <div className="space-y-4 mt-4">
              {/* Session Info */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">
                  Session: {viewingFeedback.session_date} at {viewingFeedback.session_time}
                </p>
                {viewingFeedback.feedback?.case_type && (
                  <p className="text-sm text-slate-600 mt-1">
                    Case Type: <strong>{viewingFeedback.feedback.case_type}</strong>
                  </p>
                )}
              </div>

              {/* Ratings Grid */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg space-y-3">
                {/* Scoping Questions */}
                {viewingFeedback.feedback?.rating_scoping_questions && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Scoping Questions</span>
                    <div className="flex">{renderStars(viewingFeedback.feedback.rating_scoping_questions)}</div>
                  </div>
                )}
                
                {/* Case Structure */}
                {viewingFeedback.feedback?.rating_case_structure && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Case Setup & Structure</span>
                    <div className="flex">{renderStars(viewingFeedback.feedback.rating_case_structure)}</div>
                  </div>
                )}
                
                {/* Quantitative */}
                {viewingFeedback.feedback?.quantitative_tested !== false && viewingFeedback.feedback?.rating_quantitative && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Quantitative Ability</span>
                    <div className="flex">{renderStars(viewingFeedback.feedback.rating_quantitative)}</div>
                  </div>
                )}
                {viewingFeedback.feedback?.quantitative_tested === false && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Quantitative Ability</span>
                    <span className="text-xs text-slate-400 italic">Not Tested</span>
                  </div>
                )}
                
                {/* Communication */}
                {viewingFeedback.feedback?.rating_communication && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Communication & Confidence</span>
                    <div className="flex">{renderStars(viewingFeedback.feedback.rating_communication)}</div>
                  </div>
                )}
                
                {/* Business Acumen */}
                {viewingFeedback.feedback?.rating_business_acumen && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Business Acumen & Creativity</span>
                    <div className="flex">{renderStars(viewingFeedback.feedback.rating_business_acumen)}</div>
                  </div>
                )}
                
                {/* Overall Rating */}
                <div className="flex justify-between items-center pt-2 border-t border-blue-100">
                  <span className="text-sm font-medium text-slate-700">Overall Rating</span>
                  <div className="flex">{renderStars(viewingFeedback.feedback?.rating_overall || 5)}</div>
                </div>
                
                {/* Average Rating */}
                {viewingFeedback.feedback?.average_rating && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Average Score</span>
                    <span className="text-sm font-semibold text-blue-600">{viewingFeedback.feedback.average_rating}/5</span>
                  </div>
                )}
              </div>
              
              {/* Qualitative Feedback */}
              {viewingFeedback.feedback?.qualitative_feedback && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 mb-1">Additional Feedback:</p>
                  <p className="text-sm text-slate-600">{viewingFeedback.feedback.qualitative_feedback}</p>
                </div>
              )}
              
              {/* Legacy comment field for old feedback */}
              {viewingFeedback.feedback?.comment && !viewingFeedback.feedback?.qualitative_feedback && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 italic">&quot;{viewingFeedback.feedback.comment}&quot;</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">Your partner has not submitted feedback yet</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewFeedbackOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal - Shows partner's availability */}
      <Dialog open={!!rescheduleSession} onOpenChange={() => setRescheduleSession(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule Session with {
              rescheduleSession?.requester_id === user?.id 
                ? rescheduleSession?.partner_name 
                : rescheduleSession?.requester_name
            }</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Current session info */}
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <p className="text-slate-600">
                Current: <strong>{rescheduleSession?.date}</strong> at <strong>{rescheduleSession?.time_slot}</strong>
              </p>
            </div>
            
            {/* Info about approval requirement */}
            <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
              <p>Your partner will need to approve this reschedule request.</p>
            </div>
            
            {rescheduleAvailabilityLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-slate-600">Loading partner&apos;s availability...</span>
              </div>
            ) : rescheduleAvailability.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-slate-600 text-center">
                <p>No availability found for your partner.</p>
                <p className="text-sm mt-1">They may not have set their availability yet.</p>
              </div>
            ) : (
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Dates on Left */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Select New Date</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {rescheduleAvailability
                        .filter(slot => {
                          // Filter out past dates
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const slotDate = new Date(slot.date);
                          slotDate.setHours(0, 0, 0, 0);
                          return slotDate >= today;
                        })
                        .map((slot) => (
                        <button
                          key={slot.date}
                          onClick={() => { setRescheduleDate(slot.date); setRescheduleSlot(''); }}
                          className={`p-1.5 text-xs rounded-lg border transition-colors ${
                            rescheduleDate === slot.date
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200'
                          }`}
                          data-testid={`reschedule-date-${slot.date}`}
                        >
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Time Slots on Right */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Select New Time (24h)</label>
                    {rescheduleDate ? (
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {rescheduleAvailability
                          .find(a => a.date === rescheduleDate)
                          ?.slots
                          ?.filter((time) => {
                            // Filter out past times for today
                            const now = new Date();
                            const today = now.toISOString().split('T')[0];
                            if (rescheduleDate !== today) return true;
                            
                            // For today, filter out times that have passed
                            const [hours, minutes] = time.split(':').map(Number);
                            const slotMinutes = hours * 60 + minutes;
                            const currentMinutes = now.getHours() * 60 + now.getMinutes();
                            return slotMinutes > currentMinutes;
                          })
                          ?.map((time) => (
                            <button
                              key={time}
                              onClick={() => setRescheduleSlot(time)}
                              className={`p-1.5 text-xs rounded-lg border transition-colors ${
                                rescheduleSlot === time
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-purple-200'
                              }`}
                              data-testid={`reschedule-time-${time}`}
                            >
                              {time}
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Select a date first</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleSession(null)}>Cancel</Button>
              <Button 
                onClick={handleReschedule} 
                disabled={rescheduleLoading || !rescheduleDate || !rescheduleSlot || rescheduleAvailabilityLoading} 
                className="bg-purple-600 hover:bg-purple-700" 
                data-testid="confirm-reschedule"
              >
                {rescheduleLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Request Reschedule
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Modal */}
      <Dialog open={!!cancelSession} onOpenChange={() => setCancelSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Cancel Session
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-slate-600">Are you sure you want to cancel your session with <strong>{cancelSession?.partner_name}</strong> on <strong>{cancelSession?.date}</strong> at <strong>{cancelSession?.time_slot}</strong>?</p>
            
            {/* Dynamic warning based on cancellation policy */}
            {cancelSession && (() => {
              const sessionDateTime = new Date(`${cancelSession.date}T${cancelSession.time_slot || '00:00'}:00`);
              const policyHours = cancellationPolicy?.candidate_hours || 4;
              const deadline = new Date(sessionDateTime.getTime() - (policyHours * 60 * 60 * 1000));
              const now = new Date();
              const canRefund = now < deadline;
              
              return canRefund ? (
                <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800 border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Free cancellation:</strong> Your session credit will be restored.</span>
                  </div>
                  <p className="mt-1 text-xs text-green-600">
                    Cancellation deadline: {deadline.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-50 rounded-lg text-sm text-red-800 border border-red-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Late cancellation:</strong> Your session credit will NOT be restored.</span>
                  </div>
                  <p className="mt-1 text-xs text-red-600">
                    The free cancellation deadline ({policyHours} hours before session) has passed.
                  </p>
                </div>
              );
            })()}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelSession(null)}>Keep Session</Button>
              <Button onClick={handleCancelSession} disabled={cancelLoading} className="bg-red-600 hover:bg-red-700" data-testid="confirm-cancel">
                {cancelLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Cancel Session
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Picture Upload Modal (for listing without picture) */}
      {renderPictureUploadModal()}

      {/* Profile Completion Modal - shown when trying to go live with incomplete profile */}
      <ProfileCompletionModal
        isOpen={profileCompletionOpen}
        onClose={() => setProfileCompletionOpen(false)}
        missingFields={missingFields}
        currentProfileData={profileData}
        onProfileCompleted={handleProfileCompleted}
      />

      {/* Instructions Modal */}
      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">
              How Peer Practice Works
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Credit System */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-900">
                <Users className="w-5 h-5 text-blue-600" />
                Credit System
              </h3>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>Credits <strong>refresh automatically</strong> at the start of each month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>Each session uses <strong>1 credit</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>Unused credits <strong>don't roll over</strong> to the next month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>Your plan determines how many credits you get each month</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Setting Up Availability */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-900">
                <Calendar className="w-5 h-5 text-green-600" />
                Setting Up Availability
              </h3>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-green-700">1.</span>
                    <span>Go to <strong>"My Availability"</strong> tab</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-green-700">2.</span>
                    <span>Click <strong>"Add your availability"</strong> and select time slots</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-green-700">3.</span>
                    <span>Be specific about your <strong>timezone</strong> (auto-detected)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-green-700">4.</span>
                    <span><strong>Update regularly</strong> for better matches</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* No Availability Warning */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-900">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                What If I Don't Set Availability?
              </h3>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>You <strong>won't receive</strong> session requests from others</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>Others <strong>can't book</strong> sessions with you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>Tip:</strong> Set at least 3-4 slots per week for better matches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>More slots</strong> = More practice opportunities</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Approval & Feedback */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-900">
                <Star className="w-5 h-5 text-purple-600" />
                Approval & Feedback
              </h3>
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <span>Complete the session as scheduled</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <span><strong>You must give feedback</strong> after each session</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <span>Feedback helps <strong>improve the community</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <span>Rate your partner <strong>fairly and constructively</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>Pending feedback shows on your dashboard</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Respect Others' Time */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-900">
                <Clock className="w-5 h-5 text-red-600" />
                Respect Others' Time
              </h3>
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <span><strong>Join sessions on time</strong> - Your partner is waiting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <span><strong>Come prepared</strong> with cases ready to practice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ThumbsUp className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <span>Be <strong>professional and courteous</strong> at all times</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <span>Cancel <strong>at least 24 hours</strong> in advance if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span><strong>No-shows impact your reputation</strong> in the community</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Tips for Success */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-900">
                <Zap className="w-5 h-5 text-amber-600" />
                Tips for Success
              </h3>
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span><strong>Prepare before each session</strong> - Have cases ready</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span><strong>Take turns</strong> being interviewer and interviewee</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>Give <strong>constructive feedback</strong> - Be specific and helpful</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>Build <strong>long-term practice partnerships</strong> for consistency</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span><strong>Use the time wisely</strong> - 45 mins for 2 mini-cases works well</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setInstructionsOpen(false)} className="w-full sm:w-auto">
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PeerPracticePage;
