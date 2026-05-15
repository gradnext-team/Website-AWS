import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import {
  isPromoActive,
  PROMO_PERCENT,
  PROMO_VERSION,
  formatPromoEndDate,
} from '../data/promoCampaign';

/**
 * Mobile-only floating bottom promo bar (Style B).
 *
 * Behavior:
 *  - Mobile breakpoints only (`md:hidden`).
 *  - Renders only on Home (`/`) and Subscription (`/subscription`).
 *  - Auto-hides once the user has scrolled past `#pricing-section` on the
 *    Subscription page — they're already engaged with plans.
 *  - Independently dismissible via X (separate localStorage key from the top
 *    banner so users see it even if they dismissed the top one).
 *  - Auto-hides when the campaign end date has passed.
 *  - Slides up 600 ms after first paint to avoid layout flicker.
 */
const ALLOWED_ROUTES = ['/', '/subscription'];
const DISMISS_KEY = `gn_promo_bottom_dismissed_${PROMO_VERSION}`;

const MobilePromoBottomBar = ({ ctaTo = '/subscription#pricing-section' }) => {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [scrolledPastPricing, setScrolledPastPricing] = useState(false);

  const onAllowedRoute = ALLOWED_ROUTES.some((r) =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)
  );

  // Read dismissal state on mount.
  useEffect(() => {
    if (!isPromoActive()) {
      setReady(true);
      return;
    }
    let isDismissed = false;
    try {
      isDismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch (e) {
      // ignore
    }
    setDismissed(isDismissed);
    setReady(true);
  }, []);

  // Slide-up entrance animation.
  useEffect(() => {
    if (ready && !dismissed && onAllowedRoute) {
      const t = setTimeout(() => setAnimateIn(true), 600);
      return () => clearTimeout(t);
    }
    setAnimateIn(false);
  }, [ready, dismissed, onAllowedRoute, location.pathname]);

  // Hide once user scrolls past the pricing section (Subscription page only).
  useEffect(() => {
    setScrolledPastPricing(false);
    if (!onAllowedRoute) return;
    const handleScroll = () => {
      const el = document.getElementById('pricing-section');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Section's bottom has scrolled above the viewport top + small buffer.
      if (rect.bottom < 80) {
        setScrolledPastPricing(true);
      } else {
        setScrolledPastPricing(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onAllowedRoute, location.pathname]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch (e) {
      // ignore
    }
  };

  const visible =
    ready && isPromoActive() && !dismissed && onAllowedRoute && !scrolledPastPricing;

  if (!visible) return null;

  return (
    <div
      data-testid="promo-bottom-bar"
      className="md:hidden fixed bottom-3 left-3 right-3 z-30 transition-all duration-500"
      style={{
        transform: animateIn ? 'translateY(0)' : 'translateY(120%)',
        opacity: animateIn ? 1 : 0,
      }}
    >
      <div
        className="rounded-2xl px-3 py-2.5 flex items-center gap-2 text-white"
        style={{
          background:
            'linear-gradient(95deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)',
          boxShadow: '0 12px 32px rgba(46,53,88,0.35)',
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <Sparkles className="w-4 h-4" style={{ color: 'var(--gn-chrome-yellow)' }} />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[12px] font-bold">
            <span style={{ color: '#FFD68A' }}>{PROMO_PERCENT}% off</span>{' '}
            6-month plans
          </div>
          <div className="text-[10px] opacity-80 truncate">
            Auto-applied · Ends {formatPromoEndDate()}
          </div>
        </div>
        <Link
          to={ctaTo}
          data-testid="promo-bottom-cta"
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 flex items-center gap-1 transition-transform active:scale-95"
          style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
        >
          Claim <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss promotional banner"
          data-testid="promo-bottom-dismiss"
          className="p-1 rounded-full text-white/70 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MobilePromoBottomBar;
