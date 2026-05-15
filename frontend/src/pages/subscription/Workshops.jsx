import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Video, Calendar, Users, Clock, MessageSquare, Play, Loader2, CheckCircle2, Mail, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { subscriptionFeatures } from '../../data/mock';
import LoginModal from '../../components/LoginModal';
import OptimizedImage from '../../components/ui/OptimizedImage';
import {
  Dialog,
  DialogContent,
} from '../../components/ui/dialog';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const Workshops = () => {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registrationError, setRegistrationError] = useState(null);

  // Handle workshop registration after login
  const handleWorkshopAction = (workshop, isPast = false) => {
    setSelectedWorkshop({ ...workshop, isPast });
    setShowLoginModal(true);
  };

  // After successful login, register for workshop and show success message
  const handleLoginSuccess = async (user) => {
    setShowLoginModal(false);
    setRegistrationError(null);
    
    if (selectedWorkshop && !selectedWorkshop.isPast) {
      // For upcoming workshops, register the user
      try {
        setRegistrationLoading(true);
        const token = localStorage.getItem('token');
        await axios.post(
          `${BACKEND_URL}/api/resources/workshops/${selectedWorkshop.id}/register`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Registration successful - show success modal
        setShowSuccessModal(true);
      } catch (err) {
        console.error('Workshop registration error:', err);
        const errorMessage = err.response?.data?.detail || 'Registration failed. Please try again.';
        setRegistrationError(errorMessage);
        // Still show success modal but with error info, or navigate to dashboard
        if (errorMessage.includes('already registered')) {
          setShowSuccessModal(true);
        } else {
          navigate('/dashboard');
        }
      } finally {
        setRegistrationLoading(false);
      }
    } else {
      // For past workshops or general signup, navigate to dashboard
      navigate('/dashboard');
    }
  };

  const handleStartTrial = () => {
    setSelectedWorkshop(null);
    setShowLoginModal(true);
  };

  const handleGoToDashboard = () => {
    setShowSuccessModal(false);
    navigate('/dashboard');
  };

  const { workshops: workshopMeta } = subscriptionFeatures;

  useEffect(() => {
    const fetchWorkshops = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/admin/workshops/public`);
        setWorkshops(response.data);
      } catch (err) {
        console.error('Failed to fetch workshops:', err);
        setError('Failed to load workshops');
      } finally {
        setLoading(false);
      }
    };
    fetchWorkshops();
  }, []);

  // Workshop Card Component
  const WorkshopCard = ({ workshop, isPast = false }) => {
    const thumbnail = workshop.thumbnail_card || workshop.thumbnail || null;
    
    return (
      <div 
        className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col"
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(140, 157, 255, 0.15)' 
        }}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden">
          <OptimizedImage 
            src={thumbnail}
            alt={workshop.title}
            className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            fallbackElement={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                <Video className="w-12 h-12" style={{ color: 'var(--gn-periwinkle)' }} />
              </div>
            }
          />
          
          {/* Status Badge */}
          {isPast ? (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 text-white text-xs font-medium">
              <Play className="w-3 h-3" />
              Recording Available
            </div>
          ) : workshop.status === 'live' ? (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              LIVE NOW
            </div>
          ) : (
            <div 
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
            >
              Upcoming
            </div>
          )}
          
          {/* Free Badge */}
          {workshop.is_free && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green-500 text-white text-xs font-medium">
              Free
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-5 flex flex-col flex-grow">
          <h3 
            className="font-semibold text-lg mb-2 line-clamp-2"
            style={{ color: 'var(--gn-rhino)' }}
          >
            {workshop.title}
          </h3>
          
          <p 
            className="text-sm mb-4 line-clamp-2"
            style={{ color: 'var(--gn-grey-dark)' }}
          >
            {workshop.description}
          </p>
          
          {/* Instructor */}
          <div className="flex items-center gap-2 mb-4">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: 'rgba(140, 157, 255, 0.15)', color: 'var(--gn-rhino)' }}
            >
              {workshop.instructor?.charAt(0) || 'M'}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>
                {workshop.instructor || 'Expert Mentor'}
              </p>
              <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>
                {workshop.instructor_title || 'MBB Consultant'}
              </p>
            </div>
          </div>
          
          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--gn-grey-dark)' }}>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--gn-periwinkle)' }} />
              {workshop.date}
            </div>
            {workshop.time && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--gn-periwinkle)' }} />
                {workshop.time}
              </div>
            )}
            {workshop.duration && (
              <div className="flex items-center gap-1">
                <Video className="w-3.5 h-3.5" style={{ color: 'var(--gn-periwinkle)' }} />
                {workshop.duration}
              </div>
            )}
          </div>
          
          {/* Registration Count for upcoming */}
          {!isPast && workshop.registration_count > 0 && (
            <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: 'var(--gn-grey)' }}>
              <Users className="w-3.5 h-3.5" />
              {workshop.registration_count} registered
            </div>
          )}
          
          {/* CTA Button */}
          <div className="mt-auto pt-4">
            <Button 
              onClick={() => handleWorkshopAction(workshop, isPast)}
              className="w-full rounded-xl font-semibold"
              style={{ 
                background: 'var(--gn-rhino)', 
                color: 'white' 
              }}
            >
              {isPast ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Subscribe to Watch
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Register Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen" 
      style={{ background: 'linear-gradient(180deg, #fdfeff 0%, #f8f9ff 50%, #f5f7ff 100%)' }}
    >
      {/* Hero */}
      <section className="hero-section pt-24 sm:pt-36 pb-12 sm:pb-20 overflow-hidden relative">
        {/* Concentric Circles Background */}
        <div className="hero-concentric">
          <div className="hero-center-glow" />
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-circle hero-circle-3" />
          <div className="hero-circle hero-circle-4" />
          <div className="hero-circle hero-circle-5" />
          <div className="hero-circle hero-circle-6" />
          <div className="hero-circle hero-circle-7" />
          <div className="hero-circle hero-circle-8" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge with yellow accent */}
            <div className="badge-primary mb-4 sm:mb-8 animate-fade-in inline-flex mx-auto text-sm">
              <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
              <span>Live Workshops</span>
            </div>

            <h1 
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 animate-fade-in-up"
              style={{ color: 'var(--gn-rhino)', lineHeight: '1.1' }}
            >
              {workshopMeta.title}
            </h1>
            <p 
              className="text-lg mb-8 animate-fade-in-up"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              {workshopMeta.description}
            </p>

            <Button 
              onClick={handleStartTrial} 
              size="lg" 
              className="rounded-xl font-semibold animate-fade-in-up"
              style={{ 
                background: 'var(--gn-rhino)', 
                color: 'white' 
              }}
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 
            className="text-3xl font-bold mb-12 text-center"
            style={{ color: 'var(--gn-rhino)' }}
          >
            How Workshops Work
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(140, 157, 255, 0.15)' }}
              >
                <Calendar className="w-7 h-7" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>Register</h3>
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>Sign up for upcoming workshops in your dashboard</p>
            </div>
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(140, 157, 255, 0.15)' }}
              >
                <Video className="w-7 h-7" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>Join Live</h3>
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>Attend the live interactive session</p>
            </div>
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(140, 157, 255, 0.15)' }}
              >
                <MessageSquare className="w-7 h-7" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>Participate</h3>
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>Engage live and ask questions to the experts</p>
            </div>
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(140, 157, 255, 0.15)' }}
              >
                <Users className="w-7 h-7" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>Access Recordings</h3>
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>Review session recordings anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Workshops */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl font-bold mb-4"
              style={{ color: 'var(--gn-rhino)' }}
            >
              Upcoming Workshops
            </h2>
            <p style={{ color: 'var(--gn-grey-dark)' }}>Register now to secure your spot</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gn-periwinkle)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-12" style={{ color: 'var(--gn-grey)' }}>
              {error}
            </div>
          ) : workshops.upcoming.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.upcoming.map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} />
              ))}
            </div>
          ) : (
            <div 
              className="text-center py-12 rounded-2xl"
              style={{ background: 'rgba(255, 255, 255, 0.7)' }}
            >
              <Video className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--gn-periwinkle)' }} />
              <p style={{ color: 'var(--gn-grey-dark)' }}>No upcoming workshops scheduled yet.</p>
              <p className="text-sm mt-2" style={{ color: 'var(--gn-grey)' }}>Check back soon for new sessions!</p>
            </div>
          )}
        </div>
      </section>

      {/* Past Workshops */}
      {workshops.past.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 
                className="text-3xl font-bold mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                Past Workshops
              </h2>
              <p style={{ color: 'var(--gn-grey-dark)' }}>Watch recordings with your subscription</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.past.map((workshop) => (
                <WorkshopCard key={workshop.id} workshop={workshop} isPast />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mt-12">
            <p className="mb-6 text-lg" style={{ color: 'var(--gn-grey-dark)' }}>
              Ready to start your preparation?
            </p>
            <div className="flex justify-center">
              <Button 
                onClick={handleStartTrial} 
                size="lg" 
                className="rounded-xl font-semibold px-8 py-4"
                style={{ 
                  background: 'var(--gn-rhino)', 
                  color: 'white' 
                }}
              >
                Start 7-Day Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setSelectedWorkshop(null);
        }}
        onSuccess={handleLoginSuccess}
        skipNavigation={true}
      />

      {/* Registration Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          {/* Close Button */}
          <button
            onClick={() => {
              setShowSuccessModal(false);
              navigate('/dashboard');
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
          >
            <X className="h-5 w-5" style={{ color: 'var(--gn-grey-dark)' }} />
            <span className="sr-only">Close</span>
          </button>
          
          <div className="flex flex-col items-center text-center py-6">
            {/* Success Icon */}
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(34, 197, 94, 0.1)' }}
            >
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            
            {/* Success Message */}
            <h2 
              className="text-2xl font-bold mb-3"
              style={{ color: 'var(--gn-rhino)' }}
            >
              Congratulations!
            </h2>
            
            <p 
              className="text-base mb-2"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              You have successfully registered for the workshop
            </p>
            
            {selectedWorkshop && (
              <p 
                className="text-lg font-semibold mb-4"
                style={{ color: 'var(--gn-rhino)' }}
              >
                "{selectedWorkshop.title}"
              </p>
            )}
            
            {/* Email notification info */}
            <div 
              className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 w-full"
              style={{ background: 'rgba(140, 157, 255, 0.1)' }}
            >
              <Mail className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
              <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                You will receive an email invite with the workshop details shortly.
              </p>
            </div>
            
            {/* CTA Button */}
            <Button 
              onClick={handleGoToDashboard}
              size="lg"
              className="w-full rounded-xl font-semibold"
              style={{ 
                background: 'var(--gn-rhino)', 
                color: 'white' 
              }}
            >
              Explore More
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading Overlay */}
      {registrationLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: 'var(--gn-periwinkle)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--gn-rhino)' }}>
              Registering for workshop...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workshops;
