import React, { useState, useEffect } from 'react';
import { apiCall } from '../crmApi';
import { Modal } from '../components/Modal';

export const AddLeadModal = ({ open, onClose, onSuccess, salesReps, funnels }) => {
  const defaultFunnel = funnels.find(f => f.is_default) || funnels[0];
  const [form, setForm] = useState({
    name: '', email: '', phone: '', source: 'b2b_manual', company: '', designation: '',
    notes: '', assigned_to: '', tags: '',
    funnel_id: defaultFunnel?.id || '',
    stage_id: defaultFunnel?.stages?.[0]?.id || '',
  });
  const [saving, setSaving] = useState(false);

  const currentFunnel = funnels.find(f => f.id === form.funnel_id) || defaultFunnel;
  const currentStages = currentFunnel?.stages || [];

  useEffect(() => {
    if (currentStages.length && !currentStages.find(s => s.id === form.stage_id)) {
      setForm(f => ({ ...f, stage_id: currentStages[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.funnel_id]);

  const handleSave = async () => {
    if (!form.name) return alert('Name is required');
    try {
      setSaving(true);
      await apiCall.post('/api/crm/leads', {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        assigned_to: form.assigned_to || null,
        funnel_id: form.funnel_id || null,
        stage_id: form.stage_id || null,
      });
      onSuccess();
      setForm({
        name: '', email: '', phone: '', source: 'b2b_manual', company: '', designation: '',
        notes: '', assigned_to: '', tags: '',
        funnel_id: defaultFunnel?.id || '',
        stage_id: defaultFunnel?.stages?.[0]?.id || '',
      });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Lead">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Full name" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="email@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="+91..." />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Source</label>
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="b2b_manual">B2B Manual</option>
              <option value="free_signup">Free Signup</option>
              <option value="discovery_call">Discovery Call</option>
              <option value="csv_import">CSV Import</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Company</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Company name" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Designation</label>
            <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Job title" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Assign To</label>
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Unassigned</option>
              {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tags</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="tag1, tag2" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Funnel</label>
            <select
              value={form.funnel_id}
              onChange={e => setForm(f => ({ ...f, funnel_id: e.target.value }))}
              data-testid="add-lead-funnel-select"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {funnels.map(f => (
                <option key={f.id} value={f.id}>{f.name}{f.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Starting Stage</label>
            <select
              value={form.stage_id}
              onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}
              data-testid="add-lead-stage-select"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {currentStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" placeholder="Any additional notes..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : 'Add Lead'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
