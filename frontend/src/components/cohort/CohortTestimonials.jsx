import React from 'react';
import { TestimonialsCarousel } from '../TestimonialsCarousel';

/**
 * CohortTestimonials - Wraps the shared moving testimonial carousel using
 * the home-page testimonial set so the cohort landing benefits from
 * existing approved success stories.
 */
export default function CohortTestimonials() {
  return (
    <TestimonialsCarousel
      page="home"
      title="Success stories from our cohort"
      subtitle="Hear from candidates who landed offers at MBB and Tier-1 firms"
    />
  );
}
