import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import {
  UserCheck, Star, Linkedin, Calendar, Clock, ArrowRight, X,
  CheckCircle2, Award, Briefcase, MessageSquare, RefreshCw, Trash2,
  ExternalLink, AlertCircle, FileText, Eye, Globe, Search, Filter,
  Plus, Sparkles, Tag, Video, Check, Lock, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { getTimezoneAbbr, formatTimeWithTimezone, istToViewer, format12hWithAbbr } from '../../utils/timezone';
import useViewerTimezone from '../../hooks/useViewerTimezone';
import PinnacleApplicationModal from '../PinnacleApplicationModal';
import { trackEvent } from '../../utils/tracking';
import '../../styles/cardStyles.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to check if a session is in a cancelled state
const isSessionCancelled = (status) => {
  const cancelledStatuses = ['cancelled', 'candidate_cancelled', 'mentor_cancelled', 'cancelled_by_candidate', 'cancelled_by_mentor', 'cancelled_by_admin'];
  return cancelledStatuses.includes(status);
};

// Helper function to check if a session is in a rescheduled state
const isSessionRescheduled = (status) => {
  const rescheduledStatuses = ['rescheduled', 'mentor_rescheduled', 'candidate_rescheduled'];
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

// Helper component for displaying a rating item in the feedback modal
const RatingDisplayItem = ({ label, value }) => (
  <div className="p-3 bg-slate-50 rounded-lg">
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${
            n <= value
              ? 'text-amber-400 fill-amber-400'
              : 'text-slate-200'
          }`}
        />
      ))}
      <span className="ml-2 text-sm font-medium text-slate-700">{value}/5</span>
    </div>
  </div>
);

// Star rating component - defined outside to prevent re-renders
const StarRating = ({ value, onChange, label }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-slate-700">{label}</Label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 transition-colors"
        >
          <Star
            className={`w-6 h-6 ${
              star <= value
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-200'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-slate-500">{value}/5</span>
    </div>
  </div>
);

// Session card component for displaying individual sessions
const SessionCard = ({ 
  booking, 
  isPast = false,
  isSessionJoinable, 
  isSessionPastJoinWindow, 
  getTimeUntilJoinable,
  joiningSession,
  handleJoinSession,
  openFeedbackModal,
  handleViewMentorFeedback,
  openRescheduleModal,
  setCancelBooking,
  cancellationPolicy
}) => {
  const { timezone: viewerTz, abbr: viewerTzAbbr } = useViewerTimezone();
  // Calculate if cancellation/reschedule is allowed based on policy
  const sessionDateTime = new Date(`${booking.date}T${booking.time_slot || '00:00'}:00+05:30`);
  const now = new Date();
  const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);
  const policyHours = cancellationPolicy?.candidate_hours || 4;
  const canCancelOrReschedule = hoursUntilSession >= policyHours;

  // Convert IST → viewer's local timezone for display
  const localView = istToViewer(booking.date, booking.time_slot, viewerTz);
  const localDateLabel = new Date(localView.date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const localPrev = booking.previous_date && booking.previous_time_slot
    ? istToViewer(booking.previous_date, booking.previous_time_slot, viewerTz)
    : null;
  const localPrevLabel = localPrev
    ? new Date(localPrev.date + 'T00:00:00').toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;
  
  return (
  <div className={`p-3 rounded-lg ${isSessionCancelled(booking.status) ? 'bg-slate-100 opacity-60' : isPast ? 'bg-white border border-slate-100' : 'bg-blue-50/50 border border-blue-100'}`} data-testid={`booking-${booking.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {/* Session Type Tags */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            {booking.session_type || 'General discussion'}
          </span>
          {booking.case_type && (
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              {booking.case_type}
            </span>
          )}
          {booking.was_rescheduled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              <RefreshCw className="w-3 h-3" /> Rescheduled
            </span>
          )}
        </div>
        
        {/* Date and Time */}
        <div className="flex items-center gap-3 text-sm">
          {booking.was_rescheduled && localPrev && (
            <span className="text-slate-400 line-through flex items-center gap-1" title={`${booking.previous_date} ${booking.previous_time_slot} IST`}>
              <Calendar className="w-3.5 h-3.5" />
              {localPrevLabel} {localPrev.time}
            </span>
          )}
          <span
            className={`flex items-center gap-1 ${booking.was_rescheduled ? 'text-green-600 font-medium' : 'text-slate-700'}`}
            title={`${booking.date} ${booking.time_slot} IST`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {localDateLabel} at {localView.time} {viewerTzAbbr}
          </span>
        </div>
        
        {/* Check-in status */}
        {(booking.mentor_checked_in || booking.candidate_checked_in) && (
          <div className="flex items-center gap-2 mt-1">
            {booking.candidate_checked_in && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> You joined
              </span>
            )}
            {booking.mentor_checked_in && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Mentor joined
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isSessionTerminal(booking.status) && (
          <>
            {isSessionPastJoinWindow(booking) ? (
              <>
                {booking.candidate_feedback_submitted ? (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Rated
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => openFeedbackModal(booking)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                    data-testid={`fill-feedback-${booking.id}`}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Rate
                  </Button>
                )}
                {booking.mentor_feedback_submitted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewMentorFeedback(booking)}
                    className="text-purple-600 border-purple-200 hover:bg-purple-50 text-xs h-7"
                    data-testid={`view-feedback-${booking.id}`}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Feedback
                  </Button>
                )}
              </>
            ) : isSessionJoinable(booking) ? (
              <Button
                size="sm"
                onClick={() => handleJoinSession(booking)}
                disabled={joiningSession === booking.id}
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                data-testid={`join-booking-${booking.id}`}
              >
                {joiningSession === booking.id ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <ExternalLink className="w-3 h-3 mr-1" />
                )}
                {booking.candidate_checked_in ? 'Rejoin' : 'Join'}
              </Button>
            ) : (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                {getTimeUntilJoinable(booking) ? (
                  <>In {getTimeUntilJoinable(booking)}</>
                ) : (
                  <>Closed</>
                )}
              </span>
            )}
            
            {!isSessionPastJoinWindow(booking) && (
              <>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => openRescheduleModal(booking)}
                  className="text-amber-600 hover:bg-amber-50 h-7 w-7 p-0"
                  data-testid={`reschedule-booking-${booking.id}`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setCancelBooking(booking)}
                  className="text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                  data-testid={`cancel-booking-${booking.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 
          isSessionCancelled(booking.status) ? 'bg-slate-200 text-slate-600' :
          isSessionRescheduled(booking.status) ? 'bg-purple-100 text-purple-700' :
          isSessionNoShow(booking.status) ? 'bg-red-100 text-red-700' :
          booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {booking.status?.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  </div>
  );
};

const CoachingPage = () => {
  const { user, dashboardData, refreshUser, showUpgradeModal } = useDashboard();
  const { timezone: viewerTz, abbr: viewerTzAbbr } = useViewerTimezone(user);
  const [mentors, setMentors] = useState([]);
  const [logoMap, setLogoMap] = useState({}); // Logo repository lookup
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingSlot, setBookingSlot] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Read tab from URL params
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'sessions' ? 'sessions' : 'book';
  
  // Tab state
  const [activeTab, setActiveTab] = useState(initialTab); // 'book' or 'sessions'
  
  // Sort and filter state
  const [sortBy, setSortBy] = useState('rating'); // 'earliest', 'rating', or 'sessions'
  const [mentorsEarliestSlots, setMentorsEarliestSlots] = useState({});
  const [loadingEarliestSlots, setLoadingEarliestSlots] = useState(false);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  
  // Time slot filter state
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterFromTime, setFilterFromTime] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterToTime, setFilterToTime] = useState('');
  const [timeFilteredMentorIds, setTimeFilteredMentorIds] = useState(null); // null = no filter, Set = filtered IDs
  const [timeFilterLoading, setTimeFilterLoading] = useState(false);
  
  // Pre-booking form state
  const [sessionType, setSessionType] = useState('');
  const [caseType, setCaseType] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  
  // Reschedule state
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleMentor, setRescheduleMentor] = useState('');
  const [rescheduleAvailability, setRescheduleAvailability] = useState([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  
  // Cancel state
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  
  // Cancellation policy state
  const [cancellationPolicy, setCancellationPolicy] = useState({ candidate_hours: 4 });
  
  // Join session state
  const [joiningSession, setJoiningSession] = useState(null);
  
  // Candidate Feedback state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackBooking, setFeedbackBooking] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [candidateFeedback, setCandidateFeedback] = useState({
    mentor_followed_instructions: true,
    rating_facilitation_style: 5,
    rating_feedback_quality: 5,
    rating_overall: 5,
    other_feedback: ''
  });

  // View mentor feedback state
  const [viewMentorFeedbackOpen, setViewMentorFeedbackOpen] = useState(false);
  const [viewingMentorFeedback, setViewingMentorFeedback] = useState(null);

  // Purchase session modal state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseMentor, setPurchaseMentor] = useState(null);
  const [sessionPrice, setSessionPrice] = useState(null);
  const [singleSessionConfirmOpen, setSingleSessionConfirmOpen] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  // A-la-carte direct pay flag for the booking modal — when true, user
  // skips credits and pays Razorpay for this single session.
  const [payDirect, setPayDirect] = useState(false);
  // Coupon state for the a-la-carte direct-pay path.
  const [aLaCarteCouponCode, setALaCarteCouponCode] = useState('');
  const [aLaCarteCouponLoading, setALaCarteCouponLoading] = useState(false);
  const [aLaCarteCouponError, setALaCarteCouponError] = useState('');
  const [aLaCarteAppliedCoupon, setALaCarteAppliedCoupon] = useState(null); // { discount_id, code, name, discount_amount }

  // Top-up sessions modal state
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpPricing, setTopUpPricing] = useState(null);
  const [selectedTopUpCount, setSelectedTopUpCount] = useState(5);
  const [topUpLoading, setTopUpLoading] = useState(false);
  
  // Top-up coupon state
  const [topUpCouponCode, setTopUpCouponCode] = useState('');
  const [topUpCouponLoading, setTopUpCouponLoading] = useState(false);
  const [topUpCouponError, setTopUpCouponError] = useState(null);
  const [topUpAppliedCoupon, setTopUpAppliedCoupon] = useState(null);
  const [showTopUpCouponInput, setShowTopUpCouponInput] = useState(false);
  
  // Coaching plans modal state
  const [coachingPlansModalOpen, setCoachingPlansModalOpen] = useState(false);
  const [coachingPlans, setCoachingPlans] = useState([]);
  const [coachingPlansLoading, setCoachingPlansLoading] = useState(false);
  const [enrollingPlan, setEnrollingPlan] = useState(null); // Track which plan is being enrolled
  const [showPinnacleModal, setShowPinnacleModal] = useState(false); // Pinnacle application modal
  
  const navigate = useNavigate();

  // Check plan status from dashboard data
  const planStatus = dashboardData?.plan_status || {};
  
  // Check if plan has expired (any plan type)
  const isPlanExpired = planStatus.use_item_level_locking || 
                        planStatus.trial_expired || 
                        planStatus.subscription_expired || 
                        planStatus.coaching_program_expired;
  
  // For coaching access:
  // 1. Admin hasn't explicitly revoked access
  // 2. User has purchased single sessions OR has active coaching plan
  // 3. Plan is NOT expired (unless they have single sessions - those never expire)
  const hasSingleSessions = (user?.coaching_sessions_remaining || 0) > 0;
  const hasCoaching = dashboardData?.access?.coaching !== false;  // Check admin override
  const isUnlimitedCoaching = user?.is_unlimited_coaching || false;
  
  // If plan is expired, coaching sessions from the plan are forfeited
  // Only purchased single sessions survive expiry
  const effectiveSessionsRemaining = isPlanExpired 
    ? (hasSingleSessions ? (user?.coaching_sessions_remaining || 0) : 0)
    : (isUnlimitedCoaching ? -1 : (user?.coaching_sessions_remaining || 0));
  
  // User can book if: has coaching access AND (has unlimited OR has remaining sessions OR plan not expired)
  const canBookCoaching = hasCoaching && (isUnlimitedCoaching || effectiveSessionsRemaining > 0 || !isPlanExpired);
  
  // Check if user has purchased a coaching program (Last Mile, Mid Mile, Full Prep, etc.)
  // This is used to determine if mentor names/photos should be shown or blurred
  const coachingPlanTypes = ['last_mile', 'mid_mile', 'full_prep', 'coaching', 'pinnacle'];
  const userPlan = user?.plan?.toLowerCase() || '';
  const hasCoachingProgram = coachingPlanTypes.some(plan => userPlan.includes(plan)) || 
                             hasSingleSessions || 
                             isUnlimitedCoaching ||
                             (user?.coaching_sessions_total || 0) > 0;
  
  const sessionsRemaining = effectiveSessionsRemaining;

  useEffect(() => {
    fetchData();
    fetchCancellationPolicy();
    trackEvent('coaching_page_viewed');
  }, []);

  const fetchCancellationPolicy = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/public/cancellation-policy`, { withCredentials: true });
      console.log('Cancellation policy loaded:', response.data);
      setCancellationPolicy(response.data);
    } catch (error) {
      console.log('Using default cancellation policy:', error.message);
    }
  };

  const fetchData = async () => {
    try {
      const [mentorsRes, bookingsRes, logosRes, strategyRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/mentors`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/mentors/bookings/my`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${BACKEND_URL}/api/mentors/logos`, { withCredentials: true }).catch(() => ({ data: { logo_map: {} } })),
        axios.get(`${BACKEND_URL}/api/strategy-calls/my-sessions`, { withCredentials: true }).catch(() => ({ data: { sessions: [] } }))
      ]);
      
      setMentors(mentorsRes.data);

      // Auto-open the single-session purchase modal if the URL has
      // ?bookSingle=<mentorId> (deep link from landing page CTA).
      const bookSingleId = searchParams.get('bookSingle');
      if (bookSingleId) {
        const target = (mentorsRes.data || []).find((m) => m.id === bookSingleId);
        if (target) {
          // Defer so other state finishes setting up.
          setTimeout(() => {
            setPurchaseMentor(target);
            setSingleSessionConfirmOpen(true);
            // Fetch price for the confirmation modal
            (async () => {
              try {
                const priceRes = await axios.get(
                  `${BACKEND_URL}/api/payments/mentor/${target.id}/session-price`,
                  { withCredentials: true },
                );
                setSessionPrice(priceRes.data);
              } catch (err) {
                // Non-fatal — modal still shows
                console.warn('Failed to fetch session price for deep-link:', err?.response?.status);
              }
            })();
          }, 200);
        }
      }
      
      // Combine coaching and strategy sessions
      const coachingSessions = (bookingsRes.data || []).map(b => ({ ...b, session_type_category: 'coaching' }));
      const strategySessions = (strategyRes.data.sessions || []).map(s => ({ 
        ...s, 
        session_type_category: 'strategy',
        time_slot: s.time, // Normalize field name for compatibility
        session_type: 'Strategy Call', // Add session_type for display
        mentor_id: s.mentor_id,
        mentor_name: s.mentor_name,
        mentor_picture: s.mentor_picture
      }));
      
      setMyBookings([...coachingSessions, ...strategySessions]);
      setLogoMap(logosRes.data.logo_map || {});
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get logo for a company name
  const getCompanyLogo = (companyName) => {
    if (!companyName) return null;
    return logoMap[companyName.toLowerCase()] || null;
  };

  // Fetch earliest availability for all mentors in a single batch call
  const fetchEarliestSlotsForMentors = async () => {
    setLoadingEarliestSlots(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentors/earliest-slots`, {
        withCredentials: true,
      });
      setMentorsEarliestSlots(response.data.slots || {});
    } catch (error) {
      console.error('Failed to fetch earliest slots:', error);
      setMentorsEarliestSlots({});
    } finally {
      setLoadingEarliestSlots(false);
    }
  };

  // Fetch earliest slots when mentors change
  useEffect(() => {
    if (mentors.length > 0 && activeTab === 'book') {
      fetchEarliestSlotsForMentors();
    }
  }, [mentors.length, activeTab]);

  // Apply time slot filter - fetch availability for all mentors and filter
  const applyTimeSlotFilter = async () => {
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
      
      // Fetch availability for all mentors and filter
      const mentorIds = mentors.map(m => m.id);
      const availableInRange = new Set();
      
      // Batch fetch availability for all mentors
      const availabilityPromises = mentorIds.map(async (mentorId) => {
        try {
          const response = await axios.get(`${BACKEND_URL}/api/mentors/${mentorId}/availability`, {
            withCredentials: true,
          });
          const slots = response.data || [];
          
          // Check if any slot falls within the time range
          // API returns { date, slots: ["09:00", "09:30", ...], booked_slots: [...] }
          for (const daySlots of slots) {
            const slotDate = daySlots.date;
            // Get available slots (exclude booked ones)
            const availableSlots = (daySlots.slots || []).filter(
              slot => !(daySlots.booked_slots || []).includes(slot)
            );
            
            for (const time of availableSlots) {
              const slotDateTime = new Date(`${slotDate}T${time}`);
              if (slotDateTime >= fromDateTime && slotDateTime <= toDateTime) {
                availableInRange.add(mentorId);
                return; // Found a match, no need to check more
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch availability for mentor ${mentorId}:`, error);
        }
      });
      
      await Promise.all(availabilityPromises);
      setTimeFilteredMentorIds(availableInRange);
    } catch (error) {
      console.error('Failed to apply time filter:', error);
    } finally {
      setTimeFilterLoading(false);
    }
  };
  
  // Clear time slot filter
  const clearTimeSlotFilter = () => {
    setFilterFromDate('');
    setFilterFromTime('');
    setFilterToDate('');
    setFilterToTime('');
    setTimeFilteredMentorIds(null);
    setShowTimeFilter(false);
  };

  // Unique companies for filter dropdown
  const uniqueCompanies = [...new Set(mentors.map(m => m.company).filter(Boolean))].sort();

  // Memoize filter and sort operations
  const filteredMentors = useMemo(() => {
    return mentors.filter(mentor => {
      // Time slot filter (if applied)
      if (timeFilteredMentorIds !== null && !timeFilteredMentorIds.has(mentor.id)) {
        return false;
      }
      // Search filter
      if (searchQuery && 
          !mentor.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !mentor.company?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !mentor.expertise?.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }
      // Company filter
      if (filterCompany !== 'all' && mentor.company !== filterCompany) return false;
      // Rating filter
      if (filterRating !== 'all') {
        const minRating = parseInt(filterRating);
        if ((mentor.rating !== null && mentor.rating !== undefined && mentor.rating > 0) && mentor.rating < minRating) return false;
      }
      return true;
    });
  }, [mentors, searchQuery, filterCompany, filterRating, timeFilteredMentorIds]);

  // Memoize sorted mentors
  const sortedMentors = useMemo(() => {
    return [...filteredMentors].sort((a, b) => {
      if (sortBy === 'rating') {
        // Sort by rating (highest first), then by name
        // Mentors with no rating (null/undefined) go to the end
        const ratingA = (a.rating !== null && a.rating !== undefined) ? a.rating : -1;
        const ratingB = (b.rating !== null && b.rating !== undefined) ? b.rating : -1;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'sessions') {
        // Sort by sessions conducted (highest first)
        const sessionsA = a.sessions_conducted || 0;
        const sessionsB = b.sessions_conducted || 0;
        if (sessionsB !== sessionsA) return sessionsB - sessionsA;
        return a.name.localeCompare(b.name);
      } else {
        // Sort by earliest availability (default)
        const slotA = mentorsEarliestSlots[a.id];
        const slotB = mentorsEarliestSlots[b.id];
        
        // Mentors without availability go to the end
        if (!slotA && !slotB) return a.name.localeCompare(b.name);
        if (!slotA) return 1;
        if (!slotB) return -1;
        
        // Compare dates first, then times
        const dateCompare = slotA.date.localeCompare(slotB.date);
        if (dateCompare !== 0) return dateCompare;
        return slotA.time.localeCompare(slotB.time);
      }
    });
  }, [filteredMentors, sortBy, mentorsEarliestSlots]);

  const fetchMentorAvailability = async (mentorId) => {
    setAvailabilityLoading(true);
    setAvailability([]);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentors/${mentorId}/availability`, {
        withCredentials: true,
      });
      setAvailability(response.data || []);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      setAvailability([]);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleMentorClick = async (mentor) => {
    trackEvent('book_now_clicked', { mentor_id: mentor.id });
    // Both flows are supported: credit-based booking (default if user has
    // credits) and a-la-carte direct payment per session (fallback when no
    // credits, OR opt-in via "Pay separately" toggle in the modal).
    // Always open the slot picker — the modal itself will branch on
    // confirm based on `payDirect` + sessionsRemaining.
    setSelectedMentor(mentor);
    setBookingDate(null);
    setBookingSlot(null);
    setSessionType('');
    setCaseType('');
    setSessionNotes('');
    // Reset a-la-carte coupon state
    setALaCarteCouponCode('');
    setALaCarteCouponError('');
    setALaCarteAppliedCoupon(null);
    // Default: pay direct ONLY if user has 0 credits and isn't unlimited.
    setPayDirect(!canBookCoaching);
    // Fetch per-session price for this mentor (used by the pay-direct path)
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/payments/mentor/${mentor.id}/session-price`,
        { withCredentials: true }
      );
      setSessionPrice(res.data);
    } catch (err) {
      console.error('Failed to fetch mentor session price:', err);
      setSessionPrice({ base_price: 1500, gst: 270, total_price: 1770 });
    }
    await fetchMentorAvailability(mentor.id);
  };

  // Open purchase modal and fetch session price
  const openPurchaseModal = async (mentor) => {
    setPurchaseMentor(mentor);
    setPurchaseModalOpen(true);
    setSessionPrice(null);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/payments/mentor/${mentor.id}/session-price`, {
        withCredentials: true
      });
      setSessionPrice(res.data);
    } catch (error) {
      console.error('Failed to fetch session price:', error);
      // Default pricing
      setSessionPrice({
        base_price: 1500,
        gst: 270,
        total_price: 1770
      });
    }
  };

  // Handle single session purchase
  const handlePurchaseSession = async () => {
    if (!purchaseMentor) return;
    
    setPurchaseLoading(true);
    try {
      // Create order
      const orderRes = await axios.post(
        `${BACKEND_URL}/api/payments/create-session-order`,
        { mentor_id: purchaseMentor.id },
        { withCredentials: true }
      );
      
      const orderData = orderRes.data;
      
      // Get Razorpay config
      const configRes = await axios.get(`${BACKEND_URL}/api/payments/config`, { withCredentials: true });
      
      // Check if Razorpay is loaded
      if (!window.Razorpay) {
        throw new Error('Payment gateway not loaded. Please refresh the page and try again.');
      }
      
      // Open Razorpay checkout
      const options = {
        key: configRes.data.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'gradnext',
        description: `Single Coaching Session with ${orderData.mentor_name}`,
        order_id: orderData.order_id,
        prefill: {
          email: orderData.user_email,
          name: orderData.user_name
        },
        theme: {
          color: '#2563eb'
        },
        handler: async function (response) {
          // Verify payment
          try {
            const verifyRes = await axios.post(
              `${BACKEND_URL}/api/payments/verify-session`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                mentor_id: purchaseMentor.id
              },
              { withCredentials: true }
            );
            
            alert(verifyRes.data.message);
            setPurchaseModalOpen(false);
            setPurchaseMentor(null);
            await refreshUser();
            
            // Now open the booking modal
            setSelectedMentor(purchaseMentor);
            setBookingDate(null);
            setBookingSlot(null);
            setSessionType('');
            setCaseType('');
            setSessionNotes('');
            await fetchMentorAvailability(purchaseMentor.id);
          } catch (error) {
            console.error('Session payment verification error:', error);
            const errorMsg = error.response?.data?.detail || 'Payment verification failed. Please contact support.';
            alert(errorMsg);
          }
        },
        modal: {
          ondismiss: function() {
            setPurchaseLoading(false);
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to initiate payment');
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Open top-up modal and fetch pricing
  const openTopUpModal = async () => {
    setTopUpModalOpen(true);
    setTopUpPricing(null);
    setSelectedTopUpCount(5);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/payments/topup/pricing`, {
        withCredentials: true
      });
      setTopUpPricing(res.data);
      // Fetch initial pricing for default count with discount tiers
      fetchTopUpPricingForCount(5, res.data.base_price, res.data.discount_tiers);
    } catch (error) {
      console.error('Failed to fetch top-up pricing:', error);
    }
  };

  // Open coaching plans modal and fetch plans dynamically
  const openCoachingPlansModal = async () => {
    setCoachingPlansModalOpen(true);
    setCoachingPlansLoading(true);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/resources/plans?category=coaching`, {
        withCredentials: true
      });
      // Filter out single_session plan and sort by order
      const plans = (res.data.plans || [])
        .filter(p => p.plan_key !== 'single_session')
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setCoachingPlans(plans);
    } catch (error) {
      console.error('Failed to fetch coaching plans:', error);
      setCoachingPlans([]);
    } finally {
      setCoachingPlansLoading(false);
    }
  };

  // Handle coaching plan enrollment (direct payment)
  const handleCoachingPlanEnroll = async (plan) => {
    // For Pinnacle program, open the application modal instead
    const isPinnacle = plan.name === 'Pinnacle' || plan.plan_key === 'pinnacle';
    if (isPinnacle) {
      setCoachingPlansModalOpen(false);
      setShowPinnacleModal(true);
      return;
    }
    
    setEnrollingPlan(plan.plan_key);
    
    try {
      // Create order for the coaching plan
      const response = await axios.post(
        `${BACKEND_URL}/api/payments/create-order`,
        { plan_key: plan.plan_key },
        { withCredentials: true }
      );
      
      const orderData = response.data;
      
      // Open Razorpay payment modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'gradnext',
        description: `${orderData.plan_name} - Coaching Program`,
        order_id: orderData.order_id,
        handler: async function (paymentResponse) {
          try {
            // Verify payment
            await axios.post(
              `${BACKEND_URL}/api/payments/verify`,
              {
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                plan_key: plan.plan_key
              },
              { withCredentials: true }
            );
            
            alert(`Successfully enrolled in ${plan.name}! Refreshing...`);
            setCoachingPlansModalOpen(false);
            window.location.reload();
          } catch (err) {
            console.error('Payment verification failed:', err);
            alert('Payment successful but verification failed. Please contact support.');
          }
        },
        prefill: {
          email: user?.email || '',
          name: user?.name || '',
        },
        theme: {
          color: '#3B82F6',
        },
        modal: {
          ondismiss: function() {
            setEnrollingPlan(null);
          }
        }
      };
      
      // eslint-disable-next-line no-undef
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Failed to create order:', error);
      alert(error.response?.data?.detail || 'Failed to initiate payment. Please try again.');
    } finally {
      setEnrollingPlan(null);
    }
  };

  // Fetch pricing for specific session count
  const fetchTopUpPricingForCount = async (count, basePrice = topUpPricing?.base_price, discountTiers = topUpPricing?.discount_tiers) => {
    if (!basePrice) return;
    
    // Calculate discount from tiers (use API tiers or fallback)
    let discount = 0;
    const tiers = discountTiers || [];
    
    // Sort tiers by min_sessions descending to find the applicable tier
    const sortedTiers = [...tiers].sort((a, b) => b.min_sessions - a.min_sessions);
    for (const tier of sortedTiers) {
      if (count >= tier.min_sessions) {
        discount = tier.discount / 100; // Convert percentage to decimal
        break;
      }
    }
    
    const subtotal = basePrice * count;
    const discountAmount = subtotal * discount;
    const totalBeforeGst = subtotal - discountAmount;
    const gst = totalBeforeGst * 0.18;
    const total = totalBeforeGst + gst;
    const effectivePerSessionPreGst = totalBeforeGst / count;
    
    setTopUpPricing(prev => ({
      ...prev,
      currentPricing: {
        sessions: count,
        subtotal: Math.round(subtotal * 100) / 100,
        discount_percent: Math.round(discount * 100),
        discount_amount: Math.round(discountAmount * 100) / 100,
        total_before_gst: Math.round(totalBeforeGst * 100) / 100,
        gst: Math.round(gst * 100) / 100,
        total: Math.round(total * 100) / 100,
        effective_per_session: Math.round((total / count) * 100) / 100,
        effective_per_session_pre_gst: Math.round(effectivePerSessionPreGst * 100) / 100
      }
    }));
  };

  // Handle session count change
  const handleSessionCountChange = (count) => {
    setSelectedTopUpCount(count);
    fetchTopUpPricingForCount(count);
  };

  // Handle top-up purchase
  const handleTopUpPurchase = async () => {
    if (!selectedTopUpCount) return;
    
    setTopUpLoading(true);
    try {
      // Create order with coupon if applied
      const orderPayload = { session_count: selectedTopUpCount };
      if (topUpAppliedCoupon?.discount_id) {
        orderPayload.coupon_discount_id = topUpAppliedCoupon.discount_id;
        console.log('Passing coupon to order:', {
          discount_id: topUpAppliedCoupon.discount_id,
          discount_amount: topUpAppliedCoupon.discount_amount,
          full_coupon: topUpAppliedCoupon
        });
      }
      
      console.log('Order payload:', orderPayload);
      
      const orderRes = await axios.post(
        `${BACKEND_URL}/api/payments/topup/create-order`,
        orderPayload,
        { withCredentials: true }
      );
      
      console.log('Order response:', orderRes.data);
      
      const orderData = orderRes.data;
      
      // Get Razorpay config
      const configRes = await axios.get(`${BACKEND_URL}/api/payments/config`, { withCredentials: true });
      
      // Check if Razorpay is loaded
      if (!window.Razorpay) {
        throw new Error('Payment gateway not loaded. Please refresh the page and try again.');
      }
      
      // Close the top-up modal before opening Razorpay to avoid z-index issues
      setTopUpModalOpen(false);
      
      // Open Razorpay checkout
      const options = {
        key: configRes.data.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'gradnext',
        description: `Top-up: ${orderData.session_count} Coaching Session${orderData.session_count > 1 ? 's' : ''}`,
        order_id: orderData.order_id,
        prefill: {
          email: orderData.user_email,
          name: orderData.user_name
        },
        theme: {
          color: '#2563eb'
        },
        handler: async function (response) {
          // Verify payment with retry logic for delayed payment processing
          const verifyPayment = async (attemptNum = 1, maxAttempts = 3) => {
            console.log(`Verification attempt ${attemptNum}/${maxAttempts}`);
            
            const verifyRes = await axios.post(
              `${BACKEND_URL}/api/payments/topup/verify`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                session_count: orderData.session_count
              },
              { withCredentials: true }
            );
            return verifyRes;
          };
          
          try {
            console.log('Razorpay payment response:', response);
            console.log('Verifying with session_count:', orderData.session_count);
            
            // Wait for Razorpay to fully process the payment (handles 5+ second delays)
            console.log('Waiting for payment to be fully processed...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second initial delay
            
            let verifyRes;
            let lastError;
            
            // Retry up to 3 times with increasing delays (handles slow payment processing)
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                verifyRes = await verifyPayment(attempt);
                console.log('Verification response:', verifyRes.data);
                break; // Success, exit loop
              } catch (err) {
                lastError = err;
                console.error(`Attempt ${attempt} failed:`, err.response?.data || err.message);
                
                if (attempt < 3) {
                  // Wait longer between retries (2s, 4s)
                  const delay = attempt * 2000;
                  console.log(`Waiting ${delay}ms before retry...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
            }
            
            if (!verifyRes) {
              throw lastError;
            }
            
            alert(verifyRes.data.message);
            // Reset coupon state
            setTopUpCouponCode('');
            setTopUpAppliedCoupon(null);
            setShowTopUpCouponInput(false);
            await refreshUser();
          } catch (error) {
            console.error('Top-up verification error after all retries:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            
            const errorMsg = error.response?.data?.detail || 'Payment verification failed. Please contact support with your payment ID.';
            alert(errorMsg);
          } finally {
            setTopUpLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            // Reopen the modal if user cancels payment
            setTopUpModalOpen(true);
            setTopUpLoading(false);
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to initiate payment');
      // Reopen modal on error
      setTopUpModalOpen(true);
      setTopUpLoading(false);
    }
  };

  // Validate top-up coupon code
  const validateTopUpCoupon = async () => {
    if (!topUpCouponCode.trim()) {
      setTopUpCouponError('Please enter a coupon code');
      return;
    }
    
    setTopUpCouponLoading(true);
    setTopUpCouponError(null);
    
    try {
      const currentPricing = topUpPricing?.currentPricing;
      const orderAmount = currentPricing?.subtotal_after_discount || currentPricing?.subtotal || 0;
      
      const response = await fetch(`${BACKEND_URL}/api/discounts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: topUpCouponCode.toUpperCase(),
          order_type: 'coaching',
          order_amount: orderAmount,
          plan_key: 'coaching_topup'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setTopUpCouponError(data.detail || 'Invalid coupon code');
        return;
      }
      
      if (data.valid) {
        setTopUpAppliedCoupon(data);
        setTopUpCouponError(null);
      } else {
        setTopUpCouponError(data.message || 'Invalid coupon code');
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      setTopUpCouponError('Failed to validate coupon');
    } finally {
      setTopUpCouponLoading(false);
    }
  };

  // Remove applied top-up coupon
  const removeTopUpCoupon = () => {
    setTopUpAppliedCoupon(null);
    setTopUpCouponCode('');
    setTopUpCouponError(null);
  };

  // Get selected pricing details
  const getSelectedPricing = () => {
    if (!topUpPricing?.pricing) return null;
    return topUpPricing.pricing.find(p => p.sessions === selectedTopUpCount);
  };

  const handleBookSession = async () => {
    if (!bookingDate || !bookingSlot || !sessionType) return;
    
    // Validate case type is selected if session type is Case session
    if (sessionType === 'Case session' && !caseType) {
      alert('Please select a case type for your case session.');
      return;
    }

    // ====== A-la-carte direct-pay branch ======
    // User has 0 credits OR explicitly chose to pay separately for this
    // session. Use the slot+payment atomic flow used by the public
    // /book/:mentorId page.
    const useDirectPay = payDirect || (sessionsRemaining === 0 && !isUnlimitedCoaching);
    if (useDirectPay) {
      await handleDirectPayAndBook();
      return;
    }

    setBookingLoading(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/mentors/${selectedMentor.id}/book`,
        {
          date: bookingDate,
          time_slot: bookingSlot,
          session_type: sessionType,
          case_type: sessionType === 'Case session' ? caseType : null,
          candidate_notes: sessionNotes || null
        },
        {
          withCredentials: true,
        }
      );
      await fetchData();
      await refreshUser();
      setSelectedMentor(null);
      alert('Session booked successfully! Calendar invite sent to your email.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to book session');
    } finally {
      setBookingLoading(false);
    }
  };

  // A-la-carte: pay Razorpay first, then verify-and-book in one atomic
  // call (slot is reserved for 15 min via TTL while payment processes).
  const handleDirectPayAndBook = async () => {
    if (!selectedMentor || !bookingDate || !bookingSlot || !sessionType) return;
    if (!window.Razorpay) {
      alert('Payment gateway not loaded. Please refresh the page and try again.');
      return;
    }
    setBookingLoading(true);
    try {
      // 1. Create order + reserve slot
      const orderRes = await axios.post(
        `${BACKEND_URL}/api/payments/create-session-order-with-slot`,
        {
          mentor_id: selectedMentor.id,
          date: bookingDate,
          time_slot: bookingSlot,
          session_type: sessionType,
          case_type: sessionType === 'Case session' ? caseType : null,
          candidate_notes: sessionNotes || null,
          coupon_discount_id: aLaCarteAppliedCoupon?.discount_id || null,
        },
        { withCredentials: true }
      );
      const orderData = orderRes.data;

      // 2. Razorpay key
      const configRes = await axios.get(`${BACKEND_URL}/api/payments/config`, { withCredentials: true });

      // 3. Open Razorpay checkout
      const options = {
        key: configRes.data.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'gradnext',
        description: `1:1 Session with ${orderData.mentor_name || selectedMentor.name}`,
        order_id: orderData.order_id,
        prefill: {
          email: orderData.user_email || user?.email,
          name: orderData.user_name || user?.name,
        },
        theme: { color: '#2563eb' },
        handler: async function (response) {
          try {
            const verifyRes = await axios.post(
              `${BACKEND_URL}/api/payments/verify-session-with-slot`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                mentor_id: selectedMentor.id,
                date: bookingDate,
                time_slot: bookingSlot,
                session_type: sessionType,
                case_type: sessionType === 'Case session' ? caseType : null,
                candidate_notes: sessionNotes || null,
                coupon_discount_id: aLaCarteAppliedCoupon?.discount_id || null,
              },
              { withCredentials: true }
            );
            await fetchData();
            await refreshUser();
            setSelectedMentor(null);
            alert(verifyRes.data?.message || 'Payment successful! Your session is booked. Calendar invite sent to your email.');
          } catch (err) {
            console.error('Verify-session-with-slot error:', err);
            alert(err.response?.data?.detail || 'Payment verified but booking failed. Please contact support.');
          } finally {
            setBookingLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setBookingLoading(false);
          },
        },
      };
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Direct pay & book error:', error);
      alert(error.response?.data?.detail || 'Failed to initiate payment. Please try again.');
      setBookingLoading(false);
    }
  };

  // Apply coupon for the a-la-carte direct-pay path. Reuses the existing
  // /api/discounts/validate endpoint with order_type='coaching' and
  // plan_key='single_session' (matches what backend uses in
  // create-session-order-with-slot).
  const handleApplyALaCarteCoupon = async () => {
    const code = (aLaCarteCouponCode || '').trim().toUpperCase();
    if (!code) {
      setALaCarteCouponError('Enter a coupon code');
      return;
    }
    if (!sessionPrice?.base_price) {
      setALaCarteCouponError('Pricing is still loading, please wait');
      return;
    }
    setALaCarteCouponLoading(true);
    setALaCarteCouponError('');
    try {
      const r = await axios.post(
        `${BACKEND_URL}/api/discounts/validate`,
        {
          code,
          order_type: 'coaching',
          plan_key: 'single_session',
          order_amount: Number(sessionPrice.base_price),
        },
        { withCredentials: true }
      );
      const v = r.data;
      if (!v?.valid) {
        setALaCarteCouponError(v?.error || 'Invalid coupon');
        setALaCarteAppliedCoupon(null);
        return;
      }
      setALaCarteAppliedCoupon({
        discount_id: v.discount_id,
        code: code,
        name: v.discount_name || code,
        discount_amount: Number(v.discount_amount || 0),
      });
    } catch (e) {
      setALaCarteCouponError(e?.response?.data?.detail || 'Could not validate coupon');
      setALaCarteAppliedCoupon(null);
    } finally {
      setALaCarteCouponLoading(false);
    }
  };

  const removeALaCarteCoupon = () => {
    setALaCarteCouponCode('');
    setALaCarteCouponError('');
    setALaCarteAppliedCoupon(null);
  };

  // Compute the live total for the a-la-carte direct-pay path (base − discount + GST 18%)
  const aLaCarteBreakdown = (() => {
    const base = Number(sessionPrice?.base_price || 0);
    const discount = Number(aLaCarteAppliedCoupon?.discount_amount || 0);
    const discounted = Math.max(0, base - discount);
    const gst = Math.round(discounted * 0.18);
    const total = discounted + gst;
    return { base, discount, discounted, gst, total };
  })();

  // Reschedule functions
  const openRescheduleModal = async (booking) => {
    setRescheduleBooking(booking);
    setRescheduleMentor(booking.mentor_id);
    setRescheduleDate('');
    setRescheduleSlot('');
    // Fetch availability for the current mentor
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentors/${booking.mentor_id}/availability`, {
        withCredentials: true,
      });
      setRescheduleAvailability(response.data);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  const handleMentorChange = async (mentorId) => {
    setRescheduleMentor(mentorId);
    setRescheduleDate('');
    setRescheduleSlot('');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentors/${mentorId}/availability`, {
        withCredentials: true,
      });
      setRescheduleAvailability(response.data);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  // Check if booking can be cancelled/rescheduled based on policy
  const canCancelOrReschedule = (booking) => {
    const sessionDateTime = new Date(`${booking.date}T${booking.time_slot || booking.time || '00:00'}:00+05:30`);
    const now = new Date();
    const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);
    const policyHours = cancellationPolicy?.candidate_hours || 4;
    return hoursUntilSession >= policyHours;
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleSlot) {
      alert('Please select a new date and time slot');
      return;
    }

    setRescheduleLoading(true);
    try {
      if (rescheduleBooking.session_type_category === 'strategy') {
        // Strategy calls use their own reschedule endpoint
        await axios.post(
          `${BACKEND_URL}/api/strategy-calls/${rescheduleBooking.id}/reschedule`,
          {
            new_date: rescheduleDate,
            new_time: rescheduleSlot
          },
          { withCredentials: true }
        );
      } else {
        // Coaching sessions
        await axios.put(
          `${BACKEND_URL}/api/mentors/bookings/${rescheduleBooking.id}/reschedule`,
          {
            new_date: rescheduleDate,
            new_time_slot: rescheduleSlot
          },
          { withCredentials: true }
        );
      }
      await fetchData();
      setRescheduleBooking(null);
      alert('Session rescheduled successfully! Updated calendar invite sent.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to reschedule session');
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Cancel functions
  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      if (cancelBooking.session_type_category === 'strategy') {
        // Strategy calls use their own cancel endpoint
        await axios.post(
          `${BACKEND_URL}/api/strategy-calls/${cancelBooking.id}/cancel`,
          { reason: 'Cancelled by user' },
          { withCredentials: true }
        );
      } else {
        // Coaching sessions
        await axios.delete(
          `${BACKEND_URL}/api/mentors/bookings/${cancelBooking.id}`,
          { withCredentials: true }
        );
      }
      await fetchData();
      await refreshUser();
      setCancelBooking(null);
      alert('Session cancelled successfully.');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to cancel session');
    } finally {
      setCancelLoading(false);
    }
  };

  // Get available slots for selected reschedule date
  const rescheduleSlots = rescheduleDate 
    ? rescheduleAvailability.find(a => a.date === rescheduleDate)?.slots?.filter(
        s => !rescheduleAvailability.find(a => a.date === rescheduleDate)?.booked_slots?.includes(s)
      ) || []
    : [];

  // Check if session is within the join window (10 mins before to 15 mins after)
  // Session times are stored in IST (Asia/Kolkata, UTC+5:30)
  const isSessionJoinable = (booking) => {
    // Strategy calls use 'time', coaching sessions use 'time_slot'
    const timeField = booking.time_slot || booking.time;
    if (!timeField) return false;
    
    // Parse the session time as IST (stored timezone)
    // Create date string with explicit IST offset (+05:30)
    const istDateTimeStr = `${booking.date}T${timeField}:00+05:30`;
    const sessionDateTime = new Date(istDateTimeStr);
    
    const now = new Date();
    const windowStart = new Date(sessionDateTime.getTime() - 10 * 60 * 1000); // 10 mins before
    const windowEnd = new Date(sessionDateTime.getTime() + 15 * 60 * 1000);   // 15 mins after
    return now >= windowStart && now <= windowEnd;
  };

  // Get time until session is joinable
  const getTimeUntilJoinable = (booking) => {
    // Strategy calls use 'time', coaching sessions use 'time_slot'
    const timeField = booking.time_slot || booking.time;
    if (!timeField) return null;
    
    // Parse the session time as IST (stored timezone)
    const istDateTimeStr = `${booking.date}T${timeField}:00+05:30`;
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
  const isSessionPastJoinWindow = (booking) => {
    // Strategy calls use 'time', coaching sessions use 'time_slot'
    const timeField = booking.time_slot || booking.time;
    if (!timeField) return false;
    
    // Parse the session time as IST (stored timezone)
    const istDateTimeStr = `${booking.date}T${timeField}:00+05:30`;
    const sessionDateTime = new Date(istDateTimeStr);
    
    const feedbackWindowStart = new Date(sessionDateTime.getTime() + 30 * 60 * 1000); // 30 mins after
    const now = new Date();
    return now >= feedbackWindowStart;
  };

  // Check if session needs feedback
  const needsFeedback = (booking) => {
    return isSessionPastJoinWindow(booking) && !booking.candidate_feedback_submitted;
  };

  // Join session - check in and get meet link
  const handleJoinSession = async (booking) => {
    setJoiningSession(booking.id);
    try {
      // Strategy calls - try to open meet_link directly, then check in for tracking
      if (booking.session_type_category === 'strategy') {
        if (booking.meet_link) {
          window.open(formatMeetingLink(booking.meet_link), '_blank');
          // Also do check-in in background for attendance tracking
          try {
            await axios.post(
              `${BACKEND_URL}/api/sessions/${booking.id}/check-in`,
              {},
              { withCredentials: true }
            );
            fetchData();
          } catch (e) {
            // Non-critical - meeting already opened
            console.warn('Check-in tracking failed (non-critical):', e);
          }
        } else {
          // No meet_link stored - try check-in endpoint which may generate one
          try {
            const response = await axios.post(
              `${BACKEND_URL}/api/sessions/${booking.id}/check-in`,
              {},
              { withCredentials: true }
            );
            if (response.data.success && response.data.meet_link) {
              window.open(formatMeetingLink(response.data.meet_link), '_blank');
              fetchData();
            } else {
              alert('Meeting link not yet available. Your mentor will share the link shortly via email or WhatsApp. Please check your messages or contact support@gradnext.co');
              fetchData();
            }
          } catch (e) {
            alert('Meeting link not yet available. Your mentor will share the link shortly via email or WhatsApp. Please check your messages or contact support@gradnext.co');
          }
        }
        setJoiningSession(null);
        return;
      }
      
      // Coaching session - check in
      const response = await axios.post(
        `${BACKEND_URL}/api/sessions/${booking.id}/check-in`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success && response.data.meet_link) {
        // Open the meeting link in a new tab
        window.open(formatMeetingLink(response.data.meet_link), '_blank');
        // Refresh data to update check-in status
        fetchData();
      } else if (response.data.success) {
        // Check-in successful but no meet link available
        alert('You have checked in successfully!\n\nThe meeting link will be shared by your mentor shortly. Please check:\n• Your email\n• WhatsApp messages\n• Or contact your mentor directly\n\nIf you don\'t receive the link, email us at support@gradnext.co');
        fetchData();
      } else {
        alert('Could not complete check-in. Please try again or contact support@gradnext.co');
      }
    } catch (error) {
      console.error('Failed to join session:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to join session. Please try again.';
      alert(`${errorMsg}\n\nIf the problem persists, contact support@gradnext.co`);
    } finally {
      setJoiningSession(null);
    }
  };

  // Open feedback modal
  const openFeedbackModal = (booking) => {
    setFeedbackBooking(booking);
    setCandidateFeedback({
      mentor_followed_instructions: true,
      rating_facilitation_style: 5,
      rating_feedback_quality: 5,
      rating_overall: 5,
      other_feedback: ''
    });
    setFeedbackModalOpen(true);
  };

  // Submit candidate feedback
  const handleSubmitFeedback = async () => {
    if (!feedbackBooking) return;
    
    // Validate required fields (all except other_feedback)
    if (candidateFeedback.rating_facilitation_style < 1 || 
        candidateFeedback.rating_feedback_quality < 1 || 
        candidateFeedback.rating_overall < 1) {
      alert('Please provide all required ratings before submitting.');
      return;
    }
    
    // If overall rating is ≤ 3, comments are mandatory with 10-word minimum
    if (candidateFeedback.rating_overall <= 3) {
      const comment = (candidateFeedback.other_feedback || '').trim();
      if (!comment) {
        alert('Please provide your comments to help us improve.');
        return;
      }
      const wordCount = comment.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount < 10) {
        alert(`Please provide more detailed comments. Current: ${wordCount} words. Minimum: 10 words.`);
        return;
      }
    }
    
    setSubmittingFeedback(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/feedback/candidate-to-mentor`,
        {
          booking_id: feedbackBooking.id,
          ...candidateFeedback
        },
        { withCredentials: true }
      );
      
      setFeedbackModalOpen(false);
      setFeedbackBooking(null);
      fetchData();
      alert('Thank you! Your feedback has been submitted.');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert(error.response?.data?.detail || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // View mentor feedback for a session
  const handleViewMentorFeedback = async (booking) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/feedback/mentor/${booking.id}`,
        { withCredentials: true }
      );
      setViewingMentorFeedback({
        ...response.data,
        booking_info: {
          mentor_name: booking.mentor_name,
          date: booking.date,
          time_slot: booking.time_slot,
          session_type: booking.session_type
        }
      });
      setViewMentorFeedbackOpen(true);
    } catch (error) {
      console.error('Failed to fetch mentor feedback:', error);
      alert('Could not load feedback. Please try again.');
    }
  };

  // Get sessions sorted by date for "My Sessions" tab
  // Session times are stored in IST (Asia/Kolkata, UTC+5:30)
  const getSessionsSortedByDate = () => {
    const now = new Date();
    const upcoming = [];
    const past = [];
    
    // Default session duration in minutes
    const DEFAULT_DURATION = 45;
    
    myBookings.forEach(booking => {
      const timeField = booking.time_slot || booking.time || '00:00';
      // Parse the session time as IST (stored timezone)
      const istDateTimeStr = `${booking.date}T${timeField}:00+05:30`;
      const sessionDateTime = new Date(istDateTimeStr);
      const sessionDuration = booking.duration || DEFAULT_DURATION;
      
      // Session end time
      const sessionEndTime = new Date(sessionDateTime.getTime() + sessionDuration * 60 * 1000);
      const joinWindowEnd = new Date(sessionDateTime.getTime() + 15 * 60 * 1000); // Join window: 15 mins after start
      
      // IMPORTANT: Terminal sessions (cancelled, no-show, rescheduled) ALWAYS go to past
      // regardless of their scheduled date
      if (isSessionTerminal(booking.status)) {
        past.push(booking);
        return; // continue to next booking
      }
      
      // For active sessions (confirmed, pending), use time-based logic
      const isSessionOngoing = now <= joinWindowEnd && booking.status !== 'completed';
      const isSessionFuture = now < sessionDateTime;
      const isPast = !isSessionFuture && !isSessionOngoing && (now > sessionEndTime || booking.status === 'completed');
      
      if (isPast) {
        past.push(booking);
      } else {
        upcoming.push(booking);
      }
    });
    
    // Sort upcoming: earliest first (soonest session at top)
    upcoming.sort((a, b) => {
      const timeA = a.time_slot || a.time || '00:00';
      const timeB = b.time_slot || b.time || '00:00';
      // Use IST timezone for sorting
      return new Date(`${a.date}T${timeA}:00+05:30`) - new Date(`${b.date}T${timeB}:00+05:30`);
    });
    // Sort past: latest first (most recent session at top)
    past.sort((a, b) => {
      const timeA = a.time_slot || a.time || '00:00';
      const timeB = b.time_slot || b.time || '00:00';
      // Use IST timezone for sorting
      return new Date(`${b.date}T${timeB}:00+05:30`) - new Date(`${a.date}T${timeA}:00+05:30`);
    });
    
    return { upcoming, past };
  };

  const sessionsSorted = getSessionsSortedByDate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen space-y-6 p-6 -m-6"
      style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}
    >
      {/* Header with subtle yellow accent */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>1:1 Coaching</h1>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
          </div>
          <p className="text-slate-500">Book sessions with MBB consultants</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Show expired plan warning */}
          {isPlanExpired && !hasSingleSessions && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              <p className="text-red-700 font-medium text-sm">
                Plan expired - Purchase sessions to book
              </p>
            </div>
          )}
          {hasCoaching && !isPlanExpired && (
            <div className="rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--gn-chrome-lightest)', border: '1px solid var(--gn-chrome-light)' }}>
              <p className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
                {isUnlimitedCoaching ? '∞ Unlimited sessions' : (
                  <>
                    <span className="text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>{sessionsRemaining}</span>
                    <span className="text-sm ml-1">session{sessionsRemaining !== 1 ? 's' : ''} remaining</span>
                  </>
                )}
              </p>
            </div>
          )}
          {/* Show single session credits even if plan expired (they never expire) */}
          {isPlanExpired && hasSingleSessions && (
            <div className="rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--gn-chrome-lightest)', border: '1px solid var(--gn-chrome-lighter)' }}>
              <p className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
                <span className="text-lg font-bold">{sessionsRemaining}</span>
                <span className="text-sm ml-1">purchased session{sessionsRemaining !== 1 ? 's' : ''}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Coaching Status for non-coaching users */}
      {!hasCoaching && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6" style={{ border: '2px solid var(--gn-periwinkle-lighter)' }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <UserCheck className="w-6 h-6" style={{ color: 'var(--gn-rhino)' }} />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--gn-rhino)' }}>Get Expert Coaching</h3>
              <p className="text-sm text-slate-600 mt-1">
                Book 1:1 sessions with experienced MBB consultants who&apos;ve helped hundreds crack interviews.
              </p>
              <Button 
                className="mt-4 bg-[#2E3558] text-white hover:bg-[#363EA7]"
                onClick={openCoachingPlansModal}
              >
                <Award className="w-4 h-4 mr-2" />
                View Coaching Plans
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-container-3d rounded-xl p-1 inline-flex">
        <button
          onClick={() => setActiveTab('book')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'book'
              ? 'bg-[#2E3558] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          data-testid="tab-book-session"
        >
          Book Session
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'bg-[#2E3558] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          data-testid="tab-my-sessions"
        >
          My Sessions {myBookings.length > 0 && `(${myBookings.length})`}
        </button>
      </div>

      {/* Book Session Tab - Mentors Grid */}
      {activeTab === 'book' && (
        <div>
          <div className="space-y-6">
            {/* Book Single Session Button & Search Row */}
            <div className="flex items-center gap-4">
              {/* Book Single Session Button - Left side */}
              <Button 
                onClick={openTopUpModal}
                className="text-white whitespace-nowrap"
                style={{ backgroundColor: 'var(--gn-rhino)' }}
                data-testid="book-single-session-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Book Single Session
              </Button>
              
              {/* Search - Right side */}
              <div className="flex-1 max-w-md ml-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, company, or expertise..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="mentor-search-input"
                  />
                </div>
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
                  <Select value={filterCompany} onValueChange={setFilterCompany}>
                    <SelectTrigger className="w-[160px] bg-white" data-testid="filter-company">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {uniqueCompanies.map(company => (
                        <SelectItem key={company} value={company}>{company}</SelectItem>
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
                  
                  {/* Time Slot Filter Toggle */}
                  <Button 
                    variant={showTimeFilter ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setShowTimeFilter(!showTimeFilter)}
                    className={showTimeFilter ? "bg-blue-600 hover:bg-blue-700" : ""}
                    data-testid="time-filter-toggle"
                  >
                    <Clock className="w-4 h-4 mr-1" />
                    Time Slot
                    {timeFilteredMentorIds !== null && (
                      <span className="ml-1 px-1.5 py-0.5 bg-white text-blue-600 rounded-full text-xs font-bold">
                        {timeFilteredMentorIds.size}
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
                          data-testid="filter-from-date"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">From Time</label>
                        <Input
                          type="time"
                          value={filterFromTime}
                          onChange={(e) => setFilterFromTime(e.target.value)}
                          className="bg-white"
                          data-testid="filter-from-time"
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
                          data-testid="filter-to-date"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">To Time</label>
                        <Input
                          type="time"
                          value={filterToTime}
                          onChange={(e) => setFilterToTime(e.target.value)}
                          className="bg-white"
                          data-testid="filter-to-time"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        onClick={applyTimeSlotFilter}
                        disabled={timeFilterLoading || !filterFromDate || !filterFromTime || !filterToDate || !filterToTime}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="apply-time-filter"
                      >
                        {timeFilterLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-1" />
                            Apply Filter
                          </>
                        )}
                      </Button>
                      {timeFilteredMentorIds !== null && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={clearTimeSlotFilter}
                          data-testid="clear-time-filter"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                    {timeFilteredMentorIds !== null && (
                      <p className="text-xs text-blue-700 mt-2">
                        Found {timeFilteredMentorIds.size} mentor{timeFilteredMentorIds.size !== 1 ? 's' : ''} available in this time window
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
                    <SelectTrigger className="w-full bg-white border-blue-200" data-testid="sort-by-mentors">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earliest">Earliest Availability</SelectItem>
                      <SelectItem value="rating">Highest Rating</SelectItem>
                      <SelectItem value="sessions">Most Sessions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Mentor Cards */}
            {sortedMentors.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No mentors found matching your filters</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                {sortedMentors.map((mentor) => {
                  // Determine if consulting firm is current company
                  const consultingFirm = mentor.consulting_firm || '';
                  const currentCompany = mentor.current_company || '';
                  const isConsultingCurrent = consultingFirm && currentCompany && 
                    consultingFirm.toLowerCase() === currentCompany.toLowerCase();
                  
                  // Get company logos for mentor
                  const consultingLogo = getCompanyLogo(consultingFirm);
                  const currentCompanyLogo = getCompanyLogo(currentCompany);
                  const prevCompany1Logo = getCompanyLogo(mentor.previous_company_1);
                  const prevCompany2Logo = getCompanyLogo(mentor.previous_company_2);
                  
                  // Build Line 2 text based on whether consulting firm is current company
                  let line2Companies = [];
                  if (isConsultingCurrent) {
                    // Consulting firm is current company: show Past Company 1, Past Company 2
                    if (mentor.previous_company_1) line2Companies.push(mentor.previous_company_1);
                    if (mentor.previous_company_2) line2Companies.push(mentor.previous_company_2);
                  } else {
                    // Consulting firm is NOT current company: show Current Company, Past Company 1, Past Company 2
                    if (currentCompany) line2Companies.push(currentCompany);
                    if (mentor.previous_company_1) line2Companies.push(mentor.previous_company_1);
                    if (mentor.previous_company_2) line2Companies.push(mentor.previous_company_2);
                  }
                  
                  // Build experience logos: All companies - Consulting, Current, Previous 1, Previous 2, College
                  const companyLogos = [];
                  if (consultingLogo && consultingFirm) {
                    companyLogos.push({ name: consultingFirm, logo: consultingLogo });
                  }
                  if (currentCompanyLogo && currentCompany && currentCompany.toLowerCase() !== consultingFirm.toLowerCase()) {
                    companyLogos.push({ name: currentCompany, logo: currentCompanyLogo });
                  }
                  if (prevCompany1Logo && mentor.previous_company_1) {
                    companyLogos.push({ name: mentor.previous_company_1, logo: prevCompany1Logo });
                  }
                  if (prevCompany2Logo && mentor.previous_company_2) {
                    companyLogos.push({ name: mentor.previous_company_2, logo: prevCompany2Logo });
                  }
                  // Add college logo
                  const collegeLogo = getCompanyLogo(mentor.college);
                  if (collegeLogo && mentor.college) {
                    companyLogos.push({ name: mentor.college, logo: collegeLogo });
                  }
                  
                  return (
                    <div
                      key={mentor.id}
                      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all flex flex-col h-full"
                      style={{ border: '1px solid var(--gn-grey-light)' }}
                      data-testid={`mentor-card-${mentor.id}`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="relative">
                          <img
                            src={mentor.picture}
                            alt="Coach"
                            className="w-16 h-16 rounded-xl object-cover"
                            style={{ border: '2px solid var(--gn-periwinkle-lighter)' }}
                          />
                          {mentor.is_top_coach && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}>
                              <Award className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Line 1: Mentor Name */}
                          <p className="font-bold text-base mb-0.5" style={{ color: 'var(--gn-rhino)' }}>
                            {mentor.name}
                          </p>
                          {/* Line 2: Position, Company | College */}
                          <h3 className="font-semibold text-sm leading-tight mb-1" style={{ color: 'var(--gn-grey-dark)' }}>
                            {mentor.consulting_position || mentor.title || 'Consultant'}, {consultingFirm || 'Consulting'}
                            {mentor.college && <span> | {mentor.college}</span>}
                          </h3>
                          {/* Line 3: Headline (wraps to max 2 lines) */}
                          {mentor.headline && (
                            <p className="text-xs line-clamp-2" style={{ color: 'var(--gn-grey)' }}>
                              {mentor.headline}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Company Logos Row */}
                      {companyLogos.length > 0 && (
                        <div className="flex items-center gap-2 mb-4 py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--gn-grey-lightest)' }}>
                          <span className="text-xs font-medium" style={{ color: 'var(--gn-grey)' }}>Experience:</span>
                          <div className="flex items-center gap-2 flex-1 overflow-hidden">
                            {companyLogos.slice(0, 5).map((c, idx) => (
                              <div
                                key={idx}
                                className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1.5"
                                style={{ border: '1px solid var(--gn-grey-light)' }}
                                title={c.name}
                              >
                                <img
                                  src={c.logo}
                                  alt={c.name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm mb-3" style={{ color: 'var(--gn-grey-dark)' }}>
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400" style={{ color: 'var(--gn-chrome-yellow)' }} />
                          <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
                            {mentor.rating !== null && mentor.rating !== undefined 
                              ? Number(mentor.rating).toFixed(1) 
                              : 'NA'}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Award className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                          {mentor.sessions_conducted || 0} sessions
                        </span>
                      </div>
                      
                      {/* Earliest Availability */}
                      <div className="flex items-center gap-2 text-sm mb-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                        <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gn-periwinkle)' }} />
                        {loadingEarliestSlots ? (
                          <span style={{ color: 'var(--gn-grey)' }}>Loading...</span>
                        ) : mentorsEarliestSlots[mentor.id] ? (
                          (() => {
                            const slot = mentorsEarliestSlots[mentor.id];
                            const conv = istToViewer(slot.date, slot.time, viewerTz);
                            const dateObj = new Date(`${conv.date}T${conv.time}:00`);
                            return (
                              <span className="font-medium" style={{ color: 'var(--gn-rhino)' }} title={`Mentor's local: ${slot.time} IST`}>
                                Next: {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {format12hWithAbbr(conv.time, viewerTz)}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="italic" style={{ color: 'var(--gn-grey)' }}>No availability</span>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => handleMentorClick(mentor)}
                        className="w-full text-white rounded-xl font-medium mt-auto"
                        style={{ backgroundColor: 'var(--gn-rhino)' }}
                        data-testid={`book-now-mentor-${mentor.id}`}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Book Now
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Sessions Tab - Sorted by date */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {myBookings.length === 0 ? (
            <div className="card-3d-base rounded-xl p-8 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold card-header-dark mb-2">No sessions yet</h3>
              <p className="text-slate-500 mb-4">Book your first session with one of our expert mentors</p>
              <Button onClick={() => setActiveTab('book')} className="bg-[#2E3558] hover:bg-[#363EA7]">
                Browse Mentors
              </Button>
            </div>
          ) : (
            <>
              {/* Upcoming Sessions */}
              {sessionsSorted.upcoming.length > 0 && (
                <div className="card-3d-base rounded-xl overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-emerald-900">Upcoming Sessions</h3>
                        <p className="text-xs text-emerald-600">{sessionsSorted.upcoming.length} session{sessionsSorted.upcoming.length !== 1 ? 's' : ''} scheduled</p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {sessionsSorted.upcoming.map((booking) => (
                      <div key={booking.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Mentor Avatar */}
                          <img
                            src={booking.mentor_picture || `https://ui-avatars.com/api/?name=${booking.mentor_name}&background=0D8ABC&color=fff`}
                            alt={booking.mentor_name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                          />
                          
                          {/* Session Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold card-header-dark">{booking.mentor_name}</h4>
                                  {booking.session_type_category === 'strategy' && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                      Strategy Call
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-500">{booking.mentor_title} • {booking.mentor_company}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {(() => {
                                  const conv = istToViewer(booking.date, booking.time_slot, viewerTz);
                                  const dateObj = new Date(`${conv.date}T${conv.time}:00`);
                                  return (
                                    <>
                                      <p className="text-sm font-semibold card-header-dark">
                                        {dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                      </p>
                                      <p
                                        className="text-sm text-blue-600 font-medium"
                                        title={`Mentor's local: ${booking.time_slot} IST`}
                                      >
                                        {format12hWithAbbr(conv.time, viewerTz)}
                                      </p>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-3">
                              {/* Join Button with Timer */}
                              <div className="flex flex-col items-center">
                                <Button
                                  size="sm"
                                  onClick={() => handleJoinSession(booking)}
                                  disabled={!isSessionJoinable(booking) || joiningSession === booking.id}
                                  className={isSessionJoinable(booking) 
                                    ? "bg-green-600 hover:bg-green-700 text-white" 
                                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                                  }
                                >
                                  {joiningSession === booking.id ? (
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Video className="w-3 h-3 mr-1" />
                                  )}
                                  {isSessionJoinable(booking) ? 'Join Now' : 'Join'}
                                </Button>
                                {!isSessionJoinable(booking) && getTimeUntilJoinable(booking) && (
                                  <span className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Live in {getTimeUntilJoinable(booking)}
                                  </span>
                                )}
                              </div>
                              {/* Reschedule and Cancel for all sessions */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRescheduleModal(booking)}
                                className="text-slate-600"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Reschedule
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCancelBooking(booking)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`cancel-session-${booking.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                            {/* Cancellation deadline info */}
                            {(() => {
                              const sessionDateTime = new Date(`${booking.date}T${booking.time_slot || booking.time || '00:00'}:00+05:30`);
                              const policyHours = cancellationPolicy?.candidate_hours || 4;
                              const deadline = new Date(sessionDateTime.getTime() - (policyHours * 60 * 60 * 1000));
                              const now = new Date();
                              const canCancel = now < deadline;
                              return (
                                <div className="mt-2 text-xs">
                                  {canCancel ? (
                                    <span className="text-green-600">
                                      ✓ Free cancellation until {deadline.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                    </span>
                                  ) : (
                                    <span className="text-amber-600">
                                      ⚠ Cancellation deadline passed - credits will not be restored
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past Sessions */}
              {sessionsSorted.past.length > 0 && (
                <div className="card-3d-base rounded-xl overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold card-header-dark">Past Sessions</h3>
                        <p className="text-xs text-slate-500">{sessionsSorted.past.length} completed session{sessionsSorted.past.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {sessionsSorted.past.map((booking) => (
                      <div key={booking.id} className={`p-4 ${isSessionTerminal(booking.status) ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/50'} transition-colors`}>
                        <div className="flex items-start gap-4">
                          {/* Mentor Avatar */}
                          <img
                            src={booking.mentor_picture || `https://ui-avatars.com/api/?name=${booking.mentor_name}&background=0D8ABC&color=fff`}
                            alt={booking.mentor_name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0 grayscale-[30%]"
                          />
                          
                          {/* Session Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="font-semibold card-header-dark">{booking.mentor_name}</h4>
                                <p className="text-sm text-slate-500">{booking.mentor_title} • {booking.mentor_company}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {(() => {
                                  const conv = istToViewer(booking.date, booking.time_slot, viewerTz);
                                  return (
                                    <>
                                      <p className="text-sm font-medium text-slate-600">
                                        {new Date(conv.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </p>
                                      <p className="text-xs text-slate-400" title={`${booking.time_slot} IST`}>
                                        {conv.time} {viewerTzAbbr}
                                      </p>
                                    </>
                                  );
                                })()}
                                {isSessionCancelled(booking.status) && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">{booking.status?.replace(/_/g, ' ')}</span>
                                )}
                                {isSessionNoShow(booking.status) && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">{booking.status?.replace(/_/g, ' ')}</span>
                                )}
                                {isSessionRescheduled(booking.status) && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">{booking.status?.replace(/_/g, ' ')}</span>
                                )}
                                {booking.status === 'completed' && (
                                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">Completed</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Action Buttons for Past Sessions */}
                            {!isSessionTerminal(booking.status) && (
                              <div className="flex items-center gap-2 mt-3">
                                {!booking.candidate_feedback_submitted ? (
                                  <Button
                                    size="sm"
                                    onClick={() => openFeedbackModal(booking)}
                                    className="bg-amber-500 hover:bg-amber-600 text-white"
                                  >
                                    <Star className="w-3 h-3 mr-1" />
                                    Leave Feedback
                                  </Button>
                                ) : (
                                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    Feedback submitted
                                  </span>
                                )}
                                {booking.mentor_feedback_submitted && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewMentorFeedback(booking)}
                                    className="text-blue-600"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Mentor Feedback
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No upcoming sessions message */}
              {sessionsSorted.upcoming.length === 0 && sessionsSorted.past.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-blue-700 mb-2">You have no upcoming sessions</p>
                  <Button onClick={() => setActiveTab('book')} size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Book a New Session
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Book Session Modal */}
      <Dialog open={!!selectedMentor} onOpenChange={() => setSelectedMentor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {`Book Session with ${selectedMentor?.name || ''}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedMentor && (
              <>
                {/* Mentor Info + Timezone - Compact Row */}
                <div className="flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <img
                        src={selectedMentor.picture}
                        alt="Coach"
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>
                          {selectedMentor.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedMentor.consulting_position || selectedMentor.title}, {selectedMentor.company}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Globe className="w-3.5 h-3.5" />
                      <span>{getTimezoneAbbr(user?.timezone || 'Asia/Kolkata')}</span>
                    </div>
                  </div>
                
                {!hasCoaching ? (
                  <div className="p-4 bg-amber-50 rounded-lg text-amber-800">
                    <p>Coaching access has been disabled on your account. Please contact support.</p>
                  </div>
                ) : availabilityLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-center">
                      <span className="text-slate-600 block">Loading availability...</span>
                      <span className="text-xs text-slate-400">Syncing with mentor&apos;s calendar</span>
                    </div>
                  </div>
                ) : availability.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-slate-600 text-center">
                    <p>No availability found for this mentor.</p>
                    <p className="text-sm mt-1">Please try again or select a different mentor.</p>
                  </div>
                ) : (
                  <>
                    {/* Session Type and Case Type - Side by Side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Session Type <span className="text-red-500">*</span></label>
                        <Select value={sessionType} onValueChange={setSessionType}>
                          <SelectTrigger data-testid="session-type-select">
                            <SelectValue placeholder="Select session type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Case session">Case Session</SelectItem>
                            <SelectItem value="Fit Interview">Fit Interview</SelectItem>
                            <SelectItem value="PEI session">PEI Session</SelectItem>
                            <SelectItem value="CV review session">CV Review Session</SelectItem>
                            <SelectItem value="General discussion">General Discussion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Case Type Selection - only shown for Case sessions */}
                      {sessionType === 'Case session' ? (
                        <div>
                          <label className="text-sm font-medium text-slate-700 block mb-1.5">Case Type <span className="text-red-500">*</span></label>
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
                              <SelectItem value="Random">Random</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div></div>
                      )}
                    </div>

                {/* Additional Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Additional Comments (Optional)</label>
                  <Textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Any specific topics or areas of focus..."
                    className="min-h-[50px]"
                    data-testid="session-notes-input"
                  />
                </div>

                {/* Date and Time Selection - Side by Side Layout */}
                <div className="border-t pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Dates on Left */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Select Date</label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {availability.map((slot) => (
                          <button
                            key={slot.date}
                            onClick={() => { setBookingDate(slot.date); setBookingSlot(null); }}
                            className={`p-1.5 text-xs rounded-lg border transition-colors ${
                              bookingDate === slot.date
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Time Slots on Right */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">
                        Select Time <span className="text-blue-600 font-semibold">(Your time · {viewerTzAbbr})</span>
                      </label>
                      {bookingDate ? (
                        <>
                          <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {availability
                              .find(a => a.date === bookingDate)
                              ?.slots?.filter(s => !availability.find(a => a.date === bookingDate)?.booked_slots?.includes(s))
                              .map((time) => {
                                const conv = istToViewer(bookingDate, time, viewerTz);
                                const display = format12hWithAbbr(conv.time, viewerTz);
                                return (
                                  <button
                                    key={time}
                                    onClick={() => setBookingSlot(time)}
                                    title={`Mentor's local time: ${time} IST`}
                                    className={`p-1.5 text-xs rounded-lg border transition-colors ${
                                      bookingSlot === time
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'
                                    }`}
                                  >
                                    {display}
                                  </button>
                                );
                              })}
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                            Showing in your timezone ({viewerTzAbbr}) · mentor sets times in IST
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Select a date first</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Cancellation Policy Notice */}
                {bookingDate && bookingSlot && (
                  <div className="p-2 bg-blue-50 rounded-lg text-xs text-blue-800 border border-blue-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        <strong>Cancellation Policy:</strong> Free cancellation until {(() => {
                          const sessionDateTime = new Date(`${bookingDate}T${bookingSlot}:00`);
                          const policyHours = cancellationPolicy?.candidate_hours || 4;
                          const deadline = new Date(sessionDateTime.getTime() - (policyHours * 60 * 60 * 1000));
                          return deadline.toLocaleString('en-IN', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric', 
                            hour: 'numeric', 
                            minute: '2-digit', 
                            hour12: true 
                          });
                        })()}.
                      </span>
                    </div>
                  </div>
                )}
                
                <DialogFooter className="flex-col sm:flex-col gap-3 items-stretch">
                  {/* Payment method picker */}
                  {bookingDate && bookingSlot && sessionType && (sessionType !== 'Case session' || caseType) && (
                    <div className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Payment</p>
                      {(sessionsRemaining > 0 || isUnlimitedCoaching) && (
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-white border border-transparent has-[:checked]:border-blue-300 has-[:checked]:bg-white">
                          <input
                            type="radio"
                            name="payment-method"
                            checked={!payDirect}
                            onChange={() => setPayDirect(false)}
                            data-testid="pay-with-credit-radio"
                          />
                          <div className="flex-1 text-sm">
                            <span className="font-medium text-slate-900">Use 1 credit</span>
                            <span className="text-slate-500 ml-2">
                              {isUnlimitedCoaching ? '(unlimited)' : `(${sessionsRemaining} left)`}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-green-700">FREE</span>
                        </label>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-white border border-transparent has-[:checked]:border-blue-300 has-[:checked]:bg-white">
                        <input
                          type="radio"
                          name="payment-method"
                          checked={payDirect || (sessionsRemaining === 0 && !isUnlimitedCoaching)}
                          onChange={() => setPayDirect(true)}
                          data-testid="pay-direct-radio"
                        />
                        <div className="flex-1 text-sm">
                          <span className="font-medium text-slate-900">Pay & book this session</span>
                          <span className="text-slate-500 ml-2 block sm:inline">Razorpay · GST included</span>
                        </div>
                        <span className="text-sm font-semibold text-blue-700">
                          ₹{aLaCarteBreakdown.total || sessionPrice?.total_price || sessionPrice?.base_price || '—'}
                        </span>
                      </label>

                      {/* Coupon + price breakdown — visible only when paying directly */}
                      {(payDirect || (sessionsRemaining === 0 && !isUnlimitedCoaching)) && sessionPrice?.base_price && (
                        <div className="mt-2 space-y-2 rounded-md bg-white p-3 border border-slate-200">
                          {/* Coupon row */}
                          {aLaCarteAppliedCoupon ? (
                            <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2">
                              <div className="text-xs">
                                <span className="font-semibold text-green-800">{aLaCarteAppliedCoupon.code}</span>
                                <span className="text-green-700"> applied · –₹{Number(aLaCarteAppliedCoupon.discount_amount).toLocaleString('en-IN')}</span>
                              </div>
                              <button onClick={removeALaCarteCoupon} type="button" className="text-xs text-green-800 underline hover:text-green-900" data-testid="alacarte-coupon-remove">
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={aLaCarteCouponCode}
                                  onChange={(e) => { setALaCarteCouponCode(e.target.value); setALaCarteCouponError(''); }}
                                  placeholder="Have a coupon?"
                                  className="flex-1 text-xs px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  data-testid="alacarte-coupon-input"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleApplyALaCarteCoupon}
                                  disabled={aLaCarteCouponLoading}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  data-testid="alacarte-coupon-apply"
                                >
                                  {aLaCarteCouponLoading ? '…' : 'Apply'}
                                </Button>
                              </div>
                              {aLaCarteCouponError && <p className="mt-1.5 text-xs text-red-600">{aLaCarteCouponError}</p>}
                            </div>
                          )}

                          {/* Breakdown */}
                          <div className="space-y-1 pt-2 border-t border-slate-100 text-xs">
                            <div className="flex justify-between text-slate-600">
                              <span>Session base</span>
                              <span>₹{Number(aLaCarteBreakdown.base).toLocaleString('en-IN')}</span>
                            </div>
                            {aLaCarteBreakdown.discount > 0 && (
                              <div className="flex justify-between text-green-700">
                                <span>Coupon discount</span>
                                <span>–₹{Number(aLaCarteBreakdown.discount).toLocaleString('en-IN')}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-slate-600">
                              <span>GST (18%)</span>
                              <span>₹{Number(aLaCarteBreakdown.gst).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                              <span>Total</span>
                              <span>₹{Number(aLaCarteBreakdown.total).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setSelectedMentor(null)}>Cancel</Button>
                    <Button
                      onClick={handleBookSession}
                      disabled={!bookingDate || !bookingSlot || !sessionType || (sessionType === 'Case session' && !caseType) || bookingLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="confirm-booking-btn"
                    >
                      {bookingLoading
                        ? (payDirect || (sessionsRemaining === 0 && !isUnlimitedCoaching) ? 'Processing payment…' : 'Booking…')
                        : (payDirect || (sessionsRemaining === 0 && !isUnlimitedCoaching)
                            ? `Pay ₹${aLaCarteBreakdown.total || sessionPrice?.total_price || sessionPrice?.base_price || ''} & Book`
                            : 'Book Session')}
                    </Button>
                  </div>
                </DialogFooter>
              </>
            )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={!!rescheduleBooking} onOpenChange={() => setRescheduleBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              {(() => {
                if (!rescheduleBooking) return null;
                const t = rescheduleBooking.time_slot || rescheduleBooking.time;
                const conv = istToViewer(rescheduleBooking.date, t, viewerTz);
                return (
                  <p className="text-sm text-slate-600" title={`${rescheduleBooking.date} ${t} IST`}>
                    Current: {new Date(conv.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {format12hWithAbbr(conv.time, viewerTz)} with {rescheduleBooking.mentor_name}
                  </p>
                );
              })()}
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Mentor</label>
              <Select value={rescheduleMentor} onValueChange={handleMentorChange}>
                <SelectTrigger data-testid="reschedule-mentor-select">
                  <SelectValue placeholder="Select mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map(mentor => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.name} - {mentor.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select New Date</label>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {rescheduleAvailability.map((slot) => (
                  <button
                    key={slot.date}
                    onClick={() => { setRescheduleDate(slot.date); setRescheduleSlot(''); }}
                    className={`p-2 text-sm rounded-lg border transition-colors ${
                      rescheduleDate === slot.date
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </button>
                ))}
              </div>
            </div>

            {rescheduleDate && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Select New Time <span className="text-blue-600 font-semibold">(Your time · {viewerTzAbbr})</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {rescheduleSlots.map((time) => {
                    const conv = istToViewer(rescheduleDate, time, viewerTz);
                    return (
                      <button
                        key={time}
                        onClick={() => setRescheduleSlot(time)}
                        title={`Mentor's local: ${time} IST`}
                        className={`p-2 text-sm rounded-lg border transition-colors ${
                          rescheduleSlot === time
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-200'
                        }`}
                      >
                        {format12hWithAbbr(conv.time, viewerTz)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reschedule Policy Warning */}
            {rescheduleBooking && (
              <div className="p-3 rounded-lg text-sm border">
                {(() => {
                  const sessionDateTime = new Date(`${rescheduleBooking.date}T${rescheduleBooking.time_slot || '00:00'}:00+05:30`);
                  const policyHours = cancellationPolicy?.candidate_hours || 4;
                  const deadline = new Date(sessionDateTime.getTime() - (policyHours * 60 * 60 * 1000));
                  const now = new Date();
                  const canReschedule = now < deadline;
                  
                  return canReschedule ? (
                    <div className="bg-green-50 border-green-200 text-green-800 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Free reschedule:</strong> No credit will be lost.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border-amber-200 text-amber-800 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Late reschedule:</strong> This counts as a late change. Session credit will not be restored if you cancel later.</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleBooking(null)}>Cancel</Button>
              <Button 
                onClick={handleReschedule} 
                disabled={!rescheduleDate || !rescheduleSlot || rescheduleLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {rescheduleLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Modal */}
      <Dialog open={!!cancelBooking} onOpenChange={() => setCancelBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Cancel Session
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              if (!cancelBooking) return null;
              const t = cancelBooking.time_slot || cancelBooking.time;
              const conv = istToViewer(cancelBooking.date, t, viewerTz);
              const dateLabel = new Date(conv.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <p className="text-slate-600" title={`${cancelBooking.date} ${t} IST`}>
                  Are you sure you want to cancel your session with <strong>{cancelBooking.mentor_name}</strong> on{' '}
                  <strong>{dateLabel}</strong> at <strong>{format12hWithAbbr(conv.time, viewerTz)}</strong>?
                </p>
              );
            })()}
            {/* Dynamic warning based on cancellation policy */}
            {(() => {
              if (!cancelBooking) return null;
              const sessionDateTime = new Date(`${cancelBooking.date}T${cancelBooking.time_slot || '00:00'}:00+05:30`);
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
              <Button variant="outline" onClick={() => setCancelBooking(null)}>Keep Session</Button>
              <Button 
                onClick={handleCancel} 
                disabled={cancelLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {cancelLoading ? 'Cancelling...' : 'Yes, Cancel Session'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Candidate Feedback Modal */}
      <Dialog open={feedbackModalOpen} onOpenChange={() => setFeedbackModalOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Rate Your Session
            </DialogTitle>
          </DialogHeader>
          
          {feedbackBooking && (
            <div className="space-y-5">
              {/* Session Info */}
              <div className="p-3 bg-slate-50 rounded-lg">
                {(() => {
                  const conv = istToViewer(feedbackBooking.date, feedbackBooking.time_slot, viewerTz);
                  const dateLabel = new Date(conv.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <p className="text-sm text-slate-600" title={`${feedbackBooking.date} ${feedbackBooking.time_slot} IST`}>
                      Session with <strong>{feedbackBooking.mentor_name}</strong> on{' '}
                      <strong>{dateLabel}</strong> at <strong>{format12hWithAbbr(conv.time, viewerTz)}</strong>
                    </p>
                  );
                })()}
              </div>

              {/* Question 1: Did mentor follow instructions? */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Did the mentor follow your session instructions/requirements?
                </Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCandidateFeedback(prev => ({...prev, mentor_followed_instructions: true}))}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      candidateFeedback.mentor_followed_instructions
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    data-testid="feedback-followed-yes"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCandidateFeedback(prev => ({...prev, mentor_followed_instructions: false}))}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      !candidateFeedback.mentor_followed_instructions
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    data-testid="feedback-followed-no"
                  >
                    <X className="w-4 h-4 inline mr-2" />
                    No
                  </button>
                </div>
              </div>

              {/* Rating: Facilitation Style */}
              <StarRating
                label="Facilitation Style *"
                value={candidateFeedback.rating_facilitation_style}
                onChange={(val) => setCandidateFeedback(prev => ({...prev, rating_facilitation_style: val}))}
              />

              {/* Rating: Feedback Quality */}
              <StarRating
                label="Quality of Feedback Provided *"
                value={candidateFeedback.rating_feedback_quality}
                onChange={(val) => setCandidateFeedback(prev => ({...prev, rating_feedback_quality: val}))}
              />

              {/* Rating: Overall */}
              <StarRating
                label="Overall Session Rating *"
                value={candidateFeedback.rating_overall}
                onChange={(val) => setCandidateFeedback(prev => ({...prev, rating_overall: val}))}
              />

              {/* Optional Comments */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Additional Comments {candidateFeedback.rating_overall > 0 && candidateFeedback.rating_overall <= 3 && <span className="text-red-600">*</span>}
                </Label>
                {candidateFeedback.rating_overall > 0 && candidateFeedback.rating_overall <= 3 && (
                  <p className="text-xs text-amber-600 mb-1">
                    ⚠️ Please provide your comments to help us improve.
                  </p>
                )}
                <Textarea
                  value={candidateFeedback.other_feedback}
                  onChange={(e) => setCandidateFeedback(prev => ({...prev, other_feedback: e.target.value}))}
                  placeholder={candidateFeedback.rating_overall > 0 && candidateFeedback.rating_overall <= 3 ? "Please share your feedback (minimum 10 words)..." : "Share any additional feedback about your experience..."}
                  className="min-h-[80px]"
                  data-testid="feedback-comments"
                />
                {candidateFeedback.rating_overall > 0 && candidateFeedback.rating_overall <= 3 && candidateFeedback.other_feedback && (
                  <p className="text-xs text-slate-500">
                    Word count: {candidateFeedback.other_feedback.trim().split(/\s+/).filter(w => w.length > 0).length} / 10 minimum
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setFeedbackModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitFeedback}
                  disabled={submittingFeedback || 
                    candidateFeedback.rating_facilitation_style < 1 || 
                    candidateFeedback.rating_feedback_quality < 1 || 
                    candidateFeedback.rating_overall < 1}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="submit-feedback-btn"
                >
                  {submittingFeedback ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Mentor Feedback Modal - Detailed View */}
      <Dialog open={viewMentorFeedbackOpen} onOpenChange={setViewMentorFeedbackOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-blue-600" />
              Session Feedback
            </DialogTitle>
          </DialogHeader>
          {viewingMentorFeedback && (
            <div className="space-y-5">
              {/* Session Info Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      Feedback from {viewingMentorFeedback.booking_info?.mentor_name || viewingMentorFeedback.mentor_name || 'Mentor'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {(() => {
                        const bi = viewingMentorFeedback.booking_info;
                        if (!bi?.date) return null;
                        const conv = istToViewer(bi.date, bi.time_slot, viewerTz);
                        const dateLabel = new Date(conv.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                        return (
                          <span title={`${bi.date} ${bi.time_slot} IST`}>
                            {dateLabel} • {format12hWithAbbr(conv.time, viewerTz)}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                </div>
                {/* Session Type & Case Type Tags */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
                    {viewingMentorFeedback.session_type || viewingMentorFeedback.booking_info?.session_type || 'Coaching Session'}
                  </span>
                  {viewingMentorFeedback.case_type && (
                    <span className="px-3 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded-full">
                      {viewingMentorFeedback.case_type}
                    </span>
                  )}
                </div>
              </div>

              {/* Overall Rating - Prominent Display */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                <p className="text-sm font-medium text-slate-500 mb-2">Overall Performance</p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-8 h-8 ${
                        n <= (viewingMentorFeedback.rating_overall || 0)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {viewingMentorFeedback.rating_overall || 0}/5
                </p>
              </div>

              {/* Detailed Ratings Grid - Dynamic based on session type */}
              {viewingMentorFeedback.session_type && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Performance Breakdown
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Case Session Ratings */}
                    {viewingMentorFeedback.session_type === 'Case session' && (
                      <>
                        {viewingMentorFeedback.rating_problem_understanding > 0 && (
                          <RatingDisplayItem label="Problem Understanding & Scoping" value={viewingMentorFeedback.rating_problem_understanding} />
                        )}
                        {viewingMentorFeedback.rating_framework_structure > 0 && (
                          <RatingDisplayItem label="Framework and Structure" value={viewingMentorFeedback.rating_framework_structure} />
                        )}
                        {viewingMentorFeedback.rating_case_math > 0 && (
                          <RatingDisplayItem label="Case Math" value={viewingMentorFeedback.rating_case_math} />
                        )}
                        {viewingMentorFeedback.rating_business_judgment > 0 && (
                          <RatingDisplayItem label="Business Judgment & Insights" value={viewingMentorFeedback.rating_business_judgment} />
                        )}
                        {viewingMentorFeedback.rating_communication_synthesis > 0 && (
                          <RatingDisplayItem label="Communication & Synthesis" value={viewingMentorFeedback.rating_communication_synthesis} />
                        )}
                        {/* Legacy case session fields */}
                        {viewingMentorFeedback.rating_scoping_questions > 0 && (
                          <RatingDisplayItem label="Scoping Questions" value={viewingMentorFeedback.rating_scoping_questions} />
                        )}
                        {viewingMentorFeedback.rating_case_structure > 0 && (
                          <RatingDisplayItem label="Case Structure" value={viewingMentorFeedback.rating_case_structure} />
                        )}
                        {viewingMentorFeedback.rating_quantitative > 0 && viewingMentorFeedback.quantitative_tested !== false && (
                          <RatingDisplayItem label="Quantitative Ability" value={viewingMentorFeedback.rating_quantitative} />
                        )}
                        {viewingMentorFeedback.rating_communication > 0 && (
                          <RatingDisplayItem label="Communication" value={viewingMentorFeedback.rating_communication} />
                        )}
                        {viewingMentorFeedback.rating_business_acumen > 0 && (
                          <RatingDisplayItem label="Business Acumen" value={viewingMentorFeedback.rating_business_acumen} />
                        )}
                      </>
                    )}
                    
                    {/* PEI Session Ratings */}
                    {viewingMentorFeedback.session_type === 'PEI session' && (
                      <>
                        {viewingMentorFeedback.rating_leadership_story > 0 && (
                          <RatingDisplayItem label="Leadership Story" value={viewingMentorFeedback.rating_leadership_story} />
                        )}
                        {viewingMentorFeedback.rating_connection_growth > 0 && (
                          <RatingDisplayItem label="Connection Growth" value={viewingMentorFeedback.rating_connection_growth} />
                        )}
                        {viewingMentorFeedback.rating_drive_story > 0 && (
                          <RatingDisplayItem label="Drive Story" value={viewingMentorFeedback.rating_drive_story} />
                        )}
                        {viewingMentorFeedback.rating_growth_story > 0 && (
                          <RatingDisplayItem label="Growth Story" value={viewingMentorFeedback.rating_growth_story} />
                        )}
                      </>
                    )}
                    
                    {/* CV Review Session Ratings */}
                    {viewingMentorFeedback.session_type === 'CV review session' && (
                      <>
                        {viewingMentorFeedback.rating_cv_layout > 0 && (
                          <RatingDisplayItem label="CV Layout & Formatting" value={viewingMentorFeedback.rating_cv_layout} />
                        )}
                        {viewingMentorFeedback.rating_experience_clarity > 0 && (
                          <RatingDisplayItem label="Experience Descriptions" value={viewingMentorFeedback.rating_experience_clarity} />
                        )}
                        {viewingMentorFeedback.rating_quantification > 0 && (
                          <RatingDisplayItem label="Quantification of Achievements" value={viewingMentorFeedback.rating_quantification} />
                        )}
                        {viewingMentorFeedback.rating_relevance_prioritization > 0 && (
                          <RatingDisplayItem label="Relevance & Prioritization" value={viewingMentorFeedback.rating_relevance_prioritization} />
                        )}
                        {viewingMentorFeedback.rating_language_grammar > 0 && (
                          <RatingDisplayItem label="Language & Grammar" value={viewingMentorFeedback.rating_language_grammar} />
                        )}
                      </>
                    )}
                    
                    {/* FIT Session Ratings */}
                    {viewingMentorFeedback.session_type === 'FIT session' && (
                      <>
                        {viewingMentorFeedback.rating_self_introduction > 0 && (
                          <RatingDisplayItem label="Self-Introduction & Presence" value={viewingMentorFeedback.rating_self_introduction} />
                        )}
                        {viewingMentorFeedback.rating_leadership_examples > 0 && (
                          <RatingDisplayItem label="Leadership Examples" value={viewingMentorFeedback.rating_leadership_examples} />
                        )}
                        {viewingMentorFeedback.rating_teamwork > 0 && (
                          <RatingDisplayItem label="Teamwork & Collaboration" value={viewingMentorFeedback.rating_teamwork} />
                        )}
                        {viewingMentorFeedback.rating_motivation_drive > 0 && (
                          <RatingDisplayItem label="Motivation & Drive" value={viewingMentorFeedback.rating_motivation_drive} />
                        )}
                        {viewingMentorFeedback.rating_cultural_fit > 0 && (
                          <RatingDisplayItem label="Cultural Fit" value={viewingMentorFeedback.rating_cultural_fit} />
                        )}
                      </>
                    )}
                    
                    {/* General Discussion Ratings - Only show Overall */}
                    {viewingMentorFeedback.session_type === 'General discussion' && (
                      <div className="md:col-span-2 text-center py-2">
                        <p className="text-sm text-slate-500 italic">
                          General discussion sessions focus on qualitative feedback
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Areas of Strength */}
              {viewingMentorFeedback.areas_of_strength && viewingMentorFeedback.areas_of_strength.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Areas of Strength
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingMentorFeedback.areas_of_strength.map((area, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Areas of Improvement */}
              {viewingMentorFeedback.areas_of_improvement && viewingMentorFeedback.areas_of_improvement.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Areas for Improvement
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingMentorFeedback.areas_of_improvement.map((area, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 rounded-lg border border-amber-200 flex items-center gap-1"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualitative Feedback / Mentor Notes */}
              {viewingMentorFeedback.qualitative_feedback && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    Mentor Notes & Next Steps
                  </h4>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{viewingMentorFeedback.qualitative_feedback}</p>
                  </div>
                </div>
              )}

              {/* Feedback Date */}
              {viewingMentorFeedback.created_at && (
                <p className="text-xs text-slate-400 text-right">
                  Feedback submitted: {new Date(viewingMentorFeedback.created_at).toLocaleDateString('en-IN', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMentorFeedbackOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Session Modal */}
      <Dialog open={purchaseModalOpen} onOpenChange={setPurchaseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              No Sessions Remaining
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Error Message */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-900 font-semibold mb-1">
                You have 0 coaching sessions remaining
              </p>
              <p className="text-amber-800 text-sm">
                {!hasCoaching ? (
                  <>Your current plan (<strong>{user?.plan_name || user?.plan || 'Free'}</strong>) doesn&apos;t include coaching sessions.</>
                ) : (
                  <>Your coaching sessions have been used. Top up sessions or upgrade to a coaching plan.</>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setPurchaseModalOpen(false);
                  setTopUpModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Top Up Sessions
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">or</span>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  setPurchaseModalOpen(false);
                  openCoachingPlansModal();
                }}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                View Coaching Programs
              </Button>
            </div>

            <p className="text-xs text-center text-slate-500">
              Coaching programs offer better value with multiple sessions and dedicated support.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Session Deep-Link Confirmation Modal — opened from landing page CTA */}
      <Dialog open={singleSessionConfirmOpen} onOpenChange={setSingleSessionConfirmOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="single-session-confirm-modal">
          {purchaseMentor && (
            <>
              {/* Hero band with gradient */}
              <div
                className="relative px-6 pt-7 pb-12"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gn-rhino) 0%, #2A3260 60%, #4d5fb8 100%)',
                }}
              >
                <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Single Session
                </div>
                <h3 className="text-xl font-bold text-white">
                  Book a session with {purchaseMentor.name?.split(' ')[0] || 'your mentor'}
                </h3>
                <p className="text-sm text-white/70 mt-1">
                  Pay once and pick a time from {purchaseMentor.name?.split(' ')[0] || 'their'} availability.
                </p>
              </div>

              <div className="px-6 pb-6 -mt-8">
                {/* Mentor card overlapping the hero */}
                <div className="bg-white border rounded-xl p-4 shadow-md flex items-center gap-3" style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}>
                  <img
                    src={purchaseMentor.picture_thumbnail || purchaseMentor.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(purchaseMentor.name || 'M')}&background=8C9DFF&color=fff&size=128`}
                    alt={purchaseMentor.name}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate" style={{ color: 'var(--gn-rhino)' }}>
                      {purchaseMentor.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {purchaseMentor.title || purchaseMentor.position}
                      {purchaseMentor.company ? ` · ${purchaseMentor.company}` : ''}
                    </p>
                  </div>
                  {Number(purchaseMentor.rating) > 0 && (
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>
                          {Number(purchaseMentor.rating).toFixed(1)}
                        </span>
                      </div>
                      {Number(purchaseMentor.sessions_conducted) > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {purchaseMentor.sessions_conducted} sessions
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="mt-5 mb-5 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Single session price</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: 'var(--gn-rhino)' }}>
                      {sessionPrice ? `₹${(Number(sessionPrice.amount) || Number(sessionPrice.price) || 0).toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">+ 18% GST</p>
                </div>

                {/* Benefits */}
                <ul className="space-y-2 mb-5">
                  {[
                    `Pay once, pick a slot from ${purchaseMentor.name?.split(' ')[0] || 'mentor'}'s availability`,
                    '1-hour 1:1 session over Google Meet',
                    'Recording + written feedback after the session',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: 'rgba(140, 157, 255, 0.15)' }}
                      >
                        <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--gn-periwinkle)' }} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSingleSessionConfirmOpen(false);
                      setPurchaseMentor(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 text-white font-semibold"
                    style={{ backgroundColor: 'var(--gn-rhino)' }}
                    onClick={async () => {
                      setSingleSessionConfirmOpen(false);
                      await handlePurchaseSession();
                    }}
                    disabled={purchaseLoading || !sessionPrice}
                    data-testid="single-session-confirm-pay"
                  >
                    {purchaseLoading ? 'Processing…' : 'Pay & Pick Slot'}
                    {!purchaseLoading && sessionPrice && <ArrowRight className="w-4 h-4 ml-1" />}
                  </Button>
                </div>

                <p className="text-[11px] text-center text-slate-400 mt-3">
                  Secure payment via Razorpay · Refunded if no slot fits
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Book Single Session Modal */}
      <Dialog open={topUpModalOpen} onOpenChange={setTopUpModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Sparkles className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
              Book Single Sessions
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current balance and Pricing - Side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Current balance */}
              <div className="flex flex-col items-center justify-center p-4 rounded-lg" style={{ backgroundColor: 'var(--gn-grey-light)' }}>
                <span className="text-sm mb-1" style={{ color: 'var(--gn-grey-dark)' }}>Current Balance</span>
                <span className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                  {isUnlimitedCoaching ? '∞' : sessionsRemaining}
                </span>
                <span className="text-xs" style={{ color: 'var(--gn-grey)' }}>
                  {isUnlimitedCoaching ? 'Unlimited' : `session${sessionsRemaining !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Effective Price Per Session */}
              {topUpPricing?.currentPricing && (
                <div className="flex flex-col items-center justify-center p-4 rounded-lg text-white" style={{ backgroundColor: 'var(--gn-rhino)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--gn-periwinkle-light)' }}>Effective Price Per Session</p>
                  <div className="flex items-center gap-2">
                    {topUpPricing.currentPricing.discount_percent > 0 && (
                      <span className="text-lg line-through" style={{ color: 'var(--gn-periwinkle-light)' }}>
                        ₹{topUpPricing.base_price?.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-3xl font-bold">
                      ₹{topUpPricing.currentPricing.effective_per_session_pre_gst?.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--gn-periwinkle-light)' }}>Pre-GST • GST @18% applicable</p>
                  {topUpPricing.currentPricing.discount_percent > 0 && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-white rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--gn-periwinkle)' }}>
                      Save {topUpPricing.currentPricing.discount_percent}%
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Session selector - Horizontal layout */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="col-span-2">
                <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--gn-grey-dark)' }}>Number of sessions</label>
                {/* Slider */}
                <div className="relative px-2">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={selectedTopUpCount}
                    onChange={(e) => handleSessionCountChange(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{ backgroundColor: 'var(--gn-grey-light)', accentColor: 'var(--gn-rhino)' }}
                    data-testid="topup-slider"
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>
                    <span>1</span>
                    <span>10</span>
                    <span>20</span>
                    <span>30</span>
                  </div>
                </div>
              </div>

              {/* Session count with buttons */}
              <div className="flex items-center justify-center gap-2">
                <button 
                  onClick={() => handleSessionCountChange(Math.max(1, selectedTopUpCount - 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--gn-grey-light)', color: 'var(--gn-grey-dark)' }}
                  disabled={selectedTopUpCount <= 1}
                >
                  -
                </button>
                <span className="w-16 text-center text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{selectedTopUpCount}</span>
                <button 
                  onClick={() => handleSessionCountChange(Math.min(30, selectedTopUpCount + 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--gn-grey-light)', color: 'var(--gn-grey-dark)' }}
                  disabled={selectedTopUpCount >= 30}
                >
                  +
                </button>
              </div>
            </div>

            {/* Discount tiers and Pricing - Side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Discount tiers info */}
              {topUpPricing?.discount_tiers && topUpPricing.discount_tiers.length > 0 && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>Volume Discounts</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topUpPricing.discount_tiers.map((tier, index) => {
                      const nextTier = topUpPricing.discount_tiers[index + 1];
                      const maxSessions = nextTier ? nextTier.min_sessions - 1 : 30;
                      const isActive = selectedTopUpCount >= tier.min_sessions && 
                        (nextTier ? selectedTopUpCount < nextTier.min_sessions : true);
                      
                      return (
                        <div 
                          key={index}
                          className="text-center px-3 py-2 rounded"
                          style={{ backgroundColor: isActive ? 'var(--gn-periwinkle-light)' : 'rgba(255,255,255,0.5)' }}
                        >
                          <p className="font-semibold text-xs" style={{ color: 'var(--gn-rhino)' }}>
                            {tier.min_sessions}{nextTier ? `-${maxSessions}` : '+'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--gn-periwinkle)' }}>{tier.discount}% off</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pricing breakdown */}
              {topUpPricing?.currentPricing && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span>{topUpPricing.currentPricing.sessions} × ₹{topUpPricing?.base_price?.toLocaleString('en-IN')}</span>
                      <span>₹{topUpPricing.currentPricing.subtotal?.toLocaleString('en-IN')}</span>
                    </div>
                    {topUpPricing.currentPricing.discount_percent > 0 && (
                      <div className="flex justify-between" style={{ color: 'var(--gn-periwinkle)' }}>
                        <span>Discount ({topUpPricing.currentPricing.discount_percent}%)</span>
                        <span>-₹{topUpPricing.currentPricing.discount_amount?.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span>GST (18%)</span>
                      <span>₹{topUpPricing.currentPricing.gst?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1.5 border-t" style={{ color: 'var(--gn-rhino)', borderColor: 'var(--gn-periwinkle-light)' }}>
                      <span>Total</span>
                      <span>₹{topUpPricing.currentPricing.total?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-0.5" style={{ color: 'var(--gn-grey)' }}>
                      <span>Effective per session</span>
                      <span>₹{topUpPricing.currentPricing.effective_per_session?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Coupon Code Section */}
            <div className="space-y-3">
              {/* Applied coupon display */}
              {topUpAppliedCoupon?.valid && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        Coupon Applied: {topUpCouponCode.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={removeTopUpCoupon}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {topUpAppliedCoupon.message}
                  </p>
                  {/* Show discount amount */}
                  <div className="mt-2 pt-2 border-t border-green-200 flex justify-between text-sm">
                    <span className="text-green-700">Coupon Discount</span>
                    <span className="font-semibold text-green-700">-₹{topUpAppliedCoupon.discount_amount?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
              
              {/* Coupon input toggle */}
              {!topUpAppliedCoupon?.valid && (
                <>
                  {!topUpAppliedCoupon?.valid && (
                    <div className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--gn-grey-light)' }}>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={topUpCouponCode}
                            onChange={(e) => setTopUpCouponCode(e.target.value.toUpperCase())}
                            placeholder="Coupon code"
                            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm font-mono uppercase focus:outline-none placeholder:text-slate-400 placeholder:normal-case"
                            style={{ borderColor: 'var(--gn-periwinkle-light)', backgroundColor: 'white' }}
                            onKeyPress={(e) => e.key === 'Enter' && topUpCouponCode.trim() && validateTopUpCoupon()}
                            data-testid="topup-coupon-input"
                          />
                        </div>
                        <Button
                          onClick={validateTopUpCoupon}
                          disabled={topUpCouponLoading || !topUpCouponCode.trim()}
                          variant="outline"
                          size="sm"
                          className="px-4"
                          style={{ borderColor: 'var(--gn-periwinkle)', color: 'var(--gn-periwinkle)' }}
                          data-testid="topup-coupon-apply-btn"
                        >
                          {topUpCouponLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </Button>
                      </div>
                      {topUpCouponError && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {topUpCouponError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Updated Total with Coupon */}
            {topUpAppliedCoupon?.valid && topUpPricing?.currentPricing && (() => {
              // Recalculate total with coupon: GST should be on post-coupon-discount amount
              const subtotalAfterVolumeDiscount = topUpPricing.currentPricing.total_before_gst || topUpPricing.currentPricing.subtotal;
              const couponDiscount = topUpAppliedCoupon.discount_amount || 0;
              const newSubtotal = subtotalAfterVolumeDiscount - couponDiscount;
              const newGst = newSubtotal * 0.18;
              const newTotal = Math.round((newSubtotal + newGst) * 100) / 100;
              
              return (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span>Original Total</span>
                      <span className="line-through">₹{topUpPricing.currentPricing.total?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span>Subtotal after discount</span>
                      <span>₹{newSubtotal?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between" style={{ color: 'var(--gn-periwinkle)' }}>
                      <span>Coupon Discount</span>
                      <span>-₹{couponDiscount?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span>GST (18%)</span>
                      <span>₹{newGst?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1.5 border-t text-lg" style={{ color: 'var(--gn-rhino)', borderColor: 'var(--gn-periwinkle-light)' }}>
                      <span>New Total</span>
                      <span>₹{newTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setTopUpModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 text-white"
                style={{ backgroundColor: 'var(--gn-rhino)' }}
                onClick={handleTopUpPurchase}
                disabled={topUpLoading || !topUpPricing}
                data-testid="confirm-topup-btn"
              >
                {topUpLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase {selectedTopUpCount} Session{selectedTopUpCount > 1 ? 's' : ''}
                    {topUpPricing?.currentPricing && (() => {
                      if (topUpAppliedCoupon?.valid) {
                        // Recalculate with coupon: GST on post-coupon amount
                        const subtotalAfterVolumeDiscount = topUpPricing.currentPricing.total_before_gst || topUpPricing.currentPricing.subtotal;
                        const couponDiscount = topUpAppliedCoupon.discount_amount || 0;
                        const newSubtotal = subtotalAfterVolumeDiscount - couponDiscount;
                        const newGst = newSubtotal * 0.18;
                        const newTotal = Math.round((newSubtotal + newGst) * 100) / 100;
                        return <span className="ml-2">• ₹{newTotal?.toLocaleString('en-IN')}</span>;
                      }
                      return <span className="ml-2">• ₹{topUpPricing.currentPricing.total?.toLocaleString('en-IN')}</span>;
                    })()}
                  </>
                )}
              </Button>
            </div>

            {/* View coaching programs button */}
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                className="w-full"
                style={{ borderColor: 'var(--gn-periwinkle-light)', color: 'var(--gn-rhino)' }}
                onClick={() => {
                  setTopUpModalOpen(false);
                  openCoachingPlansModal();
                }}
              >
                <Award className="w-4 h-4 mr-2" />
                View Coaching Programs
              </Button>
              <p className="text-xs text-center mt-2" style={{ color: 'var(--gn-grey)' }}>
                Get better value with comprehensive coaching programs
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coaching Programs Modal - 4-card layout matching home page */}
      <Dialog open={coachingPlansModalOpen} onOpenChange={setCoachingPlansModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: 'var(--gn-rhino)' }}>
              <Award className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Coaching Programs
            </DialogTitle>
            <p className="text-sm mt-1" style={{ color: 'var(--gn-grey-dark)' }}>
              Choose a comprehensive program with dedicated mentor support
            </p>
          </DialogHeader>
          
          {coachingPlansLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gn-periwinkle)', borderTopColor: 'transparent' }} />
            </div>
          ) : coachingPlans.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--gn-grey)' }}>
              <Award className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--gn-grey-light)' }} />
              <p>No coaching programs available at the moment.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
                {coachingPlans.map((plan) => {
                  const isPinnacle = plan.name === 'Pinnacle' || plan.plan_key === 'pinnacle';
                  const features = plan.features || {};
                  const displayFeatures = plan.display_features || [];
                  
                  // Build features list dynamically (same logic as home page)
                  const featuresList = [];
                  
                  // Coaching Sessions
                  if (features.coaching_sessions) {
                    if (features.coaching_sessions === -1) {
                      featuresList.push('Unlimited 1-on-1 Coaching Sessions');
                    } else if (features.coaching_sessions > 0) {
                      featuresList.push(`${features.coaching_sessions} 1-on-1 Coaching Sessions`);
                    }
                  }
                  
                  // Strategy Calls
                  if (features.strategy_calls) {
                    if (features.strategy_calls === -1) {
                      featuresList.push('Unlimited Strategy Calls');
                    } else if (features.strategy_calls > 0) {
                      featuresList.push(`${features.strategy_calls} Strategy Calls`);
                    }
                  }
                  
                  // Course Recordings
                  if (features.course_recordings !== false) {
                    if (features.course_recordings_limited) {
                      featuresList.push('Limited Course Access');
                    } else {
                      featuresList.push('30+ hours of course access');
                    }
                  }
                  
                  // Case Drills
                  if (features.drills_exercises !== false) {
                    featuresList.push('740+ Case Drill Questions');
                  }
                  
                  // Workshops
                  if (features.workshops === 'recorded_and_live') {
                    featuresList.push('Live & Recorded Workshops');
                  } else if (features.workshops === 'only_recorded') {
                    featuresList.push('Recorded Workshops');
                  }
                  
                  // Peer Practice
                  if (features.peer_sessions_per_month) {
                    if (features.peer_sessions_per_month === -1) {
                      featuresList.push('Unlimited Peer Practice');
                    } else if (features.peer_sessions_per_month > 0) {
                      featuresList.push(`${features.peer_sessions_per_month} Peer Practice Sessions/month`);
                    }
                  }
                  
                  // Case Materials
                  if (features.case_materials !== false) {
                    if (features.case_materials_limited) {
                      featuresList.push('Limited Case Materials');
                    } else {
                      featuresList.push('Full Case Materials Access');
                    }
                  }
                  
                  // Add display_features at the end
                  if (displayFeatures.length > 0) {
                    featuresList.push(...displayFeatures);
                  }
                  
                  // Fallback
                  if (featuresList.length === 0) {
                    featuresList.push('1-on-1 with MBB consultant', 'Personalized feedback', 'Mock interviews');
                  }
                  
                  const price = plan.pricing?.one_time || plan.price || 0;
                  
                  return (
                    <div 
                      key={plan.id || plan.plan_key}
                      className="relative h-full"
                    >
                      {/* Popular Badge */}
                      {plan.highlight && (
                        <div 
                          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap z-20"
                          style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
                        >
                          MOST POPULAR
                        </div>
                      )}
                      
                      <div 
                        className="relative transition-all hover:shadow-xl hover:-translate-y-1 h-full rounded-2xl overflow-hidden"
                        style={{
                          background: plan.highlight 
                            ? 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)'
                            : 'white',
                          border: plan.highlight ? 'none' : '1px solid #e5e7eb',
                          boxShadow: plan.highlight 
                            ? '0 8px 32px rgba(46, 53, 88, 0.25)' 
                            : '0 2px 12px rgba(0, 0, 0, 0.06)'
                        }}
                      >
                        {/* Decorative circles for highlighted card */}
                        {plan.highlight && (
                          <>
                            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-15" style={{ background: 'var(--gn-periwinkle)' }}></div>
                            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-10" style={{ background: 'var(--gn-periwinkle-light)' }}></div>
                          </>
                        )}
                        
                        <div className="p-5 relative z-10">
                          {/* Plan Name */}
                          <h3 
                            className="text-lg font-semibold mb-3"
                            style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                          >
                            {plan.name}
                          </h3>
                          
                          {/* Price Section */}
                          <div className="mb-3">
                            <p className="text-xs mb-1" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--gn-grey)' }}>Starts at</p>
                            <div className="flex items-baseline gap-1">
                              <span 
                                className="text-2xl font-bold"
                                style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                              >
                                {isPinnacle ? 'Custom' : `₹${price.toLocaleString('en-IN')}`}
                              </span>
                            </div>
                          </div>
                          
                          {/* Description */}
                          {plan.description && (
                            <p 
                              className="text-xs mb-4 leading-relaxed line-clamp-2"
                              style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : 'var(--gn-grey-dark)' }}
                            >
                              {plan.description}
                            </p>
                          )}
                          
                          {/* CTA Button */}
                          <button
                            onClick={() => handleCoachingPlanEnroll(plan)}
                            disabled={enrollingPlan === plan.plan_key}
                            className="w-full py-2 rounded-lg font-medium transition-all text-sm disabled:opacity-50"
                            style={{ 
                              backgroundColor: plan.highlight ? 'var(--gn-chrome-yellow)' : 'var(--gn-rhino)',
                              color: plan.highlight ? 'var(--gn-rhino)' : 'white',
                            }}
                          >
                            {enrollingPlan === plan.plan_key ? (
                              <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2" />
                                Processing...
                              </>
                            ) : (
                              isPinnacle ? 'Apply Now' : 'Enroll Now'
                            )}
                          </button>
                          
                          {/* Separator */}
                          <div 
                            className="my-4 h-px"
                            style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(140, 157, 255, 0.15)' }}
                          />
                          
                          {/* Features Label */}
                          <p 
                            className="font-semibold mb-3 text-xs"
                            style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                          >
                            What&apos;s included:
                          </p>
                          
                          {/* Features List */}
                          <ul className="space-y-2">
                            {featuresList.slice(0, 6).map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle2 
                                  className="w-4 h-4 flex-shrink-0 mt-0.5" 
                                  style={{ color: plan.highlight ? 'var(--gn-chrome-yellow)' : 'var(--gn-periwinkle)' }} 
                                />
                                <span 
                                  className="text-xs"
                                  style={{ color: plan.highlight ? 'rgba(255,255,255,0.9)' : 'var(--gn-grey-dark)' }}
                                >
                                  {feature}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-rhino)' }}>
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>All programs include full subscription access</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--gn-periwinkle)' }}>Videos, drills, workshops, peer practice, and case materials</p>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoachingPlansModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pinnacle Application Modal */}
      <PinnacleApplicationModal
        isOpen={showPinnacleModal}
        onClose={() => setShowPinnacleModal(false)}
        onSubmit={() => {
          console.log('Pinnacle application submitted');
          setShowPinnacleModal(false);
        }}
      />
    </div>
  );
};

export default CoachingPage;
