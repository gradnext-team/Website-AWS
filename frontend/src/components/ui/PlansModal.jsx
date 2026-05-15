import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CheckCircle2, ArrowUpRight, Sparkles, Zap, Loader2, Tag, X
} from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Plan display names and order
const PLAN_NAMES = {
  'free_trial': 'Free Trial',
  'basic_plan': 'Basic Plan',
  'pro_plan': 'Pro Plan',
  'pro_plus': 'Pro+ Plan',
};

const PLAN_TIERS = {
  'free_trial': 0,
  'basic_plan': 1,
  'pro_plan': 2,
  'pro_plus': 3,
};

// Format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Reusable Plans Modal Component
 * Can be used anywhere in the app to show subscription plans
 */
const PlansModal = ({ 
  open, 
  onOpenChange, 
  user,
  onSuccess
}) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState('monthly');
  const [prorationDetails, setProrationDetails] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [drillCounts, setDrillCounts] = useState(null);
  
  // Coupon code state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [showCouponInput, setShowCouponInput] = useState(false);

  // Load plans and subscription status
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, statusRes, drillCountsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/subscriptions/plans`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/subscriptions/status`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/ai-drills/counts-by-tier`, { withCredentials: true }),
      ]);
      setPlans(plansRes.data.plans || []);
      setSubscriptionStatus(statusRes.data);
      setDrillCounts(drillCountsRes.data);
      
      // Set initial cycle based on current subscription
      if (statusRes.data?.billing_cycle) {
        setSelectedCycle(statusRes.data.billing_cycle);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedPlan(null);
      setProrationDetails(null);
      // Reset coupon state
      setCouponCode('');
      setCouponError(null);
      setAppliedCoupon(null);
      setShowCouponInput(false);
    } else {
      setActionLoading(false);
    }
  }, [open]);

  // Validate coupon code
  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    
    if (!selectedPlan || !prorationDetails) {
      setCouponError('Please select a plan first');
      return;
    }
    
    setCouponLoading(true);
    setCouponError(null);
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/discounts/validate`,
        {
          code: couponCode.toUpperCase(),
          order_type: 'subscription',
          plan_key: selectedPlan,
          order_amount: prorationDetails.proratedCharge || prorationDetails.newPrice
        },
        { withCredentials: true }
      );
      
      setAppliedCoupon(response.data);
      setCouponError(null);
      setShowCouponInput(false);
    } catch (err) {
      setCouponError(err.response?.data?.detail || 'Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove applied coupon
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  // Calculate discounted total
  const getDiscountedTotal = () => {
    if (!prorationDetails) return 0;
    
    const subtotal = prorationDetails.proratedCharge || 0;
    let discount = 0;
    
    if (appliedCoupon) {
      discount = appliedCoupon.discount_amount || 0;
    }
    
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const gst = Math.round(discountedSubtotal * 0.18);
    return discountedSubtotal + gst;
  };

  // Plan order for display
  const planOrder = ['basic_plan', 'pro_plan', 'pro_plus'];
  const sortedPlans = [...plans].sort((a, b) => planOrder.indexOf(a.plan_key) - planOrder.indexOf(b.plan_key));

  const currentPlan = user?.plan_type || 'free_trial';
  const currentCycle = subscriptionStatus?.billing_cycle || 'monthly';
  const currentPrice = subscriptionStatus?.locked_price || 0;
  const periodStart = subscriptionStatus?.current_period_start;
  const periodEnd = subscriptionStatus?.current_period_end || user?.plan_end_date || user?.subscription_end_date;

  // Check if a plan is selectable
  const isPlanSelectable = (planKey, cycle) => {
    const currentTier = PLAN_TIERS[currentPlan] || 0;
    const targetTier = PLAN_TIERS[planKey] || 0;
    
    // Free trial can select anything
    if (currentPlan === 'free_trial') return true;
    
    // RESTRICTION: 6-month to monthly is NOT allowed
    if (currentCycle === '6_month' && cycle === 'monthly') return false;
    
    // Lower tier is NEVER selectable in upgrade dialog
    if (targetTier < currentTier) return false;
    
    // Higher tier is always selectable
    if (targetTier > currentTier) return true;
    
    // Same tier (targetTier === currentTier): only if upgrading from monthly to 6-month
    if (planKey === currentPlan) {
      if (currentCycle === 'monthly' && cycle === '6_month') return true;
      return false; // Current plan exact match or downgrade cycle
    }
    
    // Same tier but different plan key (shouldn't happen with our structure)
    return false;
  };

  // Get badge text for a plan
  const getPlanBadge = (planKey, cycle) => {
    if (planKey === currentPlan && cycle === currentCycle) {
      return { text: 'Current Plan', color: 'bg-[#808080]' };
    }
    if (planKey === currentPlan && currentCycle === 'monthly' && cycle === '6_month') {
      return { text: 'Cycle Upgrade', color: 'bg-[#8C9DFF]' };
    }
    if (planKey === 'pro_plan' && isPlanSelectable(planKey, cycle)) {
      return { text: 'Most Popular', color: 'bg-[#2E3558]' };
    }
    return null;
  };

  // Handle plan selection - fetches proration from backend
  const handlePlanSelect = async (planKey, plan) => {
    if (!isPlanSelectable(planKey, selectedCycle)) return;
    
    setSelectedPlan(planKey);
    
    // Calculate proration if user has an active plan
    if (currentPlan !== 'free_trial' && periodStart && periodEnd) {
      try {
        // Fetch proration from backend API
        const response = await axios.post(
          `${BACKEND_URL}/api/subscriptions/upgrade-preview`,
          { new_plan_key: planKey, new_billing_cycle: selectedCycle },
          { withCredentials: true }
        );
        
        if (response.data.success) {
          const p = response.data.proration;
          setProrationDetails({
            daysUsed: p.days_used,
            daysRemainingCurrentPeriod: p.days_remaining_current_period,
            daysUntilNewAnniversary: p.days_until_new_anniversary,
            dailyRateCurrent: p.daily_rate_current,
            dailyRateNew: p.daily_rate_new,
            unusedCredit: p.unused_credit,
            newCostForRemaining: p.new_cost_for_remaining,
            proratedCharge: p.prorated_charge,
            proratedChargeGst: p.prorated_charge_gst || 0,
            proratedChargeTotal: p.prorated_charge_total || p.prorated_charge,
            newPrice: p.new_full_price,
            anniversaryDate: new Date(p.anniversary_date),
            newPeriodEnd: new Date(p.new_period_end),
            isManualUpgrade: response.data.is_manual_upgrade,
          });
        }
      } catch (err) {
        console.error('Failed to fetch proration:', err);
      }
    } else {
      // New subscription - no proration
      const newPrice = selectedCycle === 'monthly' 
        ? plan.pricing.monthly 
        : plan.pricing['6_month_total'];
      const newPeriodEnd = new Date();
      if (selectedCycle === '6_month') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 6);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }
      setProrationDetails({
        daysRemainingCurrentPeriod: 0,
        daysUntilNewAnniversary: 0,
        unusedCredit: 0,
        newCostForRemaining: newPrice,
        proratedCharge: newPrice,
        proratedChargeGst: Math.round(newPrice * 0.18),
        proratedChargeTotal: newPrice + Math.round(newPrice * 0.18),
        newPrice,
        anniversaryDate: newPeriodEnd,
        newPeriodEnd,
        isManualUpgrade: false,
      });
    }
  };

  // Handle cycle change
  const handleCycleChange = (newCycle) => {
    setSelectedCycle(newCycle);
    setSelectedPlan(null);
    setProrationDetails(null);
  };

  // Handle subscription
  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    
    setActionLoading(true);
    try {
      // Check if this is an upgrade or new subscription
      const hasActiveSubscription = subscriptionStatus?.has_subscription && 
        ['active', 'authenticated'].includes(subscriptionStatus?.status);
      
      let response;
      if (hasActiveSubscription) {
        // This is an upgrade
        response = await axios.post(
          `${BACKEND_URL}/api/subscriptions/change-plan`,
          { new_plan_key: selectedPlan, new_billing_cycle: selectedCycle },
          { withCredentials: true }
        );
        
        // Handle immediate upgrade response (covers both immediate_upgrade and anniversary_upgrade)
        if (response.data.type === 'immediate_upgrade' || response.data.type === 'anniversary_upgrade') {
          onOpenChange(false);
          
          if (response.data.requires_proration_payment && response.data.proration_order_id) {
            // Create Razorpay order for proration payment
            const options = {
              key: response.data.razorpay_key,
              amount: response.data.charge_amount * 100,
              currency: 'INR',
              name: 'gradnext',
              description: `Upgrade to ${PLAN_NAMES[selectedPlan] || selectedPlan}`,
              order_id: response.data.proration_order_id,
              handler: async function (paymentResponse) {
                try {
                  await axios.post(
                    `${BACKEND_URL}/api/subscriptions/confirm-proration-payment`,
                    {},
                    { withCredentials: true }
                  );
                  alert(response.data.message || 'Upgrade successful! You now have access to your new plan.');
                  if (onSuccess) onSuccess();
                } catch (err) {
                  console.error('Failed to confirm payment:', err);
                  alert('Payment received but confirmation failed. Please contact support.');
                }
              },
              prefill: {
                email: user?.email || '',
                name: user?.name || '',
              },
              theme: {
                color: '#2E3558',
              },
            };
            
            // eslint-disable-next-line no-undef
            const rzp = new Razorpay(options);
            rzp.open();
          } else if (!response.data.requires_proration_payment) {
            // No payment needed (e.g., credit > cost)
            alert(response.data.message || 'Upgrade successful!');
            if (onSuccess) onSuccess();
          } else {
            alert(response.data.message || 'Upgrade scheduled successfully!');
            if (onSuccess) onSuccess();
          }
          return;
        }
        
        // Handle scheduled downgrade
        if (response.data.type === 'downgrade' && response.data.scheduled) {
          alert(response.data.message || 'Plan change scheduled for end of billing period.');
          if (onSuccess) onSuccess();
          onOpenChange(false);
          return;
        }
      } else {
        // New subscription - include coupon code if applied
        const subscriptionPayload = { 
          plan_key: selectedPlan, 
          billing_cycle: selectedCycle 
        };
        
        // Add coupon code if one is applied - use the actual code entered, not the display name
        if (appliedCoupon && couponCode) {
          subscriptionPayload.coupon_code = couponCode.toUpperCase();
        }
        
        response = await axios.post(
          `${BACKEND_URL}/api/subscriptions/create`,
          subscriptionPayload,
          { withCredentials: true }
        );
        
        // Close modal before opening Razorpay
        onOpenChange(false);
        
        // Check if it's a one-time order (coupon applied) or subscription (no coupon)
        if (response.data.payment_type === 'order') {
          // ONE-TIME ORDER for discounted first payment
          const options = {
            key: response.data.razorpay_key,
            amount: Math.round(response.data.amount * 100), // Convert to paise
            currency: response.data.currency || 'INR',
            name: 'gradnext',
            description: `${response.data.plan_name} - ${selectedCycle === 'monthly' ? 'Monthly' : '6-Month'} Plan`,
            order_id: response.data.order_id,
            handler: async function (paymentResponse) {
              try {
                alert('Payment successful! Activating your subscription...');
                
                const activateResponse = await axios.post(
                  `${BACKEND_URL}/api/subscriptions/activate-discounted`,
                  {
                    razorpay_order_id: paymentResponse.razorpay_order_id,
                    razorpay_payment_id: paymentResponse.razorpay_payment_id,
                    razorpay_signature: paymentResponse.razorpay_signature
                  },
                  { withCredentials: true }
                );
                console.log('Activation response:', activateResponse.data);
                
                alert('Subscription activated successfully! Refreshing...');
                window.location.reload();
              } catch (err) {
                console.error('Failed to activate:', err);
                alert('Payment successful! Please refresh the page to see your active plan.');
                window.location.reload();
              }
            },
            prefill: {
              email: user?.email || '',
              name: user?.name || '',
            },
            theme: {
              color: '#3B82F6',
            },
            modal: {
              ondismiss: function() {
                setActionLoading(false);
              }
            }
          };
          
          // eslint-disable-next-line no-undef
          const rzp = new Razorpay(options);
          rzp.open();
          return;
        }
        
        // Regular subscription (no coupon)
        if (response.data.subscription_id) {
          const options = {
            key: response.data.razorpay_key,
            subscription_id: response.data.subscription_id,
            name: 'gradnext',
            description: `${response.data.plan_name} - ${selectedCycle === 'monthly' ? 'Monthly' : '6-Month'} Plan`,
            handler: async function (paymentResponse) {
              try {
                alert('Payment successful! Activating your subscription...');
                
                // Call activate endpoint to ensure subscription is activated
                // This is a fallback in case webhook doesn't process in time
                try {
                  const activateResponse = await axios.post(
                    `${BACKEND_URL}/api/subscriptions/activate`,
                    {},
                    { withCredentials: true }
                  );
                  console.log('Activation response:', activateResponse.data);
                  
                  if (activateResponse.data.success) {
                    alert('Subscription activated successfully! Refreshing...');
                  } else {
                    // If activation says not ready, wait a bit for webhook
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    // Try activation again
                    await axios.post(
                      `${BACKEND_URL}/api/subscriptions/activate`,
                      {},
                      { withCredentials: true }
                    );
                  }
                } catch (activateErr) {
                  console.log('Activation fallback:', activateErr.response?.data || activateErr);
                  // If activation fails, wait for webhook (might have already processed)
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
                
                // Reload page to get updated user data
                window.location.reload();
              } catch (err) {
                console.error('Failed to activate:', err);
                alert('Payment successful! Please refresh the page to see your active plan.');
                window.location.reload();
              }
            },
            prefill: {
              email: user?.email || '',
              name: user?.name || '',
            },
            theme: {
              color: '#3B82F6',
            },
            modal: {
              ondismiss: function() {
                setActionLoading(false);
              }
            }
          };
          
          // eslint-disable-next-line no-undef
          const rzp = new Razorpay(options);
          rzp.open();
          return;
        }
      }
    } catch (err) {
      console.error('Failed to process subscription:', err);
      alert(err.response?.data?.detail || 'Failed to process subscription. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Plan features - auto-generate from access settings + manual display_features
  const getPlanFeatures = (plan) => {
    const features = plan.features || {};
    const generatedFeatures = [];
    
    // Auto-generate from access settings
    if (features.course_recordings) {
      generatedFeatures.push(features.course_recordings_limited ? 'Limited course access' : 'Full course access');
    }
    
    // Dynamic drill counts based on plan
    if (features.drills_exercises && drillCounts) {
      const planKey = plan.plan_key;
      let tier = 'full_access'; // Default for Pro/Pro+
      
      if (planKey === 'basic_plan') {
        tier = 'basic_plan';
      } else if (planKey === 'free_trial') {
        tier = 'free_trial';
      }
      
      const counts = drillCounts.counts?.[tier] || {};
      
      if (counts.case_math > 0) {
        generatedFeatures.push(`${counts.case_math} Case Math drills`);
      }
      if (counts.case_structuring > 0) {
        generatedFeatures.push(`${counts.case_structuring} Case Structuring drills`);
      }
      if (counts.charts_exhibits > 0) {
        generatedFeatures.push(`${counts.charts_exhibits} Charts & Exhibits drills`);
      }
    } else if (features.drills_exercises) {
      // Fallback if drill counts not loaded
      generatedFeatures.push(features.drills_limited ? 'Limited drills access' : 'Drills & exercises');
    }
    
    if (features.peer_to_peer && features.peer_to_peer !== 'none') {
      const peerLabels = {
        '1_only': '1 peer practice session',
        '1_per_week': '4 peer practice sessions/month',
        '2_per_week': '8 peer practice sessions/month',
        'unlimited': 'Unlimited peer practice'
      };
      generatedFeatures.push(peerLabels[features.peer_to_peer] || features.peer_to_peer);
    } else if (features.peer_sessions_per_month !== undefined && features.peer_sessions_per_month !== null && features.peer_sessions_per_month !== 0) {
      if (features.peer_sessions_per_month === -1) {
        generatedFeatures.push('Unlimited peer practice');
      } else if (features.peer_sessions_per_month > 0) {
        generatedFeatures.push(`${features.peer_sessions_per_month} peer practice session${features.peer_sessions_per_month !== 1 ? 's' : ''}/month`);
      }
    }
    
    // Add manual display_features from admin panel
    if (plan.display_features && plan.display_features.length > 0) {
      generatedFeatures.push(...plan.display_features);
    }
    
    return generatedFeatures;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gn-periwinkle)' }} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
            <Sparkles className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
            {currentPlan === 'free_trial' ? 'Choose Your Plan' : 'Upgrade Your Plan'}
          </DialogTitle>
          <DialogDescription>
            {currentPlan === 'free_trial' 
              ? 'Select a plan to unlock all features and accelerate your consulting career.'
              : 'Upgrade to a higher plan or billing cycle for better value.'}
          </DialogDescription>
        </DialogHeader>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center my-3">
          <div className="inline-flex rounded-lg p-1" style={{ backgroundColor: 'var(--gn-grey-light)' }}>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedCycle === 'monthly' ? 'bg-white shadow' : ''
              }`}
              style={{ color: selectedCycle === 'monthly' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)' }}
              onClick={() => handleCycleChange('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedCycle === '6_month' ? 'bg-white shadow' : ''
              }`}
              style={{ color: selectedCycle === '6_month' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)' }}
              onClick={() => handleCycleChange('6_month')}
            >
              6 Months <span className="text-xs ml-1" style={{ color: 'var(--gn-periwinkle)' }}>Save 20%</span>
            </button>
          </div>
        </div>

        {/* Horizontal Layout: Plans + Summary side by side */}
        <div className="flex gap-4">
          {/* Plans Grid - Left side */}
          <div className="flex-1 grid grid-cols-3 gap-3">
            {sortedPlans.map((plan) => {
              const isSelectable = isPlanSelectable(plan.plan_key, selectedCycle);
              const isSelected = selectedPlan === plan.plan_key;
              const badge = getPlanBadge(plan.plan_key, selectedCycle);
              const price = selectedCycle === 'monthly' 
                ? plan.pricing.monthly 
                : plan.pricing['6_month_per_month'];
              const totalPrice = selectedCycle === '6_month' ? plan.pricing['6_month_total'] : price;

              return (
                <div
                  key={plan.plan_key}
                  className={`relative rounded-xl border-2 p-3 transition-all ${
                    !isSelectable 
                      ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                      : isSelected 
                        ? 'border-[#2E3558] bg-[#DEE3FF] shadow-lg cursor-pointer ring-2 ring-[#B1BCFF]' 
                        : 'border-slate-200 hover:border-[#8C9DFF] hover:shadow cursor-pointer'
                  }`}
                  onClick={() => isSelectable && handlePlanSelect(plan.plan_key, plan)}
                >
                  {badge && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className={`${badge.color} text-white text-xs font-medium px-2 py-0.5 rounded-full`}>
                        {badge.text}
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center pt-1">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>{formatCurrency(price)}</span>
                      <span className="text-xs" style={{ color: 'var(--gn-grey)' }}>/mo</span>
                    </div>
                    {selectedCycle === '6_month' && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--gn-grey)' }}>
                        {formatCurrency(totalPrice)} billed every 6 months
                      </p>
                    )}
                  </div>

                  {/* Features List */}
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {getPlanFeatures(plan).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-1.5" style={{ 
                        color: feature.includes('Everything in') ? 'var(--gn-periwinkle)' : 'var(--gn-grey-dark)',
                        fontWeight: feature.includes('Everything in') ? '500' : 'normal'
                      }}>
                        {!feature.includes('Everything in') && (
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--gn-periwinkle)' }} />
                        )}
                        {feature.includes('Everything in') && (
                          <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--gn-periwinkle)' }} />
                        )}
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--gn-rhino)' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Proration Summary - Right side */}
          {prorationDetails && selectedPlan && (
            <div className="w-72 flex-shrink-0">
              <div className="rounded-xl p-4 h-full" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--gn-rhino)' }}>
                  <CheckCircle2 className="w-4 h-4" />
                  Upgrade Summary
                </h4>
                
                {/* Immediate activation notice */}
                <div className="rounded-lg p-2 mb-3" style={{ backgroundColor: 'var(--gn-periwinkle-light)' }}>
                  <p className="font-medium flex items-center gap-1.5 text-xs" style={{ color: 'var(--gn-rhino)' }}>
                    <Zap className="w-3.5 h-3.5" />
                    Active immediately!
                  </p>
                </div>
                
                {/* Manual upgrade notice */}
                {prorationDetails.isManualUpgrade && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                    <p className="text-xs text-amber-800">
                      <strong>Note:</strong> Your current plan was a complimentary upgrade, so no credit is applied.
                    </p>
                  </div>
                )}
                
                {/* Key dates */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2" style={{ border: '1px solid var(--gn-periwinkle-light)' }}>
                    <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>Starts</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Today</p>
                  </div>
                  <div className="bg-white rounded-lg p-2" style={{ border: '1px solid var(--gn-periwinkle-light)' }}>
                    <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>Renews</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>{formatDate(prorationDetails.anniversaryDate)}</p>
                  </div>
                </div>
                
                {/* Coupon Code Section */}
                <div className="mb-3">
                  {appliedCoupon ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">{appliedCoupon.discount_name}</span>
                        </div>
                        <button 
                          onClick={removeCoupon}
                          className="text-green-600 hover:text-green-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        You save {formatCurrency(appliedCoupon.discount_amount)} on first payment!
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-2" style={{ border: '1px solid var(--gn-periwinkle-light)' }}>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Coupon code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="w-full pl-8 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                            style={{ borderColor: 'var(--gn-periwinkle-light)' }}
                            onKeyPress={(e) => e.key === 'Enter' && couponCode.trim() && validateCoupon()}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={validateCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="text-xs px-3"
                          style={{ backgroundColor: 'var(--gn-rhino)' }}
                        >
                          {couponLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                        </Button>
                      </div>
                      {couponError && (
                        <p className="text-xs text-red-500 mt-1">{couponError}</p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Payment breakdown */}
                <div className="bg-white rounded-lg p-2 mb-3" style={{ border: '1px solid var(--gn-periwinkle-light)' }}>
                  <p className="text-xs mb-1.5" style={{ color: 'var(--gn-grey)' }}>Payment Breakdown</p>
                  
                  {prorationDetails.daysUntilNewAnniversary > 0 && (
                    <div className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--gn-grey-dark)' }}>{prorationDetails.daysUntilNewAnniversary} days</span>
                      <span style={{ color: 'var(--gn-rhino)' }}>{formatCurrency(prorationDetails.newCostForRemaining)}</span>
                    </div>
                  )}
                  
                  {prorationDetails.unusedCredit > 0 && (
                    <div className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--gn-grey-dark)' }}>Credit ({prorationDetails.daysRemainingCurrentPeriod}d)</span>
                      <span className="font-medium" style={{ color: 'var(--gn-periwinkle)' }}>−{formatCurrency(prorationDetails.unusedCredit)}</span>
                    </div>
                  )}
                  
                  {prorationDetails.isManualUpgrade && prorationDetails.unusedCredit === 0 && (
                    <div className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--gn-grey)' }}>Credit (complimentary plan)</span>
                      <span style={{ color: 'var(--gn-grey-light)' }}>₹0</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-xs py-0.5 border-t mt-1 pt-1" style={{ borderColor: 'var(--gn-grey-light)' }}>
                    <span style={{ color: 'var(--gn-grey-dark)' }}>Subtotal</span>
                    <span style={{ color: 'var(--gn-rhino)' }}>{formatCurrency(prorationDetails.proratedCharge)}</span>
                  </div>
                  
                  {/* Coupon discount line */}
                  {appliedCoupon && appliedCoupon.discount_amount > 0 && (
                    <div className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--gn-grey-dark)' }}>Coupon ({appliedCoupon.discount_name})</span>
                      <span className="font-medium text-green-600">−{formatCurrency(appliedCoupon.discount_amount)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: 'var(--gn-grey-dark)' }}>GST (18%)</span>
                    <span style={{ color: 'var(--gn-rhino)' }}>
                      {appliedCoupon 
                        ? formatCurrency(Math.round((prorationDetails.proratedCharge - appliedCoupon.discount_amount) * 0.18))
                        : formatCurrency(prorationDetails.proratedChargeGst)
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm py-1 border-t mt-1 pt-1 font-semibold" style={{ borderColor: 'var(--gn-grey-light)' }}>
                    <span style={{ color: 'var(--gn-rhino)' }}>Total Due</span>
                    <span style={{ color: 'var(--gn-rhino)' }}>
                      {appliedCoupon 
                        ? formatCurrency(getDiscountedTotal())
                        : formatCurrency(prorationDetails.proratedChargeTotal)
                      }
                    </span>
                  </div>
                  
                  {/* Savings message */}
                  {appliedCoupon && appliedCoupon.discount_amount > 0 && (
                    <div className="text-center mt-2 py-1 bg-green-50 rounded text-xs text-green-700 font-medium">
                      🎉 You save {formatCurrency(appliedCoupon.discount_amount)} on first payment!
                    </div>
                  )}
                </div>
                
                {/* Subscribe button */}
                <Button 
                  className="w-full text-white"
                  style={{ backgroundColor: 'var(--gn-rhino)' }}
                  onClick={handleSubscribe}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Subscribe Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Initial message when no plan selected */}
        {!selectedPlan && (
          <div className="text-center py-6 text-sm" style={{ color: 'var(--gn-grey)' }}>
            Select a plan above to see pricing details and continue
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlansModal;
