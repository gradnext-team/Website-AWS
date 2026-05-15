import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, Play, BookOpen, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { subscriptionFeatures, faqs } from '../../data/mock';
import PaymentModal from '../../components/PaymentModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';

const VideoCourse = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    // Check if user has auth cookie
    const checkAuth = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          setIsLoggedIn(true);
          setCurrentUser(userData);
        } else {
          setIsLoggedIn(false);
          setCurrentUser(null);
        }
      } catch {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
    };
    checkAuth();
  }, []);

  const handleStartTrial = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan({
      key: plan.key,
      name: plan.name,
      monthly_price: plan.price,
      description: plan.duration
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
    window.location.href = '/dashboard';
  };

  const { videoCourse } = subscriptionFeatures;

  const modules = [
    { title: 'Introduction to Consulting', lessons: 5, duration: '2 hours' },
    { title: 'Case Interview Fundamentals', lessons: 8, duration: '4 hours' },
    { title: 'Profitability Framework', lessons: 6, duration: '3 hours' },
    { title: 'Market Entry & Growth', lessons: 7, duration: '3.5 hours' },
    { title: 'M&A Framework', lessons: 5, duration: '2.5 hours' },
    { title: 'Guesstimates & Pricing', lessons: 6, duration: '3 hours' },
    { title: 'Unconventional Cases', lessons: 5, duration: '2.5 hours' },
    { title: 'Fit Interview Mastery', lessons: 8, duration: '4 hours' },
  ];

  const subscriptionPlans = [
    {
      id: 'free',
      key: 'free_trial',
      name: 'Free Trial',
      price: 0,
      duration: '7 days',
      features: [
        '2 recorded video lessons',
        '1 workshop recording',
        '3 case drills',
        'Case interview materials',
        'Basic email support'
      ],
      cta: 'Start Free Trial',
      popular: false
    },
    {
      id: 'basic',
      key: 'basic',
      name: 'Basic',
      price: 4999,
      duration: '3 months',
      features: [
        'All recorded video lessons',
        'All workshop recordings',
        'All case drills',
        'Case interview materials',
        'Email support'
      ],
      cta: 'Get Basic',
      popular: false
    },
    {
      id: 'pro',
      key: 'pro',
      name: 'Pro',
      price: 7999,
      duration: '6 months',
      features: [
        'Everything in Basic',
        'Live workshop access',
        'Peer-to-peer practice',
        'Priority email support',
        'Progress tracking'
      ],
      cta: 'Get Pro',
      popular: true
    }
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero */}
      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="badge-primary mb-6">
                <Play className="w-4 h-4" />
                <span>Subscription - Video Course</span>
              </div>

              <h1 className="heading-xl mb-6">{videoCourse.title}</h1>
              <p className="body-lg mb-8">{videoCourse.description}</p>

              <div className="flex items-center gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{videoCourse.stats.videos}</div>
                  <p className="text-sm text-slate-500">Videos</p>
                </div>
                <div className="w-px h-12 bg-slate-200" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{videoCourse.stats.hours}</div>
                  <p className="text-sm text-slate-500">Hours</p>
                </div>
                <div className="w-px h-12 bg-slate-200" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{videoCourse.stats.frameworks}</div>
                  <p className="text-sm text-slate-500">Frameworks</p>
                </div>
              </div>

              <Button onClick={handleStartTrial} size="lg" className="btn-primary-gradient">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-3xl transform rotate-3" />
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">Sample Lesson: Profitability Framework</h3>
                  <p className="text-sm text-slate-500">Watch a free preview of our course content</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="heading-md mb-8 text-center">What you'll learn</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videoCourse.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50">
                <CheckCircle2 className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="section-padding bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Course Curriculum</h2>
            <p>Structured modules from basics to advanced</p>
          </div>

          <div className="space-y-4">
            {modules.map((module, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{module.title}</h3>
                      <p className="text-sm text-slate-500">{module.lessons} lessons • {module.duration}</p>
                    </div>
                  </div>
                  <BookOpen className="w-5 h-5 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section-padding bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Subscription Plans</h2>
            <p>Choose the plan that fits your preparation timeline</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
                {plan.popular && <div className="tag-popular">Most Popular</div>}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.duration}</p>
                <div className="mb-6">
                  {plan.price === 0 ? (
                    <span className="text-4xl font-bold text-slate-900">Free</span>
                  ) : (
                    <span className="text-4xl font-bold text-slate-900">₹{plan.price.toLocaleString()}</span>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.slice(0, 5).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.price === 0 ? (
                  <Button
                    onClick={handleStartTrial}
                    className="w-full"
                    variant="outline"
                  >
                    {plan.cta}
                  </Button>
                ) : isLoggedIn ? (
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full ${plan.popular ? 'btn-primary-gradient' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartTrial}
                    className={`w-full ${plan.popular ? 'btn-primary-gradient' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    Login to Purchase
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="heading-md mb-8 text-center">FAQs</h2>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.subscription.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-white rounded-xl px-6 border border-slate-100">
                <AccordionTrigger className="text-left font-semibold text-slate-900 hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-5">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="heading-lg text-white mb-6">Ready to master case interviews?</h2>
          <p className="text-xl text-blue-100 mb-8">Start with a free 7-day trial</p>
          <Button onClick={handleStartTrial} size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold">
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPlan(null);
          }}
          plan={selectedPlan}
          onSuccess={handlePaymentSuccess}
          user={currentUser}
        />
      )}
    </div>
  );
};

export default VideoCourse;