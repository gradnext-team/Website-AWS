import React, { useState, useEffect } from 'react';
import { Quote, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoginModal from '../components/LoginModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
const StarRating = ({ rating = 5 }) => {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          fill={star <= rating ? 'var(--gn-chrome-yellow)' : '#E5E7EB'}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

// Vertical Testimonial Card - matching home page carousel style
const TestimonialCard = ({ testimonial }) => {
  const profileImage = getImageUrl(testimonial.image_url);
  const companyLogo = getImageUrl(testimonial.company_joined_logo);
  const collegeLogo = getImageUrl(testimonial.college_logo);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isLongText = testimonial.testimonial?.length > 300;
  const displayText = isLongText && !isExpanded
    ? testimonial.testimonial.substring(0, 300) + '...'
    : testimonial.testimonial;

  return (
    <div 
      className="bg-white rounded-2xl p-6 transition-all duration-300 hover:shadow-xl"
      style={{
        border: '1px solid rgba(230, 230, 230, 0.8)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)'
      }}
    >
      {/* Header with Rating */}
      <div className="flex items-center justify-between mb-4">
        <StarRating rating={testimonial.rating || 5} />
      </div>

      {/* Quote Icon and Testimonial */}
      <Quote 
        className="w-5 h-5 mb-2 opacity-30" 
        style={{ color: 'var(--gn-periwinkle)' }} 
      />

      {/* Testimonial Text */}
      <p 
        className="text-sm leading-relaxed mb-4"
        style={{ color: 'var(--gn-grey-dark)' }}
      >
        {displayText}
      </p>

      {/* Read More/Less Button */}
      {isLongText && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold hover:underline mb-4"
          style={{ color: 'var(--gn-periwinkle)' }}
        >
          {isExpanded ? 'Show less' : 'Read more'} →
        </button>
      )}

      {/* Bottom: Photo, Name, and Logos - matching home page style */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
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

          {/* Logos in row - matching home page carousel style */}
          <div className="flex items-center gap-2 flex-wrap">
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
                  className="h-6 w-auto max-w-[100px] object-contain"
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
                  className="h-6 w-auto max-w-[100px] object-contain"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TestimonialsPage = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
    
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    checkAuth();
    
    const fetchTestimonials = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/resources/testimonials`);
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
  }, []);

  // Handle Start Free Trial CTA
  const handleStartFreeTrial = () => {
    if (currentUser) {
      navigate('/dashboard');
      return;
    }
    setShowLoginModal(true);
  };

  // Handle successful login
  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setShowLoginModal(false);
    navigate('/dashboard');
  };

  return (
    <div 
      className="min-h-screen pt-24 pb-16"
      style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}
    >
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        {/* Back Link */}
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--gn-periwinkle)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            style={{ color: 'var(--gn-rhino)' }}
          >
            Real success stories from real consultants
          </h1>
          
          <p 
            className="text-base md:text-lg"
            style={{ color: 'var(--gn-grey-dark)' }}
          >
            Hear from candidates who turned their consulting dreams into reality with gradnext.
          </p>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-pulse text-lg" style={{ color: 'var(--gn-grey)' }}>
              Loading success stories...
            </div>
          </div>
        ) : testimonials.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-lg" style={{ color: 'var(--gn-grey)' }}>
              No testimonials available yet.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div 
          className="text-center p-10 rounded-2xl"
          style={{ 
            background: 'linear-gradient(135deg, var(--gn-rhino) 0%, #3d4470 100%)'
          }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Write Your Success Story?
          </h2>
          <p className="text-slate-300 mb-6 max-w-xl mx-auto">
            Join hundreds of successful consultants who trusted gradnext for their MBB preparation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleStartFreeTrial}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
              style={{ 
                background: 'var(--gn-chrome-yellow)',
                color: 'var(--gn-rhino)'
              }}
            >
              Start 7-day free trial
            </button>
            <Link
              to="/coaching"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 bg-white/10 text-white border border-white/20"
            >
              Explore Coaching
            </Link>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default TestimonialsPage;
