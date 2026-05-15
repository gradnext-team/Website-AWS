import React, { useRef, useState, useEffect } from 'react';
import {
  Star,
  ArrowRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Sparkles,
} from 'lucide-react';

/**
 * Mockup: Horizontal-scroll coach carousel
 *   - Sits ABOVE the existing "Choose Your Coaching Plan" section.
 *   - Each card = compact coach summary with a single CTA: "Book a session".
 *   - Below the scroll: outline button "View more coaches →" → /coaches.
 *   - Snap-scrolling on mobile, arrow nav on desktop.
 */

const RHINO = 'var(--gn-rhino)';
const RHINO_LIGHT = 'var(--gn-rhino-light)';
const PERIWINKLE = 'var(--gn-periwinkle)';
const PERIWINKLE_LIGHT = 'var(--gn-periwinkle-light)';
const CHROME = 'var(--gn-chrome-yellow)';

const coaches = [
  { name: 'Saurabh Mehta',  firm: 'Ex-McKinsey', role: 'Engagement Manager',     rating: 4.96, reviews: 218, price: 4999, slots: 3, top: true,  initials: 'SM' },
  { name: 'Priya Raghavan', firm: 'Ex-BCG',      role: 'Manager',                rating: 4.92, reviews: 187, price: 4499, slots: 5, top: false, initials: 'PR' },
  { name: 'Arjun Khanna',   firm: 'Ex-Bain',     role: 'Senior Consultant',      rating: 4.88, reviews: 142, price: 3999, slots: 2, top: false, initials: 'AK' },
  { name: 'Neha Sharma',    firm: 'Ex-Kearney',  role: 'Principal',              rating: 4.95, reviews: 96,  price: 4499, slots: 4, top: true,  initials: 'NS' },
  { name: 'Vikram Joshi',   firm: 'Ex-McKinsey', role: 'Senior Engagement Mgr',  rating: 4.90, reviews: 165, price: 5499, slots: 1, top: false, initials: 'VJ' },
  { name: 'Aanya Iyer',     firm: 'Ex-BCG',      role: 'Project Leader',         rating: 4.94, reviews: 132, price: 4999, slots: 6, top: false, initials: 'AI' },
  { name: 'Rohit Tiwari',   firm: 'Ex-McKinsey', role: 'Associate Partner',      rating: 4.97, reviews: 245, price: 6499, slots: 2, top: true,  initials: 'RT' },
  { name: 'Mira Das',       firm: 'Ex-Bain',     role: 'Manager',                rating: 4.89, reviews: 88,  price: 4299, slots: 7, top: false, initials: 'MD' },
];

/* ================== Coach card (single CTA) ================== */
const CoachCard = ({ c }) => (
  <div
    className="relative rounded-2xl bg-white overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl shrink-0 snap-start"
    style={{
      width: 280,
      border: '1px solid #e5e7eb',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}
  >
    {c.top && (
      <span
        className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold"
        style={{ background: CHROME, color: RHINO }}
      >
        ★ TOP-RATED
      </span>
    )}
    {c.slots <= 3 && (
      <span
        className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
        style={{ background: '#10B981', color: 'white' }}
      >
        ● {c.slots} slots left
      </span>
    )}

    <div className="p-5">
      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-3 mt-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
          style={{ background: PERIWINKLE_LIGHT, color: RHINO }}
        >
          {c.initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-tight truncate" style={{ color: RHINO }}>
            {c.name}
          </h3>
          <p className="text-xs mt-0.5 flex items-center gap-1 truncate" style={{ color: 'var(--gn-grey-dark)' }}>
            <Briefcase className="w-3 h-3 shrink-0" /> {c.firm}
          </p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--gn-grey)' }}>
            {c.role}
          </p>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-3 text-xs" style={{ color: 'var(--gn-grey-dark)' }}>
        <Star className="w-3.5 h-3.5" style={{ color: CHROME }} fill="#FFA601" />
        <span className="font-semibold" style={{ color: RHINO }}>{c.rating}</span>
        <span style={{ color: 'var(--gn-grey)' }}>({c.reviews} sessions)</span>
      </div>

      <div className="my-3 h-px" style={{ background: 'rgba(140,157,255,0.2)' }} />

      {/* Price */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[11px]" style={{ color: 'var(--gn-grey)' }}>Single session</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold" style={{ color: RHINO }}>₹{c.price.toLocaleString()}</span>
            <span className="text-xs" style={{ color: 'var(--gn-grey)' }}>/ 60 min</span>
          </div>
        </div>
        <div className="text-[10px] flex items-center gap-1" style={{ color: 'var(--gn-grey)' }}>
          <Clock className="w-3 h-3" /> Today
        </div>
      </div>

      {/* Single CTA */}
      <button
        className="w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all"
        style={{ background: CHROME, color: RHINO }}
      >
        Book a session <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/* ================== Carousel with arrow nav ================== */
const CoachCarousel = () => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, []);

  const scrollBy = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Arrow buttons (desktop only) */}
      <button
        onClick={() => scrollBy(-1)}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full items-center justify-center transition-all"
        style={{
          background: 'white',
          boxShadow: '0 4px 16px rgba(46,53,88,0.15)',
          opacity: canScrollLeft ? 1 : 0.3,
          cursor: canScrollLeft ? 'pointer' : 'not-allowed',
        }}
      >
        <ChevronLeft className="w-5 h-5" style={{ color: RHINO }} />
      </button>
      <button
        onClick={() => scrollBy(1)}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full items-center justify-center transition-all"
        style={{
          background: 'white',
          boxShadow: '0 4px 16px rgba(46,53,88,0.15)',
          opacity: canScrollRight ? 1 : 0.3,
          cursor: canScrollRight ? 'pointer' : 'not-allowed',
        }}
      >
        <ChevronRight className="w-5 h-5" style={{ color: RHINO }} />
      </button>

      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingLeft: 4,
          paddingRight: 24,
        }}
      >
        <style>{`
          .coach-strip::-webkit-scrollbar { display: none; }
        `}</style>
        {coaches.map((c) => (
          <CoachCard key={c.name} c={c} />
        ))}
        {/* Trailing peek + CTA card */}
        <div
          className="shrink-0 snap-start rounded-2xl flex flex-col items-center justify-center text-center p-6"
          style={{
            width: 240,
            background: `linear-gradient(135deg, ${RHINO} 0%, ${RHINO_LIGHT} 100%)`,
            color: 'white',
          }}
        >
          <Users className="w-7 h-7 mb-2" style={{ color: CHROME }} />
          <div className="text-sm font-bold leading-tight mb-1">50+ MBB coaches</div>
          <p className="text-[11px] opacity-85 mb-3">Pick by firm, language, price, or availability.</p>
          <button
            className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1"
            style={{ background: CHROME, color: RHINO }}
          >
            See all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right edge fade hint */}
      <div
        className="hidden md:block absolute top-0 right-0 bottom-4 w-12 pointer-events-none"
        style={{
          background: 'linear-gradient(to left, rgba(248,250,255,1), rgba(248,250,255,0))',
          opacity: canScrollRight ? 1 : 0,
          transition: 'opacity 200ms',
        }}
      />
    </div>
  );
};

/* ================== Section wrapper ================== */
const CoachesSection = () => (
  <section className="py-14 px-6 rounded-3xl" style={{ background: 'rgba(140,157,255,0.06)' }}>
    <div className="max-w-6xl mx-auto">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: PERIWINKLE }}>
            Our Coaches
          </span>
          <h2 className="text-2xl md:text-3xl font-bold mt-2" style={{ color: RHINO }}>
            Book a session with an MBB coach
          </h2>
          <p className="text-sm mt-1 max-w-xl" style={{ color: 'var(--gn-grey-dark)' }}>
            Pay-as-you-go single sessions. No commitment. Pick a coach, pick a slot — done.
          </p>
        </div>
        <button
          className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all hover:scale-105 self-start sm:self-end shrink-0"
          style={{ color: RHINO, border: `1.5px solid ${RHINO}` }}
        >
          View more coaches <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Carousel */}
      <CoachCarousel />

      {/* Mobile-only "View more coaches" CTA */}
      <div className="md:hidden text-center mt-2">
        <button
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-full"
          style={{ color: RHINO, border: `1.5px solid ${RHINO}` }}
        >
          View more coaches <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  </section>
);

/* ================== Page wrapper with context ================== */
export default function CoachCarouselMockup() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        <p
          className="inline-block text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md mb-2"
          style={{ background: PERIWINKLE_LIGHT, color: RHINO }}
        >
          Coaching Page · Carousel Mockup
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: RHINO }}>
          Coach carousel above the pricing plans
        </h1>
        <p className="text-slate-600 max-w-2xl">
          Right-scrollable coach strip above your existing coaching plans section.
          Single CTA per card: <strong>Book a session</strong>. Below the strip:{' '}
          <strong>View more coaches</strong> → leads to a full <code>/coaches</code> page.
        </p>

        {/* Live carousel */}
        <div className="mt-10">
          <CoachesSection />
        </div>

        {/* Then the existing plans header — represented as a thin preview */}
        <div className="mt-10 px-6 py-10 rounded-3xl bg-white border border-slate-200">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: PERIWINKLE }}>
              Pricing
            </span>
            <h2 className="text-2xl md:text-3xl font-bold mt-2" style={{ color: RHINO }}>
              Choose Your Coaching Plan
            </h2>
            <p className="text-sm mt-2" style={{ color: 'var(--gn-grey-dark)' }}>
              All plans include full access to subscription resources
            </p>
            <p className="mt-6 text-xs font-semibold" style={{ color: PERIWINKLE }}>
              ↓ Existing 4 plan cards stay exactly as they are below this header ↓
            </p>
          </div>
        </div>

        {/* Why this layout */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-white border border-slate-200">
            <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: RHINO }}>
              <Sparkles className="w-4 h-4" style={{ color: CHROME }} /> Why a horizontal scroll
            </h3>
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              Shows lots of coaches without dominating vertical space. Same pattern users know
              from Netflix, Airbnb, Topmate. Keeps the page focused on plans below.
            </p>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200">
            <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: RHINO }}>
              <Sparkles className="w-4 h-4" style={{ color: CHROME }} /> Why one CTA only
            </h3>
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              "Book a session" is the action that makes you money. No "View profile" button
              competing for the click — fewer choices, higher conversion.
            </p>
          </div>
          <div className="rounded-2xl p-5 bg-white border border-slate-200">
            <h3 className="font-bold mb-2 flex items-center gap-2" style={{ color: RHINO }}>
              <Sparkles className="w-4 h-4" style={{ color: CHROME }} /> Why the trailing card
            </h3>
            <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
              Last card in the strip is a deep-blue "50+ MBB coaches" CTA. Catches users who
              scroll all the way through and turns scroll-fatigue into a /coaches visit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
