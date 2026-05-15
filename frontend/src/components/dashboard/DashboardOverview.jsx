import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import {
  Video, Calendar, Zap, BookOpen, Users, UserCheck, GraduationCap,
  ArrowRight, CheckCircle2, CheckCircle, Clock, TrendingUp, Star, MessageSquare,
  ExternalLink, Award, Target, RefreshCw, X, Play, ChevronRight, AlertCircle, PhoneCall, ChevronLeft, ChevronRight as ChevronRightIcon, Eye, Tag
} from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import useViewerTimezone from '../../hooks/useViewerTimezone';
import { istToViewer } from '../../utils/timezone';

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

// Brand colors from CSS variables
const brandColors = {
  rhino: '#2E3558',
  rhinoDark: '#2E356C',
  rhinoMedium: '#363EA7',
  rhinoLight: '#5961ED',
  periwinkle: '#8C9DFF',
  periwinkleLight: '#B1BCFF',
  periwinkleLighter: '#DEE3FF',
  chromeYellow: '#FFF9E6',
  // Chart line colors - 3 distinct shades of blue for drill types
  caseMathBlue: '#3B5BDB',        // Deep Royal Blue
  structuringBlue: '#5C7CFA',     // Medium Cornflower Blue  
  chartsBlue: '#91A7FF',          // Light Lavender Blue
  // Navy blue for labels
  navyBlue: '#1a1f3d',
};

// Add keyframe animations for glass crystal effects
const glassAnimations = `
  @keyframes pulse-glow {
    0%, 100% { 
      filter: drop-shadow(0px 3px 6px rgba(140, 157, 255, 0.3)) drop-shadow(0px 0px 20px rgba(140, 157, 255, 0.2));
      transform: scale(1);
    }
    50% { 
      filter: drop-shadow(0px 4px 8px rgba(140, 157, 255, 0.4)) drop-shadow(0px 0px 25px rgba(140, 157, 255, 0.3));
      transform: scale(1.02);
    }
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%) rotate(-45deg); opacity: 0; }
    50% { opacity: 0.6; }
    100% { transform: translateX(200%) rotate(-45deg); opacity: 0; }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-4px); }
  }
  
  @keyframes glass-shine {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
  
  @keyframes crystal-shimmer {
    0% { 
      background-position: -200% center;
    }
    100% { 
      background-position: 200% center;
    }
  }
  
  @keyframes subtle-pulse {
    0%, 100% { 
      opacity: 1;
      transform: scale(1);
    }
    50% { 
      opacity: 0.95;
      transform: scale(1.005);
    }
  }
  
  @keyframes hover-lift {
    0% { transform: translateY(0); }
    100% { transform: translateY(-4px); }
  }
  
  @keyframes frost-breathe {
    0%, 100% { 
      backdrop-filter: blur(16px);
      background: rgba(255, 255, 255, 0.7);
    }
    50% { 
      backdrop-filter: blur(20px);
      background: rgba(255, 255, 255, 0.75);
    }
  }
  
  .glass-card {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 
      0 8px 32px rgba(140, 157, 255, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.8),
      inset 0 -1px 0 rgba(140, 157, 255, 0.1);
    transition: all 0.3s ease;
  }
  
  .glass-card:hover {
    transform: translateY(-2px);
    box-shadow: 
      0 12px 40px rgba(140, 157, 255, 0.2),
      0 4px 12px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      inset 0 -1px 0 rgba(140, 157, 255, 0.15);
  }
  
  .glass-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transition: left 0.5s ease;
    pointer-events: none;
  }
  
  .glass-card:hover::before {
    left: 100%;
  }
  
  /* Progress bar container - Flat design, no 3D */
  .crystal-progress {
    background: rgba(226, 232, 240, 0.5);
    border-radius: 9999px;
  }
  
  /* Progress fills - Flat design with clean colors */
  .progress-fill-case-math {
    background: linear-gradient(90deg, ${brandColors.caseMathBlue} 0%, ${brandColors.caseMathBlue} 100%);
  }
  
  .progress-fill-structuring {
    background: linear-gradient(90deg, ${brandColors.structuringBlue} 0%, ${brandColors.structuringBlue} 100%);
  }
  
  .progress-fill-charts {
    background: linear-gradient(90deg, ${brandColors.chartsBlue} 0%, ${brandColors.chartsBlue} 100%);
  }
  
  .progress-fill-charts::after {
    display: none;
  }
  
  /* 3D Card Styles - White Liquid Glass Effect */
  .card-3d {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 
      0 4px 6px -1px rgba(46, 53, 88, 0.08),
      0 2px 4px -1px rgba(46, 53, 88, 0.04),
      0 10px 15px -3px rgba(46, 53, 88, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 1),
      inset 0 -1px 0 rgba(255, 255, 255, 0.5);
    transform: translateY(0) scale(1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .card-3d::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
    border-radius: inherit;
  }
  
  .card-3d:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 
      0 8px 25px -5px rgba(46, 53, 88, 0.12),
      0 4px 10px -2px rgba(46, 53, 88, 0.08),
      0 20px 25px -5px rgba(140, 157, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 1),
      inset 0 -1px 0 rgba(255, 255, 255, 0.6);
  }
  
  .card-3d-dark {
    background: linear-gradient(135deg, rgba(26, 31, 61, 0.95) 0%, rgba(46, 53, 88, 0.95) 100%);
    border: 1px solid rgba(255, 249, 230, 0.3);
    box-shadow: 
      0 4px 6px -1px rgba(26, 31, 61, 0.3),
      0 2px 4px -1px rgba(26, 31, 61, 0.2),
      0 10px 15px -3px rgba(26, 31, 61, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transform: translateY(0) scale(1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-3d-dark:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 
      0 8px 25px -5px rgba(26, 31, 61, 0.4),
      0 4px 10px -2px rgba(26, 31, 61, 0.3),
      0 20px 25px -5px rgba(140, 157, 255, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
  
  .card-3d-glass {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.7) 100%);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(140, 157, 255, 0.25);
    box-shadow: 
      0 4px 6px -1px rgba(140, 157, 255, 0.1),
      0 2px 4px -1px rgba(140, 157, 255, 0.06),
      0 10px 15px -3px rgba(140, 157, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    transform: translateY(0) scale(1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-3d-glass:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 
      0 8px 25px -5px rgba(140, 157, 255, 0.2),
      0 4px 10px -2px rgba(140, 157, 255, 0.15),
      0 20px 25px -5px rgba(140, 157, 255, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }
`;

// Inject animations into document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = glassAnimations;
  document.head.appendChild(style);
}

// Rating Display Component - Clickable with brand colors and Book Now CTA - Glass/Crystal Style
const RatingDisplay = ({ rating, label, count, onClick, type, sessionsDone, pendingCount }) => {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={onClick}
      className="glass-card rounded-xl p-5 h-full cursor-pointer group relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{label}</p>
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gn-periwinkle)' }} />
      </div>
      {rating !== null && rating !== undefined ? (
        <div className="flex items-center gap-3">
          <div className="text-4xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
            {rating.toFixed(1)}
            <span className="text-lg text-slate-400 ml-1">({sessionsDone || 0})</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="w-4 h-4"
                  style={{ 
                    color: star <= Math.round(rating) ? 'var(--gn-periwinkle)' : '#E2E8F0',
                    fill: star <= Math.round(rating) ? 'var(--gn-periwinkle)' : 'transparent'
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-slate-400">{count} review{count !== 1 ? 's' : ''}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-slate-300">N/A</span>
          <span className="text-xs text-slate-400">No ratings yet</span>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: 'var(--gn-periwinkle)' }}>
        Click to view session-wise feedback →
      </p>
      <Link 
        to={type === 'coaching' ? '/dashboard/coaching?tab=sessions' : '/dashboard/peer-practice?tab=sessions'} 
        className="block mt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Button 
          size="sm" 
          className="w-full text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--gn-rhino)' }}
        >
          Book Now
        </Button>
      </Link>
      {/* Pending Feedback CTA */}
      {pendingCount > 0 && (
        <Link 
          to={type === 'coaching' ? '/dashboard/coaching?tab=sessions' : '/dashboard/peer-practice?tab=sessions'}
          className="block mt-2 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-medium hover:underline" style={{ color: 'var(--gn-chrome-yellow)' }}>
            <Star className="w-3 h-3 inline mr-1" />
            {pendingCount} feedback pending, fill now →
          </p>
        </Link>
      )}
    </div>
  );
};

// Feedback History Modal
// Expandable Feedback Item Component
const FeedbackItem = ({ session, type, userId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isCoaching = type === 'coaching';
  let feedback, giverName, giverPicture, rating;
  
  if (isCoaching) {
    feedback = session.mentor_feedback;
    giverName = session.mentor_name;
    giverPicture = session.mentor_picture;
    rating = feedback?.average_rating || feedback?.rating || feedback?.overall_rating || feedback?.rating_overall;
  } else {
    const isRequester = session.requester_id === userId;
    feedback = isRequester ? session.partner_feedback : session.requester_feedback;
    giverName = isRequester ? session.partner_name : session.requester_name;
    giverPicture = isRequester ? session.partner_picture : session.requester_picture;
    rating = feedback?.average_rating || feedback?.rating || feedback?.overall_rating || feedback?.rating_overall;
  }

  if (!feedback) return null;

  // Check for any detailed ratings or qualitative feedback
  const hasRatings = feedback.rating_communication || feedback.rating_structure || 
    feedback.rating_analysis || feedback.rating_scoping_questions || 
    feedback.rating_case_structure || feedback.rating_quantitative ||
    feedback.rating_business_acumen || feedback.rating_overall;
  
  const hasQualitative = feedback.comment || feedback.comments || 
    feedback.feedback || feedback.qualitative_feedback ||
    feedback.strengths || feedback.areas_of_improvement;
  
  const hasDetailedFeedback = hasRatings || hasQualitative;

  // Build array of all available ratings
  const ratingItems = [];
  if (feedback.rating_scoping_questions) ratingItems.push({ label: 'Scoping Questions', value: feedback.rating_scoping_questions });
  if (feedback.rating_case_structure) ratingItems.push({ label: 'Case Structure', value: feedback.rating_case_structure });
  if (feedback.rating_quantitative) ratingItems.push({ label: 'Quantitative', value: feedback.rating_quantitative });
  if (feedback.rating_communication) ratingItems.push({ label: 'Communication', value: feedback.rating_communication });
  if (feedback.rating_business_acumen) ratingItems.push({ label: 'Business Acumen', value: feedback.rating_business_acumen });
  if (feedback.rating_structure) ratingItems.push({ label: 'Structure', value: feedback.rating_structure });
  if (feedback.rating_analysis) ratingItems.push({ label: 'Analysis', value: feedback.rating_analysis });
  if (feedback.rating_overall && !rating) ratingItems.push({ label: 'Overall', value: feedback.rating_overall });

  // Get qualitative feedback text
  const qualitativeText = feedback.qualitative_feedback || feedback.comment || feedback.comments || feedback.feedback;

  return (
    <div 
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--gn-periwinkle-lighter)', backgroundColor: 'var(--gn-periwinkle-lighter)' }}
    >
      {/* Collapsed Header - Always Visible */}
      <div 
        className={`p-4 flex items-center gap-4 ${hasDetailedFeedback ? 'cursor-pointer hover:bg-white/30' : ''}`}
        onClick={() => hasDetailedFeedback && setIsExpanded(!isExpanded)}
      >
        <img
          src={giverPicture || `https://ui-avatars.com/api/?name=${giverName || 'User'}&background=8C9DFF&color=fff`}
          alt=""
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ color: 'var(--gn-rhino)' }}>{giverName || 'Anonymous'}</p>
          <p className="text-xs text-slate-500">
            {session.case_type && <span className="mr-2">{feedback.case_type || session.case_type}</span>}
            {new Date(session.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rating && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full" style={{ backgroundColor: 'white' }}>
              <Star className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)', fill: 'var(--gn-periwinkle)' }} />
              <span className="font-bold" style={{ color: 'var(--gn-rhino)' }}>{parseFloat(rating).toFixed(1)}</span>
            </div>
          )}
          {hasDetailedFeedback && (
            <ChevronRight 
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              style={{ color: 'var(--gn-periwinkle)' }} 
            />
          )}
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && hasDetailedFeedback && (
        <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'var(--gn-periwinkle-light)' }}>
          <div className="bg-white rounded-lg p-4 mt-3 space-y-4">
            {/* Case Type if available */}
            {feedback.case_type && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}>
                  {feedback.case_type}
                </span>
              </div>
            )}
            
            {/* All Rating Parameters */}
            {ratingItems.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>Detailed Ratings</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ratingItems.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}
                    >
                      <span className="text-xs text-slate-600">{item.label}</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--gn-rhino)' }}>{item.value}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Qualitative Feedback */}
            {qualitativeText && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--gn-rhino)' }}>Qualitative Feedback</p>
                <p className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">
                  &ldquo;{qualitativeText}&rdquo;
                </p>
              </div>
            )}
            
            {/* Areas of Strength - Handle both array and string formats */}
            {feedback.areas_of_strength && feedback.areas_of_strength.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--gn-rhino)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  Areas of Strength
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(feedback.areas_of_strength) 
                    ? feedback.areas_of_strength 
                    : [feedback.areas_of_strength]
                  ).map((area, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Strengths (legacy field - string format) */}
            {feedback.strengths && !feedback.areas_of_strength && (
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--gn-rhino)' }}>Strengths</p>
                <p className="text-sm text-slate-600">{feedback.strengths}</p>
              </div>
            )}
            
            {/* Areas of Improvement - Handle both array and string formats */}
            {feedback.areas_of_improvement && feedback.areas_of_improvement.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--gn-rhino)' }}>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  Areas for Improvement
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(feedback.areas_of_improvement) 
                    ? feedback.areas_of_improvement 
                    : [feedback.areas_of_improvement]
                  ).map((area, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FeedbackHistoryModal = ({ isOpen, onClose, type, sessions, userId }) => {
  const navigate = useNavigate();
  
  if (!sessions || sessions.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--gn-rhino)' }}>
              {type === 'coaching' ? 'Coach Session Feedback' : 'Peer Session Feedback'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-12">
            <Star className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--gn-periwinkle-lighter)' }} />
            <p className="text-slate-500">No feedback received yet</p>
            <p className="text-sm text-slate-400 mt-1">Complete sessions to receive feedback</p>
            <div className="mt-6">
              <Button
                onClick={() => {
                  onClose(false);
                  navigate(type === 'coaching' ? '/dashboard/coaching' : '/dashboard/peer-practice');
                }}
                className="text-white"
                style={{ backgroundColor: 'var(--gn-periwinkle)' }}
              >
                Book Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle style={{ color: 'var(--gn-rhino)' }}>
                {type === 'coaching' ? 'Coach Session Feedback' : 'Peer Session Feedback'}
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-1">Click on a feedback to see detailed ratings</p>
            </div>
            <Button
              onClick={() => {
                onClose(false);
                navigate(type === 'coaching' ? '/dashboard/coaching' : '/dashboard/peer-practice');
              }}
              className="text-white"
              style={{ backgroundColor: 'var(--gn-periwinkle)' }}
            >
              Book Now
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {sessions.map((session, index) => (
            <FeedbackItem 
              key={session.id || index}
              session={session}
              type={type}
              userId={userId}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Stat Card Component - Consistent sizing with periwinkle brand colors - Glass/Crystal Style
const StatCard = ({ icon: Icon, label, value, subValue, link }) => {
  const content = (
    <div 
      className="glass-card rounded-xl p-5 h-full relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}
        >
          <Icon className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
        </div>
        {link && <ArrowRight className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />}
      </div>
      <p className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
      {subValue && <p className="text-xs mt-1" style={{ color: 'var(--gn-periwinkle)' }}>{subValue}</p>}
    </div>
  );

  if (link) {
    return <Link to={link} className="block h-full">{content}</Link>;
  }
  return content;
};

// Session Card Component with Join/Reschedule/Cancel
const SessionCard = ({ session, type, userId, onJoin, onReschedule, onCancel, cancellationPolicy }) => {
  const [joining, setJoining] = useState(false);
  const { timezone: vTz, abbr: vAbbr } = useViewerTimezone();

  // Parse session time as IST (stored timezone) by appending +05:30
  const timeField = session.time_slot || session.time || '00:00';
  const sessionDateTime = new Date(`${session.date}T${timeField}:00+05:30`);
  const now = new Date();
  const diffMs = sessionDateTime - now;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const hoursUntilSession = diffMs / (1000 * 60 * 60);

  // Convert IST → viewer local time for display only (booking/comparison still uses IST)
  const localView = istToViewer(session.date, timeField, vTz);
  const localDateLabel = new Date(localView.date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const isDifferentFromIst = localView.date !== session.date || localView.time !== timeField;
  
  // Check if within cancellation/reschedule policy window
  const policyHours = cancellationPolicy?.candidate_hours || 4;
  const canCancelOrReschedule = hoursUntilSession >= policyHours;
  
  // Session is joinable 15 mins before until 30 mins after start
  // Also must be confirmed status (not pending, cancelled, or reschedule_pending)
  const isTimeJoinable = diffMins <= 15 && diffMins >= -30;
  const isStatusJoinable = session.status === 'confirmed' || session.status === 'matched' || session.status === 'scheduled';
  const isJoinable = isTimeJoinable && isStatusJoinable;
  
  const getTimeUntil = () => {
    if (diffMins <= 0) return null;
    if (diffHours >= 24) return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };
  
  const getStatusMessage = () => {
    if (session.status === 'pending') return 'Waiting for approval';
    if (session.status === 'reschedule_pending') return 'Reschedule pending';
    return null;
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      if (onJoin) await onJoin(session);
      else if (session.meet_link || session.meeting_link) {
        window.open(formatMeetingLink(session.meet_link || session.meeting_link), '_blank');
      }
    } finally {
      setJoining(false);
    }
  };

  const isRequester = session.requester_id === userId;
  const partnerName = type === 'peer' 
    ? (isRequester ? session.partner_name : session.requester_name)
    : type === 'strategy'
    ? session.mentor_name
    : session.mentor_name;
  const partnerPicture = type === 'peer'
    ? (isRequester ? session.partner_picture : session.requester_picture)
    : session.mentor_picture;
  const partnerCompany = type === 'strategy' ? session.mentor_company : null;
  const partnerTitle = type === 'strategy' ? session.mentor_title : null;

  return (
    <div className="p-4 glass-card rounded-xl relative overflow-hidden">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {partnerPicture ? (
          <img
            src={partnerPicture}
            alt=""
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}
          >
            {type === 'coaching' ? (
              <UserCheck className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
            ) : type === 'strategy' ? (
              <PhoneCall className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
            ) : (
              <Users className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
            )}
          </div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
            >
              {type === 'coaching' ? '1:1 Coaching' : type === 'strategy' ? 'Strategy Call' : 'Peer Practice'}
            </span>
          </div>
          <p className="font-medium text-slate-900 truncate">{partnerName}</p>
          {partnerCompany && partnerTitle && (
            <p className="text-xs text-slate-500 truncate">
              {partnerTitle}, {partnerCompany}
            </p>
          )}
          <p className="text-sm text-slate-500" title={isDifferentFromIst ? `${timeField} IST` : undefined}>
            {localDateLabel} • {localView.time} <span className="text-xs">{vAbbr}</span>
          </p>
        </div>
      </div>
      
      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="flex flex-col items-center">
          <Button
            size="sm"
            onClick={handleJoin}
            disabled={!isJoinable || joining}
            className={isJoinable 
              ? "bg-green-600 hover:bg-green-700 text-white" 
              : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }
          >
            {joining ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <ExternalLink className="w-3 h-3 mr-1" />
            )}
            {isJoinable ? 'Join Now' : 'Join'}
          </Button>
          {!isJoinable && getTimeUntil() && isStatusJoinable && (
            <span className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Live in {getTimeUntil()}
            </span>
          )}
          {!isStatusJoinable && getStatusMessage() && (
            <span className="text-xs text-purple-600 mt-1">
              {getStatusMessage()}
            </span>
          )}
        </div>
        
        {/* View Session Button - Redirects to respective sessions tab */}
        <Link 
          to={type === 'coaching' || type === 'strategy' 
            ? '/dashboard/coaching?tab=sessions' 
            : '/dashboard/peer-practice?tab=sessions'
          }
        >
          <Button
            size="sm"
            variant="outline"
            className="text-slate-600 border-slate-300"
          >
            <Eye className="w-3 h-3 mr-1" />
            View Session
          </Button>
        </Link>
        
        {/* Always show Reschedule and Cancel buttons */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReschedule && onReschedule(session)}
          className="text-slate-600"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Reschedule
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCancel && onCancel(session)}
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      {/* Cancellation deadline notice */}
      {hoursUntilSession > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          {canCancelOrReschedule ? (
            <p className="text-xs text-slate-500">
              <span className="text-green-600">✓</span> Free cancellation until {(() => {
                const deadline = new Date(sessionDateTime.getTime() - (policyHours * 60 * 60 * 1000));
                return deadline.toLocaleString('en-IN', { 
                  month: 'short', 
                  day: 'numeric', 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                });
              })()}
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              <span>⚠</span> Cancellation deadline passed - credits will not be restored
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const DashboardOverview = () => {
  const { user, dashboardData, refreshDashboard, showUpgradeModal } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for feedback history modals
  const [showPeerFeedbackModal, setShowPeerFeedbackModal] = useState(false);
  const [showCoachFeedbackModal, setShowCoachFeedbackModal] = useState(false);
  
  // State for strategy call
  const [showStrategyCallModal, setShowStrategyCallModal] = useState(false);
  const [strategyCallCredits, setStrategyCallCredits] = useState(null);
  const [strategyCallMentors, setStrategyCallMentors] = useState([]);
  const [loadingStrategyMentors, setLoadingStrategyMentors] = useState(false);
  const [selectedStrategyMentor, setSelectedStrategyMentor] = useState(null);
  const [showAddonPurchase, setShowAddonPurchase] = useState(false);
  const [addonQuantity, setAddonQuantity] = useState(1);
  const [purchasingAddon, setPurchasingAddon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [unifiedSlots, setUnifiedSlots] = useState(null);
  const [loadingUnifiedSlots, setLoadingUnifiedSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStrategy, setBookingStrategy] = useState(false);
  const [confirmMentor, setConfirmMentor] = useState(null);
  const [confirmSlotDialog, setConfirmSlotDialog] = useState(null); // For slot confirmation before booking
  const [shouldAutoOpenStrategyModal, setShouldAutoOpenStrategyModal] = useState(false);
  const { timezone: viewerTz, abbr: viewerTzAbbr } = useViewerTimezone(user);
  
  // Strategy Call Cancel/Reschedule State
  const [cancelStrategyDialog, setCancelStrategyDialog] = useState(null); // Session to cancel
  const [rescheduleStrategyDialog, setRescheduleStrategyDialog] = useState(null); // Session to reschedule
  const [rescheduleSlots, setRescheduleSlots] = useState(null);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState(null);
  const [cancellingStrategy, setCancellingStrategy] = useState(false);
  const [reschedulingStrategy, setReschedulingStrategy] = useState(false);
  
  // State for cancellation policy - fetch once at parent level
  const [cancellationPolicy, setCancellationPolicy] = useState({ candidate_hours: 4 });
  
  // State for drill score history
  const [drillScoreHistory, setDrillScoreHistory] = useState(null);
  const [loadingDrillHistory, setLoadingDrillHistory] = useState(true);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  
  // Check if we need to auto-open strategy call modal (from header button)
  useEffect(() => {
    if (location.state?.openStrategyCallModal) {
      // Clear the state to prevent reopening on subsequent visits
      window.history.replaceState({}, document.title);
      // Set flag to trigger modal opening after component is ready
      setShouldAutoOpenStrategyModal(true);
    }
  }, [location.state]);
  
  // Fetch drill score history
  useEffect(() => {
    const fetchDrillHistory = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/ai-drills/score-history`, {
          withCredentials: true
        });
        
        // Transform the history data into chartData format
        const historyData = response.data;
        
        // Get all unique drill numbers and create chart data points
        const allDrillNumbers = new Set();
        ['case_math', 'case_structuring', 'charts_exhibits'].forEach(type => {
          (historyData.history[type] || []).forEach(item => {
            allDrillNumbers.add(item.drill_number);
          });
        });
        
        // Create chart data with scores for each drill number
        const sortedDrillNumbers = Array.from(allDrillNumbers).sort((a, b) => a - b);
        const chartData = sortedDrillNumbers.map(drillNum => {
          const caseMath = historyData.history.case_math?.find(d => d.drill_number === drillNum);
          const caseStructuring = historyData.history.case_structuring?.find(d => d.drill_number === drillNum);
          const chartsExhibits = historyData.history.charts_exhibits?.find(d => d.drill_number === drillNum);
          
          return {
            date: `Drill ${drillNum}`,
            case_math: caseMath?.score || null,
            case_structuring: caseStructuring?.score || null,
            charts_exhibits: chartsExhibits?.score || null,
          };
        });
        
        setDrillScoreHistory({
          ...historyData,
          chartData: chartData
        });
      } catch (error) {
        console.log('Failed to fetch drill history:', error.message);
      } finally {
        setLoadingDrillHistory(false);
      }
    };
    if (user) {
      fetchDrillHistory();
    }
  }, [user]);
  
  // Fetch strategy call credits
  useEffect(() => {
    const fetchStrategyCredits = async () => {
      try {
        console.log('Fetching strategy credits for user:', user?.email);
        const response = await axios.get(`${BACKEND_URL}/api/strategy-calls/credits`, {
          withCredentials: true
        });
        console.log('Strategy credits response:', response.data);
        setStrategyCallCredits(response.data);
      } catch (error) {
        console.log('Failed to fetch strategy call credits:', error.message);
        console.log('Error details:', error.response?.data);
      }
    };
    if (user) {
      fetchStrategyCredits();
    }
  }, [user]);
  
  // Fetch cancellation policy from PUBLIC endpoint
  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/public/cancellation-policy`, {
          withCredentials: true
        });
        console.log('Cancellation policy loaded:', response.data);
        setCancellationPolicy(response.data);
      } catch (error) {
        console.log('Using default cancellation policy:', error.message);
      }
    };
    fetchPolicy();
  }, []);
  
  // Safely destructure dashboardData
  const access = dashboardData?.access || {};
  const progress = dashboardData?.progress || {};
  const limits = dashboardData?.limits || {};
  const upcoming_sessions = dashboardData?.upcoming_sessions || {};
  const stats = dashboardData?.stats || {};
  const pending_feedbacks = dashboardData?.pending_feedbacks || {};

  // Auto-trigger strategy call modal if flag is set (from header button)
  // This useEffect must be before early returns to satisfy React hooks rules
  useEffect(() => {
    if (shouldAutoOpenStrategyModal && strategyCallCredits) {
      setShouldAutoOpenStrategyModal(false);
      handleStrategyCallClick();
    }
  }, [shouldAutoOpenStrategyModal, strategyCallCredits]);

  // Show loading state if data not ready
  if (!dashboardData || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div 
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--gn-periwinkle)', borderTopColor: 'transparent' }}
          ></div>
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const handleUpgradeClick = () => {
    // Use the new subscription plans modal from DashboardLayout
    if (showUpgradeModal) {
      showUpgradeModal();
    } else {
      // Fallback to pricing section
      navigate('/#pricing-section');
      setTimeout(() => {
        const el = document.getElementById('pricing-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleReschedule = async (session, type) => {
    if (type === 'coaching') {
      navigate('/dashboard/coaching?tab=sessions');
    } else if (type === 'strategy') {
      // Open reschedule dialog for strategy calls
      setRescheduleStrategyDialog(session);
      setLoadingRescheduleSlots(true);
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/strategy-calls/${session.id}/available-slots`,
          { withCredentials: true }
        );
        setRescheduleSlots(response.data.slots);
      } catch (error) {
        console.error('Failed to fetch reschedule slots:', error);
        alert('Failed to load available slots. Please try again.');
        setRescheduleStrategyDialog(null);
      } finally {
        setLoadingRescheduleSlots(false);
      }
    } else {
      navigate('/dashboard/peer-practice?tab=sessions');
    }
  };

  const handleCancel = (session, type) => {
    if (type === 'coaching') {
      navigate('/dashboard/coaching?tab=sessions');
    } else if (type === 'strategy') {
      // Open cancel dialog for strategy calls
      setCancelStrategyDialog(session);
    } else {
      navigate('/dashboard/peer-practice?tab=sessions');
    }
  };

  // Strategy Call Cancel Handler
  const handleConfirmCancelStrategy = async () => {
    if (!cancelStrategyDialog) return;
    
    setCancellingStrategy(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/strategy-calls/${cancelStrategyDialog.id}/cancel`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success) {
        // Show success message
        const refundMsg = response.data.credit_refunded 
          ? 'Your credit has been refunded.' 
          : 'No refund (cancelled less than 24 hours before session).';
        alert(`Strategy call cancelled successfully. ${refundMsg}`);
        
        // Refresh dashboard data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to cancel strategy call:', error);
      alert(error.response?.data?.detail || 'Failed to cancel. Please try again.');
    } finally {
      setCancellingStrategy(false);
      setCancelStrategyDialog(null);
    }
  };

  // Strategy Call Reschedule Handler
  const handleConfirmRescheduleStrategy = async () => {
    if (!rescheduleStrategyDialog || !selectedRescheduleSlot) return;
    
    setReschedulingStrategy(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/strategy-calls/${rescheduleStrategyDialog.id}/reschedule`,
        {
          new_date: selectedRescheduleSlot.date,
          new_time: selectedRescheduleSlot.time
        },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        alert('Strategy call rescheduled successfully!');
        // Refresh dashboard data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to reschedule strategy call:', error);
      alert(error.response?.data?.detail || 'Failed to reschedule. Please try again.');
    } finally {
      setReschedulingStrategy(false);
      setRescheduleStrategyDialog(null);
      setRescheduleSlots(null);
      setSelectedRescheduleSlot(null);
    }
  };

  const handleJoinCoaching = async (session) => {
    if (session.meet_link) {
      window.open(formatMeetingLink(session.meet_link), '_blank');
    }
  };

  const handleJoinPeer = async (session) => {
    // Peer sessions use 'meet_link', coaching might use 'meeting_link'
    const link = session.meet_link || session.meeting_link;
    if (link) {
      window.open(link, '_blank');
    } else {
      console.warn('No meet link found for session:', session.id);
    }
  };

  // Strategy Call Handlers
  const handleStrategyCallClick = async () => {
    // Check credits first
    if (!strategyCallCredits || strategyCallCredits.strategy_calls_remaining <= 0) {
      setShowAddonPurchase(true);
      setShowStrategyCallModal(true);
      return;
    }
    
    // Determine flow based on user type
    const planCategory = user?.plan_category || 'subscription';
    
    if (planCategory === 'coaching') {
      // COACHING USERS: Show mentor selection (existing flow)
      setLoadingStrategyMentors(true);
      setShowStrategyCallModal(true);
      
      try {
        const response = await axios.get(`${BACKEND_URL}/api/strategy-calls/mentors`, {
          withCredentials: true
        });
        setStrategyCallMentors(response.data.mentors || []);
        
        // If only one mentor, go directly to calendar
        if (response.data.single_mentor && response.data.mentors.length === 1) {
          setSelectedStrategyMentor(response.data.mentors[0]);
        }
      } catch (error) {
        console.error('Failed to fetch strategy call mentors:', error);
      } finally {
        setLoadingStrategyMentors(false);
      }
    } else {
      // SUBSCRIPTION/COHORT USERS: Show unified calendar (auto-assignment)
      setLoadingUnifiedSlots(true);
      setShowStrategyCallModal(true);
      
      try {
        const response = await axios.get(`${BACKEND_URL}/api/strategy-calls/unified-availability`, {
          withCredentials: true
        });
        console.log('=== UNIFIED AVAILABILITY API RESPONSE ===');
        console.log('Full response:', response.data);
        console.log('Slots object:', response.data.slots);
        console.log('Slots is object?', typeof response.data.slots === 'object');
        console.log('Slots keys:', Object.keys(response.data.slots || {}));
        console.log('Number of dates:', Object.keys(response.data.slots || {}).length);
        console.log('Mentor count:', response.data.mentor_count);
        
        setUnifiedSlots(response.data);
      } catch (error) {
        console.error('Failed to fetch unified availability:', error);
        console.error('Error details:', error.response?.data);
        alert('Failed to load available slots. Please try again.');
      } finally {
        setLoadingUnifiedSlots(false);
      }
    }
  };

  const handleSelectStrategyMentor = (mentor) => {
    setSelectedStrategyMentor(mentor);
    // Navigate to coaching page with strategy call mode
    navigate(`/dashboard/coaching?mentor=${mentor.id}&mode=strategy-call`);
    setShowStrategyCallModal(false);
  };

  const handleUnifiedSlotSelect = async (date, time) => {
    // Show confirmation dialog first
    setConfirmSlotDialog({ date, time });
  };

  const handleConfirmBooking = async () => {
    if (!confirmSlotDialog) return;
    
    const { date, time } = confirmSlotDialog;
    
    // Close confirmation dialog and start booking
    setConfirmSlotDialog(null);
    setSelectedSlot({ date, time });
    setBookingStrategy(true);
    
    try {
      // Book with auto-assignment
      const response = await axios.post(
        `${BACKEND_URL}/api/strategy-calls/book`,
        {
          date,
          time,
          auto_assign: true,
          notes: ''
        },
        { withCredentials: true }
      );
      
      if (response.data.success) {
        // Show confirmation with assigned mentor
        setConfirmMentor(response.data.mentor);
        setBookingStrategy(false);
        
        // Refresh credits - inline call since fetchStrategyCredits is in useEffect scope
        try {
          const creditsResponse = await axios.get(`${BACKEND_URL}/api/strategy-calls/credits`, {
            withCredentials: true
          });
          setStrategyCallCredits(creditsResponse.data);
        } catch (creditsError) {
          console.error('Failed to refresh credits:', creditsError);
        }
        
        // Don't auto-redirect - let user choose to view sessions or close
      }
    } catch (error) {
      setBookingStrategy(false);
      console.error('Booking failed:', error);
      
      if (error.response?.status === 400) {
        alert(error.response.data.detail || 'Slot no longer available. Please try another time.');
        // Refresh availability
        try {
          const response = await axios.get(`${BACKEND_URL}/api/strategy-calls/unified-availability`, {
            withCredentials: true
          });
          setUnifiedSlots(response.data);
        } catch (e) {
          console.error('Failed to refresh:', e);
        }
      } else {
        alert('Failed to book strategy call. Please try again.');
      }
    }
  };

  const handleCancelBooking = () => {
    setConfirmSlotDialog(null);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setApplyingCoupon(true);
    setCouponError('');
    
    try {
      const baseAmount = (strategyCallCredits?.addon_price || 1199) * addonQuantity;
      
      const response = await axios.post(`${BACKEND_URL}/api/discounts/validate`, {
        code: couponCode.trim(),
        order_amount: baseAmount,
        order_type: 'coaching',
        plan_key: 'addon_strategy_call'  // Required field
      }, { 
        withCredentials: true,
        validateStatus: (status) => {
          // Accept any status and handle in response
          return status < 500;
        }
      });

      if (response.data && response.data.valid) {
        const discountAmount = response.data.discount_amount || 0;
        const finalAmount = baseAmount - discountAmount;
        const discountPercent = baseAmount > 0 ? Math.round((discountAmount / baseAmount) * 100) : 0;
        
        setAppliedCoupon({
          code: couponCode.trim(),
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          discount_id: response.data.discount_id
        });
        setCouponError('');
      } else {
        setCouponError(response.data?.message || response.data?.detail || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Invalid coupon code';
      setCouponError(errorMessage);
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handlePurchaseAddon = async () => {
    setPurchasingAddon(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/strategy-calls/purchase-addon`, {
        quantity: addonQuantity,
        coupon_code: appliedCoupon?.code || null
      }, { withCredentials: true });
      
      if (response.data.success) {
        // Open Razorpay checkout
        const options = {
          key: response.data.razorpay_key,
          order_id: response.data.order_id,
          amount: response.data.amount * 100,
          currency: response.data.currency,
          name: 'gradnext',
          description: `${addonQuantity} Strategy Call Credit(s)`,
          handler: async function(paymentResponse) {
            try {
              await axios.post(`${BACKEND_URL}/api/strategy-calls/confirm-addon-purchase`, {}, {
                withCredentials: true
              });
              // Refresh credits
              const creditsResponse = await axios.get(`${BACKEND_URL}/api/strategy-calls/credits`, {
                withCredentials: true
              });
              setStrategyCallCredits(creditsResponse.data);
              setShowAddonPurchase(false);
              alert(`Successfully added ${addonQuantity} strategy call credit(s)!`);
            } catch (err) {
              console.error('Failed to confirm addon purchase:', err);
            }
          },
          prefill: {
            email: user?.email,
            name: user?.name
          },
          theme: {
            color: '#2E3558'
          }
        };
        
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      }
    } catch (error) {
      console.error('Failed to purchase addon:', error);
      alert(error.response?.data?.detail || 'Failed to initiate purchase');
    } finally {
      setPurchasingAddon(false);
    }
  };

  // Prepare upcoming sessions - combine all types
  // Filter out cancelled sessions
  const upcomingCoaching = (upcoming_sessions?.coaching || []).filter(s => !isSessionCancelled(s.status));
  const upcomingPeer = (upcoming_sessions?.peer_practice || []).filter(s => !isSessionCancelled(s.status));
  const upcomingStrategy = (upcoming_sessions?.strategy_calls || []).filter(s => !isSessionCancelled(s.status));
  
  // Combine all upcoming sessions and sort by date
  const allUpcomingSessions = [
    ...upcomingCoaching.map(s => ({ ...s, type: 'coaching' })),
    ...upcomingPeer.map(s => ({ ...s, type: 'peer' })),
    ...upcomingStrategy.map(s => ({ ...s, type: 'strategy' }))
  ].sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time_slot || a.time || '00:00'}`);
    const dateB = new Date(`${b.date} ${b.time_slot || b.time || '00:00'}`);
    return dateA - dateB;
  });

  // Calculate coaching credits left
  const coachingCreditsLeft = user?.is_unlimited_coaching ? '∞' : (user?.coaching_sessions_remaining || 0);

  return (
    <div className="space-y-6 p-4 min-h-screen" style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)' }} data-testid="dashboard-overview">
      {/* Welcome Header - Clean Text */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--gn-rhino)' }}>
            Welcome back, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-slate-500">Track your progress and manage your sessions</p>
        </div>
      </div>

      {/* Feedback History Modals */}
      <FeedbackHistoryModal
        isOpen={showPeerFeedbackModal}
        onClose={() => setShowPeerFeedbackModal(false)}
        type="peer"
        sessions={stats?.peer_sessions_with_feedback || []}
        userId={user?.id}
      />
      <FeedbackHistoryModal
        isOpen={showCoachFeedbackModal}
        onClose={() => setShowCoachFeedbackModal(false)}
        type="coaching"
        sessions={stats?.coach_sessions_with_feedback || []}
        userId={user?.id}
      />

      {/* Main Dashboard Grid */}
      <div className="space-y-5">
        {/* Row 1: Courses, Case Drills & Strategy Call - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Courses Card - Light Rhino Tint with 3D Effect */}
          <div 
            className="card-3d rounded-xl p-5 cursor-pointer relative overflow-hidden group"
            onClick={() => navigate('/dashboard/courses')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: '#1a1f3d' }}>Courses</span>
              <span className="text-sm font-bold" style={{ color: 'var(--gn-rhino)' }}>
                {progress?.videos_completed || 0}/{progress?.total_videos || 0}
              </span>
            </div>
            <div className="h-4 rounded-full overflow-hidden relative crystal-progress">
              <div 
                className="h-full rounded-full transition-all duration-700 crystal-progress-fill"
                style={{
                  width: `${progress?.total_videos ? ((progress?.videos_completed || 0) / progress.total_videos) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500 font-medium">
                {Math.round(progress?.total_videos ? ((progress?.videos_completed || 0) / progress.total_videos) * 100 : 0)}% complete
              </p>
              <Button 
                size="sm" 
                className="text-xs h-7 px-3 font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/courses');
                }}
              >
                Start →
              </Button>
            </div>
          </div>

          {/* Case Drills Card - Light Rhino Tint with 3D Effect */}
          <div 
            className="card-3d rounded-xl p-5 cursor-pointer relative overflow-hidden group"
            onClick={() => navigate('/dashboard/drills')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: '#1a1f3d' }}>Case Drills</span>
              <span className="text-sm font-bold" style={{ color: 'var(--gn-rhino)' }}>
                {progress?.drills_completed || 0}/{progress?.total_drills || 44}
              </span>
            </div>
            <div className="h-4 rounded-full overflow-hidden relative crystal-progress">
              <div 
                className="h-full rounded-full transition-all duration-700 crystal-progress-fill"
                style={{
                  width: `${progress?.total_drills ? ((progress?.drills_completed || 0) / progress.total_drills) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-500 font-medium">
                {Math.round(progress?.total_drills ? ((progress?.drills_completed || 0) / progress.total_drills) * 100 : 0)}% complete
              </p>
              <Button 
                size="sm" 
                className="text-xs h-7 px-3 font-semibold"
                style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/dashboard/drills');
                }}
              >
                Start →
              </Button>
            </div>
          </div>

          {/* Strategy Call Card - Dark Gradient with 3D Effect */}
          <div 
            onClick={handleStrategyCallClick}
            className="card-3d-dark rounded-xl p-5 cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold" style={{ color: 'var(--gn-chrome-yellow)' }}>Strategy Call</span>
              <span className="text-sm font-bold" style={{ color: 'var(--gn-chrome-yellow)' }}>
                {strategyCallCredits?.strategy_calls_remaining >= 999 ? 'Unlimited' : `${strategyCallCredits?.strategy_calls_remaining ?? 0} left`}
              </span>
            </div>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--gn-periwinkle)' }}>
              Get personalized guidance from MBB consultants
            </p>
            <Button 
              size="sm" 
              className="text-xs h-7 px-3 font-semibold w-full"
              style={{ 
                background: 'white',
                color: 'var(--gn-rhino)',
                border: '1px solid rgba(46, 53, 88, 0.1)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleStrategyCallClick();
              }}
            >
              Book Now →
            </Button>
          </div>
        </div>

        {/* Main Content: Left (2/3) + Right (1/3) - Upcoming Sessions spans full height */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column (2/3 width) - Stacked cards */}
          <div className="lg:col-span-2 space-y-4">
            {/* Drills Completed Card with 3D Effect */}
            <div 
              className="card-3d rounded-xl p-5 relative overflow-hidden"
            >
              <p className="text-sm font-semibold mb-4" style={{ color: '#1a1f3d' }}>
                Drills Completed
              </p>
              <div className="grid grid-cols-3 gap-4">
                {/* Case Math Progress Bar - Medium Blue */}
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColors.caseMathBlue }} />
                      <span className="text-xs font-semibold" style={{ color: brandColors.navyBlue }}>Case Math</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: brandColors.navyBlue }}>
                      {drillScoreHistory?.history.case_math.length || 0}/{Math.round((progress?.total_drills || 44) / 3)}
                    </span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden relative crystal-progress">
                    <div 
                      className="h-full rounded-full transition-all duration-700 progress-fill-case-math"
                      style={{
                        width: `${drillScoreHistory?.history.case_math.length ? (drillScoreHistory.history.case_math.length / Math.round((progress?.total_drills || 44) / 3)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.round(drillScoreHistory?.history.case_math.length ? (drillScoreHistory.history.case_math.length / Math.round((progress?.total_drills || 44) / 3)) * 100 : 0)}% complete
                  </p>
                </div>

                {/* Case Structuring Progress Bar - Medium-Light Blue */}
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColors.structuringBlue }} />
                      <span className="text-xs font-semibold" style={{ color: brandColors.navyBlue }}>Case Structuring</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: brandColors.navyBlue }}>
                      {drillScoreHistory?.history.case_structuring.length || 0}/{Math.round((progress?.total_drills || 44) / 3)}
                    </span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden relative crystal-progress">
                    <div 
                      className="h-full rounded-full transition-all duration-700 progress-fill-structuring"
                      style={{
                        width: `${drillScoreHistory?.history.case_structuring.length ? (drillScoreHistory.history.case_structuring.length / Math.round((progress?.total_drills || 44) / 3)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.round(drillScoreHistory?.history.case_structuring.length ? (drillScoreHistory.history.case_structuring.length / Math.round((progress?.total_drills || 44) / 3)) * 100 : 0)}% complete
                  </p>
                </div>

                {/* Charts & Exhibits Progress Bar - Light Blue */}
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColors.chartsBlue }} />
                      <span className="text-xs font-semibold" style={{ color: brandColors.navyBlue }}>Charts & Exhibits</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: brandColors.navyBlue }}>
                      {drillScoreHistory?.history.charts_exhibits.length || 0}/{Math.round((progress?.total_drills || 44) / 3)}
                    </span>
                  </div>
                  <div className="h-4 rounded-full overflow-hidden relative crystal-progress">
                    <div 
                      className="h-full rounded-full transition-all duration-700 progress-fill-charts"
                      style={{
                        width: `${drillScoreHistory?.history.charts_exhibits.length ? (drillScoreHistory.history.charts_exhibits.length / Math.round((progress?.total_drills || 44) / 3)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {Math.round(drillScoreHistory?.history.charts_exhibits.length ? (drillScoreHistory.history.charts_exhibits.length / Math.round((progress?.total_drills || 44) / 3)) * 100 : 0)}% complete
                  </p>
                </div>
              </div>
            </div>

            {/* Drill Score Progression Card with 3D Effect */}
            <div 
              className="card-3d rounded-xl p-5 relative overflow-hidden"
            >
              <p className="text-sm font-semibold mb-4" style={{ color: '#1a1f3d' }}>
                Drill Score Progression
              </p>
              {drillScoreHistory && drillScoreHistory.chartData && drillScoreHistory.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart 
                    data={drillScoreHistory.chartData.map(item => ({
                      ...item,
                      case_math: item.case_math ? (item.case_math / 10).toFixed(1) : null,
                      case_structuring: item.case_structuring ? (item.case_structuring / 10).toFixed(1) : null,
                      charts_exhibits: item.charts_exhibits ? (item.charts_exhibits / 10).toFixed(1) : null,
                    }))} 
                    margin={{ top: 5, right: 20, bottom: 30, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickFormatter={(value) => value}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value, name) => [`${value}/10`, name]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{
                        paddingTop: '10px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="case_math" 
                      stroke={brandColors.caseMathBlue}
                      strokeWidth={3}
                      dot={{ fill: brandColors.caseMathBlue, r: 4, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      name="Case Math"
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="case_structuring" 
                      stroke={brandColors.structuringBlue}
                      strokeWidth={3}
                      dot={{ fill: brandColors.structuringBlue, r: 4, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      name="Case Structuring"
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="charts_exhibits" 
                      stroke={brandColors.chartsBlue}
                      strokeWidth={3}
                      dot={{ fill: brandColors.chartsBlue, r: 4, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                      name="Charts & Exhibits"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center bg-slate-50/50 rounded-lg">
                  <Zap className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">No drill completions yet</p>
                  <p className="text-slate-400 text-xs mt-1">Complete drills to see your progress here</p>
                  <Button 
                    className="mt-4 text-sm"
                    style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
                    onClick={() => navigate('/dashboard/drills')}
                  >
                    Start Your First Drill
                  </Button>
                </div>
              )}
            </div>

            {/* Rating Cards - Side by Side within 2/3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Average Peer Rating Card with 3D Effect */}
              <div 
                className="card-3d rounded-xl p-5 cursor-pointer relative overflow-hidden"
                onClick={() => setShowPeerFeedbackModal(true)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: '#1a1f3d' }}>Average Peer Rating</span>
                  {pending_feedbacks?.peer_practice?.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}>
                      {pending_feedbacks.peer_practice.length} pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-6 h-6" style={{ fill: 'var(--gn-periwinkle)', color: 'var(--gn-periwinkle)' }} />
                    <span className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                      {stats?.avg_peer_rating ? stats.avg_peer_rating.toFixed(1) : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>{stats?.peer_rating_count || 0} ratings</p>
                    <p>{stats?.peer_sessions_done || 0} sessions done</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="mt-3 text-xs w-full font-semibold"
                  style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/dashboard/peer-practice');
                  }}
                >
                  Book Peer Practice
                </Button>
              </div>

              {/* Average Coach Rating Card with 3D Effect */}
              <div 
                className="card-3d rounded-xl p-5 cursor-pointer relative overflow-hidden"
                onClick={() => setShowCoachFeedbackModal(true)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: '#1a1f3d' }}>Average Coach Rating</span>
                  {pending_feedbacks?.coaching?.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}>
                      {pending_feedbacks.coaching.length} pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-6 h-6" style={{ fill: 'var(--gn-periwinkle)', color: 'var(--gn-periwinkle)' }} />
                    <span className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                      {stats?.avg_coach_rating ? stats.avg_coach_rating.toFixed(1) : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>{stats?.coach_rating_count || 0} ratings</p>
                    <p>{stats?.coaching_sessions_done || 0} sessions done</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="mt-3 text-xs w-full font-semibold"
                  style={{ backgroundColor: 'var(--gn-rhino)', color: 'white' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/dashboard/coaching');
                  }}
                >
                  Book Coaching
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column (1/3 width) - Upcoming Sessions spans full height */}
          <div className="lg:col-span-1">
            <div 
              className="card-3d-glass rounded-xl overflow-hidden h-full flex flex-col"
            >
              <div 
                className="p-4 border-b"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(222, 227, 255, 0.8) 0%, rgba(222, 227, 255, 0.5) 100%)',
                  borderColor: 'rgba(177, 188, 255, 0.4)',
                }}
              >
                <h3 className="font-semibold flex items-center gap-2 text-sm" style={{ color: 'var(--gn-rhino)' }}>
                  <Calendar className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                  Upcoming Sessions
                </h3>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                {(() => {
                  const monthStart = startOfMonth(currentCalendarMonth);
                  const monthEnd = endOfMonth(currentCalendarMonth);
                  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                  const firstDayOfWeek = monthStart.getDay();
                  
                  const sessionsByDate = {};
                  allUpcomingSessions.forEach(session => {
                    const dateKey = session.date;
                    if (!sessionsByDate[dateKey]) {
                      sessionsByDate[dateKey] = [];
                    }
                    sessionsByDate[dateKey].push(session);
                  });
                  
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <button 
                          onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <ChevronLeft className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                        </button>
                        <h4 className="text-xs font-semibold" style={{ color: 'var(--gn-rhino)' }}>
                          {format(currentCalendarMonth, 'MMMM yyyy')}
                        </h4>
                        <button 
                          onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <ChevronRightIcon className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                          <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                          <div key={`empty-${i}`} className="aspect-square" />
                        ))}
                        
                        {daysInMonth.map((day) => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const sessionsOnDay = sessionsByDate[dateKey] || [];
                          const hasSession = sessionsOnDay.length > 0;
                          const isCurrentDay = isToday(day);
                          
                          return (
                            <div 
                              key={dateKey}
                              className={`aspect-square p-0.5 rounded text-center relative ${
                                isCurrentDay ? 'bg-blue-100 border border-blue-400' : 
                                hasSession ? 'bg-purple-50 cursor-pointer hover:bg-purple-100' : 
                                'hover:bg-slate-50'
                              }`}
                              title={hasSession ? `${sessionsOnDay.length} session(s)` : ''}
                            >
                              <span className={`text-xs ${
                                isCurrentDay ? 'text-blue-600 font-semibold' : 
                                hasSession ? 'text-purple-600 font-medium' : 
                                'text-slate-600'
                              }`}>
                                {format(day, 'd')}
                              </span>
                              {hasSession && (
                                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--gn-periwinkle)' }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Session List */}
                      {allUpcomingSessions.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium text-slate-500 mb-2">Booked Sessions</p>
                          {allUpcomingSessions.map((session) => {
                            const sessionDate = parseISO(session.date);
                            return (
                              <div 
                                key={session.id}
                                className="p-2.5 rounded-lg transition-all"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(140, 157, 255, 0.1) 0%, rgba(140, 157, 255, 0.05) 100%)',
                                  border: '1px solid rgba(140, 157, 255, 0.2)',
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--gn-rhino)' }}>
                                      {session.mentor_name || session.peer_name || 'Session'}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {(() => {
                                        const loc = istToViewer(session.date, session.time, viewerTz);
                                        return `${format(parseISO(loc.date), 'MMM d')} at ${loc.time} ${viewerTzAbbr}`;
                                      })()}
                                    </p>
                                  </div>
                                  <span 
                                    className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{ 
                                      backgroundColor: session.type === 'coaching' ? 'var(--gn-periwinkle-lighter)' : 
                                                      session.type === 'strategy' ? 'var(--gn-chrome-lighter)' :
                                                      'var(--gn-periwinkle-lighter)',
                                      color: 'var(--gn-rhino)'
                                    }}
                                  >
                                    {session.type === 'coaching' ? 'Coach' : 
                                     session.type === 'strategy' ? 'Strategy' : 'Peer'}
                                  </span>
                                  {/* View Session Icon */}
                                  <Link 
                                    to={session.type === 'coaching' || session.type === 'strategy'
                                      ? '/dashboard/coaching?tab=sessions' 
                                      : '/dashboard/peer-practice?tab=sessions'
                                    }
                                    className="flex-shrink-0"
                                  >
                                    <button
                                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                                      style={{
                                        backgroundColor: 'var(--gn-periwinkle-lighter)',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--gn-periwinkle)'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--gn-periwinkle-lighter)'}
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--gn-rhino)' }} />
                                    </button>
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-4 text-center">
                          <p className="text-xs text-slate-400 mb-2">No upcoming sessions</p>
                          <div className="flex gap-2 justify-center">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs h-7"
                              onClick={() => navigate('/dashboard/coaching')}
                            >
                              Book Coaching
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs h-7"
                              onClick={() => navigate('/dashboard/peer-practice')}
                            >
                              Find Peer
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Call Modal */}
      <Dialog open={showStrategyCallModal} onOpenChange={setShowStrategyCallModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Calendar className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
              Book Strategy Call
            </DialogTitle>
          </DialogHeader>
          
          {/* No credits - show purchase option */}
          {showAddonPurchase || (strategyCallCredits?.strategy_calls_remaining <= 0) ? (
            <div className="py-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                  <Calendar className="w-8 h-8" style={{ color: 'var(--gn-periwinkle)' }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Purchase Strategy Call Session
                </h3>
                <p className="text-sm text-slate-500">
                  You have 0 strategy call sessions. Purchase a session to book a call.
                </p>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--gn-rhino)' }}>Strategy Call Session</p>
                    <p className="text-sm text-slate-500">30-minute 1:1 call with MBB consultant</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>
                      ₹{strategyCallCredits?.addon_price || 1199}
                    </p>
                    <p className="text-xs text-slate-400">+ 18% GST</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm text-slate-600">Quantity:</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setAddonQuantity(Math.max(1, addonQuantity - 1));
                        setAppliedCoupon(null); // Reset coupon when quantity changes
                      }}
                      disabled={addonQuantity <= 1}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center font-medium">{addonQuantity}</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setAddonQuantity(addonQuantity + 1);
                        setAppliedCoupon(null); // Reset coupon when quantity changes
                      }}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Coupon Code Section */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  {!appliedCoupon ? (
                    <div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => {
                              setCouponCode(e.target.value.toUpperCase());
                              setCouponError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (couponCode.trim()) {
                                  handleApplyCoupon();
                                }
                              }
                            }}
                            placeholder="Coupon code"
                            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                            disabled={applyingCoupon}
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleApplyCoupon();
                          }}
                          disabled={!couponCode.trim() || applyingCoupon}
                          size="sm"
                          variant="outline"
                        >
                          {applyingCoupon ? 'Applying...' : 'Apply'}
                        </Button>
                      </div>
                      {couponError && (
                        <p className="text-xs text-red-500 mt-1">{couponError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            Coupon "{appliedCoupon.code}" applied!
                          </p>
                          <p className="text-xs text-green-600">
                            {appliedCoupon.discount_percent}% off
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveCoupon();
                          }}
                          size="sm"
                          variant="ghost"
                          className="text-green-700 hover:text-green-900"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium">
                      ₹{((strategyCallCredits?.addon_price || 1199) * addonQuantity).toFixed(2)}
                    </span>
                  </div>
                  
                  {appliedCoupon && (
                    <div className="flex items-center justify-between text-sm text-green-600">
                      <span>Discount ({appliedCoupon.discount_percent}%):</span>
                      <span className="font-medium">
                        -₹{appliedCoupon.discount_amount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">GST (18%):</span>
                    <span className="font-medium">
                      ₹{(
                        appliedCoupon 
                          ? appliedCoupon.final_amount * 0.18 
                          : (strategyCallCredits?.addon_price || 1199) * addonQuantity * 0.18
                      ).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Total:</span>
                      <span className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>
                        ₹{Math.round(
                          appliedCoupon
                            ? appliedCoupon.final_amount * 1.18
                            : (strategyCallCredits?.addon_price || 1199) * addonQuantity * 1.18
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handlePurchaseAddon}
                className="w-full text-white"
                style={{ backgroundColor: 'var(--gn-rhino)' }}
                disabled={purchasingAddon}
              >
                {purchasingAddon ? 'Processing...' : `Purchase ${addonQuantity} Session${addonQuantity > 1 ? 's' : ''}`}
              </Button>
            </div>
          ) : loadingUnifiedSlots || loadingStrategyMentors ? (
            <div className="py-12 text-center">
              <div 
                className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--gn-periwinkle)', borderTopColor: 'transparent' }}
              ></div>
              <p className="text-slate-500">
                {loadingUnifiedSlots ? 'Loading available slots...' : 'Loading mentors...'}
              </p>
            </div>
          ) : unifiedSlots ? (
            /* UNIFIED CALENDAR VIEW for subscription/cohort users */
            <div className="relative">
              {/* Confirmation Dialog Overlay */}
              {confirmSlotDialog && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg">
                  <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="text-center mb-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                        <Calendar className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
                      </div>
                      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
                        Confirm Your Booking
                      </h3>
                      <p className="text-slate-600 mb-4">
                        You&apos;re about to book a strategy call for:
                      </p>
                      <div className="bg-slate-50 rounded-lg p-4 mb-4">
                        {(() => {
                          const local = istToViewer(confirmSlotDialog.date, confirmSlotDialog.time, viewerTz);
                          const localDateLabel = new Date(local.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                          });
                          const sameIst = local.date === confirmSlotDialog.date && local.time === confirmSlotDialog.time;
                          return (
                            <>
                              <div className="font-semibold text-base mb-1" style={{ color: 'var(--gn-rhino)' }}>
                                {localDateLabel}
                              </div>
                              <div className="text-lg font-bold" style={{ color: 'var(--gn-periwinkle)' }}>
                                {local.time} <span className="text-sm font-semibold text-slate-500">{viewerTzAbbr}</span>
                              </div>
                              {!sameIst && (
                                <div className="text-xs text-slate-500 mt-1">
                                  ({confirmSlotDialog.time} IST)
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-slate-500">
                        A mentor will be automatically assigned to you based on availability and expertise.
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleCancelBooking}
                        className="flex-1 px-4 py-2.5 rounded-lg border transition-all font-medium"
                        style={{
                          borderColor: 'var(--gn-periwinkle-lighter)',
                          color: 'var(--gn-rhino)',
                          backgroundColor: 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--gn-periwinkle-lighter)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Go Back
                      </button>
                      <button
                        onClick={handleConfirmBooking}
                        className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium transition-all"
                        style={{
                          backgroundColor: 'var(--gn-periwinkle)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        Confirm Booking
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {confirmMentor ? (
                /* Show mentor confirmation after auto-assignment */
                <div className="py-8 text-center">
                  {/* Mentor Picture */}
                  <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden border-4" style={{ borderColor: 'var(--gn-periwinkle)' }}>
                    <img 
                      src={confirmMentor.picture || `https://ui-avatars.com/api/?name=${confirmMentor.name}`}
                      alt={confirmMentor.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Success Message */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
                      Matched with {confirmMentor.name}!
                    </h3>
                  </div>
                  
                  {/* Mentor Details Card */}
                  <div className="max-w-md mx-auto bg-slate-50 rounded-xl p-6 mb-4">
                    {/* Position and Company */}
                    <div className="mb-4">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        {/* Company Logo Placeholder - will show logo when available */}
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-slate-200 flex-shrink-0">
                          {confirmMentor.consulting_firm_logo || confirmMentor.company_logo ? (
                            <img 
                              src={confirmMentor.consulting_firm_logo || confirmMentor.company_logo} 
                              alt={confirmMentor.company || confirmMentor.consulting_firm}
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <div className="text-xs font-bold text-slate-400">
                              {(confirmMentor.company || confirmMentor.consulting_firm || 'C').charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-base font-semibold" style={{ color: 'var(--gn-rhino)' }}>
                            {confirmMentor.title || confirmMentor.consulting_position || confirmMentor.position || 'Consultant'}
                          </p>
                          <p className="text-sm text-slate-600">
                            {confirmMentor.company || confirmMentor.consulting_firm || 'Consulting Firm'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Rating */}
                    <div className="flex items-center justify-center gap-1 text-amber-500 mb-4">
                      <Star className="w-5 h-5 fill-current" />
                      <span className="font-semibold text-lg">{confirmMentor.rating || 'N/A'}</span>
                      <span className="text-sm text-slate-500 ml-1">rating</span>
                    </div>
                  </div>
                  
                  {/* Booking Confirmation */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-2 text-green-700 mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-semibold">Strategy call confirmed!</span>
                    </div>
                    {(() => {
                      if (!selectedSlot?.date || !selectedSlot?.time) return null;
                      const local = istToViewer(selectedSlot.date, selectedSlot.time, viewerTz);
                      const localDateLabel = new Date(local.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                      });
                      const sameIst = local.date === selectedSlot.date && local.time === selectedSlot.time;
                      return (
                        <>
                          <p className="text-sm text-slate-700">
                            {localDateLabel} at <span className="font-medium">{local.time} {viewerTzAbbr}</span>
                          </p>
                          {!sameIst && (
                            <p className="text-xs text-slate-500 mt-1">
                              ({selectedSlot.time} IST)
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* Bio - Optional */}
                  {confirmMentor.bio && (
                    <p className="text-sm text-slate-500 mt-4 max-w-md mx-auto">
                      {confirmMentor.bio}
                    </p>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center gap-3 mt-6">
                    <Button
                      onClick={() => {
                        setShowStrategyCallModal(false);
                        setConfirmMentor(null);
                        setSelectedSlot(null);
                        navigate('/dashboard/coaching?tab=sessions');
                      }}
                      className="bg-[#2E3558] hover:bg-[#363EA7] text-white"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      View My Sessions
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowStrategyCallModal(false);
                        setConfirmMentor(null);
                        setSelectedSlot(null);
                      }}
                      className="border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    Select a time slot for your strategy call. Times shown in <span className="font-medium text-slate-700">{viewerTzAbbr}</span> (your local timezone).{strategyCallCredits?.strategy_calls_remaining < 999 && ` You have ${strategyCallCredits?.strategy_calls_remaining} session(s) remaining.`}
                  </p>
                  
                  <div className="max-h-[400px] overflow-y-auto space-y-3">
                    {!unifiedSlots || !unifiedSlots.slots || Object.keys(unifiedSlots.slots).length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-500">No available slots in the next 14 days.</p>
                        <p className="text-sm text-slate-400 mt-2">Please check back later.</p>
                      </div>
                    ) : (
                      (() => {
                        // Convert IST slots to viewer's local timezone and regroup by viewer-local date.
                        // `istDate/istTime` is the canonical value we pass back to the backend.
                        const converted = [];
                        Object.entries(unifiedSlots.slots).forEach(([istDate, times]) => {
                          Object.entries(times).forEach(([istTime, slotInfo]) => {
                            const local = istToViewer(istDate, istTime, viewerTz);
                            converted.push({ istDate, istTime, localDate: local.date, localTime: local.time, slotInfo });
                          });
                        });
                        // Group by local date and sort by local time
                        const grouped = {};
                        converted.forEach((s) => {
                          if (!grouped[s.localDate]) grouped[s.localDate] = [];
                          grouped[s.localDate].push(s);
                        });
                        const orderedDates = Object.keys(grouped).sort();
                        orderedDates.forEach((d) => {
                          grouped[d].sort((a, b) => a.localTime.localeCompare(b.localTime));
                        });
                        return orderedDates.map((date) => (
                          <div key={date} className="border rounded-xl p-4" style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}>
                            <div className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
                              <Calendar className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {grouped[date].map(({ istDate, istTime, localTime, slotInfo }) => (
                                <button
                                  key={`${istDate}_${istTime}`}
                                  onClick={() => handleUnifiedSlotSelect(istDate, istTime)}
                                  disabled={bookingStrategy}
                                  className="px-3 py-2 text-sm rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    borderColor: 'var(--gn-periwinkle-lighter)',
                                    color: 'var(--gn-rhino)',
                                    backgroundColor: 'white'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--gn-periwinkle)';
                                    e.currentTarget.style.color = 'white';
                                    e.currentTarget.style.borderColor = 'var(--gn-periwinkle)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.color = 'var(--gn-rhino)';
                                    e.currentTarget.style.borderColor = 'var(--gn-periwinkle-lighter)';
                                  }}
                                  title={`${istTime} IST`}
                                >
                                  {localTime}
                                  <span className="text-xs ml-1 opacity-70">
                                    ({slotInfo.mentor_ids?.length || 0})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()
                    )}
                  </div>
                  
                  {bookingStrategy && (
                    <div className="mt-4 text-center text-sm text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-periwinkle border-t-transparent rounded-full animate-spin"></div>
                        Booking your strategy call...
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : strategyCallMentors.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500">No mentors available for strategy calls at the moment.</p>
              <p className="text-sm text-slate-400 mt-2">Please check back later.</p>
            </div>
          ) : (
            /* MENTOR SELECTION VIEW for coaching users */
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Select a mentor for your 30-minute strategy call.{strategyCallCredits?.strategy_calls_remaining < 999 && ` You have ${strategyCallCredits?.strategy_calls_remaining} session(s) remaining.`}
              </p>
              
              <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {strategyCallMentors.map((mentor) => (
                  <div 
                    key={mentor.id}
                    onClick={() => handleSelectStrategyMentor(mentor)}
                    className="border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all flex items-center gap-4"
                    style={{ borderColor: 'var(--gn-periwinkle-lighter)' }}
                  >
                    <img 
                      src={mentor.picture || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face'} 
                      alt="Coach"
                      className="w-14 h-14 rounded-full object-cover border-2"
                      style={{ borderColor: 'var(--gn-periwinkle)' }}
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{mentor.title || 'Consultant'}</h4>
                      <p className="text-sm font-medium" style={{ color: 'var(--gn-periwinkle)' }}>{mentor.company}</p>
                      {mentor.expertise?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mentor.expertise.slice(0, 3).map((skill, idx) => (
                            <span 
                              key={idx}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400" style={{ color: 'var(--gn-chrome-yellow)' }} />
                      <span className="text-sm font-medium">{mentor.rating || 'N/A'}</span>
                    </div>
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Strategy Call Cancel Confirmation Dialog */}
      <Dialog open={!!cancelStrategyDialog} onOpenChange={() => setCancelStrategyDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Strategy Call</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this strategy call?
            </DialogDescription>
          </DialogHeader>
          
          {cancelStrategyDialog && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="font-medium text-slate-900">Session Details:</p>
                <p className="text-sm text-slate-600 mt-2">
                  📅 {new Date(cancelStrategyDialog.date || cancelStrategyDialog.session_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-sm text-slate-600">
                  🕐 {cancelStrategyDialog.time || cancelStrategyDialog.time_slot} IST
                </p>
                <p className="text-sm text-slate-600">
                  👤 {cancelStrategyDialog.mentor_name}
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Cancellation Policy:</strong> If you cancel more than 24 hours before the session, your credit will be refunded. Late cancellations will not receive a refund.
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCancelStrategyDialog(null)}
                  disabled={cancellingStrategy}
                >
                  Keep Session
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleConfirmCancelStrategy}
                  disabled={cancellingStrategy}
                >
                  {cancellingStrategy ? 'Cancelling...' : 'Yes, Cancel'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Strategy Call Reschedule Dialog */}
      <Dialog open={!!rescheduleStrategyDialog} onOpenChange={() => {
        setRescheduleStrategyDialog(null);
        setRescheduleSlots(null);
        setSelectedRescheduleSlot(null);
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reschedule Strategy Call</DialogTitle>
            <DialogDescription>
              Select a new time slot for your strategy call with {rescheduleStrategyDialog?.mentor_name}
            </DialogDescription>
          </DialogHeader>
          
          {rescheduleStrategyDialog && (
            <div className="space-y-4">
              {/* Current booking info */}
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Current Time:</strong> {new Date(rescheduleStrategyDialog.date || rescheduleStrategyDialog.session_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} at {rescheduleStrategyDialog.time || rescheduleStrategyDialog.time_slot} IST
                </p>
              </div>
              
              {loadingRescheduleSlots ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E3558] mx-auto"></div>
                  <p className="mt-2 text-slate-500">Loading available slots...</p>
                </div>
              ) : rescheduleSlots && Object.keys(rescheduleSlots).length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Select a new date and time:</p>
                  
                  <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                    {Object.entries(rescheduleSlots).map(([date, times]) => (
                      <div key={date} className="border rounded-lg p-3">
                        <p className="font-medium text-slate-900 mb-2">
                          {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {times.map((time) => (
                            <button
                              key={`${date}-${time}`}
                              onClick={() => setSelectedRescheduleSlot({ date, time })}
                              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                selectedRescheduleSlot?.date === date && selectedRescheduleSlot?.time === time
                                  ? 'bg-[#2E3558] text-white border-[#2E3558]'
                                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#2E3558] hover:bg-slate-50'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedRescheduleSlot && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-800">
                        <strong>New Time:</strong> {new Date(selectedRescheduleSlot.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} at {selectedRescheduleSlot.time} IST
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  <p>No available slots found for rescheduling.</p>
                  <p className="text-sm mt-1">Please try again later or cancel this session.</p>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setRescheduleStrategyDialog(null);
                    setRescheduleSlots(null);
                    setSelectedRescheduleSlot(null);
                  }}
                  disabled={reschedulingStrategy}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmRescheduleStrategy}
                  disabled={!selectedRescheduleSlot || reschedulingStrategy}
                  className="bg-[#2E3558] hover:bg-[#363EA7]"
                >
                  {reschedulingStrategy ? 'Rescheduling...' : 'Confirm Reschedule'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardOverview;
