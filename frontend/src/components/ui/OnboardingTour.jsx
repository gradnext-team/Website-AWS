import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './button';

const TOUR_STEPS = [
  {
    target: '[data-tour="sidebar-courses"]',
    title: 'Welcome to gradnext!',
    content: 'Let us show you around! This quick tour will help you navigate the dashboard and make the most of your preparation journey.',
    position: 'right',
    highlight: false,
  },
  {
    target: '[data-tour="sidebar-courses"]',
    title: 'Courses',
    content: 'Access all your video courses here. Watch lessons on case interviews, frameworks, and more. You can adjust playback speed and track your progress.',
    position: 'right',
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-workshops"]',
    title: 'Live Workshops',
    content: 'Join live interactive workshops with industry experts. Check upcoming sessions and access recordings of past workshops.',
    position: 'right',
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-drills"]',
    title: 'Case Drills',
    content: 'Practice with real case interview questions. These drills help you build muscle memory for common case types.',
    position: 'right',
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-materials"]',
    title: 'Interview Materials',
    content: 'Download PDFs, frameworks, and cheat sheets to support your preparation. Great for quick revision!',
    position: 'right',
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-peer"]',
    title: 'Peer Practice',
    content: 'Practice cases with other candidates! Get matched with peers at your level and practice together via video calls.',
    position: 'right',
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-coaching"]',
    title: '1:1 Coaching',
    content: 'Book sessions with experienced consultants from top firms. Get personalized feedback and guidance.',
    position: 'right',
    highlight: true,
  },
  {
    target: '[data-tour="sidebar-profile"]',
    title: 'Your Profile',
    content: 'View and update your profile, check your subscription status, and track your overall progress.',
    position: 'right',
    highlight: true,
  },
  {
    target: 'body',
    title: 'You\'re All Set!',
    content: 'That\'s it! You\'re ready to start your consulting interview preparation. Good luck on your journey!',
    position: 'center',
    highlight: false,
  },
];

const OnboardingTour = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateTargetPosition = () => {
      const step = TOUR_STEPS[currentStep];
      if (step.position === 'center') {
        setTargetRect(null);
        return;
      }

      const target = document.querySelector(step.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll target into view if needed
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updateTargetPosition();
    window.addEventListener('resize', updateTargetPosition);
    
    return () => window.removeEventListener('resize', updateTargetPosition);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('gradnext_tour_completed', 'skipped');
    onClose();
  };

  const handleComplete = () => {
    localStorage.setItem('gradnext_tour_completed', 'true');
    onComplete?.();
    onClose();
  };

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (step.position === 'center' || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 20;
    let style = {
      position: 'fixed',
    };

    switch (step.position) {
      case 'right':
        style.left = `${targetRect.right + padding}px`;
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'left':
        style.right = `${window.innerWidth - targetRect.left + padding}px`;
        style.top = `${targetRect.top + targetRect.height / 2}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        style.top = `${targetRect.bottom + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.bottom = `${window.innerHeight - targetRect.top + padding}px`;
        style.left = `${targetRect.left + targetRect.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      default:
        break;
    }

    return style;
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-[9998]"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
        }}
      />

      {/* Highlight cutout for target element */}
      {step.highlight && targetRect && (
        <div
          className="fixed z-[9999] rounded-lg ring-4 ring-blue-500 ring-offset-4 ring-offset-transparent"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            background: 'transparent',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[10000] bg-white rounded-xl shadow-2xl p-6 max-w-md animate-in fade-in zoom-in-95 duration-300"
        style={getTooltipStyle()}
        data-testid="onboarding-tooltip"
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {TOUR_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'w-6 bg-blue-600'
                  : index < currentStep
                  ? 'w-1.5 bg-blue-400'
                  : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {step.title}
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            {step.content}
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <div>
            {!isFirstStep && !isLastStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-slate-500 hover:text-slate-700"
              >
                Skip Tour
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
              data-testid="tour-next-btn"
            >
              {isLastStep ? (
                'Get Started'
              ) : isFirstStep ? (
                <>
                  Start Tour
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Arrow pointer */}
        {step.position === 'right' && targetRect && (
          <div
            className="absolute w-3 h-3 bg-white transform rotate-45"
            style={{
              left: '-6px',
              top: '50%',
              marginTop: '-6px',
              boxShadow: '-2px 2px 4px rgba(0,0,0,0.1)',
            }}
          />
        )}
      </div>
    </>
  );
};

// Hook to manage tour state
export const useOnboardingTour = () => {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Check if user has completed the tour
    const tourCompleted = localStorage.getItem('gradnext_tour_completed');
    if (!tourCompleted) {
      // Show tour after a short delay
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = () => setShowTour(true);
  const closeTour = () => setShowTour(false);
  const resetTour = () => {
    localStorage.removeItem('gradnext_tour_completed');
    setShowTour(true);
  };

  return { showTour, startTour, closeTour, resetTour };
};

export default OnboardingTour;
