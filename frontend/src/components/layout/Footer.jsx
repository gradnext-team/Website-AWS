import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';

const Footer = ({ onContactClick, onBecomeCoachClick }) => {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  const footerLinks = {
    subscription: [
      { name: 'Course', path: '/subscription', section: 'video-courses-section' },
      { name: 'Workshops', path: '/subscription', section: 'workshops-section' },
      { name: 'Drills', path: '/subscription', section: 'drills-section' },
      { name: 'Resources', path: '/subscription', section: 'resources-section' },
      { name: 'Peer Practice', path: '/subscription', section: 'peer-practice-section' },
    ],
    programs: [
      { name: 'Coaching', path: '/coaching', section: 'coaching-hero' },
    ],
    company: [
      { name: 'Read Success Stories', path: '/success-stories' },
      { name: 'Become a Coach', action: 'become-coach' },
      { name: 'Contact Us', action: 'contact' },
    ],
    legal: [
      { name: 'Privacy Policy', path: '/privacy-policy' },
      { name: 'Terms & Conditions', path: '/terms-and-conditions' },
      { name: 'Cancellation & Refund', path: '/cancellation-refund' },
    ],
  };

  const handleSectionClick = (link) => {
    // Navigate to page with section hash
    navigate(`${link.path}#${link.section}`);
    
    // Small delay to ensure navigation completes, then scroll to section
    setTimeout(() => {
      const element = document.getElementById(link.section);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // If no section specified, scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleCompanyClick = (link) => {
    if (link.path) {
      navigate(link.path);
    } else if (link.action === 'contact' && onContactClick) {
      onContactClick();
    } else if (link.action === 'become-coach' && onBecomeCoachClick) {
      onBecomeCoachClick();
    }
  };

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img 
                src="https://customer-assets.emergentagent.com/job_faq-contact-journey/artifacts/x2sjvnum_Gradnext%20logo%20-%20White.png" 
                alt="gradnext" 
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-slate-400 mb-6 max-w-sm">
              Making your consulting dream possible. Learn from McKinsey, BCG, and Bain consultants to set you on the path to success.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="mailto:info@gradnext.co"
                className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
              >
                <Mail className="w-5 h-5 text-slate-400" />
              </a>
            </div>
          </div>

          {/* Subscription Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Subscription</h4>
            <ul className="space-y-3">
              {footerLinks.subscription.map((link) => (
                <li key={link.section}>
                  <button
                    onClick={() => handleSectionClick(link)}
                    className="text-slate-400 hover:text-white transition-colors text-sm text-left"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Programs</h4>
            <ul className="space-y-3">
              {footerLinks.programs.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => handleSectionClick(link)}
                    className="text-slate-400 hover:text-white transition-colors text-sm text-left"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <button
                    onClick={() => handleCompanyClick(link)}
                    className="text-slate-400 hover:text-white transition-colors text-sm text-left"
                  >
                    {link.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">
            © {currentYear} Keisei Consulting Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-slate-400 hover:text-white text-sm transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms-and-conditions" className="text-slate-400 hover:text-white text-sm transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            For any queries or support, write to us at{' '}
            <a href="mailto:info@gradnext.co" className="text-blue-400 hover:text-blue-300 transition-colors">
              info@gradnext.co
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;