import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Scale, Ban, CreditCard, BookOpen } from 'lucide-react';

const TermsAndConditions = () => {
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
            <FileText className="w-10 h-10" style={{ color: 'var(--gn-chrome-yellow)' }} />
            <h1 className="text-4xl font-bold">Terms and Conditions</h1>
          </div>
          <p className="text-slate-300">Last updated: February 4, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none">
          
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Acceptance of Terms
            </h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using gradnext's consulting interview preparation platform ("Service"), you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <BookOpen className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Services Description
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              gradnext provides consulting interview preparation services including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Subscription Plans:</strong> Access to course recordings, drills, case materials, and workshops</li>
              <li><strong>Coaching Plans:</strong> One-on-one sessions with experienced MBB consultants</li>
              <li><strong>Peer-to-Peer Sessions:</strong> Practice sessions with other candidates</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <CreditCard className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Payments and Billing
            </h2>
            
            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Subscription Plans</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Subscription fees are billed in advance on a monthly or semi-annual basis</li>
              <li>All prices are in Indian Rupees (INR) and include applicable taxes (GST 18%)</li>
              <li>Auto-renewal can be enabled or disabled from your account settings</li>
              <li>Free trial period provides limited access to Pro+ features for 7 days</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Coaching Plans</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>One-time payment required at the time of enrollment</li>
              <li>Session validity as per the plan duration</li>
              <li>Unused sessions expire at the end of the plan period</li>
            </ul>

            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
              <p className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>
                Important: All plans are non-refundable. Subscription plans can be cancelled anytime, but coaching plans are non-cancellable. Please review our <Link to="/cancellation-refund" style={{ color: 'var(--gn-periwinkle)' }} className="hover:underline">Cancellation & Refund Policy</Link> for details.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Scale className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              User Responsibilities
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">As a user of our Service, you agree to:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Attend scheduled coaching sessions on time</li>
              <li>Provide at least 24 hours notice for session rescheduling</li>
              <li>Use the Service only for lawful purposes</li>
              <li>Not share, resell, or redistribute course materials</li>
              <li>Respect the intellectual property rights of gradnext and mentors</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Ban className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Prohibited Activities
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">You may not:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Record, copy, or distribute coaching sessions without consent</li>
              <li>Share your account access with others</li>
              <li>Use automated systems to access the Service</li>
              <li>Harass, abuse, or harm mentors or other users</li>
              <li>Attempt to reverse engineer or hack the platform</li>
              <li>Use the Service for any fraudulent or illegal purpose</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Intellectual Property</h2>
            <p className="text-slate-600 leading-relaxed">
              All content on gradnext, including course materials, videos, case studies, frameworks, and methodologies, is the intellectual property of gradnext or its content creators. You are granted a limited, non-exclusive license to access and use this content for personal, non-commercial purposes only.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Disclaimers
            </h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>gradnext does not guarantee job placement or interview success</li>
              <li>Results vary based on individual effort and circumstances</li>
              <li>Mentor advice is professional guidance, not guaranteed outcomes</li>
              <li>The Service is provided "as is" without warranties of any kind</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              gradnext shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service. Our total liability shall not exceed the amount you paid for the Service in the preceding 12 months.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Termination</h2>
            <p className="text-slate-600 leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties. Upon termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Governing Law</h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Changes to Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or platform notification. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-10 p-6 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about these Terms and Conditions, please contact us:
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-slate-700"><strong>Email:</strong> info@gradnext.co</p>
              <p className="text-slate-700"><strong>Address:</strong> 1-B Shastri Colony Ambala Cantt 133001</p>
            </div>
          </section>

          {/* Legal Entity */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-slate-500 text-sm">
              gradnext is a product of <strong>Keisei Consulting Pvt. Ltd.</strong>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
