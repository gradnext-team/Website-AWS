import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Upload, Eye, EyeOff, Clock,
  DollarSign, Star, Loader2, Video, Calendar, FileText,
  Play, Pause, UserX, ExternalLink, CheckCircle2, Search, PlayCircle, RefreshCw,
  Users, Mail, Phone, MapPin, FolderOpen, Download, FileSpreadsheet,
  XCircle, ChevronLeft, ChevronRight, Ban, MessageSquare, ImageIcon, Send,
  GripVertical, Activity, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WeeklyAvailabilitySelector } from '../TimeSlotPicker';
import { ChunkedFileUpload, SimpleFileUpload } from '../ChunkedFileUpload';
import { istToViewer, format12hWithAbbr, getTimezoneAbbr } from '../../utils/timezone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const PeerSessionsSection = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    date_from: '',
    date_to: '',
    search: '',
  });
  
  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Participant management modal
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [managingParticipants, setManagingParticipants] = useState(false);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadStats();
    loadSessions();
  }, [page, filters]);

  // Real-time refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadSessions();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, page, filters]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.search) params.append('search', filters.search);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions?${params}`, { withCredentials: true });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (session) => {
    setSelectedSession(session);
    setDetailModalOpen(true);
    setLoadingDetails(true);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions/${session.id}`, { withCredentials: true });
      setSessionDetails(res.data);
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openStatusModal = (session) => {
    setSelectedSession(session);
    setNewStatus(session.status);
    setStatusNotes('');
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedSession) return;
    
    setUpdatingStatus(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/peer-sessions/${selectedSession.id}/update-status`,
        { status: newStatus, notes: statusNotes },
        { withCredentials: true }
      );
      setStatusModalOpen(false);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to update status: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const clearFilters = () => {
    setFilters({ status: '', date_from: '', date_to: '', search: '' });

  const openParticipantModal = (session) => {
    setSelectedSession(session);
    setParticipantModalOpen(true);
  };

  const handleRemoveParticipant = async (role) => {
    if (!selectedSession) return;
    
    const action = role === 'requester' ? 'remove_requester' : 'remove_partner';
    const participantName = role === 'requester' ? selectedSession.requester_name : selectedSession.partner_name;
    
    if (!window.confirm(`Are you sure you want to remove ${participantName} from this session? This will cancel the session.`)) {
      return;
    }
    
    setManagingParticipants(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/peer-sessions/${selectedSession.id}/participants`,
        { action, notes: `Removed ${participantName} via admin panel` },
        { withCredentials: true }
      );
      setParticipantModalOpen(false);
      loadSessions();
      loadStats();
      alert(`${participantName} removed successfully`);
    } catch (error) {
      alert('Failed to remove participant: ' + (error.response?.data?.detail || error.message));
    } finally {
      setManagingParticipants(false);
    }
  };

    setPage(1);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'pending': 'bg-amber-100 text-amber-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'cancelled': 'bg-slate-100 text-slate-700',
      'cancelled_by_mentor': 'bg-orange-100 text-orange-700',
      'cancelled_by_candidate': 'bg-red-100 text-red-700',
      'cancelled_by_admin': 'bg-purple-100 text-purple-700',
      'admin_cancelled': 'bg-purple-100 text-purple-700',
      'admin_rescheduled': 'bg-indigo-100 text-indigo-700',
      'declined': 'bg-red-100 text-red-700',
      'reschedule_pending': 'bg-purple-100 text-purple-700',
    };
    const statusLabels = {
      'cancelled_by_mentor': 'Cancelled by Mentor',
      'cancelled_by_candidate': 'Cancelled by Candidate',
      'cancelled_by_admin': 'Cancelled by Admin',
      'admin_cancelled': 'Admin Cancelled',
      'admin_rescheduled': 'Admin Rescheduled',
      'reschedule_pending': 'Reschedule Pending',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
        {statusLabels[status] || status?.replace('_', ' ')}
      </span>
    );
  };

  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    try {
      const dateObj = new Date(date);
      return `${dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} ${time || ''}`;
    } catch {
      return `${date} ${time || ''}`;
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions/export-excel`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `peer_sessions_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download Excel: ' + (error.response?.data?.detail || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="peer-sessions-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peer Sessions Tracking</h1>
          <p className="text-sm text-slate-500">Monitor all peer practice sessions in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportExcel}
            variant="outline"
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Excel
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <Button onClick={() => { loadSessions(); loadStats(); }} variant="outline" size="sm">
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Today</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sessions_today}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">This Week</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.sessions_this_week}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-600">Pending</p>
            <p className="text-2xl font-bold text-amber-700">{stats.by_status?.pending || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-600">Confirmed</p>
            <p className="text-2xl font-bold text-blue-700">{stats.by_status?.confirmed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <p className="text-sm text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-700">{stats.by_status?.completed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Cancelled/Declined</p>
            <p className="text-2xl font-bold text-slate-600">{(stats.by_status?.cancelled || 0) + (stats.by_status?.declined || 0)}</p>
          </div>
        </div>
      )}

      {/* Feedback Stats */}
      {stats?.feedback_stats && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Feedback Completion Status</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-700">{stats.feedback_stats.both_feedback}</p>
              <p className="text-xs text-green-600">Both Submitted</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-700">{stats.feedback_stats.requester_feedback_only}</p>
              <p className="text-xs text-blue-600">Requester Only</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-700">{stats.feedback_stats.partner_feedback_only}</p>
              <p className="text-xs text-purple-600">Partner Only</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-lg font-bold text-slate-700">{stats.feedback_stats.no_feedback}</p>
              <p className="text-xs text-slate-600">No Feedback</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Search & Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
              data-testid="filter-search"
            />
          </div>

          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
            <SelectTrigger data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="admin_cancelled">Admin Cancelled</SelectItem>
              <SelectItem value="admin_rescheduled">Admin Rescheduled</SelectItem>
              <SelectItem value="reschedule_pending">Reschedule Pending</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
            placeholder="From Date"
            data-testid="filter-date-from"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
            placeholder="To Date"
            data-testid="filter-date-to"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Search Results Indicator */}
      {filters.search && (
        <div className="flex items-center gap-2 px-1">
          <Search className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-slate-700">
            Showing <span className="font-semibold text-blue-600">{total}</span> session{total !== 1 ? 's' : ''} for &quot;<span className="font-medium">{filters.search}</span>&quot;
          </span>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Requester</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Req. Check-in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Partner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Partner Check-in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Req. Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Partner Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    {filters.search ? `No sessions found for "${filters.search}"` : 'No sessions found'}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50" data-testid={`peer-session-row-${session.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.date}</p>
                      <p className="text-sm text-slate-500">{session.time_slot}</p>
                      {session.reschedule_requested && (
                        <span className="text-xs text-purple-600">Rescheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={session.requester_picture || `https://ui-avatars.com/api/?name=${session.requester_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{session.requester_name}</p>
                          <p className="text-xs text-slate-500">{session.requester_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.requester_checked_in ? (
                        <div className="text-green-600">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Joined</span>
                          </div>
                          {session.requester_checked_in_at && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(session.requester_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not joined</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={session.partner_picture || `https://ui-avatars.com/api/?name=${session.partner_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{session.partner_name}</p>
                          <p className="text-xs text-slate-500">{session.partner_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.partner_checked_in ? (
                        <div className="text-green-600">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Joined</span>
                          </div>
                          {session.partner_checked_in_at && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(session.partner_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not joined</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(session.status)}
                    </td>
                    <td className="px-4 py-3">
                      {session.requester_feedback_given ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {session.requester_rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {session.requester_rating.toFixed(1)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not given</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.partner_feedback_given ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {session.partner_rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {session.partner_rating.toFixed(1)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not given</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(session)}
                          data-testid={`view-peer-session-${session.id}`}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatusModal(session)}
                          data-testid={`edit-peer-session-${session.id}`}
                          title="Update Status"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openParticipantModal(session)}
                          data-testid={`manage-participants-${session.id}`}
                          title="Manage Participants"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} sessions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Peer Session Details</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Date & Time</p>
                  <p className="font-medium">{sessionDetails.session?.date} at {sessionDetails.session?.time_slot}</p>
                  {sessionDetails.session?.reschedule_requested && (
                    <p className="text-xs text-purple-600 mt-1">
                      Rescheduled from {sessionDetails.session?.previous_date} at {sessionDetails.session?.previous_time_slot}
                    </p>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Session Type</p>
                  <p className="font-medium">{sessionDetails.session?.session_type || 'General Practice'}</p>
                  {sessionDetails.session?.case_type && (
                    <p className="text-sm text-slate-600">{sessionDetails.session?.case_type}</p>
                  )}
                </div>
              </div>

              {/* Requester & Partner */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Requester</p>
                  <div className="flex items-center gap-3">
                    <img 
                      src={sessionDetails.requester?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.requester?.name}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full" 
                    />
                    <div>
                      <p className="font-medium text-slate-900">{sessionDetails.requester?.name}</p>
                      <p className="text-sm text-slate-500">{sessionDetails.requester?.email}</p>
                      <p className="text-xs text-slate-400">Plan: {sessionDetails.requester?.plan || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Partner</p>
                  <div className="flex items-center gap-3">
                    <img 
                      src={sessionDetails.partner?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.partner?.name}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full" 
                    />
                    <div>
                      <p className="font-medium text-slate-900">{sessionDetails.partner?.name}</p>
                      <p className="text-sm text-slate-500">{sessionDetails.partner?.email}</p>
                      <p className="text-xs text-slate-400">Plan: {sessionDetails.partner?.plan || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase mb-2">Session Status</p>
                <div className="flex items-center gap-3">
                  {getStatusBadge(sessionDetails.session?.status)}
                  {sessionDetails.session?.meet_link && (
                    <a 
                      href={sessionDetails.session.meet_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Meeting Link
                    </a>
                  )}
                </div>
              </div>

              {/* Feedback Sections */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Requester Feedback (about Partner)</p>
                  {sessionDetails.requester_feedback ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${i <= (sessionDetails.requester_feedback.average_rating || sessionDetails.requester_feedback.rating_overall || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                          />
                        ))}
                        <span className="text-sm ml-2 text-slate-600">
                          {(sessionDetails.requester_feedback.average_rating || sessionDetails.requester_feedback.rating_overall || 0).toFixed(1)}
                        </span>
                      </div>
                      {sessionDetails.requester_feedback.qualitative_feedback && (
                        <p className="text-sm text-slate-600 mt-2">{sessionDetails.requester_feedback.qualitative_feedback}</p>
                      )}
                      <div className="text-xs text-slate-400 space-y-1 mt-2">
                        {sessionDetails.requester_feedback.rating_scoping_questions && (
                          <p>Scoping: {sessionDetails.requester_feedback.rating_scoping_questions}/5</p>
                        )}
                        {sessionDetails.requester_feedback.rating_case_structure && (
                          <p>Structure: {sessionDetails.requester_feedback.rating_case_structure}/5</p>
                        )}
                        {sessionDetails.requester_feedback.rating_communication && (
                          <p>Communication: {sessionDetails.requester_feedback.rating_communication}/5</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not yet provided</p>
                  )}
                </div>
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Partner Feedback (about Requester)</p>
                  {sessionDetails.partner_feedback ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${i <= (sessionDetails.partner_feedback.average_rating || sessionDetails.partner_feedback.rating_overall || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                          />
                        ))}
                        <span className="text-sm ml-2 text-slate-600">
                          {(sessionDetails.partner_feedback.average_rating || sessionDetails.partner_feedback.rating_overall || 0).toFixed(1)}
                        </span>
                      </div>
                      {sessionDetails.partner_feedback.qualitative_feedback && (
                        <p className="text-sm text-slate-600 mt-2">{sessionDetails.partner_feedback.qualitative_feedback}</p>
                      )}
                      <div className="text-xs text-slate-400 space-y-1 mt-2">
                        {sessionDetails.partner_feedback.rating_scoping_questions && (
                          <p>Scoping: {sessionDetails.partner_feedback.rating_scoping_questions}/5</p>
                        )}
                        {sessionDetails.partner_feedback.rating_case_structure && (
                          <p>Structure: {sessionDetails.partner_feedback.rating_case_structure}/5</p>
                        )}
                        {sessionDetails.partner_feedback.rating_communication && (
                          <p>Communication: {sessionDetails.partner_feedback.rating_communication}/5</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not yet provided</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {sessionDetails.session?.requester_notes && (
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Session Notes</p>
                  <p className="text-sm text-slate-600">{sessionDetails.session.requester_notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Failed to load session details</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Session Status</DialogTitle>
            <DialogDescription>
              Change the status of the peer session between {selectedSession?.requester_name} and {selectedSession?.partner_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="new-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="admin_cancelled">Admin Cancelled</SelectItem>
                  <SelectItem value="admin_rescheduled">Admin Rescheduled</SelectItem>
                  <SelectItem value="reschedule_pending">Reschedule Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Admin Notes (optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1"
                rows={3}
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add any notes about this status change..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Status
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Participant Management Modal */}
      <Dialog open={participantModalOpen} onOpenChange={setParticipantModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Session Participants</DialogTitle>
            <DialogDescription>
              Remove participants who are not showing up or not suitable for this session
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              {/* Requester */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedSession.requester_picture || `https://ui-avatars.com/api/?name=${selectedSession.requester_name}&background=random`}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{selectedSession.requester_name}</p>
                      <p className="text-xs text-slate-500">{selectedSession.requester_email}</p>
                      <span className="text-xs text-blue-600 font-medium">Requester</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveParticipant('requester')}
                    disabled={managingParticipants}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>

              {/* Partner */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedSession.partner_picture || `https://ui-avatars.com/api/?name=${selectedSession.partner_name}&background=random`}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{selectedSession.partner_name}</p>
                      <p className="text-xs text-slate-500">{selectedSession.partner_email}</p>
                      <span className="text-xs text-purple-600 font-medium">Partner</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveParticipant('partner')}
                    disabled={managingParticipants}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  ⚠️ <strong>Note:</strong> Removing a participant will mark this session as <strong>Admin Cancelled</strong>. This action cannot be undone.
                </p>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setParticipantModalOpen(false)}
                  disabled={managingParticipants}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default PeerSessionsSection;
