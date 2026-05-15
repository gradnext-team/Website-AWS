import React, { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
} from './ui/dialog';
import { usePlansModal } from '../contexts/PlansModalContext';
import axios from 'axios';
import { trackUpgradeButtonClick } from '../utils/mixpanel';
import { fetchCurrentUser } from '../utils/authCache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Free Trial Upgrade Popup
 * Shows a limited-time offer popup for free trial users
 * - Appears from 2nd unique daily login onwards (uses backend daily_login records, same as Lead Scoring visits)
 * - Shows once per session
 * - Stops showing after upgrade or trial end
 */
const FreeTrialUpgradePopup = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [user, setUser] = useState(null);
  const { openPlansModal } = usePlansModal();

  useEffect(() => {
    checkAndShowPopup();
  }, []);

  const checkAndShowPopup = async () => {
    // Check if already shown this session
    const shownThisSession = sessionStorage.getItem('freeTrialPopupShown');
    if (shownThisSession) {
      return;
    }

    try {
      // Fetch user data (shared cache — no extra network call)
      const userData = await fetchCurrentUser();
      if (!userData) return;
      setUser(userData);

      // Only show for free trial users
      if (userData.plan !== 'free_trial') {
        return;
      }

      // Check visit count from backend (uses daily_login records in user_activity)
      const visitRes = await axios.get(`${BACKEND_URL}/api/tracking/visit-count`, { withCredentials: true });
      const visitCount = visitRes.data.count || 0;

      // Show popup from 2nd daily login onwards
      if (visitCount >= 2) {
        setShowPopup(true);
        // Mark as shown for this session
        sessionStorage.setItem('freeTrialPopupShown', 'true');
      }
    } catch (err) {
      // User not logged in or error - don't show popup
      console.log('User not logged in or error fetching user data');
    }
  };

  const handleUpgradeClick = () => {
    // Track upgrade button click with Mixpanel
    trackUpgradeButtonClick('free_trial_popup', user?.plan || 'free_trial', null, window.location.pathname);
    setShowPopup(false);
    openPlansModal();
  };

  const handleDismiss = () => {
    setShowPopup(false);
  };

  if (!showPopup) {
    return null;
  }

  return (
    <Dialog open={showPopup} onOpenChange={setShowPopup}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 z-10 rounded-full p-1 bg-white/80 hover:bg-white transition-colors"
        >
          <X className="h-5 w-5" style={{ color: 'var(--gn-grey-dark)' }} />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Gift Icon */}
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(140, 157, 255, 0.15)' }}
          >
            <Gift className="w-8 h-8" style={{ color: 'var(--gn-periwinkle)' }} />
          </div>

          {/* Heading */}
          <h2 
            className="text-2xl font-bold text-center mb-3"
            style={{ color: 'var(--gn-rhino)' }}
          >
            Limited Time Offer
          </h2>

          {/* Description */}
          <p 
            className="text-center text-base mb-6"
            style={{ color: 'var(--gn-grey-dark)' }}
          >
            Use coupon code{' '}
            <span 
              className="font-bold px-2 py-1 rounded"
              style={{ background: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}
            >
              WELCOME50
            </span>{' '}
            for 50% Off on your first billing cycle.
          </p>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleUpgradeClick}
              className="w-full rounded-xl font-semibold py-3"
              style={{ 
                background: 'var(--gn-rhino)', 
                color: 'white' 
              }}
            >
              Upgrade Now
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="w-full rounded-xl font-medium"
              style={{ color: 'var(--gn-grey-dark)' }}
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeTrialUpgradePopup;
