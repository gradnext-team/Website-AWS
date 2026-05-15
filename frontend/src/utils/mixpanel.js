/**
 * Mixpanel Analytics Utility
 * Provides tracking functions for user events, logins, upgrades, etc.
 */

import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel with project token
const MIXPANEL_TOKEN = process.env.REACT_APP_MIXPANEL_TOKEN;

let isInitialized = false;

/**
 * Initialize Mixpanel - call this once on app load
 */
export const initMixpanel = () => {
  if (!MIXPANEL_TOKEN) {
    console.warn('[Mixpanel] Token not configured, analytics disabled');
    return;
  }
  
  if (isInitialized) return;
  
  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: false, // We'll track manually for more control
      persistence: 'localStorage',
      ignore_dnt: false, // Respect Do Not Track
    });
    isInitialized = true;
    console.log('[Mixpanel] Initialized successfully');
  } catch (error) {
    console.error('[Mixpanel] Failed to initialize:', error);
  }
};

/**
 * Check if Mixpanel is enabled
 */
export const isEnabled = () => {
  return isInitialized && !!MIXPANEL_TOKEN;
};

/**
 * Identify user after login
 * @param {string} userId - The user's unique ID
 * @param {object} userProperties - User properties to set
 */
export const identifyUser = (userId, userProperties = {}) => {
  if (!isEnabled()) return;
  
  try {
    mixpanel.identify(userId);
    
    // Set user profile properties
    if (Object.keys(userProperties).length > 0) {
      mixpanel.people.set({
        $name: userProperties.name,
        $email: userProperties.email,
        plan: userProperties.plan,
        ...userProperties
      });
    }
    
    console.log('[Mixpanel] User identified:', userId);
  } catch (error) {
    console.error('[Mixpanel] Failed to identify user:', error);
  }
};

/**
 * Reset user identity (on logout)
 */
export const resetUser = () => {
  if (!isEnabled()) return;
  
  try {
    mixpanel.reset();
    console.log('[Mixpanel] User reset');
  } catch (error) {
    console.error('[Mixpanel] Failed to reset user:', error);
  }
};

/**
 * Track a generic event
 * @param {string} eventName - Name of the event
 * @param {object} properties - Event properties
 */
export const trackEvent = (eventName, properties = {}) => {
  if (!isEnabled()) return;
  
  try {
    mixpanel.track(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
    console.log('[Mixpanel] Event tracked:', eventName, properties);
  } catch (error) {
    console.error('[Mixpanel] Failed to track event:', error);
  }
};

// ============ SPECIFIC TRACKING FUNCTIONS ============

/**
 * Track user login
 * @param {object} user - User object with id, email, name, plan
 * @param {string} method - Login method ('email', 'google', 'otp')
 */
export const trackLogin = (user, method = 'email') => {
  if (!user?.id) return;
  
  identifyUser(user.id, {
    name: user.name,
    email: user.email,
    plan: user.plan,
  });
  
  trackEvent('user_logged_in', {
    login_method: method,
    plan: user.plan,
  });
  
  // Increment login count
  if (isEnabled()) {
    try {
      mixpanel.people.increment('login_count');
    } catch (error) {
      console.error('[Mixpanel] Failed to increment login count:', error);
    }
  }
};

/**
 * Track upgrade button click
 * @param {string} buttonLocation - Where the button was clicked
 * @param {string} currentPlan - User's current plan
 * @param {string} targetPlan - Plan being upgraded to (if known)
 * @param {string} page - Current page URL or name
 */
export const trackUpgradeButtonClick = (buttonLocation, currentPlan = null, targetPlan = null, page = null) => {
  trackEvent('upgrade_button_clicked', {
    button_location: buttonLocation,
    current_plan: currentPlan,
    target_plan: targetPlan,
    page: page || window.location.pathname,
  });
};

/**
 * Track successful subscription upgrade
 * @param {string} oldPlan - Previous plan
 * @param {string} newPlan - New plan
 * @param {string} billingCycle - Billing cycle ('monthly' or '6_month')
 * @param {number} amount - Amount paid
 * @param {string} couponCode - Coupon used if any
 */
export const trackSubscriptionUpgraded = (oldPlan, newPlan, billingCycle, amount = null, couponCode = null) => {
  trackEvent('subscription_upgraded', {
    old_plan: oldPlan,
    new_plan: newPlan,
    billing_cycle: billingCycle,
    amount: amount,
    coupon_code: couponCode,
  });
  
  // Update user profile with new plan
  if (isEnabled()) {
    try {
      mixpanel.people.set({
        plan: newPlan,
        billing_cycle: billingCycle,
        last_upgrade_date: new Date().toISOString(),
      });
      mixpanel.people.increment('total_upgrades');
    } catch (error) {
      console.error('[Mixpanel] Failed to update user profile:', error);
    }
  }
};

/**
 * Track page view
 * @param {string} pageName - Name of the page
 * @param {string} pageUrl - URL of the page
 */
export const trackPageView = (pageName, pageUrl = null) => {
  trackEvent('page_viewed', {
    page_name: pageName,
    page_url: pageUrl || window.location.pathname,
  });
};

/**
 * Track video play started
 * @param {string} videoId - Video ID
 * @param {string} videoTitle - Video title
 * @param {string} videoCategory - Video category/module
 */
export const trackVideoPlay = (videoId, videoTitle = null, videoCategory = null) => {
  trackEvent('video_play_started', {
    video_id: videoId,
    video_title: videoTitle,
    video_category: videoCategory,
  });
};

/**
 * Track video completed
 * @param {string} videoId - Video ID
 * @param {string} videoTitle - Video title
 * @param {number} watchDuration - Duration watched in seconds
 * @param {number} videoDuration - Total video duration in seconds
 */
export const trackVideoCompleted = (videoId, videoTitle = null, watchDuration = null, videoDuration = null) => {
  let completionPct = null;
  if (watchDuration && videoDuration && videoDuration > 0) {
    completionPct = Math.round((watchDuration / videoDuration) * 100);
  }
  
  trackEvent('video_viewed', {
    video_id: videoId,
    video_title: videoTitle,
    watch_duration_seconds: watchDuration,
    video_duration_seconds: videoDuration,
    completion_percentage: completionPct,
  });
  
  // Increment videos watched count
  if (isEnabled()) {
    try {
      mixpanel.people.increment('videos_watched');
    } catch (error) {
      console.error('[Mixpanel] Failed to increment videos watched:', error);
    }
  }
};

/**
 * Track drill started
 * @param {string} drillId - Drill ID
 * @param {string} drillTitle - Drill title
 * @param {string} drillCategory - Drill category
 */
export const trackDrillStarted = (drillId, drillTitle = null, drillCategory = null) => {
  trackEvent('drill_started', {
    drill_id: drillId,
    drill_title: drillTitle,
    drill_category: drillCategory,
  });
};

/**
 * Track drill completed
 * @param {string} drillId - Drill ID
 * @param {string} drillTitle - Drill title
 * @param {number} score - Score achieved
 * @param {number} timeSpent - Time spent in seconds
 */
export const trackDrillCompleted = (drillId, drillTitle = null, score = null, timeSpent = null) => {
  trackEvent('drill_completed', {
    drill_id: drillId,
    drill_title: drillTitle,
    score: score,
    time_spent_seconds: timeSpent,
  });
  
  // Increment drills completed count
  if (isEnabled()) {
    try {
      mixpanel.people.increment('drills_completed');
    } catch (error) {
      console.error('[Mixpanel] Failed to increment drills completed:', error);
    }
  }
};

/**
 * Track session booked
 * @param {string} sessionId - Session ID
 * @param {string} sessionType - 'coaching' or 'peer'
 * @param {string} mentorId - Mentor ID (for coaching)
 * @param {string} mentorName - Mentor name
 * @param {string} sessionDate - Session date
 */
export const trackSessionBooked = (sessionId, sessionType, mentorId = null, mentorName = null, sessionDate = null) => {
  trackEvent(`${sessionType}_session_booked`, {
    session_id: sessionId,
    session_type: sessionType,
    mentor_id: mentorId,
    mentor_name: mentorName,
    session_date: sessionDate,
  });
  
  // Increment sessions booked count
  if (isEnabled()) {
    try {
      mixpanel.people.increment(`${sessionType}_sessions_booked`);
    } catch (error) {
      console.error('[Mixpanel] Failed to increment sessions booked:', error);
    }
  }
};

/**
 * Track workshop registration
 * @param {string} workshopId - Workshop ID
 * @param {string} workshopTitle - Workshop title
 * @param {string} workshopDate - Workshop date
 */
export const trackWorkshopRegistered = (workshopId, workshopTitle = null, workshopDate = null) => {
  trackEvent('workshop_registered', {
    workshop_id: workshopId,
    workshop_title: workshopTitle,
    workshop_date: workshopDate,
  });
  
  // Increment workshops registered count
  if (isEnabled()) {
    try {
      mixpanel.people.increment('workshops_registered');
    } catch (error) {
      console.error('[Mixpanel] Failed to increment workshops registered:', error);
    }
  }
};

/**
 * Track resource download
 * @param {string} resourceId - Resource ID
 * @param {string} resourceTitle - Resource title
 * @param {string} resourceCategory - Resource category
 */
export const trackResourceDownloaded = (resourceId, resourceTitle = null, resourceCategory = null) => {
  trackEvent('resource_downloaded', {
    resource_id: resourceId,
    resource_title: resourceTitle,
    resource_category: resourceCategory,
  });
  
  // Increment resources downloaded count
  if (isEnabled()) {
    try {
      mixpanel.people.increment('resources_downloaded');
    } catch (error) {
      console.error('[Mixpanel] Failed to increment resources downloaded:', error);
    }
  }
};

/**
 * Track plans modal opened
 * @param {string} source - Where the modal was triggered from
 */
export const trackPlansModalOpened = (source) => {
  trackEvent('plans_modal_opened', {
    source: source,
    page: window.location.pathname,
  });
};

/**
 * Track plan selected in modal
 * @param {string} planKey - Selected plan key
 * @param {string} billingCycle - Selected billing cycle
 */
export const trackPlanSelected = (planKey, billingCycle) => {
  trackEvent('plan_selected', {
    plan_key: planKey,
    billing_cycle: billingCycle,
    page: window.location.pathname,
  });
};

// Export all functions
export default {
  initMixpanel,
  isEnabled,
  identifyUser,
  resetUser,
  trackEvent,
  trackLogin,
  trackUpgradeButtonClick,
  trackSubscriptionUpgraded,
  trackPageView,
  trackVideoPlay,
  trackVideoCompleted,
  trackDrillStarted,
  trackDrillCompleted,
  trackSessionBooked,
  trackWorkshopRegistered,
  trackResourceDownloaded,
  trackPlansModalOpened,
  trackPlanSelected,
};
