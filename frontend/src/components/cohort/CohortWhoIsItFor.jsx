import React from 'react';
import { GraduationCap, Briefcase, BookOpen } from 'lucide-react';

/**
 * CohortWhoIsItFor — three-audience grid.
 *
 * The cohort is positioned as a fundamentals course, so the audience is
 * scoped to people building consulting from the ground up:
 *   1. Undergraduate students
 *   2. Early-career professionals
 *   3. MBA aspirants and students
 *
 * Static content (intentionally not pulled from `cohort.audience`) so the
 * marketing copy is consistent across cohorts.
 */
const AUDIENCE = [
  {
    icon: GraduationCap,
    label: 'Undergraduate students',
    body: 'Get a head start on case fundamentals before campus placements and consulting club selections.',
  },
  {
    icon: Briefcase,
    label: 'Early-career professionals',
    body: 'Build the structured-thinking and case skills you need to break into consulting from your first job.',
  },
  {
    icon: BookOpen,
    label: 'MBA aspirants and students',
    body: 'Prepare for summer internship and full-time recruiting at MBB and Tier-1 consulting firms.',
  },
];

export default function CohortWhoIsItFor() {
  return (
    <section
      id="audience"
      className="section-padding"
      data-testid="cohort-audience"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="section-header">
          <h2>Who is this for?</h2>
          <p>
            Built for people serious about building consulting fundamentals from the ground up.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {AUDIENCE.map((a, i) => {
            const Icon = a.icon;
            return (
              <div
                key={i}
                className="group rounded-2xl p-6 transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(140, 157, 255, 0.25)',
                  boxShadow: '0 4px 20px rgba(46, 53, 88, 0.05)',
                }}
                data-testid={`cohort-audience-card-${i}`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--gn-periwinkle) 0%, var(--gn-rhino-light) 100%)',
                  }}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-base mb-2 break-words" style={{ color: 'var(--gn-rhino)' }}>
                  {a.label}
                </h3>
                <p
                  className="text-sm leading-relaxed break-words"
                  style={{ color: 'var(--gn-grey-dark)' }}
                >
                  {a.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
