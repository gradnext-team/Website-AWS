import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronLeft, ChevronRight, Sparkles, ArrowRight, Award, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { fetchMentorsCached } from '../utils/mentorsCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * BookSingleSessionSection
 *
 * Shows admin-curated featured mentors as a horizontal carousel using the
 * same card design as the in-dashboard CoachingPage so the public site and
 * the dashboard feel consistent.
 *
 * Used in two places:
 *   - Landing page (`variant="landing"`) — before pricing
 *   - Public coaching page (`variant="coaching"`) — after "How it works"
 *     with copy "Still not sure? Book a single session."
 *
 * Cards deep-link to `/dashboard/coaching?bookSingle=<id>` which auto-opens
 * the single-session purchase modal (existing Razorpay flow).
 */
const BookSingleSessionSection = ({ variant = 'landing', onAuthRequired }) => {
  const [mentors, setMentors] = useState([]);
  const [logoMap, setLogoMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const scrollerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. featured-only mentors (admin curated) — slim payload + 60s cache
        // 2. logo-map for company badges
        const [featured, logosRes] = await Promise.all([
          fetchMentorsCached(
            `${BACKEND_URL}/api/mentors/featured?slim=true`,
            { key: 'featured-slim' },
          ).catch(() => []),
          fetch(`${BACKEND_URL}/api/mentors/logos`).then(r => r.ok ? r.json() : { logo_map: {} }).catch(() => ({ logo_map: {} })),
        ]);
        if (cancelled) return;

        let list = Array.isArray(featured) ? featured : [];

        // Fallback: if no admin has marked any mentor as featured yet, gracefully
        // show the top-rated mentors from the public list so the section is never
        // empty for a brand-new install.
        if (list.length === 0) {
          const fallback = await fetchMentorsCached(
            `${BACKEND_URL}/api/mentors?slim=true`,
            { key: 'all-slim' },
          ).catch(() => []);
          list = (Array.isArray(fallback) ? fallback : [])
            .filter((m) => !m.is_hidden && !m.is_deleted)
            .sort((a, b) => {
              const ra = Number(a.rating) || 0;
              const rb = Number(b.rating) || 0;
              if (rb !== ra) return rb - ra;
              return (Number(b.sessions_conducted) || 0) - (Number(a.sessions_conducted) || 0);
            })
            .slice(0, 8);
        }

        setMentors(list);
        setLogoMap(logosRes?.logo_map || {});
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[BookSingleSessionSection] failed to load mentors:', err?.response?.status);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Track which card is centered for the dot indicator
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const cardW = 360; // 344 width + 16 gap
      setActiveIdx(Math.round(el.scrollLeft / cardW));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [mentors.length]);

  const scroll = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 360, behavior: 'smooth' });
  };

  const handleBook = (mentor) => {
    const target = `/book/${encodeURIComponent(mentor.id)}`;
    if (typeof onAuthRequired === 'function') {
      onAuthRequired({ mentor, target });
      return;
    }
    navigate(target);
  };

  const getCompanyLogo = (companyName) => {
    if (!companyName) return null;
    return logoMap[companyName.toLowerCase()] || null;
  };

  // Theme tokens
  const isCoaching = variant === 'coaching';
  const eyebrow = isCoaching ? 'Single Session · No Plan Needed' : 'Top Rated 1:1 Coaching';
  const title = isCoaching
    ? 'Still not sure? Book a single session.'
    : 'Book a 1:1 with a top-rated mentor';
  const subtitle = isCoaching
    ? 'Try a session with one of our highest-rated MBB consultants — no plan commitment.'
    : 'Get personalized guidance from MBB consultants. Pick a mentor, choose a slot, pay only for what you need.';

  return (
    <section
      className="relative section-padding overflow-hidden"
      data-testid={`single-session-section-${variant}`}
    >
      {/* Subtle decorative backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(140, 157, 255, 0.07), transparent 60%), radial-gradient(ellipse at bottom right, rgba(255, 199, 95, 0.06), transparent 55%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: 'rgba(140, 157, 255, 0.12)',
              color: 'var(--gn-periwinkle)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            {eyebrow}
          </span>
          <h2
            className="text-3xl md:text-5xl font-bold mt-4 mb-3 tracking-tight"
            style={{ color: 'var(--gn-rhino)' }}
          >
            {title}
          </h2>
          <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: 'var(--gn-grey-dark)' }}>
            {subtitle}
          </p>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden px-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="min-w-[344px] h-[420px] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <div className="text-center">
            <p className="text-slate-500 mb-6">No featured mentors available right now.</p>
            <Button
              onClick={() => navigate('/mentors')}
              className="rounded-full px-6 py-5 text-sm font-semibold text-white hover:shadow-lg transition-all"
              style={{
                backgroundColor: 'var(--gn-rhino)',
              }}
              data-testid="single-session-view-all-mentors"
            >
              View all mentors
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* Edge gradient fades */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 bottom-4 w-12 z-[1] hidden md:block"
              style={{ background: 'linear-gradient(to right, white, transparent)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-4 w-12 z-[1] hidden md:block"
              style={{ background: 'linear-gradient(to left, white, transparent)' }}
            />

            {/* Left scroll button */}
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Scroll mentors left"
              data-testid="single-session-scroll-left"
              className="hidden md:flex absolute left-2 top-[200px] z-10 w-11 h-11 rounded-full bg-white shadow-md items-center justify-center hover:shadow-xl hover:scale-105 transition-all"
              style={{ color: 'var(--gn-rhino)' }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Scrollable rail */}
            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {mentors.map((mentor) => {
                const consultingFirm = mentor.consulting_firm || '';
                const currentCompany = mentor.current_company || '';
                const consultingLogo = mentor.consulting_firm_logo || getCompanyLogo(consultingFirm);
                const currentCompanyLogo = mentor.current_company_logo || getCompanyLogo(currentCompany);
                const prevCompany1Logo = getCompanyLogo(mentor.previous_company_1);
                const prevCompany2Logo = getCompanyLogo(mentor.previous_company_2);

                const companyLogos = [];
                if (consultingLogo && consultingFirm) {
                  companyLogos.push({ name: consultingFirm, logo: consultingLogo });
                }
                if (currentCompanyLogo && currentCompany &&
                    currentCompany.toLowerCase() !== consultingFirm.toLowerCase()) {
                  companyLogos.push({ name: currentCompany, logo: currentCompanyLogo });
                }
                if (prevCompany1Logo && mentor.previous_company_1) {
                  companyLogos.push({ name: mentor.previous_company_1, logo: prevCompany1Logo });
                }
                if (prevCompany2Logo && mentor.previous_company_2) {
                  companyLogos.push({ name: mentor.previous_company_2, logo: prevCompany2Logo });
                }
                const collegeLogo = getCompanyLogo(mentor.college);
                if (collegeLogo && mentor.college) {
                  companyLogos.push({ name: mentor.college, logo: collegeLogo });
                }

                const ratingNum = Number(mentor.rating);
                const hasRating = !Number.isNaN(ratingNum) && ratingNum > 0;
                const sessions = Number(mentor.sessions_conducted) || 0;
                const price = mentor.price_per_session;

                return (
                  <div
                    key={mentor.id}
                    className="snap-start min-w-[344px] max-w-[344px] bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all flex flex-col"
                    style={{ border: '1px solid var(--gn-grey-light)' }}
                    data-testid={`single-session-mentor-${mentor.id}`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative flex-shrink-0">
                        <img
                          src={
                            mentor.picture_thumbnail ||
                            mentor.picture ||
                            mentor.profile_picture ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || 'M')}&background=8C9DFF&color=fff&size=128`
                          }
                          alt="Coach"
                          className="w-16 h-16 rounded-xl object-cover"
                          style={{ border: '2px solid var(--gn-periwinkle-lighter)' }}
                          loading="lazy"
                        />
                        {mentor.is_top_coach && (
                          <div
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}
                          >
                            <Award className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Line 1: Mentor Name (1 line) */}
                        <p className="font-bold text-base mb-1 truncate" style={{ color: 'var(--gn-rhino)' }}>
                          {mentor.name}
                        </p>
                        {/* Line 2: Position, Company | College — fixed 2 lines so cards align */}
                        <h3
                          className="font-semibold text-sm leading-tight mb-1.5 line-clamp-2"
                          style={{ color: 'var(--gn-grey-dark)', minHeight: '2.4rem' }}
                          title={`${mentor.consulting_position || mentor.title || 'Consultant'}, ${consultingFirm || 'Consulting'}${mentor.college ? ' | ' + mentor.college : ''}`}
                        >
                          {mentor.consulting_position || mentor.title || 'Consultant'}, {consultingFirm || 'Consulting'}
                          {mentor.college && <span> | {mentor.college}</span>}
                        </h3>
                        {/* Line 3: Headline — fixed 2 lines (always reserve the space) */}
                        <p
                          className="text-xs line-clamp-2"
                          style={{ color: 'var(--gn-grey)', minHeight: '2rem' }}
                          title={mentor.headline || ''}
                        >
                          {mentor.headline || '\u00A0'}
                        </p>
                      </div>
                    </div>

                    {/* Company Logos Row — always reserve space so the rating/price/CTA align across cards */}
                    <div
                      className="flex items-center gap-2 mb-4 py-2 px-3 rounded-lg"
                      style={{ backgroundColor: 'var(--gn-grey-lightest)', minHeight: '60px' }}
                    >
                      <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--gn-grey)' }}>
                        Experience:
                      </span>
                      <div className="flex items-center gap-2 flex-1 overflow-hidden">
                        {companyLogos.length > 0 ? (
                          companyLogos.slice(0, 5).map((c, idx) => (
                            <div
                              key={idx}
                              className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1.5"
                              style={{ border: '1px solid var(--gn-grey-light)' }}
                              title={c.name}
                            >
                              <img
                                src={c.logo}
                                alt={c.name}
                                className="max-w-full max-h-full object-contain"
                                loading="lazy"
                              />
                            </div>
                          ))
                        ) : (
                          <span className="text-xs italic" style={{ color: 'var(--gn-grey)' }}>—</span>
                        )}
                      </div>
                    </div>

                    {/* Rating + Sessions */}
                    <div className="flex items-center gap-4 text-sm mb-3" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span className="flex items-center gap-1">
                        <Star
                          className="w-4 h-4 fill-amber-400"
                          style={{ color: 'var(--gn-chrome-yellow)' }}
                        />
                        <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
                          {hasRating ? ratingNum.toFixed(1) : 'NA'}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4" style={{ color: 'var(--gn-periwinkle)' }} />
                        {sessions} sessions
                      </span>
                    </div>

                    {/* Price chip — always rendered to keep card heights aligned */}
                    <div
                      className="flex items-center justify-between text-sm mb-3 p-2 rounded-lg"
                      style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}
                    >
                      <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>
                        Single session
                      </span>
                      <span className="font-bold" style={{ color: 'var(--gn-rhino)' }}>
                        {price > 0 ? `₹${Number(price).toLocaleString('en-IN')}` : '—'}
                        {price > 0 && <span className="text-xs font-normal ml-1" style={{ color: 'var(--gn-grey)' }}>+ GST</span>}
                      </span>
                    </div>

                    <Button
                      onClick={() => handleBook(mentor)}
                      className="w-full text-white rounded-xl font-medium mt-auto"
                      style={{ backgroundColor: 'var(--gn-rhino)' }}
                      data-testid={`single-session-book-${mentor.id}`}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Session
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Right scroll button */}
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Scroll mentors right"
              data-testid="single-session-scroll-right"
              className="hidden md:flex absolute right-2 top-[200px] z-10 w-11 h-11 rounded-full bg-white shadow-md items-center justify-center hover:shadow-xl hover:scale-105 transition-all"
              style={{ color: 'var(--gn-rhino)' }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {mentors.length > 3 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {mentors.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: activeIdx === i ? '20px' : '6px',
                      backgroundColor:
                        activeIdx === i ? 'var(--gn-periwinkle)' : 'var(--gn-periwinkle-lighter)',
                    }}
                  />
                ))}
              </div>
            )}

            {/* View-all CTA — sends users to the full mentor directory */}
            <div className="flex justify-center mt-8">
              <Button
                onClick={() => navigate('/mentors')}
                className="rounded-full px-6 py-5 text-sm font-semibold text-white hover:shadow-lg transition-all"
                style={{
                  backgroundColor: 'var(--gn-rhino)',
                }}
                data-testid="single-session-view-all-mentors"
              >
                View all mentors
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BookSingleSessionSection;
