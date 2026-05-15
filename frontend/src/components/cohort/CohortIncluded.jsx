import React from 'react';
import LogoStrip from '../LogoStrip';
import CohortMentors from './CohortMentors';

/**
 * CohortIncluded - Replaces the legacy stat tiles with the actual people
 * and brands behind the cohort: a "Past mentors" carousel and a
 * scrolling company logo strip (firms cohort grads have landed at).
 */
export default function CohortIncluded({ cohort }) {
  return (
    <section id="included" data-testid="cohort-included">
      {/* Mentor cards — photo + name + firm + experience logos, no booking CTA */}
      <CohortMentors cohort={cohort} />

      {/* Company logos marquee */}
      <LogoStrip />
    </section>
  );
}
