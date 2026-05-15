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

export const PayoutsSection = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    mentor_id: '',
    candidate_id: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  
  // Mark paid modal
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [amountOverride, setAmountOverride] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkMarkingPaid, setBulkMarkingPaid] = useState(false);

  useEffect(() => {
    loadStats();
    loadSessions();
  }, [page, filters]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/payouts/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.mentor_id) params.append('mentor_id', filters.mentor_id);
      if (filters.candidate_id) params.append('candidate_id', filters.candidate_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/payouts?${params}`, { withCredentials: true });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openMarkPaidModal = (session) => {
    setSelectedSession(session);
    setAmountOverride(session.amount?.toString() || '');
    setMarkPaidModalOpen(true);
  };

  const handleMarkPaid = async () => {
    if (!selectedSession) return;
    
    setMarkingPaid(true);
    try {
      const body = {};
      if (amountOverride && parseInt(amountOverride) !== selectedSession.mentor_hourly_rate) {
        body.amount_override = parseInt(amountOverride);
      }
      
      await axios.post(
        `${BACKEND_URL}/api/admin/payouts/${selectedSession.id}/mark-paid`,
        body,
        { withCredentials: true }
      );
      setMarkPaidModalOpen(false);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to mark as paid: ' + (error.response?.data?.detail || error.message));
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.length === 0) return;
    
    setBulkMarkingPaid(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/payouts/bulk-mark-paid`,
        { booking_ids: selectedIds },
        { withCredentials: true }
      );
      alert(`Marked ${res.data.marked_paid} sessions as paid.${res.data.failed?.length > 0 ? ` ${res.data.failed.length} failed.` : ''}`);
      setSelectedIds([]);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setBulkMarkingPaid(false);
    }
  };

  const toggleSelectAll = () => {
    const pendingSessions = sessions.filter(s => s.payment_status === 'pending');
    if (selectedIds.length === pendingSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingSessions.map(s => s.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const clearFilters = () => {
    setFilters({ mentor_id: '', candidate_id: '', status: '', date_from: '', date_to: '' });
    setPage(1);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'pending': 'bg-amber-100 text-amber-700',
      'on_hold': 'bg-red-100 text-red-700',
      'paid': 'bg-green-100 text-green-700',
    };
    const statusLabels = {
      'pending': 'Payment Pending',
      'on_hold': 'On Hold',
      'paid': 'Paid',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="payouts-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentor Payouts</h1>
          <p className="text-sm text-slate-500">Manage mentor payments for completed sessions</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <Button onClick={handleBulkMarkPaid} disabled={bulkMarkingPaid} className="bg-green-600 hover:bg-green-700">
              {bulkMarkingPaid ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Mark {selectedIds.length} as Paid
            </Button>
          )}
          <Button onClick={() => { loadSessions(); loadStats(); }} variant="outline" size="sm">
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-600">Payment Pending</p>
            <p className="text-2xl font-bold text-amber-700">₹{stats.summary.total_pending?.toLocaleString()}</p>
            <p className="text-xs text-amber-500">{stats.summary.pending_count} sessions</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-600">On Hold</p>
            <p className="text-2xl font-bold text-red-700">₹{stats.summary.total_on_hold?.toLocaleString()}</p>
            <p className="text-xs text-red-500">{stats.summary.on_hold_count} sessions</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">Paid</p>
            <p className="text-2xl font-bold text-green-700">₹{stats.summary.total_paid?.toLocaleString()}</p>
            <p className="text-xs text-green-500">{stats.summary.paid_count} sessions</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 col-span-2 md:col-span-3">
            <p className="text-sm text-blue-600 mb-2">Monthly Payouts (Last 6 months)</p>
            <div className="flex items-end gap-2 h-16">
              {stats.monthly_data?.slice(0, 6).reverse().map((m, idx) => {
                const maxPaid = Math.max(...stats.monthly_data.slice(0, 6).map(d => d.paid || 1));
                const height = maxPaid > 0 ? ((m.paid || 0) / maxPaid) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-500 rounded-t" 
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`₹${(m.paid || 0).toLocaleString()}`}
                    />
                    <span className="text-xs text-slate-500 mt-1">{m.month?.slice(5) || ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select value={filters.mentor_id || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, mentor_id: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Mentors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mentors</SelectItem>
              {stats?.mentors?.map(mentor => (
                <SelectItem key={mentor.id} value={mentor.id}>{mentor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.candidate_id || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, candidate_id: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Candidates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Candidates</SelectItem>
              {stats?.candidates?.map(candidate => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Payment Pending</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
            placeholder="From Date"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
            placeholder="To Date"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === sessions.filter(s => s.payment_status === 'pending').length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Session Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {session.payment_status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(session.id)}
                          onChange={() => toggleSelect(session.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.date}</p>
                      <p className="text-sm text-slate-500">{session.time_slot}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={session.mentor_picture || `https://ui-avatars.com/api/?name=${session.mentor_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{session.mentor_name}</p>
                          <p className="text-xs text-slate-500">₹{session.mentor_hourly_rate}/hr</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 text-sm">{session.candidate_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{session.session_type || 'Coaching'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">₹{session.amount?.toLocaleString()}</p>
                      {session.amount_override && (
                        <p className="text-xs text-blue-600">Override</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.has_feedback ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Given
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(session.payment_status)}
                      {session.paid_at && (
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(session.paid_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.payment_status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openMarkPaidModal(session)}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {session.payment_status === 'on_hold' && (
                        <span className="text-xs text-slate-500">Awaiting feedback</span>
                      )}
                      {session.payment_status === 'paid' && (
                        <span className="text-xs text-green-600">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
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

      {/* Mark Paid Modal */}
      <Dialog open={markPaidModalOpen} onOpenChange={setMarkPaidModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Session as Paid</DialogTitle>
            <DialogDescription>
              Confirm payment for session with {selectedSession?.candidate_name} on {selectedSession?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Mentor</label>
              <p className="text-slate-900">{selectedSession?.mentor_name}</p>
              <p className="text-xs text-slate-500">Hourly rate: ₹{selectedSession?.mentor_hourly_rate}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Amount</label>
              <Input
                type="number"
                value={amountOverride}
                onChange={(e) => setAmountOverride(e.target.value)}
                placeholder="Enter amount"
              />
              <p className="text-xs text-slate-500 mt-1">Leave as is or enter a different amount to override</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPaidModalOpen(false)}>Cancel</Button>
              <Button onClick={handleMarkPaid} disabled={markingPaid} className="bg-green-600 hover:bg-green-700">
                {markingPaid ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Coaching Sessions Section ============
// =============================================================================
// Recording Health Check Panel
// =============================================================================
// Compact admin panel that runs the Meet recording self-test and surfaces
// the per-step pass/fail status with actionable remediation hints. Lives
// at the top of the CoachingSessionsSection so admins see it whenever
// they go to view sessions/recordings.
const RecordingHealthCheck = () => {
  const [config, setConfig] = useState(null);
  const [report, setReport] = useState(null);
  const [globalDiag, setGlobalDiag] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Force-sync-by-criteria modal state
  const [showForceSync, setShowForceSync] = useState(false);
  const [forceSyncForm, setForceSyncForm] = useState({ date: '', mentor_email: '', candidate_email: '', session_id: '' });
  const [forceSyncResult, setForceSyncResult] = useState(null);
  const [forceSyncing, setForceSyncing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, gdiag] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/admin/recordings/config`, { withCredentials: true }),
          axios.get(`${BACKEND_URL}/api/admin/recordings/global-diagnose`, { withCredentials: true }),
        ]);
        setConfig(cfg.data);
        setGlobalDiag(gdiag.data);
      } catch (e) {
        console.error('recording panel load failed', e);
      }
    };
    load();
  }, []);

  const refreshGlobalDiag = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/recordings/global-diagnose`, { withCredentials: true });
      setGlobalDiag(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const runSelfTest = async () => {
    setRunning(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/recordings/self-test`, {}, { withCredentials: true });
      setReport(res.data);
      setExpanded(true);
    } catch (e) {
      setReport({ error: e?.response?.data?.detail || e.message, steps: [] });
      setExpanded(true);
    } finally {
      setRunning(false);
    }
  };

  const syncAllPending = async () => {
    setRunning(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/recordings/sync-all-pending`, {}, { withCredentials: true });
      alert(`Sync complete: found=${res.data?.stats?.found || 0}, synced=${res.data?.stats?.synced || 0}, skipped=${res.data?.stats?.skipped || 0}`);
      await refreshGlobalDiag();
    } catch (e) {
      alert(`Sync failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const submitForceSync = async () => {
    setForceSyncing(true);
    setForceSyncResult(null);
    try {
      const payload = {};
      Object.entries(forceSyncForm).forEach(([k, v]) => { if (v && v.trim()) payload[k] = v.trim(); });
      const res = await axios.post(`${BACKEND_URL}/api/admin/recordings/find-and-force-sync`, payload, { withCredentials: true });
      setForceSyncResult(res.data);
      await refreshGlobalDiag();
    } catch (e) {
      setForceSyncResult({ error: e?.response?.data?.detail || e.message });
    } finally {
      setForceSyncing(false);
    }
  };

  const overallOk = report?.overall_ok;
  const hasReport = report && Array.isArray(report.steps);
  const stuckCount = globalDiag ? Object.values(globalDiag.counts_by_collection || {}).reduce((s, c) => s + (c.stuck_no_recording || 0), 0) : 0;
  const schedulerAlive = globalDiag?.scheduler_alive;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4" data-testid="recording-health-check">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${hasReport && overallOk ? 'bg-green-100' : hasReport ? 'bg-amber-100' : 'bg-indigo-100'}`}>
            {hasReport && overallOk ? (
              <ShieldCheck className="w-5 h-5 text-green-700" />
            ) : hasReport ? (
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            ) : (
              <Activity className="w-5 h-5 text-indigo-700" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Recording Infrastructure
              {config?.auto_record_enabled === false && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Auto-record disabled</span>
              )}
              {schedulerAlive === false && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full" data-testid="scheduler-stale-badge">Scheduler stale</span>
              )}
              {schedulerAlive === true && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full" data-testid="scheduler-alive-badge">Scheduler alive</span>
              )}
              {stuckCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full" data-testid="stuck-count-badge">
                  {stuckCount} stuck
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Sessions auto-record via Google Meet REST API. Recordings are moved to the configured Shared Drive folder.
            </p>
            {config && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Host: <code className="bg-white px-1 rounded">{config.impersonate_email}</code>
                </span>
                {config.recordings_drive_folder_url ? (
                  <a
                    href={config.recordings_drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Open Shared Drive folder
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-amber-700">No Shared Drive folder configured</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setShowForceSync(true)}
            disabled={running}
            variant="outline"
            size="sm"
            data-testid="force-sync-session-btn"
            className="bg-white"
            title="Find a specific session by date+mentor and pull its recording NOW"
          >
            <Search className="w-4 h-4 mr-1" />
            Force-sync session
          </Button>
          <Button
            onClick={runSelfTest}
            disabled={running}
            variant="outline"
            size="sm"
            data-testid="recording-self-test-btn"
            className="bg-white"
          >
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Activity className="w-4 h-4 mr-1" />}
            Run health check
          </Button>
          <Button
            onClick={syncAllPending}
            disabled={running}
            variant="outline"
            size="sm"
            data-testid="recording-sync-all-btn"
            className="bg-white"
            title="Force-pull all pending recordings from Google Meet API now"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${running ? 'animate-spin' : ''}`} />
            Sync all pending
          </Button>
        </div>
      </div>

      {/* Global diagnostic banner — shows actionable issues at a glance */}
      {globalDiag?.diagnosis && globalDiag.diagnosis.length > 0 && (
        <div className="mt-3 space-y-1.5" data-testid="recording-diagnosis-banner">
          {globalDiag.diagnosis.map((line, idx) => (
            <div
              key={idx}
              className={`text-xs rounded p-2 border ${
                line.includes('✅') ? 'bg-green-50 border-green-200 text-green-800' :
                line.includes('❌') || line.includes('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-900' :
                'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Stuck sessions sample — quick links to force-sync */}
      {globalDiag?.stuck_session_samples?.length > 0 && (
        <details className="mt-3 text-xs" data-testid="stuck-sessions-list">
          <summary className="cursor-pointer text-slate-700 font-medium">
            {globalDiag.stuck_session_samples.length} recent session(s) without a recording — click to expand
          </summary>
          <div className="mt-2 space-y-1.5">
            {globalDiag.stuck_session_samples.map((s) => (
              <div key={s.id} className="bg-white rounded p-2 border border-slate-200 flex items-center justify-between gap-2">
                <div className="text-[11px] min-w-0">
                  <div className="font-mono truncate">{s.id}</div>
                  <div className="text-slate-500">
                    {s.date} · {s.time_slot || '—'} · {s.mentor_email || s.mentor_id || '—'} → {s.user_email || s.user_id}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setForceSyncForm({ date: '', mentor_email: '', candidate_email: '', session_id: s.id });
                    setShowForceSync(true);
                  }}
                  data-testid={`force-sync-${s.id}`}
                >
                  Force sync
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {hasReport && expanded && (
        <div className="mt-4 space-y-2 bg-white rounded-md p-3 border border-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Health check report</p>
            <button onClick={() => setExpanded(false)} className="text-xs text-slate-500 hover:text-slate-700">Hide</button>
          </div>
          {report.test_meeting && (
            <div className="text-xs bg-slate-50 rounded p-2 border border-slate-100">
              <div className="font-medium text-slate-700 mb-1">Test meeting created</div>
              <div className="text-slate-600">
                Tier: <code className="bg-white px-1 rounded">{report.test_meeting.tier}</code>
              </div>
              <div className="text-slate-600">
                Link: <a href={report.test_meeting.meeting_uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{report.test_meeting.meeting_uri}</a>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                You can join this test meeting briefly to verify recording — Google will produce artifacts within ~10 minutes after the call ends. Then click "Sync all pending" above.
              </div>
            </div>
          )}
          {report.steps.map((step, idx) => (
            <div
              key={idx}
              className={`text-xs rounded border p-2 ${step.ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
              data-testid={`recording-step-${step.name}`}
            >
              <div className="flex items-start gap-2">
                {step.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{step.name.replace(/_/g, ' ')}</p>
                  <p className="text-slate-600 mt-0.5 break-words">{step.detail}</p>
                  {step.remediation && !step.ok && (
                    <p className="mt-1.5 text-amber-800 font-medium border-l-2 border-amber-400 pl-2">
                      Action: {step.remediation}
                    </p>
                  )}
                  {step.attempts && step.attempts.length > 0 && (
                    <details className="mt-1 text-[11px] text-slate-500">
                      <summary className="cursor-pointer">Show raw attempts</summary>
                      <pre className="mt-1 p-1.5 bg-slate-50 rounded overflow-x-auto">{JSON.stringify(step.attempts, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
          {report.error && (
            <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-700">
              {report.error}
            </div>
          )}
        </div>
      )}

      {/* Force-sync modal — find session by date+mentor+candidate and pull recording NOW */}
      {showForceSync && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForceSync(false)} data-testid="force-sync-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Force-sync a specific session</h3>
                <p className="text-xs text-slate-500 mt-0.5">Find the session by ID, or by date + mentor/candidate email, then pull its recording from Google Meet RIGHT NOW.</p>
              </div>
              <button onClick={() => setShowForceSync(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Session ID (optional, fastest)</label>
                <input
                  type="text"
                  value={forceSyncForm.session_id}
                  onChange={(e) => setForceSyncForm({ ...forceSyncForm, session_id: e.target.value })}
                  placeholder="booking-xyz123 or strategy-xyz123"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                  data-testid="force-sync-session-id-input"
                />
              </div>
              <div className="text-xs text-slate-500 -my-1">— OR look up by criteria —</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={forceSyncForm.date}
                    onChange={(e) => setForceSyncForm({ ...forceSyncForm, date: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    data-testid="force-sync-date-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Mentor email</label>
                  <input
                    type="email"
                    value={forceSyncForm.mentor_email}
                    onChange={(e) => setForceSyncForm({ ...forceSyncForm, mentor_email: e.target.value })}
                    placeholder="mentor@example.com"
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    data-testid="force-sync-mentor-email-input"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Candidate email (optional, narrows match)</label>
                <input
                  type="email"
                  value={forceSyncForm.candidate_email}
                  onChange={(e) => setForceSyncForm({ ...forceSyncForm, candidate_email: e.target.value })}
                  placeholder="candidate@example.com"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  data-testid="force-sync-candidate-email-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowForceSync(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={submitForceSync}
                  disabled={forceSyncing || (!forceSyncForm.session_id && !forceSyncForm.date)}
                  data-testid="force-sync-submit-btn"
                >
                  {forceSyncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Find & sync now
                </Button>
              </div>

              {/* Result */}
              {forceSyncResult && (
                <div className="mt-3 p-3 rounded border border-slate-200 bg-slate-50 text-xs space-y-2" data-testid="force-sync-result">
                  {forceSyncResult.error ? (
                    <div className="text-red-700 font-medium">❌ {forceSyncResult.error}</div>
                  ) : (
                    <>
                      <div>
                        <div className="font-medium text-slate-800">Session found:</div>
                        <div className="font-mono text-[11px] text-slate-600">{forceSyncResult.session?.id} ({forceSyncResult.session?.collection})</div>
                        <div className="text-slate-600">{forceSyncResult.session?.date} · {forceSyncResult.session?.time_slot} · {forceSyncResult.session?.mentor_email} → {forceSyncResult.session?.user_email}</div>
                      </div>
                      {forceSyncResult.session?.recording_url_after ? (
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <div className="font-medium text-green-800">✅ Recording URL fetched</div>
                          <a href={forceSyncResult.session.recording_url_after} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline break-all">
                            {forceSyncResult.session.recording_url_after}
                          </a>
                          {forceSyncResult.session?.recording_drive_moved_after === false && (
                            <div className="mt-1 text-amber-800">⚠️ Recording exists but did NOT move to Shared Drive (Drive scope or Shared-Drive Manager permission missing).</div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
                          <div className="font-medium">⚠️ No recording_url found yet</div>
                          {forceSyncResult.error && <div className="mt-1">{forceSyncResult.error}</div>}
                        </div>
                      )}
                      {forceSyncResult.diagnosis?.map((d, i) => (
                        <div key={i} className="text-slate-700">{d}</div>
                      ))}
                      <details>
                        <summary className="cursor-pointer text-slate-500">Raw response</summary>
                        <pre className="mt-1 p-2 bg-white rounded overflow-x-auto text-[10px]">{JSON.stringify(forceSyncResult, null, 2)}</pre>
                      </details>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default PayoutsSection;
