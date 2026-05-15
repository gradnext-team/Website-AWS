import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Users, RefreshCw, UserPlus, UserCheck, UserX,
  GraduationCap, Shield, Zap, Award, Info, Calendar,
  Video, CheckCircle, XCircle, RotateCcw, TrendingUp
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

// Info button component
const InfoButton = ({ formula }) => (
  <div className="group relative">
    <Info className="w-4 h-4 text-slate-400 cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
      {formula}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </div>
  </div>
);

// Quick date filter options
const QUICK_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];

const AnalyticsSection = () => {
  const [memberBreakdown, setMemberBreakdown] = useState(null);
  const [coachingStats, setCoachingStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date filter state
  const [quickFilter, setQuickFilter] = useState('this_week');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Calculate date range based on quick filter
  const getDateRange = (filter) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    switch (filter) {
      case 'today':
        return { from: formatDate(today), to: formatDate(today) };
      
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: formatDate(yesterday), to: formatDate(yesterday) };
      }
      
      case 'this_week': {
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { from: formatDate(monday), to: formatDate(sunday) };
      }
      
      case 'last_week': {
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() + diffToMonday);
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return { from: formatDate(lastMonday), to: formatDate(lastSunday) };
      }
      
      case 'this_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: formatDate(firstDay), to: formatDate(lastDay) };
      }
      
      case 'last_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: formatDate(firstDay), to: formatDate(lastDay) };
      }
      
      case 'all':
      default:
        // Platform launch date - Feb 1, 2026
        return { from: '2026-02-01', to: formatDate(today) };
    }
  };

  // Effective date range
  const effectiveDateRange = useMemo(() => {
    if (dateFrom && dateTo) {
      return { from: dateFrom, to: dateTo };
    }
    return getDateRange(quickFilter);
  }, [quickFilter, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('date_from', effectiveDateRange.from);
      params.append('date_to', effectiveDateRange.to);
      
      const [memberRes, coachingRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/analytics/member-breakdown?${params}`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/analytics/coaching-sessions-analytics?${params}`, { withCredentials: true })
      ]);
      
      setMemberBreakdown(memberRes.data);
      setCoachingStats(coachingRes.data);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [effectiveDateRange]);

  const handleQuickFilter = (filter) => {
    setQuickFilter(filter);
    setDateFrom('');
    setDateTo('');
  };

  const handleDateChange = (type, value) => {
    if (type === 'from') setDateFrom(value);
    else setDateTo(value);
    setQuickFilter('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Date Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Date Range</span>
        </div>
        
        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_FILTERS.map((filter) => (
            <Button
              key={filter.id}
              variant={quickFilter === filter.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleQuickFilter(filter.id)}
              className="h-8 text-xs"
            >
              {filter.label}
            </Button>
          ))}
        </div>
        
        {/* Custom Date Range */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">From:</span>
            <Input
              type="date"
              value={dateFrom || effectiveDateRange.from}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">To:</span>
            <Input
              type="date"
              value={dateTo || effectiveDateRange.to}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className="w-40"
            />
          </div>
          <span className="text-xs text-slate-400">
            Showing: {effectiveDateRange.from} to {effectiveDateRange.to}
          </span>
        </div>
      </div>

      {/* User Activity Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-900">User Activity</h3>
          <InfoButton formula="Based on user signup and login activity during the selected date range" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Total Users</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{memberBreakdown?.summary?.total_candidates || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">New Users</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">{memberBreakdown?.activity?.new_users?.count || 0}</p>
            <p className="text-xs text-purple-600 mt-1">Signed up in period</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Active (Logged In)</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{memberBreakdown?.activity?.active_users?.count || 0}</p>
            <p className="text-xs text-green-600 mt-1">{memberBreakdown?.activity?.active_users?.percentage || 0}% of total</p>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="w-4 h-4 text-red-600" />
              <span className="text-xs font-medium text-red-700">Inactive (Not Logged In)</span>
            </div>
            <p className="text-2xl font-bold text-red-900">{memberBreakdown?.activity?.inactive_users?.count || 0}</p>
            <p className="text-xs text-red-600 mt-1">{memberBreakdown?.activity?.inactive_users?.percentage || 0}% of total</p>
          </div>
        </div>
      </div>

      {/* Member Breakdown Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Member Breakdown</h3>
          <InfoButton formula="Breakdown of all platform members by plan type and category" />
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Total Members</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{memberBreakdown?.summary?.total_candidates || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Paid Members</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{memberBreakdown?.summary?.total_paid_members || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700">Coaching Members</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">{memberBreakdown?.by_category?.coaching?.count || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg border border-cyan-200">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-cyan-600" />
              <span className="text-xs font-medium text-cyan-700">Subscription</span>
            </div>
            <p className="text-2xl font-bold text-cyan-900">{memberBreakdown?.by_category?.subscription?.count || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Free Trial</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{memberBreakdown?.by_category?.free_trial?.count || 0}</p>
          </div>
        </div>
        
        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Member Distribution Pie Chart */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-3">Member Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Coaching', value: memberBreakdown?.by_category?.coaching?.count || 0, color: '#8B5CF6' },
                    { name: 'Subscription', value: memberBreakdown?.by_category?.subscription?.count || 0, color: '#06B6D4' },
                    { name: 'Free Trial', value: memberBreakdown?.by_category?.free_trial?.count || 0, color: '#F59E0B' }
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {[
                    { name: 'Coaching', value: memberBreakdown?.by_category?.coaching?.count || 0, color: '#8B5CF6' },
                    { name: 'Subscription', value: memberBreakdown?.by_category?.subscription?.count || 0, color: '#06B6D4' },
                    { name: 'Free Trial', value: memberBreakdown?.by_category?.free_trial?.count || 0, color: '#F59E0B' }
                  ].filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Plans Breakdown */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-3">Plans Breakdown</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {Object.entries(memberBreakdown?.by_plan || {}).sort((a, b) => b[1] - a[1]).map(([plan, count], idx) => (
                <div key={plan} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-sm font-medium text-slate-700 capitalize">{plan.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{count}</span>
                </div>
              ))}
              {Object.keys(memberBreakdown?.by_plan || {}).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No plan data available</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Mentors Info */}
        {memberBreakdown?.mentors && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-indigo-600" />
                <span className="font-medium text-indigo-900">Mentors</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-indigo-700">
                  Total: <strong>{memberBreakdown.mentors.total || 0}</strong>
                </span>
                <span className="text-green-700">
                  Active: <strong>{memberBreakdown.mentors.active || 0}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coaching Sessions Analytics */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">Coaching Sessions</h3>
          <InfoButton formula="Session metrics for the selected date range" />
        </div>
        
        {/* Key Metrics - 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">Scheduled</span>
            </div>
            <p className="text-2xl font-bold text-indigo-900">{coachingStats?.summary?.total_scheduled || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{coachingStats?.summary?.completed || 0}</p>
            <p className="text-xs text-green-600 mt-1">{coachingStats?.summary?.completion_rate || 0}% rate</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Confirmed</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{coachingStats?.summary?.confirmed || 0}</p>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Avg/Day</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{coachingStats?.summary?.avg_sessions_per_day || 0}</p>
            <p className="text-xs text-amber-600 mt-1">sessions completed</p>
          </div>
        </div>
        
        {/* Detailed Breakdown Table */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              Issues Breakdown
            </h4>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">Mentor No-Show</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.no_shows?.mentor || 0}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">Candidate No-Show</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.no_shows?.candidate || 0}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">Both No-Show</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.no_shows?.both || 0}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">Mentor Cancellation</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.cancellations?.mentor || 0}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">Candidate Cancellation</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.cancellations?.candidate || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-500" />
              Reschedules
            </h4>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">By Mentor</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.reschedules?.mentor || 0}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-600">By Candidate</td>
                  <td className="py-2 text-right font-medium text-slate-900">{coachingStats?.breakdown?.reschedules?.candidate || 0}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-700 font-medium">Total Reschedules</td>
                  <td className="py-2 text-right font-bold text-purple-700">{coachingStats?.breakdown?.reschedules?.total || 0}</td>
                </tr>
              </tbody>
            </table>
            
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h5 className="text-xs font-medium text-slate-500 mb-2">Summary</h5>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Mentor Disruptions:</span>
                <span className="font-medium text-red-600">{coachingStats?.breakdown?.disruptions?.mentor || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Candidate Disruptions:</span>
                <span className="font-medium text-orange-600">{coachingStats?.breakdown?.disruptions?.candidate || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Total No-Shows:</span>
                <span className="font-medium text-slate-600">{coachingStats?.breakdown?.no_shows?.total || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Total Cancellations:</span>
                <span className="font-medium text-slate-600">{coachingStats?.breakdown?.cancellations?.total || 0}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Daily Completed Sessions Line Graph */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h4 className="font-medium text-slate-900 mb-3">Daily Completed Sessions</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={coachingStats?.daily_completed || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value) => [value, 'Completed']}
              />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#10B981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsSection;
