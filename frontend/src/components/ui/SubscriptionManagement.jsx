import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CreditCard, Calendar, AlertTriangle, CheckCircle2,
  RefreshCw, X, ChevronRight, Loader2, Clock,
  ArrowUpRight, ArrowDownRight, Shield, Crown, Sparkles,
  PartyPopper, CheckCheck, PauseCircle, DollarSign, 
  Timer, RefreshCcw, HelpCircle, Bug, TrendingDown, FileText, Zap
} from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

// Cancel reasons with follow-up questions
const CANCEL_REASONS = [
  { 
    id: 'got_offer', 
    label: 'I got my consulting offer!', 
    icon: PartyPopper,
    followUp: 'Congratulations! Which firm did you get an offer from?',
    placeholder: 'e.g., McKinsey, BCG, Bain...'
  },
  { 
    id: 'done_prep', 
    label: 'Done with my interview prep', 
    icon: CheckCheck,
    followUp: 'How did your interviews go?',
    placeholder: 'Share your experience...'
  },
  { 
    id: 'taking_break', 
    label: 'Taking a break, will return later', 
    icon: PauseCircle,
    followUp: 'When do you expect to return?',
    placeholder: 'e.g., In 2 months, after exams...'
  },
  { 
    id: 'too_expensive', 
    label: 'Too expensive for my budget', 
    icon: DollarSign,
    followUp: 'What price point would work better for you?',
    placeholder: 'Your feedback helps us...'
  },
  { 
    id: 'not_using', 
    label: 'Not using it enough', 
    icon: Timer,
    followUp: 'What would make you use it more?',
    placeholder: 'e.g., More content, reminders...'
  },
  { 
    id: 'found_alternative', 
    label: 'Found another prep resource', 
    icon: RefreshCcw,
    followUp: 'Which resource are you switching to?',
    placeholder: 'This helps us understand the market...'
  },
  { 
    id: 'missing_features', 
    label: 'Missing features I needed', 
    icon: HelpCircle,
    followUp: 'What features were you looking for?',
    placeholder: 'e.g., More case types, video content...'
  },
  { 
    id: 'technical_issues', 
    label: 'Technical issues or bugs', 
    icon: Bug,
    followUp: 'What issues did you experience?',
    placeholder: 'Describe the problems you faced...'
  },
  { 
    id: 'quality', 
    label: 'Quality didn\'t meet expectations', 
    icon: TrendingDown,
    followUp: 'How can we improve?',
    placeholder: 'Your honest feedback helps us...'
  },
  { 
    id: 'other', 
    label: 'Other', 
    icon: FileText,
    followUp: 'Please share your feedback',
    placeholder: 'Tell us more...'
  },
];

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    active: { color: 'bg-[#DEE3FF] text-[#2E3558]', icon: CheckCircle2, label: 'Active' },
    authenticated: { color: 'bg-[#DEE3FF] text-[#2E3558]', icon: CheckCircle2, label: 'Active' },
    cancelled: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Cancels Soon' },
    halted: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Payment Failed' },
    expired: { color: 'bg-slate-100 text-slate-600', icon: X, label: 'Expired' },
    pending: { color: 'bg-[#B1BCFF] text-[#2E3558]', icon: RefreshCw, label: 'Pending' },
    none: { color: 'bg-slate-100 text-slate-500', icon: null, label: 'No Subscription' },
  };

  const config = statusConfig[status] || statusConfig.none;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

// Calculate days remaining
const getDaysRemaining = (endDate) => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

// Calculate proration details - uses anniversary billing
// Key Logic:
// - Monthly → Monthly: Anniversary stays at current period_end
// - Monthly → 6-Month: Anniversary shifts to 6 months from original subscription start
const calculateProration = (currentPlan, currentCycle, currentPrice, periodStart, periodEnd, newPlan, newCycle, newPrice) => {
  const now = new Date();
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  
  // Days used in current period
  const daysUsed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
  
  // Current period length for credit calculation
  const currentPeriodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 30;
  const daysRemainingCurrentPeriod = Math.max(0, currentPeriodDays - daysUsed);
  
  // Credit for unused portion of current plan
  const dailyRateCurrent = currentPrice / currentPeriodDays;
  const unusedCredit = Math.round(daysRemainingCurrentPeriod * dailyRateCurrent);
  
  // Determine the new anniversary date based on new billing cycle
  let newAnniversary;
  let newPeriodDays;
  
  if (newCycle === '6_month') {
    // For 6-month upgrade: anniversary is 6 months from original subscription start
    newAnniversary = new Date(start);
    newAnniversary.setMonth(newAnniversary.getMonth() + 6);
    newPeriodDays = 180;
  } else {
    // For monthly: anniversary stays at current period_end
    newAnniversary = end;
    newPeriodDays = 30;
  }
  
  // Calculate days remaining until the NEW anniversary
  const daysUntilNewAnniversary = Math.max(0, Math.ceil((newAnniversary - now) / (1000 * 60 * 60 * 24)));
  
  // Calculate new plan cost for days until new anniversary
  const dailyRateNew = newPrice / newPeriodDays;
  const newCostForRemaining = Math.round(daysUntilNewAnniversary * dailyRateNew);
  
  // Prorated charge = new plan cost for remaining days - credit from old plan
  const proratedCharge = Math.max(0, newCostForRemaining - unusedCredit);
  
  // Calculate next renewal after the new anniversary
  const newPeriodEnd = new Date(newAnniversary);
  if (newCycle === '6_month') {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 6);
  } else {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  }
  
  return {
    daysUsed,
    daysRemainingCurrentPeriod,
    daysUntilNewAnniversary,
    dailyRateCurrent: Math.round(dailyRateCurrent * 100) / 100,
    dailyRateNew: Math.round(dailyRateNew * 100) / 100,
    unusedCredit,
    newCostForRemaining,
    newPrice,
    proratedCharge,
    anniversaryDate: newAnniversary,  // When new subscription renews
    newPeriodEnd,                      // Next renewal after that
  };
};

// ============ Plans Popup Dialog ============
const PlansDialog = ({ 
  open, 
  onOpenChange, 
  plans, 
  currentPlan, 
  currentCycle,
  currentPrice,
  periodStart,
  periodEnd,
  onSelectPlan, 
  loading,
  drillCounts 
}) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCycle, setSelectedCycle] = useState(currentCycle || 'monthly');
  const [prorationDetails, setProrationDetails] = useState(null);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPlan(null);
      setSelectedCycle(currentCycle || 'monthly');
      setProrationDetails(null);
    }
  }, [open, currentCycle]);

  // Plan order for display
  const planOrder = ['basic_plan', 'pro_plan', 'pro_plus'];
  const sortedPlans = plans && plans.length > 0 
    ? [...plans].sort((a, b) => planOrder.indexOf(a.plan_key) - planOrder.indexOf(b.plan_key))
    : [];

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
      return { text: 'Current Plan', color: 'bg-slate-500' };
    }
    if (planKey === currentPlan && currentCycle === 'monthly' && cycle === '6_month') {
      return { text: 'Cycle Upgrade', color: 'bg-blue-500' };
    }
    if (planKey === 'pro_plan' && isPlanSelectable(planKey, cycle)) {
      return { text: 'Most Popular', color: 'bg-blue-600' };
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
        // Fetch proration from backend API - handles manual upgrades correctly
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
            proratedChargeGst: p.prorated_charge_gst || 0,  // GST amount
            proratedChargeTotal: p.prorated_charge_total || p.prorated_charge,  // Total with GST
            newPrice: p.new_full_price,
            anniversaryDate: new Date(p.anniversary_date),
            newPeriodEnd: new Date(p.new_period_end),
            isManualUpgrade: response.data.is_manual_upgrade,
          });
        }
      } catch (err) {
        console.error('Failed to fetch proration:', err);
        // Fallback to local calculation if API fails
        const newPrice = selectedCycle === 'monthly' 
          ? plan.pricing.monthly 
          : plan.pricing['6_month_total'];
        
        const details = calculateProration(
          currentPlan, currentCycle, currentPrice,
          periodStart, periodEnd,
          planKey, selectedCycle, newPrice
        );
        // Add GST to fallback calculation
        details.proratedChargeGst = Math.round(details.proratedCharge * 0.18);
        details.proratedChargeTotal = details.proratedCharge + details.proratedChargeGst;
        setProrationDetails(details);
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

  const handleSubscribe = () => {
    if (selectedPlan) {
      onSelectPlan(selectedPlan, selectedCycle);
    }
  };

  // Debug: Log plans array
  useEffect(() => {
    if (open) {
      console.log('PlansDialog opened with plans:', plans);
      console.log('Current plan:', currentPlan, 'Current cycle:', currentCycle);
    }
  }, [open, plans, currentPlan, currentCycle]);

  // If no plans available, show error
  if (open && (!plans || plans.length === 0)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unable to Load Plans</DialogTitle>
            <DialogDescription>
              No subscription plans are currently available. Please try again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
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
          <div className="inline-flex bg-slate-100 rounded-lg p-1">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                selectedCycle === 'monthly' ? 'bg-white shadow text-slate-900' : 'text-slate-600'
              }`}
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

              // Get features - auto-generate from access settings + manual display_features
              const getFeatures = () => {
                const accessFeatures = plan.features || {};
                const generatedFeatures = [];
                
                // Auto-generate from access settings
                if (accessFeatures.course_recordings) {
                  generatedFeatures.push(accessFeatures.course_recordings_limited ? 'Limited course access' : 'Full course access');
                }
                
                // Dynamic drill counts based on plan
                if (accessFeatures.drills_exercises && drillCounts) {
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
                } else if (accessFeatures.drills_exercises) {
                  // Fallback if drill counts not loaded
                  generatedFeatures.push(accessFeatures.drills_limited ? 'Limited drills access' : 'Drills & exercises');
                }
                
                if (accessFeatures.peer_to_peer && accessFeatures.peer_to_peer !== 'none') {
                  const peerLabels = {
                    '1_only': '1 peer practice session',
                    '1_per_week': '4 peer practice sessions/month',
                    '2_per_week': '8 peer practice sessions/month',
                    'unlimited': 'Unlimited peer practice'
                  };
                  generatedFeatures.push(peerLabels[accessFeatures.peer_to_peer] || accessFeatures.peer_to_peer);
                } else if (accessFeatures.peer_sessions_per_month !== undefined && accessFeatures.peer_sessions_per_month !== null && accessFeatures.peer_sessions_per_month !== 0) {
                  if (accessFeatures.peer_sessions_per_month === -1) {
                    generatedFeatures.push('Unlimited peer practice');
                  } else if (accessFeatures.peer_sessions_per_month > 0) {
                    generatedFeatures.push(`${accessFeatures.peer_sessions_per_month} peer practice session${accessFeatures.peer_sessions_per_month !== 1 ? 's' : ''}/month`);
                  }
                }
                
                // Add manual display_features from admin panel
                if (plan.display_features && plan.display_features.length > 0) {
                  generatedFeatures.push(...plan.display_features);
                }
                
                return generatedFeatures;
              };
              const features = getFeatures();

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

                  {/* Detailed Features List */}
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {features.map((feature, idx) => (
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

          {/* Proration Summary - Right side (only show when plan selected) */}
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
                  
                  {/* Show "No credit" for manual upgrades */}
                  {prorationDetails.isManualUpgrade && prorationDetails.unusedCredit === 0 && (
                    <div className="flex justify-between text-xs py-0.5">
                      <span style={{ color: 'var(--gn-grey)' }}>Credit (complimentary plan)</span>
                      <span style={{ color: 'var(--gn-grey-light)' }}>₹0</span>
                    </div>
                  )}
                  
                  <div className="my-1.5" style={{ borderTop: '1px solid var(--gn-grey-light)' }}></div>
                  
                  {/* Subtotal */}
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: 'var(--gn-grey-dark)' }}>Subtotal</span>
                    <span style={{ color: 'var(--gn-rhino)' }}>{formatCurrency(prorationDetails.proratedCharge)}</span>
                  </div>
                  
                  {/* GST */}
                  <div className="flex justify-between text-xs py-0.5">
                    <span style={{ color: 'var(--gn-grey-dark)' }}>GST (18%)</span>
                    <span style={{ color: 'var(--gn-rhino)' }}>{formatCurrency(prorationDetails.proratedChargeGst || 0)}</span>
                  </div>
                  
                  <div className="my-1.5" style={{ borderTop: '1px solid var(--gn-grey-light)' }}></div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Pay Today</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--gn-rhino)' }}>{formatCurrency(prorationDetails.proratedChargeTotal || prorationDetails.proratedCharge)}</span>
                  </div>
                </div>
                
                {/* Future billing */}
                <div className="flex items-center justify-between rounded-lg p-2 text-xs" style={{ backgroundColor: 'var(--gn-grey-light)' }}>
                  <span style={{ color: 'var(--gn-grey)' }}>Then</span>
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>
                    {formatCurrency(prorationDetails.newPrice + Math.round(prorationDetails.newPrice * 0.18))}/{selectedCycle === '6_month' ? '6mo' : 'mo'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubscribe}
            disabled={!selectedPlan || loading}
            className="text-white"
            style={{ backgroundColor: 'var(--gn-rhino)' }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {currentPlan === 'free_trial' ? 'Subscribe Now' : 'Upgrade Now'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============ Cancel Dialog ============
const CancelDialog = ({ open, onOpenChange, onConfirm, loading, periodEnd }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedReason(null);
      setFollowUpAnswer('');
    }
  }, [open]);

  const handleConfirm = () => {
    const reason = CANCEL_REASONS.find(r => r.id === selectedReason);
    onConfirm({
      reason: reason?.label || 'Not specified',
      reasonId: selectedReason,
      feedback: followUpAnswer,
    });
  };

  const currentReason = CANCEL_REASONS.find(r => r.id === selectedReason);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancel Subscription?</DialogTitle>
          <DialogDescription>
            Your subscription will remain active until{' '}
            <strong>{formatDate(periodEnd)}</strong>.
            After that, you will lose access to premium features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-3 block">
              Why are you cancelling?
            </label>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
              {CANCEL_REASONS.map((reason) => {
                const Icon = reason.icon;
                const isSelected = selectedReason === reason.id;
                return (
                  <button
                    key={reason.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-900' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                    onClick={() => {
                      setSelectedReason(reason.id);
                      setFollowUpAnswer('');
                    }}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-sm">{reason.label}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Follow-up Question */}
          {currentReason && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                {currentReason.followUp}
              </label>
              <textarea
                className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder={currentReason.placeholder}
                value={followUpAnswer}
                onChange={(e) => setFollowUpAnswer(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !selectedReason}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============ Main Component ============
const SubscriptionManagement = ({ user, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [plans, setPlans] = useState([]);
  const [drillCounts, setDrillCounts] = useState(null);
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState(null);

  // Determine user's current plan from user prop
  const userPlan = user?.plan || 'free_trial';
  const isFreeTrial = userPlan === 'free_trial';
  const isPaidPlan = ['basic_plan', 'pro_plan', 'pro_plus'].includes(userPlan);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, plansRes, drillCountsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/subscriptions/status`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/subscriptions/plans`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/ai-drills/counts-by-tier`, { withCredentials: true }),
      ]);
      setSubscriptionStatus(statusRes.data);
      setPlans(plansRes.data.plans || []);
      setDrillCounts(drillCountsRes.data);
    } catch (err) {
      console.error('Failed to load subscription data:', err);
      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planKey, billingCycle) => {
    setActionLoading(true);
    try {
      // Check if this is an upgrade (existing subscription) or new subscription
      const hasActiveSubscription = subscriptionStatus?.has_subscription && 
        ['active', 'authenticated'].includes(subscriptionStatus?.status);
      
      console.log('handleSelectPlan called:', { planKey, billingCycle, hasActiveSubscription });
      
      let response;
      if (hasActiveSubscription) {
        // This is an upgrade - use change-plan endpoint with anniversary billing
        console.log('Calling change-plan API...');
        response = await axios.post(
          `${BACKEND_URL}/api/subscriptions/change-plan`,
          { new_plan_key: planKey, new_billing_cycle: billingCycle },
          { withCredentials: true }
        );
        
        console.log('Change-plan response:', response.data);
        
        // Handle immediate upgrade response (anniversary-based proration)
        if (response.data.type === 'immediate_upgrade' || response.data.type === 'anniversary_upgrade') {
          // Close the dialog
          setShowPlansDialog(false);
          
          // If prorated charge is required, redirect to payment
          if (response.data.requires_proration_payment && response.data.proration_order_id) {
            // Create Razorpay order for proration payment
            const options = {
              key: response.data.razorpay_key,
              amount: response.data.charge_amount * 100,
              currency: 'INR',
              name: 'gradnext',
              description: `Upgrade to ${PLAN_NAMES[planKey] || planKey}`,
              order_id: response.data.proration_order_id,
              handler: async function (paymentResponse) {
                // Confirm proration payment
                console.log('Razorpay payment handler called:', paymentResponse);
                try {
                  console.log('Calling confirm-proration-payment API...');
                  const confirmResponse = await axios.post(
                    `${BACKEND_URL}/api/subscriptions/confirm-proration-payment`,
                    {},
                    { withCredentials: true }
                  );
                  console.log('Confirmation response:', confirmResponse.data);
                  // Use the message from confirm-proration-payment response, not the original change-plan response
                  alert(confirmResponse.data.message || 'Upgrade confirmed! Your new plan is now active.');
                  await loadSubscriptionData();
                  if (onUpdate) onUpdate();
                  setActionLoading(false);
                } catch (err) {
                  console.error('Failed to confirm payment:', err);
                  console.error('Error details:', err.response?.data);
                  alert('Payment received but confirmation failed. Please contact support or refresh the page.');
                  // Reload data anyway - webhook might have activated it
                  await loadSubscriptionData();
                  if (onUpdate) onUpdate();
                  setActionLoading(false);
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
                  // User closed modal without paying - this is OK with our fix
                  // Old subscription remains active
                  setActionLoading(false);
                }
              }
            };
            
            // eslint-disable-next-line no-undef
            const rzp = new Razorpay(options);
            rzp.open();
          } else {
            // No proration payment needed (e.g., 0 charge or immediate activation)
            alert(response.data.message || 'Upgrade confirmed! Your new plan is now active.');
            await loadSubscriptionData();
            if (onUpdate) onUpdate();
          }
          return;
        }
        
        // Handle scheduled downgrade
        if (response.data.type === 'downgrade' && response.data.scheduled) {
          alert(response.data.message || 'Plan change scheduled for end of billing period.');
          await loadSubscriptionData();
          if (onUpdate) onUpdate();
          setShowPlansDialog(false);
          return;
        }
      } else {
        // New subscription - use create endpoint
        response = await axios.post(
          `${BACKEND_URL}/api/subscriptions/create`,
          { plan_key: planKey, billing_cycle: billingCycle },
          { withCredentials: true }
        );
        
        // Open Razorpay modal for new subscription payment
        if (response.data.subscription_id) {
          // Close the plans dialog
          setShowPlansDialog(false);
          
          const options = {
            key: response.data.razorpay_key,
            subscription_id: response.data.subscription_id,
            name: 'gradnext',
            description: `${response.data.plan_name} - ${billingCycle === 'monthly' ? 'Monthly' : '6-Month'} Plan`,
            handler: async function (paymentResponse) {
              // Payment successful - subscription will be activated by webhook
              try {
                alert('Subscription activated successfully! Your plan is now active.');
                await loadSubscriptionData();
                if (onUpdate) onUpdate();
              } catch (err) {
                console.error('Failed to reload subscription:', err);
                alert('Payment successful! Please refresh the page to see your active plan.');
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
                // User closed the modal without completing payment
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

  const handleCancelSubscription = async (cancelData) => {
    setActionLoading(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/subscriptions/cancel`,
        { 
          reason: cancelData.reason,
          reason_id: cancelData.reasonId,
          feedback: cancelData.feedback 
        },
        { withCredentials: true }
      );
      setShowCancelDialog(false);
      await loadSubscriptionData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      alert(err.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/subscriptions/reactivate`, {}, { withCredentials: true });
      const data = response.data;
      
      // Case 1: No payment required (within paid period) - just resumed
      if (data.success && !data.requires_payment) {
        alert(data.message || 'Subscription reactivated successfully!');
        await loadSubscriptionData();
        if (onUpdate) onUpdate();
        setActionLoading(false);
        return;
      }
      
      // Case 2: Payment required (period ended or Razorpay subscription fully cancelled)
      if (data.requires_payment && data.subscription_id) {
        // Load Razorpay checkout
        const options = {
          key: data.razorpay_key,
          subscription_id: data.subscription_id,
          name: 'gradnext',
          description: `Reactivate ${data.plan_name} (${data.billing_cycle === '6_month' ? '6 Month' : 'Monthly'})`,
          handler: async function(paymentResponse) {
            // Payment successful - activate subscription
            try {
              await axios.post(`${BACKEND_URL}/api/subscriptions/activate`, {
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_subscription_id: paymentResponse.razorpay_subscription_id,
                razorpay_signature: paymentResponse.razorpay_signature
              }, { withCredentials: true });
              
              await loadSubscriptionData();
              if (onUpdate) onUpdate();
              alert('Subscription reactivated successfully!');
            } catch (activateErr) {
              console.error('Activation error:', activateErr);
              // Webhook should handle activation, reload data
              await loadSubscriptionData();
              if (onUpdate) onUpdate();
            }
          },
          prefill: {
            email: user?.email,
            name: user?.name
          },
          theme: {
            color: '#2E3558'
          },
          modal: {
            ondismiss: function() {
              setActionLoading(false);
            }
          }
        };
        
        const razorpay = new window.Razorpay(options);
        razorpay.open();
        return; // Don't set loading to false yet - Razorpay modal is open
      }
      
      // Fallback
      await loadSubscriptionData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to reactivate:', err);
      alert(err.response?.data?.detail || 'Failed to reactivate subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  // Don't show for coaching plans
  if (user?.plan_category === 'coaching') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Coaching Program</h3>
            <p className="text-sm text-slate-500 mt-1">
              Your coaching program is valid until {formatDate(user?.plan_end_date || user?.coaching_program_end_date)}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <p className="text-red-600 text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={loadSubscriptionData} className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  const hasRazorpaySubscription = subscriptionStatus?.has_subscription;
  const subscriptionStatusValue = subscriptionStatus?.status || 'none';
  const billingCycle = subscriptionStatus?.billing_cycle || 'monthly';
  const lockedPrice = subscriptionStatus?.locked_price;
  const periodStart = subscriptionStatus?.current_period_start;
  const periodEnd = subscriptionStatus?.current_period_end || user?.plan_end_date || user?.subscription_end_date;
  const daysRemaining = getDaysRemaining(periodEnd);
  const currentPlanInfo = plans.find(p => p.plan_key === userPlan);

  // ========== FREE TRIAL VIEW ==========
  if (isFreeTrial) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6" data-testid="subscription-management">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Free Trial</h3>
            <p className="text-sm text-slate-500 mt-1">
              Upgrade to unlock all features, courses, and coaching sessions.
            </p>
            <Button 
              className="mt-4 bg-blue-600 hover:bg-blue-700" 
              onClick={() => setShowPlansDialog(true)}
            >
              <Crown className="w-4 h-4 mr-2" />
              View Plans
            </Button>
          </div>
        </div>

        <PlansDialog
          open={showPlansDialog}
          onOpenChange={setShowPlansDialog}
          plans={plans}
          currentPlan={userPlan}
          currentCycle={null}
          currentPrice={0}
          periodStart={null}
          periodEnd={null}
          onSelectPlan={handleSelectPlan}
          loading={actionLoading}
          drillCounts={drillCounts}
        />
      </div>
    );
  }

  // ========== PAID PLAN VIEW ==========
  if (isPaidPlan) {
    const isSubscriptionCancelled = subscriptionStatusValue === 'cancelled';

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="subscription-management">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <Crown className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{PLAN_NAMES[userPlan] || userPlan}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {billingCycle === '6_month' ? '6-Month Billing' : 'Monthly Billing'}
                </p>
              </div>
            </div>
            {hasRazorpaySubscription && <StatusBadge status={subscriptionStatusValue} />}
          </div>
        </div>

        {/* Plan Details */}
        <div className="p-6 space-y-3">
          {/* Price */}
          {lockedPrice && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500">Amount</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(lockedPrice)}
                <span className="text-slate-400 font-normal text-xs ml-1">
                  /{billingCycle === '6_month' ? '6 months' : 'month'}
                </span>
              </span>
            </div>
          )}

          {/* Renewal/Expiry Date */}
          {periodEnd && (
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                {isSubscriptionCancelled ? 'Access Until' : 'Renews On'}
              </span>
              <span className="text-sm font-medium text-slate-700">
                {formatDate(periodEnd)}
              </span>
            </div>
          )}

          {/* Days Remaining */}
          {daysRemaining > 0 && (
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <span className="text-sm text-slate-500">Days Remaining</span>
              <span className={`font-medium ${daysRemaining <= 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                {daysRemaining} days
              </span>
            </div>
          )}

          {/* Cancelled Notice */}
          {isSubscriptionCancelled && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Subscription Cancelled</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Your subscription will not renew. You have access until{' '}
                    <strong>{formatDate(periodEnd)}</strong>.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={handleReactivate}
                    disabled={actionLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reactivate Subscription
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Upgrade - Payment Completed but Not Activated */}
          {user?.pending_upgrade && user.pending_upgrade.status === 'pending_proration_payment' && (
            <div className="mt-4 p-4 rounded-lg bg-yellow-50 border border-yellow-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">Upgrade Payment Pending Confirmation</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your payment may have been processed, but the upgrade wasn't confirmed automatically. 
                    Click below to complete your upgrade.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                    onClick={async () => {
                      try {
                        setActionLoading(true);
                        console.log('Manually completing pending upgrade...');
                        await axios.post(
                          `${BACKEND_URL}/api/subscriptions/confirm-proration-payment`,
                          {},
                          { withCredentials: true }
                        );
                        alert('Upgrade completed successfully! Your new plan is now active.');
                        await loadSubscriptionData();
                        if (onUpdate) onUpdate();
                      } catch (err) {
                        console.error('Failed to complete upgrade:', err);
                        alert(err.response?.data?.detail || 'Failed to complete upgrade. Please contact support.');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Complete Upgrade Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Change Notice - Anniversary Upgrade or Downgrade */}
          {subscriptionStatus?.pending_change && (
            <div className={`mt-4 p-4 rounded-lg ${
              subscriptionStatus.pending_change.type === 'anniversary_upgrade' 
                ? 'bg-[#DEE3FF] border border-[#B1BCFF]' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {subscriptionStatus.pending_change.type === 'anniversary_upgrade' ? (
                  <ArrowUpRight className="w-5 h-5 text-[#2E3558] mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    subscriptionStatus.pending_change.type === 'anniversary_upgrade'
                      ? 'text-[#2E3558]'
                      : 'text-blue-800'
                  }`}>
                    {subscriptionStatus.pending_change.type === 'anniversary_upgrade' 
                      ? 'Upgrade Scheduled' 
                      : 'Scheduled Plan Change'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    subscriptionStatus.pending_change.type === 'anniversary_upgrade'
                      ? 'text-[#363EA7]'
                      : 'text-blue-700'
                  }`}>
                    Your plan will change to <strong>{PLAN_NAMES[subscriptionStatus.pending_change.new_plan_key] || subscriptionStatus.pending_change.new_plan_key}</strong> on{' '}
                    <strong>{formatDate(subscriptionStatus.pending_change.effective_date)}</strong>.
                    {subscriptionStatus.pending_change.type === 'anniversary_upgrade' && subscriptionStatus.pending_change.prorated_charge > 0 && (
                      <> (Prorated charge: {formatCurrency(subscriptionStatus.pending_change.prorated_charge)} paid)</>
                    )}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`mt-2 ${
                      subscriptionStatus.pending_change.type === 'anniversary_upgrade'
                        ? 'text-[#363EA7] hover:bg-[#DEE3FF]'
                        : 'text-blue-700 hover:bg-blue-100'
                    }`}
                    onClick={async () => {
                      try {
                        setActionLoading(true);
                        if (subscriptionStatus.pending_change.type === 'anniversary_upgrade') {
                          await axios.post(`${BACKEND_URL}/api/subscriptions/cancel-pending-upgrade`, {}, { withCredentials: true });
                        } else {
                          await axios.post(`${BACKEND_URL}/api/subscriptions/cancel-scheduled-change`, {}, { withCredentials: true });
                        }
                        await loadSubscriptionData();
                        if (onUpdate) onUpdate();
                      } catch (err) {
                        alert(err.response?.data?.detail || 'Failed to cancel scheduled change');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel Scheduled Change
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isSubscriptionCancelled && (
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlansDialog(true)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Plan
              </Button>
            </div>
          </div>
        )}

        {/* Plans Dialog */}
        <PlansDialog
          open={showPlansDialog}
          onOpenChange={setShowPlansDialog}
          plans={plans}
          currentPlan={userPlan}
          currentCycle={billingCycle}
          currentPrice={lockedPrice}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onSelectPlan={handleSelectPlan}
          loading={actionLoading}
          drillCounts={drillCounts}
        />

        {/* Cancel Dialog */}
        <CancelDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={handleCancelSubscription}
          loading={actionLoading}
          periodEnd={periodEnd}
        />
      </div>
    );
  }

  // Fallback for unknown states
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <p className="text-sm text-slate-500">Unable to determine subscription status.</p>
    </div>
  );
};

export default SubscriptionManagement;
