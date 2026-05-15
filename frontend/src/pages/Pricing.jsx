import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import PinnacleApplicationModal from '../components/PinnacleApplicationModal';
import LoginModal from '../components/LoginModal';
import PaymentModal from '../components/PaymentModal';
import { isPromoActive, PROMO_PERCENT, PROMO_SIX_MONTH_TOTAL_SAVING_PCT, formatPromoEndDate } from '../data/promoCampaign';
import { fetchCurrentUser } from '../utils/authCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

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
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg w-64 text-left">
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
};

// Coming Soon Badge component
const ComingSoonBadge = () => (
  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
    Coming Soon
  </span>
);

const Pricing = () => {
  const navigate = useNavigate();
  const [dynamicPlans, setDynamicPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [drillCounts, setDrillCounts] = useState(null);
  const [courseModules, setCourseModules] = useState([]);
  const [planCategory, setPlanCategory] = useState('subscription');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPinnacleModal, setShowPinnacleModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await fetchCurrentUser();
        if (userData) setCurrentUser(userData);
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    checkAuth();
  }, []);

  // Sorted and filtered plans - subscription first, then coaching
  const sortedPlans = dynamicPlans
    .filter(p => p.visible !== false && p.plan_key !== 'free_trial' && (p.category === 'subscription' || p.category === 'coaching'))
    .sort((a, b) => {
      // Sort: subscription plans first, then coaching plans
      if (a.category === 'subscription' && b.category === 'coaching') return -1;
      if (a.category === 'coaching' && b.category === 'subscription') return 1;
      // Within same category, sort by price (or order if available)
      return (a.order || a.price || 0) - (b.order || b.price || 0);
    });

  // Fetch plans and course modules
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, drillCountsRes, coursesRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/resources/plans`),
          fetch(`${BACKEND_URL}/api/ai-drills/counts-by-tier`),
          fetch(`${BACKEND_URL}/api/resources/courses`)
        ]);
        
        if (plansRes.ok) {
          const data = await plansRes.json();
          setDynamicPlans(data.plans || []);
        }
        
        if (drillCountsRes.ok) {
          const countsData = await drillCountsRes.json();
          setDrillCounts(countsData);
        }
        
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          // Extract all modules from all courses
          const allModules = [];
          (coursesData.courses || []).forEach(course => {
            (course.modules || []).forEach(module => {
              allModules.push({
                id: module.id,
                name: module.name,
                courseName: course.name
              });
            });
          });
          setCourseModules(allModules);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setPlansLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleStartFreeTrial = () => {
    // If user is already logged in, redirect directly to dashboard
    if (currentUser) {
      navigate('/dashboard');
      return;
    }
    setLoginLoading(true);
    navigate('/signup');
  };

  const handlePlanClick = (plan) => {
    // For Pinnacle program, open the application modal
    if (plan.name === 'Pinnacle' || plan.plan_key === 'pinnacle') {
      setShowPinnacleModal(true);
      return;
    }
    
    setSelectedPlan(plan);
    
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
    // After login, show payment modal if a plan was selected
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

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero Section */}
      <section className="pt-32 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-600 mb-6">
            Start with a free trial or pick a plan that suits your preparation needs
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Two Category Toggle - Subscription & Coaching only */}
          <div className="flex justify-center mb-6">
            <div 
              className="inline-flex items-center p-1.5 rounded-full"
              style={{ 
                background: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: '0 4px 24px rgba(140, 157, 255, 0.15)'
              }}
            >
              <button
                onClick={() => setPlanCategory('subscription')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
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
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
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

          {/* Billing Cycle Toggle - Only for Subscription - with fixed space */}
          <div className="flex justify-center mb-6" style={{ minHeight: '40px' }}>
            {planCategory === 'subscription' && (
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
                    {isPromoActive() ? `-${PROMO_SIX_MONTH_TOTAL_SAVING_PCT}%` : '-20%'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gn-rhino)' }} />
            </div>
          ) : (
            <>
              {/* Detailed Feature Comparison Table */}
              <div className="max-w-7xl mx-auto" style={{ marginTop: '32px' }}>
                <h3 className="text-xl font-bold text-center mb-6" style={{ color: 'var(--gn-rhino)' }}>
                  Compare All Features
                </h3>
                
                {/* Mobile scroll hint */}
                <p className="md:hidden text-center text-xs text-slate-400 mb-2">
                  ← Scroll horizontally to see all plans →
                </p>
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ marginTop: '20px' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ minWidth: '800px' }}>
                    <colgroup>
                      <col style={{ width: '200px' }} />
                    </colgroup>
                      <thead>
                        <tr className="border-b border-slate-200" style={{ backgroundColor: 'var(--gn-grey-lightest)' }}>
                          <th className="text-left p-3 font-semibold sticky left-0 bg-slate-50 z-20" style={{ color: 'var(--gn-rhino)', minWidth: '200px' }}>Feature</th>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            // Get pricing based on billing cycle for subscription plans
                            let price = plan.pricing?.monthly || plan.pricing?.one_month || plan.price || 0;
                            let priceLabel = 'per month';
                            let showCustom = false;
                            
                            if (plan.name === 'Pinnacle') {
                              showCustom = true;
                            } else if (plan.category === 'subscription' && billingCycle === '6-month') {
                              price = plan.pricing?.six_month || plan.pricing?.['6_month'] || (plan.price ? Math.round(plan.price * 0.8) : 0);
                              priceLabel = 'per month';
                            } else if (plan.category === 'coaching') {
                              price = plan.price || 0;
                              priceLabel = 'one-time';
                            }
                            
                            // 30% off campaign — 6-month subscription plans only
                            const isPromoEligible = (
                              plan.category === 'subscription' &&
                              billingCycle === '6-month' &&
                              !showCustom &&
                              price > 0 &&
                              isPromoActive()
                            );
                            const promoPrice = isPromoEligible
                              ? Math.round(price * (1 - PROMO_PERCENT / 100))
                              : price;
                            
                            // Determine if plan is popular (Pro for subscription, Full Prep for coaching)
                            const isPopular = plan.name === 'Pro' || plan.name === 'Full Prep';
                            
                            return (
                              <th 
                                key={plan.id} 
                                className={`text-center transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ 
                                  color: isHighlighted ? 'var(--gn-rhino)' : 'var(--gn-grey)',
                                  backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.12)' : 'transparent',
                                  fontSize: '0.875rem',
                                  minHeight: '180px',
                                  verticalAlign: 'top',
                                  padding: '16px 16px 8px 16px',
                                  position: 'relative'
                                }}
                              >
                                {/* Most Popular Badge */}
                                {isPopular && isHighlighted && (
                                  <div 
                                    className="absolute left-1/2 transform -translate-x-1/2 px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap"
                                    style={{ 
                                      backgroundColor: 'var(--gn-chrome-yellow)', 
                                      color: 'var(--gn-rhino)',
                                      zIndex: 10,
                                      top: '-12px'
                                    }}
                                  >
                                    MOST POPULAR
                                  </div>
                                )}
                                
                                <div className="flex flex-col items-center" style={{ minHeight: '160px', justifyContent: 'space-between' }}>
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="font-bold text-sm" style={{ color: 'var(--gn-rhino)' }}>
                                      {plan.name}
                                    </div>
                                    {showCustom ? (
                                      <>
                                        <div className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                                          Custom
                                        </div>
                                        <div className="text-[10px] font-light text-slate-400" style={{ minHeight: '28px' }}>
                                          (Fixed + success-based fees)
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        {isPromoEligible && (
                                          <div className="text-xs line-through" style={{ color: '#9CA3AF', lineHeight: 1 }}>
                                            ₹{price.toLocaleString('en-IN')}
                                          </div>
                                        )}
                                        <div className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                                          ₹{promoPrice.toLocaleString('en-IN')}
                                        </div>
                                        <div className="text-xs font-light text-slate-400" style={{ minHeight: isPromoEligible ? '14px' : '28px' }}>
                                          {priceLabel}
                                        </div>
                                        {isPromoEligible && (
                                          <div
                                            className="text-[10px] font-semibold leading-tight text-center px-1"
                                            style={{ color: '#9A6B00' }}
                                          >
                                            {PROMO_PERCENT}% off · Auto-applied · Ends {formatPromoEndDate()}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <Button
                                    className="text-xs py-2 px-4 rounded-lg font-semibold transition-all hover-yellow-btn"
                                    style={{
                                      backgroundColor: isHighlighted ? 'var(--gn-rhino)' : 'var(--gn-grey)',
                                      color: 'white',
                                      opacity: isHighlighted ? 1 : 0.5
                                    }}
                                    onMouseEnter={(e) => {
                                      if (isHighlighted) {
                                        e.currentTarget.style.backgroundColor = 'var(--gn-chrome-yellow)';
                                        e.currentTarget.style.color = 'var(--gn-rhino)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (isHighlighted) {
                                        e.currentTarget.style.backgroundColor = 'var(--gn-rhino)';
                                        e.currentTarget.style.color = 'white';
                                      }
                                    }}
                                    onClick={() => handlePlanClick(plan)}
                                  >
                                    {plan.name === 'Pinnacle' ? 'Apply Now' : (plan.category === 'coaching' ? 'Enrol Now' : 'Get Started')}
                                  </Button>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Validity Row - First row */}
                        <tr className="border-b border-slate-100" style={{ backgroundColor: 'var(--gn-grey-lightest)' }}>
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Validity</span>
                              <InfoTooltip text="Duration of plan access" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            let validityText = '';
                            if (plan.category === 'subscription') {
                              validityText = billingCycle === 'monthly' ? '1 Month' : '6 Months';
                            } else if (plan.category === 'coaching') {
                              // Use validity_months from plan or default based on plan
                              if (plan.validity_months) {
                                validityText = `${plan.validity_months} Months`;
                              } else if (plan.plan_key === 'last_mile') {
                                validityText = '2 Months';
                              } else if (plan.plan_key === 'mid_mile') {
                                validityText = '3 Months';
                              } else if (plan.plan_key === 'full_prep') {
                                validityText = '6 Months';
                              } else if (plan.plan_key === 'pinnacle') {
                                validityText = '6 Months';
                              } else {
                                validityText = '—';
                              }
                            }
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.12)' : 'var(--gn-grey-lightest)' }}
                              >
                                <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{validityText}</span>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Personalized Dashboard - Yes for all */}
                        <tr className="border-b border-slate-100">
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Personalized Dashboard</span>
                              <InfoTooltip text="Track your progress and get personalized recommendations" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--gn-periwinkle)' }} />
                              </td>
                            );
                          })}
                        </tr>

                        {/* Course Recordings - Simple row */}
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="p-3 sticky left-0 bg-slate-50 z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Course Recordings</span>
                              <InfoTooltip text="Full access to video course library (35 hours) which includes: Basic case solving, Advanced case solving, Fit & BI interview, How to network, CV and cover letter building, and other important concepts." />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {plan.features?.course_recordings ? (
                                  <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--gn-periwinkle)' }} />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Case Drills - Always expanded */}
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="p-3 sticky left-0 bg-slate-50 z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Case Drills & Exercises</span>
                              <InfoTooltip text="Practice drills designed to help you target specific issues during your case solving and build core skills." />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            const tier = plan.plan_key === 'basic_plan' ? 'basic_plan' : 'full_access';
                            const totalDrills = (drillCounts?.counts?.[tier]?.case_math || 0) + 
                                              (drillCounts?.counts?.[tier]?.case_structuring || 0) +
                                              (drillCounts?.counts?.[tier]?.charts_exhibits || 0);
                            const totalQuestions = totalDrills * 10; // Each drill has ~10 questions
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {totalQuestions > 0 ? (
                                  <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{totalQuestions}+ Questions</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Drill sub-items - Always visible (excluding synthesis and brainstorming) */}
                        {['case_math', 'case_structuring', 'charts_exhibits'].map((drillType, index) => {
                          const labels = {
                            case_math: { label: 'Case Math', tooltip: 'Market sizing, percentages, ratios' },
                            case_structuring: { label: 'Structuring', tooltip: 'Framework building, issue trees' },
                            charts_exhibits: { label: 'Charts & Exhibits', tooltip: 'Data interpretation, insights' }
                          };
                          
                          return (
                            <tr key={drillType} className={`border-b ${index === 2 ? 'border-slate-100' : 'border-slate-50'}`}>
                              <td className="p-3 pl-10 sticky left-0 bg-white z-20">
                                <div className="flex items-center">
                                  <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>{labels[drillType].label}</span>
                                  <InfoTooltip text={labels[drillType].tooltip} />
                                </div>
                              </td>
                              {sortedPlans.map(plan => {
                                const isHighlighted = plan.category === planCategory;
                                const tier = plan.plan_key === 'basic_plan' ? 'basic_plan' : 'full_access';
                                const count = drillCounts?.counts?.[tier]?.[drillType] || 0;
                                const questions = count * 10; // Each drill has ~10 questions
                                return (
                                  <td 
                                    key={plan.id} 
                                    className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                    style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                                  >
                                    {questions > 0 ? (
                                      <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{questions}</span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Case Materials */}
                        <tr className="border-b border-slate-100">
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Case Materials & Casebooks</span>
                              <InfoTooltip text="Practice cases, solutions, frameworks" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {plan.features?.case_materials ? (
                                  <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--gn-periwinkle)' }} />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Workshops - Always expanded */}
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <td className="p-3 sticky left-0 bg-slate-50 z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Workshops</span>
                              <InfoTooltip text="Live interactive workshops to help you understand industries and dedicated topics in depth." />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {plan.features?.workshops === 'recorded_and_live' ? (
                                  <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Live + Recorded</span>
                                ) : plan.features?.workshops === 'only_recorded' ? (
                                  <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Recorded Only</span>
                                ) : plan.features?.workshops === 'none' ? (
                                  <span className="text-slate-400">—</span>
                                ) : plan.features?.workshop_count ? (
                                  <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{plan.features.workshop_count} sessions</span>
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--gn-periwinkle)' }} />
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Workshops - Industry Primers - Always visible */}
                        <tr className="border-b border-slate-50">
                          <td className="p-3 pl-10 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Industry Primers</span>
                              <InfoTooltip text="Deep dives into key industries" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            const workshopType = plan.features?.workshops;
                            // For coaching plans, show based on workshop type
                            const hasAccess = plan.features?.industry_primers || (plan.category === 'coaching' && workshopType && workshopType !== 'none');
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {hasAccess ? (
                                  workshopType === 'recorded_and_live' ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Live + Recorded</span>
                                  ) : workshopType === 'only_recorded' ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Recorded Only</span>
                                  ) : (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Live + Recorded</span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Workshops - Knowledge Sessions - Always visible */}
                        <tr className="border-b border-slate-100">
                          <td className="p-3 pl-10 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Knowledge Sessions</span>
                              <InfoTooltip text="Expert-led knowledge sharing sessions" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            const workshopType = plan.features?.workshops;
                            // For coaching plans, show based on workshop type
                            const hasAccess = plan.features?.knowledge_sessions || (plan.category === 'coaching' && workshopType && workshopType !== 'none');
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {hasAccess ? (
                                  workshopType === 'recorded_and_live' ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Live + Recorded</span>
                                  ) : workshopType === 'only_recorded' ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Recorded Only</span>
                                  ) : (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Live + Recorded</span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Peer-to-Peer Practice - from admin panel */}
                        <tr className="border-b border-slate-100">
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Peer-to-Peer Practice</span>
                              <InfoTooltip text="Case practice with driven individuals and get real-time feedback" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            const peerSessions = plan.features?.peer_sessions_per_month;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {peerSessions && peerSessions !== 0 ? (
                                  peerSessions === -1 || peerSessions >= 999 ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Unlimited</span>
                                  ) : (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{peerSessions}/month</span>
                                  )
                                ) : plan.features?.peer_to_peer === 'unlimited' ? (
                                  <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Unlimited</span>
                                ) : plan.features?.peer_to_peer === '1_per_week' ? (
                                  <span className="text-sm" style={{ color: '#1a1f3d' }}>4/month</span>
                                ) : plan.features?.peer_to_peer === '2_per_week' ? (
                                  <span className="text-sm" style={{ color: '#1a1f3d' }}>8/month</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* 1-on-1 Coaching Sessions - from admin panel */}
                        <tr className="border-b border-slate-100" style={{ backgroundColor: 'var(--gn-grey-lightest)' }}>
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>1-on-1 Coaching Sessions</span>
                              <InfoTooltip text="Personalized feedback from McKinsey, BCG, and Bain coaches" />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            const coachingSessions = plan.features?.coaching_sessions;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.12)' : 'var(--gn-grey-lightest)' }}
                              >
                                {coachingSessions && coachingSessions !== 0 ? (
                                  coachingSessions === -1 || coachingSessions >= 999 ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Unlimited</span>
                                  ) : (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{coachingSessions} Sessions</span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Strategy Planning Calls - from admin panel */}
                        <tr className="border-b border-slate-100">
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Strategy Planning Calls</span>
                              <InfoTooltip text="A 30-minute call with an MBB consultant to help you build your roadmap, plus a dedicated MBB coach available on WhatsApp and call to track your progress." />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            const strategyCalls = plan.features?.strategy_calls;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {strategyCalls && strategyCalls !== 0 ? (
                                  strategyCalls === -1 || strategyCalls >= 999 ? (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>Unlimited</span>
                                  ) : (
                                    <span className="text-sm font-semibold" style={{ color: 'var(--gn-periwinkle)' }}>{strategyCalls}</span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Dedicated Coach - show tick for Full Prep and Pinnacle */}
                        <tr className="border-b border-slate-100" style={{ backgroundColor: 'var(--gn-grey-lightest)' }}>
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Dedicated Coach</span>
                              <InfoTooltip text="A dedicated MBB coach onboarded on WhatsApp to create your personalized coaching plan and track your progress." />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            // Show tick for Full Prep and Pinnacle
                            const hasDedicatedCoach = plan.plan_key === 'full_prep' || plan.plan_key === 'pinnacle' || plan.features?.dedicated_coach;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.12)' : 'var(--gn-grey-lightest)' }}
                              >
                                {hasDedicatedCoach ? (
                                  <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--gn-periwinkle)' }} />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Priority Support - show tick for Full Prep and Pinnacle */}
                        <tr>
                          <td className="p-3 sticky left-0 bg-white z-20">
                            <div className="flex items-center">
                              <span className="font-semibold text-sm" style={{ color: '#1a1f3d' }}>Priority Support</span>
                              <InfoTooltip text="Support over call and WhatsApp to ensure you get round-the-clock assistance." />
                            </div>
                          </td>
                          {sortedPlans.map(plan => {
                            const isHighlighted = plan.category === planCategory;
                            // Show tick for Full Prep and Pinnacle
                            const hasPrioritySupport = plan.plan_key === 'full_prep' || plan.plan_key === 'pinnacle' || plan.features?.priority_support;
                            return (
                              <td 
                                key={plan.id} 
                                className={`text-center p-3 transition-all ${!isHighlighted ? 'opacity-40' : ''}`}
                                style={{ backgroundColor: isHighlighted ? 'rgba(139, 146, 255, 0.08)' : 'transparent' }}
                              >
                                {hasPrioritySupport ? (
                                  <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--gn-periwinkle)' }} />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        
                        {/* More features can be added here following the same pattern */}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
      
      {/* Pinnacle Application Modal */}
      <PinnacleApplicationModal
        isOpen={showPinnacleModal}
        onClose={() => setShowPinnacleModal(false)}
        onSuccess={() => {
          console.log('Pinnacle application submitted');
        }}
      />
      
      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setSelectedPlan(null);
        }}
        onSuccess={handleLoginSuccess}
        skipNavigation={!!selectedPlan}
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

export default Pricing;
