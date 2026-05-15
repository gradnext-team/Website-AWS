import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import PaymentButton from './PaymentButton';

const PLANS = {
  subscription: [
    {
      key: 'basic',
      name: 'Basic',
      price: 4999,
      duration: '3 months',
      description: 'Perfect for getting started',
      features: [
        'Course Recordings'
      ],
      popular: false
    },
    {
      key: 'pro',
      name: 'Pro',
      price: 7999,
      duration: '6 months',
      description: 'Most value for serious candidates',
      features: [
        'Course Recordings'
      ],
      popular: true
    }
  ],
  coaching: [
    {
      key: 'last_mile',
      name: 'Last Mile',
      price: 16999,
      duration: '3 months',
      sessions: 5,
      description: 'For candidates close to interviews',
      features: [
        'Course Recordings'
      ]
    },
    {
      key: 'mid_mile',
      name: 'Mid Mile',
      price: 29999,
      duration: '6 months',
      sessions: 10,
      description: 'Comprehensive prep program',
      features: [
        'Course Recordings'
      ],
      popular: true
    },
    {
      key: 'full_prep',
      name: 'Full Prep',
      price: 44999,
      duration: '6 months',
      sessions: 15,
      description: 'Ultimate preparation package',
      features: [
        'Course Recordings'
      ]
    }
  ],
  cohort: [
    {
      key: 'cohort_premium',
      name: 'Cohort Premium',
      price: 34999,
      duration: '8 weeks',
      sessions: 1,
      description: 'Structured cohort learning',
      features: [
        'Course Recordings'
      ]
    },
    {
      key: 'cohort_elite',
      name: 'Cohort Elite',
      price: 49999,
      duration: '8 weeks',
      sessions: 3,
      description: 'Premium cohort experience',
      features: [
        'Course Recordings'
      ],
      popular: true
    }
  ]
};

const PlanCard = ({ plan, onSuccess }) => {
  return (
    <div 
      className={`bg-white rounded-2xl p-6 border-2 transition-all ${
        plan.popular 
          ? 'border-blue-500 shadow-lg shadow-blue-100' 
          : 'border-slate-200 hover:border-slate-300'
      }`}
      data-testid={`plan-card-${plan.key}`}
    >
      {plan.popular && (
        <div className="flex items-center gap-1 text-blue-600 text-sm font-semibold mb-3">
          <Star className="w-4 h-4 fill-current" />
          Most Popular
        </div>
      )}
      
      <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
      <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
      
      <div className="mb-4">
        <span className="text-3xl font-bold text-slate-900">₹{plan.price.toLocaleString('en-IN')}</span>
        <span className="text-slate-500">/{plan.duration}</span>
      </div>
      
      {plan.sessions && (
        <p className="text-sm text-emerald-600 font-medium mb-4">
          {plan.sessions} coaching session{plan.sessions > 1 ? 's' : ''} included
        </p>
      )}
      
      <PaymentButton
        planKey={plan.key}
        planName={plan.name}
        amount={plan.price * 100}
        description={plan.description}
        onSuccess={onSuccess}
        className={`w-full ${plan.popular ? 'btn-primary-gradient' : ''}`}
        variant={plan.popular ? 'default' : 'outline'}
      >
        Get {plan.name}
      </PaymentButton>
      
      <ul className="mt-6 space-y-3">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PricingSection = ({ title, subtitle, plans, onSuccess }) => (
  <div className="mb-16">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">{subtitle}</p>
    </div>
    <div className={`grid gap-6 ${plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
      {plans.map(plan => (
        <PlanCard key={plan.key} plan={plan} onSuccess={onSuccess} />
      ))}
    </div>
  </div>
);

const PricingPage = ({ category = 'all' }) => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    // Refresh dashboard data
    navigate('/dashboard', { replace: true });
    window.location.reload();
  };

  return (
    <div className="py-8">
      {(category === 'all' || category === 'subscription') && (
        <PricingSection
          title="Subscription Plans"
          subtitle="Access to all learning resources"
          plans={PLANS.subscription}
          onSuccess={handleSuccess}
        />
      )}
      
      {(category === 'all' || category === 'coaching') && (
        <PricingSection
          title="Coaching Plans"
          subtitle="1:1 sessions with MBB consultants"
          plans={PLANS.coaching}
          onSuccess={handleSuccess}
        />
      )}
      
      {(category === 'all' || category === 'cohort') && (
        <PricingSection
          title="Cohort Programs"
          subtitle="Structured group learning experience"
          plans={PLANS.cohort}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export { PricingPage, PlanCard, PLANS };
export default PricingPage;
