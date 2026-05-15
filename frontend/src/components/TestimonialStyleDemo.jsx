import React from 'react';
import { Quote } from 'lucide-react';

// Sample testimonial data
const sampleTestimonial = {
  name: "Arjun Patel",
  position: "Consultant",
  company: "McKinsey & Company",
  image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
  testimonial: "Working with gradnext was transformational. The coaches understood my goals and helped me develop the skills needed to succeed."
};

// Option 1: Minimal Card (Recommended)
export const MinimalCard = ({ testimonial }) => (
  <div 
    className="bg-white p-6 rounded-xl shadow-lg border-l-4 hover:shadow-xl transition-shadow duration-300"
    style={{ borderColor: 'var(--gn-chrome-yellow)' }}
  >
    <Quote className="w-6 h-6 mb-3" style={{ color: 'var(--gn-periwinkle)' }} />
    <p className="text-gray-700 text-base leading-relaxed mb-6">
      "{testimonial.testimonial}"
    </p>
    <div className="flex items-center gap-3">
      <img 
        src={testimonial.image_url} 
        alt={testimonial.name}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div>
        <p className="font-semibold text-gray-900">{testimonial.name}</p>
        <p className="text-sm font-medium" style={{ color: 'var(--gn-chrome-yellow)' }}>
          {testimonial.company}
        </p>
      </div>
    </div>
  </div>
);

// Option 2: Side by Side
export const SideBySideCard = ({ testimonial }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
    <div className="flex gap-4">
      <img 
        src={testimonial.image_url} 
        alt={testimonial.name}
        className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
        style={{ filter: 'grayscale(100%)' }}
      />
      <div className="flex-1">
        <Quote className="w-5 h-5 mb-2" style={{ color: 'var(--gn-chrome-yellow)' }} />
        <p className="text-gray-700 text-sm leading-relaxed mb-3">
          "{testimonial.testimonial}"
        </p>
        <div>
          <p className="font-bold text-gray-900">{testimonial.name}</p>
          <p 
            className="text-xs font-semibold px-2 py-1 rounded inline-block mt-1"
            style={{ 
              backgroundColor: 'var(--gn-periwinkle-lighter)',
              color: 'var(--gn-rhino)' 
            }}
          >
            {testimonial.company}
          </p>
        </div>
      </div>
    </div>
  </div>
);

// Option 3: Compact Stacked
export const CompactStackedCard = ({ testimonial }) => (
  <div 
    className="bg-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-center"
    style={{ width: '240px' }}
  >
    <img 
      src={testimonial.image_url} 
      alt={testimonial.name}
      className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
    />
    <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-4">
      "{testimonial.testimonial}"
    </p>
    <div className="pt-3 border-t border-gray-100">
      <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
      <p className="text-xs" style={{ color: 'var(--gn-periwinkle)' }}>
        {testimonial.company}
      </p>
    </div>
  </div>
);

// Option 4: Quote First Minimal
export const QuoteFirstCard = ({ testimonial }) => (
  <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
    <div className="mb-6">
      <p 
        className="text-xl leading-relaxed italic"
        style={{ color: 'var(--gn-rhino)' }}
      >
        "{testimonial.testimonial}"
      </p>
    </div>
    <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--gn-chrome-yellow)' }}>
      <img 
        src={testimonial.image_url} 
        alt={testimonial.name}
        className="w-10 h-10 rounded-full object-cover"
      />
      <div>
        <p className="font-semibold text-gray-900 text-sm">
          {testimonial.name}
        </p>
        <p className="text-xs text-gray-500">{testimonial.company}</p>
      </div>
    </div>
  </div>
);

// Option 5: LinkedIn Style
export const LinkedInStyleCard = ({ testimonial }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200">
    <div className="flex items-start gap-3 mb-4">
      <img 
        src={testimonial.image_url} 
        alt={testimonial.name}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div className="flex-1">
        <p className="font-bold text-gray-900">{testimonial.name}</p>
        <p className="text-sm text-gray-600">{testimonial.position}</p>
        <p className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>
          {testimonial.company}
        </p>
      </div>
    </div>
    <p className="text-gray-700 text-sm leading-relaxed">
      "{testimonial.testimonial}"
    </p>
    <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
      February 2024
    </div>
  </div>
);

// Option 6: Split Background
export const SplitBackgroundCard = ({ testimonial }) => (
  <div className="flex rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
    <div 
      className="w-1/3 p-6 flex flex-col items-center justify-center text-center"
      style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle) 0%, var(--gn-periwinkle-dark) 100%)' }}
    >
      <img 
        src={testimonial.image_url} 
        alt={testimonial.name}
        className="w-20 h-20 rounded-full object-cover mb-3"
        style={{ filter: 'grayscale(100%)' }}
      />
      <p className="font-bold text-white text-sm mb-1">{testimonial.name}</p>
      <p 
        className="text-xs px-2 py-1 rounded"
        style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
      >
        {testimonial.company}
      </p>
    </div>
    <div className="w-2/3 bg-white p-6 flex items-center">
      <div>
        <Quote className="w-6 h-6 mb-3" style={{ color: 'var(--gn-chrome-yellow)' }} />
        <p className="text-gray-700 text-sm leading-relaxed">
          "{testimonial.testimonial}"
        </p>
      </div>
    </div>
  </div>
);

// Demo Component showing all options
export const TestimonialStyleDemo = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4" style={{ color: 'var(--gn-rhino)' }}>
          Testimonial Card Options
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Compare different design styles for testimonials
        </p>

        {/* Option 1 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            Option 1: Minimal Card (Recommended) ⭐
          </h2>
          <p className="text-sm text-gray-600 mb-4">Clean, professional, quote-focused</p>
          <div className="max-w-md">
            <MinimalCard testimonial={sampleTestimonial} />
          </div>
        </div>

        {/* Option 2 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            Option 2: Side by Side
          </h2>
          <p className="text-sm text-gray-600 mb-4">Photo left, content right, good for longer text</p>
          <div className="max-w-xl">
            <SideBySideCard testimonial={sampleTestimonial} />
          </div>
        </div>

        {/* Option 3 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            Option 3: Compact Stacked
          </h2>
          <p className="text-sm text-gray-600 mb-4">Centered, compact, great for grids</p>
          <div className="flex justify-center">
            <CompactStackedCard testimonial={sampleTestimonial} />
          </div>
        </div>

        {/* Option 4 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            Option 4: Quote First Minimal
          </h2>
          <p className="text-sm text-gray-600 mb-4">Quote is the hero, very elegant</p>
          <div className="max-w-lg">
            <QuoteFirstCard testimonial={sampleTestimonial} />
          </div>
        </div>

        {/* Option 5 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            Option 5: LinkedIn Style
          </h2>
          <p className="text-sm text-gray-600 mb-4">Professional, familiar layout</p>
          <div className="max-w-md">
            <LinkedInStyleCard testimonial={sampleTestimonial} />
          </div>
        </div>

        {/* Option 6 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>
            Option 6: Split Background
          </h2>
          <p className="text-sm text-gray-600 mb-4">Photo on colored background, quote on white</p>
          <div className="max-w-2xl">
            <SplitBackgroundCard testimonial={sampleTestimonial} />
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-8" style={{ color: 'var(--gn-rhino)' }}>
            Side by Side Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MinimalCard testimonial={sampleTestimonial} />
            <CompactStackedCard testimonial={sampleTestimonial} />
            <QuoteFirstCard testimonial={sampleTestimonial} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialStyleDemo;
