/**
 * Google Ads Conversion Tracking Utility
 * Conversion ID: AW-17996810496
 * 
 * Events tracked: sign_up, login, generate_lead, begin_checkout, purchase
 */

const GOOGLE_ADS_ID = 'AW-17996810496';

// Check if gtag is available
const isGtagAvailable = () => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

/**
 * Track a Google Ads conversion event
 * @param {string} eventName - Event name (e.g., 'conversion', 'sign_up', 'purchase')
 * @param {object} params - Event parameters
 */
export const trackGoogleAdsEvent = (eventName, params = {}) => {
  if (!isGtagAvailable()) {
    console.warn('Google Ads gtag not loaded');
    return;
  }
  
  try {
    window.gtag('event', eventName, {
      send_to: GOOGLE_ADS_ID,
      ...params
    });
    console.log(`[Google Ads] Tracked: ${eventName}`, params);
  } catch (error) {
    console.error('[Google Ads] Error tracking event:', error);
  }
};

/**
 * Track user sign up / registration
 * @param {object} data - { method: 'google'|'email' }
 */
export const trackGoogleAdsSignUp = (data = {}) => {
  trackGoogleAdsEvent('sign_up', {
    method: data.method || 'email',
    event_category: 'engagement',
  });
  
  // Also send as conversion event
  trackGoogleAdsEvent('conversion', {
    send_to: `${GOOGLE_ADS_ID}/signup`,
    event_category: 'conversion',
  });
};

/**
 * Track user login
 * @param {object} data - { method: 'google'|'email' }
 */
export const trackGoogleAdsLogin = (data = {}) => {
  trackGoogleAdsEvent('login', {
    method: data.method || 'email',
    event_category: 'engagement',
  });
};

/**
 * Track when user initiates checkout
 * @param {object} data - { value, currency, items }
 */
export const trackGoogleAdsInitiateCheckout = (data = {}) => {
  trackGoogleAdsEvent('begin_checkout', {
    currency: data.currency || 'INR',
    value: data.value || 0,
    items: data.items || [{
      item_name: data.content_name,
      item_id: data.content_ids?.[0],
      price: data.value,
      quantity: 1
    }],
    event_category: 'ecommerce',
  });
};

/**
 * Track successful purchase
 * @param {object} data - { value, currency, transaction_id, items }
 */
export const trackGoogleAdsPurchase = (data = {}) => {
  trackGoogleAdsEvent('purchase', {
    currency: data.currency || 'INR',
    value: data.value || 0,
    transaction_id: data.transaction_id || `txn_${Date.now()}`,
    items: data.items || [{
      item_name: data.content_name,
      item_id: data.content_ids?.[0],
      price: data.value,
      quantity: 1
    }],
    event_category: 'ecommerce',
  });
  
  // Also send as conversion event
  trackGoogleAdsEvent('conversion', {
    send_to: `${GOOGLE_ADS_ID}/purchase`,
    value: data.value || 0,
    currency: data.currency || 'INR',
    transaction_id: data.transaction_id || `txn_${Date.now()}`,
  });
};

/**
 * Track lead generation (contact form, discovery call booking)
 * @param {object} data - { content_name, content_category }
 */
export const trackGoogleAdsLead = (data = {}) => {
  trackGoogleAdsEvent('generate_lead', {
    currency: 'INR',
    value: data.value || 0,
    event_category: 'engagement',
    lead_source: data.content_name || 'website',
  });
  
  // Also send as conversion event
  trackGoogleAdsEvent('conversion', {
    send_to: `${GOOGLE_ADS_ID}/lead`,
    event_category: 'conversion',
  });
};

/**
 * Track content view
 * @param {object} data - { content_name, content_type, content_ids }
 */
export const trackGoogleAdsViewContent = (data = {}) => {
  trackGoogleAdsEvent('view_item', {
    currency: 'INR',
    value: data.value || 0,
    items: [{
      item_name: data.content_name,
      item_id: data.content_ids?.[0],
      item_category: data.content_type,
    }],
    event_category: 'ecommerce',
  });
};

export default {
  trackGoogleAdsEvent,
  trackGoogleAdsSignUp,
  trackGoogleAdsLogin,
  trackGoogleAdsInitiateCheckout,
  trackGoogleAdsPurchase,
  trackGoogleAdsLead,
  trackGoogleAdsViewContent
};
