import React from 'react';
import { ArrowRight, CheckCircle2, Zap, Target, BarChart3, Clock, TrendingUp, Brain } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { subscriptionFeatures } from '../../data/mock';

const Drills = () => {
  const handleStartTrial = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const { drills } = subscriptionFeatures;

  const drillCategories = [
    { title: 'Mental Math', count: 25, icon: <Brain className="w-6 h-6" />, desc: 'Speed calculations, percentages, growth rates' },
    { title: 'Chart Interpretation', count: 20, icon: <BarChart3 className="w-6 h-6" />, desc: 'Analyze data visualizations quickly' },
    { title: 'Framework Application', count: 15, icon: <Target className="w-6 h-6" />, desc: 'Practice applying frameworks to scenarios' },
    { title: 'Market Sizing', count: 20, icon: <TrendingUp className="w-6 h-6" />, desc: 'Top-down and bottom-up estimations' },
    { title: 'Data Analysis', count: 15, icon: <Zap className="w-6 h-6" />, desc: 'Extract insights from complex data' },
    { title: 'Time-bound Cases', count: 10, icon: <Clock className="w-6 h-6" />, desc: 'Complete mini-cases under pressure' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero */}
      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="badge-primary mb-6">
              <Zap className="w-4 h-4" />
              <span>Subscription - Case Drills</span>
            </div>

            <h1 className="heading-xl mb-6">{drills.title}</h1>
            <p className="body-lg mb-8">{drills.description}</p>

            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{drills.stats.drills}</div>
                <p className="text-sm text-slate-500">Drills</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{drills.stats.categories}</div>
                <p className="text-sm text-slate-500">Categories</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{drills.stats.levels}</div>
                <p className="text-sm text-slate-500">Difficulty Levels</p>
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
            {drills.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50">
                <CheckCircle2 className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Drill Categories */}
      <section className="section-padding bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Drill Categories</h2>
            <p>Practice specific skills with targeted exercises</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drillCategories.map((category, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all">
                <div className="icon-box mb-4">
                  {category.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{category.title}</h3>
                <p className="text-sm text-slate-500 mb-2">{category.desc}</p>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  {category.count}+ drills
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Progress System */}
      <section className="section-padding bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Track Your Progress</h2>
            <p>Our drill system adapts to your skill level</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl font-bold mb-4">
                1
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Beginner</h3>
              <p className="text-sm text-slate-600">Build fundamentals with guided practice</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl font-bold mb-4">
                2
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Intermediate</h3>
              <p className="text-sm text-slate-600">Increase speed and complexity</p>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold mb-4">
                3
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Advanced</h3>
              <p className="text-sm text-slate-600">Interview-level challenges</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="heading-lg text-white mb-6">Sharpen your skills with daily drills</h2>
          <p className="text-xl text-blue-100 mb-8">Start practicing with a free 7-day trial</p>
          <Button onClick={handleStartTrial} size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold">
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Drills;