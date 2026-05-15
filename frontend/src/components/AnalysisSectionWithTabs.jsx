import React, { useState } from 'react';
import AnalyticsSection from './AnalyticsSection';
import SubscriptionAnalytics from './SubscriptionAnalytics';
import { BarChart3, CreditCard } from 'lucide-react';

const AnalysisSectionWithTabs = () => {
  const [activeTab, setActiveTab] = useState('coaching');

  const tabs = [
    { id: 'coaching', label: 'Coaching', icon: BarChart3 },
    { id: 'subscription', label: 'Subscription', icon: CreditCard }
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-slate-200 p-1 inline-flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'coaching' && <AnalyticsSection />}
        {activeTab === 'subscription' && <SubscriptionAnalytics />}
      </div>
    </div>
  );
};

export default AnalysisSectionWithTabs;
