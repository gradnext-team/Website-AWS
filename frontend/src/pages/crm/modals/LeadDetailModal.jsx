import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Phone, Building2, Briefcase, Globe, MessageSquarePlus } from 'lucide-react';
import { apiCall } from '../crmApi';
import { sourceColors, sourceLabels } from '../crmConstants';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { LogContactModal, METHOD_LABELS, OUTCOME_LABELS, OUTCOME_COLORS } from './LogContactModal';

export const LeadDetailModal = ({ leadId, onClose, onUpdate, salesReps, funnels }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [contactLogs, setContactLogs] = useState([]);
  const [showLogContact, setShowLogContact] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true);
      const [leadRes, logsRes] = await Promise.all([
        apiCall.get(`/api/crm/leads/${leadId}`),
        apiCall.get(`/api/crm/contact-logs?lead_id=${leadId}&limit=50`),
      ]);
      setData(leadRes.data);
      setContactLogs(logsRes.data?.logs || []);
    } catch (err) {
      console.error('Failed to fetch lead', err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await apiCall.post(`/api/crm/leads/${leadId}/notes`, { lead_id: leadId, note: newNote });
      setNewNote('');
      fetchLead();
    } catch (err) {
      console.error('Failed to add note', err);
    }
  };

  const handleStageChange = async (stageId) => {
    try {
      await apiCall.put(`/api/crm/leads/${leadId}`, { stage_id: stageId });
      fetchLead();
      onUpdate();
    } catch (err) {
      console.error('Stage change failed', err);
    }
  };

  const handleFunnelChange = async (newFunnelId) => {
    const newFunnel = funnels.find(f => f.id === newFunnelId);
    const firstStageId = newFunnel?.stages?.[0]?.id || null;
    try {
      await apiCall.put(`/api/crm/leads/${leadId}`, {
        funnel_id: newFunnelId,
        stage_id: firstStageId,
      });
      fetchLead();
      onUpdate();
    } catch (err) {
      console.error('Funnel change failed', err);
    }
  };

  if (loading || !data) {
    return (
      <Modal open={true} onClose={onClose} title="Lead Details" wide>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      </Modal>
    );
  }

  const { lead, activities, funnel } = data;

  return (
    <Modal open={true} onClose={onClose} title={lead.name} wide>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{lead.email || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{lead.phone || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{lead.company || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm"><Briefcase className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{lead.designation || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-slate-400" /><Badge variant={sourceColors[lead.source]}>{sourceLabels[lead.source] || lead.source}</Badge></div>
          </div>

          {/* Won plan summary */}
          {lead.status === 'won' && lead.won_plan_name && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3" data-testid="lead-detail-won-plan">
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-1">Plan Closed</p>
              <p className="text-sm font-semibold text-emerald-900">{lead.won_plan_name}</p>
              {lead.won_amount ? (
                <p className="text-xs text-emerald-700 mt-0.5">₹{Number(lead.won_amount).toLocaleString('en-IN')}</p>
              ) : null}
            </div>
          )}

          {/* Funnel selector */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Funnel</p>
            <select
              value={lead.funnel_id || ''}
              onChange={e => handleFunnelChange(e.target.value)}
              data-testid="lead-detail-funnel-select"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {funnels.map(f => (
                <option key={f.id} value={f.id}>{f.name}{f.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Stage Selector */}
          {funnel && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Stage ({funnel.name})</p>
              <div className="flex flex-wrap gap-1.5">
                {funnel.stages.map(s => (
                  <button key={s.id} onClick={() => handleStageChange(s.id)}
                    data-testid={`lead-detail-stage-${s.id}`}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${s.id === lead.stage_id ? 'text-white shadow-sm' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                    style={s.id === lead.stage_id ? { backgroundColor: s.color } : {}}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lead.tags && lead.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((t, i) => <Badge key={i}>{t}</Badge>)}
              </div>
            </div>
          )}

          {lead.notes && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Activity Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick action: Log Contact */}
          <div className="flex justify-start">
            <button
              onClick={() => setShowLogContact(true)}
              data-testid="lead-detail-log-contact-btn"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <MessageSquarePlus className="w-4 h-4" /> Log Contact
            </button>
          </div>

          {/* Contact History */}
          <div data-testid="lead-detail-contact-history">
            {contactLogs.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Contact History ({contactLogs.length})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {contactLogs.map(log => (
                    <div key={log.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge>{METHOD_LABELS[log.method] || log.method}</Badge>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OUTCOME_COLORS[log.outcome] || 'bg-slate-100 text-slate-600'}`}>
                          {OUTCOME_LABELS[log.outcome] || log.outcome}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">
                          {log.performed_by_name} · {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.reply && (
                        <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{log.reply}</p>
                      )}
                      {log.next_follow_up_date && (
                        <p className="text-xs text-blue-600 mt-1.5">
                          Next follow-up: {new Date(log.next_follow_up_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">No contact logs yet. Click "Log Contact" above to record your first outreach.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Add Note</p>
            <div className="flex gap-2">
              <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Type a note..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
              <button onClick={handleAddNote} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Add</button>
            </div>
          </div>

          {activities && activities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Activity Timeline</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-3 pl-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{act.details}</p>
                      <p className="text-xs text-slate-400">{act.performed_by} · {new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Log Contact Modal */}
      {showLogContact && (
        <LogContactModal
          lead={data.lead}
          onClose={() => setShowLogContact(false)}
          onSuccess={() => { setShowLogContact(false); fetchLead(); onUpdate(); }}
        />
      )}
    </Modal>
  );
};
