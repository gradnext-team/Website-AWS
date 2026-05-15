import React, { useState } from 'react';
import { CheckCircle2, Info, ChevronDown, ChevronRight } from 'lucide-react';

// Tooltip component for info icons
const InfoTooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block ml-2">
      <Info 
        className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help inline-block"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap max-w-xs text-center">
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
};

// Coming Soon Badge component
const ComingSoonBadge = () => (
  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
    Coming Soon
  </span>
);

const ComparisonTable = ({ plans, activeCategory, drillCounts }) => {
  const [expandedFeatures, setExpandedFeatures] = useState({});

  const toggleFeature = (featureName) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [featureName]: !prev[featureName]
    }));
  };

  // Get ALL visible plans from both categories
  const subscriptionPlans = plans.filter(p => 
    p.category === 'subscription' && p.is_visible !== false && p.plan_key !== 'free_trial' && p.name !== 'Free Trial'
  );
  const coachingPlans = plans.filter(p => 
    p.category === 'coaching' && p.is_visible !== false
  );
  
  // Combine all plans - subscription first, then coaching
  const allPlans = [...subscriptionPlans, ...coachingPlans];

  if (allPlans.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No plans available for comparison.</p>
      </div>
    );
  }

  // Helper to check if a plan is highlighted (belongs to active category)
  const isPlanHighlighted = (plan) => {
    return plan.category === activeCategory;
  };

  // Style for highlighted vs muted columns
  const getHeaderStyle = (plan) => {
    const isHighlighted = isPlanHighlighted(plan);
    return {
      color: isHighlighted ? 'var(--gn-rhino)' : 'var(--gn-grey)',
      backgroundColor: isHighlighted ? 'var(--gn-periwinkle-lighter)' : 'var(--gn-grey-lightest)',
      opacity: isHighlighted ? 1 : 0.7,
      transition: 'all 0.3s ease'
    };
  };

  const getCellStyle = (plan, isAlternateRow = false) => {
    const isHighlighted = isPlanHighlighted(plan);
    return {
      backgroundColor: isHighlighted 
        ? (isAlternateRow ? 'rgba(140, 157, 255, 0.08)' : 'rgba(140, 157, 255, 0.04)') 
        : (isAlternateRow ? 'rgba(0, 0, 0, 0.02)' : 'transparent'),
      opacity: isHighlighted ? 1 : 0.6,
      transition: 'all 0.3s ease'
    };
  };

  const getTextColor = (plan) => {
    return isPlanHighlighted(plan) ? 'var(--gn-periwinkle)' : 'var(--gn-grey)';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th 
                className="text-left p-4 font-semibold min-w-[220px] sticky left-0 z-10 bg-white" 
                style={{ color: 'var(--gn-rhino)' }}
              >
                Feature
              </th>
              {/* Subscription Plans Header */}
              {subscriptionPlans.length > 0 && (
                <th 
                  colSpan={subscriptionPlans.length} 
                  className="text-center p-2 text-xs font-bold uppercase tracking-wider border-b"
                  style={{ 
                    color: activeCategory === 'subscription' ? 'var(--gn-rhino)' : 'var(--gn-grey)',
                    backgroundColor: activeCategory === 'subscription' ? 'var(--gn-periwinkle-lighter)' : 'var(--gn-grey-lightest)',
                    opacity: activeCategory === 'subscription' ? 1 : 0.7
                  }}
                >
                  Subscription Plans
                </th>
              )}
              {/* Coaching Plans Header */}
              {coachingPlans.length > 0 && (
                <th 
                  colSpan={coachingPlans.length} 
                  className="text-center p-2 text-xs font-bold uppercase tracking-wider border-b border-l"
                  style={{ 
                    color: activeCategory === 'coaching' ? 'var(--gn-rhino)' : 'var(--gn-grey)',
                    backgroundColor: activeCategory === 'coaching' ? 'var(--gn-periwinkle-lighter)' : 'var(--gn-grey-lightest)',
                    opacity: activeCategory === 'coaching' ? 1 : 0.7
                  }}
                >
                  Coaching Plans
                </th>
              )}
            </tr>
            <tr className="border-b border-slate-200">
              <th className="text-left p-4 font-semibold min-w-[220px] sticky left-0 z-10 bg-white"></th>
              {allPlans.map((plan, index) => (
                <th 
                  key={plan.id} 
                  className={`text-center p-3 font-semibold min-w-[120px] ${index === subscriptionPlans.length ? 'border-l border-slate-300' : ''}`}
                  style={getHeaderStyle(plan)}
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Personalized Dashboard - First row, Yes for all */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Personalized Dashboard</span>
                  <InfoTooltip text="Track your progress and get personalized recommendations" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan)}
                >
                  <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                </td>
              ))}
            </tr>

            {/* Course Recordings - Simple row */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Course Recordings</span>
                  <InfoTooltip text="Full access to video course library" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan, true)}
                >
                  {plan.features?.course_recordings ? (
                    <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Case Drills - Parent Row (Expandable) */}
            <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => toggleFeature('drills')}>
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  {expandedFeatures['drills'] ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                  <span className="font-semibold" style={{ color: 'var(--gn-grey-dark)' }}>Case Drills & Exercises</span>
                  <InfoTooltip text="Practice drills to build case skills" />
                </div>
              </td>
              {allPlans.map((plan, index) => {
                const tier = plan.plan_key === 'basic_plan' ? 'basic_plan' : 'full_access';
                const totalDrills = (drillCounts?.counts?.[tier]?.case_math || 0) + 
                                  (drillCounts?.counts?.[tier]?.case_structuring || 0) +
                                  (drillCounts?.counts?.[tier]?.charts_exhibits || 0) +
                                  (drillCounts?.counts?.[tier]?.synthesis || 0) +
                                  (drillCounts?.counts?.[tier]?.brainstorming || 0);
                return (
                  <td 
                    key={plan.id} 
                    className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                    style={getCellStyle(plan, true)}
                  >
                    {totalDrills > 0 ? (
                      <span className="text-sm font-bold" style={{ color: getTextColor(plan) }}>{totalDrills} total</span>
                    ) : (
                      <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Drill sub-items when expanded */}
            {expandedFeatures['drills'] && ['case_math', 'case_structuring', 'charts_exhibits', 'synthesis', 'brainstorming'].map((drillType, idx) => {
              const labels = {
                case_math: { label: 'Case Math', tooltip: 'Market sizing, percentages, ratios' },
                case_structuring: { label: 'Structuring', tooltip: 'Framework building, issue trees' },
                charts_exhibits: { label: 'Charts & Exhibits', tooltip: 'Data interpretation, insights' },
                synthesis: { label: 'Synthesis', tooltip: 'Recommendation building, executive summaries' },
                brainstorming: { label: 'Brainstorming', tooltip: 'Creative thinking, idea generation' }
              };
              
              return (
                <tr key={drillType} className={`border-b ${idx === 4 ? 'border-slate-100' : 'border-slate-50'}`}>
                  <td className="p-4 pl-12 sticky left-0 z-10 bg-white">
                    <div className="flex items-center">
                      <span className="font-medium text-sm" style={{ color: 'var(--gn-grey-dark)' }}>• {labels[drillType].label}</span>
                      <InfoTooltip text={labels[drillType].tooltip} />
                    </div>
                  </td>
                  {allPlans.map((plan, index) => {
                    const tier = plan.plan_key === 'basic_plan' ? 'basic_plan' : 'full_access';
                    const count = drillCounts?.counts?.[tier]?.[drillType] || 0;
                    return (
                      <td 
                        key={plan.id} 
                        className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                        style={getCellStyle(plan)}
                      >
                        {count > 0 ? (
                          <span className="text-sm font-semibold" style={{ color: getTextColor(plan) }}>{count}</span>
                        ) : (
                          <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Case Materials */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Case Materials & Casebooks</span>
                  <InfoTooltip text="Practice cases, solutions, frameworks" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan)}
                >
                  {plan.features?.case_materials ? (
                    <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Workshops - Parent Row (Expandable) */}
            <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => toggleFeature('workshops')}>
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  {expandedFeatures['workshops'] ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                  <span className="font-semibold" style={{ color: 'var(--gn-grey-dark)' }}>Workshops</span>
                  <InfoTooltip text="Interactive sessions with MBB mentors" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan, true)}
                >
                  {plan.features?.workshops === 'recorded_and_live' ? (
                    <span className="text-sm font-medium" style={{ color: getTextColor(plan) }}>Live + Recorded</span>
                  ) : plan.features?.workshops === 'only_recorded' ? (
                    <span className="text-sm" style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey-dark)' : 'var(--gn-grey)' }}>Recorded Only</span>
                  ) : plan.features?.workshops === 'none' ? (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  ) : plan.features?.workshop_count ? (
                    <span className="text-sm font-semibold" style={{ color: getTextColor(plan) }}>{plan.features.workshop_count} sessions</span>
                  ) : (
                    <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                  )}
                </td>
              ))}
            </tr>

            {/* Workshops - Industry Primers (Child) */}
            {expandedFeatures['workshops'] && (
              <tr className="border-b border-slate-50">
                <td className="p-4 pl-12 sticky left-0 z-10 bg-white">
                  <div className="flex items-center">
                    <span className="font-medium text-sm" style={{ color: 'var(--gn-grey-dark)' }}>• Industry Primers</span>
                    <InfoTooltip text="Deep dives into key industries" />
                  </div>
                </td>
                {allPlans.map((plan, index) => (
                  <td 
                    key={plan.id} 
                    className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                    style={getCellStyle(plan)}
                  >
                    {plan.features?.industry_primers ? (
                      <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                    ) : (
                      <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* Workshops - Knowledge Sessions (Child) */}
            {expandedFeatures['workshops'] && (
              <tr className="border-b border-slate-100">
                <td className="p-4 pl-12 sticky left-0 z-10 bg-white">
                  <div className="flex items-center">
                    <span className="font-medium text-sm" style={{ color: 'var(--gn-grey-dark)' }}>• Knowledge Sessions</span>
                    <InfoTooltip text="Expert-led knowledge sharing sessions" />
                  </div>
                </td>
                {allPlans.map((plan, index) => (
                  <td 
                    key={plan.id} 
                    className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                    style={getCellStyle(plan)}
                  >
                    {plan.features?.knowledge_sessions ? (
                      <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                    ) : (
                      <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}

            {/* Peer-to-Peer Practice */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Peer-to-Peer Practice</span>
                  <InfoTooltip text="Case practice with driven individuals and get real-time feedback" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan)}
                >
                  {plan.features?.peer_sessions_per_month ? (
                    plan.features.peer_sessions_per_month === -1 || plan.features.peer_sessions_per_month >= 999 ? (
                      <span className="text-sm font-bold" style={{ color: getTextColor(plan) }}>Unlimited</span>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: getTextColor(plan) }}>{plan.features.peer_sessions_per_month}/month</span>
                    )
                  ) : plan.features?.peer_to_peer === 'unlimited' ? (
                    <span className="text-sm font-bold" style={{ color: getTextColor(plan) }}>Unlimited</span>
                  ) : plan.features?.peer_to_peer === '1_per_week' ? (
                    <span className="text-sm" style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey-dark)' : 'var(--gn-grey)' }}>4/month</span>
                  ) : plan.features?.peer_to_peer === '2_per_week' ? (
                    <span className="text-sm" style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey-dark)' : 'var(--gn-grey)' }}>8/month</span>
                  ) : plan.features?.peer_to_peer === 'none' ? (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* 1-on-1 Coaching Sessions */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>1-on-1 Coaching Sessions</span>
                  <InfoTooltip text="Personalized feedback from McKinsey, BCG, and Bain coaches" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan, true)}
                >
                  {plan.features?.coaching_sessions > 0 ? (
                    plan.features?.coaching_sessions >= 999 ? (
                      <span className="text-sm font-bold" style={{ color: getTextColor(plan) }}>Unlimited</span>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: getTextColor(plan) }}>{plan.features.coaching_sessions} Sessions</span>
                    )
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Strategy Planning Calls */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Strategy Planning Calls</span>
                  <InfoTooltip text="Prep roadmap & timeline" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan)}
                >
                  {plan.features?.strategy_calls > 0 ? (
                    <span className="text-sm font-semibold" style={{ color: getTextColor(plan) }}>{plan.features.strategy_calls}</span>
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Dedicated Coach */}
            <tr className="border-b border-slate-100">
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Dedicated Coach</span>
                  <InfoTooltip text="Onboarded on WhatsApp for a personalized coaching plan" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan, true)}
                >
                  {plan.features?.dedicated_coach ? (
                    <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Priority Support */}
            <tr>
              <td className="p-4 sticky left-0 z-10 bg-white">
                <div className="flex items-center">
                  <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>Priority Support</span>
                  <InfoTooltip text="24-hour response time" />
                </div>
              </td>
              {allPlans.map((plan, index) => (
                <td 
                  key={plan.id} 
                  className={`text-center p-4 ${index === subscriptionPlans.length ? 'border-l border-slate-200' : ''}`}
                  style={getCellStyle(plan)}
                >
                  {plan.features?.priority_support ? (
                    <CheckCircle2 className="w-5 h-5 mx-auto" style={{ color: getTextColor(plan) }} />
                  ) : (
                    <span style={{ color: isPlanHighlighted(plan) ? 'var(--gn-grey)' : 'var(--gn-grey-light)' }}>—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonTable;
