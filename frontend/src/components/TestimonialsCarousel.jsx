import React, { useState, useEffect, useRef } from 'react';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const CHAR_LIMIT = 280; // Good limit for horizontal format
const MOBILE_CHAR_LIMIT = 180; // Shorter limit for mobile vertical cards

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/images/')) {
    return `${BACKEND_URL}${url}`;
  }
  if (url.startsWith('/api/uploads')) {
    return `${BACKEND_URL}${url}`;
  }
  if (url.startsWith('/uploads')) {
    return `${BACKEND_URL}/api${url}`;
  }
  return url;
};

// Star Rating Component
const StarRating = ({ rating = 5, size = 'default' }) => {
  const sizeClass = size === 'small' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={sizeClass}
          fill={star <= rating ? 'var(--gn-chrome-yellow)' : '#E5E7EB'}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

// LinkedIn Icon Component
const LinkedInIcon = ({ className, color = '#0A66C2' }) => (
  <svg 
    className={className}
    fill={color}
    viewBox="0 0 24 24"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Horizontal Testimonial Card with Glassmorphism
const TestimonialCard = ({ testimonial, onReadMore, index = 0 }) => {
  const profileImage = getImageUrl(testimonial.image_url);
  const companyLogo = getImageUrl(testimonial.company_joined_logo);
  const collegeLogo = getImageUrl(testimonial.college_logo);
  
  const isLongText = testimonial.testimonial?.length > CHAR_LIMIT;
  const displayText = isLongText 
    ? testimonial.testimonial.substring(0, CHAR_LIMIT) + '...'
    : testimonial.testimonial;
  
  const linkedInUrl = testimonial.linkedin_url || '#';
  const rating = testimonial.rating || 5;
  
  return (
    <div 
      className="testimonial-card flex-shrink-0 rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-xl relative cursor-pointer group"
      style={{
        width: '700px',
        height: '280px',
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(230, 230, 230, 0.8)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
      }}
      onClick={() => onReadMore(testimonial)}
    >
      {/* Main Content */}
      <div className="relative flex flex-col h-full pt-4 px-5 pb-6">
        {/* Top: Rating and LinkedIn */}
        <div className="flex items-center justify-between mb-2">
          <StarRating rating={rating} />
          {linkedInUrl && linkedInUrl !== '#' && (
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-110 hover:drop-shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <LinkedInIcon className="w-5 h-5" />
            </a>
          )}
        </div>

        {/* Quote Icon and Testimonial */}
        <div className="flex-1 mb-2">
          <Quote 
            className="w-5 h-5 mb-1.5 opacity-30" 
            style={{ color: 'var(--gn-periwinkle)' }} 
          />
          <p 
            className="text-gray-800 text-sm leading-relaxed line-clamp-3"
            style={{ 
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            "{testimonial.testimonial}"
          </p>
          {testimonial.testimonial && testimonial.testimonial.length > 150 && (
            <button 
              className="text-xs mt-1 font-semibold hover:underline"
              style={{ color: 'var(--gn-periwinkle)' }}
            >
              Read more →
            </button>
          )}
        </div>

        {/* Bottom: Photo, Name, and Logos */}
        <div className="flex items-center gap-3">
          {/* Photo - Small and Round */}
          <div className="flex-shrink-0">
            {profileImage ? (
              <img
                src={profileImage}
                alt={testimonial.name}
                className="rounded-full object-cover shadow-lg"
                style={{ 
                  width: '48px',
                  height: '48px',
                  border: '2px solid rgba(140, 157, 255, 0.3)'
                }}
              />
            ) : (
              <div 
                className="rounded-full flex items-center justify-center text-white text-base font-bold shadow-lg"
                style={{ 
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'var(--gn-periwinkle)',
                  border: '2px solid rgba(140, 157, 255, 0.3)'
                }}
              >
                {testimonial.name?.[0]}
              </div>
            )}
          </div>

          {/* Name and Logos */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <h4 
              className="font-bold text-base mb-1.5"
              style={{ color: 'var(--gn-rhino)' }}
            >
              {testimonial.name}
            </h4>

            {/* Logos in row */}
            <div className="flex items-center gap-2">
              {/* Company Logo */}
              {companyLogo && (
                <div 
                  className="px-2 py-1.5 rounded-md transition-all"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(140, 157, 255, 0.25)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <img
                    src={companyLogo}
                    alt={testimonial.company_joined || 'Company'}
                    className="h-6 w-auto max-w-[120px] object-contain"
                  />
                </div>
              )}

              {/* College Logo */}
              {collegeLogo && (
                <div 
                  className="px-2 py-1.5 rounded-md transition-all"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 215, 0, 0.35)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <img
                    src={collegeLogo}
                    alt={testimonial.college || 'College'}
                    className="h-6 w-auto max-w-[120px] object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hover effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(140, 157, 255, 0.06) 0%, transparent 70%)'
        }}
      />
    </div>
  );
};

// Mobile Vertical Card - Compact version for horizontal scroll on mobile
const MobileTestimonialCard = ({ testimonial, onReadMore }) => {
  const profileImage = getImageUrl(testimonial.image_url);
  const companyLogo = getImageUrl(testimonial.company_joined_logo);
  
  const isLongText = testimonial.testimonial?.length > MOBILE_CHAR_LIMIT;
  const displayText = isLongText 
    ? testimonial.testimonial.substring(0, MOBILE_CHAR_LIMIT) + '...'
    : testimonial.testimonial;
  
  const rating = testimonial.rating || 5;
  
  return (
    <div 
      className="flex-shrink-0 rounded-xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{
        width: '280px',
        minHeight: '320px',
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid rgba(230, 230, 230, 0.8)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
      }}
      onClick={() => onReadMore(testimonial)}
    >
      <div className="flex flex-col h-full p-4">
        {/* Top: Rating */}
        <div className="mb-3">
          <StarRating rating={rating} size="small" />
        </div>

        {/* Quote and Testimonial */}
        <div className="flex-1">
          <Quote 
            className="w-4 h-4 mb-2 opacity-30" 
            style={{ color: 'var(--gn-periwinkle)' }} 
          />
          <p 
            className="text-xs leading-relaxed"
            style={{ 
              color: 'var(--gn-grey-dark)',
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            "{displayText}"
          </p>
          {isLongText && (
            <button 
              className="text-[10px] mt-2 font-semibold"
              style={{ color: 'var(--gn-periwinkle)' }}
            >
              Read more →
            </button>
          )}
        </div>

        {/* Bottom: Photo, Name, Company */}
        <div className="flex items-center gap-2.5 pt-3 mt-auto border-t border-slate-100">
          {/* Photo */}
          <div className="flex-shrink-0">
            {profileImage ? (
              <img
                src={profileImage}
                alt={testimonial.name}
                className="rounded-full object-cover"
                style={{ 
                  width: '40px',
                  height: '40px',
                  border: '2px solid rgba(140, 157, 255, 0.2)'
                }}
              />
            ) : (
              <div 
                className="rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ 
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'var(--gn-periwinkle)'
                }}
              >
                {testimonial.name?.[0]}
              </div>
            )}
          </div>

          {/* Name and Company */}
          <div className="flex-1 min-w-0">
            <h4 
              className="font-semibold text-sm truncate"
              style={{ color: 'var(--gn-rhino)' }}
            >
              {testimonial.name}
            </h4>
            {companyLogo && (
              <div className="mt-1">
                <img
                  src={companyLogo}
                  alt={testimonial.company_joined || 'Company'}
                  className="h-4 w-auto max-w-[80px] object-contain opacity-70"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Full Testimonial Modal
const TestimonialModal = ({ testimonial, isOpen, onClose }) => {
  if (!testimonial) return null;
  
  const profileImage = getImageUrl(testimonial.image_url);
  const companyLogo = getImageUrl(testimonial.company_joined_logo);
  const collegeLogo = getImageUrl(testimonial.college_logo);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="sr-only">Testimonial from {testimonial.name}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row gap-5 p-2">
          {/* Photo side - reduced size */}
          <div className="md:w-1/3 flex-shrink-0">
            <div className="relative rounded-xl overflow-hidden aspect-square max-w-[180px] mx-auto md:mx-0">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={testimonial.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, #3d4470 100%)' }}
                >
                  <span className="text-4xl text-white/30">{testimonial.name?.[0]}</span>
                </div>
              )}
            </div>
            
            {/* Badges below photo */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
              {testimonial.company_joined && (
                <div 
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ 
                    background: 'rgba(140, 157, 255, 0.1)',
                    color: 'var(--gn-rhino)'
                  }}
                >
                  {testimonial.company_joined}
                </div>
              )}
              {testimonial.college && (
                <div 
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ 
                    background: 'rgba(255, 215, 0, 0.15)',
                    color: 'var(--gn-rhino)'
                  }}
                >
                  {testimonial.college}
                </div>
              )}
            </div>
          </div>
          
          {/* Content side */}
          <div className="md:w-2/3 flex flex-col justify-center">
            <Quote className="w-7 h-7 mb-3" style={{ color: 'var(--gn-chrome-yellow)' }} />
            
            <p 
              className="text-sm md:text-base leading-relaxed mb-4 italic max-h-[280px] overflow-y-auto pr-2"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              "{testimonial.testimonial}"
            </p>
            
            <div className="w-12 h-0.5 mb-3" style={{ background: 'var(--gn-chrome-yellow)' }} />
            
            <h3 className="text-lg font-bold mb-0.5" style={{ color: 'var(--gn-rhino)' }}>
              {testimonial.name}
            </h3>
            
            {testimonial.plan_subscribed && (
              <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>
                {testimonial.plan_subscribed} Plan Member
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const TestimonialsCarousel = ({ page = 'home', title, subtitle, background }) => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestimonial, setSelectedTestimonial] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [manualScroll, setManualScroll] = useState(0);
  const scrollContainerRef = useRef(null);
  const carouselWrapperRef = useRef(null);
  const resumeTimeoutRef = useRef(null);

  // Default backgrounds based on page - now transparent to blend with parent
  const defaultBackground = 'transparent';

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/resources/testimonials?page=${page}`);
        if (res.ok) {
          const data = await res.json();
          setTestimonials(data.testimonials || []);
        }
      } catch (error) {
        console.error('Failed to fetch testimonials:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTestimonials();
  }, [page]);

  const handleReadMore = (testimonial) => {
    setSelectedTestimonial(testimonial);
    setIsPaused(true);
  };

  // Scroll functions for arrow buttons
  const scrollLeft = () => {
    const cardWidth = 720; // card width (700) + gap (20)
    const newScroll = manualScroll + cardWidth;
    setManualScroll(newScroll);
    setIsPaused(true);
    
    // Clear any existing timeout
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
    
    // Resume auto-scroll after 5 seconds
    resumeTimeoutRef.current = setTimeout(() => {
      if (!selectedTestimonial) {
        setIsPaused(false);
        setManualScroll(0);
      }
    }, 5000);
  };

  const scrollRight = () => {
    const cardWidth = 720; // card width (700) + gap (20)
    const newScroll = manualScroll - cardWidth;
    setManualScroll(newScroll);
    setIsPaused(true);
    
    // Clear any existing timeout
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
    
    // Resume auto-scroll after 5 seconds
    resumeTimeoutRef.current = setTimeout(() => {
      if (!selectedTestimonial) {
        setIsPaused(false);
        setManualScroll(0);
      }
    }, 5000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center" style={{ background: background || defaultBackground }}>
        <div className="animate-pulse">Loading testimonials...</div>
      </div>
    );
  }

  if (testimonials.length === 0) {
    return null;
  }

  // Duplicate testimonials for seamless infinite scroll
  const duplicatedTestimonials = [...testimonials, ...testimonials, ...testimonials];

  return (
    <section 
      className="py-10 sm:py-16 overflow-hidden"
      style={{ background: background || defaultBackground }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-10 mb-6">
        <div className="text-center relative">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3" style={{ color: 'var(--gn-rhino)' }}>
            {title || 'Trusted by aspiring consultants worldwide'}
          </h2>
          <p className="text-sm sm:text-base" style={{ color: 'var(--gn-grey-dark)' }}>
            {subtitle || 'Join those who have trusted us and started their journey'}
          </p>
          
          {/* Arrow Buttons - Desktop only */}
          <div className="absolute right-0 top-0 hidden sm:flex gap-2">
            <button
              onClick={scrollLeft}
              className="bg-white/90 hover:bg-white shadow-lg rounded-full p-2 transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-slate-200"
              style={{
                boxShadow: '0 4px 20px rgba(140, 157, 255, 0.15)'
              }}
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
            </button>

            <button
              onClick={scrollRight}
              className="bg-white/90 hover:bg-white shadow-lg rounded-full p-2 transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-slate-200"
              style={{
                boxShadow: '0 4px 20px rgba(140, 157, 255, 0.15)'
              }}
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Rolling Carousel Container - Desktop */}
      <div 
        ref={carouselWrapperRef}
        className="relative hidden md:block"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => !selectedTestimonial && setIsPaused(false)}
      >
        {/* CSS Animation for continuous rolling */}
        <style>{`
          @keyframes scroll-left {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-33.333%);
            }
          }
          
          .rolling-carousel {
            animation: scroll-left 300s linear infinite;
            will-change: transform;
            transform: translateZ(0);
          }
          
          .rolling-carousel.paused {
            animation-play-state: paused;
          }
          
          .rolling-carousel.manual-scroll {
            animation: none;
          }
        `}</style>
        
        {/* Scrollable Container with rolling animation */}
        <div
          ref={scrollContainerRef}
          className={`flex gap-5 rolling-carousel ${isPaused ? 'paused' : ''} ${manualScroll !== 0 ? 'manual-scroll' : ''}`}
          style={{
            width: 'fit-content',
            transform: `translateX(${manualScroll}px)`,
            transition: manualScroll !== 0 ? 'transform 0.6s ease-out' : 'none',
          }}
        >
          {duplicatedTestimonials.map((testimonial, index) => (
            <TestimonialCard 
              key={`${testimonial.id}-${index}`} 
              testimonial={testimonial}
              index={index}
              onReadMore={handleReadMore}
            />
          ))}
        </div>
      </div>

      {/* Mobile Carousel - Horizontal scroll with vertical cards */}
      <div className="md:hidden">
        <div 
          className="flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {testimonials.map((testimonial, index) => (
            <div key={`mobile-${testimonial.id}-${index}`} className="snap-start">
              <MobileTestimonialCard 
                testimonial={testimonial}
                onReadMore={handleReadMore}
              />
            </div>
          ))}
        </div>
      </div>

      {/* View All Button - Small, Right aligned */}
      <div className="flex justify-end max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <Link
          to="/success-stories"
          className="inline-flex items-center gap-1 text-sm font-medium transition-all duration-300 hover:gap-2"
          style={{ color: 'var(--gn-periwinkle)' }}
        >
          View more
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      
      {/* Read More Modal */}
      <TestimonialModal 
        testimonial={selectedTestimonial}
        isOpen={!!selectedTestimonial}
        onClose={() => {
          setSelectedTestimonial(null);
          setIsPaused(false);
        }}
      />
    </section>
  );
};

export default TestimonialsCarousel;
