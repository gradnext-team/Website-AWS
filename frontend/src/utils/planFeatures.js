/**
 * Utility functions for generating consistent plan feature lists
 * across all pages (Home, Subscription, Coaching)
 * 
 * This ensures feature display is synchronized with the ComparisonTable
 */

/**
 * Generate a consistent feature list for display on plan cards
 * @param {Object} plan - The plan object with features
 * @param {Object} drillCounts - Optional drill counts data for accurate drill numbers
 * @returns {Array} Array of feature strings to display
 */
export const generatePlanFeatureList = (plan, drillCounts = null) => {
  const features = plan.features || {};
  const displayFeatures = plan.display_features || [];
  const featureList = [];
  
  // Build features from the features object first
  // display_features will be added at the END
  
  // For coaching plans, show coaching-specific features first
  if (plan.category === 'coaching') {
    // 1-on-1 Coaching Sessions
    if (features.coaching_sessions && features.coaching_sessions !== 0) {
      if (features.coaching_sessions === -1) {
        featureList.push('Unlimited 1-on-1 Coaching');
      } else {
        featureList.push(`${features.coaching_sessions} 1-on-1 Coaching Sessions`);
      }
    }
    
    // Strategy Planning Calls
    if (features.strategy_calls && features.strategy_calls !== 0) {
      if (features.strategy_calls === -1) {
        featureList.push('Unlimited Strategy Calls');
      } else {
        featureList.push(`${features.strategy_calls} Strategy ${features.strategy_calls === 1 ? 'Call' : 'Calls'}`);
      }
    }
  }
  
  // Course Recordings - shown for both subscription and coaching
  if (features.course_recordings !== false) {
    featureList.push('Full Course Access');
  }
  
  // Case Drills & Exercises
  if (features.drills_exercises !== false) {
    // Calculate drill count based on plan tier
    if (drillCounts?.counts) {
      let tier = 'full_access';
      if (plan.plan_key === 'free_trial') {
        tier = 'free_trial';
      } else if (plan.plan_key === 'basic_plan') {
        tier = 'basic_plan';
      }
      
      const counts = drillCounts.counts[tier] || {};
      const totalDrills = (counts.case_math || 0) + 
                         (counts.case_structuring || 0) +
                         (counts.charts_exhibits || 0) +
                         (counts.synthesis || 0) +
                         (counts.brainstorming || 0);
      
      if (totalDrills > 0) {
        const totalQuestions = totalDrills * 10;
        featureList.push(`${totalQuestions}+ Case Drill Questions`);
      } else {
        featureList.push('Case Drills & Exercises');
      }
    } else {
      featureList.push('Case Drills & Exercises');
    }
  }
  
  // Case Materials
  if (features.case_materials !== false) {
    featureList.push('Case Study Materials');
  }
  
  // Workshops
  if (features.workshops && features.workshops !== 'none') {
    if (features.workshops === 'only_recorded') {
      featureList.push('Recorded Workshops');
    } else if (features.workshops === 'recorded_and_live') {
      featureList.push('Live & Recorded Workshops');
    }
  }
  
  // Peer-to-Peer Practice
  if (features.peer_sessions_per_month && features.peer_sessions_per_month !== 0) {
    if (features.peer_sessions_per_month === -1 || features.peer_sessions_per_month >= 999) {
      featureList.push('Unlimited Peer Practice');
    } else {
      featureList.push(`${features.peer_sessions_per_month} Peer Sessions/month`);
    }
  }
  
  // Priority Support (only show if enabled)
  if (features.priority_support) {
    featureList.push('Priority Support');
  }
  
  // Add display_features at the END (custom features from admin)
  if (displayFeatures.length > 0) {
    featureList.push(...displayFeatures);
  }
  
  // Fallback if no features found
  if (featureList.length === 0) {
    if (plan.category === 'coaching') {
      featureList.push('1-on-1 Coaching', 'Personalized Feedback', 'Mock Interviews');
    } else {
      featureList.push('Course Access', 'Case Drills', 'Community Access');
    }
  }
  
  return featureList;
};

/**
 * Get workshop display text based on workshop feature value
 * @param {string} workshopValue - The workshops feature value
 * @returns {string} Display text for workshops
 */
export const getWorkshopDisplayText = (workshopValue) => {
  switch (workshopValue) {
    case 'recorded_and_live':
      return 'Live + Recorded';
    case 'only_recorded':
      return 'Recorded Only';
    case 'none':
    default:
      return null;
  }
};

/**
 * Get peer sessions display text
 * @param {number} sessionsPerMonth - Number of sessions per month (-1 for unlimited)
 * @returns {string} Display text for peer sessions
 */
export const getPeerSessionsDisplayText = (sessionsPerMonth) => {
  if (!sessionsPerMonth || sessionsPerMonth === 0) {
    return null;
  }
  if (sessionsPerMonth === -1 || sessionsPerMonth >= 999) {
    return 'Unlimited';
  }
  return `${sessionsPerMonth}/month`;
};

/**
 * Get coaching sessions display text
 * @param {number} sessions - Number of coaching sessions (-1 for unlimited)
 * @returns {string} Display text for coaching sessions
 */
export const getCoachingSessionsDisplayText = (sessions) => {
  if (!sessions || sessions === 0) {
    return null;
  }
  if (sessions === -1 || sessions >= 999) {
    return 'Unlimited';
  }
  return `${sessions} Sessions`;
};

/**
 * Get strategy calls display text
 * @param {number} calls - Number of strategy calls (-1 for unlimited)
 * @returns {string} Display text for strategy calls
 */
export const getStrategyCallsDisplayText = (calls) => {
  if (!calls || calls === 0) {
    return null;
  }
  if (calls === -1 || calls >= 999) {
    return 'Unlimited';
  }
  return `${calls}`;
};

export default {
  generatePlanFeatureList,
  getWorkshopDisplayText,
  getPeerSessionsDisplayText,
  getCoachingSessionsDisplayText,
  getStrategyCallsDisplayText
};
