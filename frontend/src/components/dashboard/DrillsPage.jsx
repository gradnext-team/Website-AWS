import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import { 
  Calculator, Lightbulb, Clock, Play, Filter, 
  CheckCircle2, Trophy, RefreshCw, Search, Lock, BarChart3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import AIDrillModal from '../ui/AIDrillModal';
import '../../styles/cardStyles.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Drill type styling configuration
const DRILL_TYPE_CONFIG = {
  case_math: {
    name: 'Case Math',
    icon: Calculator,
    gradient: 'from-[#2E3558] to-[#363EA7]',
    lightBg: 'bg-[#DEE3FF]',
    iconBg: 'bg-[#DEE3FF]',
    iconColor: 'text-[#2E3558]',
    badgeClass: 'bg-[#DEE3FF] text-[#2E3558] border-[#B1BCFF]'
  },
  case_structuring: {
    name: 'Case Structuring',
    icon: Lightbulb,
    gradient: 'from-[#8C9DFF] to-[#5961ED]',
    lightBg: 'bg-[#DEE3FF]',
    iconBg: 'bg-[#DEE3FF]',
    iconColor: 'text-[#5961ED]',
    badgeClass: 'bg-[#DEE3FF] text-[#5961ED] border-[#B1BCFF]'
  },
  charts_exhibits: {
    name: 'Charts & Exhibits',
    icon: BarChart3,
    gradient: 'from-[#5961ED] to-[#8C9DFF]',
    lightBg: 'bg-[#DEE3FF]',
    iconBg: 'bg-[#B1BCFF]',
    iconColor: 'text-[#2E3558]',
    badgeClass: 'bg-[#B1BCFF] text-[#2E3558] border-[#8C9DFF]'
  }
};

// Difficulty styling
const DIFFICULTY_CONFIG = {
  beginner: {
    label: 'Easy',
    time: '5 min',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ringColor: 'ring-emerald-500/20'
  },
  intermediate: {
    label: 'Medium',
    time: '10 min',
    badgeClass: 'bg-[#FFE6B7] text-[#2E3558] border-[#FFD68A]',
    ringColor: 'ring-[#FFA601]/20'
  },
  advanced: {
    label: 'Hard',
    time: '15 min',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
    ringColor: 'ring-rose-500/20'
  }
};

const DrillsPage = () => {
  const { dashboardData, showUpgradeModal } = useDashboard();
  
  // Data state
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drillHistory, setDrillHistory] = useState([]);
  
  // Tab state - NEW
  const [activeTab, setActiveTab] = useState('case_math');
  
  // Filter state
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drill modal state
  const [isDrillOpen, setIsDrillOpen] = useState(false);
  const [selectedDrill, setSelectedDrill] = useState(null);

  // Fetch all drills on mount
  useEffect(() => {
    const fetchDrills = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/ai-drills/list`, {
          withCredentials: true,
        });
        setDrills(response.data?.drills || []);
      } catch (error) {
        console.error('Failed to fetch drills:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDrills();
  }, []);

  // Fetch drill history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/ai-drills/history`, {
          withCredentials: true,
        });
        setDrillHistory(response.data?.history || []);
      } catch (error) {
        console.error('Failed to fetch drill history:', error);
      }
    };
    fetchHistory();
  }, [isDrillOpen]);

  const handleStartDrill = (drill) => {
    setSelectedDrill(drill);
    setIsDrillOpen(true);
  };

  // NEW: Check if a specific drill is locked based on item-level locking
  const isDrillLocked = (drill) => {
    const planStatus = dashboardData?.plan_status || {};
    const userPlan = dashboardData?.user?.plan || 'free_trial';
    
    // For basic_plan users: check is_basic_plan flag (even if has_full_access is true)
    if (userPlan === 'basic_plan') {
      // Basic plan users can access drills marked as is_basic_plan OR is_free_trial
      return !drill.is_basic_plan && !drill.is_free_trial;
    }
    
    // If user has full access (Pro/Pro+ subscription or coaching), nothing is locked
    if (planStatus.has_full_access) return false;
    
    // For trial users:
    // - EXPIRED trial: ALL drills locked (even free trial ones)
    // - ACTIVE trial: Only non-free-trial drills locked
    if (planStatus.is_trial) {
      if (planStatus.trial_expired) {
        // Expired trial: lock EVERYTHING
        return true;
      }
      // Active trial: only lock non-free-trial drills
      return !drill.is_free_trial;
    }
    
    // For non-trial users with item-level locking (expired subscription/coaching)
    // ALL drills should be locked for expired users
    if (planStatus.use_item_level_locking) {
      return true;  // Lock ALL drills for expired users
    }
    
    // For expired coaching programs specifically
    if (planStatus.coaching_program_expired) {
      return true;
    }
    
    // Default: not locked
    return false
  };

  const getCompletedCount = (drillId) => {
    return drillHistory.filter(h => h.drill_id === drillId).length;
  };

  const getBestScore = (drillId) => {
    const relevant = drillHistory.filter(h => h.drill_id === drillId);
    if (relevant.length === 0) return null;
    const best = Math.max(...relevant.map(h => (h.score / h.total) * 100));
    return Math.round(best);
  };

  // Filter drills by active tab and other filters
  let filteredDrills = drills.filter(drill => {
    const matchesTab = drill.drill_type === activeTab;
    const matchesDifficulty = difficultyFilter === 'all' || drill.difficulty === difficultyFilter;
    const matchesSearch = searchQuery === '' || 
      drill.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesDifficulty && matchesSearch;
  });

  // Special handling for Case Structuring: sort by difficulty order and renumber
  if (activeTab === 'case_structuring') {
    // Define the difficulty order for sorting
    const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
    
    // Sort by difficulty label (Easy → Medium → Hard)
    filteredDrills = [...filteredDrills].sort((a, b) => {
      const orderA = difficultyOrder[a.difficulty_label] || 999;
      const orderB = difficultyOrder[b.difficulty_label] || 999;
      return orderA - orderB;
    });
    
    // Apply sequential numbering (1-20) based on sorted order
    filteredDrills = filteredDrills.map((drill, index) => ({
      ...drill,
      name: `Case Structuring Drill ${index + 1}`
    }));
  }

  const totalCompleted = new Set(drillHistory.map(h => h.drill_id)).size;
  const hasDrillsAccess = dashboardData?.access?.drills !== false;
  const isAdminRestricted = dashboardData?.admin_restricted?.drills === true;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if access is revoked by admin
  if (!hasDrillsAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Access Restricted</h2>
        <p className="text-slate-500 mt-2">
          {isAdminRestricted 
            ? "Your access to Case Drills has been restricted by admin. Please contact support."
            : "Upgrade your plan to access Case Drills."}
        </p>
        {!isAdminRestricted && (
          <Button onClick={showUpgradeModal} className="mt-4" data-testid="upgrade-drills-btn">
            Upgrade
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="drills-page">
      {/* Header with subtle yellow accent */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold page-title-dark">Case Drills</h1>
            <Badge className="bg-[#2E3558] text-white border-0 text-xs">
              {drills.length} Drills
            </Badge>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--gn-chrome-yellow)' }} />
          </div>
          <p className="text-slate-500 mt-1">
            Sharpen your consulting skills with timed practice
          </p>
        </div>
        
        {/* Stats with glass effect */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full stats-badge-3d">
          <Trophy className="w-4 h-4" style={{ color: 'var(--gn-chrome-yellow)' }} />
          <span className="text-sm font-medium page-title-dark">
            {totalCompleted} completed
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-container-3d rounded-xl overflow-hidden">
        <div className="flex" style={{ borderBottom: '1px solid var(--gn-periwinkle-lighter)' }}>
          {Object.entries(DRILL_TYPE_CONFIG).map(([key, config]) => {
            const IconComponent = config.icon;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative ${
                  isActive
                    ? 'text-[#2E3558] bg-[#DEE3FF]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{config.name}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E3558]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter:</span>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search drills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[180px] bg-white border-slate-200"
              data-testid="search-input"
            />
          </div>

          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[160px] bg-white border-slate-200" data-testid="difficulty-filter">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Easy</SelectItem>
              <SelectItem value="intermediate">Medium</SelectItem>
              <SelectItem value="advanced">Hard</SelectItem>
            </SelectContent>
          </Select>
          
          {(difficultyFilter !== 'all' || searchQuery !== '') && (
            <button 
              onClick={() => {
                setDifficultyFilter('all');
                setSearchQuery('');
              }}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Clear
            </button>
          )}
          
          <div className="ml-auto text-sm text-slate-500">
            Showing {filteredDrills.length} drills
          </div>
        </div>
      </div>

      {/* Drill Cards Grid - 3-4 per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredDrills.map((drill) => {
          const typeConfig = DRILL_TYPE_CONFIG[drill.drill_type] || DRILL_TYPE_CONFIG.case_math;
          const IconComponent = typeConfig.icon;
          const completedCount = getCompletedCount(drill.id);
          const bestScore = getBestScore(drill.id);
          const isLocked = isDrillLocked(drill);
          
          // Get badge styling based on difficulty_label from API (not drill.difficulty)
          const getBadgeConfig = (label) => {
            switch(label) {
              case 'Easy':
                return {
                  badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                  ringColor: 'ring-emerald-500/20'
                };
              case 'Medium':
                return {
                  badgeClass: 'bg-[#FFE6B7] text-[#2E3558] border-[#FFD68A]',
                  ringColor: 'ring-[#FFA601]/20'
                };
              case 'Hard':
                return {
                  badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
                  ringColor: 'ring-rose-500/20'
                };
              default:
                return {
                  badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                  ringColor: 'ring-emerald-500/20'
                };
            }
          };
          
          const badgeConfig = getBadgeConfig(drill.difficulty_label);
          const timeDisplay = `${Math.floor(drill.time_limit / 60)} min`;
          
          return (
            <div
              key={drill.id}
              className={`group relative card-3d-base rounded-xl overflow-hidden ${
                isLocked ? 'opacity-75' : ''
              }`}
              data-testid={`drill-card-${drill.id}`}
            >
              {/* Top gradient accent */}
              <div className={`h-1.5 bg-gradient-to-r ${isLocked ? 'from-slate-300 to-slate-400' : typeConfig.gradient}`} />
              
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg ${typeConfig.iconBg} flex items-center justify-center`}>
                    <IconComponent className={`w-5 h-5 ${typeConfig.iconColor}`} />
                  </div>
                  {completedCount > 0 && (
                    <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-xs font-medium">{completedCount}x</span>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 className="font-semibold card-header-dark mb-2 line-clamp-2 min-h-[3rem]">
                  {drill.name}
                </h3>

                {/* Badges */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge className={`text-xs font-medium ${badgeConfig.badgeClass}`}>
                    {drill.difficulty_label}
                  </Badge>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{timeDisplay}</span>
                  </div>
                </div>

                {/* Best Score */}
                {bestScore !== null && (
                  <div className="mb-4 p-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Best Score</span>
                      <span className="text-sm font-bold text-emerald-700">{bestScore}%</span>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={() => isLocked ? showUpgradeModal() : handleStartDrill(drill)}
                  disabled={isLocked && !showUpgradeModal}
                  className={`w-full ${
                    isLocked
                      ? 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                      : 'bg-[#2E3558] text-white hover:bg-[#363EA7]'
                  }`}
                  size="sm"
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Upgrade to Unlock
                    </>
                  ) : completedCount > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Practice Again
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Drill
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDrills.length === 0 && (
        <div className="text-center py-12 card-3d-base rounded-xl">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium card-header-dark">No drills found</h3>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Drill Modal */}
      <AIDrillModal
        isOpen={isDrillOpen}
        onClose={() => setIsDrillOpen(false)}
        drill={selectedDrill}
      />
    </div>
  );
};

export default DrillsPage;
