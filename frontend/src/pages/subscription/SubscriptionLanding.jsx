import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, 
  BookOpen, 
  Users, 
  Target, 
  Calendar,
  FileText,
  CheckCircle2, 
  ArrowRight, 
  Clock,
  Video,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Download,
  Award,
  Sparkles,
  UserCheck,
  BookMarked,
  Layers,
  MousePointer2,
  TrendingUp,
  Tag
} from 'lucide-react';
// Premium Phosphor Icons for Five Pillars
import {
  GraduationCap as PhGraduationCap,
  Presentation as PhPresentation,
  Target as PhTarget,
  BookBookmark as PhBookBookmark,
  UsersThree as PhUsersThree
} from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import LoginModal from '../../components/LoginModal';
import TestimonialsCarousel from '../../components/TestimonialsCarousel';
import ContactFormModal from '../../components/ContactFormModal';
import PaymentModal from '../../components/PaymentModal';
import LogoStrip from '../../components/LogoStrip';
import { isPromoActive, PROMO_PERCENT, PROMO_SIX_MONTH_TOTAL_SAVING_PCT, formatPromoEndDate } from '../../data/promoCampaign';
import { generatePlanFeatureList } from '../../utils/planFeatures';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Typing animation component
const TypingAnimation = () => {
  const words = ['consulting', 'McKinsey', 'BCG', 'Bain'];
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

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTime;
          const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => observer.disconnect();
  }, [end, duration, hasAnimated]);

  return <span ref={countRef}>{count}{suffix}</span>;
};

// CTA Button Component - Handles Free Trial vs Purchase
const CTAButton = ({ type = 'trial', className = '', size = 'default', children, isLoggedIn, onLoginClick }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (type === 'trial') {
      if (isLoggedIn) {
        navigate('/dashboard');
      } else {
        onLoginClick();
      }
    } else if (type === 'purchase') {
      document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Navy blue primary, white text, yellow on hover
  const baseStyle = {
    background: isHovered ? 'var(--gn-chrome-yellow)' : 'var(--gn-rhino)',
    color: isHovered ? 'var(--gn-rhino)' : 'white',
    border: 'none',
    transition: 'all 0.3s ease'
  };

  // White background, navy text, yellow on hover (for secondary/outline style)
  const outlineStyle = {
    background: isHovered ? 'var(--gn-chrome-yellow)' : 'white',
    color: 'var(--gn-rhino)',
    border: '2px solid var(--gn-rhino)',
    transition: 'all 0.3s ease'
  };

  return (
    <Button
      onClick={handleClick}
      size={size}
      className={`font-semibold rounded-xl ${className}`}
      style={type === 'trial' ? baseStyle : outlineStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children || (type === 'trial' ? 'Start Free Trial' : 'View Plans')}
      <ArrowRight className="w-4 h-4 ml-2" />
    </Button>
  );
};

// Floating Screenshot Component
const FloatingScreenshot = ({ src, alt, className = '', delay = 0 }) => {
  return (
    <div 
      className={`rounded-xl overflow-hidden shadow-2xl transform transition-all duration-700 ${className}`}
      style={{
        animation: `float 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        border: '4px solid white',
        boxShadow: '0 25px 60px rgba(46, 53, 88, 0.2)'
      }}
    >
      <img src={src} alt={alt} className="w-full h-auto" />
    </div>
  );
};

// Pillar Card Component - Option C: Accent Border Cards
const PillarCard = ({ icon: Icon, title, description, accentColor, targetId }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = () => {
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div 
      className="bg-white p-5 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden"
      style={{ 
        boxShadow: isHovered 
          ? '0 15px 35px rgba(46, 53, 88, 0.15)' 
          : '0 4px 15px rgba(0, 0, 0, 0.06)',
        borderTop: `4px solid ${accentColor}`,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
        style={{ background: '#e8ecff' }}
      >
        <Icon 
          className="w-6 h-6" 
          style={{ color: accentColor }} 
        />
      </div>
      
      <h3 
        className="text-sm font-bold mb-1"
        style={{ color: 'var(--gn-rhino)' }}
      >
        {title}
      </h3>
      
      <p 
        className="text-xs"
        style={{ color: 'var(--gn-grey-dark)' }}
      >
        {description}
      </p>
    </div>
  );
};

// Interactive Drill Animation Component
const DrillAnimation = () => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const animationSequence = () => {
      // Reset
      setSelectedOption(null);
      setShowResult(false);
      setCursorPosition({ x: 50, y: 50 });

      // Move cursor to option C
      setTimeout(() => setCursorPosition({ x: 180, y: 175 }), 1000);
      
      // Click option C
      setTimeout(() => {
        setSelectedOption('C');
        setShowResult(true);
      }, 2000);

      // Reset after showing result
      setTimeout(() => {
        setSelectedOption(null);
        setShowResult(false);
        setCursorPosition({ x: 50, y: 50 });
      }, 5000);
    };

    animationSequence();
    const interval = setInterval(animationSequence, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="relative p-6 rounded-xl"
      style={{ 
        background: 'white',
        border: '2px solid #e8ecff',
        boxShadow: '0 15px 40px rgba(46, 53, 88, 0.12)'
      }}
    >
      {/* Question */}
      <div className="mb-4">
        <span 
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}
        >
          Case Math • Hard
        </span>
        <p className="mt-3 text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>
          A PE firm acquires a company for $50M at 5x EBITDA. After 3 years, they exit at 7x EBITDA with 15% annual EBITDA growth. What is the approximate IRR?
        </p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {[
          { id: 'A', text: '~25%', correct: false },
          { id: 'B', text: '~32%', correct: false },
          { id: 'C', text: '~38%', correct: true },
          { id: 'D', text: '~45%', correct: false }
        ].map((option) => (
          <div
            key={option.id}
            className={`p-3 rounded-lg text-sm transition-all duration-300 ${
              selectedOption === option.id 
                ? option.correct 
                  ? 'ring-2 ring-green-500' 
                  : 'ring-2 ring-red-500'
                : ''
            }`}
            style={{ 
              background: selectedOption === option.id 
                ? option.correct ? '#dcfce7' : '#fee2e2'
                : '#f8f9ff',
              color: 'var(--gn-rhino)'
            }}
          >
            <span className="font-semibold mr-2">{option.id}.</span>
            {option.text}
            {selectedOption === option.id && showResult && (
              <span className="ml-2">
                {option.correct ? '✓' : '✗'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Animated Cursor */}
      <div
        className="absolute w-6 h-6 pointer-events-none transition-all duration-500 ease-out"
        style={{
          left: cursorPosition.x,
          top: cursorPosition.y,
          transform: 'translate(-50%, -50%)'
        }}
      >
        <MousePointer2 
          className="w-6 h-6" 
          style={{ color: 'var(--gn-rhino)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} 
        />
      </div>

      {/* Result Message */}
      {showResult && (
        <div 
          className="mt-4 p-3 rounded-lg text-center text-xs font-medium"
          style={{ background: '#dcfce7', color: '#166534' }}
        >
          ✓ Correct! Exit = $10M × 1.15³ × 7 = ~$106M. IRR = (106/50)^(1/3) - 1 ≈ 38%
        </div>
      )}
    </div>
  );
};

// Module Card for curriculum
const ModuleCard = ({ module, index, isExpanded, onToggle }) => {
  return (
    <div 
      className="border-2 rounded-xl overflow-hidden transition-all duration-300"
      style={{ 
        borderColor: isExpanded ? 'var(--gn-rhino)' : '#e8ecff',
        background: 'white'
      }}
    >
      <button
        className="w-full flex items-center justify-between p-4 text-left transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ 
              background: isExpanded ? 'var(--gn-rhino)' : '#e8ecff',
              color: isExpanded ? 'white' : 'var(--gn-rhino)'
            }}
          >
            {index + 1}
          </div>
          <div>
            <h4 className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>{module.title}</h4>
            <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>
              {module.lessons} lessons • {module.duration}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
        ) : (
          <ChevronRight className="w-5 h-5" style={{ color: 'var(--gn-grey)' }} />
        )}
      </button>
      
      {isExpanded && module.topics && (
        <div className="px-4 pb-4">
          <div className="pl-14 space-y-2">
            {module.topics.map((topic, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: 'var(--gn-grey-dark)' }}>
                <Play className="w-3 h-3" style={{ color: 'var(--gn-rhino)' }} />
                {topic}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SubscriptionLanding = () => {
  const [expandedModule, setExpandedModule] = useState(0);
  const [billingCycle, setBillingCycle] = useState('6-month');
  const [plans, setPlans] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showContactFormModal, setShowContactFormModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [drillCounts, setDrillCounts] = useState(null);
  const navigate = useNavigate();

  // Handle hash navigation for section scrolling
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      // Small delay to ensure page is rendered
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, []);

  useEffect(() => {
    // Check auth
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include',
          headers
        });
        setIsLoggedIn(response.ok);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();

    // Fetch subscription plans
    const fetchPlans = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/resources/plans?category=subscription`);
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans?.filter(p => p.is_visible !== false && p.plan_key !== 'free_trial') || []);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      }
    };
    fetchPlans();

    // Fetch drill counts
    const fetchDrillCounts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/resources/drills/counts-by-tier`);
        if (res.ok) {
          const data = await res.json();
          setDrillCounts(data);
        }
      } catch (error) {
        console.error('Error fetching drill counts:', error);
      }
    };
    fetchDrillCounts();
  }, []);

  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true);
    setShowLoginModal(false);
    // After login, show payment modal if a plan was selected
    if (selectedPlan) {
      setShowPaymentModal(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handlePlanClick = (plan) => {
    setSelectedPlan(plan);
    if (isLoggedIn) {
      // User is logged in, show payment modal directly
      setShowPaymentModal(true);
    } else {
      // User needs to login first
      setShowLoginModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
    // Redirect to dashboard after successful payment
    navigate('/dashboard');
  };

  // Five pillars data with accent colors and target section IDs
  const pillars = [
    { icon: Video, title: 'Video Courses', description: '30+ hours of expert content', accentColor: 'var(--gn-rhino)', targetId: 'video-courses-section' },
    { icon: Calendar, title: 'Live Workshops', description: 'Weekly interactive sessions', accentColor: '#8c9dff', targetId: 'workshops-section' },
    { icon: Target, title: 'Case Drills', description: '500+ practice exercises', accentColor: '#6366f1', targetId: 'drills-section' },
    { icon: FileText, title: 'Resources', description: '100+ cases & frameworks', accentColor: '#4f46e5', targetId: 'resources-section' },
    { icon: Users, title: 'Peer Practice', description: 'Smart matching system', accentColor: '#7c3aed', targetId: 'peer-practice-section' }
  ];

  // Course modules - Complete 9-module curriculum
  const courseModules = [
    { 
      title: 'Introduction to Consulting', 
      lessons: 4, 
      duration: '1 hour',
      topics: ['What is consulting?', 'What do consultants do?', 'Different types of consulting firms', 'Hiring process of consulting firms']
    },
    { 
      title: 'Building Consulting CV', 
      lessons: 4, 
      duration: '2 hours',
      topics: ['What do consulting firms look for in a CV', 'Building and structuring the CV', 'Top-loading and front-loading RAC format', 'Quantifying the results']
    },
    { 
      title: 'Building Consulting Cover Letter', 
      lessons: 9, 
      duration: '2 hours',
      topics: ['Purpose of a Cover Letter', 'What Firms Are Looking For', 'Cover Letter Framework', 'Crafting Your Story', 'Paragraph-by-Paragraph Guide', 'Strategy by Candidate Type', 'Firm-Specific Customization', 'Hygiene Factors & Mistakes', 'From Draft to Submit']
    },
    { 
      title: 'Network for Referrals', 
      lessons: 8, 
      duration: '3 hours',
      topics: ['Understanding Referrals', 'Three Tiers of Your Network', 'Finding Your Contacts', 'Channel Strategy', 'Scripts and Templates', 'The Coffee Chat Playbook', 'Converting to Referral', 'Automation vs. Personal']
    },
    { 
      title: 'Getting Started with Case Interviews', 
      lessons: 7, 
      duration: '2 hours',
      topics: ['Types of cases', 'Anatomy of a case', 'How to structure your notes', 'How to approach cases', 'Case opening analysis', 'Closing the case', 'Common mistakes']
    },
    { 
      title: 'Basic Case Frameworks', 
      lessons: 6, 
      duration: '12 hours',
      topics: ['Guesstimates', 'Profitability', 'Market Entry', 'Growth', 'Pricing', 'M&A']
    },
    { 
      title: 'Advanced Case Solving', 
      lessons: 4, 
      duration: '8 hours',
      topics: ['Unstructured Cases', 'Diagnostic Cases', 'Go/No-Go Cases', 'Brainstorming Cases']
    },
    { 
      title: 'Fit/PEI Interviews', 
      lessons: 9, 
      duration: '4 hours',
      topics: ['What are Fit Interviews', 'Types of Fit Questions', 'List of Questions to Prepare', 'How to Prepare', 'How to Answer', 'STAR Format', 'Example Questions', 'Evaluation Criteria']
    },
    { 
      title: 'Other Important Concepts', 
      lessons: 2, 
      duration: '2 hours',
      topics: ['Conventional Frameworks (4Ps, 4As, PPT, 3M, PESTLE, PORTER)', 'Business Fundamentals (NPV, IRR, Payback, Breakeven)']
    },
  ];

  // Sample workshops
  const sampleWorkshops = [
    { title: 'PE/VC Case Deep Dive', date: 'Registrations open soon', duration: '90 min', instructor: 'Ex-McKinsey Partner' },
    { title: 'Tech Industry Primer', date: 'Registrations open soon', duration: '60 min', instructor: 'Ex-BCG Manager' },
    { title: 'Market Entry Masterclass', date: 'Registrations open soon', duration: '90 min', instructor: 'Ex-Bain Consultant' }
  ];

  // FAQs
  const faqs = [
    {
      question: 'How long do I have access to the content after subscribing?',
      answer: 'You have full access to all content included in your plan for as long as your subscription remains active. Since subscriptions are billed monthly or 6-monthly, your access continues uninterrupted as long as payments are up to date.'
    },
    {
      question: 'Can I upgrade my plan later?',
      answer: 'Yes, you can upgrade from Basic to Pro or Pro+ at any point in your subscription journey. This is useful if you start with a lower tier and find you need more practice sessions, workshop access, or additional drills as your interview date approaches.'
    },
    {
      question: 'Do you offer refunds?',
      answer: 'Please refer to gradnext\'s Cancellation & Refund policy for full details, available in the footer of the site. You can also reach out directly at support@gradnext.co for any billing-related queries.'
    },
    {
      question: 'How does the 7-day free trial work?',
      answer: 'You can start a 7-day free trial with no credit card required. This gives you hands-on access to the platform so you can explore the content, drills, and features before committing to a paid plan. You can cancel at any time during the trial.'
    },
    {
      question: 'What topics do the video courses cover?',
      answer: 'The 9-module curriculum covers a wide range, including an introduction to consulting, building your CV and cover letter, networking for referrals, and advance case interviews - totalling 35+ hours of structured content designed by MBB consultants.'
    },
    {
      question: 'How are the live workshops conducted?',
      answer: 'Workshops are interactive sessions held online with current and former MBB consultants. They cover industry-specific primers (such as fintech, airlines, and healthcare) as well as broader consulting topics. Attendees can ask questions live and engage directly with the experts.'
    },
    {
      question: 'What types of case drills are available?',
      answer: 'The drill library includes 500+ questions spanning three main categories: case math (240+), structuring (240+), and charts & exhibits (300+). Each drill includes instant feedback and detailed explanations to help you understand not just the answer, but the reasoning behind it.'
    },
    {
      question: 'What resources are included in the library?',
      answer: 'The resource library contains 100+ practice cases, 15+ frameworks, 10+ casebooks from top business schools, and 50+ cheat sheets. These cover a broad range of case types and are designed to complement the video courses and drills.'
    },
    {
      question: 'How do peer sessions work?',
      answer: 'Peers can list their available time slots on the platform. Other peers can request to book any of these slots, and once the host approves the request, the session invite is automatically generated and both users will see the confirmed session reflected on their dashboards.'
    }
  ];

  // CSS for floating animation
  const floatKeyframes = `
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-15px); }
    }
    @keyframes float-delayed {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-20px); }
    }
    @keyframes pulse-subtle {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes orbit {
      0% { transform: rotate(0deg) translateX(200px) rotate(0deg); }
      100% { transform: rotate(360deg) translateX(200px) rotate(-360deg); }
    }
  `;

  return (
    <div 
      className="min-h-screen" 
      style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}
    >
      <style>{floatKeyframes}</style>
      
      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        skipNavigation={!!selectedPlan}
      />

      {/* ==================== HERO SECTION ==================== */}
      <section className="hero-section pt-24 sm:pt-36 pb-12 sm:pb-20 overflow-hidden relative">
        {/* Concentric Circles Background - Same as Home */}
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
              <span>Subscription</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-8 animate-fade-in-up px-2" style={{ color: 'var(--gn-rhino)', lineHeight: '1.1' }}>
              All-access pass to your{' '}
              <TypingAnimation /> prep
            </h1>

            {/* Subheadline */}
            <div className="mb-8 sm:mb-12 animate-fade-in-up stagger-1 max-w-3xl mx-auto px-4">
              <p className="text-base sm:text-lg md:text-xl" style={{ color: 'var(--gn-grey-dark)' }}>
                30+ hours of video content, live workshops, 500+ drills, peer practice, and comprehensive case resources.
              </p>
            </div>

            {/* Offer logos — above the fold */}
            <div className="mb-8 sm:mb-10 animate-fade-in-up stagger-2">
              <LogoStrip compact />
            </div>

            {/* Candidate Cards Preview - Clean Pop-up Style */}
            <div className="relative animate-fade-in-up stagger-2 mb-10 hidden sm:block">
              <div 
                className="relative rounded-2xl overflow-hidden mx-auto p-6"
                style={{ 
                  background: 'white',
                  border: '1px solid #e8ecff',
                  maxWidth: '900px',
                  boxShadow: '0 4px 20px rgba(46, 53, 88, 0.08)'
                }}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="text-left">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>Find Practice Partners</h3>
                    <p className="text-sm" style={{ color: 'var(--gn-grey)' }}>Connect with peers preparing for MBB interviews</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}>
                      12 peers online
                    </span>
                  </div>
                </div>
                
                {/* Candidate Cards Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Card 1 */}
                  <div className="bg-white rounded-xl p-4 shadow-sm text-left" style={{ border: '1px solid #e8ecff' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80" alt="User" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Rahul M.</div>
                        <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>IIM Bangalore</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}>McKinsey</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}>BCG</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= 4 ? '#fbbf24' : '#e5e7eb' }}></div>
                        ))}
                      </div>
                      <button className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'var(--gn-rhino)', color: 'white' }}>Connect</button>
                    </div>
                  </div>
                  
                  {/* Card 2 */}
                  <div className="bg-white rounded-xl p-4 shadow-sm text-left" style={{ border: '1px solid #e8ecff' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80" alt="User" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Priya S.</div>
                        <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>ISB Hyderabad</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}>Bain</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}>BCG</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= 5 ? '#fbbf24' : '#e5e7eb' }}></div>
                        ))}
                      </div>
                      <button className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'var(--gn-rhino)', color: 'white' }}>Connect</button>
                    </div>
                  </div>
                  
                  {/* Card 3 */}
                  <div className="bg-white rounded-xl p-4 shadow-sm text-left" style={{ border: '1px solid #e8ecff' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow">
                        <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80" alt="User" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Arjun K.</div>
                        <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>IIM Ahmedabad</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}>McKinsey</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}>Kearney</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= 4 ? '#fbbf24' : '#e5e7eb' }}></div>
                        ))}
                      </div>
                      <button className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'var(--gn-rhino)', color: 'white' }}>Connect</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button - Single, Centered */}
            <div className="flex justify-center animate-fade-in-up stagger-3">
              <CTAButton 
                type="trial" 
                size="lg" 
                className="btn-primary px-8 py-6 text-lg"
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setShowLoginModal(true)}
              >
                Start 7-Day Free Trial
              </CTAButton>
            </div>

            {/* Rating Section */}
            <div className="flex flex-col items-center justify-center gap-1 animate-fade-in-up stagger-4 mt-8">
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
          </div>
        </div>
      </section>

      {/* Company Logos Section */}
      <LogoStrip />

      {/* Stats Section with Different Graphs */}
      <section className="pt-16 pb-0 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
            {/* Card 1: Hours of Content - Area/Wave Chart */}
            <div 
              className="relative p-6 rounded-2xl bg-white overflow-hidden group hover:shadow-lg transition-all duration-300"
              style={{ 
                border: '1px solid #e8ecff',
                boxShadow: '0 4px 16px rgba(46, 53, 88, 0.06)'
              }}
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, var(--gn-chrome-yellow) 0%, #fef3c7 100%)' }}
              />
              
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--gn-rhino)' }}
              >
                <AnimatedCounter end={50} suffix="+" />
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--gn-grey-dark)' }}>
                Hours of Content
              </p>
              
              {/* Area/Wave Chart */}
              <div className="h-12 relative">
                <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#8c9dff" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#8c9dff" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>
                  <path 
                    d="M0,35 Q10,30 20,28 T40,22 T60,15 T80,10 T100,5 L100,40 L0,40 Z" 
                    fill="url(#areaGradient1)"
                  />
                  <path 
                    d="M0,35 Q10,30 20,28 T40,22 T60,15 T80,10 T100,5" 
                    fill="none" 
                    stroke="#8c9dff" 
                    strokeWidth="2"
                  />
                  <circle cx="100" cy="5" r="3" fill="#8c9dff"/>
                </svg>
              </div>
              
              <div className="flex items-center gap-1.5 mt-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#8c9dff' }} />
                <span className="text-xs font-medium" style={{ color: '#8c9dff' }}>
                  Growing
                </span>
              </div>
            </div>

            {/* Card 2: Practice Drills - Stepped Bar Chart */}
            <div 
              className="relative p-6 rounded-2xl bg-white overflow-hidden group hover:shadow-lg transition-all duration-300"
              style={{ 
                border: '1px solid #e8ecff',
                boxShadow: '0 4px 16px rgba(46, 53, 88, 0.06)'
              }}
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, var(--gn-chrome-yellow) 0%, #fef3c7 100%)' }}
              />
              
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--gn-rhino)' }}
              >
                <AnimatedCounter end={500} suffix="+" />
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--gn-grey-dark)' }}>
                Practice Drills
              </p>
              
              {/* Stepped Progress Bars */}
              <div className="space-y-2 h-12 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full flex-1" style={{ background: '#e8ecff' }}>
                    <div className="h-full rounded-full" style={{ width: '90%', background: '#6366f1' }}/>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full flex-1" style={{ background: '#e8ecff' }}>
                    <div className="h-full rounded-full" style={{ width: '70%', background: '#818cf8' }}/>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full flex-1" style={{ background: '#e8ecff' }}>
                    <div className="h-full rounded-full" style={{ width: '50%', background: '#a5b4fc' }}/>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 mt-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
                <span className="text-xs font-medium" style={{ color: '#6366f1' }}>
                  Growing
                </span>
              </div>
            </div>

            {/* Card 3: Case Studies - Dot Chart */}
            <div 
              className="relative p-6 rounded-2xl bg-white overflow-hidden group hover:shadow-lg transition-all duration-300"
              style={{ 
                border: '1px solid #e8ecff',
                boxShadow: '0 4px 16px rgba(46, 53, 88, 0.06)'
              }}
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, var(--gn-chrome-yellow) 0%, #fef3c7 100%)' }}
              />
              
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--gn-rhino)' }}
              >
                <AnimatedCounter end={100} suffix="+" />
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--gn-grey-dark)' }}>
                Case Studies
              </p>
              
              {/* Dot/Bubble Chart */}
              <div className="h-12 flex items-end justify-between px-1">
                {[25, 35, 45, 55, 70, 85, 100].map((val, i) => (
                  <div 
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{ 
                      width: `${8 + i * 1.5}px`,
                      height: `${8 + i * 1.5}px`,
                      background: i === 6 ? '#a78bfa' : `rgba(167, 139, 250, ${0.2 + i * 0.1})`,
                      marginBottom: `${i * 3}px`
                    }}
                  />
                ))}
              </div>
              
              <div className="flex items-center gap-1.5 mt-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>
                  Growing
                </span>
              </div>
            </div>

            {/* Card 4: Active Users - Bar Sparkline */}
            <div 
              className="relative p-6 rounded-2xl bg-white overflow-hidden group hover:shadow-lg transition-all duration-300"
              style={{ 
                border: '1px solid #e8ecff',
                boxShadow: '0 4px 16px rgba(46, 53, 88, 0.06)'
              }}
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, var(--gn-chrome-yellow) 0%, #fef3c7 100%)' }}
              />
              
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: 'var(--gn-rhino)' }}
              >
                <AnimatedCounter end={1000} suffix="+" />
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--gn-grey-dark)' }}>
                Active Users
              </p>
              
              {/* Vertical Bar Sparkline */}
              <div className="flex items-end gap-1.5 h-12">
                {[20, 35, 28, 45, 55, 48, 65, 80, 72, 95].map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all duration-500"
                    style={{
                      height: `${val}%`,
                      background: i === 9 ? '#818cf8' : `rgba(129, 140, 248, ${0.25 + (i * 0.05)})`,
                    }}
                  />
                ))}
              </div>
              
              <div className="flex items-center gap-1.5 mt-3">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                <span className="text-xs font-medium" style={{ color: '#818cf8' }}>
                  Growing
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FIVE PILLARS - GLASSMORPHISM WITH POP-UP IMAGES ==================== */}
      <section className="py-20 relative overflow-hidden">
        {/* Floating Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-96 h-96 rounded-full blur-3xl"
            style={{ 
              background: 'radial-gradient(circle, rgba(140, 157, 255, 0.4) 0%, transparent 70%)',
              top: '10%',
              left: '5%',
              animation: 'float 8s ease-in-out infinite'
            }}
          />
          <div 
            className="absolute w-80 h-80 rounded-full blur-3xl"
            style={{ 
              background: 'radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, transparent 70%)',
              top: '30%',
              right: '10%',
              animation: 'float 10s ease-in-out infinite reverse'
            }}
          />
          <div 
            className="absolute w-72 h-72 rounded-full blur-3xl"
            style={{ 
              background: 'radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, transparent 70%)',
              bottom: '10%',
              left: '30%',
              animation: 'float 12s ease-in-out infinite'
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12">
            <span 
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--gn-rhino)' }}
            >
              What&apos;s Included
            </span>
            <h2 
              className="text-3xl md:text-4xl font-bold mt-3 mb-4"
              style={{ color: 'var(--gn-rhino)' }}
            >
              Five Pillars of Your Success
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--gn-grey-dark)' }}>
              A comprehensive system designed to prepare you for every aspect of consulting interviews
            </p>
          </div>

          {/* Glassmorphism Cards - Row 1 (3 cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Courses Card */}
            <div
              className="group cursor-pointer"
              onClick={() => {
                const element = document.getElementById('video-courses-section');
                if (element) {
                  const headerOffset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
            >
              <div 
                className="relative p-6 rounded-2xl transition-all duration-500 hover:translate-y-[-8px] hover:shadow-2xl overflow-hidden h-full"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.1)'
                }}
              >
                {/* Pop-up Images on Hover - Dashboard Courses Screenshots */}
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-8 group-hover:translate-x-0">
                  <div className="w-16 h-12 rounded-lg overflow-hidden shadow-lg transform rotate-6 translate-y-2">
                    <img src="/dashboard-courses.png" alt="Courses Dashboard" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-14 h-10 rounded-lg overflow-hidden shadow-lg transform -rotate-3">
                    <img src="/courses-section-screenshot.png" alt="Courses Section" className="w-full h-full object-cover" />
                  </div>
                </div>
                
                {/* Icon - Periwinkle Theme */}
                <div className="relative mb-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--gn-periwinkle) 0%, var(--gn-rhino-light) 100%)',
                      boxShadow: '0 4px 15px rgba(140, 157, 255, 0.4)'
                    }}
                  >
                    <PhGraduationCap className="w-7 h-7 text-white" weight="duotone" />
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Courses
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                  30+ hours covering basic and advanced case prep, networking strategy, CV and cover letter, and much more.
                </p>
                
                <div className="flex items-center gap-2 mt-4 text-sm font-medium opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gn-rhino)' }}>
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" style={{ color: 'var(--gn-chrome-yellow)' }} />
                </div>
              </div>
            </div>

            {/* Live Workshops Card */}
            <div
              className="group cursor-pointer"
              onClick={() => {
                const element = document.getElementById('workshops-section');
                if (element) {
                  const headerOffset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
            >
              <div 
                className="relative p-6 rounded-2xl transition-all duration-500 hover:translate-y-[-8px] hover:shadow-2xl overflow-hidden h-full"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.1)'
                }}
              >
                {/* Pop-up Images on Hover - Dashboard Workshops Screenshots */}
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-8 group-hover:translate-x-0">
                  <div className="w-16 h-12 rounded-lg overflow-hidden shadow-lg transform rotate-3 translate-y-1">
                    <img src="/dashboard-workshops.png" alt="Workshops Dashboard" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-14 h-10 rounded-lg overflow-hidden shadow-lg transform -rotate-6">
                    <img src="/dashboard-preview.png" alt="Dashboard Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
                
                {/* Icon - Periwinkle Theme (Lighter shade) */}
                <div className="relative mb-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--gn-periwinkle-light) 0%, var(--gn-periwinkle) 100%)',
                      boxShadow: '0 4px 15px rgba(177, 188, 255, 0.4)'
                    }}
                  >
                    <PhPresentation className="w-7 h-7 text-white" weight="duotone" />
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Live Workshops
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                  Weekly sessions on industry primers (fintech, airlines, healthcare, etc.) and general discussions on consulting.
                </p>
                
                <div className="flex items-center gap-2 mt-4 text-sm font-medium opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gn-rhino)' }}>
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" style={{ color: 'var(--gn-chrome-yellow)' }} />
                </div>
              </div>
            </div>

            {/* Case Drills Card */}
            <div
              className="group cursor-pointer"
              onClick={() => {
                const element = document.getElementById('drills-section');
                if (element) {
                  const headerOffset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
            >
              <div 
                className="relative p-6 rounded-2xl transition-all duration-500 hover:translate-y-[-8px] hover:shadow-2xl overflow-hidden h-full"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.1)'
                }}
              >
                {/* Pop-up Images on Hover - Dashboard Drills Screenshots */}
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-8 group-hover:translate-x-0">
                  <div className="w-16 h-12 rounded-lg overflow-hidden shadow-lg transform rotate-6 translate-y-2">
                    <img src="/dashboard-drills.png" alt="Drills Dashboard" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-14 h-10 rounded-lg overflow-hidden shadow-lg transform -rotate-3">
                    <img src="/dashboard-preview.png" alt="Dashboard Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
                
                {/* Icon - Periwinkle Theme (Rhino shade) */}
                <div className="relative mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--gn-rhino-medium) 0%, var(--gn-rhino) 100%)',
                      boxShadow: '0 4px 15px rgba(54, 62, 167, 0.4)'
                    }}
                  >
                    <PhTarget className="w-7 h-7 text-white" weight="duotone" />
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Case Drills
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                  500+ case questions to practice case math, case structuring, exhibits, charts, graphs, and much more.
                </p>
                
                <div className="flex items-center gap-2 mt-4 text-sm font-medium opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gn-rhino)' }}>
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" style={{ color: 'var(--gn-chrome-yellow)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Glassmorphism Cards - Row 2 (2 cards centered) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Resources Card */}
            <div
              className="group cursor-pointer"
              onClick={() => {
                const element = document.getElementById('resources-section');
                if (element) {
                  const headerOffset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
            >
              <div 
                className="relative p-6 rounded-2xl transition-all duration-500 hover:translate-y-[-8px] hover:shadow-2xl overflow-hidden h-full"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.1)'
                }}
              >
                {/* Pop-up Images on Hover - Dashboard Coaching/Resources Screenshots */}
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-8 group-hover:translate-x-0">
                  <div className="w-16 h-12 rounded-lg overflow-hidden shadow-lg transform rotate-3 translate-y-1">
                    <img src="/dashboard-coaching.png" alt="Coaching Dashboard" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-14 h-10 rounded-lg overflow-hidden shadow-lg transform -rotate-6">
                    <img src="/dashboard-preview.png" alt="Dashboard Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
                
                {/* Icon - Periwinkle Theme (Lighter shade) */}
                <div className="relative mb-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--gn-periwinkle-lighter) 0%, var(--gn-periwinkle-light) 100%)',
                      boxShadow: '0 4px 15px rgba(222, 227, 255, 0.6)'
                    }}
                  >
                    <PhBookBookmark className="w-7 h-7" weight="duotone" style={{ color: 'var(--gn-rhino)' }} />
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Resources
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                  100+ case books, cases, frameworks, and comprehensive materials to support your preparation.
                </p>
                
                <div className="flex items-center gap-2 mt-4 text-sm font-medium opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gn-rhino)' }}>
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" style={{ color: 'var(--gn-chrome-yellow)' }} />
                </div>
              </div>
            </div>

            {/* Peer Practice Card */}
            <div
              className="group cursor-pointer"
              onClick={() => {
                const element = document.getElementById('peer-practice-section');
                if (element) {
                  const headerOffset = 80;
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
            >
              <div 
                className="relative p-6 rounded-2xl transition-all duration-500 hover:translate-y-[-8px] hover:shadow-2xl overflow-hidden h-full"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 8px 32px rgba(46, 53, 88, 0.1)'
                }}
              >
                {/* Pop-up Images on Hover - Dashboard Peer Practice Screenshots */}
                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-8 group-hover:translate-x-0">
                  <div className="w-16 h-12 rounded-lg overflow-hidden shadow-lg transform rotate-6 translate-y-2">
                    <img src="/dashboard-peer-practice.png" alt="Peer Practice Dashboard" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-14 h-10 rounded-lg overflow-hidden shadow-lg transform -rotate-3">
                    <img src="/dashboard-preview.png" alt="Dashboard Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
                
                {/* Icon - Periwinkle Theme (Rhino Light shade) */}
                <div className="relative mb-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--gn-rhino-light) 0%, var(--gn-rhino-medium) 100%)',
                      boxShadow: '0 4px 15px rgba(89, 97, 237, 0.4)'
                    }}
                  >
                    <PhUsersThree className="w-7 h-7 text-white" weight="duotone" />
                  </div>
                </div>
                
                <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Peer Practice
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--gn-grey-dark)' }}>
                  Connect with peers across the globe aiming to crack McKinsey, BCG, and Bain. Unlimited peer practice sessions.
                </p>
                
                <div className="flex items-center gap-2 mt-4 text-sm font-medium opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--gn-rhino)' }}>
                  <span>Explore</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" style={{ color: 'var(--gn-chrome-yellow)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== VIDEO COURSES SECTION ==================== */}
      <section 
        id="video-courses-section"
        className="py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 50/50 Split Layout */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left Side - 50% */}
            <div>
              {/* Text Content */}
              <div>
                <span 
                  className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-4"
                  style={{ color: 'var(--gn-rhino)' }}
                >
                  <Video className="w-4 h-4" />
                  Recorded Video Courses
                </span>
                <h2 
                  className="text-3xl md:text-4xl font-bold mb-4"
                  style={{ color: 'var(--gn-rhino)' }}
                >
                  Master Every Concept with Expert-Led Videos
                </h2>
                <p className="text-base mb-6" style={{ color: 'var(--gn-grey-dark)' }}>
                  Our comprehensive video curriculum covers everything from case interview basics to advanced techniques. Each module is designed by MBB consultants with years of interviewing experience.
                </p>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { icon: Video, value: '35+', label: 'Hours' },
                    { icon: BookOpen, value: '9', label: 'Modules' },
                    { icon: Award, value: 'MBB', label: 'Featured' }
                  ].map((stat, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-xl text-center"
                      style={{ background: '#e8ecff' }}
                    >
                      <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--gn-rhino)' }} />
                      <div className="text-lg font-bold" style={{ color: 'var(--gn-rhino)' }}>{stat.value}</div>
                      <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <CTAButton 
                  type="trial"
                  isLoggedIn={isLoggedIn}
                  onLoginClick={() => setShowLoginModal(true)}
                  className="px-6 py-3"
                >
                  Start 7-day free trial
                </CTAButton>
              </div>
            </div>

            {/* Right Side - 50% - Accordion Course Curriculum */}
            <div className="perspective-1000">
              <div 
                className="p-6 rounded-2xl relative"
                style={{ 
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8f9ff 100%)',
                  border: '1px solid #e8ecff',
                  boxShadow: '0 25px 50px -12px rgba(46, 53, 88, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                  transform: 'rotateY(-5deg) rotateX(2deg)',
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* 3D Depth layers */}
                <div 
                  className="absolute inset-0 rounded-2xl -z-10"
                  style={{
                    background: '#e8ecff',
                    transform: 'translateZ(-20px) translateX(10px) translateY(10px)',
                    boxShadow: '0 20px 40px rgba(46, 53, 88, 0.15)'
                  }}
                />
                <div 
                  className="absolute inset-0 rounded-2xl -z-20"
                  style={{
                    background: '#d4daf7',
                    transform: 'translateZ(-40px) translateX(20px) translateY(20px)',
                    boxShadow: '0 30px 60px rgba(46, 53, 88, 0.1)'
                  }}
                />
                
                <h3 
                  className="text-xl font-bold mb-5"
                  style={{ color: 'var(--gn-rhino)' }}
                >
                  Course Curriculum
                </h3>
                
                {/* Scrollable Accordion Container */}
                <div className="max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  <Accordion type="single" collapsible className="space-y-2.5">
                    {courseModules.map((module, idx) => (
                      <AccordionItem 
                        key={idx} 
                        value={`module-${idx}`}
                        className="border-0"
                      >
                        <AccordionTrigger 
                          className="px-4 py-3 rounded-xl bg-white hover:no-underline hover:translate-x-1 hover:shadow-md transition-all duration-300 group [&[data-state=open]]:bg-slate-50 [&>svg]:text-[#FFA601]"
                          style={{ 
                            border: '1px solid #e8ecff',
                            boxShadow: '0 2px 8px rgba(46, 53, 88, 0.08)'
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm"
                              style={{ 
                                background: 'linear-gradient(135deg, var(--gn-rhino) 0%, #4a5280 100%)', 
                                color: 'white',
                                boxShadow: '0 2px 4px rgba(46, 53, 88, 0.3)'
                              }}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1 text-left">
                              <h4 
                                className="font-semibold text-sm leading-tight"
                                style={{ color: 'var(--gn-rhino)' }}
                              >
                                {module.title}
                              </h4>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--gn-grey)' }}>
                                {module.lessons} lessons • {module.duration}
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-1 px-4">
                          <div 
                            className="ml-11 space-y-2 pb-2"
                          >
                            {module.topics.map((topic, topicIdx) => (
                              <div 
                                key={topicIdx}
                                className="flex items-start gap-2.5 text-sm"
                                style={{ color: 'var(--gn-grey-dark)' }}
                              >
                                <Video 
                                  className="w-4 h-4 flex-shrink-0 mt-0.5" 
                                  style={{ color: 'var(--gn-chrome-yellow)' }} 
                                />
                                <span>{topic}</span>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== WORKSHOPS SECTION ==================== */}
      <section 
        id="workshops-section"
        className="py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Workshop Image - Screen Share Mockup */}
            <div className="relative order-2 lg:order-1">
              {/* Main Workshop Screenshot - Virtual Presentation */}
              <div 
                className="relative rounded-2xl overflow-hidden"
                style={{
                  animation: 'float 5s ease-in-out infinite',
                  boxShadow: '0 25px 50px rgba(46, 53, 88, 0.2)',
                  border: '4px solid white'
                }}
              >
                {/* Zoom-style Screen Share Mockup */}
                <div className="bg-[#1a1a1a] p-0">
                  {/* Top Bar - Zoom style */}
                  <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="text-white/60 text-xs">gradnext Workshop • 127 participants</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-red-400 text-xs font-medium">REC</span>
                    </div>
                  </div>
                  
                  {/* Main Content - Workshop Slide Image */}
                  <div className="relative">
                    <img 
                      src="https://customer-assets.emergentagent.com/job_success-pillars/artifacts/591v71so_image.png"
                      alt="The Three Tiers of Network: Overview"
                      className="w-full h-auto"
                    />
                  </div>
                  
                  {/* Bottom Bar - Zoom Controls */}
                  <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-white/70 text-xs">
                        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                          <Video className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/70 text-xs">
                        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                    <div className="text-white/50 text-xs">Live Q&A enabled</div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="px-3 py-1 rounded text-xs font-medium"
                        style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
                      >
                        Raise Hand
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Next Workshop Card */}
              <div 
                className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-lg max-w-[200px]"
                style={{
                  animation: 'float-delayed 7s ease-in-out infinite',
                  border: '2px solid #e8ecff'
                }}
              >
                <Calendar className="w-5 h-5 mb-2" style={{ color: 'var(--gn-rhino)' }} />
                <div className="text-xs font-semibold" style={{ color: 'var(--gn-rhino)' }}>Next Workshop</div>
                <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>Monday, 7 PM IST</div>
              </div>
            </div>

            {/* Right - Content */}
            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-4">
                <span 
                  className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--gn-rhino)' }}
                >
                  <Calendar className="w-4 h-4" />
                  Live Workshops
                </span>
              </div>
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                Learn from MBB Experts in Real-Time
              </h2>
              <p className="text-base mb-6" style={{ color: 'var(--gn-grey-dark)' }}>
                Join interactive sessions with current and former consultants from McKinsey, BCG, and Bain. Ask questions, get feedback, and master complex topics with expert guidance.
              </p>

              {/* Sample Workshops */}
              <div className="space-y-3 mb-8">
                {sampleWorkshops.map((workshop, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl bg-white"
                    style={{ border: '2px solid white' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>
                          {workshop.title}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>
                          {workshop.instructor} • {workshop.duration}
                        </div>
                      </div>
                      <span 
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ background: '#e8ecff', color: 'var(--gn-rhino)' }}
                      >
                        {workshop.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <CTAButton 
                  type="trial"
                  isLoggedIn={isLoggedIn}
                  onLoginClick={() => setShowLoginModal(true)}
                  className="px-6 py-3"
                >
                  Start 7-day free trial
                </CTAButton>
                <Link
                  to="/workshops"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg whitespace-nowrap"
                  style={{
                    background: 'var(--gn-chrome-yellow)',
                    color: 'var(--gn-rhino)'
                  }}
                >
                  Explore Workshops
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CASE DRILLS SECTION ==================== */}
      <section 
        id="drills-section"
        className="py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Content */}
            <div>
              <span 
                className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                <Target className="w-4 h-4" />
                Case Drills & Exercises
              </span>
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                Practice Makes Perfect
              </h2>
              <p className="text-base mb-6" style={{ color: 'var(--gn-grey-dark)' }}>
                Master case math, structuring, chart interpretation, and synthesis with our extensive library of 500+ drills. Each drill provides instant feedback and detailed explanations.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Case Math Questions', count: '240+', icon: BarChart3 },
                  { label: 'Structuring Questions', count: '240+', icon: Layers },
                  { label: 'Charts & Exhibits', count: '300+', icon: TrendingUp }
                ].map((drill, idx) => (
                  <div 
                    key={idx}
                    className="p-5 rounded-xl text-center"
                    style={{ background: '#e8ecff' }}
                  >
                    <drill.icon className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--gn-chrome-yellow)' }} />
                    <div className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{drill.count}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--gn-grey-dark)' }}>{drill.label}</div>
                  </div>
                ))}
              </div>

              <CTAButton 
                type="trial"
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setShowLoginModal(true)}
                className="px-6 py-3"
              >
                Start 7-day free trial
              </CTAButton>
            </div>

            {/* Right - Interactive Drill Animation */}
            <div>
              <DrillAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CASE RESOURCES SECTION ==================== */}
      <section 
        id="resources-section"
        className="py-20"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span 
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: 'var(--gn-rhino)' }}
          >
            <FileText className="w-4 h-4" />
            Case Interview Resources
          </span>
          <h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: 'var(--gn-rhino)' }}
          >
            Comprehensive Materials at Your Fingertips
          </h2>
          <p className="text-base mb-8 max-w-2xl mx-auto" style={{ color: 'var(--gn-grey-dark)' }}>
            Access casebooks from top business schools, framework templates, industry primers, and cheat sheets. Everything you need to prepare for any case type.
          </p>

          {/* Feature Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-12 mb-8">
            {[
              { icon: BookMarked, value: '100+', label: 'Practice Cases' },
              { icon: Layers, value: '15+', label: 'Frameworks' },
              { icon: FileText, value: '10+', label: 'Casebooks' },
              { icon: Download, value: '50+', label: 'Cheat Sheets' }
            ].map((item, idx) => (
              <div 
                key={idx}
                className="text-center"
              >
                <item.icon className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--gn-rhino)' }} />
                <div className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{item.value}</div>
                <div className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>{item.label}</div>
              </div>
            ))}
          </div>

          <CTAButton 
            type="trial"
            isLoggedIn={isLoggedIn}
            onLoginClick={() => setShowLoginModal(true)}
            className="px-6 py-3"
          >
            Start 7-day free trial
          </CTAButton>
        </div>
      </section>

      {/* ==================== PEER PRACTICE SECTION ==================== */}
      <section 
        id="peer-practice-section"
        className="py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Content */}
            <div>
              <span 
                className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                <Users className="w-4 h-4" />
                Peer-to-Peer Practice
              </span>
              <h2 
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                Practice with Driven Peers
              </h2>
              <p className="text-base mb-6" style={{ color: 'var(--gn-grey-dark)' }}>
                Nothing beats real practice with another person. Our smart matching algorithm connects you with peers at similar skill levels for structured case practice sessions.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { value: '< 5 min', label: 'Match Time' },
                  { value: '95%', label: 'Satisfaction' }
                ].map((stat, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl text-center"
                    style={{ background: '#e8ecff' }}
                  >
                    <div className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{stat.value}</div>
                    <div className="text-xs" style={{ color: 'var(--gn-grey-dark)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <CTAButton 
                type="trial"
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setShowLoginModal(true)}
                className="px-6 py-3"
              >
                Start 7-day free trial
              </CTAButton>
            </div>

            {/* Right - Floating Peer Connection Illustration with Real Photos */}
            <div className="relative">
              {/* Main Connection Illustration */}
              <div 
                className="bg-white rounded-xl p-6 shadow-xl"
                style={{
                  animation: 'float 6s ease-in-out infinite',
                  border: '4px solid white',
                  boxShadow: '0 20px 50px rgba(46, 53, 88, 0.15)'
                }}
              >
                <div className="flex items-center justify-center gap-6">
                  {/* User 1 - Real Photo */}
                  <div className="text-center">
                    <div 
                      className="w-20 h-20 rounded-full mx-auto mb-2 overflow-hidden ring-4 ring-white shadow-lg"
                      style={{ background: '#e8ecff' }}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" 
                        alt="Practice partner"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Rahul</div>
                    <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>Interviewer</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= 4 ? '#fbbf24' : '#e5e7eb' }}></div>
                      ))}
                    </div>
                  </div>

                  {/* Connection Animation */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#22c55e' }}></div>
                      <span className="text-xs font-medium" style={{ color: '#22c55e' }}>Live</span>
                    </div>
                    <div className="relative">
                      <div className="w-16 h-0.5" style={{ background: 'linear-gradient(90deg, var(--gn-rhino) 0%, var(--gn-chrome-yellow) 50%, var(--gn-rhino) 100%)' }}></div>
                      <Video className="w-8 h-8 absolute -top-4 left-1/2 -translate-x-1/2 p-1.5 rounded-full bg-white shadow-md" style={{ color: 'var(--gn-rhino)' }} />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>1.5 hour session</div>
                  </div>

                  {/* User 2 - Real Photo */}
                  <div className="text-center">
                    <div 
                      className="w-20 h-20 rounded-full mx-auto mb-2 overflow-hidden ring-4 ring-white shadow-lg"
                      style={{ background: '#e8ecff' }}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" 
                        alt="Practice partner"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Priya</div>
                    <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>Interviewee</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= 4 ? '#fbbf24' : '#e5e7eb' }}></div>
                      ))}
                    </div>
                  </div>
                </div>

                <div 
                  className="mt-5 p-3 rounded-lg text-center text-sm"
                  style={{ background: 'linear-gradient(135deg, #e8ecff 0%, #f5f3ff 100%)', color: 'var(--gn-rhino)' }}
                >
                  <Sparkles className="w-4 h-4 inline mr-2" style={{ color: '#fbbf24' }} />
                  Matched based on skill level & availability
                </div>
              </div>

              {/* Floating Feedback Card */}
              <div 
                className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-lg max-w-[180px]"
                style={{
                  animation: 'float-delayed 5s ease-in-out infinite',
                  border: '2px solid #e8ecff'
                }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)' }}>
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Mutual Feedback</div>
                <div className="text-xs" style={{ color: 'var(--gn-grey)' }}>After each session</div>
              </div>

              {/* Floating Online Users Card */}
              <div 
                className="absolute -top-4 -left-4 bg-white rounded-xl p-3 shadow-lg"
                style={{
                  animation: 'float 5s ease-in-out infinite',
                  border: '2px solid #e8ecff'
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&q=80" className="w-6 h-6 rounded-full ring-2 ring-white object-cover" alt="" />
                    <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&q=80" className="w-6 h-6 rounded-full ring-2 ring-white object-cover" alt="" />
                    <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50&q=80" className="w-6 h-6 rounded-full ring-2 ring-white object-cover" alt="" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--gn-rhino)' }}>127 online</div>
                    <div className="text-[10px]" style={{ color: '#22c55e' }}>Ready to match</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS SECTION ==================== */}
      <TestimonialsCarousel 
        page="subscription"
        title="What Our Candidates Say"
        subtitle="Join hundreds of successful consultants who trusted gradnext for their preparation"
      />

      {/* ==================== PRICING SECTION ==================== */}
      <section 
        id="pricing-section"
        className="py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span 
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--gn-rhino)' }}
            >
              Pricing
            </span>
            <h2 
              className="text-3xl md:text-4xl font-bold mt-3 mb-4"
              style={{ color: 'var(--gn-rhino)' }}
            >
              Choose Your Plan
            </h2>
            <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: 'var(--gn-grey-dark)' }}>
              Start with a 7-day free trial. Cancel anytime.
            </p>

            {/* Billing Toggle */}
            <div 
              className="inline-flex items-center p-1.5 rounded-full"
              style={{ background: 'white' }}
            >
              <button
                onClick={() => setBillingCycle('monthly')}
                className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={{ 
                  backgroundColor: billingCycle === 'monthly' ? 'var(--gn-rhino)' : 'transparent',
                  color: billingCycle === 'monthly' ? 'white' : 'var(--gn-grey-dark)'
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('6-month')}
                className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
                style={{ 
                  backgroundColor: billingCycle === '6-month' ? 'var(--gn-rhino)' : 'transparent',
                  color: billingCycle === '6-month' ? 'white' : 'var(--gn-grey-dark)'
                }}
              >
                6-Monthly
                <span 
                  className="px-2 py-0.5 text-xs font-bold rounded-full"
                  style={{ 
                    backgroundColor: billingCycle === '6-month' ? 'var(--gn-chrome-yellow)' : '#e8ecff',
                    color: 'var(--gn-rhino)' 
                  }}
                >
                  {isPromoActive() ? `Save ${PROMO_SIX_MONTH_TOTAL_SAVING_PCT}%` : 'Save 20%'}
                </span>
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mb-16 px-2 sm:px-0">
            {plans.map((plan, idx) => {
              const monthlyPrice = billingCycle === '6-month' 
                ? (plan.pricing?.six_month || plan.price)
                : (plan.pricing?.one_month || plan.price);
              const isHighlighted = plan.highlight;

              // 30% off campaign — applies to 6-month subscription plans only.
              // Excludes free plans (price 0) and one-time/coaching plans.
              const isPromoEligible = (
                billingCycle === '6-month' &&
                isPromoActive() &&
                monthlyPrice > 0 &&
                !plan.pricing?.one_time
              );
              const discountedMonthlyPrice = isPromoEligible
                ? Math.round(monthlyPrice * (1 - PROMO_PERCENT / 100))
                : monthlyPrice;

              const cardContent = (
                <div className="relative h-full">
                  {/* Popular Badge - outside overflow container */}
                  {isHighlighted && (
                    <div 
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold uppercase whitespace-nowrap z-20"
                      style={{ 
                        background: 'var(--gn-chrome-yellow)',
                        color: 'var(--gn-rhino)'
                      }}
                    >
                      Most Popular
                    </div>
                  )}

                  {/* SAVE 30% ribbon — only when 6-month promo active */}
                  {isPromoEligible && (
                    <div
                      data-testid={`promo-ribbon-${plan.plan_key || plan.id || idx}`}
                      className="absolute -top-3 -right-3 z-20 rotate-3"
                    >
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
                    className="relative rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full overflow-hidden"
                    style={{ 
                      background: isHighlighted 
                        ? 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-light) 100%)'
                        : 'white',
                      border: isHighlighted ? 'none' : '1px solid #e5e7eb',
                      boxShadow: isHighlighted 
                        ? '0 8px 32px rgba(46, 53, 88, 0.25)' 
                        : '0 2px 12px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    {/* Decorative circles for highlighted card */}
                    {isHighlighted && (
                      <>
                        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15" style={{ background: 'var(--gn-periwinkle)' }}></div>
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: 'var(--gn-periwinkle-light)' }}></div>
                      </>
                    )}

                    {/* In-card promo strip — auto-applied messaging */}
                    {isPromoEligible && (
                      <div
                        className="relative z-10 flex items-center gap-2 px-5 py-2 text-xs font-semibold"
                        style={{
                          background: isHighlighted ? 'rgba(255,166,1,0.18)' : '#FFF6E0',
                          color: isHighlighted ? '#FFD68A' : '#9A6B00',
                          borderBottom: isHighlighted
                            ? '1px solid rgba(255,255,255,0.1)'
                            : '1px solid #FFE6B7',
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {PROMO_PERCENT}% off · Auto-applied at checkout
                      </div>
                    )}

                  <div className="p-6 md:p-8 relative z-10">
                    {/* Plan Name */}
                    <h3 
                      className="text-xl font-semibold mb-3"
                      style={{ color: isHighlighted ? 'white' : 'var(--gn-rhino)' }}
                    >
                      {plan.name}
                    </h3>

                    {/* Price Section */}
                    <div className="mb-4">
                      <p className="text-sm mb-1" style={{ color: isHighlighted ? 'rgba(255,255,255,0.7)' : 'var(--gn-grey)' }}>Starts at</p>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {isPromoEligible && (
                          <span
                            className="text-lg line-through"
                            style={{ color: isHighlighted ? 'rgba(255,255,255,0.55)' : '#9CA3AF' }}
                          >
                            ₹{monthlyPrice?.toLocaleString()}
                          </span>
                        )}
                        <span 
                          className="text-4xl font-bold"
                          style={{ color: isHighlighted ? 'white' : 'var(--gn-rhino)' }}
                        >
                          ₹{discountedMonthlyPrice?.toLocaleString()}
                        </span>
                        <span className="text-base" style={{ color: isHighlighted ? 'rgba(255,255,255,0.7)' : 'var(--gn-grey)' }}>
                          /month
                        </span>
                      </div>
                      {isPromoEligible && (
                        <p
                          className="text-xs mt-1 font-medium flex items-center gap-1"
                          style={{ color: isHighlighted ? '#FFD68A' : '#9A6B00' }}
                        >
                          <Clock className="w-3 h-3" /> You save ₹{(monthlyPrice - discountedMonthlyPrice)?.toLocaleString()}/mo · ends {formatPromoEndDate()}
                        </p>
                      )}
                    </div>

                    {/* CTA Button */}
                    <button
                      className="w-full py-2.5 rounded-lg font-medium transition-all text-sm mb-6"
                      style={{ 
                        backgroundColor: isHighlighted ? 'var(--gn-chrome-yellow)' : 'transparent',
                        color: 'var(--gn-rhino)',
                        border: isHighlighted ? 'none' : '2px solid var(--gn-rhino)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isHighlighted) {
                          e.currentTarget.style.backgroundColor = 'var(--gn-rhino)';
                          e.currentTarget.style.color = 'white';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isHighlighted) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--gn-rhino)';
                        }
                      }}
                      onClick={() => handlePlanClick(plan)}
                    >
                      Get Started
                    </button>

                    {/* Separator */}
                    <div 
                      className="mb-6 h-px"
                      style={{ backgroundColor: isHighlighted ? 'rgba(255,255,255,0.2)' : 'rgba(140, 157, 255, 0.15)' }}
                    />

                    {/* Features Label */}
                    <p 
                      className="font-semibold mb-4 text-sm"
                      style={{ color: isHighlighted ? 'white' : 'var(--gn-rhino)' }}
                    >
                      {idx === 0 ? "What's included:" : "Everything in previous, plus:"}
                    </p>

                    {/* Features List - Using shared utility for consistency */}
                    <ul className="space-y-3">
                      {generatePlanFeatureList(plan, drillCounts).slice(0, 9).map((feature, fidx) => (
                        <li key={fidx} className="flex items-start gap-3">
                          <CheckCircle2 
                            className="w-5 h-5 flex-shrink-0 mt-0.5" 
                            style={{ color: isHighlighted ? 'var(--gn-chrome-yellow)' : 'var(--gn-periwinkle)' }}
                          />
                          <span 
                            className="text-sm"
                            style={{ color: isHighlighted ? 'rgba(255,255,255,0.9)' : 'var(--gn-grey-dark)' }}
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

                return <div key={plan.id} className={isHighlighted ? 'pt-3' : ''}>{cardContent}</div>;
            })}
          </div>

          {/* Free Trial Note */}
          <p className="text-center text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
            Start a{' '}
            <button
              onClick={() => isLoggedIn ? navigate('/dashboard') : setShowLoginModal(true)}
              className="font-semibold underline"
              style={{ color: 'var(--gn-rhino)' }}
            >
              free trial
            </button>
            {' '}now. No credit card required.
          </p>
        </div>
      </section>

      {/* ==================== FAQ SECTION ==================== */}
      <section 
        className="py-12 relative overflow-hidden"
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
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>
                Frequently Asked Questions
              </h2>
              <p className="text-base" style={{ color: 'var(--gn-grey-dark)' }}>
                Everything you need to know about our subscription plans. Can&apos;t find an answer? 
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
                {faqs.map((faq, idx) => (
                  <AccordionItem 
                    key={idx} 
                    value={`faq-${idx}`}
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

          {/* Final CTA */}
          <div className="text-center mt-12">
            <p className="mb-6" style={{ color: 'var(--gn-grey-dark)' }}>
              Ready to start your consulting journey?
            </p>
            <div className="flex justify-center">
              <CTAButton 
                type="trial"
                size="lg"
                className="px-8 py-4"
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setShowLoginModal(true)}
              >
                Start 7-Day Free Trial
              </CTAButton>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Modal */}
      <ContactFormModal
        isOpen={showContactFormModal}
        onClose={() => setShowContactFormModal(false)}
      />
      
      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedPlan(null);
        }}
        plan={selectedPlan}
        billingCycle={billingCycle}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default SubscriptionLanding;
