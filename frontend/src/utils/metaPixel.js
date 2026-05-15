/**
 * Meta Pixel Tracking Utility
 * Pixel ID: 1459804045037272
 * 
 * Standard Events: PageView, Lead, CompleteRegistration, Purchase, InitiateCheckout
 * Custom Events: Login
 * 
 * Event Deduplication Strategy: External ID + FBP
 * -------------------------------------------------
 * Both browser pixel and server CAPI send the same external_id (user ID)
 * and fbp (_fbp cookie). Meta automatically deduplicates events with
 * matching event_name + external_id/fbp within 48 hours.
 * 
 * Browser pixel gets external_id via fbq('init', PIXEL_ID, { external_id: userId })
 * Server CAPI gets external_id + fbp passed from frontend in API calls.
 */

const META_PIXEL_ID = '1459804045037272';

/**
 * Generate a unique event ID for deduplication
 * This ID should be passed to both browser pixel and server CAPI
 * @returns {string} Unique event ID
 */
export const generateEventId = () => {
  // Generate a UUID-like string for event deduplication
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `evt_${timestamp}_${randomPart}`;
};

// Check if fbq is available
const isFbqAvailable = () => {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
};

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null
 */
const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

/**
 * Get the _fbp cookie (Facebook Browser ID)
 * This is set by the Meta Pixel and identifies the browser
 * @returns {string|null}
 */
export const getFbpCookie = () => getCookie('_fbp');

/**
 * Get the _fbc cookie (Facebook Click ID)
 * This is set when user arrives from a Facebook ad click
 * @returns {string|null}
 */
export const getFbcCookie = () => getCookie('_fbc');

/**
 * Get all Meta tracking cookies and identifiers for passing to backend CAPI
 * Call this before API requests that trigger server-side CAPI events
 * @returns {{ fbp: string|null, fbc: string|null }}
 */
export const getMetaCookies = () => ({
  fbp: getFbpCookie(),
  fbc: getFbcCookie(),
});

/**
 * Get Meta tracking data as HTTP headers for passing to backend CAPI
 * Use this with fetch() calls: headers: { ...getMetaHeaders() }
 * The backend reads these headers to include fbp/fbc in server events
 * @returns {object} Headers object with X-Meta-Fbp and X-Meta-Fbc (only if values exist)
 */
export const getMetaHeaders = () => {
  const headers = {};
  const fbp = getFbpCookie();
  const fbc = getFbcCookie();
  if (fbp) headers['X-Meta-Fbp'] = fbp;
  if (fbc) headers['X-Meta-Fbc'] = fbc;
  return headers;
};

/**
 * Set user data (external_id) on the Meta Pixel for deduplication
 * This re-initializes the pixel with Advanced Matching user data.
 * Must be called after user logs in or signs up.
 * 
 * Meta's pixel SDK will SHA-256 hash the external_id before sending.
 * The backend CAPI also hashes it the same way, enabling deduplication.
 * 
 * @param {string} userId - The raw user ID (will be hashed by pixel SDK)
 * @param {string} [userEmail] - Optional user email for better matching
 */
export const setUserData = (userId, userEmail = null) => {
  if (!isFbqAvailable()) {
    console.warn('[Meta Pixel] Not loaded, cannot set user data');
    return;
  }
  
  try {
    const userData = {};
    
    if (userId) {
      userData.external_id = userId;
    }
    
    if (userEmail) {
      userData.em = userEmail;
    }
    
    if (Object.keys(userData).length > 0) {
      // Re-init the pixel with user data for Advanced Matching + External ID dedup
      window.fbq('init', META_PIXEL_ID, userData);
      console.log('[Meta Pixel] User data set for deduplication:', { external_id: userId ? '***' : null, em: userEmail ? '***' : null });
    }
  } catch (error) {
    console.error('[Meta Pixel] Error setting user data:', error);
  }
};

/**
 * Clear user data from pixel (call on logout)
 */
export const clearUserData = () => {
  if (!isFbqAvailable()) return;
  try {
    // Re-init pixel without user data
    window.fbq('init', META_PIXEL_ID);
    console.log('[Meta Pixel] User data cleared');
  } catch (error) {
    console.error('[Meta Pixel] Error clearing user data:', error);
  }
};

/**
 * Track a Meta Pixel event with optional event ID for deduplication
 * @param {string} eventName - Standard or custom event name
 * @param {object} params - Event parameters
 * @param {string} eventId - Optional event ID for deduplication with CAPI
 */
export const trackEvent = (eventName, params = {}, eventId = null) => {
  if (!isFbqAvailable()) {
    console.warn('Meta Pixel not loaded');
    return null;
  }
  
  try {
    // Generate event ID if not provided
    const dedupEventId = eventId || generateEventId();
    
    // Pass eventID as 4th argument for deduplication
    window.fbq('track', eventName, params, { eventID: dedupEventId });
    console.log(`[Meta Pixel] Tracked: ${eventName}`, { params, eventID: dedupEventId });
    
    return dedupEventId;
  } catch (error) {
    console.error('[Meta Pixel] Error tracking event:', error);
    return null;
  }
};

/**
 * Track a custom Meta Pixel event with optional event ID for deduplication
 * @param {string} eventName - Custom event name
 * @param {object} params - Event parameters
 * @param {string} eventId - Optional event ID for deduplication with CAPI
 */
export const trackCustomEvent = (eventName, params = {}, eventId = null) => {
  if (!isFbqAvailable()) {
    console.warn('Meta Pixel not loaded');
    return null;
  }
  
  try {
    // Generate event ID if not provided
    const dedupEventId = eventId || generateEventId();
    
    // Pass eventID as 4th argument for deduplication
    window.fbq('trackCustom', eventName, params, { eventID: dedupEventId });
    console.log(`[Meta Pixel] Tracked Custom: ${eventName}`, { params, eventID: dedupEventId });
    
    return dedupEventId;
  } catch (error) {
    console.error('[Meta Pixel] Error tracking custom event:', error);
    return null;
  }
};

/**
 * Track page view - called automatically on page load
 * PageView typically doesn't need deduplication (browser-only event)
 */
export const trackPageView = () => {
  trackEvent('PageView');
};

/**
 * Track user sign up / registration
 * @param {object} data - { method: 'google'|'email', content_name: 'signup' }
 * @param {string} eventId - Event ID for deduplication with CAPI
 * @returns {string} Event ID used for this event
 */
export const trackSignUp = (data = {}, eventId = null) => {
  return trackEvent('CompleteRegistration', {
    content_name: 'signup',
    status: 'complete',
    ...data
  }, eventId);
};

/**
 * Track user login
 * @param {object} data - { method: 'google'|'email' }
 * @param {string} eventId - Event ID for deduplication with CAPI
 * @returns {string} Event ID used for this event
 */
export const trackLogin = (data = {}, eventId = null) => {
  return trackCustomEvent('Login', {
    content_name: 'login',
    ...data
  }, eventId);
};

/**
 * Track when user initiates checkout (opens payment modal)
 * @param {object} data - { value, currency, content_name, content_ids }
 * @param {string} eventId - Event ID for deduplication with CAPI
 * @returns {string} Event ID used for this event
 */
export const trackInitiateCheckout = (data = {}, eventId = null) => {
  return trackEvent('InitiateCheckout', {
    currency: 'INR',
    ...data
  }, eventId);
};

/**
 * Track successful purchase
 * @param {object} data - { value, currency, content_name, content_ids, content_type }
 * @param {string} eventId - Event ID for deduplication with CAPI
 * @returns {string} Event ID used for this event
 */
export const trackPurchase = (data = {}, eventId = null) => {
  return trackEvent('Purchase', {
    currency: 'INR',
    ...data
  }, eventId);
};

/**
 * Track lead generation (contact form, discovery call booking)
 * @param {object} data - { content_name, content_category }
 * @param {string} eventId - Event ID for deduplication with CAPI
 * @returns {string} Event ID used for this event
 */
export const trackLead = (data = {}, eventId = null) => {
  return trackEvent('Lead', {
    ...data
  }, eventId);
};

/**
 * Track content view (viewing specific course, workshop, etc.)
 * @param {object} data - { content_name, content_type, content_ids }
 * @param {string} eventId - Event ID for deduplication with CAPI
 * @returns {string} Event ID used for this event
 */
export const trackViewContent = (data = {}, eventId = null) => {
  return trackEvent('ViewContent', {
    ...data
  }, eventId);
};

export default {
  generateEventId,
  trackEvent,
  trackCustomEvent,
  trackPageView,
  trackSignUp,
  trackLogin,
  trackInitiateCheckout,
  trackPurchase,
  trackLead,
  trackViewContent,
  setUserData,
  clearUserData,
  getMetaCookies,
  getMetaHeaders,
  getFbpCookie,
  getFbcCookie,
};
