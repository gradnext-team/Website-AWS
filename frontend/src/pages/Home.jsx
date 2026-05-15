import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Target, Award, BookOpen, Video, Zap, Calendar, UserCheck, CheckCircle2, Loader2, Info, ChevronDown, ChevronRight, Phone, X, MessageCircle, Clock, Play, Tag, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { statistics, faqs } from '../data/mock';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
// These five are visible above the fold or render-critical to the
// hero. Keep them eager so first paint is immediate.
import LogoStrip from '../components/LogoStrip';
import OfferRateMethodology from '../components/OfferRateMethodology';

// ────────────────────────────────────────────────────────────────────
// Heavy components — lazy-loaded to keep Home's contribution to the
// initial JS bundle small. Each of these is large (200-1000 lines) and
// is either a modal (only shown on user action) or below-the-fold
// content. Splitting them out of `main.js` drops the initial bundle
// from ~309 KB gzipped to ~200 KB, which speeds up first paint on
// production where bundle parse-time was the bottleneck.
// ────────────────────────────────────────────────────────────────────
const PaymentModal = lazy(() => import('../components/PaymentModal'));
const LoginModal = lazy(() => import('../components/LoginModal'));
const TestimonialsCarousel = lazy(() => import('../components/TestimonialsCarousel'));
const DiscoveryCallModal = lazy(() => import('../components/DiscoveryCallModal'));
const ContactFormModal = lazy(() => import('../components/ContactFormModal'));
const PinnacleApplicationModal = lazy(() => import('../components/PinnacleApplicationModal'));
const BookSingleSessionSection = lazy(() => import('../components/BookSingleSessionSection'));

import { isPromoActive, PROMO_PERCENT, PROMO_SIX_MONTH_TOTAL_SAVING_PCT, formatPromoEndDate } from '../data/promoCampaign';
import { useCurrency } from '../hooks/useCurrency';

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);
  
  // Parse the value to extract number and suffix
  const parseValue = (val) => {
    const str = String(val);
    const match = str.match(/^([\d,]+)(.*)$/);
    if (match) {
      const num = parseInt(match[1].replace(/,/g, ''), 10);
      const suffix = match[2] || '';
      return { num, suffix };
    }
    return { num: 0, suffix: str };
  };
  
  const { num: targetNum, suffix } = parseValue(value);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            // Animate the counter
            const startTime = Date.now();
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function (ease-out)
              const easeOut = 1 - Math.pow(1 - progress, 3);
              const currentCount = Math.floor(easeOut * targetNum);
              
              setCount(currentCount);
              
              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setCount(targetNum);
              }
            };
            
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [targetNum, duration, hasAnimated]);
  
  // Format number with commas
  const formatNumber = (num) => {
    return num.toLocaleString();
  };
  
  return (
    <span ref={ref}>
      {formatNumber(count)}{suffix}
    </span>
  );
};

// Feature Detail Modal Component
const FeatureDetailModal = ({ feature, onClose, navigate }) => {
  if (!feature) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div 
        className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all hover:scale-110"
          style={{ border: '1px solid var(--gn-grey-light)' }}
        >
          <X className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
        </button>
        
        <div className="p-8">
          {/* Icon and Title */}
          <div className="flex items-center gap-4 mb-6">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}
            >
              {React.cloneElement(feature.icon, { className: 'w-7 h-7', style: { color: 'var(--gn-rhino)' } })}
            </div>
            <div>
              <h3 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                {feature.title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>{feature.desc}</p>
            </div>
          </div>
          
          {/* Floating Screenshot */}
          <div 
            className="float-right ml-6 mb-4 w-[55%] hidden md:block"
          >
            <div 
              className="rounded-xl overflow-hidden shadow-xl bg-white"
              style={{ 
                border: '3px solid var(--gn-periwinkle-light)',
                boxShadow: '0 10px 40px rgba(140, 157, 255, 0.25)'
              }}
            >
              <img 
                src={feature.screenshot}
                alt={`${feature.title} Dashboard`}
                className="w-full h-auto"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              {/* Fallback placeholder */}
              <div 
                className="items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 py-16"
                style={{ display: 'none' }}
              >
                <div className="text-center p-8">
                  {React.cloneElement(feature.icon, { className: 'w-12 h-12 mx-auto mb-3', style: { color: 'var(--gn-periwinkle)' } })}
                  <p className="text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>{feature.title}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--gn-grey)' }}>
              Dashboard Preview
            </p>
          </div>
          
          {/* Description - Wraps around floating image */}
          <p className="text-base mb-6 leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
            {feature.fullDescription}
          </p>
          
          {/* Features List - Wraps around floating image */}
          <div className="mb-6">
            <h4 className="font-semibold mb-4" style={{ color: 'var(--gn-rhino)' }}>What's Included:</h4>
            <ul className="space-y-3">
              {feature.features.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--gn-periwinkle)' }} />
                  <span className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Clear float before CTA */}
          <div className="clear-both"></div>
          
          {/* CTA Button */}
          <button
            onClick={() => {
              onClose();
              navigate(feature.route);
            }}
            className="w-full py-3 px-6 rounded-xl font-semibold transition-all hover:shadow-lg flex items-center justify-center gap-2 mt-4"
            style={{ 
              backgroundColor: 'var(--gn-rhino)', 
              color: 'white' 
            }}
          >
            Explore {feature.title}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Tooltip component for info icons
const InfoTooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block ml-2">
      <Info 
        className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help inline-block"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
};

// Typing animation component
const TypingAnimation = () => {
  const words = ['consulting', 'McKinsey', 'BCG', 'Bain'];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const typeSpeed = 120;
  const deleteSpeed = 80;
  const pauseTime = 2000;
  
  const tick = useCallback(() => {
    const currentWord = words[currentWordIndex];
    
    if (!isDeleting) {
      // Typing
      setDisplayText(currentWord.substring(0, displayText.length + 1));
      
      if (displayText === currentWord) {
        // Word complete, pause then start deleting
        setTimeout(() => setIsDeleting(true), pauseTime);
        return;
      }
    } else {
      // Deleting
      setDisplayText(currentWord.substring(0, displayText.length - 1));
      
      if (displayText === '') {
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }
    }
  }, [currentWordIndex, displayText, isDeleting, words]);
  
  useEffect(() => {
    const timer = setTimeout(tick, isDeleting ? deleteSpeed : typeSpeed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);
  
  return (
    <span className="inline-block min-w-[160px] text-left">
      <span style={{ color: 'var(--gn-periwinkle)' }}>{displayText}</span>
      <span className="animate-blink" style={{ color: 'var(--gn-periwinkle)' }}>|</span>
    </span>
  );
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/uploads')) {
    return `${BACKEND_URL}${url}`;
  }
  if (url.startsWith('/uploads')) {
    return `${BACKEND_URL}/api${url}`;
  }
  return url;
};

// Scrolling Logo Marquee Component
const LogoMarquee = ({ logos }) => {
  if (!logos || logos.length === 0) return null;
  
  // Duplicate logos for seamless scroll
  const duplicatedLogos = [...logos, ...logos];
  
  return (
    <div className="logo-marquee-container overflow-hidden">
      <div className="logo-marquee flex items-center gap-16">
        {duplicatedLogos.map((logo, index) => (
          <div
            key={`${logo.id || logo.name}-${index}`}
            className="flex-shrink-0 px-2"
          >
            <img
              src={getImageUrl(logo.logo_url)}
              alt={logo.name}
              className="h-10 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
              title={logo.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Define the order for consulting firm logos
const LOGO_ORDER = [
  'McKinsey & Company',
  'BCG',
  'Bain & Company',
  'Kearney',
  'Arthur D. Little',
  'Alvarez & Marsal',
  'Accenture',
  'YCP'
];

const Home = () => {
  const navigate = useNavigate();
  const { currency, currencySymbol, region, loading: currencyLoading } = useCurrency();
  const [loginLoading, setLoginLoading] = useState(false);
  const [dynamicPlans, setDynamicPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [consultingLogos, setConsultingLogos] = useState([]);
  const [drillCounts, setDrillCounts] = useState(null);
  const [planCategory, setPlanCategory] = useState('subscription'); // subscription, coaching, or cohort
  const [overviewCategory, setOverviewCategory] = useState('subscription'); // For the overview section toggle
  const [billingCycle, setBillingCycle] = useState('6-month'); // monthly or 6-month (for subscription only)
  const [expandedFeatures, setExpandedFeatures] = useState({}); // Track expanded feature sections
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Discovery call modal state
  const [showDiscoveryCallModal, setShowDiscoveryCallModal] = useState(false);
  
  // Contact form modal state
  const [showContactFormModal, setShowContactFormModal] = useState(false);
  
  // Pinnacle application modal state
  const [showPinnacleModal, setShowPinnacleModal] = useState(false);

  // Check if user is already logged in on page load
  useEffect(() => {
    const checkAuth = async () => {
      // Check for OAuth tokens from URL params (Safari redirect flow)
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session_token');
      const authSuccess = urlParams.get('auth_success');
      const authError = urlParams.get('auth_error');
      
      // Handle OAuth success from Safari redirect
      if (authSuccess === 'true' && sessionToken) {
        // Store tokens from OAuth redirect
        localStorage.setItem('session_token', sessionToken);
        // Clean up URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('[Home] OAuth tokens stored from Safari redirect');
        
        // Fetch user data and redirect to appropriate dashboard
        try {
          const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
            credentials: 'include'
          });
          if (response.ok) {
            const userData = await response.json();
            setCurrentUser(userData);
            // Redirect to appropriate dashboard
            if (userData.is_admin) {
              window.location.href = '/admin';
            } else if (userData.is_mentor) {
              window.location.href = '/mentor-dashboard';
            } else {
              window.location.href = '/dashboard';
            }
            return;
          }
        } catch (error) {
          console.error('[Home] Failed to fetch user after OAuth:', error);
        }
      }
      
      if (authError) {
        console.error('[Home] OAuth error:', authError, urlParams.get('message'));
        // Clean up URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        // Show login modal with error (optional)
        setShowLoginModal(true);
      }
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        }
      } catch (error) {
        // User not logged in, that's okay
        console.log('User not authenticated');
      }
    };
    checkAuth();
  }, []);

  const toggleFeature = (featureName) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [featureName]: !prev[featureName]
    }));
  };

  // Fetch plans and logos from API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const [plansRes, drillCountsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/resources/plans?region=${region}`), // Pass region for regional pricing
          fetch(`${BACKEND_URL}/api/ai-drills/counts-by-tier`)
        ]);
        
        if (plansRes.ok) {
          const data = await plansRes.json();
          console.log('[Home] Fetched plans:', data.plans?.length || 0);
          setDynamicPlans(data.plans || []);
        } else {
          console.error('[Home] Plans API error:', plansRes.status, plansRes.statusText);
        }
        
        if (drillCountsRes.ok) {
          const countsData = await drillCountsRes.json();
          setDrillCounts(countsData);
        }
      } catch (error) {
        console.error('[Home] Failed to fetch plans:', error);
      } finally {
        setPlansLoading(false);
      }
    };
    
    const fetchLogos = async () => {
      try {
        // Fetch logos marked for homepage display
        const res = await fetch(`${BACKEND_URL}/api/resources/logos?homepage_only=true`);
        if (res.ok) {
          const data = await res.json();
          // Show logos with valid URLs (uploaded or external)
          const validLogos = (data.logos || []).filter(logo => 
            logo.logo_url && (
              logo.logo_url.startsWith('/uploads') || 
              logo.logo_url.startsWith('/api/uploads') ||
              logo.logo_url.startsWith('http://') ||
              logo.logo_url.startsWith('https://') ||
              logo.logo_url.startsWith('data:')
            )
          );
          
          // Sort logos according to LOGO_ORDER
          const sortedLogos = validLogos.sort((a, b) => {
            const indexA = LOGO_ORDER.findIndex(name => 
              a.name.toLowerCase().includes(name.toLowerCase()) || 
              name.toLowerCase().includes(a.name.toLowerCase())
            );
            const indexB = LOGO_ORDER.findIndex(name => 
              b.name.toLowerCase().includes(name.toLowerCase()) || 
              name.toLowerCase().includes(b.name.toLowerCase())
            );
            // If not in order list, put at end
            const orderA = indexA === -1 ? 999 : indexA;
            const orderB = indexB === -1 ? 999 : indexB;
            return orderA - orderB;
          });
          
          setConsultingLogos(sortedLogos);
        }
      } catch (error) {
        console.error('Failed to fetch logos:', error);
      }
    };
    
    fetchPlans();
    fetchLogos();
  }, [region]); // Re-fetch when region changes
  
  // Handle login success - redirect based on context
  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setShowLoginModal(false);
    
    // If a plan was selected (from plan card click), show payment modal
    if (selectedPlan && selectedPlan.price > 0) {
      // Show payment modal directly after login
      setShowPaymentModal(true);
    } else {
      // Free trial - go directly to dashboard
      navigate('/dashboard');
    }
  };
  
  // Handle Start Free Trial - show login/signup modal (for free trial) or go to dashboard if logged in
  const handleStartFreeTrial = () => {
    // If user is already logged in, redirect directly to dashboard
    if (currentUser) {
      navigate('/dashboard');
      return;
    }
    setSelectedPlan(null); // Clear any selected plan
    setShowLoginModal(true);
  };
  
  // Handle plan card click - check auth and show login or payment modal
  const handlePlanClick = (plan) => {
    // For Pinnacle program, open the application modal
    if (plan.name === 'Pinnacle' || plan.plan_key === 'pinnacle') {
      setShowPinnacleModal(true);
      return;
    }
    
    if (plan.price === 0) {
      // Free plan - just show login modal
      handleStartFreeTrial();
      return;
    }
    
    // Set the selected plan
    setSelectedPlan(plan);
    
    // Check if user is already logged in
    if (currentUser) {
      // Already logged in - show payment modal directly
      setShowPaymentModal(true);
    } else {
      // Not logged in - show login modal first
      setShowLoginModal(true);
    }
  };
  
  // Handle plan purchase
  const handlePlanPurchase = async (plan) => {
    if (plan.price === 0) {
      handleStartFreeTrial();
      return;
    }
    
    setLoginLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/mock-login?user_type=free`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        setSelectedPlan(plan);
        setShowPaymentModal(true);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoginLoading(false);
    }
  };
  
  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
    navigate('/dashboard');
  };

  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll to pricing section and set the category (subscription or coaching)
  const scrollToPricingWithCategory = (category) => {
    // Set the plan category first
    setPlanCategory(category);
    // Then scroll to the pricing section
    setTimeout(() => {
      const pricingSection = document.getElementById('pricing');
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const services = [
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: 'Subscription',
      description: 'Full access to all gradnext resources including drills, case interview resources, workshops, recorded courses, and peer-to-peer case practice.',
      features: ['Video Course', 'Live Workshops', 'Case Drills', 'Interview Resources', 'Peer Practice'],
      link: '/subscription/video-course',
    },
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: '1:1 Coaching',
      description: 'Personalized coaching with MBB mentors featuring a tailored plan, flexible scheduling, and dedicated support throughout your journey.',
      features: ['MBB Consultants', 'Strategy Calls', 'Performance Dashboard', 'Flexible Schedule', 'Full Subscription Access'],
      link: '/coaching',
    },
  ];

  // Feature details for popup modals
  const subscriptionIncludes = [
    { 
      icon: <Video className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />, 
      title: 'Consulting Prep Courses', 
      desc: '30+ hours of structured content',
      fullDescription: 'Access our comprehensive library of consulting prep courses designed by MBB consultants. Includes case interview fundamentals, advanced case techniques, fit interview mastery, and more.',
      features: [
        'Case Interview Fundamentals & Advanced Techniques',
        'Fit Interview Preparation & STAR Method',
        'Market Sizing & Estimation Masterclass',
        'Profitability & Growth Strategy Cases',
        'M&A and Due Diligence Frameworks',
        'Structured Problem Solving Approaches'
      ],
      screenshot: '/dashboard-courses.png',
      route: '/dashboard/courses'
    },
    { 
      icon: <Users className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />, 
      title: 'Peer Practice', 
      desc: 'Connect with aspirants globally',
      fullDescription: 'Join our thriving community of aspiring consultants for unlimited peer-to-peer mock interviews. Practice giving and receiving cases, get real-time feedback, and improve together with peers targeting the same firms.',
      features: [
        'Unlimited peer mock interviews',
        'Smart matching based on target firms & experience',
        'Structured feedback forms after each session',
        'Calendar integration for easy scheduling',
        'Rating system to find top practice partners',
        'Practice as both interviewer and interviewee'
      ],
      screenshot: '/dashboard-peer-practice.png',
      route: '/dashboard/peer-practice'
    },
    { 
      icon: <Calendar className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />, 
      title: 'Workshops', 
      desc: 'Live sessions with mentors',
      fullDescription: 'Attend live interactive workshops led by MBB consultants covering current industry trends, deep-dive case walkthroughs, and Q&A sessions. Workshops are recorded for on-demand viewing.',
      features: [
        'Weekly live workshops with MBB consultants',
        'Industry deep-dives and current trends',
        'Live case walkthroughs with expert commentary',
        'Interactive Q&A sessions',
        'Recording access for on-demand viewing',
        'Workshop materials and resources included'
      ],
      screenshot: '/dashboard-workshops.png',
      route: '/dashboard/courses'
    },
    { 
      icon: <Zap className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />, 
      title: 'Case Exercises & Drills', 
      desc: '100+ practice exercises',
      fullDescription: 'Sharpen your case skills with our library of 100+ practice drills covering math, structuring, chart interpretation, and brainstorming. Track your progress and identify areas for improvement.',
      features: [
        'Case Math Drills (mental math, calculations)',
        'Structuring Exercises (issue trees, frameworks)',
        'Chart & Exhibit Interpretation',
        'Brainstorming & Creativity Exercises',
        'Timed practice mode for interview simulation',
        'Performance tracking and analytics'
      ],
      screenshot: '/dashboard-drills.png',
      route: '/dashboard/drills'
    },
    { 
      icon: <UserCheck className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />, 
      title: 'Coaching Sessions', 
      desc: 'MBB consultant feedback',
      fullDescription: 'Get personalized 1-on-1 coaching from experienced MBB consultants. Receive detailed feedback on your case performance, communication style, and areas for improvement tailored to your target firms.',
      features: [
        '1-on-1 sessions with MBB consultants',
        'Mock case interviews with detailed feedback',
        'Fit interview practice and coaching',
        'Personalized improvement plans',
        'Session recordings for review',
        'Written feedback reports after each session'
      ],
      screenshot: '/dashboard-coaching.png',
      route: '/dashboard/coaching'
    },
    { 
      icon: <Phone className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />, 
      title: 'Strategy Calls', 
      desc: 'Plan your prep journey',
      fullDescription: 'Book strategy calls with our expert coaches to create a personalized preparation plan. Discuss your background, target firms, timeline, and get tailored advice on how to maximize your chances.',
      features: [
        '30-minute strategy planning sessions',
        'Personalized prep roadmap creation',
        'Target firm selection guidance',
        'Resume and application review',
        'Timeline and milestone planning',
        'Ongoing prep strategy adjustments'
      ],
      screenshot: '/dashboard-coaching.png',
      route: '/dashboard/coaching'
    },
  ];

  // State for feature detail modal
  const [selectedFeature, setSelectedFeature] = useState(null);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero Section - Centered Layout */}
      <section className="hero-section pt-24 sm:pt-32 pb-8 overflow-hidden relative">
        {/* Concentric Circles Background */}
        <div className="hero-concentric">
          <div className="hero-center-glow" />
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-circle hero-circle-3" />
          <div className="hero-circle hero-circle-4" />
          <div className="hero-circle hero-circle-5" />
          <div className="hero-circle hero-circle-6" />
          <div className="hero-circle hero-circle-7" />
          <div className="hero-circle hero-circle-8" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="badge-primary mb-4 sm:mb-6 animate-fade-in inline-flex mx-auto text-sm sm:text-base">
              <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
              <span>Trusted by 5,000+ aspiring consultants</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 animate-fade-in-up" style={{ color: 'var(--gn-rhino)' }}>
              Making your{' '}
              <TypingAnimation />{' '}
              dream possible
            </h1>

            {/* Subheadline - No box */}
            <div className="mb-6 sm:mb-8 animate-fade-in-up stagger-1 max-w-2xl mx-auto px-4 sm:px-0">
              <p className="text-lg sm:text-xl font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Elevate your consulting preparation
              </p>
              <p className="text-sm sm:text-base" style={{ color: 'var(--gn-grey-dark)' }}>
                Learn from McKinsey, BCG, and Bain consultants to set you on the path to success.
              </p>
            </div>

            {/* CTA Button - Centered */}
            <div className="flex justify-center animate-fade-in-up stagger-2 mb-6">
              <Button
                onClick={handleStartFreeTrial}
                disabled={loginLoading}
                size="lg"
                className="btn-primary px-8 py-6 text-lg"
              >
                {loginLoading ? 'Starting...' : 'Start Free Trial'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Rating Section */}
            <div className="flex flex-col items-center justify-center gap-1 animate-fade-in-up stagger-3 mb-8">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg 
                    key={star} 
                    className="w-5 h-5" 
                    fill="#FBBF24" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">4.9</span> out of 5 rating from <span className="font-semibold text-gray-800">2,000+</span> candidates
              </span>
            </div>

            {/* Offer logos — above the fold */}
            <div className="mt-6">
              <LogoStrip compact />
            </div>

          </div>
        </div>
      </section>


      {/* Dashboard Preview - Clean Pop-up Style */}
      <section className="relative z-20 mt-8 pb-0 hidden sm:block">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative animate-fade-in-up stagger-3">
            {/* Dashboard Preview - Clean Card Style (No Navigation) */}
            <div 
              className="relative rounded-2xl overflow-hidden mx-auto p-6"
              style={{ 
                border: '1px solid #e8ecff',
                background: 'white',
                maxWidth: '950px',
                boxShadow: '0 4px 20px rgba(46, 53, 88, 0.08)'
              }}
            >
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Your Dashboard</h3>
                  <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>Track your preparation progress</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}>
                    Pro Plan Active
                  </span>
                </div>
              </div>
              
              {/* Dashboard Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {/* Card 1 - Video Courses */}
                <div className="bg-gradient-to-br from-[#f8f9ff] to-white rounded-xl p-4" style={{ border: '1px solid #e8ecff' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--gn-periwinkle-lighter)' }}>
                    <Play className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                  </div>
                  <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Video Courses</h4>
                  <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>35+ hours</p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '45%', background: 'var(--gn-periwinkle)' }}></div>
                  </div>
                </div>
                
                {/* Card 2 - Case Drills */}
                <div className="bg-gradient-to-br from-[#f8f9ff] to-white rounded-xl p-4" style={{ border: '1px solid #e8ecff' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--gn-periwinkle-lighter)' }}>
                    <Target className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                  </div>
                  <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Case Drills</h4>
                  <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>780+ questions</p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '32%', background: 'var(--gn-chrome-yellow)' }}></div>
                  </div>
                </div>
                
                {/* Card 3 - Peer Practice */}
                <div className="bg-gradient-to-br from-[#f8f9ff] to-white rounded-xl p-4" style={{ border: '1px solid #e8ecff' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--gn-periwinkle-lighter)' }}>
                    <Users className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                  </div>
                  <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Peer Practice</h4>
                  <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>Mock interviews</p>
                  <div className="mt-2 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-[10px]" style={{ color: 'var(--gn-grey)' }}>12 online</span>
                  </div>
                </div>
                
                {/* Card 4 - Resources */}
                <div className="bg-gradient-to-br from-[#f8f9ff] to-white rounded-xl p-4" style={{ border: '1px solid #e8ecff' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--gn-periwinkle-lighter)' }}>
                    <BookOpen className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                  </div>
                  <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Resources</h4>
                  <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>100+ materials</p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '60%', background: 'var(--gn-rhino)' }}></div>
                  </div>
                </div>
              </div>
              
              {/* Recent Activity Row */}
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#f8f9ff', border: '1px solid #e8ecff' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>Completed: Profitability Framework</p>
                    <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>2 hours ago</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}>+50 XP</span>
              </div>
            </div>
            
            {/* Floating Stats Card - Left */}
            <div 
              className="absolute -bottom-6 left-4 md:left-8 bg-white rounded-xl p-4 shadow-lg animate-float hidden sm:block"
              style={{ border: '1px solid #e8ecff' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}
                >
                  <Target className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>60%</p>
                  <p className="text-xs text-slate-500">Success Rate</p>
                </div>
              </div>
            </div>
            
            {/* Floating Badge - Right */}
            <div 
              className="absolute -bottom-6 right-4 md:right-8 bg-white rounded-xl px-4 py-2 shadow-lg animate-float-delayed hidden sm:block"
              style={{ border: '1px solid #e8ecff' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>Active Community</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Logos Section - Our candidates received offers */}
      <section className="py-6 sm:py-12 mt-4 sm:mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile: Text above logos */}
          <div className="md:hidden text-center mb-4">
            <p className="text-xs font-medium text-gray-500">
              Our candidates have received offers from
            </p>
          </div>
          
          <div className="flex items-center gap-8 md:gap-12">
            {/* Desktop: Text on the left */}
            <div className="shrink-0 hidden md:block">
              <p className="text-sm font-medium text-gray-500 whitespace-nowrap border border-gray-200 rounded-lg px-4 py-3">
                Our candidates have received offers from
              </p>
            </div>
            
            {/* Scrolling logos container */}
            <div className="relative flex-1 overflow-hidden">
              {/* Gradient fade edges */}
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent z-10"></div>
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10"></div>
              
              {/* Scrolling container */}
              <div className="flex animate-scroll-logos-slow">
                {/* First set of logos */}
                <div className="flex items-center gap-16 md:gap-20 shrink-0 px-8">
                  {/* McKinsey */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/iey697kq_image.png" 
                      alt="McKinsey & Company" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* Bain */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/6kt0kjbt_image.png" 
                      alt="Bain & Company" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* BCG */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/qpzhjb32_image.png" 
                      alt="Boston Consulting Group" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* Kearney - 2x size */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/4blcvs2r_image.png" 
                      alt="Kearney" 
                      className="h-14 md:h-16 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* Strategy& */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/j5bobe8l_image.png" 
                      alt="Strategy&" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* EY Parthenon */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/fv6fonfo_image.png" 
                      alt="EY Parthenon" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                
                {/* Duplicate set for seamless loop */}
                <div className="flex items-center gap-16 md:gap-20 shrink-0 px-8">
                  {/* McKinsey */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/iey697kq_image.png" 
                      alt="McKinsey & Company" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* Bain */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/6kt0kjbt_image.png" 
                      alt="Bain & Company" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* BCG */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/qpzhjb32_image.png" 
                      alt="Boston Consulting Group" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* Kearney - 2x size */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/4blcvs2r_image.png" 
                      alt="Kearney" 
                      className="h-14 md:h-16 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* Strategy& */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/j5bobe8l_image.png" 
                      alt="Strategy&" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                  {/* EY Parthenon */}
                  <div className="flex items-center justify-center h-14 opacity-60 hover:opacity-100 transition-opacity logo-gray-tint">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/fv6fonfo_image.png" 
                      alt="EY Parthenon" 
                      className="h-7 md:h-8 object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
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
        `}</style>
      </section>

      {/* Subscription/Coaching Overview */}
      <section 
        className="section-padding relative overflow-hidden"
      >
        {/* Decorative gradient orbs - simplified for performance */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-96 h-96 rounded-full opacity-20"
            style={{ 
              background: 'radial-gradient(circle, var(--gn-periwinkle-light) 0%, transparent 70%)',
              top: '10%',
              left: '-10%',
              filter: 'blur(60px)'
            }}
          />
          <div 
            className="absolute w-80 h-80 rounded-full opacity-15"
            style={{ 
              background: 'radial-gradient(circle, var(--gn-periwinkle) 0%, transparent 70%)',
              bottom: '25%',
              right: '-8%',
              filter: 'blur(60px)'
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Toggle */}
          <div className="flex justify-center mb-8 sm:mb-12 px-2">
            <div 
              className="inline-flex items-center p-1 sm:p-1.5 rounded-full"
              style={{ 
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(200, 200, 200, 0.5)',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)'
              }}
            >
              <button
                onClick={() => setOverviewCategory('subscription')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  overviewCategory === 'subscription' 
                    ? 'text-white shadow-lg' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                style={{ 
                  backgroundColor: overviewCategory === 'subscription' ? 'var(--gn-rhino)' : 'transparent',
                  boxShadow: overviewCategory === 'subscription' ? '0 4px 12px rgba(46, 53, 88, 0.3)' : 'none'
                }}
              >
                Subscription
              </button>
              <button
                onClick={() => setOverviewCategory('coaching')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  overviewCategory === 'coaching' 
                    ? 'text-white shadow-lg' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                style={{ 
                  backgroundColor: overviewCategory === 'coaching' ? 'var(--gn-rhino)' : 'transparent',
                  boxShadow: overviewCategory === 'coaching' ? '0 4px 12px rgba(46, 53, 88, 0.3)' : 'none'
                }}
              >
                Coaching
              </button>
            </div>
          </div>

          {/* Main Glass Container */}
          <div 
            className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-12"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(220, 220, 220, 0.6)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <div>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--gn-periwinkle)' }}>
                  {overviewCategory === 'subscription' ? 'Subscription' : '1:1 Coaching'}
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 mb-4 sm:mb-6" style={{ color: 'var(--gn-rhino)' }}>
                  {overviewCategory === 'subscription' 
                    ? 'All-access pass to your consulting prep'
                    : 'Personalized mentorship from MBB consultants'
                  }
                </h2>
                <p className="text-base sm:text-lg mb-6 sm:mb-8" style={{ color: 'var(--gn-grey-dark)' }}>
                  {overviewCategory === 'subscription'
                    ? 'Get unlimited access to our complete library of resources, video courses, live workshops, and peer practice network.'
                    : 'Get dedicated support with personalized preparation plans, mock interviews, and strategy sessions with consultants from top firms.'
                  }
                </p>

                {/* Glass Feature boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-6 sm:mb-8">
                  {subscriptionIncludes.map((item) => {
                    // Check if this is a coaching-only feature
                    const isCoachingOnly = (item.title === 'Coaching Sessions' || item.title === 'Strategy Calls');
                    const shouldGrayOut = isCoachingOnly && overviewCategory === 'subscription';
                    
                    return (
                    <div 
                      key={item.title} 
                      className={`flex items-start gap-3 p-3 rounded-xl ${shouldGrayOut ? 'opacity-50' : ''}`}
                      style={{ 
                        background: shouldGrayOut ? 'rgba(200, 200, 200, 0.3)' : 'rgba(255, 255, 255, 0.8)',
                        border: shouldGrayOut ? '1px solid rgba(180, 180, 180, 0.4)' : '1px solid rgba(230, 230, 230, 0.6)',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
                      }}
                    >
                      {/* Glass icon box */}
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ 
                          background: shouldGrayOut 
                            ? 'linear-gradient(135deg, rgba(150, 150, 150, 0.3) 0%, rgba(180, 180, 180, 0.4) 100%)'
                            : 'linear-gradient(135deg, rgba(140, 157, 255, 0.3) 0%, rgba(177, 188, 255, 0.4) 100%)',
                          border: shouldGrayOut ? '1px solid rgba(150, 150, 150, 0.3)' : '1px solid rgba(140, 157, 255, 0.3)'
                        }}
                      >
                        {React.cloneElement(item.icon, { style: { color: shouldGrayOut ? 'var(--gn-grey)' : 'var(--gn-rhino)' } })}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold" style={{ color: shouldGrayOut ? 'var(--gn-grey)' : 'var(--gn-rhino)' }}>{item.title}</h4>
                            {shouldGrayOut && (
                              <span 
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{ 
                                  background: 'rgba(140, 157, 255, 0.2)', 
                                  color: 'var(--gn-periwinkle)',
                                  border: '1px solid rgba(140, 157, 255, 0.3)'
                                }}
                              >
                                Coaching Only
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>{item.desc}</p>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                  {overviewCategory === 'subscription' ? (
                    <>
                      <Button onClick={handleStartFreeTrial} disabled={loginLoading} className="btn-primary w-full sm:w-auto">
                        {loginLoading ? 'Starting...' : 'Start Free Trial'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link to="/coaching#coaching-hero" className="w-full sm:w-auto">
                        <Button className="btn-primary w-full">
                          Explore Coaching Plans
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Glass Pricing Card */}
              <div className="relative mt-8 lg:mt-0">
                <div 
                  className="absolute inset-0 rounded-2xl sm:rounded-3xl transform rotate-2 opacity-50 hidden sm:block"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(140, 157, 255, 0.3) 0%, rgba(177, 188, 255, 0.2) 100%)'
                  }} 
                />
                <div 
                  className="relative rounded-xl sm:rounded-2xl p-4 sm:p-8"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid rgba(220, 220, 220, 0.8)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
                  }}
                >
                {overviewCategory === 'subscription' ? (
                  <>
                    {/* Billing Cycle Toggle */}
                    <div className="flex justify-start mb-4">
                      <div 
                        className="inline-flex items-center p-1 rounded-full"
                        style={{ 
                          background: 'rgba(140, 157, 255, 0.15)',
                          border: '1px solid rgba(140, 157, 255, 0.2)'
                        }}
                      >
                        <button
                          onClick={() => setBillingCycle('monthly')}
                          className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
                          style={{ 
                            backgroundColor: billingCycle === 'monthly' ? 'white' : 'transparent',
                            color: billingCycle === 'monthly' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                            boxShadow: billingCycle === 'monthly' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none'
                          }}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setBillingCycle('6-month')}
                          className="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5"
                          style={{ 
                            backgroundColor: billingCycle === '6-month' ? 'white' : 'transparent',
                            color: billingCycle === '6-month' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                            boxShadow: billingCycle === '6-month' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none'
                          }}
                        >
                          6-Monthly
                          <span 
                            className="px-1.5 py-0.5 text-[9px] font-bold rounded-full"
                            style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
                          >
                            -20%
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-4 sm:mb-6">
                      <p className="text-sm" style={{ color: 'var(--gn-rhino)' }}>Starts from</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                          {currencySymbol}{dynamicPlans.filter(p => p.category === 'subscription' && p.name !== 'Free Trial').length > 0 
                            ? Math.min(...dynamicPlans.filter(p => p.category === 'subscription' && p.name !== 'Free Trial').map(p => billingCycle === '6-month' ? (p.pricing?.six_month || p.price) : (p.pricing?.one_month || p.pricing?.monthly || p.price))).toLocaleString()
                            : '399'}
                        </p>
                        <span className="text-sm" style={{ color: 'var(--gn-rhino)' }}>/month</span>
                      </div>
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      {plansLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--gn-rhino)' }} />
                        </div>
                      ) : dynamicPlans.filter(p => p.category === 'subscription' && p.name !== 'Free Trial').map((plan, index) => {
                        // Get the appropriate price based on billing cycle
                        // pricing.six_month is already the per-month price for 6-month billing
                        // pricing.one_month is the per-month price for monthly billing
                        const sixMonthPrice = plan.pricing?.six_month || plan.price;
                        const monthlyPrice = plan.pricing?.one_month || plan.pricing?.monthly || plan.price;
                        const displayPrice = billingCycle === '6-month' 
                          ? sixMonthPrice  // Already per-month price for 6-month plan
                          : monthlyPrice;
                        return (
                          <div
                            key={plan.id}
                            className="p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all cursor-pointer"
                            style={{
                              background: plan.highlight ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)',
                              border: plan.highlight ? '2px solid var(--gn-rhino)' : '1px solid rgba(140, 157, 255, 0.3)',
                              boxShadow: plan.highlight ? '0 4px 16px rgba(46, 53, 88, 0.15)' : '0 2px 8px rgba(140, 157, 255, 0.1)'
                            }}
                            onClick={() => scrollToPricingWithCategory('subscription')}
                            onMouseEnter={(e) => {
                              if (!plan.highlight) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(140, 157, 255, 0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!plan.highlight) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(140, 157, 255, 0.1)';
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div 
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ 
                                  background: plan.highlight 
                                    ? 'var(--gn-rhino)' 
                                    : 'linear-gradient(135deg, rgba(140, 157, 255, 0.3) 0%, rgba(177, 188, 255, 0.4) 100%)',
                                  border: plan.highlight ? 'none' : '1px solid rgba(140, 157, 255, 0.3)'
                                }}
                              >
                                {plan.highlight ? (
                                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                ) : index === 0 ? (
                                  <Award className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--gn-rhino)' }} />
                                ) : (
                                  <Zap className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--gn-rhino)' }} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm sm:text-base truncate" style={{ color: 'var(--gn-rhino)' }}>{plan.name}</h4>
                                <p className="text-xs hidden sm:block" style={{ color: 'var(--gn-grey)' }}>
                                  {billingCycle === '6-month' ? 'billed 6-monthly' : 'billed monthly'}
                                </p>
                              </div>
                              <div className="text-right flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                <div>
                                  <span className="text-sm sm:text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>{currencySymbol}{displayPrice.toLocaleString()}</span>
                                  <span className="text-xs" style={{ color: 'var(--gn-grey)' }}>/month</span>
                                </div>
                                <svg className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: 'var(--gn-rhino)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                            {plan.highlight && (
                              <span className="inline-block mt-2 px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: 'var(--gn-rhino)' }}>
                                {plan.badge || 'Most Popular'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button onClick={handleStartFreeTrial} className="w-full mt-6 btn-primary">
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="mb-4 sm:mb-6">
                      <p className="text-sm" style={{ color: 'var(--gn-rhino)' }}>Coaching Plans</p>
                      <div className="flex items-baseline gap-1">
                        {(() => {
                          // Find Last Mile plan for pricing display
                          const lastMilePlan = dynamicPlans.find(p => 
                            p.category === 'coaching' && 
                            p.name && 
                            (p.name.toLowerCase().includes('last mile') || p.plan_key === 'last_mile')
                          );
                          const displayPrice = lastMilePlan ? lastMilePlan.price : 9999;
                          
                          return (
                            <>
                              <p className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                                ₹{displayPrice.toLocaleString()}
                              </p>
                              <span className="text-sm" style={{ color: 'var(--gn-rhino)' }}> onwards</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      {plansLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--gn-rhino)' }} />
                        </div>
                      ) : dynamicPlans.filter(p => p.category === 'coaching' && p.is_visible !== false).length > 0 ? (
                        dynamicPlans.filter(p => p.category === 'coaching' && p.is_visible !== false).map((plan, index) => {
                          // Extract coaching sessions, strategy calls, and validity from plan
                          const coachingSessions = plan.features?.coaching_sessions || 0;
                          const strategyCalls = plan.features?.strategy_calls || 0;
                          const validityMonths = plan.duration_months || 0;
                          const isApplicationBased = plan.price === 0;
                          const isPinnacle = plan.name && plan.name.toLowerCase().includes('pinnacle');
                          
                          return (
                            <div
                              key={plan.id}
                              className="p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all cursor-pointer"
                              style={{
                                background: plan.highlight ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)',
                                border: plan.highlight ? '2px solid var(--gn-rhino)' : '1px solid rgba(140, 157, 255, 0.3)',
                                boxShadow: plan.highlight ? '0 4px 16px rgba(46, 53, 88, 0.15)' : '0 2px 8px rgba(140, 157, 255, 0.1)'
                              }}
                              onClick={() => scrollToPricingWithCategory('coaching')}
                              onMouseEnter={(e) => {
                                if (!plan.highlight) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(140, 157, 255, 0.2)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!plan.highlight) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(140, 157, 255, 0.1)';
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                                  style={{ 
                                    background: plan.highlight 
                                      ? 'var(--gn-rhino)' 
                                      : 'linear-gradient(135deg, rgba(140, 157, 255, 0.3) 0%, rgba(177, 188, 255, 0.4) 100%)',
                                    border: plan.highlight ? 'none' : '1px solid rgba(140, 157, 255, 0.3)'
                                  }}
                                >
                                  {plan.highlight ? (
                                    <Target className="w-5 h-5 text-white" />
                                  ) : (
                                    <UserCheck className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{plan.name}</h4>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  {isApplicationBased ? (
                                    <span className="text-xs font-semibold" style={{ color: 'var(--gn-grey-dark)' }}>
                                      Application-Based Program
                                    </span>
                                  ) : (
                                    <span className="text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>₹{plan.price.toLocaleString()}</span>
                                  )}
                                  <svg className="w-4 h-4" style={{ color: 'var(--gn-rhino)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                              {/* Subtext with validity, coaching sessions and strategy calls */}
                              <p className="text-xs ml-13" style={{ color: 'var(--gn-grey)' }}>
                                {isPinnacle && isApplicationBased ? (
                                  'Unlimited Coaching, Fixed plus Success-Based Fees'
                                ) : (
                                  <>
                                    {validityMonths > 0 && `Valid for ${validityMonths} month${validityMonths > 1 ? 's' : ''}`}
                                    {validityMonths > 0 && (coachingSessions > 0 || strategyCalls > 0) && ', '}
                                    {coachingSessions > 0 && `${coachingSessions} coaching session${coachingSessions > 1 ? 's' : ''}`}
                                    {coachingSessions > 0 && strategyCalls > 0 && ' & '}
                                    {strategyCalls > 0 && `${strategyCalls} 30-min strategy call${strategyCalls > 1 ? 's' : ''} with MBB consultants`}
                                    {!isPinnacle && validityMonths === 0 && coachingSessions === 0 && strategyCalls === 0 && 'Personalized coaching plan'}
                                  </>
                                )}
                              </p>
                              {plan.highlight && (
                                <span className="inline-block mt-2 px-2 py-1 rounded text-xs font-medium text-white" style={{ backgroundColor: 'var(--gn-rhino)' }}>
                                  {plan.badge || 'Most Popular'}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>No coaching plans available</p>
                        </div>
                      )}
                    </div>
                    <Link to="/coaching#coaching-hero">
                      <Button className="w-full mt-6 btn-primary">
                        View All Coaching Plans
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            <div className="text-center">
              <div className="stat-number text-2xl sm:text-3xl md:text-4xl">
                <AnimatedCounter value={statistics.community} duration={2000} />
              </div>
              <p className="text-xs sm:text-sm mt-1 sm:mt-2" style={{ color: 'var(--gn-grey-dark)' }}>Aspiring Consultants</p>
            </div>
            <div className="text-center">
              <div className="stat-number text-2xl sm:text-3xl md:text-4xl">
                <AnimatedCounter value={statistics.offerRate} duration={2000} />
              </div>
              <p className="text-xs sm:text-sm mt-1 sm:mt-2" style={{ color: 'var(--gn-grey-dark)' }}>Offer Rate</p>
              <OfferRateMethodology className="mt-1" />
            </div>
            <div className="text-center">
              <div className="stat-number text-2xl sm:text-3xl md:text-4xl">
                <AnimatedCounter value={statistics.countries} duration={2000} />
              </div>
              <p className="text-xs sm:text-sm mt-1 sm:mt-2" style={{ color: 'var(--gn-grey-dark)' }}>Countries</p>
            </div>
            <div className="text-center">
              <div className="stat-number text-2xl sm:text-3xl md:text-4xl">
                <AnimatedCounter value={statistics.mentors} duration={2000} />
              </div>
              <p className="text-xs sm:text-sm mt-1 sm:mt-2" style={{ color: 'var(--gn-grey-dark)' }}>MBB Mentors</p>
            </div>
          </div>
        </div>
      </section>

      {/* Compare All Features Section */}
      {/* Book Single Session - top-rated mentor cards before pricing */}
      <Suspense fallback={<div className="py-16" />}>
        <BookSingleSessionSection variant="landing" />
      </Suspense>

      {/* Pricing Plans Section */}
      <section 
        id="pricing" 
        className="section-padding"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <span 
              className="text-sm font-semibold uppercase tracking-wider" 
              style={{ color: 'var(--gn-periwinkle)' }}
            >
              Pricing
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-3 mb-4" style={{ color: 'var(--gn-rhino)' }}>
              Choose Your Plan
            </h2>
            <p className="text-sm sm:text-base max-w-2xl mx-auto px-4 sm:px-0" style={{ color: 'var(--gn-grey-dark)' }}>
              Select the perfect plan for your consulting preparation journey
            </p>
          </div>

          {/* Main Category Toggle - Subscription / Coaching - Matching style from overview section */}
          <div className="flex justify-center mb-6 px-4 sm:px-0">
            <div 
              className="inline-flex items-center p-1 sm:p-1.5 rounded-full"
              style={{ 
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(200, 200, 200, 0.5)',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)'
              }}
            >
              <button
                onClick={() => setPlanCategory('subscription')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  planCategory === 'subscription' 
                    ? 'text-white shadow-lg' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                style={{ 
                  backgroundColor: planCategory === 'subscription' ? 'var(--gn-rhino)' : 'transparent',
                  boxShadow: planCategory === 'subscription' ? '0 4px 12px rgba(46, 53, 88, 0.3)' : 'none'
                }}
              >
                Subscription
              </button>
              <button
                onClick={() => setPlanCategory('coaching')}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  planCategory === 'coaching' 
                    ? 'text-white shadow-lg' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                style={{ 
                  backgroundColor: planCategory === 'coaching' ? 'var(--gn-rhino)' : 'transparent',
                  boxShadow: planCategory === 'coaching' ? '0 4px 12px rgba(46, 53, 88, 0.3)' : 'none'
                }}
              >
                Coaching
              </button>
            </div>
          </div>

          {/* Billing Cycle Toggle - Only for Subscription */}
          {planCategory === 'subscription' && (
            <div className="flex justify-center mb-10">
              <div 
                className="inline-flex items-center p-1 rounded-full"
                style={{ 
                  background: 'rgba(140, 157, 255, 0.1)',
                  border: '1px solid rgba(140, 157, 255, 0.15)'
                }}
              >
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{ 
                    backgroundColor: billingCycle === 'monthly' ? 'white' : 'transparent',
                    color: billingCycle === 'monthly' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                    boxShadow: billingCycle === 'monthly' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none'
                  }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('6-month')}
                  className="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5"
                  style={{ 
                    backgroundColor: billingCycle === '6-month' ? 'white' : 'transparent',
                    color: billingCycle === '6-month' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                    boxShadow: billingCycle === '6-month' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none'
                  }}
                >
                  6-Monthly
                  <span 
                    className="px-1.5 py-0.5 text-[9px] font-bold rounded-full"
                    style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
                  >
                    {isPromoActive() ? `SAVE ${PROMO_SIX_MONTH_TOTAL_SAVING_PCT}%` : 'SAVE 20%'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Plan Cards */}
          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gn-rhino)' }} />
            </div>
          ) : (
            <>
              {/* Highlighted card border styles - removed, using inline styles */}

              {/* Subscription Plans - 3 cards */}
              {planCategory === 'subscription' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto px-2 sm:px-0">
                  {dynamicPlans
                    .filter(p => p.category === 'subscription' && p.name !== 'Free Trial')
                    .slice(0, 3)
                    .map((plan, index) => {
                      // Get pricing from admin panel
                      // pricing.six_month is already the per-month price for 6-month billing
                      // pricing.one_month is the per-month price for monthly billing
                      const displayPrice = billingCycle === '6-month' 
                        ? (plan.pricing?.six_month || plan.price) 
                        : (plan.pricing?.one_month || plan.pricing?.monthly || plan.price);

                      // 30% off campaign — 6-month subscription plans only.
                      const isPromoEligible = (
                        billingCycle === '6-month' &&
                        isPromoActive() &&
                        displayPrice > 0 &&
                        !plan.pricing?.one_time
                      );
                      const promoPrice = isPromoEligible
                        ? Math.round(displayPrice * (1 - PROMO_PERCENT / 100))
                        : displayPrice;
                      
                      const cardContent = (
                        <div className="relative h-full">
                          {/* Popular Badge - outside overflow container */}
                          {plan.highlight && (
                            <div 
                              className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold z-20"
                              style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
                            >
                              MOST POPULAR
                            </div>
                          )}

                          {/* SAVE 30% ribbon when 6-month promo active */}
                          {isPromoEligible && (
                            <div className="absolute -top-3 -right-3 z-20 rotate-3">
                              <div
                                className="px-3 py-1.5 rounded-lg text-xs font-extrabold shadow-lg flex items-center gap-1"
                                style={{
                                  background: 'linear-gradient(135deg, var(--gn-chrome-yellow) 0%, #FF8A00 100%)',
                                  color: 'var(--gn-rhino)',
                                }}
                              >
                                <Tag className="w-3.5 h-3.5" /> SAVE {PROMO_PERCENT}%
                              </div>
                            </div>
                          )}
                          
                          <div 
                            className="relative transition-all hover:shadow-xl hover:-translate-y-1 h-full rounded-2xl overflow-hidden"
                            style={{
                              background: plan.highlight 
                                ? 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)'
                                : 'white',
                              border: plan.highlight ? 'none' : '1px solid #e5e7eb',
                              boxShadow: plan.highlight 
                                ? '0 8px 32px rgba(46, 53, 88, 0.25)' 
                                : '0 2px 12px rgba(0, 0, 0, 0.06)'
                            }}
                          >
                            {/* Decorative circles for highlighted card */}
                            {plan.highlight && (
                              <>
                                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15" style={{ background: 'var(--gn-periwinkle)' }}></div>
                                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'var(--gn-periwinkle-light)' }}></div>
                              </>
                            )}

                            {/* In-card promo strip */}
                            {isPromoEligible && (
                              <div
                                className="relative z-10 flex items-center gap-2 px-5 py-2 text-xs font-semibold"
                                style={{
                                  background: plan.highlight ? 'rgba(255,166,1,0.18)' : '#FFF6E0',
                                  color: plan.highlight ? '#FFD68A' : '#9A6B00',
                                  borderBottom: plan.highlight
                                    ? '1px solid rgba(255,255,255,0.1)'
                                    : '1px solid #FFE6B7',
                                }}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                {PROMO_PERCENT}% off · Auto-applied at checkout
                              </div>
                            )}
                          
                          <div className="p-8 relative z-10">
                            {/* Plan Name */}
                            <h3 
                              className="text-xl font-semibold mb-4"
                              style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                            >
                              {plan.name}
                            </h3>
                            
                            {/* Price Section */}
                            <div className="mb-4">
                              <p className="text-sm mb-1" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--gn-grey)' }}>Starts at</p>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                {isPromoEligible && (
                                  <span
                                    className="text-lg line-through"
                                    style={{ color: plan.highlight ? 'rgba(255,255,255,0.55)' : '#9CA3AF' }}
                                  >
                                    {currencySymbol}{displayPrice?.toLocaleString()}
                                  </span>
                                )}
                                <span 
                                  className="text-4xl font-bold"
                                  style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                                >
                                  {currencySymbol}{promoPrice?.toLocaleString()}
                                </span>
                                <span className="text-base" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--gn-grey)' }}>
                                  per month
                                </span>
                              </div>
                              {isPromoEligible && (
                                <p
                                  className="text-xs mt-1 font-medium flex items-center gap-1"
                                  style={{ color: plan.highlight ? '#FFD68A' : '#9A6B00' }}
                                >
                                  <Clock className="w-3 h-3" /> You save {currencySymbol}{(displayPrice - promoPrice)?.toLocaleString()}/mo · ends {formatPromoEndDate()}
                                </p>
                              )}
                            </div>
                            
                            {/* CTA Button */}
                            <button
                              onClick={() => handlePlanClick({...plan, billingCycle})}
                              className="w-full py-2.5 rounded-lg font-medium transition-all text-sm"
                              style={{ 
                                backgroundColor: plan.highlight ? 'var(--gn-chrome-yellow)' : 'var(--gn-rhino)',
                                color: plan.highlight ? 'var(--gn-rhino)' : 'white',
                                border: 'none'
                              }}
                              onMouseEnter={(e) => {
                                if (!plan.highlight) {
                                  e.currentTarget.style.backgroundColor = 'var(--gn-rhino-light)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!plan.highlight) {
                                  e.currentTarget.style.backgroundColor = 'var(--gn-rhino)';
                                }
                              }}
                            >
                              Get Started
                            </button>
                            
                            {/* Separator */}
                            <div 
                              className="my-6 h-px"
                              style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(140, 157, 255, 0.15)' }}
                            />
                            
                            {/* Features Label */}
                            <p 
                              className="font-semibold mb-4 text-sm"
                              style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                            >
                              {index === 0 ? "What's included:" : `${dynamicPlans.filter(p => p.category === 'subscription' && p.name !== 'Free Trial')[index - 1]?.name || 'Basic'} features, plus:`}
                            </p>
                            
                            {/* Features List from Admin Panel */}
                            <ul className="space-y-3">
                              {(() => {
                                const features = plan.features || {};
                                const displayFeatures = plan.display_features || [];
                                const featuresList = [];
                                
                                // Build from features object dynamically first
                                
                                // Course Recordings (check both boolean and undefined)
                                if (features.course_recordings !== false) {
                                  featuresList.push('Course Recordings');
                                }
                                
                                // Case Drills - Calculate total questions (drills * 10 questions per drill)
                                if (features.drills_exercises !== false) {
                                  const drillCountData = drillCounts?.counts || {};
                                  let drillCount = 0;
                                  
                                  // Map plan to drill tier
                                  if (plan.plan_key === 'free_trial') {
                                    drillCount = drillCountData.free_trial?.total || 9;
                                  } else if (plan.plan_key === 'basic_plan') {
                                    drillCount = drillCountData.basic_plan?.total || 18;
                                  } else {
                                    // Pro, Pro+, and coaching plans get full access
                                    drillCount = drillCountData.full_access?.total || 74;
                                  }
                                  
                                  // Calculate total questions (each drill has ~10 questions)
                                  const totalQuestions = drillCount * 10;
                                  featuresList.push(`${totalQuestions}+ Case Drill Questions`);
                                }
                                
                                // Case Materials
                                if (features.case_materials !== false) {
                                  if (features.case_materials_limited) {
                                    featuresList.push('Limited Case Materials');
                                  } else {
                                    featuresList.push('Case Study Materials');
                                  }
                                }
                                
                                // Workshops
                                if (features.workshops && features.workshops !== 'none') {
                                  if (features.workshops === 'only_recorded') {
                                    featuresList.push(features.workshops_limited ? 'Limited Recorded Workshops' : 'Recorded Workshops');
                                  } else if (features.workshops === 'recorded_and_live') {
                                    featuresList.push(features.workshops_limited ? 'Limited Live Workshops' : 'Live & Recorded Workshops');
                                  }
                                }
                                
                                // Peer Practice Sessions
                                if (features.peer_sessions_per_month !== undefined && features.peer_sessions_per_month !== null && features.peer_sessions_per_month !== 0) {
                                  if (features.peer_sessions_per_month === -1) {
                                    featuresList.push('Unlimited Peer Practice');
                                  } else {
                                    featuresList.push(`${features.peer_sessions_per_month} Peer Practice Sessions/mo`);
                                  }
                                }
                                
                                // Strategy Calls
                                if (features.strategy_calls && features.strategy_calls !== 0) {
                                  if (features.strategy_calls === -1) {
                                    featuresList.push('Unlimited Strategy Calls');
                                  } else {
                                    featuresList.push(`${features.strategy_calls} Strategy ${features.strategy_calls === 1 ? 'Call' : 'Calls'}`);
                                  }
                                }
                                
                                // Coaching Sessions
                                if (features.coaching_sessions && features.coaching_sessions !== 0) {
                                  if (features.coaching_sessions === -1) {
                                    featuresList.push('Unlimited 1-on-1 Coaching');
                                  } else {
                                    featuresList.push(`${features.coaching_sessions} 1-on-1 Coaching Sessions`);
                                  }
                                }
                                
                                // Add display_features at the END (custom features from admin)
                                if (displayFeatures.length > 0) {
                                  featuresList.push(...displayFeatures);
                                }
                                
                                // Fallback if no features
                                if (featuresList.length === 0) {
                                  featuresList.push(
                                    'Access to video courses',
                                    'Case drills & exercises',
                                    'Community access'
                                  );
                                }
                                
                                return featuresList.slice(0, 10).map((feature, idx) => (
                                  <li key={idx} className="flex items-start gap-3">
                                    <CheckCircle2 
                                      className="w-5 h-5 flex-shrink-0 mt-0.5" 
                                      style={{ color: plan.highlight ? 'var(--gn-chrome-yellow)' : 'var(--gn-periwinkle)' }} 
                                    />
                                    <span 
                                      className="text-sm"
                                      style={{ color: plan.highlight ? 'rgba(255,255,255,0.9)' : 'var(--gn-grey-dark)' }}
                                    >
                                      {feature}
                                    </span>
                                  </li>
                                ));
                              })()}
                            </ul>
                          </div>
                        </div>
                      </div>
                      );
                      
                      return <div key={plan.id} className={plan.highlight ? 'pt-3' : ''}>{cardContent}</div>;
                    })}
                </div>
              )}

              {/* Coaching Plans - 4 cards - Larger size */}
              {planCategory === 'coaching' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-2 sm:px-0">
                  {dynamicPlans
                    .filter(p => p.category === 'coaching')
                    .slice(0, 4)
                    .map((plan, index) => {
                      const isPinnacle = plan.name === 'Pinnacle';
                      const features = plan.features || {};
                      const displayFeatures = plan.display_features || [];
                      
                      // Build features list from admin panel data
                      const featuresList = [];
                      
                      // Build dynamic features first
                      // Coaching Sessions
                      if (features.coaching_sessions) {
                        if (features.coaching_sessions === -1) {
                          featuresList.push('Unlimited 1-on-1 Coaching Sessions');
                        } else if (features.coaching_sessions > 0) {
                          featuresList.push(`${features.coaching_sessions} 1-on-1 Coaching Sessions`);
                        }
                      }
                      
                      // Strategy Calls
                      if (features.strategy_calls) {
                        if (features.strategy_calls === -1) {
                          featuresList.push('Unlimited Strategy Calls');
                        } else if (features.strategy_calls > 0) {
                          featuresList.push(`${features.strategy_calls} Strategy Calls`);
                        }
                      }
                      
                      // Course Recordings from coaching plan itself
                      if (features.course_recordings !== false) {
                        if (features.course_recordings_limited) {
                          featuresList.push('Limited Course Access');
                        } else {
                          featuresList.push('30+ hours of course access');
                        }
                      }
                      
                      // Case Drills from coaching plan itself
                      if (features.drills_exercises !== false) {
                        const drillCountData = drillCounts?.counts || {};
                        const drillCount = drillCountData.full_access?.total || 74;
                        const totalQuestions = drillCount * 10;
                        featuresList.push(`${totalQuestions}+ Case Drill Questions`);
                      }
                      
                      // Workshops from coaching plan itself
                      if (features.workshops === 'recorded_and_live') {
                        featuresList.push('Live & Recorded Workshops');
                      } else if (features.workshops === 'only_recorded') {
                        featuresList.push('Recorded Workshops');
                      }
                      
                      // Peer Practice from coaching plan itself
                      if (features.peer_sessions_per_month) {
                        if (features.peer_sessions_per_month === -1) {
                          featuresList.push('Unlimited Peer Practice');
                        } else if (features.peer_sessions_per_month > 0) {
                          featuresList.push(`${features.peer_sessions_per_month} Peer Practice Sessions/month`);
                        }
                      }
                      
                      // Case Materials from coaching plan itself
                      if (features.case_materials !== false) {
                        if (features.case_materials_limited) {
                          featuresList.push('Limited Case Materials');
                        } else {
                          featuresList.push('Full Case Materials Access');
                        }
                      }
                      
                      // Add display_features at the END (custom features from admin)
                      if (displayFeatures.length > 0) {
                        featuresList.push(...displayFeatures);
                      }
                      
                      // Fallback if no features from admin
                      if (featuresList.length === 0) {
                        featuresList.push(...(plan.features_list || [
                          '1-on-1 with MBB consultant',
                          'Personalized feedback',
                          'Mock interviews',
                          'Strategy sessions',
                          'All Pro+ features included'
                        ]));
                      }
                      
                      const cardContent = (
                        <div className="relative h-full">
                          {/* Popular Badge - outside overflow container */}
                          {plan.highlight && (
                            <div 
                              className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap z-20"
                              style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
                            >
                              MOST POPULAR
                            </div>
                          )}
                          
                          <div 
                            className="relative transition-all hover:shadow-xl hover:-translate-y-1 h-full rounded-2xl overflow-hidden"
                            style={{
                              background: plan.highlight 
                                ? 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)'
                                : 'white',
                              border: plan.highlight ? 'none' : '1px solid #e5e7eb',
                              boxShadow: plan.highlight 
                                ? '0 8px 32px rgba(46, 53, 88, 0.25)' 
                                : '0 2px 12px rgba(0, 0, 0, 0.06)'
                            }}
                          >
                            {/* Decorative circles for highlighted card */}
                            {plan.highlight && (
                              <>
                                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15" style={{ background: 'var(--gn-periwinkle)' }}></div>
                                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'var(--gn-periwinkle-light)' }}></div>
                              </>
                            )}
                          
                          <div className="p-8 relative z-10">
                            {/* Plan Name */}
                            <h3 
                              className="text-xl font-semibold mb-4"
                              style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                            >
                              {plan.name}
                            </h3>
                            
                            {/* Price Section */}
                            <div className="mb-4">
                              <p className="text-sm mb-1" style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--gn-grey)' }}>Starts at</p>
                              <div className="flex items-baseline gap-1">
                                <span 
                                  className="text-4xl font-bold"
                                  style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                                >
                                  {isPinnacle ? 'Custom' : `${currencySymbol}${(plan.price || 0).toLocaleString()}`}
                                </span>
                              </div>
                            </div>
                            
                            {/* Description */}
                            <p 
                              className="text-sm mb-6 leading-relaxed"
                              style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : 'var(--gn-grey-dark)' }}
                            >
                              {plan.description || 'Personalized coaching for serious candidates.'}
                            </p>
                            
                            {/* CTA Button */}
                            <button
                              onClick={() => handlePlanClick(plan)}
                              className="w-full py-2.5 rounded-lg font-medium transition-all text-sm"
                              style={{ 
                                backgroundColor: plan.highlight ? 'var(--gn-chrome-yellow)' : 'var(--gn-rhino)',
                                color: plan.highlight ? 'var(--gn-rhino)' : 'white',
                                border: 'none'
                              }}
                              onMouseEnter={(e) => {
                                if (!plan.highlight) {
                                  e.currentTarget.style.backgroundColor = 'var(--gn-rhino-light)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!plan.highlight) {
                                  e.currentTarget.style.backgroundColor = 'var(--gn-rhino)';
                                }
                              }}
                            >
                              {isPinnacle ? 'Apply Now' : 'Enroll Now'}
                            </button>
                            
                            {/* Separator */}
                            <div 
                              className="my-6 h-px"
                              style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(140, 157, 255, 0.15)' }}
                            />
                            
                            {/* Features Label */}
                            <p 
                              className="font-semibold mb-4 text-sm"
                              style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                            >
                              What's included:
                            </p>
                            
                            {/* Features List from Admin Panel + Pro Plus */}
                            <ul className="space-y-3">
                              {featuresList.slice(0, 9).map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                  <CheckCircle2 
                                    className="w-5 h-5 flex-shrink-0 mt-0.5" 
                                    style={{ color: plan.highlight ? 'var(--gn-chrome-yellow)' : 'var(--gn-periwinkle)' }} 
                                  />
                                  <span 
                                    className="text-sm"
                                    style={{ color: plan.highlight ? 'rgba(255,255,255,0.9)' : 'var(--gn-grey-dark)' }}
                                  >
                                    {feature}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                      );
                      
                      return <div key={plan.id} className={plan.highlight ? 'pt-3' : ''}>{cardContent}</div>;
                    })}
                </div>
              )}
            </>
          )}

          {/* Free Trial CTA */}
          <p className="text-center mt-12 text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
            Start a{' '}
            <button
              onClick={handleStartFreeTrial}
              className="font-semibold transition-all hover:opacity-80"
              style={{ color: 'var(--gn-periwinkle)' }}
            >
              free trial
            </button>
            {' '}now. No credit card required.
          </p>
        </div>
      </section>

      {/* Discovery Call Section */}
      <section 
        className="py-16"
      >
        <div className="text-center max-w-4xl mx-auto px-4">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3" style={{ color: 'var(--gn-rhino)' }}>
            Still unsure which plan suits your needs the best?
          </h3>
          <p className="text-base md:text-lg mb-6" style={{ color: 'var(--gn-grey-dark)' }}>
            Talk to our team to get personalized guidance
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button 
              onClick={() => setShowDiscoveryCallModal(true)}
              size="lg"
              className="btn-primary px-8 py-4 text-base md:text-lg font-semibold rounded-xl transition-all hover:scale-[1.03]"
            >
              Book a Free Discovery Call
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <div className="flex items-center gap-4 text-sm md:text-base font-medium" style={{ color: 'var(--gn-grey-dark)' }}>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--gn-rhino)' }} />
                Free
              </span>
              <span style={{ color: 'var(--gn-grey)' }}>•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--gn-rhino)' }} />
                15 min
              </span>
              <span style={{ color: 'var(--gn-grey)' }}>•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" style={{ color: 'var(--gn-rhino)' }} />
                No obligation
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Dynamic from Admin */}
      <Suspense fallback={<div className="py-24" />}>
        <TestimonialsCarousel 
          page="home" 
          title="Trusted by aspiring consultants worldwide"
          subtitle="Join the club who have trusted us and started their journey"
        />
      </Suspense>

      {/* FAQ Section */}
      <section 
        className="section-padding relative overflow-hidden" 
      >
        {/* Decorative gradient orbs for glass effect backdrop */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
            style={{ 
              background: 'radial-gradient(circle, var(--gn-periwinkle-light) 0%, transparent 70%)',
              top: '5%',
              right: '-10%'
            }}
          />
          <div 
            className="absolute w-80 h-80 rounded-full opacity-25 blur-3xl"
            style={{ 
              background: 'radial-gradient(circle, var(--gn-periwinkle) 0%, transparent 70%)',
              bottom: '10%',
              left: '-8%'
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Two column layout - Header on left, Accordion on right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left side - Header */}
            <div className="lg:col-span-4 lg:sticky lg:top-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>
                Frequently Asked Questions
              </h2>
              <p className="text-base" style={{ color: 'var(--gn-grey-dark)' }}>
                Everything you need to know about gradnext. Can't find an answer? 
                <button 
                  onClick={() => setShowContactFormModal(true)}
                  className="text-base font-medium ml-1 hover:underline"
                  style={{ color: 'var(--gn-periwinkle)' }}
                >
                  Contact us
                </button>
              </p>
            </div>

            {/* Right side - Accordion */}
            <div className="lg:col-span-8">
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.general.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="rounded-xl px-6 border-none overflow-hidden"
                    style={{ 
                      background: 'var(--gn-rhino)',
                      boxShadow: '0 4px 16px rgba(46, 53, 88, 0.15)'
                    }}
                  >
                    <AccordionTrigger 
                      className="text-left font-semibold hover:no-underline py-5 text-white"
                    >
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent 
                      className="pb-5" 
                      style={{ color: 'var(--gn-periwinkle-light)' }}
                    >
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Modal - Only render when open to avoid Razorpay SDK issues */}
      {showPaymentModal && (
        <Suspense fallback={null}>
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedPlan(null);
            }}
            plan={selectedPlan}
            user={currentUser}
            onSuccess={handlePaymentSuccess}
            billingCycle={billingCycle}
          />
        </Suspense>
      )}
      
      {/* Feature Detail Modal */}
      {selectedFeature && (
        <FeatureDetailModal 
          feature={selectedFeature} 
          onClose={() => setSelectedFeature(null)}
          navigate={navigate}
        />
      )}
      
      {/* Login/Signup Modal — render only when open so the heavy
          LoginModal chunk (Google auth + email/password forms) is
          fetched lazily on first click, not at page load. */}
      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onSuccess={handleLoginSuccess}
            skipNavigation={!!selectedPlan}
          />
        </Suspense>
      )}
      
      {/* Discovery Call Modal */}
      {showDiscoveryCallModal && (
        <Suspense fallback={null}>
          <DiscoveryCallModal
            isOpen={showDiscoveryCallModal}
            onClose={() => setShowDiscoveryCallModal(false)}
          />
        </Suspense>
      )}
      
      {/* Contact Form Modal */}
      {showContactFormModal && (
        <Suspense fallback={null}>
          <ContactFormModal
            isOpen={showContactFormModal}
            onClose={() => setShowContactFormModal(false)}
          />
        </Suspense>
      )}
      
      {/* Pinnacle Application Modal */}
      {showPinnacleModal && (
        <Suspense fallback={null}>
          <PinnacleApplicationModal
            isOpen={showPinnacleModal}
            onClose={() => setShowPinnacleModal(false)}
            onSuccess={() => {
              console.log('Pinnacle application submitted');
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Home;
