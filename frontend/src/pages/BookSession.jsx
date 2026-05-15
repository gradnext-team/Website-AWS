import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Loader2,
  Sparkles,
  Star,
  AlertCircle,
  Tag,
  X as XIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import LoginModal from '../components/LoginModal';
import { istToViewer, format12hWithAbbr } from '../utils/timezone';
import useViewerTimezone from '../hooks/useViewerTimezone';
import { fetchCurrentUser } from '../utils/authCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Public page: /book/:mentorId
 *
 * Flow:
 *  1. Auth gate — if not logged in, the LoginModal is forced open. Default
 *     tab is "Sign Up" but user can switch to "Login". After auth success
 *     the modal closes and the user lands back on the page (no onboarding
 *     prompt here — that happens on /dashboard later).
 *  2. Slot picker — fetches mentor availability and renders date strip +
 *     time slots in the viewer's local timezone.
 *  3. Pay — `POST /api/payments/create-session-order-with-slot` returns a
 *     Razorpay order id, the slot is reserved server-side for 15 min.
 *  4. Razorpay checkout opens. On payment success → call
 *     `verify-session-with-slot` → server creates booking, generates Meet
 *     link, releases the reservation. We then `navigate('/dashboard')` —
 *     fresh signups will see the existing onboarding modal automatically.
 */
const BookSession = () => {
  const { mentorId } = useParams();
  const navigate = useNavigate();
  const { timezone: viewerTz, abbr: viewerTzAbbr } = useViewerTimezone();

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // When the user clicks "Continue" without being logged in we open the
  // auth modal AND remember they wanted to proceed — once auth completes we
  // auto-resume the payment flow (no second click needed).
  const [resumePayAfterAuth, setResumePayAfterAuth] = useState(false);

  const [mentor, setMentor] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [loadingMentor, setLoadingMentor] = useState(true);

  const [selectedDate, setSelectedDate] = useState(null); // IST date "YYYY-MM-DD"
  const [selectedTime, setSelectedTime] = useState(null); // IST time "HH:MM"
  const [sessionType, setSessionType] = useState('General discussion');
  const [caseType, setCaseType] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { discount_id, discount_amount, code }

  // Scroll page to top on mount so the heading is visible (avoids landing
  // mid-page when user clicks "Book Single Session" from the home carousel).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  // 1) Check current auth state (uses shared cache)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userData = await fetchCurrentUser();
        if (cancelled) return;
        setUser(userData);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2) Auth is checked silently. We do NOT force the login modal on load —
  // anonymous users are free to browse + pick a date/time. Login is only
  // gated when they click "Continue" to start payment.
  // (No-op effect kept here for clarity — `authChecked` drives the CTA spinner.)

  // 3) Load mentor + availability (always public)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mentorRes, avRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/mentors`).catch(() => ({ data: [] })),
          axios.get(`${BACKEND_URL}/api/mentors/${mentorId}/availability`).catch(() => ({ data: { availability: [] } })),
        ]);
        if (cancelled) return;
        const list = Array.isArray(mentorRes.data) ? mentorRes.data : [];
        const found = list.find((m) => m.id === mentorId);
        setMentor(found || null);
        const av = Array.isArray(avRes.data?.availability) ? avRes.data.availability : (avRes.data || []);
        setAvailability(av);
        // Default to the first available date if any
        if (!selectedDate) {
          const first = av.find((d) => d.slots?.length > (d.booked_slots?.length || 0));
          if (first) setSelectedDate(first.date);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Mentor load failed', err?.response?.status);
      } finally {
        if (!cancelled) setLoadingMentor(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorId]);

  // Free slots for the selected date (IST), preserving order
  const freeSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const day = availability.find((d) => d.date === selectedDate);
    if (!day) return [];
    const booked = new Set(day.booked_slots || []);
    return (day.slots || []).filter((s) => !booked.has(s));
  }, [availability, selectedDate]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setShowAuthModal(false);
    // If the user clicked "Continue" before logging in, automatically resume
    // the payment flow as soon as auth completes — no second click required.
    if (resumePayAfterAuth) {
      setResumePayAfterAuth(false);
      // Defer one tick so React has applied the new `user` state before
      // handlePayAndBook reads it.
      setTimeout(() => {
        handlePayAndBook(userData);
      }, 30);
    }
  };

  const sessionPrice = Number(mentor?.price_per_session) || 0;
  const discountAmount = Number(appliedCoupon?.discount_amount) || 0;
  const discountedPrice = Math.max(sessionPrice - discountAmount, 0);
  const gstAmount = Math.round(discountedPrice * 0.18);
  const finalPrice = discountedPrice + gstAmount;

  const handleApplyCoupon = async () => {
    const code = (couponCode || '').trim();
    if (!code) {
      setCouponError('Enter a coupon code');
      return;
    }
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!sessionPrice || sessionPrice <= 0) {
      setCouponError('Mentor price unavailable. Please refresh.');
      return;
    }
    setCouponApplying(true);
    setCouponError('');
    try {
      // Re-uses the platform-wide coupon validation. We treat single sessions
      // as a "coaching" order with a synthetic plan_key="single_session" so
      // admin-defined coaching coupons automatically apply here.
      const res = await axios.post(
        `${BACKEND_URL}/api/discounts/validate`,
        {
          code: code.toUpperCase(),
          order_type: 'coaching',
          plan_key: 'single_session',
          order_amount: sessionPrice,
        },
        { withCredentials: true, params: { user_id: user.id } },
      );
      if (res.data?.valid) {
        setAppliedCoupon({
          discount_id: res.data.discount_id,
          discount_amount: res.data.discount_amount,
          code: code.toUpperCase(),
          name: res.data.discount_name,
          message: res.data.message,
        });
        setCouponError('');
      } else {
        setCouponError(res.data?.error || 'Invalid coupon');
      }
    } catch (err) {
      setCouponError(err?.response?.data?.detail || 'Invalid coupon');
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const ensureRazorpayLoaded = () =>
    new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });

  const handlePayAndBook = async (overrideUser) => {
    const effectiveUser = overrideUser || user;
    if (!selectedDate || !selectedTime) {
      setError('Please pick a date and a time slot.');
      return;
    }
    if (sessionType === 'Case session' && !caseType) {
      setError('Please select a case type.');
      return;
    }
    if (!effectiveUser) {
      // Defer payment until auth completes, then auto-resume.
      setResumePayAfterAuth(true);
      setShowAuthModal(true);
      return;
    }
    setError('');
    setPaying(true);

    try {
      // 1. Reserve slot + create Razorpay order
      const createRes = await axios.post(
        `${BACKEND_URL}/api/payments/create-session-order-with-slot`,
        {
          mentor_id: mentorId,
          date: selectedDate,
          time_slot: selectedTime,
          session_type: sessionType,
          case_type: sessionType === 'Case session' ? caseType : null,
          coupon_discount_id: appliedCoupon?.discount_id || null,
        },
        { withCredentials: true },
      );

      const order = createRes.data;

      // 2. Open Razorpay checkout
      const rzReady = await ensureRazorpayLoaded();
      if (!rzReady) {
        setError('Could not load payment SDK. Please refresh and try again.');
        setPaying(false);
        return;
      }

      const rz = new window.Razorpay({
        key: order.razorpay_key,
        amount: order.amount,
        currency: order.currency,
        name: 'gradnext',
        description: `Single session with ${order.mentor_name}`,
        order_id: order.order_id,
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        theme: { color: '#2A3260' },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (resp) => {
          try {
            const verifyRes = await axios.post(
              `${BACKEND_URL}/api/payments/verify-session-with-slot`,
              {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                mentor_id: mentorId,
                date: selectedDate,
                time_slot: selectedTime,
                session_type: sessionType,
                case_type: sessionType === 'Case session' ? caseType : null,
                coupon_discount_id: appliedCoupon?.discount_id || null,
              },
              { withCredentials: true },
            );
            if (verifyRes.data?.success) {
              // Land the user on the coaching tab so they can see their
              // freshly-booked session immediately. The dashboard
              // automatically shows the profile-onboarding modal on top
              // for fresh signups (it triggers off
              // `user.onboarding_completed === false`), so the new user
              // will be prompted to complete their profile here.
              navigate('/dashboard/coaching?welcome=session');
            } else {
              setError('Payment verified but booking failed. Please contact support.');
              setPaying(false);
            }
          } catch (verifyErr) {
            setError(verifyErr?.response?.data?.detail || 'Booking finalization failed. Our team will refund you within 24 hours.');
            setPaying(false);
          }
        },
      });
      rz.open();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not start payment. Please try again.');
      setPaying(false);
    }
  };

  if (!authChecked || loadingMentor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Mentor not found</p>
          <Button onClick={() => navigate('/')} className="mt-4">Back home</Button>
        </div>
      </div>
    );
  }

  // price is sessionPrice (base), gstAmount & finalPrice computed above

  return (
    <div className="min-h-screen bg-slate-50 pt-0 overflow-x-hidden">
      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Back"
            data-testid="book-session-back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Single Session Booking
            </p>
            <p className="text-base font-semibold text-slate-900 truncate">Book with {mentor.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* LEFT — calendar + slots */}
          <div className="bg-white rounded-2xl border p-5 sm:p-6 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">Pick a date & time</h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Times shown in <span className="font-medium text-slate-700">{viewerTzAbbr}</span> (your local timezone). Mentor sets availability in IST.
            </p>

            {/* Date strip */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {availability
                .filter((d) => (d.slots || []).length > (d.booked_slots || []).length)
                .map((d) => {
                  const isSelected = selectedDate === d.date;
                  const dt = new Date(d.date + 'T00:00:00');
                  return (
                    <button
                      key={d.date}
                      onClick={() => { setSelectedDate(d.date); setSelectedTime(null); }}
                      data-testid={`book-date-${d.date}`}
                      className={`shrink-0 px-3 py-2 rounded-xl border text-center min-w-[68px] transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {dt.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold leading-none mt-1">{dt.getDate()}</div>
                      <div className={`text-[10px] mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {dt.toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </button>
                  );
                })}
              {availability.filter((d) => (d.slots || []).length > (d.booked_slots || []).length).length === 0 && (
                <p className="text-sm text-slate-500 italic">No upcoming availability — please check back later.</p>
              )}
            </div>

            {/* Slot grid */}
            {selectedDate && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Available time slots</p>
                  {freeSlotsForSelectedDate.length > 0 && (
                    <p className="text-xs text-slate-400">{freeSlotsForSelectedDate.length} free</p>
                  )}
                </div>
                {freeSlotsForSelectedDate.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No free slots on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {freeSlotsForSelectedDate.map((time) => {
                      const conv = istToViewer(selectedDate, time, viewerTz);
                      const display = format12hWithAbbr(conv.time, viewerTz);
                      const selected = selectedTime === time;
                      return (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          data-testid={`book-slot-${time}`}
                          title={`Mentor sets this as ${time} IST`}
                          className={`px-2 py-2 text-sm rounded-lg border transition-all ${
                            selected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          {display}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Session type + Case type — matches dashboard CoachingPage options */}
            {selectedDate && selectedTime && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">
                    Session Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sessionType}
                    onChange={(e) => {
                      setSessionType(e.target.value);
                      if (e.target.value !== 'Case session') setCaseType('');
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="book-session-type"
                  >
                    <option value="Case session">Case Session</option>
                    <option value="Fit Interview">Fit Interview</option>
                    <option value="PEI session">PEI Session</option>
                    <option value="CV review session">CV Review Session</option>
                    <option value="General discussion">General Discussion</option>
                  </select>
                </div>

                {sessionType === 'Case session' && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      Case Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={caseType}
                      onChange={(e) => setCaseType(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="book-case-type"
                    >
                      <option value="">Select case type</option>
                      <option value="Profitability">Profitability</option>
                      <option value="Market Entry">Market Entry</option>
                      <option value="Guesstimate">Guesstimate</option>
                      <option value="Pricing">Pricing</option>
                      <option value="Growth">Growth</option>
                      <option value="M&A">M&A</option>
                      <option value="Unconventional">Unconventional</option>
                      <option value="Random">Random</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — summary card */}
          <aside className="bg-white rounded-2xl border p-5 lg:sticky lg:top-6 self-start">
            <div className="flex items-center gap-3 mb-5">
              <img
                src={
                  mentor.picture_thumbnail || mentor.picture || mentor.profile_picture ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || 'M')}&background=8C9DFF&color=fff&size=128`
                }
                alt={mentor.name}
                className="w-14 h-14 rounded-xl object-cover ring-2 ring-blue-100"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{mentor.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {mentor.consulting_position || mentor.title || 'Consultant'}
                  {mentor.consulting_firm ? ` · ${mentor.consulting_firm}` : ''}
                </p>
                {Number(mentor.rating) > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-slate-700">{Number(mentor.rating).toFixed(1)}</span>
                    {Number(mentor.sessions_conducted) > 0 && (
                      <span className="text-slate-400">· {mentor.sessions_conducted} sessions</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selection summary */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 mb-5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Your slot</p>
              {selectedDate && selectedTime ? (() => {
                const conv = istToViewer(selectedDate, selectedTime, viewerTz);
                const dateLabel = new Date(conv.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                });
                return (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{dateLabel}</p>
                    <p className="text-sm text-blue-700 font-bold">{format12hWithAbbr(conv.time, viewerTz)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">({selectedTime} IST)</p>
                  </>
                );
              })() : (
                <p className="text-sm text-slate-400 italic">Pick a date and time</p>
              )}
            </div>

            {/* Coupon code */}
            <div className="mb-4">
              {appliedCoupon ? (
                <div
                  className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                  data-testid="book-session-coupon-applied"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-800 truncate">
                        {appliedCoupon.code} applied
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        You save ₹{Number(appliedCoupon.discount_amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="p-1 rounded-md hover:bg-emerald-100"
                    aria-label="Remove coupon"
                    data-testid="book-session-coupon-remove"
                  >
                    <XIcon className="w-4 h-4 text-emerald-700" />
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-1 mb-1.5">
                    <Tag className="w-3 h-3" />
                    Have a coupon?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                      placeholder="Enter code"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="book-session-coupon-input"
                      disabled={couponApplying}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCoupon(); }}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponApplying || !couponCode.trim()}
                      className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                      data-testid="book-session-coupon-apply"
                    >
                      {couponApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {couponError && (
                    <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {couponError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="mb-5 space-y-1.5">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Single session</span>
                <span>{sessionPrice > 0 ? `₹${Number(sessionPrice).toLocaleString('en-IN')}` : '—'}</span>
              </div>
              {appliedCoupon && discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-emerald-700">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span>− ₹{Number(discountAmount).toLocaleString('en-IN')}</span>
                </div>
              )}
              {sessionPrice > 0 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>GST (18%)</span>
                  <span>₹{Number(gstAmount).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex items-end justify-between pt-2 border-t border-slate-100">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-2xl font-bold text-slate-900">
                  {sessionPrice > 0 ? `₹${Number(finalPrice).toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={() => handlePayAndBook()}
              disabled={paying || !selectedDate || !selectedTime || !authChecked || (sessionType === 'Case session' && !caseType)}
              className="w-full text-white font-semibold rounded-xl"
              style={{ backgroundColor: '#2A3260' }}
              data-testid="book-session-pay"
            >
              {paying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
              ) : (
                <>Continue <ArrowRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>

            <ul className="space-y-1.5 mt-4 text-xs text-slate-500">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-500" />
                Slot reserved for 15 min while you check out
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-500" />
                Auto-recorded Google Meet · transcript + Smart Notes
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-500" />
                Free cancellation up to 4 hours before
              </li>
            </ul>
          </aside>
        </div>
      </div>

      {/* Auth gate */}
      {showAuthModal && (
        <LoginModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          skipNavigation
        />
      )}
    </div>
  );
};

export default BookSession;
