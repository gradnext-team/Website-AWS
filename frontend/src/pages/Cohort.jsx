import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { fetchCurrentUser } from '../utils/authCache';
import { fetchCohortCached } from '../utils/cohortsCache';
import {
  Sparkles, CheckCircle2, Check, Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../components/ui/accordion';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import LogoStrip from '../components/LogoStrip';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import DiscoveryCallModal from '../components/DiscoveryCallModal';
import CohortHero from '../components/cohort/CohortHero';
import CohortWhatYouLearn from '../components/cohort/CohortWhatYouLearn';
import CohortWhoIsItFor from '../components/cohort/CohortWhoIsItFor';
import CohortIncluded from '../components/cohort/CohortIncluded';
import CohortEnrolBanner from '../components/cohort/CohortEnrolBanner';
import CohortSchedule from '../components/cohort/CohortSchedule';
import CohortTestimonials from '../components/cohort/CohortTestimonials';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Cohort() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [bookCallOpen, setBookCallOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  // Cohort plans pulled from Plans Management (admin-controlled).
  // Each plan has offerings[] derived from structured features.
  const [plans, setPlans] = useState([]);
  // Selected plan — set when user clicks "Enrol now" on a specific pricing card.
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    (async () => {
      try { const userData = await fetchCurrentUser(); if (userData) setUser(userData); } catch { /* not logged in */ }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCohortCached(`${BACKEND_URL}/api/cohorts/plans`);
        if (!cancelled) setPlans(data?.plans || []);
      } catch {
        if (!cancelled) setPlans([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = slug
          ? await fetchCohortCached(`${BACKEND_URL}/api/cohorts/by-slug/${slug}`)
          : await fetchCohortCached(`${BACKEND_URL}/api/cohorts/featured`);
        if (!cancelled) {
          setCohort(slug ? data.cohort : (data.cohorts || [])[0] || null);
        }
      } catch {
        if (!cancelled) setCohort(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Scroll smoothly to the #plans pricing section
  const scrollToPlans = () => {
    const el = document.getElementById('plans');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Open the apply dialog for a specific plan (or default if no plan given)
  const openApply = (plan) => {
    setSelectedPlan(plan || null);
    setApplyOpen(true);
  };

  // Wait for the async-loaded Razorpay checkout script to be ready before
  // starting an order. The script tag in `public/index.html` is deferred,
  // so on a fast click after page load `window.Razorpay` may still be
  // undefined. Polls every 100ms for up to ~6 seconds. Resolves to true
  // once the SDK is on `window`, false otherwise.
  const ensureRazorpayLoaded = (timeoutMs = 6000) => new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        clearInterval(poll);
        resolve(true);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(poll);
        resolve(false);
      }
    }, 100);
  });

  // Step 2 of the apply flow — called from inside ApplyDialog after the
  // user has filled the form. Creates Razorpay order then opens checkout.
  const handleEnrolPayment = async (formData, couponCode, planKey) => {
    if (!cohort?.is_active) {
      toast.info("We've received your application. We'll reach out as soon as enrolment opens.");
      return { success: true, applicationOnly: true };
    }
    if (!cohort?.id) return { success: false };

    setEnrolling(true);
    // Wait for the Razorpay SDK before hitting the backend so we never
    // create a payment_orders doc that we then fail to open.
    const ready = await ensureRazorpayLoaded();
    if (!ready) {
      setEnrolling(false);
      toast.error('Payment gateway is taking longer than usual to load. Please refresh and try again.');
      return { success: false };
    }
    try {
      const orderRes = await axios.post(
        `${BACKEND_URL}/api/cohorts/enrol/create-order`,
        { cohort_id: cohort.id, plan_key: planKey || null, coupon_code: couponCode || null, applicant: formData },
        { withCredentials: true },
      );
      const order = orderRes.data;

      return new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: order.razorpay_key_id,
          amount: order.amount_in_paise,
          currency: order.currency,
          name: 'gradnext',
          description: `Enrol in ${cohort.name}`,
          order_id: order.razorpay_order_id,
          prefill: {
            name: formData?.name || order.user_name || user?.name || '',
            email: formData?.email || order.user_email || user?.email || '',
            contact: formData?.phone || '',
          },
          theme: { color: '#1e1b4b' },
          handler: async (response) => {
            try {
              const verifyRes = await axios.post(
                `${BACKEND_URL}/api/cohorts/enrol/verify`,
                {
                  cohort_id: cohort.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  applicant: formData,
                },
                { withCredentials: true },
              );
              // If the backend just auto-created an account for this guest,
              // it returns an auto_login_token — stash it so the dashboard
              // recognises the user without a separate login step.
              const verify = verifyRes.data || {};
              if (verify.auto_login_token) {
                try {
                  localStorage.setItem('auth_token', verify.auto_login_token);
                  localStorage.setItem('session_token', verify.auto_login_token);
                } catch { /* localStorage might be blocked */ }
              }
              toast.success(`You're in! Welcome to ${cohort.name}.`);
              setEnrolling(false);
              resolve({ success: true });
              const params = new URLSearchParams({ cohort: 'enrolled' });
              if (verify.is_new_user) params.set('welcome', '1');
              if (verify.needs_password_setup) params.set('set_password', '1');
              navigate(`/dashboard?${params.toString()}`);
            } catch (e) {
              setEnrolling(false);
              toast.error(e?.response?.data?.detail || 'Payment verification failed');
              resolve({ success: false });
            }
          },
          modal: {
            ondismiss: () => {
              setEnrolling(false);
              resolve({ success: false, dismissed: true });
            },
          },
        });
        rzp.open();
      });
    } catch (e) {
      setEnrolling(false);
      const detail = e?.response?.data?.detail || 'Failed to start payment';
      toast.error(detail);
      return { success: false };
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-periwinkle" /></div>;
  }

  if (!cohort) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-rhino">Cohort not available</h1>
          <p className="mt-2 text-slate-600">No active cohort right now. Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App font-body bg-white text-rhino" data-testid="cohort-landing">
      {/* Top-of-funnel CTAs (hero, mid-page banner) drive a discovery call. */}
      {/* Per-plan "Enrol now" buttons in the pricing block remain the actual purchase action. */}
      <CohortHero cohort={cohort} onApply={() => setBookCallOpen(true)} onBookCall={() => setBookCallOpen(true)} />
      
      {/* Offer logos — above the fold, right below hero */}
      <div className="pb-6 sm:pb-8 -mt-2">
        <div className="max-w-4xl mx-auto px-4">
          <LogoStrip compact />
        </div>
      </div>
      <CohortWhatYouLearn />
      <CohortWhoIsItFor />
      <CohortIncluded cohort={cohort} />
      <CohortEnrolBanner cohort={cohort} onApply={() => setBookCallOpen(true)} />
      <CohortSchedule cohort={cohort} />
      {/* Second discovery-call CTA placed right before pricing — gives readers
          who scrolled the full curriculum a clear next step before they hit
          the plan grid. */}
      <CohortEnrolBanner cohort={cohort} onApply={() => setBookCallOpen(true)} />
      {/* Pricing section — "Enrol now" on each card opens the dialog for that specific plan */}
      <SinglePlan cohort={cohort} plans={plans} onApply={openApply} onBookCall={() => setBookCallOpen(true)} enrolling={enrolling} />
      <CohortTestimonials />
      <Faqs cohort={cohort} />
      <ApplyDialog
        open={applyOpen}
        onOpenChange={(v) => { setApplyOpen(v); if (!v) setSelectedPlan(null); }}
        cohort={cohort}
        selectedPlan={selectedPlan}
        onProceedToPayment={handleEnrolPayment}
        enrolling={enrolling}
      />
      <BookCallDialog
        open={bookCallOpen}
        onOpenChange={setBookCallOpen}
        cohort={cohort}
      />
    </div>
  );
}

/* Wrapper around the unified DiscoveryCallModal so the cohort page uses
   the EXACT same questionnaire as the main site. The cohort context is
   forwarded so admins see a "Cohort · {name}" badge in the discovery
   calls list. */
function BookCallDialog({ open, onOpenChange, cohort }) {
  return (
    <DiscoveryCallModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      cohort={cohort}
    />
  );
}




/* ============= SECTION HEADER (used by SinglePlan + Faqs) ============= */
function SectionHeader({ eyebrow, title, subtitle, align = 'left' }) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      {eyebrow && <span className="inline-flex items-center rounded-full bg-periwinkle-lighter px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rhino-medium">{eyebrow}</span>}
      <h2 className="font-display mt-4 text-4xl font-bold leading-tight tracking-tight text-rhino sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base text-slate-600 sm:text-lg">{subtitle}</p>}
    </div>
  );
}


/* ============= COHORT PLANS ============= */
/* Renders cohort pricing tiles from Plans Management (admin-controlled).
   Each plan's structured features (coaching_sessions, strategy_calls,
   peer_sessions_per_month, workshops, course_recordings, etc.) are
   surfaced as readable bullets via the backend `offerings[]` projection.
   Falls back to a single-plan card using cohort.price when no Plans
   Management plans are configured for category=cohort. */
function SinglePlan({ cohort, plans = [], onApply, onBookCall, enrolling }) {
  // Default features that always lead every cohort plan card. Kept in
  // sync with `COHORT_DEFAULT_PLAN_FEATURES` in `backend/routes/cohorts.py`.
  const fallbackOfferings = [
    '20+ Hours of Live Sessions',
    '15+ Live Cases',
    '1:1 Practice Sessions with Global Peers',
  ];

  // Build the cards we'll render. Use Plans Management as the source of
  // truth when present; else show a single fallback card driven by the
  // cohort's own price.
  const cards = plans.length > 0
    ? plans.map((p) => ({
        key: p.plan_key || p.id,
        name: p.name,
        description: p.description,
        price: p.price_inr || cohort.price,
        offerings: p.offerings && p.offerings.length ? p.offerings : fallbackOfferings,
        highlight: !!p.is_featured,
      }))
    : [{
        key: 'fallback',
        name: cohort.name,
        description: cohort.tagline,
        price: cohort.price,
        offerings: fallbackOfferings,
        highlight: true,
      }];

  // Layout: 1 card → centered narrow; 2-3 cards → grid.
  const isGrid = cards.length > 1;
  const gridCols = cards.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';

  return (
    <section id="plans" className="bg-white py-24 sm:py-32" data-testid="cohort-plans">
      <div className={`mx-auto px-6 ${isGrid ? 'max-w-7xl' : 'max-w-3xl'}`}>
        <SectionHeader
          eyebrow={`Pricing · Cohort starts ${cohort.start_date_label?.replace(/^Starts\s+/i, '') || '23 May 2026'}`}
          title={isGrid ? 'Pick the plan that fits your goals.' : 'One simple plan. Everything included.'}
          subtitle={isGrid
            ? 'Every tier is designed to land you in consulting. Choose how much 1:1 support you want.'
            : 'No tiers, no upgrades, no fine-print. The full cohort experience for one transparent price.'}
          align="center"
        />
        <div className={`mt-12 grid gap-6 ${isGrid ? gridCols : 'grid-cols-1'}`}>
          {cards.map((card) => {
            return (
              <div
                key={card.key}
                className={`relative rounded-3xl p-10 shadow-xl transition ${
                  card.highlight
                    ? 'border-2 border-rhino bg-rhino text-white'
                    : 'border border-periwinkle-lighter bg-white text-rhino'
                }`}
                data-testid={`cohort-plan-${card.key}`}
              >
                {card.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-chrome px-3 py-1 text-xs font-bold uppercase tracking-wider text-rhino">
                      <Sparkles className="h-3 w-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <h3 className={`font-display text-2xl font-bold sm:text-3xl ${card.highlight ? 'text-white' : 'text-rhino'}`}>{card.name}</h3>
                  {card.description && (
                    <p className={`mt-2 text-sm ${card.highlight ? 'text-periwinkle-lighter' : 'text-slate-600'}`}>{card.description}</p>
                  )}
                  <div className="mt-6 flex items-baseline justify-center gap-2">
                    <span className="font-display text-5xl font-bold">₹{Number(card.price || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <ul className="mt-8 space-y-2.5">
                  {card.offerings.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2.5 text-sm ${card.highlight ? 'text-periwinkle-lighter' : 'text-slate-700'}`}>
                      <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${card.highlight ? 'text-chrome' : 'text-rhino-medium'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => onApply({ plan_key: card.key, name: card.name, price: card.price, price_inr: card.price })}
                  disabled={!cohort.is_active || enrolling}
                  className={`mt-8 w-full rounded-md px-6 py-6 text-base font-semibold ${
                    !cohort.is_active ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : card.highlight
                        ? 'bg-white text-rhino hover:bg-periwinkle-lighter'
                        : 'bg-rhino text-white hover:bg-rhino-medium'
                  }`}
                  data-testid={`cohort-plan-enrol-btn-${card.key}`}
                >
                  {!cohort.is_active ? 'Enrolments closed' : enrolling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : 'Enrol now'}
                </Button>
              </div>
            );
          })}
        </div>
        {/* Secondary CTA — book discovery call */}
        <div className="mt-10 flex justify-center">
          <Button
            onClick={onBookCall}
            variant="outline"
            className="rounded-md border-rhino px-6 py-6 text-base font-semibold text-rhino hover:bg-periwinkle-lighter"
            data-testid="cohort-plan-bookcall-btn"
          >
            Still confused? Book a 15-minute call
          </Button>
        </div>
      </div>
    </section>
  );
}


/* ============= FAQS — matches Home page styling (rhino cards, sticky header) ============= */
function Faqs({ cohort }) {
  const items = (cohort.faqs || []).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <section
      id="faqs"
      className="section-padding relative overflow-hidden"
      data-testid="cohort-faqs"
    >
      {/* Decorative gradient orbs (mirrors Home page) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--gn-periwinkle-light) 0%, transparent 70%)',
            top: '5%',
            right: '-10%',
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-25 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--gn-periwinkle) 0%, transparent 70%)',
            bottom: '10%',
            left: '-8%',
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left — sticky header */}
          <div className="lg:col-span-4 lg:sticky lg:top-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>
              Frequently Asked Questions
            </h2>
            <p className="text-base" style={{ color: 'var(--gn-grey-dark)' }}>
              Everything you need to know about the cohort. Cohort starts{' '}
              <span style={{ color: 'var(--gn-rhino)', fontWeight: 600 }}>23 May 2026</span>.
            </p>
          </div>

          {/* Right — accordion (rhino cards, white text) */}
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="space-y-3">
              {items.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="rounded-xl px-6 border-none overflow-hidden"
                  style={{
                    background: 'var(--gn-rhino)',
                    boxShadow: '0 4px 16px rgba(46, 53, 88, 0.15)',
                  }}
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5 text-white">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent
                    className="pb-5"
                    style={{ color: 'var(--gn-periwinkle-light)' }}
                  >
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}







/* ============= APPLY DIALOG (form → payment) ============= */
function ApplyDialog({ open, onOpenChange, cohort, selectedPlan, onProceedToPayment, enrolling }) {
  const initialState = { name: '', email: '', phone: '' };
  const [form, setForm] = useState(initialState);
  // step: 'form' -> 'summary' -> 'submitted'
  const [step, setStep] = useState('form');
  const [submitted, setSubmitted] = useState(false);

  // Coupon + pricing state (used on the summary step)
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [pricing, setPricing] = useState(null); // { base, discount, gst, total, applied }

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Use the selected plan's price when available, otherwise fall back to cohort default
  const basePrice = Number(selectedPlan?.price || selectedPlan?.price_inr || cohort?.price || 0);
  const planName = selectedPlan?.name || cohort?.name || 'Cohort';
  const planKey = selectedPlan?.plan_key || cohort?.plan_key || 'cohort_premium';
  const totalWithGst = Math.round(basePrice * 1.18);

  const defaultPricing = useMemo(() => ({
    base: basePrice,
    discount: 0,
    discounted: basePrice,
    gst: Math.round(basePrice * 0.18),
    total: totalWithGst,
    applied: null,
  }), [basePrice, totalWithGst]);

  const livePricing = pricing || defaultPricing;

  // Form-step submit -> validate -> save discovery-call record -> move to summary
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Please fill name, email and phone');
      return;
    }
    // Best-effort: persist application even if payment is abandoned
    try {
      await axios.post(`${BACKEND_URL}/api/cohorts/discovery-call`, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        cohort_id: cohort?.id,
        cohort_slug: cohort?.slug,
        message: 'Cohort enrolment form',
        preferred_time: 'Submitted via Enrol Now form',
      });
    } catch {
      /* non-blocking */
    }
    if (cohort && cohort.is_active === false) {
      // Closed cohorts: skip summary, mark as application received
      const result = await onProceedToPayment(form, null);
      if (result?.applicationOnly || result?.success) {
        setSubmitted(true);
        setStep('submitted');
      }
      return;
    }
    setStep('summary');
  };

  // Validate coupon by attempting to create-order (server returns the
  // breakdown). If successful we keep the resulting pricing for display
  // and pass coupon_code through to the payment trigger.
  const handleApplyCoupon = async () => {
    const code = (couponCode || '').trim().toUpperCase();
    if (!code) {
      toast.error('Enter a coupon code');
      return;
    }
    setCouponLoading(true);
    setCouponError('');
    try {
      // Use the dedicated discounts validate endpoint so we don't create
      // a payment_orders doc just to preview a coupon.
      const r = await axios.post(
        `${BACKEND_URL}/api/discounts/validate`,
        {
          code,
          order_type: 'cohort',
          plan_key: planKey,
          order_amount: basePrice,
        },
        { withCredentials: true },
      );
      const v = r.data;
      if (!v?.valid) {
        setCouponError(v?.error || 'Invalid coupon');
        setPricing(null);
        return;
      }
      const discount = Number(v.discount_amount || 0);
      const discounted = Math.max(0, basePrice - discount);
      const gst = Math.round(discounted * 0.18);
      const total = discounted + gst;
      setPricing({
        base: basePrice,
        discount,
        discounted,
        gst,
        total,
        applied: { code, name: v.discount_name || code },
      });
      toast.success(`Coupon applied: ₹${discount.toLocaleString('en-IN')} off`);
    } catch (e) {
      setCouponError(e?.response?.data?.detail || e?.response?.data?.error || 'Could not validate coupon');
      setPricing(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponError('');
    setPricing(null);
  };

  // Final "Complete payment" -> Razorpay
  const handleCompletePayment = async () => {
    const code = pricing?.applied?.code || null;
    const result = await onProceedToPayment(form, code, planKey);
    if (result?.success) {
      setSubmitted(true);
      setStep('submitted');
    }
  };

  const handleClose = (next) => {
    if (!next) {
      setSubmitted(false);
      setForm(initialState);
      setStep('form');
      setCouponCode('');
      setCouponError('');
      setPricing(null);
    }
    onOpenChange(next);
  };

  const cohortClosed = cohort && cohort.is_active === false;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-lg border-periwinkle-lighter bg-white p-0 overflow-hidden" data-testid="cohort-apply-dialog">
        {step === 'submitted' || submitted ? (
          <div className="px-8 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-700" />
            </div>
            <h3 className="font-display mt-6 text-3xl font-bold text-rhino">
              {cohortClosed ? 'Application received' : "You're in!"}
            </h3>
            <p className="mt-3 text-slate-600">
              {cohortClosed
                ? "We'll reach out as soon as enrolment opens for the next cohort."
                : `Welcome to ${cohort?.name}. Check your email for the welcome pack and calendar invites.`}
            </p>
            <Button onClick={() => handleClose(false)} className="mt-8 rounded-md bg-rhino px-6 text-white hover:bg-rhino-medium">Close</Button>
          </div>
        ) : step === 'summary' ? (
          <div className="px-8 py-8" data-testid="cohort-apply-summary">
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-3xl font-bold text-rhino">Order summary</DialogTitle>
              <DialogDescription className="text-slate-600">
                Review the breakdown and apply a coupon if you have one.
              </DialogDescription>
            </DialogHeader>

            {/* Coupon input */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Label htmlFor="coupon" className="mb-1.5 block text-sm font-semibold text-rhino">
                Coupon code
              </Label>
              {pricing?.applied ? (
                <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                  <div className="text-sm">
                    <span className="font-semibold text-green-800">{pricing.applied.code}</span>
                    <span className="text-green-700"> applied · –₹{Number(pricing.discount).toLocaleString('en-IN')}</span>
                  </div>
                  <button onClick={handleRemoveCoupon} type="button" className="text-xs text-green-800 underline hover:text-green-900" data-testid="cohort-coupon-remove">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="coupon"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                    placeholder="Enter coupon"
                    className="border-slate-200 bg-white focus-visible:ring-periwinkle"
                    data-testid="cohort-coupon-input"
                  />
                  <Button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading}
                    className="bg-rhino px-5 text-white hover:bg-rhino-medium"
                    data-testid="cohort-coupon-apply"
                  >
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
              )}
              {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
            </div>

            {/* Price breakdown */}
            <div className="mt-6 space-y-2 rounded-lg border border-slate-200 p-4">
              <Row label={`${planName} (price)`} value={`₹${Number(livePricing.base).toLocaleString('en-IN')}`} />
              {livePricing.discount > 0 && (
                <Row label="Coupon discount" value={`–₹${Number(livePricing.discount).toLocaleString('en-IN')}`} valueClass="text-green-700" />
              )}
              <Row label="Subtotal" value={`₹${Number(livePricing.discounted).toLocaleString('en-IN')}`} muted />
              <Row label="GST (18%)" value={`₹${Number(livePricing.gst).toLocaleString('en-IN')}`} muted />
              <div className="my-2 border-t border-slate-200" />
              <Row label="Amount payable" value={`₹${Number(livePricing.total).toLocaleString('en-IN')}`} bold />
            </div>

            <DialogFooter className="mt-8 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep('form')} className="text-slate-600 hover:bg-slate-100">
                Back
              </Button>
              <Button
                type="button"
                onClick={handleCompletePayment}
                disabled={enrolling}
                className="bg-rhino px-6 text-white hover:bg-rhino-medium"
                data-testid="cohort-complete-payment-btn"
              >
                {enrolling
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening payment…</>
                  : `Complete payment · ₹${Number(livePricing.total).toLocaleString('en-IN')}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="px-8 py-8">
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-3xl font-bold text-rhino">Enrol in {planName}</DialogTitle>
              <DialogDescription className="text-slate-600">
                Quick form, then payment. {cohortClosed ? 'Enrolments are paused right now. Submitting saves your application for the next batch.' : `Total: ₹${Number(totalWithGst).toLocaleString('en-IN')} (incl. 18% GST).`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 grid grid-cols-1 gap-4">
              <Field id="name" label="Full name *" value={form.name} onChange={upd('name')} required />
              <Field id="email" label="Email *" type="email" value={form.email} onChange={upd('email')} required />
              <Field id="phone" label="Phone *" value={form.phone} onChange={upd('phone')} required />
            </div>
            <DialogFooter className="mt-8 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => handleClose(false)} className="text-slate-600 hover:bg-slate-100">Cancel</Button>
              <Button type="submit" disabled={enrolling} className="bg-rhino px-6 text-white hover:bg-rhino-medium" data-testid="cohort-apply-submit-btn">
                {enrolling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                  : cohortClosed ? 'Submit application' : 'Continue to payment'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper for the price-breakdown rows
function Row({ label, value, bold, muted, valueClass }) {
  return (
    <div className={`flex items-center justify-between text-sm ${muted ? 'text-slate-500' : 'text-rhino'}`}>
      <span className={bold ? 'font-bold' : ''}>{label}</span>
      <span className={`${bold ? 'font-bold text-base' : ''} ${valueClass || ''}`}>{value}</span>
    </div>
  );
}


function Field({ id, label, type = 'text', value, onChange, required }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-rhino">{label}</Label>
      <Input id={id} type={type} value={value} onChange={onChange} required={required}
        className="border-slate-200 bg-slate-50 focus-visible:ring-periwinkle" />
    </div>
  );
}
