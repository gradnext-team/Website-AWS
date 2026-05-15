import React, { createContext, useContext, useState, useEffect } from 'react';
import PlansModal from '../components/ui/PlansModal';
import { trackEvent } from '../utils/tracking';
import { trackPlansModalOpened } from '../utils/mixpanel';
import { fetchCurrentUser } from '../utils/authCache';

const PlansModalContext = createContext();
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Hook to access Plans Modal from anywhere in the app
 * @returns {Object} { openPlansModal, closePlansModal }
 */
export const usePlansModal = () => {
  const context = useContext(PlansModalContext);
  if (!context) {
    throw new Error('usePlansModal must be used within PlansModalProvider');
  }
  return context;
};

/**
 * Provider component to wrap the app and provide global Plans Modal
 */
export const PlansModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch user data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchUser();
    }
  }, [isOpen]);

  const fetchUser = async () => {
    try {
      const userData = await fetchCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const openPlansModal = () => {
    trackEvent('pricing_modal_opened');
    trackPlansModalOpened('global');
    setIsOpen(true);
  };

  const closePlansModal = () => {
    setIsOpen(false);
  };

  const handleSuccess = () => {
    // Reload the page to refresh user data after successful subscription
    window.location.reload();
  };

  return (
    <PlansModalContext.Provider value={{ openPlansModal, closePlansModal }}>
      {children}
      <PlansModal 
        open={isOpen} 
        onOpenChange={setIsOpen}
        user={user}
        onSuccess={handleSuccess}
      />
    </PlansModalContext.Provider>
  );
};
