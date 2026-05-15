import React from 'react';
import { ArrowRight, CheckCircle2, Users, Globe, Calendar, MessageSquare, UserPlus, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { subscriptionFeatures, statistics } from '../../data/mock';

const PeerPractice = () => {
  const handleStartTrial = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const { peerPractice } = subscriptionFeatures;

  const howItWorks = [
    { icon: <UserPlus className="w-6 h-6" />, title: 'Create Profile', desc: 'Set your experience level and target firms' },
    { icon: <Users className="w-6 h-6" />, title: 'Get Matched', desc: 'Our algorithm finds compatible practice partners' },
    { icon: <Calendar className="w-6 h-6" />, title: 'Schedule Session', desc: 'Book practice sessions at convenient times' },
    { icon: <MessageSquare className="w-6 h-6" />, title: 'Practice & Improve', desc: 'Conduct mock interviews and exchange feedback' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero */}
      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="badge-primary mb-6">
              <Users className="w-4 h-4" />
              <span>Subscription - Peer to Peer Practice</span>
            </div>

            <h1 className="heading-xl mb-6">{peerPractice.title}</h1>
            <p className="body-lg mb-8">{peerPractice.description}</p>

            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{peerPractice.stats.members}</div>
                <p className="text-sm text-slate-500">Members</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{peerPractice.stats.countries}</div>
                <p className="text-sm text-slate-500">Countries</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{peerPractice.stats.sessions}</div>
                <p className="text-sm text-slate-500">Available</p>
              </div>
            </div>

            <Button onClick={handleStartTrial} size="lg" className="btn-primary-gradient">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {peerPractice.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50">
                <CheckCircle2 className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Start practicing in 4 simple steps</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="text-center process-step">
                {index < howItWorks.length - 1 && <div className="process-step-connector hidden md:block" />}
                <div className="icon-box-lg mx-auto mb-4">
                  {step.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Community */}
      <section className="section-padding dark-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="heading-lg text-white mb-6">
                Join a global community of aspiring consultants
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Connect with like-minded individuals from {statistics.countries} countries. Practice anytime with our 24/7 matching system.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/10 rounded-xl p-4">
                  <Globe className="w-8 h-8 text-cyan-400 mb-2" />
                  <h4 className="font-semibold text-white">Global Network</h4>
                  <p className="text-sm text-slate-300">Members across time zones</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <Clock className="w-8 h-8 text-cyan-400 mb-2" />
                  <h4 className="font-semibold text-white">24/7 Availability</h4>
                  <p className="text-sm text-slate-300">Practice anytime</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-white/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-white/40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Why Peer Practice Matters</h2>
            <p>The most effective way to improve your case interview skills</p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="icon-box flex-shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Real Interview Simulation</h3>
                <p className="text-slate-600">Practice in a realistic interview setting with structured feedback exchange.</p>
              </div>
            </div>
            <div className="flex gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="icon-box flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Learn from Peers</h3>
                <p className="text-slate-600">Observe different approaches and learn new techniques from fellow aspirants.</p>
              </div>
            </div>
            <div className="flex gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="icon-box flex-shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Unlimited Practice</h3>
                <p className="text-slate-600">No limits on the number of sessions. Practice as much as you need.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="heading-lg text-white mb-6">Join the practice community today</h2>
          <p className="text-xl text-blue-100 mb-8">Connect with aspiring consultants worldwide</p>
          <Button onClick={handleStartTrial} size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold">
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default PeerPractice;