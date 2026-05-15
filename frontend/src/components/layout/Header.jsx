import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import LoginModal from '../LoginModal';
import { fetchCurrentUser, invalidateAuthCache } from '../../utils/authCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Header = ({ user, onLogout }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine if scrolled past threshold for background change
      setIsScrolled(currentScrollY > 20);
      
      // Hide/show logic: hide on scroll down past 500px (near CTA button), show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 500) {
        // Scrolling DOWN and past 500px - hide navbar
        setIsHidden(true);
      } else {
        // Scrolling UP - show navbar
        setIsHidden(false);
      }
      
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Close mobile menu on route change using layout effect
  React.useLayoutEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location.pathname]);

  // Check for existing session on mount (uses shared cache to avoid duplicate /api/auth/me)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await fetchCurrentUser();
        if (userData) {
          setCurrentUser(userData);
        }
      } catch (error) {
        // Not logged in
      }
    };
    checkAuth();
  }, []);

  const subscriptionLink = { name: 'Subscription', path: '/subscription' };

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setShowLoginModal(false);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setCurrentUser(null);
    if (onLogout) onLogout();
    navigate('/');
  };

  const goToDashboard = () => {
    if (!currentUser) return;
    
    if (currentUser.role === 'admin' || currentUser.is_admin) {
      navigate('/admin');
    } else if (currentUser.role === 'mentor' || currentUser.is_mentor) {
      navigate('/mentor-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      {/* Spacer for floating nav */}
      <div className="h-6" />
      
      <header
        className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out rounded-2xl ${
          isHidden 
            ? '-top-24 opacity-0' 
            : 'opacity-100'
        }`}
        style={{ 
          top: isHidden ? undefined : 'calc(1rem + var(--gn-promo-bar-h, 0px))',
          width: 'min(1100px, calc(100% - 48px))',
          background: isScrolled 
            ? 'rgba(255, 255, 255, 0.7)' 
            : 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: isScrolled
            ? '0 8px 32px rgba(46, 53, 88, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.5) inset'
            : '0 4px 24px rgba(46, 53, 88, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.4) inset'
        }}
      >
        <div className="px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/gradnext-logo.png" 
              alt="gradnext" 
              className="h-6 sm:h-8 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: location.pathname === '/' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                backgroundColor: location.pathname === '/' ? 'var(--gn-periwinkle-lighter)' : 'transparent'
              }}
            >
              Home
            </Link>

            {/* Subscription Link - Single page */}
            <Link
              to="/subscription"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: location.pathname.startsWith('/subscription') ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                backgroundColor: location.pathname.startsWith('/subscription') ? 'var(--gn-periwinkle-lighter)' : 'transparent'
              }}
            >
              Subscription
            </Link>

            <Link
              to="/coaching"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: location.pathname === '/coaching' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                backgroundColor: location.pathname === '/coaching' ? 'var(--gn-periwinkle-lighter)' : 'transparent'
              }}
            >
              Coaching
            </Link>

            <Link
              to="/cohort"
              data-testid="nav-cohort-link"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: location.pathname.startsWith('/cohort') ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                backgroundColor: location.pathname.startsWith('/cohort') ? 'var(--gn-periwinkle-lighter)' : 'transparent'
              }}
            >
              Cohort
            </Link>

            <Link
              to="/pricing"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: location.pathname === '/pricing' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                backgroundColor: location.pathname === '/pricing' ? 'var(--gn-periwinkle-lighter)' : 'transparent'
              }}
            >
              Pricing
            </Link>
          </nav>

          {/* Auth Buttons with Workshops link */}
          <div className="hidden md:flex items-center gap-3">
            {/* Workshops Link - Simple text style */}
            <Link
              to="/workshops"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: location.pathname === '/workshops' ? 'var(--gn-rhino)' : 'var(--gn-grey-dark)',
                backgroundColor: location.pathname === '/workshops' ? 'var(--gn-periwinkle-lighter)' : 'transparent'
              }}
            >
              Workshops
            </Link>
            
            {currentUser ? (
              <button
                onClick={goToDashboard}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title={currentUser.name}
              >
                <img
                  src={currentUser.picture || 'https://via.placeholder.com/32'}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-full border-2 border-white shadow-md"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>View Dashboard</span>
              </button>
            ) : (
              <Button
                onClick={() => setShowLoginModal(true)}
                className="shadow-md hover:shadow-lg transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-periwinkle) 100%)',
                  color: 'white'
                }}
              >
                Login
              </Button>
            )}
          </div>

          {/* Login Modal */}
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onSuccess={handleLoginSuccess}
          />

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ backgroundColor: isMobileMenuOpen ? 'var(--gn-periwinkle-lighter)' : 'transparent' }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" style={{ color: 'var(--gn-rhino)' }} />
            ) : (
              <Menu className="w-6 h-6" style={{ color: 'var(--gn-grey-dark)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
          <div className="px-4 py-4 space-y-2">
            <Link
              to="/"
              className="block px-4 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Home
            </Link>

            <Link
              to="/subscription"
              className="block px-4 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Subscription
            </Link>

            <Link
              to="/coaching"
              className="block px-4 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Coaching
            </Link>

            <Link
              to="/cohort"
              data-testid="nav-cohort-link-mobile"
              className="block px-4 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Cohort
            </Link>

            <Link
              to="/pricing"
              className="block px-4 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Pricing
            </Link>

            <Link
              to="/workshops"
              className="block px-4 py-2.5 rounded-lg transition-colors"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Workshops
            </Link>

            <div className="pt-4 space-y-2" style={{ borderTop: '1px solid var(--gn-grey-light)' }}>
              {currentUser ? (
                <button
                  onClick={goToDashboard}
                  className="flex items-center gap-3 px-4 w-full"
                  title={currentUser.name}
                >
                  <img
                    src={currentUser.picture || 'https://via.placeholder.com/32'}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-full border-2 border-white shadow-md"
                  />
                  <span className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>Go to Dashboard</span>
                </button>
              ) : (
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowLoginModal(true);
                  }}
                  className="w-full text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-periwinkle) 100%)'
                  }}
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
    </>
  );
};

export default Header;
