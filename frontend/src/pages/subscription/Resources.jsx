import React from 'react';
import { ArrowRight, CheckCircle2, BookOpen, FileText, Download, FolderOpen, Briefcase, FileSpreadsheet } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { subscriptionFeatures } from '../../data/mock';

const Resources = () => {
  const handleStartTrial = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const { resources } = subscriptionFeatures;

  const resourceCategories = [
    { title: 'Consulting Casebooks', count: '50+', icon: <BookOpen className="w-6 h-6" />, desc: 'From top business schools and firms' },
    { title: 'Framework Cheat Sheets', count: '15+', icon: <FileSpreadsheet className="w-6 h-6" />, desc: 'Quick reference guides for all frameworks' },
    { title: 'MBB CV Templates', count: '10+', icon: <FileText className="w-6 h-6" />, desc: 'Proven resume formats that get callbacks' },
    { title: 'Cover Letter Templates', count: '5+', icon: <FileText className="w-6 h-6" />, desc: 'Compelling cover letter examples' },
    { title: 'LinkedIn Templates', count: '5+', icon: <Briefcase className="w-6 h-6" />, desc: 'Effective outreach message templates' },
    { title: 'Industry Primers', count: '10+', icon: <FolderOpen className="w-6 h-6" />, desc: 'Sector-specific knowledge guides' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Hero */}
      <section className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="badge-primary mb-6">
              <BookOpen className="w-4 h-4" />
              <span>Subscription - Case Interview Resources</span>
            </div>

            <h1 className="heading-xl mb-6">{resources.title}</h1>
            <p className="body-lg mb-8">{resources.description}</p>

            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{resources.stats.casebooks}</div>
                <p className="text-sm text-slate-500">Casebooks</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{resources.stats.templates}</div>
                <p className="text-sm text-slate-500">Templates</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{resources.stats.guides}</div>
                <p className="text-sm text-slate-500">Guides</p>
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
            {resources.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50">
                <CheckCircle2 className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Resource Categories */}
      <section className="section-padding bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Resource Library</h2>
            <p>Everything you need for comprehensive preparation</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resourceCategories.map((category, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-100 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="icon-box">
                    {category.icon}
                  </div>
                  <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {category.count}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{category.title}</h3>
                <p className="text-sm text-slate-500">{category.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Resources */}
      <section className="section-padding bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>Featured Casebooks</h2>
            <p>Top resources from leading institutions</p>
          </div>

          <div className="space-y-4">
            {['Harvard Business School Casebook', 'Wharton Consulting Club Cases', 'Kellogg Case Interview Guide', 'INSEAD Case Practice Book', 'LBS Consulting Casebook'].map((book, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="icon-box">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-slate-900">{book}</span>
                </div>
                <Download className="w-5 h-5 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="heading-lg text-white mb-6">Access the complete resource library</h2>
          <p className="text-xl text-blue-100 mb-8">Get unlimited downloads with your subscription</p>
          <Button onClick={handleStartTrial} size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold">
            Start Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Resources;