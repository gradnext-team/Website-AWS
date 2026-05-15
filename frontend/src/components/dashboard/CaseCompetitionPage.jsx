import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Crown, Clock, Play, CheckCircle2, XCircle, Gem, Trophy,
  SkipForward, Timer, Zap, Award, Flame, Star, AlertCircle,
  ChevronRight, ChevronUp, ChevronDown, Loader2, ArrowRight, Target, LogIn, Medal
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Progress } from '../ui/progress';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Competition Card Component
const CompetitionCard = ({ competition, onStart, loading, onStatusChange }) => {
  const [displayTime, setDisplayTime] = useState(0);
  const [localStatus, setLocalStatus] = useState(competition.status);
  
  // Single timer that handles both upcoming and live states
  useEffect(() => {
    // Determine which target time to use based on status
    let targetTime;
    if (localStatus === 'upcoming') {
      targetTime = new Date(competition.quiz_start_time).getTime();
    } else if (localStatus === 'live') {
      targetTime = new Date(competition.quiz_end_time).getTime();
    } else {
      // ended - no timer needed
      return;
    }
    
    // Initial calculation
    const now = Date.now();
    const initialDiff = Math.max(0, Math.floor((targetTime - now) / 1000));
    setDisplayTime(initialDiff);
    
    // Start interval
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const remaining = Math.max(0, Math.floor((targetTime - currentTime) / 1000));
      setDisplayTime(remaining);
      
      // Check for status transitions
      if (remaining <= 0) {
        if (localStatus === 'upcoming') {
          // Transition to live
          const endTime = new Date(competition.quiz_end_time).getTime();
          const liveRemaining = Math.max(0, Math.floor((endTime - currentTime) / 1000));
          
          if (liveRemaining > 0) {
            setLocalStatus('live');
            setDisplayTime(liveRemaining);
          } else {
            setLocalStatus('ended');
            clearInterval(interval);
          }
          if (onStatusChange) onStatusChange();
        } else if (localStatus === 'live') {
          // Transition to ended
          setLocalStatus('ended');
          clearInterval(interval);
          if (onStatusChange) onStatusChange();
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [localStatus, competition.quiz_start_time, competition.quiz_end_time, onStatusChange]);
  
  // Sync with parent status if it changes externally (e.g., from API)
  useEffect(() => {
    if (competition.status === 'ended' && localStatus !== 'ended') {
      setLocalStatus('ended');
    }
  }, [competition.status, localStatus]);
  
  const formatCountdown = (seconds) => {
    if (!seconds || seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getStatusBadge = () => {
    switch (localStatus) {
      case 'upcoming':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Upcoming</Badge>;
      case 'live':
        return <Badge className="bg-green-100 text-green-700 border-green-200 animate-pulse">LIVE</Badge>;
      case 'ended':
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Ended</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <div 
      className="relative overflow-hidden rounded-2xl border-2 transition-all hover:shadow-lg"
      style={{ 
        borderColor: competition.status === 'live' ? 'var(--gn-periwinkle)' : 'var(--gn-grey-light)',
        backgroundColor: 'white'
      }}
      data-testid="competition-card"
    >
      {/* Top accent bar */}
      <div 
        className="h-2 w-full"
        style={{ 
          background: competition.status === 'live' 
            ? 'linear-gradient(90deg, var(--gn-periwinkle), var(--gn-chrome-yellow))' 
            : 'linear-gradient(90deg, var(--gn-rhino), var(--gn-periwinkle))'
        }}
      />
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--gn-chrome-yellow), #F59E0B)' }}
            >
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>
                {competition.name}
              </h3>
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                {competition.description || 'Case Competition Quiz'}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
        
        {/* Quiz Info */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
              {competition.questions_per_user || 10}
            </p>
            <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Questions</p>
          </div>
          <div className="text-center border-x" style={{ borderColor: 'var(--gn-periwinkle-light)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
              {competition.duration_minutes || 10}
            </p>
            <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Minutes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
              +3/-1
            </p>
            <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Scoring</p>
          </div>
        </div>
        
        {/* Countdown / Status */}
        {localStatus === 'upcoming' && (
          <div className="mb-4 p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--gn-grey-dark)' }}>Quiz starts in</p>
            <p className="text-3xl font-mono font-bold" style={{ color: 'var(--gn-rhino)' }}>
              {formatCountdown(displayTime)}
            </p>
          </div>
        )}
        
        {localStatus === 'live' && !competition.has_started && (
          <div className="mb-4 p-4 rounded-xl text-center border-2 border-dashed" style={{ borderColor: 'var(--gn-periwinkle)', backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>Quiz ends in</p>
            <p className="text-3xl font-mono font-bold" style={{ color: 'var(--gn-rhino)' }}>
              {formatCountdown(displayTime)}
            </p>
          </div>
        )}
        
        {/* Quick Tip - Show on upcoming competitions so users can practice while waiting */}
        {localStatus === 'upcoming' && (
          <div className="mb-4 p-3 rounded-lg flex items-start gap-3" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', border: '1px solid #F59E0B' }}>
            <Flame className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#92400E' }}>Pro Tip</p>
              <p className="text-xs" style={{ color: '#A16207' }}>
                Practice with Case Drills while you wait — it will increase your chances to ace this competition!
              </p>
            </div>
          </div>
        )}
        
        {competition.has_submitted && (
          <div className="mb-4 p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle-lighter), #E0E7FF)' }}>
            <Medal className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--gn-periwinkle)' }} />
            <p className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>Thank you for attempting the quiz!</p>
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              We will evaluate your score.
            </p>
          </div>
        )}
        
        {/* Rules */}
        <div className="mb-4 text-sm space-y-2" style={{ color: 'var(--gn-grey-dark)' }}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gn-periwinkle)' }} />
            <span>Once started, timer continues even if you disconnect</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gn-periwinkle)' }} />
            <span>Cannot go back after submitting an answer</span>
          </div>
        </div>
        
        {/* Action Button */}
        {localStatus === 'upcoming' && (
          <Button 
            className="w-full" 
            disabled
            style={{ backgroundColor: 'var(--gn-grey-light)', color: 'var(--gn-grey-dark)' }}
          >
            <Clock className="w-4 h-4 mr-2" />
            Waiting to Start
          </Button>
        )}
        
        {localStatus === 'live' && !competition.has_started && (
          <Button 
            className="w-full text-white"
            style={{ backgroundColor: 'var(--gn-rhino)' }}
            onClick={() => onStart(competition)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Start Quiz Now
          </Button>
        )}
        
        {localStatus === 'live' && competition.has_started && !competition.has_submitted && (
          <Button 
            className="w-full text-white"
            style={{ backgroundColor: 'var(--gn-periwinkle)' }}
            onClick={() => onStart(competition)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            Continue Quiz
          </Button>
        )}
        
        {/* User has already submitted - no action needed, just show the thank you message above */}
        {competition.has_submitted && (
          <div className="text-center text-sm" style={{ color: 'var(--gn-grey)' }}>
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--gn-periwinkle)' }} />
            Quiz completed
          </div>
        )}
        
        {localStatus === 'ended' && !competition.has_submitted && (
          <Button 
            className="w-full" 
            disabled
            variant="outline"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Quiz Ended - You Missed It
          </Button>
        )}
      </div>
    </div>
  );
};

// Quiz Modal Component
const QuizModal = ({ isOpen, onClose, competition, onComplete }) => {
  const [showInstructions, setShowInstructions] = useState(true);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState([]); // For multi-select
  const [dragItems, setDragItems] = useState([]); // For drag-and-drop ordering
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quizEnded, setQuizEnded] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);
  const timerRef = useRef(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && competition) {
      // Reset all state
      setAttempt(null);
      setQuestions([]);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setSelectedAnswers([]);
      setDragItems([]);
      setTimeRemaining(0);
      setQuizEnded(false);
      setFinalResults(null);
      
      // Check if user already has an attempt (resuming)
      if (competition.has_started && !competition.has_submitted) {
        // Resuming - skip instructions, auto-start
        setShowInstructions(false);
        setShouldAutoStart(true);
      } else if (competition.has_submitted) {
        // Already submitted - show results
        setShowInstructions(false);
        setShouldAutoStart(true);
      } else {
        // New attempt - show instructions first
        setShowInstructions(true);
        setLoading(false);
        setShouldAutoStart(false);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, competition]);
  
  // Handle auto-start after state is set
  useEffect(() => {
    if (shouldAutoStart && isOpen && competition) {
      setShouldAutoStart(false);
      startQuiz();
    }
  }, [shouldAutoStart, isOpen, competition]);
  
  // Timer
  useEffect(() => {
    if (timeRemaining > 0 && !quizEnded && !showInstructions) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining, quizEnded, showInstructions]);
  
  // Handler for "I understand, Start Quiz" button
  const handleStartAfterInstructions = () => {
    setShowInstructions(false);
    startQuiz();
  };
  
  const startQuiz = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/competitions/competitions/${competition.id}/start`,
        {},
        { withCredentials: true }
      );
      
      setAttempt(res.data.attempt);
      setQuestions(res.data.questions);
      setTimeRemaining(Math.floor(res.data.time_remaining));
      
      // If resuming, go to the right question
      if (res.data.resumed) {
        const answeredCount = Object.keys(res.data.attempt.answers || {}).length;
        setCurrentIndex(answeredCount);
      }
      
      // Check if already submitted
      if (res.data.attempt.submitted) {
        await loadResults();
      }
    } catch (error) {
      console.error('Failed to start quiz:', error);
      alert(error.response?.data?.detail || 'Failed to start quiz');
      onClose();
    } finally {
      setLoading(false);
    }
  };
  
  const loadResults = async () => {
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/competitions/competitions/${competition.id}/results`,
        { withCredentials: true }
      );
      setFinalResults(res.data);
      setQuizEnded(true);
    } catch (error) {
      console.error('Failed to load results:', error);
    }
  };
  
  const handleTimeUp = async () => {
    setQuizEnded(true);
    // Auto-submit remaining questions as skipped
    await submitQuiz();
  };
  
  const handleSubmitAnswer = async (skip = false) => {
    if (submitting) return;
    
    setSubmitting(true);
    try {
      const currentQuestion = questions[currentIndex];
      
      // Determine the answer based on question type
      let answerToSubmit = selectedAnswer;
      if (!skip) {
        if (currentQuestion.question_type === 'multi_select' && selectedAnswers.length > 0) {
          answerToSubmit = selectedAnswers.join('|');
        } else if (currentQuestion.question_type === 'ordering' && dragItems.length > 0) {
          answerToSubmit = dragItems.join('|');
        }
      }
      
      await axios.post(
        `${BACKEND_URL}/api/competitions/competitions/${competition.id}/answer`,
        {
          question_id: currentQuestion.id,
          answer: skip ? null : answerToSubmit,
          time_taken_seconds: 0
        },
        { withCredentials: true }
      );
      
      // Clear selections and move to next question immediately (no feedback)
      setSelectedAnswer(null);
      setSelectedAnswers([]);
      setDragItems([]);
      
      // Move to next question or finish
      if (currentIndex + 1 >= questions.length) {
        submitQuiz();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };
  
  const submitQuiz = async () => {
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/competitions/competitions/${competition.id}/submit`,
        {},
        { withCredentials: true }
      );
      
      setFinalResults({
        attempt: res.data
      });
      setQuizEnded(true);
      onComplete?.();
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      // Still show ended state
      setQuizEnded(true);
      await loadResults();
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Instructions view (shown before quiz starts)
  if (showInstructions && !loading) {
    // Get quiz duration from competition (new field: quiz_duration_minutes, fallback to duration_minutes)
    const quizDuration = competition.quiz_duration_minutes || competition.duration_minutes || 10;
    
    // Default rules if none provided
    const defaultRules = `• You will have ${quizDuration} minutes to complete ${competition.questions_per_user || 10} questions
• Scoring: +3 for correct, -1 for wrong, 0 for skipped
• Once you start, the timer cannot be paused
• You cannot go back to previous questions after submitting
• If you disconnect, you can resume with remaining time
• Questions include case math, structuring, and analytical problems`;
    
    const rules = competition.rules || defaultRules;
    
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Trophy className="w-6 h-6" style={{ color: 'var(--gn-chrome-yellow)' }} />
              {competition.name || 'Case Competition'}
            </DialogTitle>
            <DialogDescription>
              Read the instructions carefully before starting the quiz
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            {/* Competition Info */}
            <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                    {competition.questions_per_user || 10}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Questions</p>
                </div>
                <div className="border-x" style={{ borderColor: 'var(--gn-periwinkle-light)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                    {competition.duration_minutes || 10}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Minutes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                    +3/-1
                  </p>
                  <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Scoring</p>
                </div>
              </div>
            </div>
            
            {/* Rules Section */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--gn-chrome-yellow)' }} />
                Instructions & Rules
              </h3>
              <div 
                className="p-4 rounded-lg border space-y-2 text-sm"
                style={{ 
                  backgroundColor: 'var(--gn-chrome-lightest)', 
                  borderColor: 'var(--gn-grey-light)',
                  color: 'var(--gn-grey-dark)'
                }}
              >
                {rules.split('\n').map((line, idx) => (
                  <p key={idx} className={line.startsWith('•') ? 'flex items-start gap-2' : ''}>
                    {line.startsWith('•') ? (
                      <>
                        <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--gn-periwinkle)' }} />
                        <span>{line.substring(1).trim()}</span>
                      </>
                    ) : line}
                  </p>
                ))}
              </div>
            </div>
            
            {/* Question Types Info */}
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
              <h4 className="font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>Question Types</h4>
              <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                  Multiple Choice
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                  Single Choice
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                  Numerical Input
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                  Ordering/Ranking
                </div>
              </div>
            </div>
            
            {/* Warning */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Important</p>
                <p className="text-sm text-amber-700">
                  Once you click &quot;Start Quiz&quot;, the timer will begin immediately. Make sure you have a stable internet connection and are ready to focus for the entire duration.
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartAfterInstructions}
              className="text-white"
              style={{ backgroundColor: 'var(--gn-rhino)' }}
              data-testid="start-quiz-confirm-btn"
            >
              <Play className="w-4 h-4 mr-2" />
              I Understand, Start Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  
  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: 'var(--gn-periwinkle)' }} />
            <p style={{ color: 'var(--gn-grey-dark)' }}>Loading quiz...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Results view - Just show thank you message, no score
  if (quizEnded && finalResults) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Quiz Submitted
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-8">
            {/* Thank You Message - No score shown */}
            <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
              <Medal className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--gn-periwinkle)' }} />
              <p className="text-xl font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Thank you for attempting the quiz!
              </p>
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                We will evaluate your score.
              </p>
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button 
              onClick={onClose}
              style={{ backgroundColor: 'var(--gn-periwinkle)', color: 'white' }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Quiz in progress
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;
  
  return (
    <Dialog open={isOpen} onOpenChange={() => {/* Prevent closing during quiz */}}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Timer Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: 'var(--gn-grey-light)' }}>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5" style={{ color: timeRemaining < 60 ? '#EF4444' : 'var(--gn-periwinkle)' }} />
            <span 
              className={`font-mono font-bold text-xl ${timeRemaining < 60 ? 'text-red-500 animate-pulse' : ''}`}
              style={{ color: timeRemaining < 60 ? undefined : 'var(--gn-rhino)' }}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>
          <Badge style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}>
            {currentIndex + 1} / {questions.length}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <Progress value={progress} className="h-2 mb-6" />
        
        {/* Question */}
        {currentQuestion && (
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge 
                className="text-xs"
                style={{ backgroundColor: 'var(--gn-chrome-lightest)', color: 'var(--gn-grey-dark)' }}
              >
                {currentQuestion.category?.replace('_', ' ')}
              </Badge>
            </div>
            
            <p className="text-lg font-medium mb-6" style={{ color: 'var(--gn-rhino)' }}>
              {currentQuestion.question}
            </p>
            
            {/* Options for MCQ */}
            {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedAnswer(option)}
                    disabled={submitting}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedAnswer === option 
                        ? 'border-[#8C9DFF] bg-[#DEE3FF]' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
                      {String.fromCharCode(65 + idx)}. {option}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Text input for text/numerical */}
            {(currentQuestion.question_type === 'text_input' || currentQuestion.question_type === 'numerical') && (
              <input
                type={currentQuestion.question_type === 'numerical' ? 'number' : 'text'}
                value={selectedAnswer || ''}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="w-full p-4 rounded-lg border-2 focus:outline-none focus:border-[#8C9DFF]"
                style={{ borderColor: 'var(--gn-grey-light)' }}
                disabled={submitting}
              />
            )}
            
            {/* Multi-select for selecting multiple options */}
            {currentQuestion.question_type === 'multi_select' && currentQuestion.options && (
              <div className="space-y-3">
                <p className="text-sm mb-2" style={{ color: 'var(--gn-grey-dark)' }}>
                  Select all that apply:
                </p>
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const newSelected = selectedAnswers.includes(option)
                        ? selectedAnswers.filter(a => a !== option)
                        : [...selectedAnswers, option];
                      setSelectedAnswers(newSelected);
                      setSelectedAnswer(newSelected.join('|'));
                    }}
                    disabled={submitting}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                      selectedAnswers.includes(option) 
                        ? 'border-[#8C9DFF] bg-[#DEE3FF]' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedAnswers.includes(option) ? 'bg-[#8C9DFF] border-[#8C9DFF]' : 'border-slate-300'
                    }`}>
                      {selectedAnswers.includes(option) && (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
                      {option}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Ordering/Ranking - drag items up and down */}
            {currentQuestion.question_type === 'ordering' && currentQuestion.options && (
              <div className="space-y-2">
                <p className="text-sm mb-3" style={{ color: 'var(--gn-grey-dark)' }}>
                  Arrange in the correct order (use arrows to reorder):
                </p>
                {(dragItems.length > 0 ? dragItems : currentQuestion.options).map((item, idx) => {
                  const items = dragItems.length > 0 ? dragItems : currentQuestion.options;
                  return (
                    <div
                      key={item}
                      className="flex items-center gap-2 p-3 rounded-lg border-2 transition-all"
                      style={{ borderColor: 'var(--gn-grey-light)', backgroundColor: 'white' }}
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: 'var(--gn-periwinkle)' }}
                      >
                        {idx + 1}
                      </span>
                      <span className="flex-1 font-medium" style={{ color: 'var(--gn-rhino)' }}>
                        {item}
                      </span>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            if (idx === 0) return;
                            const newItems = [...items];
                            [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
                            setDragItems(newItems);
                            setSelectedAnswer(newItems.join('|'));
                          }}
                          disabled={idx === 0 || submitting}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" style={{ color: 'var(--gn-grey-dark)' }} />
                        </button>
                        <button
                          onClick={() => {
                            if (idx === items.length - 1) return;
                            const newItems = [...items];
                            [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
                            setDragItems(newItems);
                            setSelectedAnswer(newItems.join('|'));
                          }}
                          disabled={idx === items.length - 1 || submitting}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" style={{ color: 'var(--gn-grey-dark)' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Actions */}
        {currentQuestion && (
          <DialogFooter className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => handleSubmitAnswer(true)}
              disabled={submitting}
              className="flex-1"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip (0 pts)
            </Button>
            <Button
              onClick={() => handleSubmitAnswer(false)}
              disabled={(!selectedAnswer && selectedAnswers.length === 0 && dragItems.length === 0) || submitting}
              className="flex-1 text-white"
              style={{ backgroundColor: 'var(--gn-rhino)' }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
              Submit & Next
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Main Page Component
const CaseCompetitionPage = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingCompetition, setStartingCompetition] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    // Check if user is logged in by checking if we're in dashboard or have session
    const checkAuth = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/auth/me`, { withCredentials: true });
        setIsLoggedIn(!!res.data?.id);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
    fetchCompetitions();
  }, []);
  
  const fetchCompetitions = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/competitions/competitions/active`, {
        withCredentials: true
      });
      setCompetitions(res.data.competitions || []);
    } catch (error) {
      console.error('Failed to fetch competitions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartQuiz = (competition) => {
    // Check if user needs to login to start quiz
    if (!isLoggedIn && competition.status === 'live') {
      setShowLoginPrompt(true);
      return;
    }
    setActiveQuiz(competition);
  };
  
  const handleQuizComplete = () => {
    fetchCompetitions();
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gn-periwinkle)' }} />
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="case-competition-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Case Competition</h1>
          <p style={{ color: 'var(--gn-grey-dark)' }}>
            Test your consulting skills in timed quiz competitions
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
          <Star className="w-5 h-5" style={{ color: '#D97706' }} />
          <span className="font-semibold" style={{ color: '#92400E' }}>Scoring: +3 / -1 / 0</span>
        </div>
      </div>
      
      {/* Competitions Grid */}
      {competitions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {competitions.map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              onStart={handleStartQuiz}
              loading={startingCompetition === competition.id}
              onStatusChange={fetchCompetitions}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle-lighter), #E0E7FF)' }}>
          <Crown className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--gn-periwinkle)' }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            No Active Competitions
          </h3>
          <p style={{ color: 'var(--gn-grey-dark)' }}>
            Check back later for upcoming case competitions
          </p>
        </div>
      )}
      
      {/* Quiz Modal */}
      {activeQuiz && (
        <QuizModal
          isOpen={!!activeQuiz}
          onClose={() => {
            setActiveQuiz(null);
            fetchCompetitions();
          }}
          competition={activeQuiz}
          onComplete={handleQuizComplete}
        />
      )}
      
      {/* Login Prompt Modal */}
      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <LogIn className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
              Login Required
            </DialogTitle>
            <DialogDescription>
              You need to be logged in to participate in the quiz competition.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              Create a free account or login to:
            </p>
            <ul className="mt-3 space-y-2 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Take the timed quiz
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Save your progress if disconnected
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                See your score on the leaderboard
              </li>
            </ul>
          </div>
          <DialogFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setShowLoginPrompt(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => window.location.href = '/?login=true'}
              className="text-white"
              style={{ backgroundColor: 'var(--gn-rhino)' }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login / Sign Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseCompetitionPage;
