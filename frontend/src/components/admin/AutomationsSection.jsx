import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Mail, Play, Pause, RefreshCw, ChevronDown, ChevronRight, 
  CheckCircle2, XCircle, Clock, Zap, AlertCircle, Loader2, Info, Bell
} from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AutomationsSection = () => {
  const [automations, setAutomations] = useState([]);
  const [resendTemplates, setResendTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [expandedAuto, setExpandedAuto] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [editDays, setEditDays] = useState(null);
  const [editIntervals, setEditIntervals] = useState(null);  // For cart abandonment
  const [hasChanges, setHasChanges] = useState(false);
  
  // Workshop Reminders State
  const [workshopReminders, setWorkshopReminders] = useState({
    enabled: false,
    reminder_24h_template_id: null,
    reminder_24h_template_name: null,
    reminder_1h_template_id: null,
    reminder_1h_template_name: null
  });
  const [savingWorkshopReminders, setSavingWorkshopReminders] = useState(false);

  // Session Reminders State
  const [sessionReminders, setSessionReminders] = useState({
    enabled: false,
    reminder_24h_template_id: null,
    reminder_24h_template_name: null,
    reminder_1h_template_id: null,
    reminder_1h_template_name: null,
    reminder_10min_template_id: null,
    reminder_10min_template_name: null
  });
  const [savingSessionReminders, setSavingSessionReminders] = useState(false);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/automations`, { withCredentials: true });
      setAutomations(res.data.automations || []);
      if (res.data.automations?.length > 0 && !expandedAuto) {
        setExpandedAuto(res.data.automations[0].id);
        setEditDays(res.data.automations[0].days || []);
      }
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    } finally {
      setLoading(false);
    }
  }, [expandedAuto]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/automations/resend-templates`, { withCredentials: true });
      setResendTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch Resend templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchWorkshopReminders = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/automations/workshop-reminders/config`, { withCredentials: true });
      setWorkshopReminders(res.data);
    } catch (err) {
      console.error('Failed to fetch workshop reminders config:', err);
    }
  }, []);

  const fetchSessionReminders = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/automations/session-reminders/config`, { withCredentials: true });
      setSessionReminders(res.data);
    } catch (err) {
      console.error('Failed to fetch session reminders config:', err);
    }
  }, []);

  useEffect(() => { 
    fetchAutomations(); 
    fetchTemplates(); 
    fetchWorkshopReminders();
    fetchSessionReminders();
  }, [fetchAutomations, fetchTemplates, fetchWorkshopReminders, fetchSessionReminders]);

  const handleToggle = async (autoId) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/automations/${autoId}/toggle`, {}, { withCredentials: true });
      setAutomations(prev => prev.map(a => a.id === autoId ? { ...a, enabled: res.data.enabled } : a));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDayChange = (dayNum, field, value) => {
    setEditDays(prev => prev.map(d => {
      if (d.day !== dayNum) return d;
      const updated = { ...d, [field]: value };
      if (field === 'template_id') {
        const tmpl = resendTemplates.find(t => t.id === value);
        updated.template_name = tmpl?.name || '';
      }
      return updated;
    }));
    setHasChanges(true);
  };

  const handleIntervalChange = (intervalKey, field, value) => {
    setEditIntervals(prev => prev.map(i => {
      if (i.interval !== intervalKey) return i;
      const updated = { ...i, [field]: value };
      if (field === 'template_id') {
        const tmpl = resendTemplates.find(t => t.id === value);
        updated.template_name = tmpl?.name || '';
      }
      return updated;
    }));
    setHasChanges(true);
  };

  const handleSave = async (autoId) => {
    setSaving(true);
    try {
      const auto = automations.find(a => a.id === autoId);
      const payload = auto?.intervals ? { intervals: editIntervals } : { days: editDays };
      await axios.put(`${BACKEND_URL}/api/admin/automations/${autoId}`, payload, { withCredentials: true });
      setHasChanges(false);
      fetchAutomations();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkshopReminders = async (config) => {
    setSavingWorkshopReminders(true);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/automations/workshop-reminders/config`, config, { withCredentials: true });
      alert('✅ Workshop reminder settings saved successfully!');
      fetchWorkshopReminders();
    } catch (err) {
      alert('Failed to save workshop reminders: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingWorkshopReminders(false);
    }
  };

  const handleSaveSessionReminders = async (config) => {
    setSavingSessionReminders(true);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/automations/session-reminders/config`, config, { withCredentials: true });
      alert('✅ Session reminder settings saved successfully!');
      fetchSessionReminders();
    } catch (err) {
      alert('Failed to save session reminders: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingSessionReminders(false);
    }
  };

  const handleRunNow = async (autoId) => {
    setRunning(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/automations/${autoId}/run-now`, {}, { withCredentials: true });
      const r = res.data.result || {};
      alert(`Run complete!\nChecked: ${r.checked || 0}\nSent: ${r.sent || 0}\nSkipped (upgraded): ${r.skipped_upgraded || 0}\nSkipped (already sent): ${r.skipped_already_sent || 0}\nFailed: ${r.failed || 0}`);
      fetchAutomations();
    } catch (err) {
      alert('Run failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRunning(false);
    }
  };

  const handleViewLogs = async (autoId) => {
    setLogsOpen(!logsOpen);
    if (!logsOpen) {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/admin/automations/${autoId}/logs?limit=30`, { withCredentials: true });
        setLogs(res.data.logs || []);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="automations-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Email Automations</h2>
          <p className="text-sm text-slate-500 mt-1">Configure automated email sequences triggered by user lifecycle events</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={templatesLoading} data-testid="refresh-templates-btn">
          <RefreshCw className={`w-4 h-4 mr-2 ${templatesLoading ? 'animate-spin' : ''}`} />
          Refresh Templates
        </Button>
      </div>

      {/* Resend templates info */}
      {resendTemplates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            <strong>{resendTemplates.length} Resend template{resendTemplates.length !== 1 ? 's' : ''}</strong> detected: {resendTemplates.map(t => t.name).join(', ')}
          </p>
        </div>
      )}
      {resendTemplates.length === 0 && !templatesLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            No Resend templates found. Create templates at <a href="https://resend.com/templates" target="_blank" rel="noreferrer" className="underline font-medium">resend.com/templates</a> and they'll appear here automatically.
          </p>
        </div>
      )}

      {/* Automation Cards */}
      {automations.map(auto => (
        <div key={auto.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" data-testid={`automation-${auto.id}`}>
          {/* Automation Header */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => {
              setExpandedAuto(expandedAuto === auto.id ? null : auto.id);
              if (expandedAuto !== auto.id) {
                setEditDays(auto.days || []);
                setEditIntervals(auto.intervals || []);
              }
              setHasChanges(false);
            }}>
              {expandedAuto === auto.id ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: auto.id === 'cart-abandonment' ? '#fef3c7' : 'var(--gn-periwinkle-lighter, #e8ecff)' }}>
                <Mail className="w-5 h-5" style={{ color: auto.id === 'cart-abandonment' ? '#d97706' : 'var(--gn-periwinkle, #8C9DFF)' }} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{auto.name}</h3>
                <p className="text-xs text-slate-500">{auto.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{auto.stats?.total_sent || 0} sent</span>
                <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-400" />{auto.stats?.total_failed || 0} failed</span>
              </div>
              {/* Enable/Disable */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${auto.enabled ? 'text-green-600' : 'text-slate-400'}`}>
                  {auto.enabled ? 'Active' : 'Inactive'}
                </span>
                <Switch
                  checked={auto.enabled}
                  onCheckedChange={() => handleToggle(auto.id)}
                  data-testid={`toggle-${auto.id}`}
                />
              </div>
            </div>
          </div>

          {/* Expanded Content - Days (for trial automation) */}
          {expandedAuto === auto.id && auto.days && editDays && (
            <div className="border-t border-slate-100 p-5 space-y-4">
              {/* Day-by-day configuration */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Email Sequence Configuration</h4>
                <div className="grid gap-3">
                  {editDays.map(day => (
                    <div key={day.day} className={`flex items-center gap-3 p-3 rounded-lg border ${day.enabled && day.template_id ? 'border-green-200 bg-green-50/50' : 'border-slate-100 bg-slate-50/50'}`} data-testid={`day-${day.day}-config`}>
                      {/* Day number */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${day.enabled && day.template_id ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                        {day.day}
                      </div>

                      {/* Enable toggle */}
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(val) => handleDayChange(day.day, 'enabled', val)}
                        data-testid={`day-${day.day}-toggle`}
                      />

                      {/* Template dropdown */}
                      <select
                        className="flex-1 text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={day.template_id || ''}
                        onChange={(e) => handleDayChange(day.day, 'template_id', e.target.value || null)}
                        disabled={!day.enabled}
                        data-testid={`day-${day.day}-template`}
                      >
                        <option value="">Select Resend template...</option>
                        {resendTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>

                      {/* Template name hint */}
                      {day.template_name && day.enabled && (
                        <span className="text-xs text-slate-400 shrink-0 max-w-[120px] truncate">{day.template_name}</span>
                      )}

                      {/* Status indicator */}
                      {day.enabled && day.template_id ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(auto.id)}
                    disabled={!hasChanges || saving}
                    data-testid="save-automation-btn"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunNow(auto.id)}
                    disabled={running}
                    data-testid="run-now-btn"
                  >
                    {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    {running ? 'Running...' : 'Run Now'}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewLogs(auto.id)}
                  data-testid="view-logs-btn"
                >
                  {logsOpen ? 'Hide Logs' : 'View Logs'}
                </Button>
              </div>

              {/* Logs */}
              {logsOpen && (
                <div className="mt-4 border border-slate-100 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Recent Email Logs
                  </div>
                  {logs.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">No emails sent yet</div>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i} className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            {log.status === 'sent' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span className="font-medium text-slate-700 w-8">D{log.day}</span>
                            <span className="text-slate-600 flex-1 truncate">{log.user_email}</span>
                            <span className="text-slate-400 text-xs truncate max-w-[200px]">{log.template_name || log.template_id}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">
                              {log.sent_at ? new Date(log.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          {log.status === 'failed' && log.error && (
                            <p className="mt-1 ml-7 text-xs text-red-500 truncate" title={log.error}>{log.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Expanded Content - Intervals (for cart abandonment automation) */}
          {expandedAuto === auto.id && auto.intervals && editIntervals && (
            <div className="border-t border-slate-100 p-5 space-y-4">
              {/* Info box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800">
                  <strong>How it works:</strong> Recovery emails are sent to users who abandon subscription checkout. Uses coupon code <strong>WELCOME50</strong> (50% off first billing cycle). Only applies to subscription orders (not coaching sessions or top-ups).
                </div>
              </div>

              {/* Interval configuration */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Recovery Email Schedule</h4>
                <div className="grid gap-3">
                  {editIntervals.map(interval => (
                    <div key={interval.interval} className={`flex items-center gap-3 p-3 rounded-lg border ${interval.enabled && interval.template_id ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                      {/* Interval label */}
                      <div className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${interval.enabled && interval.template_id ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                        {interval.label || interval.interval}
                      </div>

                      {/* Enable toggle */}
                      <Switch
                        checked={interval.enabled}
                        onCheckedChange={(val) => handleIntervalChange(interval.interval, 'enabled', val)}
                      />

                      {/* Template dropdown */}
                      <select
                        className="flex-1 text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
                        value={interval.template_id || ''}
                        onChange={(e) => handleIntervalChange(interval.interval, 'template_id', e.target.value || null)}
                        disabled={!interval.enabled}
                      >
                        <option value="">Select Resend template...</option>
                        {resendTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>

                      {/* Template name hint */}
                      {interval.template_name && interval.enabled && (
                        <span className="text-xs text-slate-400 shrink-0 max-w-[120px] truncate">{interval.template_name}</span>
                      )}

                      {/* Status indicator */}
                      {interval.enabled && interval.template_id ? (
                        <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(auto.id)}
                    disabled={!hasChanges || saving}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunNow(auto.id)}
                    disabled={running}
                  >
                    {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    {running ? 'Running...' : 'Run Now'}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewLogs(auto.id)}
                >
                  {logsOpen ? 'Hide Logs' : 'View Logs'}
                </Button>
              </div>

              {/* Logs */}
              {logsOpen && (
                <div className="mt-4 border border-slate-100 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Recent Recovery Email Logs
                  </div>
                  {logs.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">No recovery emails sent yet</div>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i} className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            {log.status === 'sent' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span className="font-medium text-amber-700 w-12">{log.interval || log.day}</span>
                            <span className="text-slate-600 flex-1 truncate">{log.user_email}</span>
                            <span className="text-slate-400 text-xs truncate max-w-[200px]">{log.template_name || log.template_id}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">
                              {log.sent_at ? new Date(log.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          {log.status === 'failed' && log.error && (
                            <p className="mt-1 ml-7 text-xs text-red-500 truncate" title={log.error}>{log.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}



      {/* Session Reminders Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-50">
                <Bell className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Session Reminders (Coaching & Peer)</h3>
                <p className="text-xs text-slate-500">Automatic email reminders for coaching and peer practice sessions</p>
              </div>
            </div>
            <Switch 
              checked={sessionReminders.enabled} 
              onCheckedChange={async (checked) => {
                const updated = { ...sessionReminders, enabled: checked };
                setSessionReminders(updated);
                await handleSaveSessionReminders(updated);
              }}
            />
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2 mb-4">
            <Info className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div className="text-xs text-purple-800">
              <strong>How it works:</strong> Emails are sent automatically to both participants (mentor/partner & candidate) 24 hours, 1 hour, and 10 minutes before each confirmed session.
            </div>
          </div>

          {/* 24-Hour Reminder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">24-Hour Reminder Template</label>
            <select
              value={sessionReminders.reminder_24h_template_id || ''}
              onChange={(e) => {
                const template = resendTemplates.find(t => t.id === e.target.value);
                const updated = {
                  ...sessionReminders,
                  reminder_24h_template_id: e.target.value,
                  reminder_24h_template_name: template?.name || ''
                };
                setSessionReminders(updated);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={!sessionReminders.enabled}
            >
              <option value="">Select template for 24h reminder...</option>
              {resendTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {sessionReminders.reminder_24h_template_name && (
              <p className="text-xs text-slate-500">
                Selected: {sessionReminders.reminder_24h_template_name}
              </p>
            )}
          </div>

          {/* 1-Hour Reminder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">1-Hour Reminder Template</label>
            <select
              value={sessionReminders.reminder_1h_template_id || ''}
              onChange={(e) => {
                const template = resendTemplates.find(t => t.id === e.target.value);
                const updated = {
                  ...sessionReminders,
                  reminder_1h_template_id: e.target.value,
                  reminder_1h_template_name: template?.name || ''
                };
                setSessionReminders(updated);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={!sessionReminders.enabled}
            >
              <option value="">Select template for 1h reminder...</option>
              {resendTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {sessionReminders.reminder_1h_template_name && (
              <p className="text-xs text-slate-500">
                Selected: {sessionReminders.reminder_1h_template_name}
              </p>
            )}
          </div>

          {/* 10-Minute Reminder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">10-Minute Reminder Template</label>
            <select
              value={sessionReminders.reminder_10min_template_id || ''}
              onChange={(e) => {
                const template = resendTemplates.find(t => t.id === e.target.value);
                const updated = {
                  ...sessionReminders,
                  reminder_10min_template_id: e.target.value,
                  reminder_10min_template_name: template?.name || ''
                };
                setSessionReminders(updated);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={!sessionReminders.enabled}
            >
              <option value="">Select template for 10min reminder...</option>
              {resendTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {sessionReminders.reminder_10min_template_name && (
              <p className="text-xs text-slate-500">
                Selected: {sessionReminders.reminder_10min_template_name}
              </p>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={() => handleSaveSessionReminders(sessionReminders)}
            disabled={savingSessionReminders || !sessionReminders.enabled}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {savingSessionReminders ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Session Reminder Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Workshop Reminders Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Workshop Reminders</h3>
                <p className="text-xs text-slate-500">Automatic email reminders for registered workshop attendees</p>
              </div>
            </div>
            <Switch 
              checked={workshopReminders.enabled} 
              onCheckedChange={async (checked) => {
                const updated = { ...workshopReminders, enabled: checked };
                setWorkshopReminders(updated);
                await handleSaveWorkshopReminders(updated);
              }}
            />
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 mb-4">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800">
              <strong>How it works:</strong> Emails are sent automatically to all registered attendees 24 hours and 1 hour before each workshop starts.
            </div>
          </div>

          {/* 24-Hour Reminder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">24-Hour Reminder Template</label>
            <select
              value={workshopReminders.reminder_24h_template_id || ''}
              onChange={(e) => {
                const template = resendTemplates.find(t => t.id === e.target.value);
                const updated = {
                  ...workshopReminders,
                  reminder_24h_template_id: e.target.value,
                  reminder_24h_template_name: template?.name || ''
                };
                setWorkshopReminders(updated);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!workshopReminders.enabled}
            >
              <option value="">Select template for 24h reminder...</option>
              {resendTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {workshopReminders.reminder_24h_template_name && (
              <p className="text-xs text-slate-500">
                Selected: {workshopReminders.reminder_24h_template_name}
              </p>
            )}
          </div>

          {/* 1-Hour Reminder */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">1-Hour Reminder Template</label>
            <select
              value={workshopReminders.reminder_1h_template_id || ''}
              onChange={(e) => {
                const template = resendTemplates.find(t => t.id === e.target.value);
                const updated = {
                  ...workshopReminders,
                  reminder_1h_template_id: e.target.value,
                  reminder_1h_template_name: template?.name || ''
                };
                setWorkshopReminders(updated);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!workshopReminders.enabled}
            >
              <option value="">Select template for 1h reminder...</option>
              {resendTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {workshopReminders.reminder_1h_template_name && (
              <p className="text-xs text-slate-500">
                Selected: {workshopReminders.reminder_1h_template_name}
              </p>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={() => handleSaveWorkshopReminders(workshopReminders)}
            disabled={savingWorkshopReminders || !workshopReminders.enabled}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {savingWorkshopReminders ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Workshop Reminder Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Bulk Email Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-50">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Bulk Email Campaign</h3>
              <p className="text-xs text-slate-500">Send one-time emails to all contacts or mentors</p>
            </div>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <BulkEmailForm resendTemplates={resendTemplates} />
        </div>
      </div>
    </div>
  );
};

// Bulk Email Form Component
const BulkEmailForm = ({ resendTemplates }) => {
  const [recipientType, setRecipientType] = useState('contacts');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);

  const handleSend = async () => {
    if (!selectedTemplate) {
      alert('Please select a template');
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to send this email to ALL ${recipientType}?\n\nThis will send emails with 1-second delay between each email to comply with Resend rate limits.\n\nClick OK to proceed.`
    );

    if (!confirm) return;

    setSending(true);
    try {
      const template = resendTemplates.find(t => t.id === selectedTemplate);
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/automations/bulk-email/send`,
        {
          recipient_type: recipientType,
          template_id: selectedTemplate,
          template_name: template?.name || ''
        },
        { withCredentials: true }
      );

      setTaskId(res.data.task_id);
      alert(`✅ ${res.data.message}\n\nTask ID: ${res.data.task_id}\n\nEmails are being sent in the background. You can check the status below.`);
      
      // Start polling for status
      pollStatus(res.data.task_id);
    } catch (err) {
      alert('Failed to send bulk email: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  const pollStatus = async (tid) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/automations/bulk-email/status/${tid}`, { withCredentials: true });
      setStatus(res.data);
      
      // Continue polling if there are pending emails
      if (res.data.pending > 0) {
        setTimeout(() => pollStatus(tid), 3000); // Poll every 3 seconds
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const getTemplateName = (templateId) => {
    return resendTemplates.find(t => t.id === templateId)?.name || templateId;
  };

  return (
    <div className="space-y-4">
      {/* Recipient Type Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Recipients</label>
        <div className="flex gap-3">
          <button
            onClick={() => setRecipientType('contacts')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
              recipientType === 'contacts'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <div className="font-semibold">All Contacts</div>
            <div className="text-xs opacity-75">Candidates/Users (excluding mentors & admins)</div>
          </button>
          <button
            onClick={() => setRecipientType('mentors')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
              recipientType === 'mentors'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <div className="font-semibold">All Mentors</div>
            <div className="text-xs opacity-75">All mentor accounts</div>
          </button>
        </div>
      </div>

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Email Template</label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Select a Resend template...</option>
          {resendTemplates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800">
          <strong>Rate Limiting:</strong> Emails will be sent with a 1-second delay between each email to comply with Resend's rate limits. This is automatic and cannot be changed.
        </div>
      </div>

      {/* Send Button */}
      <Button
        onClick={handleSend}
        disabled={sending || !selectedTemplate}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
      >
        {sending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Initiating Send...
          </>
        ) : (
          <>
            <Mail className="w-4 h-4 mr-2" />
            Send Bulk Email to {recipientType === 'contacts' ? 'All Contacts' : 'All Mentors'}
          </>
        )}
      </Button>

      {/* Status Display */}
      {status && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">Sending Progress</h4>
            {status.pending > 0 && (
              <span className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                In Progress...
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">{status.total}</div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{status.sent}</div>
              <div className="text-xs text-slate-500">Sent</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">{status.failed}</div>
              <div className="text-xs text-slate-500">Failed</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{status.pending}</div>
              <div className="text-xs text-slate-500">Pending</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
              style={{ width: `${(status.sent / status.total) * 100}%` }}
            />
          </div>

          {/* Recent Logs */}
          {status.logs && status.logs.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-slate-700 mb-2">Recent Sends (last 10)</h5>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {status.logs.slice(-10).reverse().map((log, idx) => (
                  <div key={idx} className="text-xs flex items-center justify-between py-1 px-2 bg-white rounded border border-slate-100">
                    <span className="flex items-center gap-2">
                      {log.status === 'sent' ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-500" />
                      )}
                      <span className="font-medium">{log.recipient_email}</span>
                    </span>
                    <span className="text-slate-400">#{log.sequence_number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutomationsSection;
