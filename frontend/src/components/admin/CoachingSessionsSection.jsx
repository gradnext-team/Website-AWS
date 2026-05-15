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

// at the top of the CoachingSessionsSection so admins see it whenever
// they go to view sessions/recordings.
const RecordingHealthCheck = () => {
  const [config, setConfig] = useState(null);
  const [report, setReport] = useState(null);
  const [globalDiag, setGlobalDiag] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Panel-level visibility — collapsed by default so the heavy
  // diagnose call (counts + Drive RPC) does NOT block the Coaching
  // Sessions tab from rendering. The admin opens this on demand.
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);
  // Force-sync-by-criteria modal state
  const [showForceSync, setShowForceSync] = useState(false);
  const [forceSyncForm, setForceSyncForm] = useState({ date: '', mentor_email: '', candidate_email: '', session_id: '' });
  const [forceSyncResult, setForceSyncResult] = useState(null);
  const [forceSyncing, setForceSyncing] = useState(false);

  const loadPanelData = async () => {
    if (config && globalDiag) return; // already loaded
    setLoadingPanel(true);
    try {
      const [cfg, gdiag] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/recordings/config`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/recordings/global-diagnose`, { withCredentials: true }),
      ]);
      setConfig(cfg.data);
      setGlobalDiag(gdiag.data);
    } catch (e) {
      console.error('recording panel load failed', e);
    } finally {
      setLoadingPanel(false);
    }
  };

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    if (next) loadPanelData();
  };

  // Collapsed view — single thin bar, no network calls on mount.
  if (!panelOpen) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between" data-testid="recording-health-check-collapsed">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span className="font-medium">Recording Infrastructure</span>
          <span className="text-xs text-slate-500">— click to load diagnostics on demand</span>
        </div>
        <Button
          onClick={togglePanel}
          variant="outline"
          size="sm"
          className="bg-white"
          data-testid="recording-health-check-toggle"
        >
          Show diagnostics
        </Button>
      </div>
    );
  }

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
            onClick={() => setPanelOpen(false)}
            variant="ghost"
            size="sm"
            data-testid="recording-health-check-hide"
            title="Hide diagnostics"
          >
            <X className="w-4 h-4" />
          </Button>
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
      {loadingPanel && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600" data-testid="recording-panel-loading">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading diagnostics…
        </div>
      )}
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

export const CoachingSessionsSection = () => {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    mentor_id: '',
    date_from: '',
    date_to: '',
    search: '',
    booking_type: '',
  });
  
  // Quick date filter
  const [quickDateFilter, setQuickDateFilter] = useState('');
  
  // Debounced filters for API calls
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  
  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [filters]);
  
  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [syncingRecording, setSyncingRecording] = useState(false);
  // Manual recording URL assignment
  const [setRecordingModalOpen, setSetRecordingModalOpen] = useState(false);
  const [manualRecordingUrl, setManualRecordingUrl] = useState('');
  const [manualTranscriptUrl, setManualTranscriptUrl] = useState('');
  const [savingRecordingUrl, setSavingRecordingUrl] = useState(false);

  
  // Status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Delete feedback confirmation modal
  const [deleteFeedbackModalOpen, setDeleteFeedbackModalOpen] = useState(false);
  const [deleteFeedbackType, setDeleteFeedbackType] = useState(null); // 'mentor' or 'candidate'
  const [deletingFeedback, setDeletingFeedback] = useState(false);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Manual session creation modal
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [mentorsList, setMentorsList] = useState([]);
  const [candidatesList, setCandidatesList] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState({
    mentor_id: '',
    candidate_id: '',
    date: '',
    time_slot: '',
    session_type: '',
    case_type: '',
    admin_remarks: '',
    booking_type: 'coaching',
    deduct_credit: false
  });

  useEffect(() => {
    loadStats();
    loadSessions();
  }, [page, debouncedFilters]);

  // Real-time refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadSessions();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, page, debouncedFilters]);

  // Load mentors when add session modal opens
  useEffect(() => {
    if (addSessionModalOpen) {
      loadMentorsForSession();
    }
  }, [addSessionModalOpen]);

  // Search candidates when typing
  useEffect(() => {
    if (addSessionModalOpen) {
      const timer = setTimeout(() => {
        loadCandidatesForSession(candidateSearch);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [candidateSearch, addSessionModalOpen]);

  const loadMentorsForSession = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/mentors-list`, { withCredentials: true });
      setMentorsList(res.data.mentors || []);
    } catch (error) {
      console.error('Failed to load mentors:', error);
    }
  };

  const loadCandidatesForSession = async (search = '') => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/candidates-list?search=${encodeURIComponent(search)}`, { withCredentials: true });
      setCandidatesList(res.data.candidates || []);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    }
  };

  const handleCreateManualSession = async () => {
    // Basic validation
    if (!newSession.mentor_id || !newSession.candidate_id || !newSession.date || !newSession.time_slot) {
      alert('Please fill all required fields');
      return;
    }

    // Session type is required only for coaching sessions
    if (newSession.booking_type === 'coaching' && !newSession.session_type) {
      alert('Please select a session type for coaching sessions');
      return;
    }

    // Case type required for Case sessions
    if (newSession.booking_type === 'coaching' && newSession.session_type === 'Case session' && !newSession.case_type) {
      alert('Please select a case type for Case sessions');
      return;
    }

    setCreatingSession(true);
    try {
      const result = await axios.post(`${BACKEND_URL}/api/admin/coaching-sessions/manual`, newSession, { withCredentials: true });
      setAddSessionModalOpen(false);
      setNewSession({
        mentor_id: '',
        candidate_id: '',
        date: '',
        time_slot: '',
        session_type: '',
        case_type: '',
        admin_remarks: '',
        booking_type: 'coaching',
        deduct_credit: false
      });
      setCandidateSearch('');
      loadSessions();
      loadStats();
      const creditMsg = result.data.credit_deducted ? ' (Credit deducted from candidate)' : ' (No credit deducted)';
      alert('Session created successfully!' + creditMsg);
    } catch (error) {
      alert('Failed to create session: ' + (error.response?.data?.detail || error.message));
    } finally {
      setCreatingSession(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (debouncedFilters.status) params.append('status', debouncedFilters.status);
      if (debouncedFilters.mentor_id) params.append('mentor_id', debouncedFilters.mentor_id);
      if (debouncedFilters.date_from) params.append('date_from', debouncedFilters.date_from);
      if (debouncedFilters.date_to) params.append('date_to', debouncedFilters.date_to);
      if (debouncedFilters.search) params.append('search', debouncedFilters.search);
      if (debouncedFilters.booking_type) params.append('booking_type', debouncedFilters.booking_type);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions?${params}`, { withCredentials: true });
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
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/${session.id}`, { withCredentials: true });
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
        `${BACKEND_URL}/api/admin/coaching-sessions/${selectedSession.id}/update-status`,
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

  // Delete feedback handlers
  const openDeleteFeedbackModal = (type) => {
    setDeleteFeedbackType(type);
    setDeleteFeedbackModalOpen(true);
  };

  const handleDeleteFeedback = async () => {
    if (!sessionDetails || !deleteFeedbackType) return;
    
    setDeletingFeedback(true);
    try {
      const endpoint = deleteFeedbackType === 'mentor' 
        ? `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}/mentor-feedback`
        : `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}/candidate-feedback`;
      
      await axios.delete(endpoint, { withCredentials: true });
      
      alert(deleteFeedbackType === 'mentor' 
        ? 'Mentor feedback deleted successfully. Payout is now on hold.'
        : 'Candidate feedback deleted successfully. Candidate will see feedback prompt on next login.');
      
      setDeleteFeedbackModalOpen(false);
      setDeleteFeedbackType(null);
      
      // Refresh session details
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}`,
        { withCredentials: true }
      );
      setSessionDetails(res.data);
      
      // Refresh sessions list
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to delete feedback: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeletingFeedback(false);
    }
  };

  const clearFilters = () => {
    setFilters({ status: '', mentor_id: '', date_from: '', date_to: '', search: '', booking_type: '' });
    setQuickDateFilter('');
    setPage(1);
  };

  // Quick date filter helper
  const applyQuickDateFilter = (filterType) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    let dateFrom = '';
    let dateTo = '';
    
    if (filterType === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      dateFrom = formatDate(yesterday);
      dateTo = formatDate(yesterday);
    } else if (filterType === 'today') {
      dateFrom = formatDate(today);
      dateTo = formatDate(today);
    } else if (filterType === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFrom = formatDate(tomorrow);
      dateTo = formatDate(tomorrow);
    } else if (filterType === 'this_week') {
      // Monday to Sunday of current week
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + diffToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      dateFrom = formatDate(startOfWeek);
      dateTo = formatDate(endOfWeek);
    } else if (filterType === 'last_week') {
      // Monday to Sunday of last week
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + diffToMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      dateFrom = formatDate(lastMonday);
      dateTo = formatDate(lastSunday);
    }
    
    setQuickDateFilter(filterType);
    setFilters(f => ({ ...f, date_from: dateFrom, date_to: dateTo }));
    setPage(1);
  };

  const getStatusBadge = (status, session = null) => {
    const statusStyles = {
      'confirmed': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'mentor_no_show': 'bg-red-100 text-red-700',
      'candidate_no_show': 'bg-orange-100 text-orange-700',
      'both_no_show': 'bg-red-200 text-red-800',
      'mentor_cancelled': 'bg-slate-100 text-slate-700',
      'candidate_cancelled': 'bg-slate-100 text-slate-700',
      'admin_cancelled': 'bg-red-100 text-red-700',
      'mentor_rescheduled': 'bg-purple-100 text-purple-700',
      'candidate_rescheduled': 'bg-purple-100 text-purple-700',
      'admin_rescheduled': 'bg-indigo-100 text-indigo-700',
      // Legacy statuses for backward compatibility
      'pending': 'bg-amber-100 text-amber-700',
      'cancelled': 'bg-slate-100 text-slate-700',
      'cancelled_by_candidate': 'bg-slate-100 text-slate-700',
      'cancelled_by_mentor': 'bg-slate-100 text-slate-700',
      'cancelled_by_admin': 'bg-red-100 text-red-700',
      'no_show': 'bg-red-100 text-red-700',
      'rescheduled': 'bg-purple-100 text-purple-700',
    };
    
    const statusLabels = {
      'confirmed': 'Confirmed',
      'completed': 'Completed',
      'mentor_no_show': 'Mentor No Show',
      'candidate_no_show': 'Candidate No Show',
      'both_no_show': 'Both No Show',
      'mentor_cancelled': 'Mentor Cancelled',
      'candidate_cancelled': 'Candidate Cancelled',
      'admin_cancelled': 'Admin Cancelled',
      'mentor_rescheduled': 'Mentor Rescheduled',
      'candidate_rescheduled': 'Candidate Rescheduled',
      'admin_rescheduled': 'Admin Rescheduled',
      // Legacy
      'pending': 'Pending',
      'cancelled': 'Cancelled',
      'no_show': 'No Show',
      'rescheduled': 'Rescheduled',
    };
    
    // Special handling for legacy rescheduled status - show who rescheduled
    if (status === 'rescheduled' && session) {
      const byWhom = session.rescheduled_by_name || session.rescheduled_by || 'someone';
      return (
        <span 
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles['rescheduled']}`}
          title={`Rescheduled to ${session.rescheduled_to_date} at ${session.rescheduled_to_time}`}
        >
          Rescheduled by {byWhom}
        </span>
      );
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
        {statusLabels[status] || status?.replace(/_/g, ' ')}
      </span>
    );
  };

  const handleExportExcel = async () => {
    try {
      // Build query params from current filters
      const params = new URLSearchParams();
      if (debouncedFilters.status) params.append('status', debouncedFilters.status);
      if (debouncedFilters.mentor_id) params.append('mentor_id', debouncedFilters.mentor_id);
      if (debouncedFilters.date_from) params.append('date_from', debouncedFilters.date_from);
      if (debouncedFilters.date_to) params.append('date_to', debouncedFilters.date_to);
      if (debouncedFilters.search) params.append('search', debouncedFilters.search);
      if (debouncedFilters.booking_type) params.append('booking_type', debouncedFilters.booking_type);
      
      const queryString = params.toString();
      const url = `${BACKEND_URL}/api/admin/coaching-sessions/export-excel${queryString ? '?' + queryString : ''}`;
      
      const response = await axios.get(url, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Include filter info in filename if filters are applied
      const hasFilters = debouncedFilters.status || debouncedFilters.date_from || debouncedFilters.date_to || debouncedFilters.mentor_id;
      const filterSuffix = hasFilters ? '_filtered' : '_all';
      link.download = `coaching_sessions${filterSuffix}_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
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
    <div className="space-y-6" data-testid="coaching-sessions-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coaching Sessions Tracking</h1>
          <p className="text-sm text-slate-500">Monitor all sessions in real-time (Coaching: 45 min, Strategy: 30 min)</p>
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
          <Button onClick={() => setAddSessionModalOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Session
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

      {/* Recording Health Check */}
      <RecordingHealthCheck />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            <p className="text-sm text-amber-600">Confirmed</p>
            <p className="text-2xl font-bold text-amber-700">{stats.by_status?.confirmed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <p className="text-sm text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-700">{stats.by_status?.completed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50">
            <p className="text-sm text-red-600">No Show</p>
            <p className="text-2xl font-bold text-red-700">{stats.by_status?.no_show || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Search & Filters</span>
        </div>
        
        {/* Quick Date Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-slate-500 mr-2">Quick Filters:</span>
          <Button 
            variant={quickDateFilter === 'yesterday' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('yesterday')}
            className="h-7 text-xs"
          >
            Yesterday
          </Button>
          <Button 
            variant={quickDateFilter === 'today' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('today')}
            className="h-7 text-xs"
          >
            Today
          </Button>
          <Button 
            variant={quickDateFilter === 'tomorrow' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('tomorrow')}
            className="h-7 text-xs"
          >
            Tomorrow
          </Button>
          <Button 
            variant={quickDateFilter === 'this_week' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('this_week')}
            className="h-7 text-xs"
          >
            This Week
          </Button>
          <Button 
            variant={quickDateFilter === 'last_week' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('last_week')}
            className="h-7 text-xs"
          >
            Last Week
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
              data-testid="coaching-filter-search"
            />
          </div>

          <Select value={filters.status || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, status: v === 'all' ? '' : v })); setPage(1); }}>
            <SelectTrigger data-testid="coaching-filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="mentor_no_show">Mentor No Show</SelectItem>
              <SelectItem value="candidate_no_show">Candidate No Show</SelectItem>
              <SelectItem value="both_no_show">Both No Show</SelectItem>
              <SelectItem value="mentor_cancelled">Mentor Cancelled</SelectItem>
              <SelectItem value="candidate_cancelled">Candidate Cancelled</SelectItem>
              <SelectItem value="mentor_rescheduled">Mentor Rescheduled</SelectItem>
              <SelectItem value="candidate_rescheduled">Candidate Rescheduled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.booking_type || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, booking_type: v === 'all' ? '' : v })); setPage(1); }}>
            <SelectTrigger data-testid="coaching-filter-booking-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Session Types</SelectItem>
              <SelectItem value="coaching">Coaching Sessions</SelectItem>
              <SelectItem value="strategy_call">Strategy Calls</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.mentor_id || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, mentor_id: v === 'all' ? '' : v })); setPage(1); }}>
            <SelectTrigger data-testid="coaching-filter-mentor">
              <SelectValue placeholder="All Mentors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mentors</SelectItem>
              {stats?.mentors?.map(mentor => (
                <SelectItem key={mentor.id} value={mentor.id}>{mentor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => { setFilters(f => ({ ...f, date_from: e.target.value })); setQuickDateFilter(''); }}
            placeholder="From Date"
            data-testid="coaching-filter-date-from"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => { setFilters(f => ({ ...f, date_to: e.target.value })); setQuickDateFilter(''); }}
            placeholder="To Date"
            data-testid="coaching-filter-date-to"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Sessions Table.
          Table layout note: 10 separate columns made the page require
          horizontal scroll on most laptops. We merged related fields
          (Mentor + check-in into one cell, Candidate + check-in into
          one cell, both feedbacks into a single Feedback cell) so the
          table fits 1280-1440px wide screens without scrolling.   */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Candidate</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Feedback</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Recording</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {filters.search ? `No sessions found for "${filters.search}"` : 'No sessions found'}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 align-top" data-testid={`coaching-session-row-${session.id}`}>
                    <td className="px-3 py-3" data-testid={`coaching-session-times-${session.id}`}>
                      {(() => {
                        const ist = `${session.time_slot || ''}`;
                        const mentorTz = session.mentor_timezone || 'Asia/Kolkata';
                        const candTz = session.candidate_timezone || 'Asia/Kolkata';
                        const istConv = { date: session.date, time: ist };
                        const mentorConv = istToViewer(session.date, ist, mentorTz);
                        const candConv = istToViewer(session.date, ist, candTz);
                        const Row = ({ label, time, tz, dateStr, highlight }) => (
                          <div className={`flex items-baseline gap-1.5 text-xs ${highlight ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                            <span className="w-14 shrink-0 uppercase tracking-wide" style={{ fontSize: '10px', color: highlight ? '#1e40af' : '#64748b' }}>{label}</span>
                            <span>{time ? format12hWithAbbr(time, tz) : '—'}</span>
                            {dateStr && dateStr !== session.date && (
                              <span className="text-[10px] text-amber-600">({dateStr})</span>
                            )}
                          </div>
                        );
                        return (
                          <div className="space-y-0.5 min-w-[150px]">
                            <p className="font-medium text-slate-900 text-sm mb-0.5">{session.date}</p>
                            <Row label="Mentor" time={mentorConv.time} tz={mentorTz} dateStr={mentorConv.date} />
                            <Row label="Candid." time={candConv.time} tz={candTz} dateStr={candConv.date} />
                            <Row label="IST" time={istConv.time} tz="Asia/Kolkata" dateStr={istConv.date} highlight />
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          session.booking_type === 'strategy_call' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {session.booking_type === 'strategy_call' ? 'Strategy Call' : (session.session_type || 'Coaching')}
                        </span>
                        {session.case_type && (
                          <p className="text-xs text-purple-600 font-medium">{session.case_type}</p>
                        )}
                      </div>
                    </td>
                    {/* Mentor cell: photo + name + email + check-in stacked */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2 min-w-[160px]">
                        <img 
                          src={session.mentor_picture || `https://ui-avatars.com/api/?name=${session.mentor_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{session.mentor_name}</p>
                          <p className="text-xs text-slate-500 truncate">{session.mentor_email}</p>
                          {session.mentor_checked_in ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-700 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Joined{session.mentor_checked_in_at && (
                                <> {new Date(session.mentor_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 mt-0.5">Not joined</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Candidate cell: same layout as Mentor */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2 min-w-[160px]">
                        <img 
                          src={session.candidate_picture || `https://ui-avatars.com/api/?name=${session.candidate_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{session.candidate_name}</p>
                          <p className="text-xs text-slate-500 truncate">{session.candidate_email}</p>
                          {session.candidate_plan && (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded mt-0.5">
                              {session.candidate_plan.replace('_', ' ')}
                            </span>
                          )}
                          {session.candidate_checked_in ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-700 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Joined{session.candidate_checked_in_at && (
                                <> {new Date(session.candidate_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 mt-0.5 block">Not joined</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {getStatusBadge(session.status, session)}
                      {session.completion_status && (
                        <p className="text-xs text-slate-500 mt-1">{session.completion_status}</p>
                      )}
                    </td>
                    {/* Feedback cell — combined mentor + candidate */}
                    <td className="px-3 py-3">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-14">Mentor:</span>
                          {session.mentor_feedback_given ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {session.mentor_feedback_rating && (
                                <>
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {session.mentor_feedback_rating}
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-14">Candid.:</span>
                          {session.candidate_feedback_given ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {session.candidate_feedback_rating && (
                                <>
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {session.candidate_feedback_rating}
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Recording / transcript links — populated by the
                        background scheduler (every 30 min) or by the
                        admin "Sync recording" button in the details
                        modal. Empty until artifacts are produced. */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        {session.recording_url ? (
                          <a
                            href={session.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            data-testid={`recording-link-${session.id}`}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Recording
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {session.transcript_url && (
                          <a
                            href={session.transcript_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            data-testid={`transcript-link-${session.id}`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Transcript
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(session)}
                          data-testid={`view-coaching-session-${session.id}`}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatusModal(session)}
                          data-testid={`edit-coaching-session-${session.id}`}
                          title="Update Status"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
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

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coaching Session Details</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Reschedule Alert - For original session that was rescheduled */}
              {sessionDetails.session?.status === 'rescheduled' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-medium text-purple-700">📅 This session was rescheduled to a new date</p>
                  <p className="text-xs text-purple-600 mt-1">
                    New session: {sessionDetails.session?.rescheduled_to_date} at {sessionDetails.session?.rescheduled_to_time}
                  </p>
                  <p className="text-xs text-purple-600">
                    By: {sessionDetails.session?.rescheduled_by_name || sessionDetails.session?.rescheduled_by || 'Unknown'}
                  </p>
                  {sessionDetails.session?.rescheduled_at && (
                    <p className="text-xs text-purple-500 mt-1">
                      {new Date(sessionDetails.session?.rescheduled_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              
              {/* Reschedule Info - For new session that came from reschedule */}
              {sessionDetails.session?.rescheduled_from_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">📅 This session was created from a reschedule</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Originally: {sessionDetails.session?.rescheduled_from_date} at {sessionDetails.session?.rescheduled_from_time}
                  </p>
                </div>
              )}
              
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Date & Time</h4>
                  {(() => {
                    const s = sessionDetails.session || {};
                    const ist = s.time_slot || '';
                    const mentorTz = s.mentor_timezone || 'Asia/Kolkata';
                    const candTz = s.candidate_timezone || 'Asia/Kolkata';
                    const mentorConv = istToViewer(s.date, ist, mentorTz);
                    const candConv = istToViewer(s.date, ist, candTz);
                    return (
                      <div className="space-y-0.5">
                        <p className="text-slate-900 font-medium">{s.date}</p>
                        <p className="text-xs text-slate-600">
                          <span className="inline-block w-20 uppercase tracking-wide" style={{ fontSize: '10px', color: '#64748b' }}>Mentor</span>
                          {ist ? format12hWithAbbr(mentorConv.time, mentorTz) : '—'}
                          {mentorConv.date !== s.date && <span className="ml-1 text-amber-600">({mentorConv.date})</span>}
                        </p>
                        <p className="text-xs text-slate-600">
                          <span className="inline-block w-20 uppercase tracking-wide" style={{ fontSize: '10px', color: '#64748b' }}>Candidate</span>
                          {ist ? format12hWithAbbr(candConv.time, candTz) : '—'}
                          {candConv.date !== s.date && <span className="ml-1 text-amber-600">({candConv.date})</span>}
                        </p>
                        <p className="text-xs font-semibold text-blue-700">
                          <span className="inline-block w-20 uppercase tracking-wide" style={{ fontSize: '10px', color: '#1e40af' }}>IST</span>
                          {ist ? format12hWithAbbr(ist, 'Asia/Kolkata') : '—'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Status</h4>
                  {getStatusBadge(sessionDetails.session?.status, sessionDetails.session)}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Session Type</h4>
                  <p className="text-slate-900">{sessionDetails.session?.session_type || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Completion Status</h4>
                  <p className="text-slate-900">{sessionDetails.session?.completion_status || 'N/A'}</p>
                </div>
              </div>

              {/* Mentor Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Mentor</h4>
                <div className="flex items-center gap-3">
                  <img 
                    src={sessionDetails.mentor?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.mentor?.name}&background=random`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{sessionDetails.mentor?.name}</p>
                    <p className="text-sm text-slate-500">{sessionDetails.mentor?.email}</p>
                    <p className="text-xs text-slate-400">{sessionDetails.mentor?.title} at {sessionDetails.mentor?.company}</p>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className={sessionDetails.session?.mentor_checked_in ? 'text-green-600' : 'text-slate-400'}>
                    {sessionDetails.session?.mentor_checked_in 
                      ? `✓ Checked in at ${new Date(sessionDetails.session?.mentor_checked_in_at).toLocaleString()}`
                      : '✗ Not checked in'}
                  </span>
                </div>
              </div>

              {/* Candidate Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Candidate</h4>
                <div className="flex items-center gap-3">
                  <img 
                    src={sessionDetails.candidate?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.candidate?.name}&background=random`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{sessionDetails.candidate?.name}</p>
                    <p className="text-sm text-slate-500">{sessionDetails.candidate?.email}</p>
                    {sessionDetails.candidate?.plan && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {sessionDetails.candidate?.plan.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className={sessionDetails.session?.candidate_checked_in ? 'text-green-600' : 'text-slate-400'}>
                    {sessionDetails.session?.candidate_checked_in 
                      ? `✓ Checked in at ${new Date(sessionDetails.session?.candidate_checked_in_at).toLocaleString()}`
                      : '✗ Not checked in'}
                  </span>
                </div>
              </div>

              {/* Recording / transcript section.
                  Pulls from booking.recording_url + booking.transcript_url.
                  The Sync button fires the admin-only
                  /api/admin/coaching-sessions/{id}/sync-recording
                  endpoint, which queries Google's Meet REST API for the
                  latest artifact URLs and writes them back. Useful when
                  the admin needs the recording immediately, before the
                  next 30-min scheduler cycle.                          */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700">Recording &amp; Transcript</h4>
                  {sessionDetails.session?.meet_space_name && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setSyncingRecording(true);
                          const res = await axios.post(
                            `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}/sync-recording`,
                            {},
                            { withCredentials: true },
                          );
                          // Patch the in-modal state so the new URLs render immediately
                          setSessionDetails((prev) => ({
                            ...prev,
                            session: {
                              ...prev.session,
                              recording_url: res.data?.recording_url || prev.session?.recording_url,
                              transcript_url: res.data?.transcript_url || prev.session?.transcript_url,
                              meet_artifacts_checked_at: res.data?.checked_at || prev.session?.meet_artifacts_checked_at,
                            },
                          }));
                          if (!res.data?.recording_url && !res.data?.transcript_url) {
                            alert('No recording is available yet — Google may still be processing the meeting. Try again in a few minutes.');
                          }
                        } catch (err) {
                          alert(`Sync failed: ${err?.response?.data?.detail || err.message}`);
                        } finally {
                          setSyncingRecording(false);
                        }
                      }}
                      disabled={syncingRecording}
                      data-testid={`sync-recording-${sessionDetails.session?.id}`}
                    >
                      {syncingRecording ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Syncing…</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync now</>
                      )}
                    </Button>
                  )}
                </div>
                {sessionDetails.session?.recording_url || sessionDetails.session?.transcript_url ? (
                  <div className="space-y-2">
                    {sessionDetails.session?.recording_url && (
                      <a
                        href={sessionDetails.session.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <PlayCircle className="w-4 h-4" />
                        View recording on Google Drive
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {sessionDetails.session?.transcript_url && (
                      <a
                        href={sessionDetails.session.transcript_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        View transcript on Google Docs
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {sessionDetails.session?.meet_artifacts_checked_at && (
                      <p className="text-xs text-slate-400">
                        Last checked: {new Date(sessionDetails.session.meet_artifacts_checked_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : sessionDetails.session?.meet_space_name ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">
                      No recording is available yet. Google generates artifacts a few minutes after the call ends — the system polls every 10 min and will move it to the Shared Drive folder automatically. Or click "Sync now" above to fetch immediately.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-slate-600 hover:text-slate-900"
                        onClick={async () => {
                          try {
                            const res = await axios.get(
                              `${BACKEND_URL}/api/admin/recordings/diagnose/${sessionDetails.session.id}`,
                              { withCredentials: true },
                            );
                            alert(
                              'Diagnosis: ' + (res.data.diagnosis || 'No diagnosis available') +
                              '\n\nMeet space: ' + (res.data.meet_space_name || '(none)') +
                              '\nLast checked: ' + (res.data.meet_artifacts_checked_at || 'never') +
                              '\nDrive moved: ' + (res.data.recording_drive_moved ? 'yes' : 'no') +
                              '\nLive Meet API found ' + ((res.data.live_artifacts?.recordings || []).length) + ' recording(s)'
                            );
                            console.log('Recording diagnose result:', res.data);
                          } catch (err) {
                            alert(`Diagnose failed: ${err?.response?.data?.detail || err.message}`);
                          }
                        }}
                        data-testid={`diagnose-recording-${sessionDetails.session?.id}`}
                      >
                        <Activity className="w-3 h-3 mr-1" />
                        Diagnose
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-blue-600 hover:text-blue-900"
                        onClick={() => {
                          setManualRecordingUrl(sessionDetails.session?.recording_url || '');
                          setManualTranscriptUrl(sessionDetails.session?.transcript_url || '');
                          setSetRecordingModalOpen(true);
                        }}
                      >
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Set manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-400 mb-3">
                      No recording linked yet. You can manually paste the Google Drive recording link (e.g. from kashish@gradnext.co's Drive).
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs"
                      onClick={() => {
                        setManualRecordingUrl(sessionDetails.session?.recording_url || '');
                        setManualTranscriptUrl(sessionDetails.session?.transcript_url || '');
                        setSetRecordingModalOpen(true);
                      }}
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                      Set recording URL manually
                    </Button>
                  </div>
                )}
              </div>

              {/* Mentor Feedback */}
              {sessionDetails.mentor_feedback && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-700">Mentor Feedback</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openDeleteFeedbackModal('mentor')}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Feedback
                    </Button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Overall Rating:</strong> {sessionDetails.mentor_feedback.rating_overall}/5</p>
                    {sessionDetails.mentor_feedback.qualitative_feedback && (
                      <p className="text-sm"><strong>Notes:</strong> {sessionDetails.mentor_feedback.qualitative_feedback}</p>
                    )}
                    {sessionDetails.mentor_feedback.areas_of_strength && (
                      <p className="text-sm"><strong>Strengths:</strong> {sessionDetails.mentor_feedback.areas_of_strength.join(', ')}</p>
                    )}
                    {sessionDetails.mentor_feedback.areas_of_improvement && (
                      <p className="text-sm"><strong>Areas to Improve:</strong> {sessionDetails.mentor_feedback.areas_of_improvement.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Candidate Feedback */}
              {sessionDetails.candidate_feedback && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-700">Candidate Feedback</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openDeleteFeedbackModal('candidate')}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Feedback
                    </Button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Rating:</strong> {sessionDetails.candidate_feedback.rating_overall}/5</p>
                    {sessionDetails.candidate_feedback.comments && (
                      <p className="text-sm"><strong>Comments:</strong> {sessionDetails.candidate_feedback.comments}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-500">Failed to load session details</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Feedback Confirmation Modal */}
      <Dialog open={deleteFeedbackModalOpen} onOpenChange={setDeleteFeedbackModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete {deleteFeedbackType === 'mentor' ? 'Mentor' : 'Candidate'} Feedback</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this feedback? This action will:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {deleteFeedbackType === 'mentor' ? (
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Delete the mentor's feedback for this session</li>
                <li><strong>Put the payout on hold</strong> until new feedback is submitted</li>
                <li>Allow the mentor to submit feedback again</li>
                <li>Create an audit log of this deletion</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Delete the candidate's feedback for this session</li>
                <li>Allow the candidate to submit feedback again</li>
                <li>Candidate will see feedback prompt on next login</li>
                <li>Create an audit log of this deletion</li>
              </ul>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> The original feedback will be stored in the audit log for reference.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteFeedback}
              disabled={deletingFeedback}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingFeedback ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Recording URL Modal */}
      <Dialog open={setRecordingModalOpen} onOpenChange={(v) => { setSetRecordingModalOpen(v); if (!v) { setManualRecordingUrl(''); setManualTranscriptUrl(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-blue-600" />
              Set Recording URL
            </DialogTitle>
            <DialogDescription>
              Paste the Google Drive (or any) recording link for this session. Use this when the session was recorded manually or is in Kashish's Drive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Recording URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://drive.google.com/file/..."
                value={manualRecordingUrl}
                onChange={(e) => setManualRecordingUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Transcript URL <span className="text-xs text-slate-400">(optional)</span></label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://docs.google.com/..."
                value={manualTranscriptUrl}
                onChange={(e) => setManualTranscriptUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetRecordingModalOpen(false)}>Cancel</Button>
            <Button
              disabled={!manualRecordingUrl || savingRecordingUrl}
              onClick={async () => {
                if (!manualRecordingUrl) return;
                setSavingRecordingUrl(true);
                try {
                  await axios.patch(
                    `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails?.session?.id}/set-recording`,
                    { recording_url: manualRecordingUrl, transcript_url: manualTranscriptUrl || undefined },
                    { withCredentials: true },
                  );
                  setSessionDetails((prev) => ({
                    ...prev,
                    session: {
                      ...prev.session,
                      recording_url: manualRecordingUrl,
                      transcript_url: manualTranscriptUrl || prev.session?.transcript_url,
                      recording_set_manually: true,
                    },
                  }));
                  setSetRecordingModalOpen(false);
                  setManualRecordingUrl('');
                  setManualTranscriptUrl('');
                } catch (err) {
                  alert(`Failed to save: ${err?.response?.data?.detail || err.message}`);
                } finally {
                  setSavingRecordingUrl(false);
                }
              }}
            >
              {savingRecordingUrl ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save recording URL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Session Status</DialogTitle>
            <DialogDescription>
              Change status for session on {selectedSession?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="mentor_no_show">Mentor No Show</SelectItem>
                  <SelectItem value="candidate_no_show">Candidate No Show</SelectItem>
                  <SelectItem value="both_no_show">Both No Show</SelectItem>
                  <SelectItem value="mentor_cancelled">Mentor Cancelled</SelectItem>
                  <SelectItem value="candidate_cancelled">Candidate Cancelled</SelectItem>
                  <SelectItem value="admin_cancelled">Admin Cancelled</SelectItem>
                  <SelectItem value="mentor_rescheduled">Mentor Rescheduled</SelectItem>
                  <SelectItem value="candidate_rescheduled">Candidate Rescheduled</SelectItem>
                  <SelectItem value="admin_rescheduled">Admin Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
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

      {/* Add Manual Session Modal */}
      <Dialog open={addSessionModalOpen} onOpenChange={setAddSessionModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add Manual Session
            </DialogTitle>
            <DialogDescription>
              Create a coaching session manually. This will override mentor availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Session Type (Coaching vs Strategy Call) */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Session Category <span className="text-red-500">*</span></label>
              <Select value={newSession.booking_type} onValueChange={(v) => setNewSession(s => ({ ...s, booking_type: v }))}>
                <SelectTrigger data-testid="manual-booking-type">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coaching">Coaching Session</SelectItem>
                  <SelectItem value="strategy_call">Strategy Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mentor Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Mentor <span className="text-red-500">*</span></label>
              <Select value={newSession.mentor_id} onValueChange={(v) => setNewSession(s => ({ ...s, mentor_id: v }))}>
                <SelectTrigger data-testid="manual-mentor-select">
                  <SelectValue placeholder="Select a mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentorsList.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      <div className="flex items-center gap-2">
                        <span>{mentor.name}</span>
                        <span className="text-slate-400 text-xs">({mentor.firm})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Candidate Selection with Search */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Candidate <span className="text-red-500">*</span></label>
              <Input
                placeholder="Search candidate by name or email..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="mb-2"
                data-testid="manual-candidate-search"
              />
              <Select value={newSession.candidate_id} onValueChange={(v) => setNewSession(s => ({ ...s, candidate_id: v }))}>
                <SelectTrigger data-testid="manual-candidate-select">
                  <SelectValue placeholder="Select a candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidatesList.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      <div className="flex items-center gap-2">
                        <span>{candidate.name}</span>
                        <span className="text-slate-400 text-xs">({candidate.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Date <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession(s => ({ ...s, date: e.target.value }))}
                  data-testid="manual-session-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Time <span className="text-red-500">*</span></label>
                <Input
                  type="time"
                  value={newSession.time_slot}
                  onChange={(e) => setNewSession(s => ({ ...s, time_slot: e.target.value }))}
                  data-testid="manual-session-time"
                />
              </div>
            </div>

            {/* Session Type - Only for Coaching Sessions */}
            {newSession.booking_type === 'coaching' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Session Type <span className="text-red-500">*</span></label>
                <Select value={newSession.session_type} onValueChange={(v) => setNewSession(s => ({ ...s, session_type: v, case_type: '' }))}>
                  <SelectTrigger data-testid="manual-session-type">
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Case session">Case Session</SelectItem>
                    <SelectItem value="Fit Interview">Fit Interview</SelectItem>
                    <SelectItem value="PEI session">PEI Session</SelectItem>
                    <SelectItem value="CV review session">CV Review Session</SelectItem>
                    <SelectItem value="General discussion">General Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Case Type (only for Case sessions within Coaching) */}
            {newSession.booking_type === 'coaching' && newSession.session_type === 'Case session' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Case Type <span className="text-red-500">*</span></label>
                <Select value={newSession.case_type} onValueChange={(v) => setNewSession(s => ({ ...s, case_type: v }))}>
                  <SelectTrigger data-testid="manual-case-type">
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Random">Random</SelectItem>
                    <SelectItem value="Profitability">Profitability</SelectItem>
                    <SelectItem value="Market Entry">Market Entry</SelectItem>
                    <SelectItem value="Guesstimate">Guesstimate</SelectItem>
                    <SelectItem value="Pricing">Pricing</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="M&A">M&A</SelectItem>
                    <SelectItem value="Unconventional">Unconventional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Admin Remarks */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Admin Remarks (Optional)</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                value={newSession.admin_remarks}
                onChange={(e) => setNewSession(s => ({ ...s, admin_remarks: e.target.value }))}
                placeholder="Add any notes about this session..."
                data-testid="manual-admin-remarks"
              />
            </div>

            {/* Deduct Credit Checkbox - Only for coaching sessions */}
            {newSession.booking_type === 'coaching' && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="deduct-credit"
                  checked={newSession.deduct_credit}
                  onChange={(e) => setNewSession(s => ({ ...s, deduct_credit: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  data-testid="manual-deduct-credit"
                />
                <label htmlFor="deduct-credit" className="text-sm text-blue-800">
                  <span className="font-medium">Deduct session credit from candidate</span>
                  <p className="text-xs text-blue-600 mt-0.5">
                    If checked, this will count against the candidate's coaching session quota
                  </p>
                </label>
              </div>
            )}

            {/* Info Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium">Note:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                <li>This session will bypass mentor availability checks</li>
                <li>Calendar invites will be sent to both mentor and candidate</li>
                <li>Session duration: <strong>{newSession.booking_type === 'coaching' ? '45 minutes' : '30 minutes'}</strong></li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSessionModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateManualSession} 
              disabled={creatingSession}
              className="bg-green-600 hover:bg-green-700"
            >
              {creatingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachingSessionsSection;
