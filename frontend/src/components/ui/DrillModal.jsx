import React, { useState } from 'react';
import { X, Clock, Target, CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

// Mock questions for different drill types
const MOCK_QUESTIONS = {
  'Mental Math': [
    {
      question: "A company has revenues of $240M and a profit margin of 15%. What is the profit?",
      options: ["$36M", "$24M", "$40M", "$30M"],
      correct: 0
    },
    {
      question: "If market size is 50M users and penetration is 12%, how many customers?",
      options: ["6M", "4M", "5M", "8M"],
      correct: 0
    },
    {
      question: "Calculate: 17% of 800",
      options: ["136", "128", "144", "152"],
      correct: 0
    },
    {
      question: "A product sells for $45 with 60% margin. What's the cost?",
      options: ["$18", "$27", "$15", "$20"],
      correct: 0
    },
    {
      question: "If revenue grows 25% YoY from $80M, what's the new revenue?",
      options: ["$100M", "$95M", "$105M", "$90M"],
      correct: 0
    }
  ],
  'Market Sizing': [
    {
      question: "Estimate the annual market for coffee in a city of 1M people if 40% drink coffee daily at $3/cup.",
      options: ["~$438M", "~$320M", "~$540M", "~$250M"],
      correct: 0
    },
    {
      question: "What's a reasonable estimate for smartphones in a country with 50M households?",
      options: ["75-100M", "50-60M", "120-150M", "30-40M"],
      correct: 0
    },
    {
      question: "If 5% of 200M adults use a service 2x/month at $10, annual market size?",
      options: ["$2.4B", "$1.2B", "$3.6B", "$2.0B"],
      correct: 0
    }
  ],
  'Data Interpretation': [
    {
      question: "Revenue dropped 20% YoY while costs stayed flat. Margin was 30%. New margin is?",
      options: ["12.5%", "15%", "10%", "20%"],
      correct: 0
    },
    {
      question: "3 products contribute 40%, 35%, 25% to revenue. If product 1 grows 50%, what's its new share?",
      options: ["~46%", "~50%", "~42%", "~55%"],
      correct: 0
    }
  ],
  'default': [
    {
      question: "A company's PE ratio is 15 and EPS is $4. What's the stock price?",
      options: ["$60", "$45", "$75", "$52"],
      correct: 0
    },
    {
      question: "If CAC is $50 and LTV is $200, what's the LTV/CAC ratio?",
      options: ["4x", "3x", "5x", "2.5x"],
      correct: 0
    },
    {
      question: "CAGR over 3 years: $100 → $172. Approximate CAGR?",
      options: ["~20%", "~15%", "~25%", "~18%"],
      correct: 0
    }
  ]
};

const DrillModal = ({ 
  isOpen, 
  onClose, 
  drill
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  if (!drill) return null;

  const questions = MOCK_QUESTIONS[drill.category] || MOCK_QUESTIONS['default'];
  const question = questions[currentQuestion];

  const handleAnswerSelect = (index) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    if (index === question.correct) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setIsComplete(false);
  };

  const handleClose = () => {
    handleRestart();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            {drill.title}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {drill.duration}
            </span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
              {drill.category}
            </span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
              {drill.difficulty}
            </span>
          </div>
        </DialogHeader>

        {!isComplete ? (
          <div className="mt-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500">
                Question {currentQuestion + 1} of {questions.length}
              </span>
              <span className="text-sm font-medium text-emerald-600">
                Score: {score}/{currentQuestion + (showResult ? 1 : 0)}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-6">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question */}
            <div className="bg-slate-50 rounded-xl p-6 mb-6">
              <p className="text-lg font-medium text-slate-900">{question.question}</p>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    showResult
                      ? index === question.correct
                        ? 'border-emerald-500 bg-emerald-50'
                        : index === selectedAnswer
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-slate-200 bg-white'
                      : selectedAnswer === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      showResult && index === question.correct ? 'text-emerald-700' :
                      showResult && index === selectedAnswer && index !== question.correct ? 'text-rose-700' :
                      'text-slate-700'
                    }`}>
                      {option}
                    </span>
                    {showResult && index === question.correct && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                    {showResult && index === selectedAnswer && index !== question.correct && (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Next Button */}
            {showResult && (
              <Button onClick={handleNext} className="w-full btn-primary-gradient">
                {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        ) : (
          /* Results */
          <div className="text-center py-8">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              score >= questions.length * 0.7 ? 'bg-emerald-100' : 'bg-amber-100'
            }`}>
              {score >= questions.length * 0.7 ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              ) : (
                <Target className="w-10 h-10 text-amber-600" />
              )}
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {score >= questions.length * 0.7 ? 'Great Job!' : 'Keep Practicing!'}
            </h3>
            <p className="text-slate-500 mb-6">
              You scored {score} out of {questions.length} ({Math.round((score / questions.length) * 100)}%)
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleRestart} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={handleClose} className="btn-primary-gradient">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DrillModal;
