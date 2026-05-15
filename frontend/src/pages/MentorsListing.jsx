import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Award, Calendar, Sparkles, ArrowRight, X as XIcon, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { fetchMentorsCached } from '../utils/mentorsCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Public mentor directory.
 *
 * - Loads ALL non-hidden mentors via /api/mentors and the company-logo map.
 * - Lets users filter by firm + top-coach + search by name.
 * - Each card uses the same gradnext design tokens as BookSingleSessionSection
 *   so the directory feels consistent with the home-page slider.
 * - "Book Single Session" → `/book/:mentorId`.
 */
const MentorsListing = () => {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState([]);
  const [logoMap, setLogoMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [firmFilter, setFirmFilter] = useState('all'); // 'all' | firm name
  const [topCoachOnly, setTopCoachOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'sessions' | 'price_low' | 'price_high'

  // Scroll to top on mount
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, logosRes] = await Promise.all([
          // Use the SAME endpoint that powers the home-page carousel — i.e.
          // mentors with `is_landing_featured = true` — so admins control
          // visibility for both surfaces with a single toggle. Slim payload
          // (no availability/bio/email/etc) + 60s in-memory cache for snappy
          // navigation between the home page and this directory.
          fetchMentorsCached(
            `${BACKEND_URL}/api/mentors/featured?slim=true`,
            { key: 'featured-slim' },
          ).catch(() => []),
          axios.get(`${BACKEND_URL}/api/mentors/logos`).catch(() => ({ data: { logo_map: {} } })),
        ]);
        if (cancelled) return;
        const filtered = (Array.isArray(list) ? list : [])
          .filter((m) => !m.is_hidden && !m.is_deleted);
        setMentors(filtered);
        setLogoMap(logosRes.data?.logo_map || {});
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[MentorsListing] failed to load:', err?.response?.status);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Distinct firm chips, sorted by frequency
  const firms = useMemo(() => {
    const counts = {};
    mentors.forEach((m) => {
      const f = (m.consulting_firm || '').trim();
      if (f) counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [mentors]);

  const getCompanyLogo = (companyName) => {
    if (!companyName) return null;
    return logoMap[companyName.toLowerCase()] || null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = mentors.filter((m) => {
      if (firmFilter !== 'all' && (m.consulting_firm || '').trim() !== firmFilter) return false;
      if (topCoachOnly && !m.is_top_coach) return false;
      if (q) {
        const hay = [
          m.name,
          m.consulting_firm,
          m.consulting_position,
          m.headline,
          m.specialization,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      if (sortBy === 'sessions') {
        return (Number(b.sessions_conducted) || 0) - (Number(a.sessions_conducted) || 0);
      }
      if (sortBy === 'price_low') {
        return (Number(a.price_per_session) || Infinity) - (Number(b.price_per_session) || Infinity);
      }
      if (sortBy === 'price_high') {
        return (Number(b.price_per_session) || 0) - (Number(a.price_per_session) || 0);
      }
      // default: rating
      const ra = Number(a.rating) || 0;
      const rb = Number(b.rating) || 0;
      if (rb !== ra) return rb - ra;
      return (Number(b.sessions_conducted) || 0) - (Number(a.sessions_conducted) || 0);
    });
    return list;
  }, [mentors, search, firmFilter, topCoachOnly, sortBy]);

  const handleBook = (mentor) => {
    navigate(`/book/${encodeURIComponent(mentor.id)}`);
  };

  const clearFilters = () => {
    setSearch('');
    setFirmFilter('all');
    setTopCoachOnly(false);
    setSortBy('rating');
  };

  const hasActiveFilters = search.trim() !== '' || firmFilter !== 'all' || topCoachOnly || sortBy !== 'rating';

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--gn-grey-lightest, #f8f9fb)' }}>
      {/* Hero / heading */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(140, 157, 255, 0.10), transparent 60%), radial-gradient(ellipse at bottom right, rgba(255, 199, 95, 0.06), transparent 55%), white',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-10 text-center">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: 'rgba(140, 157, 255, 0.12)',
              color: 'var(--gn-periwinkle)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            Meet our mentors
          </span>
          <h1
            className="text-3xl md:text-5xl font-bold mt-4 mb-3 tracking-tight"
            style={{ color: 'var(--gn-rhino)' }}
          >
            All mentors, one place.
          </h1>
          <p
            className="text-base md:text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--gn-grey-dark)' }}
          >
            Browse every coach available on the platform. Filter by firm, search by name, and book a single session in just a couple of clicks — no plan required.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filters bar */}
        <div
          className="bg-white rounded-2xl p-4 sm:p-5 mb-8 shadow-sm"
          style={{ border: '1px solid var(--gn-grey-light, #e5e7eb)' }}
        >
          <div className="flex flex-col gap-4">
            {/* Top row: search + sort */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--gn-grey)' }}
                />
                <input
                  type="text"
                  placeholder="Search by name, firm, role…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{
                    border: '1px solid var(--gn-grey-light, #e5e7eb)',
                    backgroundColor: 'white',
                  }}
                  data-testid="mentors-listing-search"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid var(--gn-grey-light, #e5e7eb)',
                  backgroundColor: 'white',
                  color: 'var(--gn-rhino)',
                }}
                data-testid="mentors-listing-sort"
              >
                <option value="rating">Sort: Top rated</option>
                <option value="sessions">Sort: Most sessions</option>
                <option value="price_low">Sort: Price (low → high)</option>
                <option value="price_high">Sort: Price (high → low)</option>
              </select>
            </div>

            {/* Filter chips row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider mr-1"
                style={{ color: 'var(--gn-grey)' }}
              >
                <Filter className="w-3 h-3" />
                Firm:
              </span>
              <FilterChip
                active={firmFilter === 'all'}
                onClick={() => setFirmFilter('all')}
                label={`All (${mentors.length})`}
                testid="mentors-listing-firm-all"
              />
              {firms.map((f) => (
                <FilterChip
                  key={f.name}
                  active={firmFilter === f.name}
                  onClick={() => setFirmFilter(f.name)}
                  label={`${f.name} (${f.count})`}
                  testid={`mentors-listing-firm-${f.name.replace(/\s+/g, '-').toLowerCase()}`}
                />
              ))}
              <FilterChip
                active={topCoachOnly}
                onClick={() => setTopCoachOnly((v) => !v)}
                label={
                  <span className="inline-flex items-center gap-1">
                    <Award className="w-3 h-3" /> Top coach
                  </span>
                }
                testid="mentors-listing-top-coach"
              />
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto text-xs font-semibold inline-flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
                  style={{ color: 'var(--gn-grey-dark)' }}
                  data-testid="mentors-listing-clear-filters"
                >
                  <XIcon className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
            Showing <span className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{filtered.length}</span>
            {filtered.length === 1 ? ' mentor' : ' mentors'}
            {hasActiveFilters ? ' (filtered)' : ''}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[420px] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="bg-white rounded-2xl p-10 text-center"
            style={{ border: '1px solid var(--gn-grey-light, #e5e7eb)' }}
          >
            <p className="text-base font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>
              No mentors match your filters
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--gn-grey-dark)' }}>
              Try clearing filters or changing your search.
            </p>
            <Button onClick={clearFilters} variant="outline">Clear filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch" data-testid="mentors-listing-grid">
            {filtered.map((mentor) => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                getCompanyLogo={getCompanyLogo}
                onBook={handleBook}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FilterChip = ({ active, onClick, label, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
    style={{
      backgroundColor: active ? 'var(--gn-rhino)' : 'white',
      color: active ? 'white' : 'var(--gn-rhino)',
      border: `1px solid ${active ? 'var(--gn-rhino)' : 'var(--gn-grey-light, #e5e7eb)'}`,
    }}
  >
    {label}
  </button>
);

const MentorCard = ({ mentor, getCompanyLogo, onBook }) => {
  const consultingFirm = mentor.consulting_firm || mentor.company || '';
  const ratingNum = Number(mentor.rating) || 0;
  const hasRating = ratingNum > 0;
  const sessions = Number(mentor.sessions_conducted) || 0;
  const price = Number(mentor.price_per_session) || 0;

  const companyLogos = [
    consultingFirm,
    mentor.previous_company_1,
    mentor.previous_company_2,
    mentor.college,
  ]
    .filter(Boolean)
    .map((name) => ({ name, logo: getCompanyLogo(name) }))
    .filter((c) => c.logo);

  return (
    <div
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all flex flex-col h-full"
      style={{ border: '1px solid var(--gn-grey-light, #e5e7eb)' }}
      data-testid={`mentor-card-${mentor.id}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <img
            src={
              mentor.picture_thumbnail ||
              mentor.picture ||
              mentor.profile_picture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || 'M')}&background=8C9DFF&color=fff&size=128`
            }
            alt={mentor.name}
            className="w-16 h-16 rounded-xl object-cover"
            style={{ border: '2px solid var(--gn-periwinkle-lighter, #e0e4ff)' }}
            loading="lazy"
          />
          {mentor.is_top_coach && (
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--gn-chrome-yellow, #FFC75F)' }}
            >
              <Award className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* Line 1: Name */}
          <p
            className="font-bold text-base mb-0.5"
            style={{ color: 'var(--gn-rhino)' }}
          >
            {mentor.name}
          </p>
          {/* Line 2: Position, Firm | College */}
          <h3
            className="font-semibold text-sm leading-tight mb-1"
            style={{ color: 'var(--gn-grey-dark)' }}
          >
            {mentor.consulting_position || mentor.title || 'Consultant'}, {consultingFirm || 'Consulting'}
            {mentor.college && <span> | {mentor.college}</span>}
          </h3>
          {/* Line 3: Headline */}
          {mentor.headline && (
            <p
              className="text-xs line-clamp-2"
              style={{ color: 'var(--gn-grey)' }}
            >
              {mentor.headline}
            </p>
          )}
        </div>
      </div>

      {/* Experience strip */}
      {companyLogos.length > 0 && (
        <div
          className="flex items-center gap-2 mb-4 py-2 px-3 rounded-lg"
          style={{ backgroundColor: 'var(--gn-grey-lightest, #f8f9fb)' }}
        >
          <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--gn-grey)' }}>
            Experience:
          </span>
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            {companyLogos.slice(0, 5).map((c, idx) => (
              <div
                key={idx}
                className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1.5"
                style={{ border: '1px solid var(--gn-grey-light, #e5e7eb)' }}
                title={c.name}
              >
                <img
                  src={c.logo}
                  alt={c.name}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating + Sessions */}
      <div
        className="flex items-center gap-4 text-sm mb-3"
        style={{ color: 'var(--gn-grey-dark)' }}
      >
        <span className="flex items-center gap-1">
          <Star
            className="w-4 h-4 fill-amber-400"
            style={{ color: 'var(--gn-chrome-yellow, #FFC75F)' }}
          />
          <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>
            {hasRating ? ratingNum.toFixed(1) : 'NA'}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Award className="w-4 h-4" style={{ color: 'var(--gn-periwinkle, #8C9DFF)' }} />
          {sessions} sessions
        </span>
      </div>

      {/* Price chip */}
      <div
        className="flex items-center justify-between text-sm mb-3 p-2 rounded-lg"
        style={{ backgroundColor: 'var(--gn-periwinkle-lighter, #e0e4ff)' }}
      >
        <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>
          Single session
        </span>
        <span className="font-bold" style={{ color: 'var(--gn-rhino)' }}>
          {price > 0 ? `₹${Number(price).toLocaleString('en-IN')}` : '—'}
        </span>
      </div>

      <Button
        onClick={() => onBook(mentor)}
        className="w-full text-white rounded-xl font-medium mt-auto"
        style={{ backgroundColor: 'var(--gn-rhino)' }}
        data-testid={`mentors-listing-book-${mentor.id}`}
      >
        <Calendar className="w-4 h-4 mr-2" />
        Book Session
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
};

export default MentorsListing;
