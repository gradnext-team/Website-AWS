import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Typewriter animation cycling through "consulting → McKinsey → BCG → Bain".
 *
 * Mirrors the implementation in `pages/Home.jsx` (same speeds, same pause,
 * same min-width to prevent layout shift) so the cohort hero feels
 * consistent with the marketing site's home page.
 */
const TypingAnimation = () => {
  const words = ['consulting', 'McKinsey', 'BCG', 'Bain'];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const typeSpeed = 120;
  const deleteSpeed = 80;
  const pauseTime = 2000;

  const tick = useCallback(() => {
    const currentWord = words[currentWordIndex];

    if (!isDeleting) {
      setDisplayText(currentWord.substring(0, displayText.length + 1));
      if (displayText === currentWord) {
        setTimeout(() => setIsDeleting(true), pauseTime);
        return;
      }
    } else {
      setDisplayText(currentWord.substring(0, displayText.length - 1));
      if (displayText === '') {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }
    }
  }, [currentWordIndex, displayText, isDeleting, words]);

  useEffect(() => {
    const timer = setTimeout(tick, isDeleting ? deleteSpeed : typeSpeed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);

  return (
    <span className="inline-block min-w-[160px] text-left">
      <span style={{ color: 'var(--gn-periwinkle)' }}>{displayText}</span>
      <span className="animate-blink" style={{ color: 'var(--gn-periwinkle)' }}>|</span>
    </span>
  );
};

/**
 * CohortHero - Gradient hero with concentric circles backdrop.
 * Typewriter headline cycles "consulting → McKinsey → BCG → Bain"
 * matching the Home page's animated H1.
 */
export default function CohortHero({ cohort, onApply }) {
  return (
    <section
      id="top"
      className="hero-section pt-24 sm:pt-36 pb-12 sm:pb-20 overflow-hidden relative"
      data-testid="cohort-hero"
    >
      {/* Concentric Circles Background — same primitives as Home/Coaching */}
      <div className="hero-concentric">
        <div className="hero-center-glow" />
        <div className="hero-circle hero-circle-1" />
        <div className="hero-circle hero-circle-2" />
        <div className="hero-circle hero-circle-3" />
        <div className="hero-circle hero-circle-4" />
        <div className="hero-circle hero-circle-5" />
        <div className="hero-circle hero-circle-6" />
        <div className="hero-circle hero-circle-7" />
        <div className="hero-circle hero-circle-8" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          {/* Cohort badge */}
          <div className="badge-primary mb-4 sm:mb-8 animate-fade-in inline-flex mx-auto text-sm">
            <span
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}
            />
            <span>
              {cohort.name} · {cohort.start_date_label}
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-8 animate-fade-in-up px-2"
            style={{ color: 'var(--gn-rhino)', lineHeight: '1.1' }}
          >
            Cohort to get your <TypingAnimation /> journey started
          </h1>

          <p
            className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 max-w-3xl mx-auto animate-fade-in-up stagger-1 px-4"
            style={{ color: 'var(--gn-grey-dark)' }}
          >
            Build your consulting fundamentals. Learn from McKinsey, BCG, and Bain consultants in a four-week live cohort.
          </p>

          <div className="flex flex-col items-center justify-center animate-fade-in-up stagger-2">
            <Button
              onClick={onApply}
              size="lg"
              className="px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg btn-primary"
              data-testid="cohort-hero-apply-btn"
            >
              Apply Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="mt-2 text-sm font-medium text-slate-500">Scholarship available</p>
          </div>

          {/* Rating */}
          <div className="flex flex-col items-center justify-center gap-1 animate-fade-in-up stagger-3 mt-8">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className="w-5 h-5"
                  fill="#FBBF24"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{cohort.rating}</span> out of 5 rating from{' '}
              <span className="font-semibold text-gray-800">{cohort.rating_count}</span> candidates
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
