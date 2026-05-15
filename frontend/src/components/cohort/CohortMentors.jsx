import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Award } from 'lucide-react';
import { fetchMentorsCached } from '../../utils/mentorsCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * CohortMentors — "Past mentors" carousel for the Cohort landing page.
 *
 * Lineup precedence (first non-empty wins):
 *   1. Cohort.landing_mentor_ids — admin-curated, per-cohort, ordered.
 *      Resolved via `/api/cohorts/{cohort_id}/landing-mentors`.
 *   2. Global featured mentors (`is_landing_featured = true`).
 *   3. Top-rated public mentors (always-on fallback).
 *
 * Renders a lean card (photo + name + position/firm + experience logos)
 * with no booking CTA — the cohort page sells the cohort, not 1:1 sessions.
 */
export default function CohortMentors({ cohort }) {
  const [mentors, setMentors] = useState([]);
  const [logoMap, setLogoMap] = useState({});
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Try the per-cohort lineup first when the cohort has one.
        const cohortId = cohort?.id;
        const hasLineup = Array.isArray(cohort?.landing_mentor_ids) && cohort.landing_mentor_ids.length > 0;
        let list = [];

        if (cohortId && hasLineup) {
          try {
            const r = await axios.get(`${BACKEND_URL}/api/cohorts/${cohortId}/landing-mentors`);
            list = Array.isArray(r.data?.mentors) ? r.data.mentors : [];
          } catch {
            list = [];
          }
        }

        // 2. Fallback to globally featured mentors.
        if (list.length === 0) {
          const featured = await fetchMentorsCached(
            `${BACKEND_URL}/api/mentors/featured?slim=true`,
            { key: 'featured-slim' },
          ).catch(() => []);
          list = Array.isArray(featured) ? featured : [];
        }

        // 3. Final fallback: top-rated public mentors.
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

        const logosRes = await axios
          .get(`${BACKEND_URL}/api/mentors/logos`)
          .catch(() => ({ data: { logo_map: {} } }));
        if (cancelled) return;

        setMentors(list);
        setLogoMap(logosRes.data?.logo_map || {});
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[CohortMentors] failed to load mentors:', err?.response?.status);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cohort?.id, cohort?.landing_mentor_ids]);

  const scroll = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const getCompanyLogo = (companyName) => {
    if (!companyName) return null;
    return logoMap[companyName.toLowerCase()] || null;
  };

  return (
    <section className="section-padding overflow-hidden" data-testid="cohort-mentors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="section-header">
          <h2>Past mentors</h2>
          <p>MBB consultants from McKinsey, BCG and Bain who&apos;ve guided previous cohorts.</p>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden px-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="min-w-[280px] h-[360px] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : mentors.length === 0 ? (
          <p className="text-center text-slate-500">Mentor lineup will be announced soon.</p>
        ) : (
          <div className="relative">
            {/* Edge fades */}
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

            {/* Arrow buttons */}
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Previous mentors"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg items-center justify-center transition"
              style={{ border: '1px solid var(--gn-grey-light)' }}
              data-testid="cohort-mentors-scroll-left"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Next mentors"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex w-10 h-10 rounded-full bg-white shadow-md hover:shadow-lg items-center justify-center transition"
              style={{ border: '1px solid var(--gn-grey-light)' }}
              data-testid="cohort-mentors-scroll-right"
            >
              <ChevronRight className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
            </button>

            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 px-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {mentors.map((mentor) => {
                const consultingFirm = mentor.firm || mentor.consulting_firm || mentor.company;
                const companyLogos = [];
                const firmLogo = getCompanyLogo(consultingFirm);
                if (firmLogo && consultingFirm) companyLogos.push({ name: consultingFirm, logo: firmLogo });
                const prev1 = getCompanyLogo(mentor.previous_company_1);
                if (prev1 && mentor.previous_company_1) {
                  companyLogos.push({ name: mentor.previous_company_1, logo: prev1 });
                }
                const prev2 = getCompanyLogo(mentor.previous_company_2);
                if (prev2 && mentor.previous_company_2) {
                  companyLogos.push({ name: mentor.previous_company_2, logo: prev2 });
                }
                const collegeLogo = getCompanyLogo(mentor.college);
                if (collegeLogo && mentor.college) {
                  companyLogos.push({ name: mentor.college, logo: collegeLogo });
                }

                return (
                  <div
                    key={mentor.id}
                    className="snap-start min-w-[280px] max-w-[280px] bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all"
                    style={{ border: '1px solid var(--gn-grey-light)' }}
                    data-testid={`cohort-mentor-card-${mentor.id}`}
                  >
                    {/* Photo */}
                    <div className="relative mx-auto mb-4 w-32 h-32">
                      <img
                        src={
                          mentor.picture_thumbnail ||
                          mentor.picture ||
                          mentor.profile_picture ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || 'M')}&background=8C9DFF&color=fff&size=256`
                        }
                        alt={mentor.name}
                        className="w-32 h-32 rounded-2xl object-cover"
                        style={{ border: '3px solid var(--gn-periwinkle-lighter)' }}
                        loading="lazy"
                      />
                      {mentor.is_top_coach && (
                        <div
                          className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow"
                          style={{ backgroundColor: 'var(--gn-chrome-yellow)' }}
                          title="Top Coach"
                        >
                          <Award className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <p
                      className="text-center font-bold text-base mb-1 truncate"
                      style={{ color: 'var(--gn-rhino)' }}
                      title={mentor.name}
                    >
                      {mentor.name}
                    </p>

                    {/* Position, firm */}
                    <p
                      className="text-center text-xs leading-tight mb-3 line-clamp-2"
                      style={{ color: 'var(--gn-grey-dark)', minHeight: '2.2rem' }}
                      title={`${mentor.consulting_position || mentor.title || 'Consultant'}, ${consultingFirm || 'Consulting'}`}
                    >
                      {mentor.consulting_position || mentor.title || 'Consultant'}
                      {consultingFirm ? `, ${consultingFirm}` : ''}
                    </p>

                    {/* Company logos row */}
                    <div
                      className="flex items-center justify-center gap-2 py-2 px-2 rounded-lg"
                      style={{ backgroundColor: 'var(--gn-grey-lightest, #f8f9fb)', minHeight: '52px' }}
                    >
                      {companyLogos.length > 0 ? (
                        companyLogos.slice(0, 4).map((c, idx) => (
                          <div
                            key={idx}
                            className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1"
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
                        <span className="text-xs italic" style={{ color: 'var(--gn-grey)' }}>
                          {consultingFirm || ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
