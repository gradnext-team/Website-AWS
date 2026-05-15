import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Progress } from './progress';
import {
  Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  Loader2, Trophy, AlertTriangle, Timer
} from 'lucide-react';
import DrillChartRenderer from './DrillChartRenderer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Time limits based on difficulty (in seconds)
const TIME_LIMITS = {
  beginner: 300,      // 5 minutes
  intermediate: 600,  // 10 minutes
  advanced: 900       // 15 minutes
};

const AIDrillModal = ({ isOpen, onClose, drill, drillType, difficulty, drillId, drillName }) => {
  // Extract props from drill object if provided, otherwise use individual props
  const actualDrillType = drill?.drill_type || drillType;
  const actualDifficulty = drill?.difficulty || difficulty;
  const actualDrillId = drill?.id || drillId;
  const actualDrillName = drill?.name || drillName;
  // Drill state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drillData, setDrillData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Timer state - gets set based on difficulty
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [initialTime, setInitialTime] = useState(600);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Refs to track state for callbacks
  const answersRef = useRef(answers);
  const drillDataRef = useRef(drillData);
  
  // Update refs when state changes
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  
  useEffect(() => {
    drillDataRef.current = drillData;
  }, [drillData]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyLabel = () => {
    const labels = {
      beginner: 'Easy',
      intermediate: 'Medium',
      advanced: 'Hard'
    };
    return labels[actualDifficulty] || actualDifficulty;
  };

  const getDrillTypeLabel = () => {
    const labels = {
      case_math: 'Case Math',
      case_structuring: 'Case Structuring',
      charts_exhibits: 'Charts & Exhibits',
      market_sizing: 'Market Sizing'
    };
    return labels[actualDrillType] || actualDrillType;
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent! You\'re ready for MBB interviews!';
    if (percentage >= 80) return 'Great job! Keep practicing for perfection.';
    if (percentage >= 60) return 'Good effort! Review the explanations to improve.';
    if (percentage >= 40) return 'Keep practicing! Focus on the areas you missed.';
    return 'Don\'t give up! Review the material and try again.';
  };

  // Evaluate answers using refs
  const evaluateAllAnswers = useCallback(async () => {
    const currentAnswers = answersRef.current;
    const currentDrillData = drillDataRef.current;
    
    if (!currentDrillData?.questions) return;
    
    setSubmitting(true);
    setIsTimerActive(false);
    
    const evaluatedResults = {};
    let correctCount = 0;
    
    for (const question of currentDrillData.questions) {
      const userAnswer = currentAnswers[question.id] || '';
      
      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/ai-drills/evaluate`,
          {
            question,
            user_answer: userAnswer,
            drill_type: actualDrillType
          },
          { withCredentials: true }
        );
        
        evaluatedResults[question.id] = {
          ...response.data,
          user_answer: userAnswer
        };
        
        if (response.data.is_correct) {
          correctCount++;
        }
      } catch (err) {
        // Fallback evaluation
        let isCorrect = false;
        let correctAnswerDisplay = question.correct_answer;
        
        if (question.type === 'multiple_choice') {
          isCorrect = userAnswer === question.correct_answer;
        } else if (question.type === 'multi_select') {
          const correctIndices = new Set(question.correct_answers || []);
          const userIndices = new Set(Array.isArray(userAnswer) ? userAnswer : []);
          isCorrect = correctIndices.size === userIndices.size && 
            [...correctIndices].every(i => userIndices.has(i));
          correctAnswerDisplay = question.correct_answers
            ?.map(i => question.options[i])
            .join(', ') || question.correct_answer;
        } else {
          isCorrect = question.acceptable_answers?.some(a => 
            a.toLowerCase().replace(/\s/g, '') === String(userAnswer).toLowerCase().replace(/\s/g, '')
          );
        }
        
        evaluatedResults[question.id] = {
          is_correct: isCorrect,
          correct_answer: correctAnswerDisplay,
          explanation: question.explanation,
          user_answer: userAnswer
        };
        
        if (isCorrect) correctCount++;
      }
    }
    
    setResults(evaluatedResults);
    setShowResults(true);
    setSubmitting(false);
    
    // Record completion
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);
    try {
      await axios.post(
        `${BACKEND_URL}/api/ai-drills/complete/${currentDrillData.drill_session_id}`,
        {
          score: correctCount,
          total: currentDrillData.questions.length,
          time_taken: timeTaken
        },
        { withCredentials: true }
      );
    } catch (err) {
      console.error('Failed to record completion:', err);
    }
  }, [actualDrillType]);

  // Generate drill
  const generateDrill = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnswers({});
    setResults({});
    setShowResults(false);
    setCurrentQuestionIndex(0);
    
    try {
      const requestBody = { drill_type: actualDrillType, difficulty: actualDifficulty };
      // If specific drill_id is provided, include it
      if (actualDrillId) {
        requestBody.drill_id = actualDrillId;
      }
      
      const response = await axios.post(
        `${BACKEND_URL}/api/ai-drills/generate`,
        requestBody,
        { withCredentials: true }
      );
      
      setDrillData(response.data);
      
      // Use time_limit from API response (drill-type-specific), fallback to hardcoded TIME_LIMITS
      const timeLimit = response.data.time_limit || TIME_LIMITS[actualDifficulty] || 600;
      setTimeRemaining(timeLimit);
      setInitialTime(timeLimit);
      
      setIsTimerActive(true);
      startTimeRef.current = Date.now();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load drill. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [actualDrillType, actualDifficulty, actualDrillId]);

  // Generate drill when modal opens
  useEffect(() => {
    if (isOpen && actualDrillType && actualDifficulty) {
      generateDrill();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, actualDrillType, actualDifficulty, actualDrillId, generateDrill]);

  // Timer logic
  useEffect(() => {
    if (isTimerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Auto-submit on time up
            setIsTimerActive(false);
            evaluateAllAnswers();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerActive, evaluateAllAnswers]);

  const currentQuestion = drillData?.questions?.[currentQuestionIndex];

  const handleAnswerChange = (value) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleMultipleChoiceSelect = (optionIndex) => {
    const selectedOption = currentQuestion.options[optionIndex];
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: selectedOption
    }));
  };

  const handleMultiSelectToggle = (optionIndex) => {
    setAnswers(prev => {
      const currentSelections = prev[currentQuestion.id] || [];
      const newSelections = currentSelections.includes(optionIndex)
        ? currentSelections.filter(i => i !== optionIndex)
        : [...currentSelections, optionIndex].sort((a, b) => a - b);
      return {
        ...prev,
        [currentQuestion.id]: newSelections
      };
    });
  };

  const handleSubmit = () => {
    evaluateAllAnswers();
  };

  const handleClose = () => {
    setIsTimerActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onClose();
  };

  // Loading state
  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Loading Drill...</h3>
            <p className="text-slate-500 text-center">
              Preparing {getDrillTypeLabel()} questions<br />
              Difficulty: {getDifficultyLabel()}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Error state
  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Failed to Load</h3>
            <p className="text-slate-500 text-center mb-6">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={generateDrill}>Try Again</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Results view
  if (showResults) {
    const totalQuestions = drillData?.questions?.length || 0;
    const correctCount = Object.values(results).filter(r => r.is_correct).length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Drill Complete!
            </DialogTitle>
          </DialogHeader>
          
          {/* Score Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Your Score</p>
                <p className={`text-4xl font-bold ${getScoreColor(percentage)}`}>
                  {correctCount}/{totalQuestions}
                </p>
                <p className="text-lg text-slate-600">{percentage}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600 mb-1">Time</p>
                <p className="text-2xl font-semibold text-slate-800">
                  {formatTime(initialTime - timeRemaining)}
                </p>
              </div>
            </div>
            <p className={`text-center font-medium ${getScoreColor(percentage)}`}>
              {getScoreMessage(percentage)}
            </p>
          </div>
          
          {/* Question Review */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800">Review Answers</h4>
            {drillData?.questions?.map((question, idx) => {
              const result = results[question.id];
              const isCorrect = result?.is_correct;
              
              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border ${
                    isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 mb-2">
                        Q{idx + 1}: {question.question}
                      </p>
                      {/* Show chart/exhibit if question has one */}
                      {question.chart_type && question.chart_data && (
                        <div className="my-3 p-3 bg-white rounded-lg border border-slate-200">
                          <DrillChartRenderer 
                            chartType={question.chart_type} 
                            chartData={question.chart_data}
                          />
                        </div>
                      )}
                      <div className="text-sm space-y-1">
                        <p className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                          Your answer: {
                            question.type === 'multi_select' && Array.isArray(result?.user_answer)
                              ? result.user_answer.map(i => question.options[i]).join(', ') || '(no answer)'
                              : result?.user_answer || '(no answer)'
                          }
                        </p>
                        {!isCorrect && (
                          <p className="text-green-700">
                            Correct answer: {result?.correct_answer}
                          </p>
                        )}
                      </div>
                      {result?.explanation && (
                        <div className="mt-3 p-3 bg-white/50 rounded-lg">
                          <p className="text-sm text-slate-600">
                            <span className="font-medium">Explanation:</span> {result.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Check if current question has a chart
  const hasChart = currentQuestion?.chart_type && currentQuestion?.chart_data;

  // Active drill view
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${hasChart ? 'max-w-5xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {actualDrillName || `${getDrillTypeLabel()} - ${getDifficultyLabel()}`}
            </DialogTitle>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              timeRemaining <= 60 ? 'bg-red-100 text-red-700' : 
              timeRemaining <= 180 ? 'bg-yellow-100 text-yellow-700' : 
              'bg-blue-100 text-blue-700'
            }`}>
              <Timer className="w-4 h-4" />
              <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>Question {currentQuestionIndex + 1} of {drillData?.questions?.length}</span>
            <span>{Object.keys(answers).length} answered</span>
          </div>
          <Progress 
            value={((currentQuestionIndex + 1) / (drillData?.questions?.length || 1)) * 100} 
            className="h-2"
          />
        </div>

        {/* Question */}
        {currentQuestion && (
          <div className={`${hasChart ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}`}>
            {/* Chart display for charts_exhibits drills */}
            {hasChart && (
              <div className="lg:col-span-1">
                <DrillChartRenderer 
                  chartType={currentQuestion.chart_type} 
                  chartData={currentQuestion.chart_data} 
                />
              </div>
            )}
            
            <div className={`${hasChart ? 'lg:col-span-1' : ''} space-y-4`}>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className={`font-medium text-slate-800 ${hasChart ? 'text-base' : 'text-lg'}`}>
                  {currentQuestion.question}
                </p>
                {currentQuestion.type === 'multi_select' && (
                  <p className="text-sm text-blue-600 mt-2">Select all that apply</p>
                )}
              </div>

            {/* Answer input based on question type */}
            {currentQuestion.type === 'multiple_choice' ? (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleMultipleChoiceSelect(idx)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      answers[currentQuestion.id] === option
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        answers[currentQuestion.id] === option
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-slate-300'
                      }`}>
                        {answers[currentQuestion.id] === option && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : currentQuestion.type === 'multi_select' ? (
              <div className="space-y-3">
                {currentQuestion.options?.map((option, idx) => {
                  const selectedIndices = answers[currentQuestion.id] || [];
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleMultiSelectToggle(idx)}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300'
                        }`}>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span>{option}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>
                <Input
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="text-lg p-4"
                  data-testid="text-answer-input"
                />
                <p className="text-sm text-slate-500 mt-2">
                  Press Enter or click Next to continue
                </p>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          
          {currentQuestionIndex === (drillData?.questions?.length || 0) - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Submit Drill
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestionIndex(prev => 
                Math.min((drillData?.questions?.length || 1) - 1, prev + 1)
              )}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
        
        {/* Question navigation dots */}
        <div className="flex justify-center gap-2 mt-4">
          {drillData?.questions?.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-3 h-3 rounded-full transition-all ${
                idx === currentQuestionIndex
                  ? 'bg-blue-600 scale-125'
                  : answers[q.id]
                  ? 'bg-green-500'
                  : 'bg-slate-300 hover:bg-slate-400'
              }`}
              title={`Question ${idx + 1}${answers[q.id] ? ' (answered)' : ''}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIDrillModal;
