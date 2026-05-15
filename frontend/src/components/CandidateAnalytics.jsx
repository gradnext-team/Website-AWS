import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, TrendingUp, Video, Target, Calendar, Clock,
  Download, Search, ChevronDown, ChevronUp, Eye, X,
  AlertCircle, CheckCircle2, BarChart3, Filter,
  ArrowUpDown, FileSpreadsheet, GraduationCap, Briefcase,
  MapPin, Linkedin, Phone, Mail, Award, Activity, Zap, MessageCircle,
  Star, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

// Summary Card Component
const SummaryCard = ({ icon: Icon, label, value, subValue, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600',
    cyan: 'bg-cyan-50 text-cyan-600'
  };
  
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
          {subValue && <p className="text-xs text-slate-400 mt-0.5">{subValue}</p>}
        </div>
      </div>
    </div>
  );
};

// Plan Badge Component
const PlanBadge = ({ plan }) => {
  const styles = {
    free_trial: 'bg-slate-100 text-slate-700',
    basic_plan: 'bg-blue-100 text-blue-700',
    pro_plan: 'bg-purple-100 text-purple-700',
    pro_plus: 'bg-amber-100 text-amber-700',
  };
  
  const labels = {
    free_trial: 'Free Trial',
    basic_plan: 'Basic',
    pro_plan: 'Pro',
    pro_plus: 'Pro+',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[plan] || styles.free_trial}`}>
      {labels[plan] || plan}
    </span>
  );
};

export const CandidateAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Detail modal
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Detailed feedback modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackTab, setFeedbackTab] = useState('coaching'); // 'coaching' or 'peer'
  
  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Page jump input
  const [pageInput, setPageInput] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);
  
  // Reset to page 1 when filters change
  // Use a separate effect that runs before the fetch
  const filtersRef = React.useRef({ dateFrom, dateTo, debouncedSearch, planFilter, sortBy, sortOrder });
  
  useEffect(() => {
    const prev = filtersRef.current;
    const filtersChanged = 
      prev.dateFrom !== dateFrom ||
      prev.dateTo !== dateTo ||
      prev.debouncedSearch !== debouncedSearch ||
      prev.planFilter !== planFilter ||
      prev.sortBy !== sortBy ||
      prev.sortOrder !== sortOrder;
    
    if (filtersChanged) {
      filtersRef.current = { dateFrom, dateTo, debouncedSearch, planFilter, sortBy, sortOrder };
      if (currentPage !== 1) {
        setCurrentPage(1);
        return; // Don't fetch yet, the page change will trigger a new fetch
      }
    }
  }, [dateFrom, dateTo, debouncedSearch, planFilter, sortBy, sortOrder, currentPage]);
  
  // Fetch data
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (planFilter && planFilter !== 'all') params.append('plan', planFilter);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      params.append('page', currentPage);
      params.append('limit', 50);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/candidate-analytics/summary?${params}`,
        { withCredentials: true }
      );
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, debouncedSearch, planFilter, sortBy, sortOrder, currentPage]);
  
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  
  // Fetch candidate details
  const fetchCandidateDetails = async (userId) => {
    try {
      setLoadingDetails(true);
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/candidate-analytics/candidate/${userId}`,
        { withCredentials: true }
      );
      setCandidateDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch candidate details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  const handleViewDetails = (candidate) => {
    setSelectedCandidate(candidate);
    fetchCandidateDetails(candidate.user_id);
  };
  
  const closeDetailModal = () => {
    setSelectedCandidate(null);
    setCandidateDetails(null);
  };
  
  // Fetch detailed feedback
  const fetchDetailedFeedback = async (userId) => {
    try {
      setLoadingFeedback(true);
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/candidate-analytics/${userId}/feedback`,
        { withCredentials: true }
      );
      setFeedbackData(res.data);
      setShowFeedbackModal(true);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
      alert('Failed to load detailed feedback');
    } finally {
      setLoadingFeedback(false);
    }
  };
  
  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackData(null);
    setFeedbackTab('coaching');
  };

  
  // Export function
  const handleExport = async (format = 'csv') => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (planFilter && planFilter !== 'all') params.append('plan', planFilter);
      params.append('format', format);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/candidate-analytics/export?${params}`,
        {
          withCredentials: true,
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `candidate_analytics_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data');
    }
  };
  
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading candidate analytics...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <p className="text-red-900 font-semibold mb-2">Failed to Load Analytics</p>
        <p className="text-red-700 text-sm mb-4">{error}</p>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          Try Again
        </Button>
      </div>
    );
  }
  
  const { candidates = [], summary = {}, pagination = {} } = data || {};
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Candidate Analytics</h1>
          <p className="text-slate-600 mt-1">Comprehensive insights into candidate engagement and progress</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => handleExport('csv')} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => handleExport('json')} variant="outline" size="sm">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <SummaryCard
          icon={Users}
          label="Total Candidates"
          value={summary.total_candidates || 0}
          color="blue"
        />
        <SummaryCard
          icon={Activity}
          label="Active (7 days)"
          value={summary.active_users_7d || 0}
          subValue={`${summary.active_users_30d || 0} in 30 days`}
          color="green"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Onboarding Rate"
          value={`${summary.onboarding_rate || 0}%`}
          subValue={`${summary.onboarded_users || 0} completed`}
          color="purple"
        />
        <SummaryCard
          icon={Users}
          label="Peer Sessions"
          value={summary.total_peer_sessions || 0}
          color="cyan"
        />
        <SummaryCard
          icon={Video}
          label="Videos Watched"
          value={summary.total_videos_watched || 0}
          color="amber"
        />
        <SummaryCard
          icon={Target}
          label="Avg Drill Score"
          value={summary.platform_avg_drill_score ? `${summary.platform_avg_drill_score}/10` : 'N/A'}
          subValue={`${summary.total_drills_done || 0} drills done`}
          color="green"
        />
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, phone..."
                className="pl-10"
              />
            </div>
          </div>
          
          {/* Date From */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          {/* Date To */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          
          {/* Plan Filter */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">Plan</label>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free_trial">Free Trial</SelectItem>
                <SelectItem value="basic_plan">Basic Plan</SelectItem>
                <SelectItem value="pro_plan">Pro Plan</SelectItem>
                <SelectItem value="pro_plus">Pro+ Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Sort Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Joined Date</SelectItem>
                <SelectItem value="last_login_at">Last Login</SelectItem>
                <SelectItem value="days_since_activity">Days Since Activity</SelectItem>
                <SelectItem value="peer_sessions_done">Peer Sessions</SelectItem>
                <SelectItem value="coaching_sessions_done">Coaching Sessions</SelectItem>
                <SelectItem value="videos_watched">Videos Watched</SelectItem>
                <SelectItem value="drills_done">Drills Done</SelectItem>
                <SelectItem value="avg_drill_score">Avg Score</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="plan">Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">Sort Order</label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Clear Filters */}
        {(dateFrom || dateTo || search || planFilter !== 'all') && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setSearch('');
                setPlanFilter('all');
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>
      
      {/* Candidates Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('name'); setSortOrder(sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  <div className="flex items-center gap-1">
                    Candidate
                    {sortBy === 'name' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('plan'); setSortOrder(sortBy === 'plan' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  <div className="flex items-center gap-1">
                    Plan
                    {sortBy === 'plan' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('created_at'); setSortOrder(sortBy === 'created_at' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                >
                  <div className="flex items-center gap-1">
                    Enrolled
                    {sortBy === 'created_at' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('days_since_activity'); setSortOrder(sortBy === 'days_since_activity' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                >
                  <div className="flex items-center gap-1">
                    Risk
                    {sortBy === 'days_since_activity' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('videos_watched'); setSortOrder(sortBy === 'videos_watched' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                >
                  <div className="flex items-center justify-center gap-1">
                    Videos
                    {sortBy === 'videos_watched' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('drills_done'); setSortOrder(sortBy === 'drills_done' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                >
                  <div className="flex items-center justify-center gap-1">
                    Drills
                    {sortBy === 'drills_done' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('avg_drill_score'); setSortOrder(sortBy === 'avg_drill_score' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                >
                  <div className="flex items-center justify-center gap-1">
                    Avg Score
                    {sortBy === 'avg_drill_score' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('coaching_sessions_done'); setSortOrder(sortBy === 'coaching_sessions_done' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                >
                  <div className="flex items-center justify-center gap-1">
                    Coach
                    {sortBy === 'coaching_sessions_done' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => { setSortBy('peer_sessions_done'); setSortOrder(sortBy === 'peer_sessions_done' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                >
                  <div className="flex items-center justify-center gap-1">
                    Peer
                    {sortBy === 'peer_sessions_done' && <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-12 text-center text-slate-500">
                    No candidates found
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => {
                  // Calculate risk status based on engagement
                  const getRiskStatus = () => {
                    if (!candidate.days_since_last_login) return { label: 'Active', color: 'bg-green-100 text-green-700', days: '0d' };
                    if (candidate.days_since_last_login <= 7) return { label: 'Active', color: 'bg-green-100 text-green-700', days: `${candidate.days_since_last_login}d` };
                    if (candidate.days_since_last_login <= 30) return { label: 'Moderate', color: 'bg-amber-100 text-amber-700', days: `${candidate.days_since_last_login}d` };
                    if (candidate.days_since_last_login <= 60) return { label: 'At Risk', color: 'bg-orange-100 text-orange-700', days: `${candidate.days_since_last_login}d` };
                    return { label: 'Churned', color: 'bg-red-100 text-red-700', days: `${candidate.days_since_last_login}d` };
                  };
                  const riskStatus = getRiskStatus();
                  
                  return (
                    <tr key={candidate.user_id} className="hover:bg-slate-50 transition-colors">
                      {/* Candidate Info */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {candidate.picture ? (
                            <img src={candidate.picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                              <span className="text-white font-semibold text-sm">
                                {candidate.first_name?.[0] || 'U'}{candidate.last_name?.[0] || 'N'}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{candidate.full_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500 truncate">{candidate.email}</p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Plan */}
                      <td className="px-4 py-4">
                        <PlanBadge plan={candidate.plan} />
                      </td>
                      
                      {/* Enrolled */}
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-700">
                          {candidate.months_enrolled ? `${candidate.months_enrolled} mo` : 'New'}
                        </p>
                      </td>
                      
                      {/* Risk Status */}
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${riskStatus.color}`}>
                            {riskStatus.label}
                          </span>
                          <span className="text-xs text-slate-500">({riskStatus.days})</span>
                        </div>
                      </td>
                      
                      {/* Videos */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-slate-900">{candidate.videos_watched}</span>
                      </td>
                      
                      {/* Drills */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-slate-900">{candidate.drills_done}</span>
                      </td>
                      
                      {/* Avg Score */}
                      <td className="px-4 py-4 text-center">
                        {candidate.avg_drill_score ? (
                          <span className="text-sm font-medium text-slate-900">
                            {candidate.avg_drill_score}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      
                      {/* Coach Sessions */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-slate-900">{candidate.coaching_sessions_done}</span>
                      </td>
                      
                      {/* Peer Sessions */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-medium text-slate-900">{candidate.peer_sessions_done}</span>
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            onClick={() => handleViewDetails(candidate)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button
                            onClick={() => fetchDetailedFeedback(candidate.user_id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="Detailed Feedback"
                            disabled={loadingFeedback}
                          >
                            <MessageCircle className="w-4 h-4 text-blue-600 mr-1" />
                            <span className="text-xs">Feedback</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Showing page {pagination.page} of {pagination.total_pages} ({pagination.total} total candidates)
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {/* First Page */}
              <Button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="px-2"
              >
                First
              </Button>
              
              {/* Previous */}
              <Button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const totalPages = pagination.total_pages;
                  const current = currentPage;
                  
                  // Show first page
                  if (current > 3) {
                    pages.push(
                      <Button key={1} onClick={() => setCurrentPage(1)} variant="outline" size="sm" className="w-9">1</Button>
                    );
                    if (current > 4) {
                      pages.push(<span key="dots1" className="px-1 text-slate-400">...</span>);
                    }
                  }
                  
                  // Show pages around current
                  for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
                    pages.push(
                      <Button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        variant={i === current ? "default" : "outline"}
                        size="sm"
                        className="w-9"
                      >
                        {i}
                      </Button>
                    );
                  }
                  
                  // Show last page
                  if (current < totalPages - 2) {
                    if (current < totalPages - 3) {
                      pages.push(<span key="dots2" className="px-1 text-slate-400">...</span>);
                    }
                    pages.push(
                      <Button key={totalPages} onClick={() => setCurrentPage(totalPages)} variant="outline" size="sm" className="w-9">{totalPages}</Button>
                    );
                  }
                  
                  return pages;
                })()}
              </div>
              
              {/* Next */}
              <Button
                onClick={() => setCurrentPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={currentPage === pagination.total_pages}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
              
              {/* Last Page */}
              <Button
                onClick={() => setCurrentPage(pagination.total_pages)}
                disabled={currentPage === pagination.total_pages}
                variant="outline"
                size="sm"
                className="px-2"
              >
                Last
              </Button>
              
              {/* Go to Page Input */}
              {pagination.total_pages > 10 && (
                <div className="flex items-center gap-1 ml-2 border-l pl-2">
                  <span className="text-sm text-slate-500">Go to:</span>
                  <Input
                    type="number"
                    min={1}
                    max={pagination.total_pages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const page = parseInt(pageInput);
                        if (page >= 1 && page <= pagination.total_pages) {
                          setCurrentPage(page);
                          setPageInput('');
                        }
                      }
                    }}
                    className="w-16 h-8 text-sm"
                    placeholder="#"
                  />
                  <Button
                    onClick={() => {
                      const page = parseInt(pageInput);
                      if (page >= 1 && page <= pagination.total_pages) {
                        setCurrentPage(page);
                        setPageInput('');
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    Go
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Detail Modal */}
      <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && closeDetailModal()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4">
              {selectedCandidate?.picture ? (
                <img src={selectedCandidate.picture} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {selectedCandidate?.first_name?.[0] || 'U'}{selectedCandidate?.last_name?.[0] || 'N'}
                  </span>
                </div>
              )}
              <div>
                <DialogTitle className="text-2xl">{selectedCandidate?.full_name || 'Candidate Details'}</DialogTitle>
                <p className="text-sm text-slate-500">{selectedCandidate?.email}</p>
              </div>
            </div>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : candidateDetails ? (
            <div className="grid grid-cols-2 gap-6 mt-6">
              {/* Left Column - Profile Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 pb-2 border-b border-slate-200">
                  Profile Information
                </h3>
                
                <div className="space-y-3">
                  {/* Phone */}
                  {candidateDetails.profile.phone_number && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{candidateDetails.profile.phone_number}</span>
                    </div>
                  )}
                  
                  {/* LinkedIn */}
                  {candidateDetails.profile.linkedin_url && (
                    <div className="flex items-center gap-3">
                      <Linkedin className="w-4 h-4 text-blue-600" />
                      <a 
                        href={candidateDetails.profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  
                  {/* Location */}
                  {candidateDetails.profile.location && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{candidateDetails.profile.location}</span>
                    </div>
                  )}
                  
                  {/* Experience */}
                  {candidateDetails.profile.years_of_experience && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{candidateDetails.profile.years_of_experience} years experience</span>
                    </div>
                  )}
                  
                  {/* UG College */}
                  {candidateDetails.profile.ug_college && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <GraduationCap className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">UG: {candidateDetails.profile.ug_college}</span>
                    </div>
                  )}
                  
                  {/* PG College */}
                  {candidateDetails.profile.pg_college && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <GraduationCap className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">PG: {candidateDetails.profile.pg_college}</span>
                    </div>
                  )}
                  
                  {/* Objective */}
                  {candidateDetails.profile.prep_objective && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Target className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">Objective: {candidateDetails.profile.prep_objective}</span>
                    </div>
                  )}
                  
                  {/* Preparation Level */}
                  {candidateDetails.profile.preparation_level && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">Level: {candidateDetails.profile.preparation_level}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column - Subscription & Activity */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 pb-2 border-b border-slate-200">
                  Subscription & Activity
                </h3>
                
                <div className="space-y-3">
                  {/* Plan */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Plan:</span>
                    <PlanBadge plan={candidateDetails.profile.plan} />
                  </div>
                  
                  {/* Months Enrolled */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Months Enrolled:</span>
                    <span className="text-sm font-medium text-slate-900">
                      {candidateDetails.activity_summary.months_enrolled || 0}
                    </span>
                  </div>
                  
                  {/* Plan End Date */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Plan End Date:</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(candidateDetails.profile.plan_end_date) || '-'}
                    </span>
                  </div>
                  
                  {/* Last Login */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Last Login:</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatDate(candidateDetails.profile.last_login_at)}
                    </span>
                  </div>
                  
                  {/* Risk Status */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Risk Status:</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const days = candidateDetails.activity_summary.days_since_last_login;
                        if (!days || days <= 7) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active ({days || 0}d)</span>;
                        if (days <= 30) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Moderate ({days}d)</span>;
                        if (days <= 60) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">At Risk ({days}d)</span>;
                        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Churned ({days}d)</span>;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Full Width - Activity Stats */}
              <div className="col-span-2 grid grid-cols-6 gap-4 mt-4">
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-purple-700">{candidateDetails.activity_summary.videos_watched}</div>
                  <div className="text-xs text-purple-600 mt-1">Videos Watched</div>
                </div>
                
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-amber-700">{candidateDetails.activity_summary.drills_done}</div>
                  <div className="text-xs text-amber-600 mt-1">Drills Done</div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-700">
                    {candidateDetails.activity_summary.avg_drill_score || '-'}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">Avg Score</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-700">{candidateDetails.activity_summary.coaching_sessions_done}</div>
                  <div className="text-xs text-green-600 mt-1">Coaching</div>
                </div>
                
                <div className="bg-cyan-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-cyan-700">{candidateDetails.activity_summary.peer_sessions_done}</div>
                  <div className="text-xs text-cyan-600 mt-1">Peer Sessions</div>
                </div>
                
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-700">₹{0}</div>
                  <div className="text-xs text-emerald-600 mt-1">Total Paid</div>
                </div>
              </div>
              
              {/* Videos Watched Section */}
              {candidateDetails.video_history?.length > 0 && (
                <div className="col-span-2 mt-6">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Videos Watched ({candidateDetails.video_history.length})
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Title</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Module</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Progress</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Watched At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {candidateDetails.video_history.slice(0, 3).map((video, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-slate-900">{video.video_title || 'Introduction to Case Interviews'}</td>
                            <td className="px-4 py-3 text-slate-600">{video.module || 'Getting Started'}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{video.progress || '100%'}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{formatDate(video.viewed_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Detailed Feedback Modal */}
      <Dialog open={showFeedbackModal} onOpenChange={closeFeedbackModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Detailed Session Feedback
            </DialogTitle>
            <DialogDescription>
              View comprehensive feedback from all coaching and peer sessions
            </DialogDescription>
          </DialogHeader>
          
          {feedbackData ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 mb-1">Coaching Sessions</p>
                  <p className="text-2xl font-bold text-purple-900">{feedbackData.summary.total_coaching_sessions}</p>
                  <p className="text-xs text-purple-500 mt-1">{feedbackData.summary.coaching_with_feedback} with feedback</p>
                </div>
                <div className="bg-cyan-50 p-4 rounded-lg">
                  <p className="text-sm text-cyan-600 mb-1">Peer Sessions</p>
                  <p className="text-2xl font-bold text-cyan-900">{feedbackData.summary.total_peer_sessions}</p>
                  <p className="text-xs text-cyan-500 mt-1">{feedbackData.summary.peer_with_feedback} with feedback</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-sm text-amber-600 mb-1">Avg Rating</p>
                  <p className="text-2xl font-bold text-amber-900">{feedbackData.summary.avg_coaching_rating}/5</p>
                  <p className="text-xs text-amber-500 mt-1">Coaching sessions</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 mb-1">Total Feedback</p>
                  <p className="text-2xl font-bold text-green-900">
                    {feedbackData.summary.coaching_with_feedback + feedbackData.summary.peer_with_feedback}
                  </p>
                  <p className="text-xs text-green-500 mt-1">Across all sessions</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-slate-200">
                <div className="flex gap-1">
                  <button
                    onClick={() => setFeedbackTab('coaching')}
                    className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                      feedbackTab === 'coaching'
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 inline mr-2" />
                    Coaching Sessions ({feedbackData.coaching_sessions.length})
                  </button>
                  <button
                    onClick={() => setFeedbackTab('peer')}
                    className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                      feedbackTab === 'peer'
                        ? 'text-cyan-600 border-b-2 border-cyan-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-2" />
                    Peer Sessions ({feedbackData.peer_sessions.length})
                  </button>
                </div>
              </div>

              {/* Coaching Tab Content */}
              {feedbackTab === 'coaching' && (
                <div className="space-y-4">
                  {feedbackData.coaching_sessions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No coaching sessions found</p>
                    </div>
                  ) : (
                    feedbackData.coaching_sessions.map((session) => (
                      <div key={session.session_id} className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-900">{session.mentor_name}</h4>
                            <p className="text-sm text-slate-500">
                              {session.date} at {session.time} • {session.case_type}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            session.status === 'completed' ? 'bg-green-100 text-green-700' :
                            session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {session.status}
                          </span>
                        </div>

                        {session.has_feedback ? (
                          <div className="space-y-3">
                            {/* Ratings Grid */}
                            <div className="grid grid-cols-3 gap-3">
                              {session.ratings.scoping_questions > 0 && (
                                <div className="bg-slate-50 p-3 rounded">
                                  <p className="text-xs text-slate-500 mb-1">Scoping Questions</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i}
                                        className={`w-3 h-3 ${i < session.ratings.scoping_questions ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {session.ratings.case_structure > 0 && (
                                <div className="bg-slate-50 p-3 rounded">
                                  <p className="text-xs text-slate-500 mb-1">Case Structure</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i}
                                        className={`w-3 h-3 ${i < session.ratings.case_structure ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {session.ratings.quantitative > 0 && session.quantitative_tested && (
                                <div className="bg-slate-50 p-3 rounded">
                                  <p className="text-xs text-slate-500 mb-1">Quantitative</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i}
                                        className={`w-3 h-3 ${i < session.ratings.quantitative ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {session.ratings.communication > 0 && (
                                <div className="bg-slate-50 p-3 rounded">
                                  <p className="text-xs text-slate-500 mb-1">Communication</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i}
                                        className={`w-3 h-3 ${i < session.ratings.communication ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {session.ratings.business_acumen > 0 && (
                                <div className="bg-slate-50 p-3 rounded">
                                  <p className="text-xs text-slate-500 mb-1">Business Acumen</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i}
                                        className={`w-3 h-3 ${i < session.ratings.business_acumen ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {session.ratings.overall > 0 && (
                                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                  <p className="text-xs text-purple-600 mb-1 font-medium">Overall Rating</p>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i}
                                        className={`w-3 h-3 ${i < session.ratings.overall ? 'fill-purple-500 text-purple-500' : 'text-slate-300'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Strengths and Improvements */}
                            <div className="grid grid-cols-2 gap-3">
                              {session.areas_of_strength.length > 0 && (
                                <div className="bg-green-50 p-3 rounded border border-green-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ThumbsUp className="w-4 h-4 text-green-600" />
                                    <p className="text-sm font-medium text-green-700">Strengths</p>
                                  </div>
                                  <ul className="space-y-1">
                                    {session.areas_of_strength.map((strength, idx) => (
                                      <li key={idx} className="text-xs text-green-700">• {strength}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {session.areas_of_improvement.length > 0 && (
                                <div className="bg-amber-50 p-3 rounded border border-amber-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ThumbsDown className="w-4 h-4 text-amber-600" />
                                    <p className="text-sm font-medium text-amber-700">Areas to Improve</p>
                                  </div>
                                  <ul className="space-y-1">
                                    {session.areas_of_improvement.map((improvement, idx) => (
                                      <li key={idx} className="text-xs text-amber-700">• {improvement}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Qualitative Feedback */}
                            {session.qualitative_feedback && (
                              <div className="bg-slate-50 p-3 rounded">
                                <p className="text-xs text-slate-500 mb-2 font-medium">Detailed Feedback:</p>
                                <p className="text-sm text-slate-700">{session.qualitative_feedback}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-400">
                            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                            <p className="text-sm">No feedback provided yet</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Peer Tab Content */}
              {feedbackTab === 'peer' && (
                <div className="space-y-4">
                  {feedbackData.peer_sessions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No peer sessions found</p>
                    </div>
                  ) : (
                    feedbackData.peer_sessions.map((session) => (
                      <div key={session.session_id} className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-900">{session.partner_name}</h4>
                            <p className="text-sm text-slate-500">
                              {session.date} at {session.time} • {session.case_type}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            session.status === 'completed' ? 'bg-green-100 text-green-700' :
                            session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {session.status}
                          </span>
                        </div>

                        {session.has_feedback ? (
                          <div className="space-y-3">
                            {/* Rating */}
                            {session.rating > 0 && (
                              <div className="bg-cyan-50 p-3 rounded border border-cyan-200">
                                <p className="text-xs text-cyan-600 mb-2 font-medium">Overall Rating</p>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star 
                                      key={i}
                                      className={`w-4 h-4 ${i < session.rating ? 'fill-cyan-500 text-cyan-500' : 'text-slate-300'}`}
                                    />
                                  ))}
                                  <span className="ml-2 text-sm font-medium text-cyan-700">{session.rating}/5</span>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              {/* Strengths */}
                              {session.strengths && (
                                <div className="bg-green-50 p-3 rounded border border-green-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ThumbsUp className="w-4 h-4 text-green-600" />
                                    <p className="text-sm font-medium text-green-700">Strengths</p>
                                  </div>
                                  <p className="text-xs text-green-700">{session.strengths}</p>
                                </div>
                              )}
                              
                              {/* Improvements */}
                              {session.improvements && (
                                <div className="bg-amber-50 p-3 rounded border border-amber-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ThumbsDown className="w-4 h-4 text-amber-600" />
                                    <p className="text-sm font-medium text-amber-700">Areas to Improve</p>
                                  </div>
                                  <p className="text-xs text-amber-700">{session.improvements}</p>
                                </div>
                              )}
                            </div>

                            {/* Comments */}
                            {session.comments && (
                              <div className="bg-slate-50 p-3 rounded">
                                <p className="text-xs text-slate-500 mb-2 font-medium">Additional Comments:</p>
                                <p className="text-sm text-slate-700">{session.comments}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-400">
                            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                            <p className="text-sm">No feedback provided yet</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-slate-500">Loading feedback...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CandidateAnalytics;
