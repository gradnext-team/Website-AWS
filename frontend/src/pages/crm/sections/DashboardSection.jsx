import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, Target, Check, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { apiCall } from '../crmApi';
import { sourceLabels, PIE_COLORS } from '../crmConstants';
import { Badge } from '../components/Badge';
import { KPICard } from '../components/KPICard';

const DashboardSection = () => {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiCall.get(`/api/crm/dashboard?period=${period}`);
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch metrics', err);
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError('auth');
      } else {
        setError(err.response?.data?.detail || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error === 'auth') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-2xl bg-red-50 mb-4">
          <X className="w-10 h-10 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Not Authenticated</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-4">Please log in as admin to access the CRM dashboard.</p>
        <a href="/admin" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Go to Admin Login</a>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-2xl bg-amber-50 mb-4">
          <BarChart3 className="w-10 h-10 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Failed to Load Dashboard</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-4">{error || 'Something went wrong'}</p>
        <button onClick={fetchMetrics} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Retry</button>
      </div>
    );
  }

  const sourceData = Object.entries(metrics.leads_by_source || {}).map(([key, val]) => ({
    name: sourceLabels[key] || key,
    value: val,
  }));

  const stageData = Object.entries(metrics.leads_by_stage || {}).map(([key, val]) => ({
    name: key,
    value: val,
  }));

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">CRM Dashboard</h2>
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          {['7d', '30d', '90d', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${period === p ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Leads" value={metrics.total_leads} subtitle={`${metrics.period_leads} this period`} icon={Users} color="blue" />
        <KPICard title="Active" value={metrics.active_leads} icon={Target} color="purple" />
        <KPICard title="Won" value={metrics.won_leads} icon={Check} color="green" />
        <KPICard title="Conversion" value={`${metrics.conversion_rate}%`} icon={TrendingUp} color="orange" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads Trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Leads Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={metrics.daily_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="leads" stroke="#3B82F6" fill="#3B82F680" name="Leads" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Stage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Leads by Stage</h3>
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400 text-sm">No stage data yet</div>
          )}
        </div>

        {/* Leads by Source */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Leads by Source</h3>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {sourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400 text-sm">No source data yet</div>
          )}
        </div>

        {/* Leads & Calls trend chart removed */}
      </div>

      {/* Rep Performance Table */}
      {metrics.rep_performance && metrics.rep_performance.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Sales Rep Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium text-center">Leads</th>
                  <th className="pb-3 font-medium text-center">Won</th>
                  <th className="pb-3 font-medium text-center">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {metrics.rep_performance.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50">
                    <td className="py-3 font-medium text-slate-900">{rep.name}</td>
                    <td className="py-3 text-center">{rep.leads}</td>
                    <td className="py-3 text-center text-emerald-600 font-medium">{rep.won}</td>
                    <td className="py-3 text-center"><Badge variant="green">{rep.conversion_rate}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export { DashboardSection };
