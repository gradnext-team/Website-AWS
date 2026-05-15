/**
 * GetStarted — high-conversion, mobile-first subscription landing page.
 *
 * Lives at /get-started, parallel to /subscription (kept for A/B testing).
 * Reuses the same plan-fetch, PaymentModal, LoginModal, and promo logic so
 * checkout works identically — only the marketing wrapper changes.
 *
 * Conversion levers used here:
 *   - Single bold hero with one primary CTA
 *   - Trust strip immediately under the fold (logos + rating)
 *   - Placement stats banner ("120+ McKinsey offers …")
 *   - Focused pricing — only 6-month billing shown by default (lower price/mo)
 *   - 30% promo ribbon + crossed-out anchor price
 *   - Testimonials carousel
 *   - 6-question objection-handling FAQ
 *   - Sticky mobile bottom bar with "Offer ending soon · Starting at ₹X/mo"
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Star, ShieldCheck, CheckCircle2, Clock, ArrowRight,
  Video, Calendar, Target, Users, Tag, Flame, Award, ChevronDown,
} from 'lucide-react';
import LoginModal from '../../components/LoginModal';
import PaymentModal from '../../components/PaymentModal';
import TestimonialsCarousel from '../../components/TestimonialsCarousel';
import LogoStrip from '../../components/LogoStrip';
import {
  isPromoActive,
  PROMO_PERCENT,
  PROMO_SIX_MONTH_TOTAL_SAVING_PCT,
  formatPromoEndDate,
} from '../../data/promoCampaign';
import { generatePlanFeatureList } from '../../utils/planFeatures';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── FAQ data (objection-handling) ────────────────────────────────────────────
const FAQS = [
  {
    q: 'How does the 7-day free trial work?',
    a: 'You get full access to video courses, drills, and peer practice for 7 days. No charge until day 7. Cancel anytime from your dashboard, no questions asked.',
  },
  {
    q: 'Is this worth it vs free YouTube content?',
    a: 'Free content teaches the basics. Our platform gives you 500+ structured drills with feedback, live workshops with ex-MBB consultants, and peer practice partners matched by prep level. The exact combo proven to land offers.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your dashboard in 2 clicks. If you cancel during the trial, you are not charged. If you cancel mid-subscription, you keep access until the period ends.',
  },
  {
    q: 'Do you offer 1:1 mentorship?',
    a: 'Subscription plans include peer practice + recorded mentor sessions. For 1:1 mock interviews with ex-MBB mentors, check out our Coaching plans (linked from your dashboard).',
  },
  {
    q: 'What if I am still in college?',
    a: 'Most of our candidates are pre-final year & final year students. The 6-month plan is designed exactly for your timeline, so you can finish all 9 modules before your campus placement season.',
  },
  {
    q: 'What payment options do you accept?',
    a: 'UPI, all major cards, net banking, and wallets via Razorpay.',
  },
];

// ── Reusable: FAQ accordion item ────────────────────────────────────────────
const FaqItem = ({ q, a, isOpen, onToggle }) => (
  <div className="border-b border-slate-200 last:border-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 py-4 text-left"
      data-testid="getstarted-faq-toggle"
    >
      <span className="font-medium text-slate-900 text-sm md:text-base">{q}</span>
      <ChevronDown
        className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
    {isOpen && (
      <p className="text-sm text-slate-600 leading-relaxed pb-4 pr-9">{a}</p>
    )}
  </div>
);

// ── Page ────────────────────────────────────────────────────────────────────
const GetStarted = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState('6-month');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(true);

  // ── Data load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, { credentials: 'include', headers });
        setIsLoggedIn(res.ok);
      } catch {
        setIsLoggedIn(false);
      }
    };

    const fetchPlans = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/resources/plans?category=subscription`);
        if (res.ok) {
          const data = await res.json();
          setPlans(
            (data.plans || []).filter(p => p.is_visible !== false && p.plan_key !== 'free_trial')
          );
        }
      } catch (err) {
        console.error('Failed to fetch plans', err);
      }
    };

    checkAuth();
    fetchPlans();
  }, []);

  // Hide sticky bar when user scrolls near the footer to avoid blocking final CTA
  useEffect(() => {
    const onScroll = () => {
      const footer = document.getElementById('gs-final-cta');
      if (!footer) return;
      const rect = footer.getBoundingClientRect();
      // hide once final CTA is within the viewport
      setShowStickyBar(rect.top > window.innerHeight - 100);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cheapest visible plan (for sticky bar "Starting at ₹X/mo")
  const startingPrice = useMemo(() => {
    if (!plans.length) return null;
    const prices = plans
      .map(p => (billingCycle === '6-month' ? p.pricing?.six_month : p.pricing?.one_month) || p.price)
      .filter(p => Number.isFinite(p) && p > 0);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const promoActive = isPromoActive() && billingCycle === '6-month';
    return promoActive ? Math.round(min * (1 - PROMO_PERCENT / 100)) : min;
  }, [plans, billingCycle]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handlePlanClick = (plan) => {
    setSelectedPlan(plan);
    if (isLoggedIn) setShowPaymentModal(true);
    else setShowLoginModal(true);
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setShowLoginModal(false);
    if (selectedPlan) setShowPaymentModal(true);
    else navigate('/dashboard');
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
    navigate('/dashboard');
  };

  // CTA: "Subscribe Now" → scroll to plans on click. If logged in already and
  // there's a popular plan, jump straight to that plan's checkout.
  const handleStickyCTA = () => {
    const el = document.getElementById('gs-plans');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // "Start your 7-day free trial" hero CTA — mirrors Home.jsx behavior:
  //   • Already logged in → straight to /dashboard.
  //   • Not logged in → open the LoginModal so the user can sign up
  //     and start their free trial in one step.
  // Before this change the hero CTA scrolled the user to the plans
  // section instead, which felt like the wrong action for a "start
  // free trial" button (it should open auth, not a price ladder).
  const handleHeroCTA = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
      return;
    }
    setSelectedPlan(null);
    setShowLoginModal(true);
  };

  const promoActive = isPromoActive();

  // Benefit cards
  const benefits = [
    { icon: Video, title: '30+ hrs Video', sub: 'Full curriculum' },
    { icon: Target, title: '500+ Drills', sub: 'With AI feedback' },
    { icon: Calendar, title: 'Live Workshops', sub: 'Weekly · ex-MBB' },
    { icon: Users, title: 'Peer Practice', sub: 'Smart matched' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────
  // Public URL of the WhatsApp banner — used as the hero image.
  const HERO_BANNER_URL = 'https://customer-assets.emergentagent.com/job_strategy-prep-1/artifacts/wx89hoiz_WhatsApp%20Image%202026-04-20%20at%204.26.58%20PM.jpeg';

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white pb-32 md:pb-12">
      {/* ── Hero (banner image + scroll-to-plans CTA) ────────────────── */}
      <section className="px-3 sm:px-4 pt-24 md:pt-8 pb-6 md:pb-10 max-w-6xl mx-auto">
        {promoActive && (
          <div
            data-testid="getstarted-promo-pill"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
            style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
          >
            <Flame className="w-3.5 h-3.5" />
            {PROMO_PERCENT}% OFF on 6-month plans · Offer ending soon
          </div>
        )}

        {/* Clickable hero banner — wraps the WhatsApp banner image so the
            entire visual (including the embedded "Start Your Free Trial
            Today" CTA inside the image) scrolls the user to the plans
            section. Keeps the original design intent of the image without
            us having to align an overlay button to the embedded CTA. */}
        <button
          onClick={handleHeroCTA}
          data-testid="getstarted-hero-cta"
          aria-label="Start your free trial, view plans"
          className="block w-full overflow-hidden rounded-2xl md:rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl transition-all group focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        >
          <img
            src={HERO_BANNER_URL}
            alt="Make Your Consulting Dream Easy. Start your free trial today"
            className="w-full h-auto block group-hover:scale-[1.01] transition-transform duration-500"
            loading="eager"
          />
        </button>

        {/* Compact CTA row below the banner — also gives a clear,
            keyboard-accessible action button (the image itself is one big
            button, but a dedicated text button is more conventional). */}
        <div className="mt-4 md:mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <button
            onClick={handleHeroCTA}
            data-testid="getstarted-hero-cta-text"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
          >
            Start your 7-day free trial
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('gs-benefits');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            data-testid="getstarted-hero-secondary"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-semibold transition-all"
          >
            How it works
          </button>
          <div className="flex items-center gap-3 text-sm flex-wrap sm:ml-auto">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <Star key={i} className="w-4 h-4" style={{ fill: 'var(--gn-chrome-yellow)', color: 'var(--gn-chrome-yellow)' }} />
              ))}
            </div>
            <span className="text-slate-700 font-medium hidden sm:inline">4.9 · 5,000+ candidates</span>
            <span className="text-slate-300 hidden md:inline">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Cancel anytime
            </span>
          </div>
        </div>
      </section>

      {/* ── Social proof — placement stats ────────────────────────────── */}
      <section className="bg-slate-900 text-white py-8 md:py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs md:text-sm uppercase tracking-wider text-slate-400 font-semibold mb-5">
            Mentors & Alumni from
          </p>
          {/* `variant="dark"` inverts logos to white so they're actually
              visible on this dark slate-900 background. */}
          <LogoStrip variant="dark" />
          <div className="mt-8 grid grid-cols-2 gap-4 md:gap-6 text-center max-w-lg mx-auto">
            {[
              { n: '5,000+', l: 'Candidates trained' },
              { n: '4.9 / 5', l: 'Average rating' },
            ].map(stat => (
              <div key={stat.l}>
                <div className="text-2xl md:text-4xl font-bold" style={{ color: 'var(--gn-chrome-yellow)' }}>{stat.n}</div>
                <div className="text-xs md:text-sm text-slate-300 mt-1">{stat.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────────────────── */}
      <section id="gs-benefits" className="py-12 md:py-16 px-4 max-w-6xl mx-auto scroll-mt-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center">
          Everything you need to crack the case
        </h2>
        <p className="text-center text-slate-600 mt-2 text-sm md:text-base">
          One subscription. Full prep ecosystem.
        </p>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {benefits.map(b => (
            <div
              key={b.title}
              className="p-4 md:p-6 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <b.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm md:text-base">{b.title}</h3>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">{b.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="gs-plans" className="py-12 md:py-16 px-4 max-w-6xl mx-auto scroll-mt-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Pick your plan</h2>
          <p className="text-slate-600 mt-2 text-sm md:text-base">
            7-day free trial · Cancel anytime · No hidden fees
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 bg-slate-100 rounded-full" data-testid="getstarted-billing-toggle">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 md:px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-600'
              }`}
              data-testid="getstarted-billing-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('6-month')}
              className={`px-4 md:px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === '6-month'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-600'
              }`}
              data-testid="getstarted-billing-six-month"
            >
              6 Month
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  billingCycle === '6-month' ? 'text-white' : 'bg-blue-100 text-blue-700'
                }`}
                style={billingCycle === '6-month' ? { background: 'var(--gn-rhino)' } : undefined}
              >
                {promoActive ? `SAVE ${PROMO_SIX_MONTH_TOTAL_SAVING_PCT}%` : 'SAVE 20%'}
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {plans.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            plans.map((plan, idx) => {
              const monthlyPrice =
                billingCycle === '6-month'
                  ? plan.pricing?.six_month || plan.price
                  : plan.pricing?.one_month || plan.price;

              const isPromoEligible =
                promoActive &&
                billingCycle === '6-month' &&
                plan.plan_key !== 'free_trial' &&
                monthlyPrice > 0;

              const discountedMonthlyPrice = isPromoEligible
                ? Math.round(monthlyPrice * (1 - PROMO_PERCENT / 100))
                : monthlyPrice;

              const isPopular = plan.is_popular || idx === 0; // first card by default
              const features = generatePlanFeatureList(plan, billingCycle);

              return (
                <div
                  key={plan.id || plan.plan_key || idx}
                  data-testid={`getstarted-plan-${plan.plan_key || idx}`}
                  className={`relative rounded-2xl border bg-white p-5 md:p-6 flex flex-col transition-all hover:shadow-xl ${
                    isPopular ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200'
                  }`}
                >
                  {isPromoEligible && (
                    <div
                      data-testid={`getstarted-promo-ribbon-${plan.plan_key || idx}`}
                      className="absolute -top-3 left-4 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full text-white"
                      style={{ background: 'var(--gn-chrome-yellow)' }}
                    >
                      <Tag className="w-3 h-3" /> SAVE {PROMO_PERCENT}%
                    </div>
                  )}
                  {isPopular && !isPromoEligible && (
                    <div className="absolute -top-3 left-4 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-full">
                      <Sparkles className="w-3 h-3" /> MOST POPULAR
                    </div>
                  )}
                  {isPopular && isPromoEligible && (
                    <div className="absolute -top-3 right-4 inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-full">
                      <Sparkles className="w-3 h-3" /> POPULAR
                    </div>
                  )}

                  <h3 className="font-semibold text-slate-900 text-lg">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[2.5rem]">
                    {plan.tagline || plan.description?.slice(0, 80) || ''}
                  </p>

                  <div className="mt-4 mb-4">
                    <p className="text-xs text-slate-500">Starts at</p>
                    <div className="flex items-baseline gap-2 flex-wrap mt-1">
                      {isPromoEligible && (
                        <span className="text-base line-through text-slate-400">
                          ₹{monthlyPrice?.toLocaleString()}
                        </span>
                      )}
                      <span className="text-3xl md:text-4xl font-bold text-slate-900">
                        ₹{discountedMonthlyPrice?.toLocaleString()}
                      </span>
                      <span className="text-sm text-slate-500">/mo</span>
                    </div>
                    {isPromoEligible && (
                      <p className="text-[11px] mt-1 font-medium flex items-center gap-1" style={{ color: 'var(--gn-rhino-medium)' }}>
                        <Clock className="w-3 h-3" />
                        Save ₹{(monthlyPrice - discountedMonthlyPrice)?.toLocaleString()}/mo · ends {formatPromoEndDate()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handlePlanClick(plan)}
                    data-testid={`getstarted-plan-cta-${plan.plan_key || idx}`}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      isPopular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    Subscribe Now
                  </button>

                  <ul className="mt-5 space-y-2 text-sm text-slate-600 flex-1">
                    {features.slice(0, 6).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="py-12 md:py-16 px-4 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-2">
          Real candidates. Real offers.
        </h2>
        <p className="text-center text-slate-600 mb-8 text-sm md:text-base">
          From last campus placement season
        </p>
        <TestimonialsCarousel />
      </section>

      {/* ── Why Trust Us ─────────────────────────────────────────────── */}
      <section className="py-10 md:py-14 px-4 max-w-6xl mx-auto">
        <div className="rounded-3xl p-6 md:p-12 text-white" style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-rhino-medium) 100%)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <Award className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--gn-chrome-yellow)' }} />
              <div className="text-3xl md:text-4xl font-bold">₹50Cr+</div>
              <div className="text-sm mt-1" style={{ color: 'var(--gn-periwinkle-light)' }}>in offers received by alumni</div>
            </div>
            <div>
              <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--gn-chrome-yellow)' }} />
              <div className="text-3xl md:text-4xl font-bold">5,000+</div>
              <div className="text-sm mt-1" style={{ color: 'var(--gn-periwinkle-light)' }}>candidates trained</div>
            </div>
            <div>
              <Star className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--gn-chrome-yellow)', fill: 'var(--gn-chrome-yellow)' }} />
              <div className="text-3xl md:text-4xl font-bold">4.9 / 5</div>
              <div className="text-sm mt-1" style={{ color: 'var(--gn-periwinkle-light)' }}>average candidate rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="gs-faq" className="py-12 md:py-16 px-4 max-w-3xl mx-auto scroll-mt-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 text-center mb-2">
          Common questions
        </h2>
        <p className="text-center text-slate-600 mb-8 text-sm md:text-base">
          Quick answers to help you decide
        </p>
        <div className="bg-white rounded-2xl border border-slate-200 px-5 md:px-7">
          {FAQS.map((f, i) => (
            <FaqItem
              key={i}
              q={f.q}
              a={f.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
            />
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section id="gs-final-cta" className="py-12 md:py-20 px-4 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
          Ready to start your prep?
        </h2>
        <p className="text-slate-600 mt-3 text-sm md:text-base">
          Join 5,000+ candidates. Get full access for 7 days, free.
        </p>
        <button
          onClick={handleHeroCTA}
          data-testid="getstarted-final-cta"
          className="mt-6 inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-xl shadow-blue-600/30 transition-all hover:scale-[1.02]"
        >
          Start Your 7-Day Free Trial
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-xs text-slate-400 mt-4">
          No credit card required · Cancel anytime
        </p>
      </section>

      {/* ── Sticky mobile bottom bar (floating pill, leaves room for WhatsApp icon on the right) ─────────────────────────── */}
      {showStickyBar && (
        <div
          data-testid="getstarted-sticky-bar"
          className="fixed bottom-3 left-3 right-24 z-30 md:hidden rounded-2xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom"
          style={{ boxShadow: '0 12px 32px rgba(46,53,88,0.18)' }}
        >
          <div className="flex-1 min-w-0">
            {promoActive && (
              <div className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--gn-chrome-yellow)' }}>
                <Flame className="w-3 h-3" />
                Offer ending soon
              </div>
            )}
            <div className="text-sm font-semibold text-slate-900 truncate">
              {startingPrice
                ? <>Starting at <span className="text-blue-600">₹{startingPrice.toLocaleString()}</span>/mo</>
                : 'All-access subscription'}
            </div>
          </div>
          <button
            onClick={handleStickyCTA}
            data-testid="getstarted-sticky-cta"
            className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/30 transition-all active:scale-95"
          >
            Subscribe
          </button>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
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

export default GetStarted;

