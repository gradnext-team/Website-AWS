import React, { useState } from 'react';
import { apiCall } from '../crmApi';
import { Modal } from '../components/Modal';

const METHODS = [
  { value: 'call', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In Person' },
];

const OUTCOMES = [
  { value: 'reached', label: 'Reached', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'not_reached', label: 'Not Reached', color: 'bg-slate-100 text-slate-600' },
  { value: 'busy', label: 'Busy', color: 'bg-amber-50 text-amber-700' },
  { value: 'voicemail', label: 'Voicemail', color: 'bg-blue-50 text-blue-700' },
  { value: 'interested', label: 'Interested', color: 'bg-purple-50 text-purple-700' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-red-50 text-red-700' },
];

export const LogContactModal = ({ lead, onClose, onSuccess }) => {
  const [method, setMethod] = useState('call');
  const [outcome, setOutcome] = useState('reached');
  const [reply, setReply] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiCall.post('/api/crm/contact-logs', {
        lead_id: lead.id || lead.lead_id,
        method,
        outcome,
        reply: reply || null,
        next_follow_up_date: nextDate || null,
      });
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to log contact');
    } finally {
      setSaving(false);
    }
  };

  const leadName = lead.name || lead.lead_name || 'lead';

  return (
    <Modal open={true} onClose={onClose} title={`Log Contact — ${leadName}`}>
      <div className="space-y-4">
        {/* Method */}
        <div>
          <label className="text-sm font-medium text-slate-700">Method *</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                data-testid={`log-contact-method-${m.value}`}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  method === m.value
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Outcome */}
        <div>
          <label className="text-sm font-medium text-slate-700">Outcome *</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {OUTCOMES.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                data-testid={`log-contact-outcome-${o.value}`}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  outcome === o.value
                    ? `${o.color} border-current`
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reply / Notes */}
        <div>
          <label className="text-sm font-medium text-slate-700">Reply / Notes</label>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={3}
            data-testid="log-contact-reply"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="What did they say? Any objections, questions, or commitments?"
          />
        </div>

        {/* Next follow-up */}
        <div>
          <label className="text-sm font-medium text-slate-700">Next follow-up date (optional)</label>
          <input
            type="date"
            value={nextDate}
            onChange={e => setNextDate(e.target.value)}
            data-testid="log-contact-next-date"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="log-contact-save-btn"
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Log'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Format helpers for display elsewhere
export const METHOD_LABELS = METHODS.reduce((acc, m) => ({ ...acc, [m.value]: m.label }), {});
export const OUTCOME_LABELS = OUTCOMES.reduce((acc, o) => ({ ...acc, [o.value]: o.label }), {});
export const OUTCOME_COLORS = OUTCOMES.reduce((acc, o) => ({ ...acc, [o.value]: o.color }), {});
