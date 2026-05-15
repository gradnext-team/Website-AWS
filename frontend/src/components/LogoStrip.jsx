import React from 'react';

/**
 * LogoStrip Component - Scrolling company logos marquee
 * Shows consulting firms where GradNext candidates have received offers
 */

const logos = [
  { name: 'McKinsey & Company', url: 'https://customer-assets.emergentagent.com/job_success-pillars/artifacts/iey697kq_image.png', size: 'h-5 sm:h-7 md:h-8' },
  { name: 'Bain & Company', url: 'https://customer-assets.emergentagent.com/job_success-pillars/artifacts/6kt0kjbt_image.png', size: 'h-5 sm:h-7 md:h-8' },
  { name: 'Boston Consulting Group', url: 'https://customer-assets.emergentagent.com/job_success-pillars/artifacts/qpzhjb32_image.png', size: 'h-5 sm:h-7 md:h-8' },
  { name: 'Kearney', url: 'https://customer-assets.emergentagent.com/job_success-pillars/artifacts/4blcvs2r_image.png', size: 'h-10 sm:h-14 md:h-16' },
  { name: 'Strategy&', url: 'https://customer-assets.emergentagent.com/job_success-pillars/artifacts/j5bobe8l_image.png', size: 'h-5 sm:h-7 md:h-8' },
  { name: 'EY Parthenon', url: 'https://customer-assets.emergentagent.com/job_success-pillars/artifacts/fv6fonfo_image.png', size: 'h-5 sm:h-7 md:h-8' },
];

// Extracted as a separate component outside render.
// `variant` controls the colour treatment so the same component works on
// both light backgrounds (default — dark gray tint) and dark backgrounds
// (inverted-white tint, used by /get-started's stats section).
const LogoSet = ({ keyPrefix, variant = 'light' }) => (
  <div className="flex items-center gap-8 sm:gap-16 md:gap-20 shrink-0 px-4 sm:px-8">
    {logos.map((logo, idx) => (
      <div
        key={`${keyPrefix}-${idx}`}
        className={`flex items-center justify-center h-10 sm:h-14 transition-opacity ${
          variant === 'dark' ? 'logo-white-tint opacity-80 hover:opacity-100' : 'logo-gray-tint opacity-60 hover:opacity-100'
        }`}
      >
        <img
          src={logo.url}
          alt={logo.name}
          className={`${logo.size} object-contain`}
          loading="lazy"
        />
      </div>
    ))}
  </div>
);

const LogoStrip = ({ variant = 'light', compact = false }) => {
  // Match the gradient fade-edges to the surrounding background colour so
  // logos don't get clipped against a contrasting colour.
  const isDark = variant === 'dark';
  const fadeFrom = isDark ? 'from-slate-900' : 'from-white';
  const fadeFromR = isDark ? 'from-slate-900' : 'from-white';
  const labelColor = isDark ? 'text-slate-400' : 'text-gray-500';
  const labelBorder = isDark ? 'border-slate-700' : 'border-gray-200';

  // Compact mode: fits inside hero sections right below CTA
  if (compact) {
    return (
      <div className="w-full animate-fade-in-up stagger-3">
        <p className={`text-center text-xs font-medium ${labelColor} mb-3`}>
          Our candidates have received offers from
        </p>
        <div className="relative overflow-hidden max-w-2xl mx-auto">
          <div className={`absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r ${fadeFrom} to-transparent z-10`}></div>
          <div className={`absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l ${fadeFromR} to-transparent z-10`}></div>
          <div className="flex animate-scroll-logos-slow">
            <LogoSet keyPrefix="c1" variant={variant} />
            <LogoSet keyPrefix="c2" variant={variant} />
          </div>
        </div>
        <style>{`
          @keyframes scroll-logos-slow {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-scroll-logos-slow {
            animation: scroll-logos-slow 25s linear infinite;
            will-change: transform;
            transform: translateZ(0);
          }
          .animate-scroll-logos-slow:hover { animation-play-state: paused; }
          .logo-gray-tint img { filter: grayscale(100%) brightness(0.6); transition: filter 0.3s ease; }
          .logo-gray-tint:hover img { filter: grayscale(0%) brightness(1); }
          .logo-white-tint img { filter: grayscale(100%) brightness(0) invert(1); transition: filter 0.3s ease; }
          .logo-white-tint:hover img { filter: grayscale(0%) brightness(1) invert(0); }
        `}</style>
      </div>
    );
  }

  return (
    <section className="py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: Show text above logos */}
        <div className="md:hidden text-center mb-4">
          <p className={`text-xs font-medium ${labelColor}`}>
            Our candidates have received offers from
          </p>
        </div>
        
        <div className="flex items-center gap-8 md:gap-12">
          {/* Text on the left - Desktop only */}
          <div className="shrink-0 hidden md:block">
            <p className={`text-sm font-medium ${labelColor} whitespace-nowrap border ${labelBorder} rounded-lg px-4 py-3`}>
              Our candidates have received offers from.
            </p>
          </div>
          
          {/* Scrolling logos container */}
          <div className="relative flex-1 overflow-hidden">
            {/* Gradient fade edges — match surrounding bg colour */}
            <div className={`absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r ${fadeFrom} to-transparent z-10`}></div>
            <div className={`absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l ${fadeFromR} to-transparent z-10`}></div>
            
            {/* Scrolling container */}
            <div className="flex animate-scroll-logos-slow">
              {/* First set of logos */}
              <LogoSet keyPrefix="set1" variant={variant} />
              {/* Duplicate set for seamless loop */}
              <LogoSet keyPrefix="set2" variant={variant} />
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS for scrolling animation */}
      <style>{`
        @keyframes scroll-logos-slow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll-logos-slow {
          animation: scroll-logos-slow 25s linear infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        .animate-scroll-logos-slow:hover {
          animation-play-state: paused;
        }
        .logo-gray-tint img {
          filter: grayscale(100%) brightness(0.6);
          transition: filter 0.3s ease;
        }
        .logo-gray-tint:hover img {
          filter: grayscale(0%) brightness(1);
        }
        /* Dark-mode variant — inverts dark logos to white so they pop on
           dark backgrounds. */
        .logo-white-tint img {
          filter: grayscale(100%) brightness(0) invert(1);
          transition: filter 0.3s ease;
        }
        .logo-white-tint:hover img {
          filter: grayscale(0%) brightness(1) invert(0);
        }
      `}</style>
    </section>
  );
};

export default LogoStrip;
