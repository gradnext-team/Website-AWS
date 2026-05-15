import React, { useState, useEffect, Suspense } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PlansModalProvider } from './contexts/PlansModalContext';
import { CurrencyProvider } from './hooks/useCurrency';

// Analytics — tiny, always needed
import { initMixpanel, trackPageView } from './utils/mixpanel';

// ─── Layout shell (eagerly loaded — visible on every public page) ────────────
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PromoBanner from './components/PromoBanner';
import MobilePromoBottomBar from './components/MobilePromoBottomBar';

// ─── Globally-available modals — lazy-loaded since they're only
// rendered after user actions (clicking "Contact" / "Become a coach")
// or after a delay (FreeTrialUpgradePopup, WhatsAppWidget). Moving
// them out of the eager imports trims the main JS bundle. ──────────
const ContactFormModal = React.lazy(() => import('./components/ContactFormModal'));
const BecomeCoachModal = React.lazy(() => import('./components/BecomeCoachModal'));
const WhatsAppWidget = React.lazy(() => import('./components/WhatsAppWidget'));
const FreeTrialUpgradePopup = React.lazy(() => import('./components/FreeTrialUpgradePopup'));

// ─── Home is the #1 entry point — keep eagerly loaded ────────────────────────
import Home from './pages/Home';

// ═══════════════════════════════════════════════════════════════════════════════
// LAZY-LOADED ROUTES — each creates its own webpack chunk, downloaded on demand.
// This is the #1 performance win: visitors to "/" no longer download admin,
// mentor-dashboard, CRM, all dashboard pages, etc.
// ═══════════════════════════════════════════════════════════════════════════════

// Auth
const AuthCallback = React.lazy(() => import('./components/AuthCallback'));

// Public landing pages
const Coaching = React.lazy(() => import('./pages/Coaching'));
const BookSession = React.lazy(() => import('./pages/BookSession'));
const Cohort = React.lazy(() => import('./pages/Cohort'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const MentorsListing = React.lazy(() => import('./pages/MentorsListing'));

// Static pages
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = React.lazy(() => import('./pages/TermsAndConditions'));
const CancellationRefund = React.lazy(() => import('./pages/CancellationRefund'));
const Contact = React.lazy(() => import('./pages/Contact'));
const TestimonialsPage = React.lazy(() => import('./pages/TestimonialsPage'));

// Subscription pages
const SubscriptionLanding = React.lazy(() => import('./pages/subscription/SubscriptionLanding'));
const GetStarted = React.lazy(() => import('./pages/subscription/GetStarted'));
const Workshops = React.lazy(() => import('./pages/subscription/Workshops'));
const PillarOptionsPreview = React.lazy(() => import('./pages/PillarOptionsPreview'));
const DesignMockups = React.lazy(() => import('./pages/DesignMockups'));
const WorkshopDesignMockups = React.lazy(() => import('./pages/WorkshopDesignMockups'));

// Dashboard (only loaded when user is logged in and navigates to /dashboard)
const DashboardLayout = React.lazy(() => import('./components/dashboard/DashboardLayout'));
const DashboardOverview = React.lazy(() => import('./components/dashboard/DashboardOverview'));
const VideosPage = React.lazy(() => import('./components/dashboard/VideosPage'));
const CoursesPage = React.lazy(() => import('./components/dashboard/CoursesPage'));
const WorkshopsPage = React.lazy(() => import('./components/dashboard/WorkshopsPage'));
const DrillsPage = React.lazy(() => import('./components/dashboard/DrillsPage'));
const MaterialsPage = React.lazy(() => import('./components/dashboard/MaterialsPage'));
const PeerPracticePage = React.lazy(() => import('./components/dashboard/PeerPracticePage'));
const CoachingPage = React.lazy(() => import('./components/dashboard/CoachingPage'));
const CohortPage = React.lazy(() => import('./components/dashboard/CohortPage'));
const ProfilePage = React.lazy(() => import('./components/dashboard/ProfilePage'));
const CaseCompetitionPage = React.lazy(() => import('./components/dashboard/CaseCompetitionPage'));
const CandidateNotifications = React.lazy(() => import('./components/CandidateNotifications'));

// Mentor dashboard (~200KB — only mentors need this)
const MentorDashboard = React.lazy(() => import('./pages/MentorDashboard'));

// Admin dashboard (~374KB admin components — only admins need this)
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

// CRM (named exports — wrap with .then)
const CRMDashboard = React.lazy(() => import('./pages/CRMDashboard'));
const CRMLogin = React.lazy(() => import('./pages/CRMLogin').then(m => ({ default: m.CRMLogin })));
const CRMSetup = React.lazy(() => import('./pages/CRMLogin').then(m => ({ default: m.CRMSetup })));

// Blog
const BlogPage = React.lazy(() => import('./pages/BlogPage'));
const BlogPostPage = React.lazy(() => import('./pages/BlogPostPage'));

// Utility / test / admin pages
const PartnerApiTester = React.lazy(() => import('./pages/PartnerApiTester'));
const UserPurchasesPage = React.lazy(() => import('./pages/UserPurchasesPage'));
const TestLogin = React.lazy(() => import('./pages/TestLogin'));
const TimezoneTest = React.lazy(() => import('./pages/TimezoneTest'));


// ─── Suspense fallback — minimal spinner matching brand colors ───────────────
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    width: '100%',
  }}>
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid #e5e7eb',
      borderTopColor: '#2E3558',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);


// Google Analytics and Mixpanel page view tracking for SPA
const usePageTracking = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Send page view to Google Analytics on route change
    if (window.gtag) {
      window.gtag('config', 'G-42Z59HPV4S', {
        page_path: location.pathname + location.search,
      });
    }
    
    // Send page view to Mixpanel
    const pageName = location.pathname.split('/').filter(Boolean).join(' / ') || 'Home';
    trackPageView(pageName, location.pathname + location.search);
  }, [location]);
};

// Main App Router
const AppRouter = () => {
  const location = useLocation();
  const [showContactModal, setShowContactModal] = useState(false);
  const [showBecomeCoachModal, setShowBecomeCoachModal] = useState(false);

  // Track page views in Google Analytics
  usePageTracking();

  // Smoothly scroll to #hash on route change, accounting for the floating
  // header + promo banner offset so the section isn't hidden behind them.
  // Polls for the target element (the destination page may render lazily).
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    let cancelled = false;

    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (!el) {
        if (attempt < 30) {
          setTimeout(() => tryScroll(attempt + 1), 100); // up to ~3s
        }
        return;
      }
      const promoH =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--gn-promo-bar-h') || '0',
          10
        ) || 0;
      const headerH = 80; // floating pill (~64px) + 16px gap
      const top = el.getBoundingClientRect().top + window.pageYOffset - (promoH + headerH);
      window.scrollTo({ top, behavior: 'smooth' });
    };

    // Wait one frame before first attempt so destination route can mount.
    const t = setTimeout(() => tryScroll(0), 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [location.pathname, location.hash]);

  // Check if current route is dashboard, mentor dashboard, admin, auth callback, test login, or single-session booking
  const isDashboard = location.pathname.startsWith('/dashboard');
  const isMentorDashboard = location.pathname.startsWith('/mentor-dashboard');
  const isAdminDashboard = location.pathname.startsWith('/admin');
  const isAuthCallback = location.pathname.startsWith('/auth/callback');
  const isTestLogin = location.pathname.startsWith('/test-login');
  // BookSession page (/book/:mentorId) has its own dedicated top bar with back button + heading,
  // so we hide the global gradnext header & promo banner there to avoid the floating navbar
  // overlapping the page heading.
  const isBookSession = location.pathname.startsWith('/book/');
  const isCRM = location.pathname.startsWith('/crm');
  const hideGlobalChrome = isDashboard || isMentorDashboard || isAdminDashboard || isAuthCallback || isTestLogin || isBookSession || isCRM;

  return (
    <div className="App">
      {!hideGlobalChrome && (
        <PromoBanner />
      )}
      {!hideGlobalChrome && <Header user={null} onLogout={() => {}} />}
      {!hideGlobalChrome && (
        <MobilePromoBottomBar />
      )}
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/coaching" element={<Coaching />} />
          <Route path="/book/:mentorId" element={<BookSession />} />
          <Route path="/mentors" element={<MentorsListing />} />
          <Route path="/cohort" element={<Cohort />} />
          <Route path="/cohort/:slug" element={<Cohort />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/test-login" element={<TestLogin />} />
          <Route path="/timezone-test" element={<TimezoneTest />} />
          
          {/* Subscription Landing Page */}
          <Route path="/subscription" element={<SubscriptionLanding />} />
          <Route path="/get-started" element={<GetStarted />} />
          
          {/* Workshops Landing Page */}
          <Route path="/workshops" element={<Workshops />} />
          
          {/* Pillar Options Preview - Temporary */}
          <Route path="/pillar-preview" element={<PillarOptionsPreview />} />
          
          {/* Design Mockups - Temporary */}
          <Route path="/design-mockups" element={<DesignMockups />} />
          
          {/* Legacy Subscription Routes - redirect to main subscription page */}
          <Route path="/subscription/video-course" element={<SubscriptionLanding />} />
          <Route path="/subscription/workshops" element={<SubscriptionLanding />} />
          <Route path="/subscription/drills" element={<SubscriptionLanding />} />
          <Route path="/subscription/resources" element={<SubscriptionLanding />} />
          <Route path="/subscription/peer-practice" element={<SubscriptionLanding />} />
          
          {/* Static Pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/cancellation-refund" element={<CancellationRefund />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/success-stories" element={<TestimonialsPage />} />
          
          {/* Blog Routes */}
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          
          {/* Design Mockups */}
          <Route path="/workshop-designs" element={<WorkshopDesignMockups />} />
          
          {/* Dashboard Routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="videos" element={<VideosPage />} />
            <Route path="workshops" element={<WorkshopsPage />} />
            <Route path="drills" element={<DrillsPage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="peer-practice" element={<PeerPracticePage />} />
            <Route path="coaching" element={<CoachingPage />} />
            <Route path="cohort" element={<CohortPage />} />
            <Route path="competition" element={<CaseCompetitionPage />} />
            <Route path="notifications" element={<CandidateNotifications />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Mentor Dashboard */}
          <Route path="/mentor-dashboard" element={<MentorDashboard />} />

          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* CRM Dashboard */}
          <Route path="/crm" element={<CRMDashboard />} />
          <Route path="/crm/login" element={<CRMLogin />} />
          <Route path="/crm/setup" element={<CRMSetup />} />
          
          {/* Admin User Purchases */}
          <Route path="/admin/users/:userId/purchases" element={<UserPurchasesPage />} />
          
          {/* Partner API Tester */}
          <Route path="/partner-api-tester" element={<PartnerApiTester />} />
          
          {/* Public Competition Page - No login required */}
          <Route path="/competition" element={<CaseCompetitionPage />} />

          {/* Fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      
      {!isDashboard && !isMentorDashboard && !isAdminDashboard && !isTestLogin && (
        <Footer 
          onContactClick={() => setShowContactModal(true)} 
          onBecomeCoachClick={() => setShowBecomeCoachModal(true)}
        />
      )}
      
      {/* Contact Form Modal - Available globally. Lazy-loaded and
          conditionally mounted so its ~228 lines + dependencies aren't
          in main.js. */}
      {showContactModal && (
        <Suspense fallback={null}>
          <ContactFormModal
            isOpen={showContactModal}
            onClose={() => setShowContactModal(false)}
          />
        </Suspense>
      )}
      
      {/* Become a Coach Modal - Available globally */}
      {showBecomeCoachModal && (
        <Suspense fallback={null}>
          <BecomeCoachModal
            isOpen={showBecomeCoachModal}
            onClose={() => setShowBecomeCoachModal(false)}
          />
        </Suspense>
      )}
      
      {/* WhatsApp Chat Widget - Show on public pages only */}
      {!isDashboard && !isMentorDashboard && !isAdminDashboard && !isAuthCallback && !isTestLogin && (
        <Suspense fallback={null}>
          <WhatsAppWidget />
        </Suspense>
      )}
    </div>
  );
};

function App() {
  // Initialize Mixpanel on app load
  useEffect(() => {
    initMixpanel();
  }, []);
  
  return (
    <BrowserRouter>
      <CurrencyProvider>
        <PlansModalProvider>
          <AppRouter />
          {/* Free Trial Upgrade Popup - Shows for free trial users from 2nd visit.
              Lazy-loaded — it's only rendered after a delay, so users don't
              need its code in the initial bundle. */}
          <Suspense fallback={null}>
            <FreeTrialUpgradePopup />
          </Suspense>
        </PlansModalProvider>
      </CurrencyProvider>
    </BrowserRouter>
  );
}

export default App;
