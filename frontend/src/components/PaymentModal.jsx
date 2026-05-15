import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRazorpay } from 'react-razorpay';
import { Loader2, CheckCircle2, AlertCircle, CreditCard, Shield, Tag, X, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { trackInitiateCheckout, trackPurchase, generateEventId, getMetaHeaders } from '../utils/metaPixel';
import { trackGoogleAdsInitiateCheckout, trackGoogleAdsPurchase } from '../utils/googleAds';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to check if billing cycle is 6-month (handles different formats)
const isSixMonthBilling = (cycle) => {
  if (!cycle) return true; // Default to 6-month
  const normalized = cycle.toLowerCase().replace(/[_-]/g, '');
  return normalized === '6month' || normalized === 'sixmonth';
};

// Helper to track successful purchase with event_id for deduplication
const trackSuccessfulPurchase = (planName, amount, planKey, orderType, eventId = null) => {
  // Meta Pixel tracking with eventID for deduplication
  trackPurchase({
    value: amount,
    content_name: planName,
    content_ids: [planKey],
    content_type: orderType || 'subscription'
  }, eventId);
  // Google Ads tracking
  trackGoogleAdsPurchase({
    value: amount,
    content_name: planName,
    content_ids: [planKey],
    content_type: orderType || 'subscription'
  });
};

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  plan, 
  onSuccess,
  user,
  billingCycle = '6-month'
}) => {
  const { Razorpay, isLoading: razorpayLoading, error: razorpayError } = useRazorpay();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  
  // Meta event ID for deduplication between browser pixel and server CAPI
  const metaEventIdRef = useRef(null);
  
  // Coupon code state
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  
  // Automatic discount state
  const [automaticDiscount, setAutomaticDiscount] = useState(null);
  const [checkingAutoDiscount, setCheckingAutoDiscount] = useState(false);

  // Determine order type based on plan
  const getOrderType = () => {
    if (plan?.pricing?.one_time) return 'coaching';
    return 'subscription';
  };

  // Calculate base price
  const calculateBasePrice = () => {
    const is6Month = isSixMonthBilling(billingCycle);
    let subtotal = 0;
    
    if (plan?.pricing?.one_time) {
      subtotal = plan.pricing.one_time;
    } else if (!is6Month) {
      subtotal = plan?.pricing?.one_month || plan?.pricing?.monthly || plan?.price || 0;
    } else {
      const perMonthPrice = plan?.pricing?.six_month || plan?.pricing?.['6_month_per_month'] || plan?.pricing?.one_month || plan?.price || 0;
      subtotal = plan?.pricing?.['6_month_total'] || (perMonthPrice * 6);
    }
    
    return subtotal;
  };

  // Check for automatic discounts when modal opens
  useEffect(() => {
    if (isOpen && plan) {
      checkAutomaticDiscount();
      
      // Generate a unique event ID for this checkout session (for Meta deduplication)
      const checkoutEventId = generateEventId();
      metaEventIdRef.current = checkoutEventId;
      
      // Track InitiateCheckout with Meta Pixel (with eventID for deduplication)
      const basePrice = calculateBasePrice();
      trackInitiateCheckout({
        value: basePrice,
        content_name: plan?.name || plan?.plan_key,
        content_ids: [plan?.id || plan?.plan_key],
        content_type: getOrderType()
      }, checkoutEventId);
      // Track InitiateCheckout with Google Ads
      trackGoogleAdsInitiateCheckout({
        value: basePrice,
        content_name: plan?.name || plan?.plan_key,
        content_ids: [plan?.id || plan?.plan_key],
        content_type: getOrderType()
      });
    }
  }, [isOpen, plan]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCouponCode('');
      setCouponError(null);
      setAppliedCoupon(null);
      setShowCouponInput(false);
    }
  }, [isOpen]);

  const checkAutomaticDiscount = async () => {
    if (!plan) return;
    
    setCheckingAutoDiscount(true);
    try {
      const orderType = getOrderType();
      const planKey = plan.id || plan.plan_key;
      const orderAmount = calculateBasePrice();
      const normalizedCycle = isSixMonthBilling(billingCycle) ? '6-month' : 'monthly';
      
      const response = await fetch(
        `${BACKEND_URL}/api/discounts/check-automatic?order_type=${orderType}&plan_key=${planKey}&order_amount=${orderAmount}&billing_cycle=${encodeURIComponent(normalizedCycle)}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        // Clone response before reading to prevent "body stream already read" errors
        const responseClone = response.clone();
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse automatic discount response:', jsonError);
          const text = await responseClone.text();
          console.error('Raw response text:', text);
          return;
        }
        if (data.has_discount) {
          setAutomaticDiscount(data);
        } else {
          setAutomaticDiscount(null);
        }
      }
    } catch (err) {
      console.error('Error checking automatic discount:', err);
    } finally {
      setCheckingAutoDiscount(false);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    
    setCouponLoading(true);
    setCouponError(null);
    
    try {
      const orderType = getOrderType();
      const planKey = plan.id || plan.plan_key;
      const orderAmount = calculateBasePrice();
      
      const response = await fetch(`${BACKEND_URL}/api/discounts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          order_type: orderType,
          plan_key: planKey,
          order_amount: orderAmount
        })
      });
      
      // Clone response before reading to prevent "body stream already read" errors
      const responseClone = response.clone();
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse coupon validation response:', jsonError);
        const text = await responseClone.text();
        console.error('Raw response text:', text);
        setCouponError('Invalid response from server');
        setAppliedCoupon(null);
        return;
      }
      
      if (!response.ok) {
        setCouponError(data.detail || 'Invalid coupon code');
        setAppliedCoupon(null);
        return;
      }
      
      setAppliedCoupon(data);
      setCouponError(null);
      setShowCouponInput(false);
    } catch (err) {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  const handlePayment = useCallback(async () => {
    if (!plan) return;
    
    setLoading(true);
    setError(null);

    const planKey = plan.id || plan.plan_key;
    // Subscription plans: either explicitly marked as subscription category OR don't have one_time pricing
    const isSubscriptionPlan = plan.category === 'subscription' || (!plan.pricing?.one_time && plan.category !== 'coaching');
    
    // Normalize billing cycle for API
    const normalizedBillingCycle = isSixMonthBilling(billingCycle) ? '6_month' : 'monthly';

    try {
      if (isSubscriptionPlan) {
        // ========== SUBSCRIPTION FLOW (with auto-renewal) ==========
        // Use Razorpay Subscriptions API for recurring billing
        
        const subscriptionPayload = {
          plan_key: planKey,
          billing_cycle: normalizedBillingCycle
        };
        
        // Include coupon code if applied
        if (appliedCoupon?.valid && couponCode) {
          subscriptionPayload.coupon_code = couponCode.toUpperCase();
          console.log('Passing coupon to subscription:', couponCode.toUpperCase());
        }
        
        console.log('Subscription payload:', subscriptionPayload);
        
        const subscriptionResponse = await fetch(`${BACKEND_URL}/api/subscriptions/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
          credentials: 'include',
          body: JSON.stringify(subscriptionPayload)
        });

        // Clone response before reading to prevent "body stream already read" errors
        const responseClone = subscriptionResponse.clone();
        let subscriptionData;
        try {
          subscriptionData = await subscriptionResponse.json();
        } catch (jsonError) {
          console.error('Failed to parse subscription response:', jsonError);
          // Try reading from clone as text for debugging
          const text = await responseClone.text();
          console.error('Raw response text:', text);
          throw new Error('Invalid response from server');
        }
        console.log('Subscription response:', subscriptionData);
        
        if (!subscriptionResponse.ok) {
          throw new Error(subscriptionData.detail || 'Failed to create subscription');
        }

        // Build description with coupon info if applicable
        let description = `${subscriptionData.plan_name} - ${normalizedBillingCycle === 'monthly' ? 'Monthly' : '6-Month'} Plan`;
        if (subscriptionData.coupon_applied) {
          description += ` (₹${subscriptionData.coupon_discount} off first payment)`;
        }
        
        // Show warning if coupon couldn't be applied
        if (subscriptionData.coupon_warning) {
          alert(subscriptionData.coupon_warning);
        }

        // Close the modal before opening Razorpay to avoid z-index issues
        handleClose();

        // Always use SUBSCRIPTION flow (with or without offer for discounts)
        // This ensures payment authorization is collected for auto-renewal
        console.log('Opening Razorpay SUBSCRIPTION', subscriptionData.offer_id ? `with offer: ${subscriptionData.offer_id}` : '');
        const options = {
          key: subscriptionData.razorpay_key,
          subscription_id: subscriptionData.subscription_id,
          name: 'gradnext',
          description: description,
          handler: async (response) => {
            // Activate subscription after payment
            try {
              // Wait a moment for webhook to process
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Call activate endpoint (fallback if webhook hasn't processed)
              const activateResponse = await fetch(`${BACKEND_URL}/api/subscriptions/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({})
              });
              
              const activateData = await activateResponse.json();
              
              if (!activateResponse.ok && !activateData.success) {
                // If first activation fails, wait longer for webhook and retry
                await new Promise(resolve => setTimeout(resolve, 3000));
                const retryResponse = await fetch(`${BACKEND_URL}/api/subscriptions/activate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({})
                });
                const retryData = await retryResponse.json();
                
                // Show success and redirect
                setLoading(false);
                const successMsg = subscriptionData.coupon_applied 
                  ? `Welcome to ${subscriptionData.plan_name}! First payment: ₹${subscriptionData.first_payment_amount}, then ₹${subscriptionData.amount}/cycle.`
                  : `Welcome to ${subscriptionData.plan_name}! Your subscription is now active.`;
                alert(successMsg);
                
                // Track purchase with Meta Pixel (with eventID for deduplication)
                trackSuccessfulPurchase(
                  subscriptionData.plan_name,
                  subscriptionData.first_payment_amount || subscriptionData.amount,
                  plan?.id || plan?.plan_key,
                  'subscription',
                  metaEventIdRef.current
                );
                
                if (onSuccess) {
                  onSuccess({
                    plan_name: subscriptionData.plan_name,
                    subscription_end: retryData?.period_end || activateData?.period_end || 'Active',
                    is_subscription: true,
                    auto_renew: true,
                    first_payment_discounted: !!subscriptionData.coupon_applied
                  });
                }
              } else {
                // Activation successful
                setLoading(false);
                const successMsg = subscriptionData.coupon_applied 
                  ? `Welcome to ${subscriptionData.plan_name}! First payment discounted. Auto-renewal at ₹${subscriptionData.amount}/cycle.`
                  : `Welcome to ${subscriptionData.plan_name}! Your subscription is now active.`;
                alert(successMsg);
                
                // Track purchase with Meta Pixel (with eventID for deduplication)
                trackSuccessfulPurchase(
                  subscriptionData.plan_name,
                  subscriptionData.first_payment_amount || subscriptionData.amount,
                  plan?.id || plan?.plan_key,
                  'subscription',
                  metaEventIdRef.current
                );
                
                if (onSuccess) {
                  onSuccess({
                    plan_name: subscriptionData.plan_name,
                    subscription_end: activateData?.period_end || 'Active',
                    is_subscription: true,
                    auto_renew: true,
                    first_payment_discounted: !!subscriptionData.coupon_applied
                  });
                }
              }
              
            } catch (activateError) {
              console.error('Activation error:', activateError);
              // Payment was successful, just show success - webhook will handle activation
              setLoading(false);
              alert(`Welcome to ${subscriptionData.plan_name}! Your subscription is being activated.`);
              
              // Track purchase with Meta Pixel (payment was successful)
              trackSuccessfulPurchase(
                subscriptionData.plan_name,
                subscriptionData.first_payment_amount || subscriptionData.amount,
                plan?.id || plan?.plan_key,
                'subscription'
              );
              
              if (onSuccess) {
                onSuccess({
                  plan_name: subscriptionData.plan_name,
                  subscription_end: 'Active',
                  is_subscription: true,
                  auto_renew: true
                });
              }
            }
          },
          prefill: {
            name: user?.name || '',
            email: user?.email || ''
          },
          theme: {
            color: '#0ea5e9'
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
            }
          }
        };

        const razorpayInstance = new Razorpay(options);
        razorpayInstance.on('payment.failed', (response) => {
          setError(response.error.description || 'Payment failed');
          setLoading(false);
        });
        razorpayInstance.open();
        
      } else {
        // ========== ONE-TIME PAYMENT FLOW (coaching plans) ==========
        // Use Razorpay Orders API for single payment
        
        // Generate a new event ID for purchase (if not already generated during checkout)
        const purchaseEventId = generateEventId();
        
        const orderPayload = { 
          plan_key: planKey,
          billing_cycle: billingCycle,
          meta_event_id: metaEventIdRef.current || purchaseEventId  // For Meta deduplication
        };
        
        // Include discount IDs if applicable
        if (appliedCoupon?.discount_id) {
          orderPayload.coupon_discount_id = appliedCoupon.discount_id;
          console.log('Passing coupon discount_id to order:', appliedCoupon.discount_id);
        }
        if (automaticDiscount?.discount_id && (!appliedCoupon || appliedCoupon.can_stack_with_automatic)) {
          orderPayload.automatic_discount_id = automaticDiscount.discount_id;
        }
        
        console.log('Order payload:', orderPayload);
        
        const orderResponse = await fetch(`${BACKEND_URL}/api/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
          credentials: 'include',
          body: JSON.stringify(orderPayload)
        });

        // Clone response before reading to prevent "body stream already read" errors
        const orderResponseClone = orderResponse.clone();
        let orderData;
        try {
          orderData = await orderResponse.json();
        } catch (jsonError) {
          console.error('Failed to parse order response:', jsonError);
          const text = await orderResponseClone.text();
          console.error('Raw response text:', text);
          throw new Error('Invalid response from server');
        }
        console.log('Order response:', orderData);
        
        if (!orderResponse.ok) {
          throw new Error(orderData.detail || 'Failed to create order');
        }

        // Close the modal before opening Razorpay to avoid z-index issues
        handleClose();

        // Open Razorpay with order_id
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'gradnext',
          description: `${orderData.plan_name}`,
          order_id: orderData.order_id,
          handler: async (response) => {
            // Verify one-time payment
            try {
              const verifyResponse = await fetch(`${BACKEND_URL}/api/payments/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_key: planKey,
                  meta_event_id: metaEventIdRef.current  // For Meta deduplication
                })
              });

              if (!verifyResponse.ok) {
                const errData = await verifyResponse.json();
                throw new Error(errData.detail || 'Payment verification failed');
              }

              const verifyData = await verifyResponse.json();
              setLoading(false);
              alert(`Welcome to ${verifyData.plan_name || orderData.plan_name}! Your plan is now active.`);
              
              // Track purchase with Meta Pixel (coaching/one-time payment) with eventID for deduplication
              trackSuccessfulPurchase(
                verifyData.plan_name || orderData.plan_name,
                orderData.amount / 100, // Convert from paise to rupees
                plan?.id || plan?.plan_key,
                'coaching',
                metaEventIdRef.current  // Pass same eventID for deduplication
              );
              
              if (onSuccess) {
                onSuccess(verifyData);
              }
              
            } catch (verifyError) {
              setError(verifyError.message);
              setLoading(false);
            }
          },
          prefill: {
            name: user?.name || orderData.user_name || '',
            email: user?.email || orderData.user_email || '',
            contact: user?.phone || ''
          },
          theme: {
            color: '#0ea5e9'
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
            }
          }
        };

        const razorpayInstance = new Razorpay(options);
        razorpayInstance.on('payment.failed', (response) => {
          setError(response.error.description || 'Payment failed');
          setLoading(false);
        });
        razorpayInstance.open();
      }
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [plan, Razorpay, onSuccess, user, billingCycle, appliedCoupon, automaticDiscount]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setSuccessData(null);
    onClose();
  };

  if (!plan) return null;

  // Calculate all pricing with discounts
  const is6Month = isSixMonthBilling(billingCycle);
  let perMonthPrice = 0;
  let subtotal = calculateBasePrice();
  
  if (plan.pricing?.one_time) {
    perMonthPrice = subtotal;
  } else if (!is6Month) {
    perMonthPrice = plan.pricing?.one_month || plan.pricing?.monthly || plan.price || 0;
  } else {
    perMonthPrice = plan.pricing?.six_month || plan.pricing?.['6_month_per_month'] || plan.pricing?.one_month || plan.price || 0;
  }

  // Calculate discounts
  let automaticDiscountAmount = 0;
  let couponDiscountAmount = 0;
  
  if (automaticDiscount?.has_discount) {
    automaticDiscountAmount = automaticDiscount.discount_amount;
  }
  
  if (appliedCoupon?.valid) {
    couponDiscountAmount = appliedCoupon.discount_amount;
    // If coupon doesn't stack, remove automatic discount
    if (!appliedCoupon.can_stack_with_automatic && automaticDiscount) {
      automaticDiscountAmount = 0;
    }
  }
  
  const totalDiscount = automaticDiscountAmount + couponDiscountAmount;
  const discountedSubtotal = subtotal - totalDiscount;
  const gst = discountedSubtotal * 0.18;
  const total = discountedSubtotal + gst;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            {success ? 'Payment Successful!' : `Upgrade to ${plan.name}`}
          </DialogTitle>
          <DialogDescription>
            {success 
              ? 'Your subscription has been activated'
              : 'Complete your purchase securely with Razorpay'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Success State */}
          {success && successData && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900">
                  Welcome to {successData.plan_name}!
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {successData.subscription_end === 'Unlimited' || successData.subscription_end === 'Active'
                    ? 'Your subscription is now active'
                    : `Active until ${new Date(successData.subscription_end).toLocaleDateString()}`
                  }
                </p>
                {successData.is_subscription && successData.auto_renew && (
                  <p className="text-xs text-green-600 mt-1">
                    Auto-renewal enabled
                  </p>
                )}
                {successData.coaching_sessions > 0 && (
                  <p className="text-sm text-blue-600 mt-2">
                    {successData.coaching_sessions} coaching sessions included
                  </p>
                )}
              </div>
              <Button 
                onClick={() => { 
                  if (onSuccess) {
                    onSuccess(successData);
                  }
                  handleClose(); 
                }} 
                className="w-full"
              >
                Continue to Dashboard
              </Button>
            </div>
          )}

          {/* Error State */}
          {error && !success && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Payment Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Payment Form */}
          {!success && (
            <>
              {/* Plan Summary */}
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">Plan</span>
                  <span className="font-semibold text-slate-900">{plan.name}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">Duration</span>
                  <span className="text-slate-900">
                    {plan.pricing?.one_time 
                      ? (plan.duration_months ? `${plan.duration_months} months` : 'Unlimited')
                      : (is6Month ? '6 months' : '1 month')
                    }
                  </span>
                </div>
                {(plan.features?.coaching_sessions > 0 || plan.coaching_sessions > 0) && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Coaching Sessions</span>
                    <span className="text-slate-900">{plan.features?.coaching_sessions || plan.coaching_sessions}</span>
                  </div>
                )}
                {plan.features?.strategy_calls > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Strategy Calls</span>
                    <span className="text-slate-900">{plan.features.strategy_calls}</span>
                  </div>
                )}
                
                <div className="border-t border-slate-200 mt-3 pt-3 space-y-2">
                  {/* Show per-month rate for 6-month plans */}
                  {is6Month && !plan.pricing?.one_time && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Monthly Rate</span>
                      <span className="text-slate-900">₹{perMonthPrice.toLocaleString('en-IN')}/mo</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Subtotal ({is6Month && !plan.pricing?.one_time ? '6 months' : plan.pricing?.one_time ? 'One-time' : '1 month'})</span>
                    <span className={`text-slate-900 ${totalDiscount > 0 ? 'line-through text-slate-400' : ''}`}>
                      ₹{subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  
                  {/* Automatic Discount */}
                  {automaticDiscount?.has_discount && (appliedCoupon?.can_stack_with_automatic || !appliedCoupon) && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {automaticDiscount.discount_name}
                      </span>
                      <span className="text-green-600 font-medium">
                        -₹{automaticDiscountAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  
                  {/* Coupon Discount */}
                  {appliedCoupon?.valid && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Coupon: {couponCode.toUpperCase()}
                        <button onClick={removeCoupon} className="ml-1 text-red-500 hover:text-red-700">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                      <span className="text-green-600 font-medium">
                        -₹{couponDiscountAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  
                  {/* Discounted Subtotal (if any discount applied) */}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Discounted Subtotal</span>
                      <span className="text-slate-900 font-medium">₹{discountedSubtotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">GST (18%)</span>
                    <span className="text-slate-900">₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="font-medium text-slate-900">Total</span>
                    <div className="text-right">
                      {totalDiscount > 0 && (
                        <div className="text-xs text-green-600 mb-1">
                          You save ₹{(totalDiscount + (subtotal - discountedSubtotal) * 0.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!
                        </div>
                      )}
                      <span className="text-xl font-bold text-slate-900">
                        ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coupon Code Section */}
              <div className="mb-4">
                {!appliedCoupon && (
                  <>
                    {!appliedCoupon?.valid && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              placeholder="Coupon code"
                              className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 placeholder:normal-case"
                              onKeyPress={(e) => e.key === 'Enter' && couponCode.trim() && validateCoupon()}
                            />
                          </div>
                          <Button
                            onClick={validateCoupon}
                            disabled={couponLoading || !couponCode.trim()}
                            variant="outline"
                            size="sm"
                            className="px-4 h-[42px]"
                          >
                            {couponLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Apply'
                            )}
                          </Button>
                        </div>
                        {couponError && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {couponError}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                {/* Applied coupon badge */}
                {appliedCoupon?.valid && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Coupon Applied: {couponCode.toUpperCase()}
                        </span>
                        {appliedCoupon.can_stack_with_automatic && automaticDiscount?.has_discount && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            <Layers className="w-3 h-3 mr-1" />
                            Stacked
                          </span>
                        )}
                      </div>
                      <button
                        onClick={removeCoupon}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      {appliedCoupon.message}
                    </p>
                  </div>
                )}
              </div>

              {/* Security Note */}
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Shield className="w-4 h-4" />
                <span>Secured by Razorpay. Your payment info is encrypted.</span>
              </div>

              {/* Pay Button */}
              <Button 
                onClick={handlePayment} 
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-slate-400 mt-3">
                By proceeding, you agree to our Terms of Service
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
