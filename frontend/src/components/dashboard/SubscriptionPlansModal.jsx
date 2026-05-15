import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Crown, Check, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Switch } from '../ui/switch';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Subscription plan keys to show (Basic, Pro, Pro Plus)
const SUBSCRIPTION_PLAN_KEYS = ['basic_plan', 'pro_plan', 'pro_plus'];

const SubscriptionPlansModal = ({ isOpen, onClose, onSelectPlan, isTrialExpired = false }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' or 'sixMonth'

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/resources/plans`);
      const allPlans = res.data.plans || [];
      
      // Filter only subscription plans (Basic, Pro, Pro Plus)
      const subscriptionPlans = allPlans.filter(p => SUBSCRIPTION_PLAN_KEYS.includes(p.id));
      
      // Sort by price (lowest first)
      subscriptionPlans.sort((a, b) => {
        const priceA = a.pricing?.one_month || a.price || 0;
        const priceB = b.pricing?.one_month || b.price || 0;
        return priceA - priceB;
      });
      
      setPlans(subscriptionPlans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (plan) => {
    if (billingPeriod === 'sixMonth') {
      return plan.pricing?.six_month || plan.price || 0;
    }
    return plan.pricing?.one_month || plan.price || 0;
  };

  const getSavings = (plan) => {
    const monthlyPrice = plan.pricing?.one_month || 0;
    const sixMonthPrice = plan.pricing?.six_month || 0;
    if (monthlyPrice && sixMonthPrice) {
      const savings = Math.round(((monthlyPrice - sixMonthPrice) / monthlyPrice) * 100);
      return savings > 0 ? savings : 0;
    }
    return 0;
  };

  const getPlanFeatures = (planId) => {
    const features = {
      basic_plan: [
        'Full access to video courses',
        '4 peer practice sessions/month',
        'Case drills & exercises',
        'Study materials library'
      ],
      pro_plan: [
        'Everything in Basic, plus:',
        'Unlimited peer practice',
        'Live workshop access',
        'Priority support'
      ],
      pro_plus: [
        'Everything in Pro, plus:',
        'Dedicated coach access',
        '1 coaching session included',
        'Resume review',
        'Priority matching'
      ]
    };
    return features[planId] || [];
  };

  const getPlanBadge = (planId) => {
    if (planId === 'pro_plan') return 'Most Popular';
    if (planId === 'pro_plus') return 'Best Value';
    return null;
  };

  const handleSelectPlan = (plan) => {
    // Add billing period info to plan
    const selectedPlan = {
      ...plan,
      selectedBillingPeriod: billingPeriod,
      selectedPrice: getPrice(plan),
      duration: billingPeriod === 'sixMonth' ? '6 months' : '1 month'
    };
    onSelectPlan(selectedPlan);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold">
              <Crown className="w-7 h-7 text-amber-500" />
              {isTrialExpired ? 'Your Trial Has Expired' : 'Upgrade Your Plan'}
            </div>
            <p className="text-sm font-normal text-slate-500 mt-2">
              {isTrialExpired 
                ? 'Choose a plan to continue accessing all features'
                : 'Unlock full access to all gradnext resources'
              }
            </p>
          </DialogTitle>
        </DialogHeader>

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-4 py-4 border-b border-slate-100">
          <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}>
            1 Month
          </span>
          <Switch
            checked={billingPeriod === 'sixMonth'}
            onCheckedChange={(checked) => setBillingPeriod(checked ? 'sixMonth' : 'monthly')}
            data-testid="billing-toggle"
          />
          <span className={`text-sm font-medium ${billingPeriod === 'sixMonth' ? 'text-slate-900' : 'text-slate-500'}`}>
            6 Months
          </span>
          {billingPeriod === 'sixMonth' && (
            <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
              Save up to 30%
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading plans...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
            {plans.map((plan) => {
              const badge = getPlanBadge(plan.id);
              const features = getPlanFeatures(plan.id);
              const price = getPrice(plan);
              const savings = getSavings(plan);
              const isPopular = plan.id === 'pro_plan';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${
                    isPopular 
                      ? 'border-blue-500 bg-gradient-to-b from-blue-50/50 to-white shadow-md' 
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                  data-testid={`plan-card-${plan.id}`}
                >
                  {/* Badge */}
                  {badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold rounded-full ${
                      isPopular 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-amber-500 text-white'
                    }`}>
                      {badge}
                    </div>
                  )}

                  {/* Plan Name */}
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  </div>

                  {/* Price */}
                  <div className="text-center mb-4">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold text-slate-900">₹{price.toLocaleString()}</span>
                      <span className="text-slate-500 text-sm">
                        /{billingPeriod === 'sixMonth' ? 'mo' : 'month'}
                      </span>
                    </div>
                    {billingPeriod === 'sixMonth' && savings > 0 && (
                      <p className="text-xs text-emerald-600 font-medium mt-1">
                        Save {savings}% vs monthly
                      </p>
                    )}
                    {billingPeriod === 'sixMonth' && (
                      <p className="text-xs text-slate-500 mt-1">
                        Billed ₹{(price * 6).toLocaleString()} for 6 months
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    className={`w-full ${
                      isPopular 
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white' 
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                    onClick={() => handleSelectPlan(plan)}
                    data-testid={`select-plan-${plan.id}`}
                  >
                    {isPopular && <Sparkles className="w-4 h-4 mr-2" />}
                    Choose {plan.name}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            All plans include a 7-day money-back guarantee. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionPlansModal;
