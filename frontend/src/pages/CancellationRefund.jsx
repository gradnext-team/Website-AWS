import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Mail } from 'lucide-react';

const CancellationRefund = () => {
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
            <RefreshCw className="w-10 h-10" style={{ color: 'var(--gn-chrome-yellow)' }} />
            <h1 className="text-4xl font-bold">Cancellation & Refund Policy</h1>
          </div>
          <p className="text-slate-300">Last updated: February 4, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none">
          
          {/* Overview */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--gn-rhino)' }}>Overview</h2>
            <p className="text-slate-600 leading-relaxed">
              At gradnext, we strive to provide the best consulting interview preparation experience. This policy outlines our cancellation and refund terms for our subscription and coaching plans.
            </p>
            <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
              <p className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>
                Important: All plans are non-refundable once purchased. Please review your purchase carefully before completing payment.
              </p>
            </div>
          </section>

          {/* Subscription Plans - Can Cancel */}
          <section className="mb-10 p-6 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '1px solid var(--gn-periwinkle-light)' }}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--gn-rhino)' }} />
              Subscription Plans (Basic, Pro, Pro+)
            </h2>
            <div className="bg-white p-4 rounded-lg mb-4">
              <p className="font-semibold text-lg mb-2" style={{ color: 'var(--gn-rhino)' }}>Cancellation: Allowed Anytime</p>
              <p className="text-red-600 font-semibold">Refund: Non-Refundable</p>
            </div>
            
            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Cancellation Policy</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>You can cancel your subscription at any time from your account settings</li>
              <li>Upon cancellation, you will retain access until the end of your current billing period</li>
              <li>No further charges will be made after cancellation</li>
              <li>Auto-renewal will be disabled immediately upon cancellation</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Refund Policy</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Subscription plans are <strong>non-refundable</strong> once purchased</li>
              <li>You may cancel to prevent future charges, but no refund will be issued for the current billing period</li>
              <li><strong>Free trial:</strong> No charge if cancelled within the 7-day trial period</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>How to Cancel</h3>
            <ol className="list-decimal pl-6 text-slate-600 space-y-2">
              <li>Log in to your gradnext account</li>
              <li>Go to Settings → Subscription</li>
              <li>Click "Cancel Subscription"</li>
              <li>Confirm your cancellation</li>
            </ol>
          </section>

          {/* Coaching Plans - Non-Refundable & Non-Cancellable */}
          <section className="mb-10 p-6 bg-red-50 rounded-xl border border-red-200">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <XCircle className="w-6 h-6 text-red-600" />
              Coaching Plans (Last Mile, Mid Mile, Full Prep, Pinnacle)
            </h2>
            <div className="bg-white p-4 rounded-lg mb-4">
              <p className="text-red-700 font-semibold text-lg mb-2">Non-Refundable & Non-Cancellable Once Purchased</p>
            </div>
            
            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Why No Cancellation or Refund?</h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              Coaching plans involve significant commitment from our MBB consultant mentors who reserve dedicated time slots for your sessions. Once you enroll:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Mentor time is blocked exclusively for you</li>
              <li>Resources and preparation materials are allocated</li>
              <li>A personalized coaching plan is created for your journey</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Session Rescheduling</h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Individual sessions can be rescheduled with 24 hours advance notice</li>
              <li>Rescheduling is subject to mentor availability</li>
              <li>No-shows without notice will count as a completed session</li>
              <li>Sessions must be used within the plan validity period</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3" style={{ color: 'var(--gn-rhino)' }}>Exceptional Circumstances</h3>
            <p className="text-slate-600 leading-relaxed">
              In case of medical emergencies or extraordinary circumstances, please contact us at <a href="mailto:info@gradnext.co" style={{ color: 'var(--gn-periwinkle)' }} className="hover:underline">info@gradnext.co</a>. We will review requests on a case-by-case basis.
            </p>
          </section>

          {/* Timeline Summary */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Clock className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Quick Reference
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-slate-200 rounded-lg">
                <thead style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Plan Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Cancellation</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--gn-rhino)' }}>Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-700">Subscription (Basic/Pro/Pro+)</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>Allowed Anytime</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">Non-Refundable</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-700">Coaching Plans</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">Not Allowed</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">Non-Refundable</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-10 p-6 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
              <Mail className="w-6 h-6" style={{ color: 'var(--gn-periwinkle)' }} />
              Need Help?
            </h2>
            <p className="text-slate-600 leading-relaxed">
              If you have any questions about cancellations or refunds, please contact our support team:
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-slate-700"><strong>Email:</strong> info@gradnext.co</p>
              <p className="text-slate-700"><strong>Response Time:</strong> Within 24-48 hours</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default CancellationRefund;
