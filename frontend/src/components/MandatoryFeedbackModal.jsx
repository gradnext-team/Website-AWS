import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Star, MessageSquare, CheckCircle2, X, Loader2, User, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Star rating component
const StarRating = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium text-slate-700">{label}</Label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} className="p-0.5">
          <Star className={`w-7 h-7 transition-colors ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-200'}`} />
        </button>
      ))}
    </div>
  </div>
);

// Dynamic rating configuration per session type (same as MentorDashboard)
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

// Dynamic areas options per session type (same as MentorDashboard)
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

const MandatoryFeedbackModal = ({ userType = 'candidate' }) => {
  const [pendingData, setPendingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittedIds = useRef(new Set()); // Track submitted session IDs to prevent re-showing

  // Candidate → Mentor feedback
  const [candidateFeedback, setCandidateFeedback] = useState({
    mentor_followed_instructions: true,
    rating_facilitation_style: 5,
    rating_feedback_quality: 5,
    rating_overall: 5,
    other_feedback: ''
  });

  // Mentor → Candidate feedback (NEW: with session type and dynamic ratings)
  const [mentorFeedback, setMentorFeedback] = useState({
    session_type: '',
    case_type: '',
    ratings: {},
    rating_overall: 0,
    areas_of_strength: [],
    areas_of_improvement: [],
    qualitative_feedback: ''
  });

  // Peer feedback
  const [peerFeedback, setPeerFeedback] = useState({
    session_type: '',
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

  useEffect(() => {
    checkPendingFeedback();
  }, []);

  const checkPendingFeedback = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/feedback/pending-mandatory`, { withCredentials: true });
      if (res.data.has_pending && !submittedIds.current.has(res.data.session?.id)) {
        setPendingData(res.data);
        // Pre-fill session type if available from the session data
        if (res.data.feedback_type === 'mentor_to_candidate' && res.data.session?.session_type) {
          setMentorFeedback(prev => ({
            ...prev,
            session_type: res.data.session.session_type,
            case_type: res.data.session.case_type || ''
          }));
        }
      } else {
        setPendingData(null);
      }
    } catch (err) {
      console.error('Failed to check pending feedback:', err);
      setPendingData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCandidateToMentor = async () => {
    if (candidateFeedback.rating_facilitation_style < 1 || candidateFeedback.rating_feedback_quality < 1 || candidateFeedback.rating_overall < 1) {
      alert('Please provide all required ratings.');
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
    
    setSubmitting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/feedback/candidate-to-mentor`, {
        booking_id: pendingData.session.id,
        ...candidateFeedback
      }, { withCredentials: true });
      submittedIds.current.add(pendingData.session.id);
      setPendingData(null);
      setTimeout(() => checkPendingFeedback(), 1500);
    } catch (error) {
      // If "already submitted" error, treat as success and dismiss
      if (error.response?.data?.detail?.includes('already submitted')) {
        submittedIds.current.add(pendingData.session.id);
        setPendingData(null);
        setTimeout(() => checkPendingFeedback(), 1500);
      } else {
        alert(error.response?.data?.detail || 'Failed to submit feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMentorToCandidate = async () => {
    const isCaseSession = mentorFeedback.session_type === 'Case session';
    const areasConfig = getAreasConfig(mentorFeedback.session_type);
    const ratingConfig = getRatingConfig(mentorFeedback.session_type);

    // Validate required fields
    if (!mentorFeedback.session_type) {
      alert('Please select a session type');
      return;
    }
    if (isCaseSession && !mentorFeedback.case_type) {
      alert('Please select a case type');
      return;
    }
    if (!mentorFeedback.rating_overall) {
      alert('Please provide an overall rating');
      return;
    }

    // Check all required ratings are filled
    const missingRatings = ratingConfig.filter(r => !r.isOverall && !mentorFeedback.ratings[r.key]);
    if (missingRatings.length > 0) {
      alert(`Please rate: ${missingRatings.map(r => r.label).join(', ')}`);
      return;
    }

    // Check areas only for session types that require them
    if (areasConfig.hasAreas) {
      if (mentorFeedback.areas_of_strength.length === 0) {
        alert('Please select at least one area of strength');
        return;
      }
      if (mentorFeedback.areas_of_improvement.length === 0) {
        alert('Please select at least one area of improvement');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Prepare the feedback payload with all ratings flattened
      const feedbackPayload = {
        booking_id: pendingData.session.id,
        session_type: mentorFeedback.session_type,
        case_type: isCaseSession ? mentorFeedback.case_type : null,
        rating_overall: mentorFeedback.rating_overall,
        areas_of_strength: areasConfig.hasAreas ? mentorFeedback.areas_of_strength : [],
        areas_of_improvement: areasConfig.hasAreas ? mentorFeedback.areas_of_improvement : [],
        qualitative_feedback: mentorFeedback.qualitative_feedback,
        // Include all dynamic ratings
        ...mentorFeedback.ratings
      };

      await axios.post(`${BACKEND_URL}/api/mentor-dashboard/feedback`, feedbackPayload, { withCredentials: true });
      submittedIds.current.add(pendingData.session.id);
      setPendingData(null);
      // Reset form
      setMentorFeedback({
        session_type: '',
        case_type: '',
        ratings: {},
        rating_overall: 0,
        areas_of_strength: [],
        areas_of_improvement: [],
        qualitative_feedback: ''
      });
      setTimeout(() => checkPendingFeedback(), 1500);
    } catch (error) {
      if (error.response?.data?.detail?.includes('already submitted')) {
        submittedIds.current.add(pendingData.session.id);
        setPendingData(null);
        setTimeout(() => checkPendingFeedback(), 1500);
      } else {
        alert(error.response?.data?.detail || 'Failed to submit feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPeerFeedback = async () => {
    if (!peerFeedback.session_type) {
      alert('Please select a session type.');
      return;
    }
    if (peerFeedback.session_type === 'Case session' && !peerFeedback.case_type) {
      alert('Please select a case type.');
      return;
    }
    if (peerFeedback.rating_overall < 1) {
      alert('Please provide an overall rating.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/peers/feedback`, {
        session_id: pendingData.session.id,
        session_type: peerFeedback.session_type,
        case_type: peerFeedback.session_type === 'Case session' ? peerFeedback.case_type : null,
        rating_scoping_questions: peerFeedback.rating_scoping_questions,
        rating_case_structure: peerFeedback.rating_case_structure,
        rating_quantitative: peerFeedback.quantitative_tested ? peerFeedback.rating_quantitative : null,
        quantitative_tested: peerFeedback.quantitative_tested,
        rating_communication: peerFeedback.rating_communication,
        rating_business_acumen: peerFeedback.rating_business_acumen,
        rating_overall: peerFeedback.rating_overall,
        qualitative_feedback: peerFeedback.qualitative_feedback
      }, { withCredentials: true });
      submittedIds.current.add(pendingData.session.id);
      setPendingData(null);
      setTimeout(() => checkPendingFeedback(), 1500);
    } catch (error) {
      if (error.response?.data?.detail?.includes('already submitted') || error.response?.data?.detail?.includes('already provided')) {
        submittedIds.current.add(pendingData.session.id);
        setPendingData(null);
        setTimeout(() => checkPendingFeedback(), 1500);
      } else {
        alert(error.response?.data?.detail || 'Failed to submit feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle area selection for mentor feedback
  const toggleArea = (area, type) => {
    setMentorFeedback(prev => {
      const field = type === 'strength' ? 'areas_of_strength' : 'areas_of_improvement';
      const current = prev[field];
      if (current.includes(area)) {
        return { ...prev, [field]: current.filter(a => a !== area) };
      } else {
        return { ...prev, [field]: [...current, area] };
      }
    });
  };

  if (loading) return null;
  if (!pendingData) return null;

  const feedbackType = pendingData.feedback_type;
  const sessionType = pendingData.session?.session_type;
  const caseType = pendingData.session?.case_type;
  const sessionDate = pendingData.session?.date;
  const sessionTime = pendingData.session?.time;

  // Person info
  const personName = feedbackType === 'candidate_to_mentor' 
    ? pendingData.session?.mentor_name 
    : feedbackType === 'mentor_to_candidate'
    ? pendingData.session?.candidate_name
    : pendingData.session?.partner_name;
  const personPicture = feedbackType === 'candidate_to_mentor'
    ? pendingData.session?.mentor_picture
    : feedbackType === 'mentor_to_candidate'
    ? pendingData.session?.candidate_picture
    : pendingData.session?.partner_picture;
  const personTitle = feedbackType === 'candidate_to_mentor' ? pendingData.session?.mentor_title : null;
  const personCompany = feedbackType === 'candidate_to_mentor' ? pendingData.session?.mentor_company : null;

  const caseTypes = ['Profitability', 'Market Entry', 'Guesstimate', 'Pricing', 'Growth', 'M&A', 'Unconventional'];
  const sessionTypes = ['Case session', 'PEI session', 'CV review session', 'FIT session', 'General discussion'];
  const peerSessionTypes = ['Case session', 'Fit Interview', 'PEI Session', 'General Discussion'];

  // Get current rating and areas config for mentor feedback
  const currentRatingConfig = getRatingConfig(mentorFeedback.session_type);
  const currentAreasConfig = getAreasConfig(mentorFeedback.session_type);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="mandatory-feedback-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-100" style={{ backgroundColor: 'var(--gn-rhino, #2E3558)' }}>
          <div className="flex items-center gap-4">
            {personPicture ? (
              <img src={personPicture} alt={personName} className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/10">
                <User className="w-7 h-7 text-white/70" />
              </div>
            )}
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wider font-medium">Feedback Required</p>
              <h2 className="text-white text-lg font-bold">{personName}</h2>
              {personTitle && personCompany && (
                <p className="text-white/50 text-sm">{personTitle}, {personCompany}</p>
              )}
              <p className="text-white/60 text-sm">
                {sessionType}
                {caseType && ` - ${caseType}`}
                {sessionDate && ` · ${new Date(sessionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                {sessionTime && ` at ${sessionTime} IST`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            Please complete this feedback to continue using the dashboard. Your feedback helps improve the experience for everyone.
          </p>

          {/* Candidate → Mentor Feedback */}
          {feedbackType === 'candidate_to_mentor' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Did the mentor follow your session instructions?</Label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCandidateFeedback(prev => ({...prev, mentor_followed_instructions: true}))}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${candidateFeedback.mentor_followed_instructions ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />Yes
                  </button>
                  <button type="button" onClick={() => setCandidateFeedback(prev => ({...prev, mentor_followed_instructions: false}))}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${!candidateFeedback.mentor_followed_instructions ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <X className="w-4 h-4 inline mr-2" />No
                  </button>
                </div>
              </div>
              <StarRating label="Facilitation Style *" value={candidateFeedback.rating_facilitation_style} onChange={(v) => setCandidateFeedback(prev => ({...prev, rating_facilitation_style: v}))} />
              <StarRating label="Quality of Feedback *" value={candidateFeedback.rating_feedback_quality} onChange={(v) => setCandidateFeedback(prev => ({...prev, rating_feedback_quality: v}))} />
              <StarRating label="Overall Rating *" value={candidateFeedback.rating_overall} onChange={(v) => setCandidateFeedback(prev => ({...prev, rating_overall: v}))} />
              <div className="space-y-1.5">
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
                  placeholder={candidateFeedback.rating_overall > 0 && candidateFeedback.rating_overall <= 3 ? "Please share your feedback (minimum 10 words)..." : "Share your experience..."} 
                  className="min-h-[70px]" 
                />
                {candidateFeedback.rating_overall > 0 && candidateFeedback.rating_overall <= 3 && candidateFeedback.other_feedback && (
                  <p className="text-xs text-slate-500">
                    Word count: {candidateFeedback.other_feedback.trim().split(/\s+/).filter(w => w.length > 0).length} / 10 minimum
                  </p>
                )}
              </div>
              <Button onClick={handleSubmitCandidateToMentor} disabled={submitting || candidateFeedback.rating_overall < 1} className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="submit-mandatory-feedback">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Feedback'}
              </Button>
            </>
          )}

          {/* Mentor → Candidate Feedback (NEW: with session type and dynamic ratings) */}
          {feedbackType === 'mentor_to_candidate' && (
            <>
              {/* Session Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Session Type *</Label>
                <select 
                  value={mentorFeedback.session_type} 
                  onChange={(e) => setMentorFeedback(prev => ({
                    ...prev, 
                    session_type: e.target.value, 
                    case_type: '',
                    ratings: {},
                    areas_of_strength: [],
                    areas_of_improvement: []
                  }))} 
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                >
                  <option value="">Select session type...</option>
                  {sessionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Case Type (only for Case sessions) */}
              {mentorFeedback.session_type === 'Case session' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Case Type *</Label>
                  <select 
                    value={mentorFeedback.case_type} 
                    onChange={(e) => setMentorFeedback(prev => ({...prev, case_type: e.target.value}))} 
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  >
                    <option value="">Select case type...</option>
                    {caseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* Dynamic Ratings based on Session Type */}
              {mentorFeedback.session_type && (
                <div className="space-y-4 pt-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rate the Candidate</div>
                  {currentRatingConfig.map((ratingItem) => (
                    <StarRating
                      key={ratingItem.key}
                      label={`${ratingItem.label} *`}
                      value={ratingItem.isOverall ? mentorFeedback.rating_overall : (mentorFeedback.ratings[ratingItem.key] || 0)}
                      onChange={(v) => {
                        if (ratingItem.isOverall) {
                          setMentorFeedback(prev => ({...prev, rating_overall: v}));
                        } else {
                          setMentorFeedback(prev => ({
                            ...prev,
                            ratings: {...prev.ratings, [ratingItem.key]: v}
                          }));
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Areas of Strength & Improvement (for session types that have them) */}
              {mentorFeedback.session_type && currentAreasConfig.hasAreas && (
                <>
                  {/* Areas of Strength */}
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium text-slate-700">Areas of Strength * <span className="text-xs text-slate-400">(Select at least one)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {currentAreasConfig.options.map((area) => {
                        const isSelected = mentorFeedback.areas_of_strength.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleArea(area, 'strength')}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              isSelected 
                                ? 'bg-green-100 border-green-400 text-green-700' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-green-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                            {area}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Areas of Improvement */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Areas of Improvement * <span className="text-xs text-slate-400">(Select at least one)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {currentAreasConfig.options.map((area) => {
                        const isSelected = mentorFeedback.areas_of_improvement.includes(area);
                        return (
                          <button
                            key={area}
                            type="button"
                            onClick={() => toggleArea(area, 'improvement')}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                              isSelected 
                                ? 'bg-amber-100 border-amber-400 text-amber-700' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                            {area}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Qualitative Feedback */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Qualitative Feedback (Optional)</Label>
                <Textarea 
                  value={mentorFeedback.qualitative_feedback} 
                  onChange={(e) => setMentorFeedback(prev => ({...prev, qualitative_feedback: e.target.value}))} 
                  placeholder="Detailed feedback for the candidate..." 
                  className="min-h-[70px]" 
                />
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleSubmitMentorToCandidate} 
                disabled={
                  submitting || 
                  !mentorFeedback.session_type ||
                  (mentorFeedback.session_type === 'Case session' && !mentorFeedback.case_type) ||
                  !mentorFeedback.rating_overall ||
                  (currentAreasConfig.hasAreas && mentorFeedback.areas_of_strength.length === 0) ||
                  (currentAreasConfig.hasAreas && mentorFeedback.areas_of_improvement.length === 0)
                } 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                data-testid="submit-mandatory-feedback"
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Feedback'}
              </Button>
            </>
          )}

          {/* Peer Feedback */}
          {feedbackType === 'peer' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Session Type *</Label>
                <select value={peerFeedback.session_type} onChange={(e) => setPeerFeedback(prev => ({...prev, session_type: e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
                  <option value="">Select session type...</option>
                  {peerSessionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {peerFeedback.session_type === 'Case session' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Case Type *</Label>
                  <select value={peerFeedback.case_type} onChange={(e) => setPeerFeedback(prev => ({...prev, case_type: e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
                    <option value="">Select case type...</option>
                    {caseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              <StarRating label="Scoping Questions *" value={peerFeedback.rating_scoping_questions} onChange={(v) => setPeerFeedback(prev => ({...prev, rating_scoping_questions: v}))} />
              <StarRating label="Case Structure *" value={peerFeedback.rating_case_structure} onChange={(v) => setPeerFeedback(prev => ({...prev, rating_case_structure: v}))} />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={peerFeedback.quantitative_tested} onChange={(e) => setPeerFeedback(prev => ({...prev, quantitative_tested: e.target.checked}))} className="w-4 h-4" />
                  <Label className="text-sm font-medium text-slate-700">Quantitative was tested</Label>
                </div>
                {peerFeedback.quantitative_tested && (
                  <StarRating label="Quantitative Skills *" value={peerFeedback.rating_quantitative} onChange={(v) => setPeerFeedback(prev => ({...prev, rating_quantitative: v}))} />
                )}
              </div>
              <StarRating label="Communication *" value={peerFeedback.rating_communication} onChange={(v) => setPeerFeedback(prev => ({...prev, rating_communication: v}))} />
              <StarRating label="Business Acumen *" value={peerFeedback.rating_business_acumen} onChange={(v) => setPeerFeedback(prev => ({...prev, rating_business_acumen: v}))} />
              <StarRating label="Overall Rating *" value={peerFeedback.rating_overall} onChange={(v) => setPeerFeedback(prev => ({...prev, rating_overall: v}))} />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Qualitative Feedback (Optional)</Label>
                <Textarea value={peerFeedback.qualitative_feedback} onChange={(e) => setPeerFeedback(prev => ({...prev, qualitative_feedback: e.target.value}))} placeholder="Share your experience with your peer..." className="min-h-[70px]" />
              </div>
              <Button onClick={handleSubmitPeerFeedback} disabled={submitting || !peerFeedback.session_type || peerFeedback.rating_overall < 1} className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="submit-mandatory-feedback">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Feedback'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MandatoryFeedbackModal;
