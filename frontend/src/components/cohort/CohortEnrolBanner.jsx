import React from 'react';
import { ArrowRight, Calendar, Users } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * CohortEnrolBanner — full-width gradient CTA strip placed between the
 * "Who is this for?" / "Past mentors" sections and the curriculum table.
 *
 * Mid-page CTA: by the time a visitor reaches this point they've seen
 * who the cohort is for and who teaches it, but haven't yet seen the
 * weekly schedule or pricing. A strong gentle nudge here funnels warm
 * readers straight into the pricing block.
 *
 * `onApply` is wired to the same `scrollToPlans` handler used by the
 * hero so the behaviour stays identical.
 */
export default function CohortEnrolBanner({ cohort, onApply }) {
  const startLabel = (cohort?.start_date_label || '').replace(/^Starts\s+/i, '') || '23 May 2026';
  const isActive = !!cohort?.is_active;

  return (
    <section
      className="px-4 sm:px-6 lg:px-8 py-10 sm:py-14"
      data-testid="cohort-enrol-banner"
    >
      <div
        className="relative mx-auto max-w-6xl rounded-3xl overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)',
          boxShadow: '0 12px 40px rgba(46, 53, 88, 0.25)',
        }}
      >
        {/* Decorative orbs */}
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--gn-periwinkle)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full opacity-15 blur-3xl"
          style={{ background: 'var(--gn-chrome-yellow)' }}
        />

        <div className="relative z-10 px-6 sm:px-10 lg:px-14 py-10 sm:py-12 flex flex-col lg:flex-row items-center lg:items-stretch gap-8 lg:gap-12 text-center lg:text-left">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(255, 166, 1, 0.22)',
                  color: 'var(--gn-chrome-light)',
                }}
              >
                <Calendar className="w-3.5 h-3.5" />
                Cohort starts {startLabel}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(140, 157, 255, 0.22)',
                  color: 'var(--gn-periwinkle-light)',
                }}
              >
                <Users className="w-3.5 h-3.5" />
                Limited cohort seats
              </span>
            </div>
            <h2
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: 'var(--font-display, inherit)' }}
            >
              Ready to build your consulting fundamentals?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/75 max-w-2xl">
              Hop on a quick discovery call. We&apos;ll walk through the curriculum, your goals,
              and answer any questions before you enrol.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <Button
              onClick={onApply}
              size="lg"
              className="px-7 sm:px-9 py-5 sm:py-6 text-base sm:text-lg rounded-md font-semibold transition-all whitespace-nowrap bg-white text-rhino hover:bg-periwinkle-lighter shadow-lg hover:shadow-xl"
              data-testid="cohort-enrol-banner-cta"
            >
              Book a discovery call
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
