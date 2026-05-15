import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { fetchCurrentUser } from '../utils/authCache';
// Premium Phosphor icons (duotone style)
import {
  Target as PhTarget,
  CalendarCheck as PhCalendar,
  Trophy as PhTrophy,
  ChartLineUp as PhChartLine,
  ChatTeardropDots as PhChat,
  Shield as PhShield,
  WhatsappLogo as PhWhatsapp,
  UserCircleGear as PhUserGear,
  TrendUp as PhTrendUp,
  Clock as PhClock,
  CheckCircle as PhCheck,
  Sparkle as PhSparkle
} from '@phosphor-icons/react';
import { Button } from '../components/ui/button';
import { faqs, statistics } from '../data/mock';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import LoginModal from '../components/LoginModal';
import PaymentModal from '../components/PaymentModal';
import TestimonialsCarousel from '../components/TestimonialsCarousel';
import ContactFormModal from '../components/ContactFormModal';
import DiscoveryCallModal from '../components/DiscoveryCallModal';
import PinnacleApplicationModal from '../components/PinnacleApplicationModal';
import ScholarshipApplicationModal from '../components/ScholarshipApplicationModal';
import LogoStrip from '../components/LogoStrip';
import OfferRateMethodology from '../components/OfferRateMethodology';
import BookSingleSessionSection from '../components/BookSingleSessionSection';
import { generatePlanFeatureList } from '../utils/planFeatures';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Typing animation component
const TypingAnimation = () => {
  const words = ['Consulting', 'McKinsey', 'BCG', 'Bain'];
  const [currentWordIndex, setCurrentWordIndex] = React.useState(0);
  const [displayText, setDisplayText] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const typeSpeed = 120;
  const deleteSpeed = 80;
  const pauseTime = 2000;
  
  const tick = React.useCallback(() => {
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
  
  React.useEffect(() => {
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

const Coaching = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [coachingPlans, setCoachingPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showContactFormModal, setShowContactFormModal] = useState(false);
  const [showDiscoveryCallModal, setShowDiscoveryCallModal] = useState(false);
  const [showPinnacleModal, setShowPinnacleModal] = useState(false);
  const [showScholarshipModal, setShowScholarshipModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Handle hash navigation - scroll to element when URL has hash
  useEffect(() => {
    if (location.hash) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(location.hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // If no hash, scroll to top
      window.scrollTo(0, 0);
    }
  }, [location.hash]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        // Fetch all plans without page filter, then filter client-side for coaching plans
        const res = await fetch(`${BACKEND_URL}/api/resources/plans`);
        if (res.ok) {
          const data = await res.json();
          // Filter for coaching category plans and sort by predefined order
          const planOrder = ['last_mile', 'mid_mile', 'full_prep', 'pinnacle'];
          const coachingPlansData = (data.plans || [])
            .filter(p => p.category === 'coaching')
            .sort((a, b) => {
              const aIndex = planOrder.indexOf(a.plan_key);
              const bIndex = planOrder.indexOf(b.plan_key);
              return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            });
          setCoachingPlans(coachingPlansData);
        }
      } catch (error) {
        console.error('Failed to fetch coaching plans:', error);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
    
    // Check if user is already logged in
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await fetchCurrentUser();
      if (data) {
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const handleEnrollClick = (plan) => {
    setSelectedPlan(plan);
    
    // For Pinnacle program, open the application modal instead of payment
    if (plan.name === 'Pinnacle' || plan.plan_key === 'pinnacle') {
      setShowPinnacleModal(true);
      return;
    }
    
    if (currentUser) {
      // User is logged in, show payment modal directly
      setShowPaymentModal(true);
    } else {
      // User needs to login first
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setShowLoginModal(false);
    // After login, show payment modal
    if (selectedPlan) {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
    // Redirect to dashboard after successful payment
    navigate('/dashboard');
  };

  const handleBookDiscoveryCall = () => {
    // Open login modal, after login redirect to contact/booking
    setShowLoginModal(true);
  };


  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero Section */}
      <section id="coaching-hero" className="hero-section pt-24 sm:pt-36 pb-12 sm:pb-20 overflow-hidden relative">
        {/* Concentric Circles Background - Same as Home/Subscription */}
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
            <div className="badge-primary mb-4 sm:mb-8 animate-fade-in inline-flex mx-auto text-sm">
              <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
              <span>1:1 Coaching Programs</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-8 animate-fade-in-up px-2" style={{ color: 'var(--gn-rhino)', lineHeight: '1.1' }}>
              <TypingAnimation /> coaching from MBB consultants
            </h1>

            <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 max-w-3xl mx-auto animate-fade-in-up stagger-1 px-4" style={{ color: 'var(--gn-grey-dark)' }}>
              Get tailored 1:1 preparation with personalized plans, flexible scheduling, and dedicated support throughout your consulting interview journey.
            </p>

            <div className="animate-fade-in-up stagger-2">
              <Button
                onClick={() => setShowDiscoveryCallModal(true)}
                size="lg"
                className="btn-primary px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg"
              >
                Book Free Discovery Call
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Rating Section */}
            <div className="flex flex-col items-center justify-center gap-1 animate-fade-in-up stagger-3 mt-8">
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

      {/* Stats */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="stat-number">{statistics.offerRate}</div>
              <p className="body-sm mt-2">Offer Rate</p>
              <OfferRateMethodology className="mt-1" />
            </div>
            <div className="text-center">
              <div className="stat-number">{statistics.mentors}</div>
              <p className="body-sm mt-2">MBB Mentors</p>
            </div>
            <div className="text-center">
              <div className="stat-number">{statistics.sessionsDelivered}</div>
              <p className="body-sm mt-2">Sessions Delivered</p>
            </div>
            <div className="text-center">
              <div className="stat-number">{statistics.countries}</div>
              <p className="body-sm mt-2">Countries</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose 1:1 Coaching - Bento Grid with Stats */}
      <section className="section-padding">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Why choose 1:1 Coaching?</h2>
            <p>Get personalized attention and expert guidance tailored to your specific needs</p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[180px]">
            
            {/* Card 1: Dedicated Coach - Large Featured Card (spans 2 cols, 2 rows) */}
            <div 
              className="md:col-span-2 md:row-span-2 group cursor-pointer"
            >
              <div 
                className="relative h-full rounded-2xl p-6 transition-all duration-500 hover:translate-y-[-4px] overflow-hidden"
                style={{ 
                  background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.25)'
                }}
              >
                {/* Decorative circles */}
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15" style={{ background: 'var(--gn-periwinkle)' }}></div>
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'var(--gn-periwinkle-light)' }}></div>
                
                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(140, 157, 255, 0.25)' }}>
                      <PhUserGear className="w-7 h-7 text-white" weight="duotone" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">Personal Mentorship</span>
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-3xl md:text-4xl font-bold text-white mb-3">Dedicated MBB Coach</h3>
                    <p className="text-white/80 text-base leading-relaxed mb-4">
                      Get matched with an experienced consultant who guides you through every step of your preparation journey.
                    </p>
                  </div>
                  
                  {/* WhatsApp Support Badge */}
                  <div 
                    className="flex items-center gap-3 p-3 rounded-xl mt-auto"
                    style={{ backgroundColor: 'rgba(140, 157, 255, 0.2)' }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 166, 1, 0.25)' }}>
                      <PhWhatsapp className="w-5 h-5 text-white" weight="duotone" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">WhatsApp Support</p>
                      <p className="text-white/70 text-xs">Direct access to your coach anytime</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: MBB Consultants */}
            <div className="group cursor-pointer">
              <div 
                className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(140, 157, 255, 0.2)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)'
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle) 0%, var(--gn-rhino-light) 100%)' }}>
                  <PhTrophy className="w-6 h-6 text-white" weight="duotone" />
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--gn-rhino)' }}>50+</div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>MBB Mentors</h3>
                <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Current & former consultants from top firms</p>
              </div>
            </div>

            {/* Card 3: Sessions Delivered */}
            <div className="group cursor-pointer">
              <div 
                className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(140, 157, 255, 0.2)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)'
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, var(--gn-rhino-light) 0%, var(--gn-rhino-medium) 100%)' }}>
                  <PhChat className="w-6 h-6 text-white" weight="duotone" />
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--gn-rhino)' }}>5,000+</div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Sessions Delivered</h3>
                <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Mock interviews & strategy calls</p>
              </div>
            </div>

            {/* Card 4: Personalized Strategy - Wide card */}
            <div className="md:col-span-2 group cursor-pointer">
              <div 
                className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(140, 157, 255, 0.12) 0%, rgba(255, 255, 255, 0.9) 100%)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(140, 157, 255, 0.25)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)'
                }}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)' }}>
                    <PhTarget className="w-5 h-5 sm:w-6 sm:h-6 text-white" weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2" style={{ color: 'var(--gn-rhino)' }}>Personalized Strategy</h3>
                    <p className="text-xs sm:text-sm mb-2 sm:mb-3" style={{ color: 'var(--gn-grey-dark)' }}>Custom preparation plan tailored to your background, target firms, and timeline.</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ background: 'rgba(140, 157, 255, 0.15)', color: 'var(--gn-rhino)' }}>Resume Review</span>
                      <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ background: 'rgba(140, 157, 255, 0.15)', color: 'var(--gn-rhino)' }}>Case Practice</span>
                      <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ background: 'rgba(140, 157, 255, 0.15)', color: 'var(--gn-rhino)' }}>Fit Interviews</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Flexible Scheduling */}
            <div className="group cursor-pointer">
              <div 
                className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(140, 157, 255, 0.2)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)'
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, var(--gn-periwinkle-light) 0%, var(--gn-periwinkle) 100%)' }}>
                  <PhCalendar className="w-6 h-6 text-white" weight="duotone" />
                </div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Flexible Scheduling</h3>
                <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Book sessions across time zones, 7 days a week</p>
                <div className="flex items-center gap-1 mt-2">
                  <PhClock className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--gn-grey-dark)' }}>24/7 availability</span>
                </div>
              </div>
            </div>

            {/* Card 6: Performance Dashboard */}
            <div className="group cursor-pointer">
              <div 
                className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(140, 157, 255, 0.2)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)'
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, var(--gn-rhino-medium) 0%, var(--gn-rhino) 100%)' }}>
                  <PhChartLine className="w-6 h-6 text-white" weight="duotone" />
                </div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--gn-rhino)' }}>Performance Dashboard</h3>
                <p className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>Track progress with detailed analytics</p>
                {/* Mini chart visualization */}
                <div className="flex items-end gap-1 mt-2 h-6">
                  {[40, 55, 45, 70, 60, 85, 75].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${h}%`, background: i === 5 ? 'var(--gn-chrome-yellow)' : 'rgba(140, 157, 255, 0.25)' }}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 7: Full Access - Wide card */}
            <div className="md:col-span-2 group cursor-pointer">
              <div 
                className="relative h-full rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl overflow-hidden"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(89, 97, 237, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(89, 97, 237, 0.2)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.08)'
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--gn-rhino-light) 0%, var(--gn-periwinkle) 100%)' }}>
                    <PhShield className="w-6 h-6 text-white" weight="duotone" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>Full Subscription Access</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--gn-grey-dark)' }}>All coaching plans include complete access to subscription resources.</p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--gn-grey-dark)' }}>
                      <span className="flex items-center gap-1"><PhCheck className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} /> Video Courses</span>
                      <span className="flex items-center gap-1"><PhCheck className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} /> Case Drills</span>
                      <span className="flex items-center gap-1"><PhCheck className="w-4 h-4" weight="duotone" style={{ color: 'var(--gn-chrome-yellow)' }} /> Peer Practice</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Company Logos Section */}
      <LogoStrip />

      {/* Book Discovery Call Button */}
      <div className="flex flex-col items-center py-8">
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--gn-grey-dark)' }}>
          Want to learn more about our coaching programs?
        </p>
        <Button
          onClick={() => setShowDiscoveryCallModal(true)}
          size="lg"
          className="px-8 py-6 text-lg font-semibold"
          style={{ 
            background: 'var(--gn-rhino)',
            color: 'white'
          }}
        >
          Book Free Discovery Call
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* How Does It Work? Section - Premium Card Design */}
      <section className="section-padding">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>How Does It Work?</h2>
            <p>Your structured journey from application to offer with continuous improvement</p>
          </div>

          {/* Row 1: Steps 1-3 with connecting lines */}
          <div className="relative mb-4">
            {/* Horizontal connecting line for row 1 */}
            <div className="hidden md:block absolute top-1/2 left-[calc(33.33%/2)] right-[calc(33.33%/2)] h-0.5 -translate-y-1/2" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.2 }}></div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1: Onboarding - Minimal Checklist */}
              <div className="relative">
                <div 
                  className="relative rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-lg h-full z-10"
                  style={{ 
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(46, 53, 88, 0.04)'
                  }}
                >
                  {/* Subtle Mini Dashboard */}
                  <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="space-y-1.5">
                      {[
                        { done: true, label: 'Basic Information' },
                        { done: true, label: 'Target Firms' },
                        { done: false, label: 'Interview Timeline' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-sm flex items-center justify-center ${item.done ? '' : 'border'}`}
                            style={{ 
                              backgroundColor: item.done ? 'var(--gn-chrome-yellow)' : 'transparent',
                              borderColor: item.done ? 'transparent' : '#cbd5e1'
                            }}
                          >
                            {item.done && (
                              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-[10px]" style={{ color: '#94a3b8' }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--gn-rhino)' }}>Onboarding</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                    Complete your profile and tell us about your background, target firms, and timeline.
                  </p>
                </div>
              </div>

              {/* Step 2: Strategy Call - Minimal Calendar */}
              <div className="relative">
                <div 
                  className="relative rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-lg h-full z-10"
                  style={{ 
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(46, 53, 88, 0.04)'
                  }}
                >
                  {/* Subtle Mini Calendar */}
                  <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="flex items-center gap-2 mb-2">
                      {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 text-center py-1.5 rounded text-[9px] ${i === 2 ? 'font-medium' : ''}`}
                          style={{ 
                            backgroundColor: i === 2 ? 'var(--gn-periwinkle)' : 'transparent',
                            color: i === 2 ? 'white' : '#94a3b8',
                            opacity: i === 2 ? 0.8 : 1
                          }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {['10:00', '14:00', '16:00'].map((time, i) => (
                        <div 
                          key={i}
                          className="flex-1 text-[8px] text-center py-1 rounded"
                          style={{ 
                            backgroundColor: i === 1 ? 'rgba(255, 166, 1, 0.15)' : 'white',
                            color: i === 1 ? 'var(--gn-rhino)' : '#94a3b8',
                            border: i === 1 ? '1px solid var(--gn-chrome-yellow)' : '1px solid #e2e8f0'
                          }}
                        >
                          {time}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--gn-rhino)' }}>Coaching Strategy Calls</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                    Book a strategy call with your coach to map your preparation journey.
                  </p>
                </div>
              </div>

              {/* Step 3: Build Plan - Minimal Progress */}
              <div className="relative">
                <div 
                  className="relative rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-lg h-full z-10"
                  style={{ 
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(46, 53, 88, 0.04)'
                  }}
                >
                  {/* Subtle Roadmap */}
                  <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="space-y-2">
                      {[
                        { label: 'Fit Stories', progress: 100 },
                        { label: 'Case Fundamentals', progress: 50 },
                        { label: 'Mock Interviews', progress: 0 }
                      ].map((phase, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-14 text-[9px]" style={{ color: '#94a3b8' }}>{phase.label}</div>
                          <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: '#e2e8f0' }}>
                            <div 
                              className="h-full rounded-full"
                              style={{ 
                                width: `${phase.progress}%`,
                                backgroundColor: phase.progress === 100 ? 'var(--gn-chrome-yellow)' : 'var(--gn-periwinkle)',
                                opacity: phase.progress === 100 ? 0.8 : 0.6
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--gn-rhino)' }}>Build Customized Plan</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                    Get a tailored plan based on your skill gaps, target firms, and interview timeline.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connector from Row 1 to Row 2 */}
          <div className="hidden md:block relative h-12 my-2">
            <div className="absolute right-[16.67%] top-0 w-0.5 h-6" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.2 }}></div>
            <div className="absolute right-[16.67%] left-[16.67%] top-6 h-0.5" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.2 }}></div>
            <div className="absolute left-[16.67%] top-6 w-0.5 h-6" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.2 }}></div>
          </div>

          {/* Row 2: Steps 4-6 */}
          <div className="relative">
            <div className="hidden md:block absolute top-1/2 left-[calc(33.33%/2)] right-[calc(33.33%/2)] h-0.5 -translate-y-1/2" style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.2 }}></div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 4: Sessions with MBB Coaches - Minimal Coach List */}
              <div className="relative">
                <div 
                  className="relative rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-lg h-full z-10"
                  style={{ 
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(46, 53, 88, 0.04)'
                  }}
                >
                  {/* Subtle Coach Availability */}
                  <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="space-y-2">
                      {[
                        { initials: 'AK', name: 'Arjun K.', firm: 'McKinsey', online: true },
                        { initials: 'PS', name: 'Priya S.', firm: 'BCG', online: true },
                        { initials: 'RJ', name: 'Rahul J.', firm: 'Bain', online: false }
                      ].map((coach, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-medium text-white"
                            style={{ backgroundColor: 'var(--gn-periwinkle)', opacity: 0.7 }}
                          >
                            {coach.initials}
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px]" style={{ color: '#64748b' }}>{coach.name}</span>
                            <span className="text-[8px] ml-1" style={{ color: '#94a3b8' }}>· {coach.firm}</span>
                          </div>
                          <div 
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: coach.online ? 'var(--gn-chrome-yellow)' : '#e2e8f0' }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--gn-rhino)' }}>Sessions with MBB Coaches</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                    Practice with consultants from McKinsey, BCG, and Bain through realistic mock interviews.
                  </p>
                </div>
              </div>

              {/* Step 5: Feedback - Minimal Scores */}
              <div className="relative">
                <div 
                  className="relative rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-lg h-full z-10"
                  style={{ 
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(46, 53, 88, 0.04)'
                  }}
                >
                  {/* Subtle Performance */}
                  <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10">
                        <svg className="w-10 h-10 -rotate-90">
                          <circle cx="20" cy="20" r="16" stroke="#e2e8f0" strokeWidth="3" fill="none" />
                          <circle 
                            cx="20" cy="20" r="16" 
                            stroke="var(--gn-periwinkle)" 
                            strokeWidth="3" 
                            fill="none" 
                            strokeLinecap="round"
                            strokeDasharray="80 100"
                            opacity="0.6"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-semibold" style={{ color: '#64748b' }}>4.2</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        {[
                          { label: 'Structure', w: '90%' },
                          { label: 'Math', w: '70%' },
                          { label: 'Comm', w: '85%' }
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[8px] w-10" style={{ color: '#94a3b8' }}>{item.label}</span>
                            <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: '#e2e8f0' }}>
                              <div className="h-full rounded-full" style={{ width: item.w, backgroundColor: 'var(--gn-periwinkle)', opacity: 0.5 }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--gn-rhino)' }}>Feedback & Analyze</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                    Get detailed feedback and track your improvement across key dimensions.
                  </p>
                </div>
              </div>

              {/* Step 6: Iterate - Minimal Cycle */}
              <div className="relative">
                <div 
                  className="relative rounded-2xl p-5 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-lg h-full z-10"
                  style={{ 
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 20px rgba(46, 53, 88, 0.04)'
                  }}
                >
                  {/* Subtle Cycle */}
                  <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: '#f8fafc' }}>
                    <div className="flex items-center justify-between">
                      {['Plan', 'Practice', 'Review', 'Refine'].map((step, i) => (
                        <div key={i} className="flex items-center">
                          <div 
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[7px] font-medium ${i <= 1 ? '' : 'border'}`}
                            style={{ 
                              backgroundColor: i === 0 ? 'var(--gn-periwinkle)' : i === 1 ? 'var(--gn-chrome-yellow)' : 'transparent',
                              borderColor: i > 1 ? '#e2e8f0' : 'transparent',
                              color: i <= 1 ? 'white' : '#94a3b8',
                              opacity: i <= 1 ? 0.8 : 1
                            }}
                          >
                            {step}
                          </div>
                          {i < 3 && (
                            <div className="w-2 h-px mx-0.5" style={{ backgroundColor: i < 1 ? 'var(--gn-chrome-yellow)' : '#e2e8f0', opacity: 0.6 }}></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: 'var(--gn-rhino)' }}>Iterate & Book Strategy Call</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                    Refine your approach and book another strategy call until you&apos;re interview-ready.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Book Single Session - "Still not sure?" CTA after How It Works */}
      <BookSingleSessionSection variant="coaching" />

      {/* Pricing Plans */}
      <section className="section-padding">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span 
              className="text-sm font-semibold uppercase tracking-wider" 
              style={{ color: 'var(--gn-periwinkle)' }}
            >
              Pricing
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4" style={{ color: 'var(--gn-rhino)' }}>
              Choose Your Coaching Plan
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--gn-grey-dark)' }}>
              All plans include full access to subscription resources
            </p>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gn-rhino)' }} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-2 sm:px-0">
              {coachingPlans.filter(p => !p.application_only).map((plan, index) => {
                const isPinnacle = plan.name === 'Pinnacle';
                // Use shared utility for feature list generation - consistent with Home page
                const featureList = generatePlanFeatureList(plan);

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
                      className="relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full rounded-2xl overflow-hidden"
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
                    
                    <div className="p-6 md:p-8 relative z-10">
                      {/* Plan Name */}
                      <h3 
                        className="text-xl font-semibold mb-3"
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
                            {isPinnacle ? 'Custom' : `₹${(plan.pricing?.one_time || plan.price || 0).toLocaleString()}`}
                          </span>
                        </div>
                      </div>
                      
                      {/* Description */}
                      <p 
                        className="text-sm mb-6 leading-relaxed min-h-[40px]"
                        style={{ color: plan.highlight ? 'rgba(255,255,255,0.8)' : 'var(--gn-grey-dark)' }}
                      >
                        {plan.description || 'Perfect for candidates looking for personalized coaching.'}
                      </p>
                      
                      {/* CTA Button */}
                      <button
                        onClick={() => handleEnrollClick(plan)}
                        className="w-full py-2.5 rounded-lg font-medium transition-all text-sm mb-6"
                        style={{ 
                          backgroundColor: plan.highlight ? 'var(--gn-chrome-yellow)' : 'transparent',
                          color: 'var(--gn-rhino)',
                          border: plan.highlight ? 'none' : '2px solid var(--gn-rhino)'
                        }}
                        onMouseEnter={(e) => {
                          if (!plan.highlight) {
                            e.currentTarget.style.backgroundColor = 'var(--gn-rhino)';
                            e.currentTarget.style.color = 'white';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!plan.highlight) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--gn-rhino)';
                          }
                        }}
                      >
                        {isPinnacle ? 'Apply Now' : 'Enroll Now'}
                      </button>
                      
                      {/* Separator */}
                      <div 
                        className="mb-6 h-px"
                        style={{ backgroundColor: plan.highlight ? 'rgba(255,255,255,0.2)' : 'rgba(140, 157, 255, 0.15)' }}
                      />
                      
                      {/* Features Label */}
                      <p 
                        className="font-semibold mb-4 text-sm"
                        style={{ color: plan.highlight ? 'white' : 'var(--gn-rhino)' }}
                      >
                        {index === 0 ? "What's included:" : "Everything in previous, plus:"}
                      </p>
                      
                      {/* Features List */}
                      <ul className="space-y-3">
                        {featureList.slice(0, 9).map((feature, idx) => (
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

          <div className="text-center mt-10">
            <p style={{ color: 'var(--gn-grey-dark)' }}>
              Already have an interview invite?{' '}
              <button 
                onClick={() => setShowScholarshipModal(true)}
                className="font-semibold hover:underline" 
                style={{ color: 'var(--gn-periwinkle)' }}
              >
                Apply for scholarship
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials - Dynamic from Admin */}
      <TestimonialsCarousel 
        page="coaching" 
        title="Success Stories from Our Coaching Program"
        subtitle="Hear from candidates who achieved their consulting dreams"
      />

      {/* FAQ */}
      <section className="section-padding relative overflow-hidden">
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
                Everything you need to know about our coaching programs. Can&apos;t find an answer? 
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
                {faqs.coaching.map((faq, index) => (
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

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        skipNavigation={true}
      />

      {/* Payment Modal with Razorpay - Only render when open */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPlan(null);
          }}
          plan={selectedPlan}
          onSuccess={handlePaymentSuccess}
          user={currentUser}
        />
      )}

      {/* Contact Form Modal */}
      <ContactFormModal
        isOpen={showContactFormModal}
        onClose={() => setShowContactFormModal(false)}
      />

      {/* Discovery Call Modal */}
      <DiscoveryCallModal
        isOpen={showDiscoveryCallModal}
        onClose={() => setShowDiscoveryCallModal(false)}
      />
      
      {/* Pinnacle Application Modal */}
      <PinnacleApplicationModal
        isOpen={showPinnacleModal}
        onClose={() => setShowPinnacleModal(false)}
        onSuccess={() => {
          console.log('Pinnacle application submitted');
        }}
      />
      
      {/* Scholarship Application Modal */}
      <ScholarshipApplicationModal
        isOpen={showScholarshipModal}
        onClose={() => setShowScholarshipModal(false)}
        onSuccess={() => {
          console.log('Scholarship application submitted');
        }}
      />
    </div>
  );
};

export default Coaching;