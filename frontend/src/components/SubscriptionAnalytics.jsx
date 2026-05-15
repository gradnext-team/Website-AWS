import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  RefreshCw, Users, TrendingUp, Clock, DollarSign, 
  CheckCircle, XCircle, Calendar, Info, Package
} from 'lucide-react';
import { Button } from './ui/button';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

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

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const SubscriptionAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Day-wise graph state
  const [daywiseData, setDaywiseData] = useState(null);
  const [daywiseLoading, setDaywiseLoading] = useState(true);
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [dayRange, setDayRange] = useState(30); // Default 30 days
  
  // Sign-ups graph state
  const [signupsData, setSignupsData] = useState(null);
  const [signupsLoading, setSignupsLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/analytics/subscription-analytics`,
        { withCredentials: true }
      );
      setData(response.data);
    } catch (err) {
      setError('Failed to load subscription analytics');
      console.error('Subscription analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDaywiseData = async () => {
    setDaywiseLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/analytics/subscription-daywise?days=${dayRange}`,
        { withCredentials: true }
      );
      setDaywiseData(response.data);
    } catch (err) {
      console.error('Day-wise analytics error:', err);
    } finally {
      setDaywiseLoading(false);
    }
  };

  const fetchSignupsData = async () => {
    setSignupsLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/analytics/subscription-signups-daywise?days=${dayRange}`,
        { withCredentials: true }
      );
      setSignupsData(response.data);
    } catch (err) {
      console.error('Sign-ups analytics error:', err);
    } finally {
      setSignupsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDaywiseData();
    fetchSignupsData();
  }, []);

  useEffect(() => {
    fetchDaywiseData();
    fetchSignupsData();
  }, [dayRange]);

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

  // Transform day-wise data based on view mode
  const transformDaywiseData = () => {
    if (!daywiseData?.data) return [];

    const rawData = daywiseData.data;

    if (viewMode === 'daily') {
      return rawData.map(item => ({
        date: format(parseISO(item.date), 'MMM dd'),
        count: item.count,
        fullDate: item.date
      }));
    }

    if (viewMode === 'weekly') {
      const weeklyData = {};
      rawData.forEach(item => {
        const weekStart = startOfWeek(parseISO(item.date), { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'MMM dd');
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { date: weekKey, count: 0 };
        }
        weeklyData[weekKey].count += item.count;
      });
      return Object.values(weeklyData);
    }

    if (viewMode === 'monthly') {
      const monthlyData = {};
      rawData.forEach(item => {
        const monthStart = startOfMonth(parseISO(item.date));
        const monthKey = format(monthStart, 'MMM yyyy');
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { date: monthKey, count: 0 };
        }
        monthlyData[monthKey].count += item.count;
      });
      return Object.values(monthlyData);
    }

    return [];
  };

  // Transform sign-ups data based on view mode
  const transformSignupsData = () => {
    if (!signupsData?.data) return [];

    const rawData = signupsData.data;

    if (viewMode === 'daily') {
      return rawData.map(item => ({
        date: format(parseISO(item.date), 'MMM dd'),
        count: item.count,
        fullDate: item.date
      }));
    }

    if (viewMode === 'weekly') {
      const weeklyData = {};
      rawData.forEach(item => {
        const weekStart = startOfWeek(parseISO(item.date), { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'MMM dd');
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { date: weekKey, count: 0 };
        }
        weeklyData[weekKey].count += item.count;
      });
      return Object.values(weeklyData);
    }

    if (viewMode === 'monthly') {
      const monthlyData = {};
      rawData.forEach(item => {
        const monthStart = startOfMonth(parseISO(item.date));
        const monthKey = format(monthStart, 'MMM yyyy');
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { date: monthKey, count: 0 };
        }
        monthlyData[monthKey].count += item.count;
      });
      return Object.values(monthlyData);
    }

    return [];
  };

  const chartData = transformDaywiseData();
  const signupsChartData = transformSignupsData();

  // Prepare chart data
  const planDistributionData = data?.by_plan ? [
    { name: 'Basic', value: data.by_plan.basic_plan?.counts?.total || 0, color: '#3B82F6' },
    { name: 'Pro', value: data.by_plan.pro_plan?.counts?.total || 0, color: '#10B981' },
    { name: 'Pro Plus', value: data.by_plan.pro_plus?.counts?.total || 0, color: '#8B5CF6' }
  ].filter(d => d.value > 0) : [];

  const durationData = data?.by_plan ? [
    { 
      name: 'Basic', 
      '1 Month': data.by_plan.basic_plan?.counts?.['1_month'] || 0,
      '6 Month': data.by_plan.basic_plan?.counts?.['6_month'] || 0
    },
    { 
      name: 'Pro', 
      '1 Month': data.by_plan.pro_plan?.counts?.['1_month'] || 0,
      '6 Month': data.by_plan.pro_plan?.counts?.['6_month'] || 0
    },
    { 
      name: 'Pro Plus', 
      '1 Month': data.by_plan.pro_plus?.counts?.['1_month'] || 0,
      '6 Month': data.by_plan.pro_plus?.counts?.['6_month'] || 0
    }
  ] : [];

  const lifetimeDistributionData = data?.lifetime_metrics?.distribution ? [
    { name: '1 Month', value: data.lifetime_metrics.distribution['1_month'] || 0, color: '#EF4444' },
    { name: '2-3 Months', value: data.lifetime_metrics.distribution['2_3_months'] || 0, color: '#F59E0B' },
    { name: '4-6 Months', value: data.lifetime_metrics.distribution['4_6_months'] || 0, color: '#10B981' },
    { name: '7-12 Months', value: data.lifetime_metrics.distribution['7_12_months'] || 0, color: '#3B82F6' },
    { name: '12+ Months', value: data.lifetime_metrics.distribution['12_plus_months'] || 0, color: '#8B5CF6' }
  ].filter(d => d.value > 0) : [];

  const statusData = data?.subscription_status ? [
    { name: 'Active', value: data.subscription_status.active || 0, color: '#10B981' },
    { name: 'Expired', value: data.subscription_status.expired || 0, color: '#EF4444' }
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Subscription Analytics</h2>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Total Purchases</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">{data?.summary?.total_subscription_purchases || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(data?.summary?.total_subscription_revenue || 0)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Unique Customers</span>
          </div>
          <p className="text-2xl font-bold text-purple-900">{data?.summary?.unique_subscription_customers || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Avg Order Value</span>
          </div>
          <p className="text-2xl font-bold text-amber-900">{formatCurrency(data?.summary?.overall_avg_price || 0)}</p>
        </div>
      </div>

      {/* Day-wise Subscription Trend */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Subscription Purchase Trend</h3>
            <InfoButton formula={`View subscription purchases over time. Toggle between daily, weekly, or monthly views.`} />
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'weekly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Day Range Selector */}
            <select
              value={dayRange}
              onChange={(e) => setDayRange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {daywiseLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  angle={viewMode === 'daily' && dayRange > 30 ? -45 : 0}
                  textAnchor={viewMode === 'daily' && dayRange > 30 ? 'end' : 'middle'}
                  height={viewMode === 'daily' && dayRange > 30 ? 80 : 50}
                />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  fill="url(#colorCount)"
                  name="Subscriptions"
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total Subscriptions</p>
                <p className="text-2xl font-bold text-slate-900">{daywiseData?.total_subscriptions || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Average per {viewMode === 'daily' ? 'Day' : viewMode === 'weekly' ? 'Week' : 'Month'}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {chartData.length > 0 
                    ? Math.round((daywiseData?.total_subscriptions || 0) / chartData.length)
                    : 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Peak {viewMode === 'daily' ? 'Day' : viewMode === 'weekly' ? 'Week' : 'Month'}</p>
                <p className="text-2xl font-bold text-green-600">
                  {chartData.length > 0 
                    ? Math.max(...chartData.map(d => d.count))
                    : 0}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No subscription data available for the selected period
          </div>
        )}
      </div>

      {/* Day-wise Sign-ups Trend - NEW GRAPH */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Subscription Sign-ups Trend</h3>
            <InfoButton formula={`Track user registrations with subscription plans over time. Shows when users first signed up with Basic, Pro, or Pro+ plans.`} />
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'weekly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Day Range Selector */}
            <select
              value={dayRange}
              onChange={(e) => setDayRange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {signupsLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : signupsChartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={signupsChartData}>
                <defs>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  angle={viewMode === 'daily' && dayRange > 30 ? -45 : 0}
                  textAnchor={viewMode === 'daily' && dayRange > 30 ? 'end' : 'middle'}
                  height={viewMode === 'daily' && dayRange > 30 ? 80 : 50}
                />
                <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '8px 12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  fill="url(#colorSignups)"
                  name="Sign-ups"
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Total Sign-ups</p>
                <p className="text-2xl font-bold text-slate-900">{signupsData?.total_signups || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Average per {viewMode === 'daily' ? 'Day' : viewMode === 'weekly' ? 'Week' : 'Month'}</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {signupsChartData.length > 0 
                    ? Math.round((signupsData?.total_signups || 0) / signupsChartData.length)
                    : 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">Peak {viewMode === 'daily' ? 'Day' : viewMode === 'weekly' ? 'Week' : 'Month'}</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {signupsChartData.length > 0 
                    ? Math.max(...signupsChartData.map(d => d.count))
                    : 0}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-500">
            No sign-up data available for the selected period
          </div>
        )}
      </div>

      {/* Active vs Expired Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Subscription Status</h3>
          <InfoButton formula="Active = plan_end_date > today, Expired = plan_end_date < today" />
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Active Subscriptions</span>
            </div>
            <p className="text-3xl font-bold text-green-900">{data?.subscription_status?.active || 0}</p>
            <p className="text-xs text-green-600 mt-1">
              {data?.subscription_status?.total_customers > 0 
                ? `${((data.subscription_status.active / data.subscription_status.total_customers) * 100).toFixed(1)}% of customers`
                : '0% of customers'}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-700">Expired Subscriptions</span>
            </div>
            <p className="text-3xl font-bold text-red-900">{data?.subscription_status?.expired || 0}</p>
            <p className="text-xs text-red-600 mt-1">
              {data?.subscription_status?.total_customers > 0 
                ? `${((data.subscription_status.expired / data.subscription_status.total_customers) * 100).toFixed(1)}% of customers`
                : '0% of customers'}
            </p>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-700 mb-2">Status Distribution</h4>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Subscriptions by Plan & Duration */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Subscriptions by Plan & Duration</h3>
          <InfoButton formula="Count of subscription purchases grouped by plan type and billing cycle (1 month vs 6 month)" />
        </div>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Plan Cards */}
          <div className="space-y-4">
            {['basic_plan', 'pro_plan', 'pro_plus'].map((planKey) => {
              const plan = data?.by_plan?.[planKey];
              if (!plan) return null;
              
              const planColors = {
                'basic_plan': { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-' },
                'pro_plan': { bg: 'from-green-50 to-green-100', border: 'border-green-200', text: 'text-green-' },
                'pro_plus': { bg: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-' }
              };
              
              const colors = planColors[planKey];
              
              return (
                <div key={planKey} className={`bg-gradient-to-br ${colors.bg} p-4 rounded-lg border ${colors.border}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className={`font-semibold ${colors.text}900`}>{plan.name} Plan</h4>
                      <p className={`text-2xl font-bold ${colors.text}900`}>{plan.counts?.total || 0} purchases</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${colors.text}600`}>Avg Price</p>
                      <p className={`font-semibold ${colors.text}900`}>{formatCurrency(plan.avg_price || 0)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/50 p-2 rounded">
                      <p className="text-xs text-slate-500">1 Month</p>
                      <p className={`font-bold ${colors.text}800`}>{plan.counts?.['1_month'] || 0}</p>
                    </div>
                    <div className="bg-white/50 p-2 rounded">
                      <p className="text-xs text-slate-500">6 Month</p>
                      <p className={`font-bold ${colors.text}800`}>{plan.counts?.['6_month'] || 0}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-white/30">
                    <p className={`text-xs ${colors.text}600`}>Total Revenue: {formatCurrency(plan.total_revenue || 0)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Bar Chart */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-700 mb-4">Duration Breakdown by Plan</h4>
            {durationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={durationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="1 Month" fill="#3B82F6" />
                  <Bar dataKey="6 Month" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No data available</p>
            )}
          </div>
        </div>
        
        {/* Duration Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">Total 1-Month Subscriptions</span>
              <span className="text-xl font-bold text-blue-900">{data?.by_duration?.['1_month']?.total || 0}</span>
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-700">Total 6-Month Subscriptions</span>
              <span className="text-xl font-bold text-green-900">{data?.by_duration?.['6_month']?.total || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Lifetime & LTV Section */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Customer Lifetime & LTV</h3>
          <InfoButton formula="Lifetime = total months a customer has purchased subscriptions. LTV = total revenue from a customer (all purchases)" />
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Lifetime Metrics */}
          <div>
            <h4 className="font-medium text-slate-700 mb-3">Lifetime Metrics</h4>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg border border-cyan-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs font-medium text-cyan-700">Avg Lifetime</span>
                </div>
                <p className="text-2xl font-bold text-cyan-900">{data?.lifetime_metrics?.avg_lifetime_months || 0}</p>
                <p className="text-xs text-cyan-600">months</p>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">Total Months Sold</span>
                </div>
                <p className="text-2xl font-bold text-indigo-900">{data?.lifetime_metrics?.total_subscription_months_sold || 0}</p>
                <p className="text-xs text-indigo-600">subscription months</p>
              </div>
            </div>
            
            {/* Lifetime Distribution Chart */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h5 className="text-sm font-medium text-slate-700 mb-2">Customer Lifetime Distribution</h5>
              {lifetimeDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={lifetimeDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    >
                      {lifetimeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No data available</p>
              )}
              
              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {lifetimeDistributionData.map((item, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* LTV Metrics */}
          <div>
            <h4 className="font-medium text-slate-700 mb-3">LTV Metrics</h4>
            
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">Avg LTV (Subscription Customers)</span>
                    </div>
                    <p className="text-xs text-emerald-600">Average total revenue per subscription customer</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">
                    {formatCurrency(data?.ltv_metrics?.avg_ltv_per_subscription_customer || 0)}
                  </p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-teal-600" />
                      <span className="text-sm font-medium text-teal-700">Total LTV</span>
                    </div>
                    <p className="text-xs text-teal-600">Total revenue from subscription customers</p>
                  </div>
                  <p className="text-2xl font-bold text-teal-900">
                    {formatCurrency(data?.ltv_metrics?.total_ltv_subscription_customers || 0)}
                  </p>
                </div>
              </div>
              
              <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700">Avg LTV (All Customers)</span>
                    <p className="text-xs text-slate-500">Includes coaching, add-ons, etc.</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(data?.ltv_metrics?.avg_ltv_all_customers || 0)}
                  </p>
                </div>
              </div>
              
              <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-700">Total Paying Customers</span>
                    <p className="text-xs text-slate-500">All customers with at least one purchase</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    {data?.ltv_metrics?.total_paying_customers || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Distribution Overview */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Plan Distribution</h3>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {planDistributionData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={planDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {planDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="flex flex-col justify-center space-y-3">
                {planDistributionData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{item.value} purchases</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="col-span-2 text-center py-8 text-slate-500">
              No subscription data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionAnalytics;
