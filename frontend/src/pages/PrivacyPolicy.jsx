import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Database, Bell, Users, Globe } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--gn-rhino)' }} className="text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center text-slate-300 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10" style={{ color: 'var(--gn-chrome-yellow)' }} />
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
          </div>
          <p className="text-slate-300">Last updated: February 4, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none">
          
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Eye className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Introduction
            </h2>
            <p className="text-slate-600 leading-relaxed">
              gradnext ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our consulting interview preparation platform and services.
            </p>
            <p className="text-slate-600 leading-relaxed mt-4">
              By accessing or using our services, you agree to this Privacy Policy. If you do not agree with the terms of this policy, please do not access our platform.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Database className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Information We Collect
            </h2>
            
            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Personal Information</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Name, email address, and contact information</li>
              <li>Account credentials and profile information</li>
              <li>Payment and billing information (processed securely via Razorpay)</li>
              <li>Educational background and career goals</li>
              <li>Session recordings and feedback (with your consent)</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Usage Information</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Course progress and completion data</li>
              <li>Session attendance and participation</li>
              <li>Platform interaction and feature usage</li>
              <li>Device information and browser type</li>
              <li>IP address and location data</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Lock className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Provide and maintain our coaching and educational services</li>
              <li>Process payments and manage subscriptions</li>
              <li>Personalize your learning experience</li>
              <li>Communicate with you about sessions, updates, and support</li>
              <li>Improve our platform and develop new features</li>
              <li>Ensure platform security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Users className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Information Sharing
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Mentors and Coaches:</strong> To facilitate coaching sessions</li>
              <li><strong>Payment Processors:</strong> Razorpay for secure payment processing</li>
              <li><strong>Service Providers:</strong> Third-party services that help us operate our platform</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Shield className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Data Security
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We implement industry-standard security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
              <li>SSL/TLS encryption for data transmission</li>
              <li>Secure payment processing through Razorpay</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication measures</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Bell className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Your Rights
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal data</li>
              <li>Opt-out of marketing communications</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Globe className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Cookies and Tracking
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We use cookies and similar technologies to enhance your experience, analyze usage, and personalize content. You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Data Retention</h2>
            <p className="text-slate-600 leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Upon account deletion, we will remove your personal data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Changes to This Policy</h2>
            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-10 p-6 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-slate-700"><strong>Email:</strong> info@gradnext.co</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
