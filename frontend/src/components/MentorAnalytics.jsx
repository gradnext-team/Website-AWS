import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, TrendingUp, DollarSign, Star, Calendar, Clock,
  Download, Search, ChevronDown, ChevronUp, Eye, X,
  AlertCircle, CheckCircle2, XCircle, RefreshCw, Filter,
  ArrowUpDown, FileSpreadsheet, BarChart3, Ban
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Format currency
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
};

// Status badge component
const StatusBadge = ({ status }) => {
  const styles = {
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-amber-100 text-amber-700',
    scheduled: 'bg-blue-100 text-blue-700',
    pending: 'bg-slate-100 text-slate-700'
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.pending}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

// Rating display component
const RatingDisplay = ({ rating, reviews }) => {
  if (!rating && rating !== 0) {
    return <span className="text-slate-400 text-sm">No ratings</span>;
  }
  
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <span className="font-medium">{rating.toFixed(1)}</span>
      {reviews !== undefined && (
        <span className="text-slate-400 text-xs">({reviews})</span>
      )}
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ icon: Icon, label, value, subValue, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600'
  };
  
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 hover:shadow-md transition-shadow min-w-0">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg shrink-0 ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 overflow-hidden">
          <p className="text-xs text-slate-500 truncate">{label}</p>
          <p className="text-base font-bold text-slate-900 truncate">{value}</p>
          {subValue && <p className="text-xs text-slate-400 truncate">{subValue}</p>}
        </div>
      </div>
    </div>
  );
};

export const MentorAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('sessions_completed');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Detail modal
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [mentorSessions, setMentorSessions] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  
  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);
  
  // Fetch data
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/mentor-analytics/summary?${params}`,
        { withCredentials: true }
      );
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, debouncedSearch, sortBy, sortOrder]);
  
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  
  // Fetch mentor session details
  const openMentorDetails = async (mentor) => {
    setSelectedMentor(mentor);
    setDetailPage(1);
    setLoadingDetails(true);
    
    try {
      const params = new URLSearchParams({ page: 1, limit: 20 });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/mentor-analytics/mentor/${mentor.mentor_id}/sessions?${params}`,
        { withCredentials: true }
      );
      setMentorSessions(res.data);
    } catch (err) {
      console.error('Failed to fetch mentor sessions:', err);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  // Load more sessions
  const loadMoreSessions = async () => {
    if (!selectedMentor || loadingDetails) return;
    
    const nextPage = detailPage + 1;
    setLoadingDetails(true);
    
    try {
      const params = new URLSearchParams({ page: nextPage, limit: 20 });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/mentor-analytics/mentor/${selectedMentor.mentor_id}/sessions?${params}`,
        { withCredentials: true }
      );
      
      setMentorSessions(prev => ({
        ...res.data,
        sessions: [...(prev?.sessions || []), ...res.data.sessions]
      }));
      setDetailPage(nextPage);
    } catch (err) {
      console.error('Failed to load more sessions:', err);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  // Export handlers
  const handleExportAll = async (format = 'csv') => {
    try {
      const params = new URLSearchParams({ format });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/mentor-analytics/export?${params}`,
        { withCredentials: true, responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mentor_analytics_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data');
    }
  };
  
  const handleExportMentorSessions = async () => {
    if (!selectedMentor) return;
    
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/mentor-analytics/mentor/${selectedMentor.mentor_id}/export-sessions?${params}`,
        { withCredentials: true, responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedMentor.name.replace(' ', '_').toLowerCase()}_sessions.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export sessions');
    }
  };
  
  // Clear filters
  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSortBy('sessions_completed');
    setSortOrder('desc');
  };
  
  // Toggle sort
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>{error}</p>
        <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }
  
  const summary = data?.summary || {};
  const mentors = data?.mentors || [];
  
  return (
    <div className="space-y-6" data-testid="mentor-analytics-section">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentor Analytics</h1>
          <p className="text-sm text-slate-500">
            Real-time performance tracking for {mentors.length} mentor{mentors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleExportAll('csv')}
            data-testid="export-csv-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <SummaryCard
          icon={CheckCircle2}
          label="Completed"
          value={summary.total_sessions_completed || 0}
          color="green"
        />
        <SummaryCard
          icon={XCircle}
          label="Cancelled"
          value={summary.total_sessions_cancelled || 0}
          color="red"
        />
        <SummaryCard
          icon={Ban}
          label="No-Shows"
          value={summary.total_sessions_no_show || 0}
          color="amber"
        />
        <SummaryCard
          icon={RefreshCw}
          label="Rescheduled"
          value={summary.total_sessions_rescheduled || 0}
          color="purple"
        />
        <SummaryCard
          icon={Star}
          label="Avg Rating"
          value={summary.platform_avg_rating?.toFixed(1) || 'N/A'}
          color="amber"
        />
        <SummaryCard
          icon={AlertCircle}
          label="Mentor FB Due"
          value={summary.total_pending_feedbacks || 0}
          color="slate"
        />
        <SummaryCard
          icon={DollarSign}
          label="Earnings"
          value={formatCurrency(summary.total_mentor_earnings)}
          color="green"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCurrency(summary.total_platform_revenue)}
          color="blue"
        />
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters & Sorting</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="analytics-search"
            />
          </div>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From Date"
            data-testid="analytics-date-from"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To Date"
            data-testid="analytics-date-to"
          />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger data-testid="analytics-sort-by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sessions_completed">Sessions Completed</SelectItem>
              <SelectItem value="total_sessions">Total Sessions</SelectItem>
              <SelectItem value="avg_rating">Rating</SelectItem>
              <SelectItem value="total_earnings">Earnings</SelectItem>
              <SelectItem value="total_revenue">Revenue</SelectItem>
              <SelectItem value="pending_feedbacks">Mentor FB Due</SelectItem>
              <SelectItem value="sessions_cancelled">Cancellations</SelectItem>
              <SelectItem value="sessions_no_show">No-Shows</SelectItem>
              <SelectItem value="sessions_rescheduled">Rescheduled</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            >
              <ArrowUpDown className="w-4 h-4 mr-1" />
              {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>
      
      {/* Mentors Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor</th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('sessions_completed')}
                >
                  <div className="flex items-center gap-1">
                    Completed
                    {sortBy === 'sessions_completed' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('sessions_cancelled')}
                >
                  <div className="flex items-center gap-1">
                    Cancelled
                    {sortBy === 'sessions_cancelled' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('sessions_no_show')}
                >
                  <div className="flex items-center gap-1">
                    No-Shows
                    {sortBy === 'sessions_no_show' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('sessions_rescheduled')}
                >
                  <div className="flex items-center gap-1">
                    Rescheduled
                    {sortBy === 'sessions_rescheduled' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('avg_rating')}
                >
                  <div className="flex items-center gap-1">
                    Rating
                    {sortBy === 'avg_rating' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('pending_feedbacks')}
                >
                  <div className="flex items-center gap-1">
                    Mentor FB
                    {sortBy === 'pending_feedbacks' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('total_earnings')}
                >
                  <div className="flex items-center gap-1">
                    Earnings
                    {sortBy === 'total_earnings' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleSort('total_revenue')}
                >
                  <div className="flex items-center gap-1">
                    Revenue
                    {sortBy === 'total_revenue' && (sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mentors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No mentors found</p>
                    {(search || dateFrom || dateTo) && (
                      <Button variant="link" onClick={clearFilters} className="mt-2">
                        Clear filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                mentors.map((mentor) => (
                  <tr 
                    key={mentor.mentor_id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openMentorDetails(mentor)}
                    data-testid={`mentor-analytics-row-${mentor.mentor_id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={mentor.picture || `https://ui-avatars.com/api/?name=${mentor.name}&background=random`}
                          alt={mentor.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium text-slate-900">{mentor.name}</p>
                          <p className="text-xs text-slate-500">{mentor.consulting_firm || mentor.email}</p>
                          {mentor.is_hidden && (
                            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Hidden</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-green-600">{mentor.sessions_completed}</span>
                      <span className="text-slate-400 text-xs">/{mentor.total_sessions}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={mentor.sessions_cancelled > 0 ? 'text-red-600' : 'text-slate-400'}>
                        {mentor.sessions_cancelled}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={mentor.sessions_no_show > 0 ? 'text-amber-600' : 'text-slate-400'}>
                        {mentor.sessions_no_show}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={mentor.sessions_rescheduled > 0 ? 'text-purple-600' : 'text-slate-400'}>
                        {mentor.sessions_rescheduled}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RatingDisplay rating={mentor.avg_rating} reviews={mentor.total_reviews} />
                    </td>
                    <td className="px-4 py-3">
                      {mentor.pending_feedbacks > 0 ? (
                        <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
                          {mentor.pending_feedbacks}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-600">
                      {formatCurrency(mentor.total_earnings)}
                    </td>
                    <td className="px-4 py-3 font-medium text-blue-600">
                      {formatCurrency(mentor.total_revenue)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openMentorDetails(mentor)}
                        data-testid={`view-mentor-details-${mentor.mentor_id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Mentor Detail Modal */}
      <Dialog open={!!selectedMentor} onOpenChange={(open) => !open && setSelectedMentor(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedMentor && (
                <>
                  <img
                    src={selectedMentor.picture || `https://ui-avatars.com/api/?name=${selectedMentor.name}&background=random`}
                    alt={selectedMentor.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <span>{selectedMentor.name}</span>
                    <p className="text-sm font-normal text-slate-500">{selectedMentor.email}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {loadingDetails && !mentorSessions ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : mentorSessions ? (
            <div className="space-y-6">
              {/* Mentor Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-green-600 uppercase">Completed</p>
                  <p className="text-2xl font-bold text-green-700">{mentorSessions.summary.sessions_completed}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-red-600 uppercase">Cancelled</p>
                  <p className="text-2xl font-bold text-red-700">{mentorSessions.summary.sessions_cancelled}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-xs text-amber-600 uppercase">No-Shows</p>
                  <p className="text-2xl font-bold text-amber-700">{mentorSessions.summary.sessions_no_show}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600 uppercase">Rescheduled</p>
                  <p className="text-2xl font-bold text-purple-700">{mentorSessions.summary.sessions_rescheduled}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Avg Rating</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span className="text-2xl font-bold text-slate-900">
                      {mentorSessions.summary.avg_rating?.toFixed(1) || 'N/A'}
                    </span>
                    <span className="text-sm text-slate-400">({mentorSessions.summary.total_reviews})</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase">Hourly Rate</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(mentorSessions.mentor.hourly_rate)}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-green-600 uppercase">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(mentorSessions.summary.total_earnings)}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600 uppercase">Total Revenue</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(mentorSessions.summary.total_revenue)}
                  </p>
                </div>
              </div>
              
              {/* Export Button */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleExportMentorSessions}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Sessions CSV
                </Button>
              </div>
              
              {/* Sessions Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Candidate</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Rating</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Feedback</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Earnings</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mentorSessions.sessions.map((session) => (
                      <tr key={session.session_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{session.date}</p>
                          <p className="text-xs text-slate-500">{session.time_slot}</p>
                          {session.was_rescheduled && (
                            <span className="text-xs text-purple-600">↻ Rescheduled</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm text-slate-900">{session.candidate_name}</p>
                          <p className="text-xs text-slate-500">{session.candidate_email}</p>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={session.status} />
                        </td>
                        <td className="px-3 py-2">
                          {session.candidate_feedback_rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{session.candidate_feedback_rating}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {session.status === 'completed' ? (
                            session.candidate_feedback_given ? (
                              <span className="flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle2 className="w-3 h-3" /> Given
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600 text-xs">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-green-600 font-medium">
                          {formatCurrency(session.session_earnings)}
                        </td>
                        <td className="px-3 py-2 text-blue-600 font-medium">
                          {formatCurrency(session.session_revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Load More */}
              {mentorSessions.pagination.page < mentorSessions.pagination.total_pages && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={loadMoreSessions}
                    disabled={loadingDetails}
                  >
                    {loadingDetails ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ChevronDown className="w-4 h-4 mr-2" />
                    )}
                    Load More ({mentorSessions.pagination.total - mentorSessions.sessions.length} remaining)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Failed to load session details</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MentorAnalytics;
