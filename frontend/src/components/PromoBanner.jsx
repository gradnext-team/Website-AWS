import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Flame, ArrowRight } from 'lucide-react';
import {
  isPromoActive,
  PROMO_DISMISS_KEY,
  PROMO_PERCENT,
  formatPromoEndDate,
} from '../data/promoCampaign';

/**
 * Sticky site-wide promo bar:
 *   "30% off on all 6-month subscription plans · Auto-applied at checkout · Ends 10 May"
 *
 * - Dismissible (persisted in localStorage with a campaign-version key).
 * - Auto-hides once the campaign end date has passed.
 * - Mounted in App.js for all non-dashboard / non-admin routes.
 * - Pushes the floating Header down by setting `--gn-promo-bar-h` on :root,
 *   which Header.jsx reads to offset its `top` position.
 */
const BAR_HEIGHT_PX = 40;

const PromoBanner = ({
  ctaTo = '/subscription#pricing-section',
  ctaLabel = 'Claim 30% off',
}) => {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isPromoActive()) {
      setReady(true);
      return;
    }
    let isDismissed = false;
    try {
      isDismissed = window.localStorage.getItem(PROMO_DISMISS_KEY) === '1';
    } catch (e) {
      // ignore
    }
    setDismissed(isDismissed);
    setReady(true);
  }, []);

  const visible = ready && isPromoActive() && !dismissed;

  // Sync CSS var so the floating Header offsets itself.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--gn-promo-bar-h', visible ? `${BAR_HEIGHT_PX}px` : '0px');
    return () => root.style.setProperty('--gn-promo-bar-h', '0px');
  }, [visible]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(PROMO_DISMISS_KEY, '1');
    } catch (e) {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div
      data-testid="promo-banner-root"
      className="w-full relative overflow-hidden z-[60]"
      style={{
        height: `${BAR_HEIGHT_PX}px`,
        background:
          'linear-gradient(90deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 60%, #6E77F5 100%)',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4) 1px, transparent 1px), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px, 32px 32px',
        }}
      />
      <div className="relative h-full max-w-7xl mx-auto px-3 sm:px-6 pr-9 sm:pr-12 flex items-center justify-center gap-2 sm:gap-3 text-white text-xs sm:text-sm">
        <span
          className="hidden md:inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide shrink-0"
          style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
        >
          <Flame className="w-3 h-3 mr-1" /> LIMITED TIME
        </span>
        <span className="font-medium text-center truncate min-w-0">
          <span className="font-bold" style={{ color: '#FFD68A' }}>
            {PROMO_PERCENT}% off
          </span>{' '}
          <span className="hidden sm:inline">on all 6-month subscription plans</span>
          <span className="sm:hidden">· 6-month plans</span>
          <span className="hidden lg:inline">
            {' '}· Auto-applied at checkout · Ends {formatPromoEndDate()}
          </span>
          <span className="hidden sm:inline lg:hidden">
            {' '}· Auto-applied · Ends {formatPromoEndDate()}
          </span>
          <span className="sm:hidden">
            {' '}· Ends 10 May
          </span>
        </span>
        <Link
          to={ctaTo}
          data-testid="promo-banner-cta"
          className="inline-flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-transform hover:scale-105 shrink-0 whitespace-nowrap"
          style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
        >
          <span className="hidden sm:inline">{ctaLabel}</span>
          <span className="sm:hidden">Claim</span>
          <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss promotional banner"
        data-testid="promo-banner-dismiss"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PromoBanner;
