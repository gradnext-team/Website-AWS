import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Clock } from 'lucide-react';
import { apiCall } from '../crmApi';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';

const WorkflowSection = ({ funnels }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiCall.get('/api/crm/workflow-rules');
      setRules(res.data.rules || []);
    } catch (err) {
      console.error('Failed to fetch workflow rules', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workflow rule?')) return;
    try {
      await apiCall.delete(`/api/crm/workflow-rules/${id}`);
      fetchRules();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const stageInfo = (rule) => {
    const f = funnels.find(x => x.id === rule.funnel_id);
    const s = f?.stages?.find(x => x.id === rule.stage_id);
    return { funnelName: f?.name || 'Unknown funnel', stageName: s?.name || 'Unknown stage', color: s?.color || '#94a3b8' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Workflows</h2>
          <p className="text-sm text-slate-500 mt-0.5">Define follow-up cadences. Leads stuck in a stage longer than the threshold will surface at the top of the Leads page.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          data-testid="workflow-add-btn"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No workflow rules yet"
          description="Create your first follow-up rule, e.g. 'Contact lead within 3 days of Discovery stage'."
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              data-testid="workflow-empty-add-btn"
            >
              Add your first rule
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map(rule => {
            const info = stageInfo(rule);
            return (
              <div key={rule.id} className="bg-white rounded-xl border border-slate-200 p-5" data-testid={`workflow-rule-${rule.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{rule.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {info.funnelName} · <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />{info.stageName}</span>
                    </p>
                    {rule.description && <p className="text-sm text-slate-600 mt-2">{rule.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEditRule(rule)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="orange">After {rule.days_threshold} day{rule.days_threshold > 1 ? 's' : ''}</Badge>
                  {rule.is_active === false && <Badge variant="red">Inactive</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showAdd || editRule) && (
        <WorkflowRuleFormModal
          rule={editRule}
          funnels={funnels}
          onClose={() => { setShowAdd(false); setEditRule(null); }}
          onSuccess={() => { setShowAdd(false); setEditRule(null); fetchRules(); }}
        />
      )}
    </div>
  );
};

const WorkflowRuleFormModal = ({ rule, funnels, onClose, onSuccess }) => {
  const defaultFunnel = funnels[0];
  const [form, setForm] = useState({
    name: rule?.name || '',
    funnel_id: rule?.funnel_id || defaultFunnel?.id || '',
    stage_id: rule?.stage_id || defaultFunnel?.stages?.[0]?.id || '',
    days_threshold: rule?.days_threshold || 3,
    description: rule?.description || '',
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
    if (!form.name.trim()) return alert('Rule name is required');
    if (!form.funnel_id || !form.stage_id) return alert('Pick a funnel and stage');
    if (!form.days_threshold || form.days_threshold < 1) return alert('Days threshold must be at least 1');
    try {
      setSaving(true);
      if (rule) {
        await apiCall.put(`/api/crm/workflow-rules/${rule.id}`, form);
      } else {
        await apiCall.post('/api/crm/workflow-rules', form);
      }
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={rule ? 'Edit Workflow Rule' : 'New Workflow Rule'}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Rule name *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            data-testid="workflow-rule-name"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="e.g. Follow up after Discovery"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Funnel</label>
            <select
              value={form.funnel_id}
              onChange={e => setForm(f => ({ ...f, funnel_id: e.target.value }))}
              data-testid="workflow-rule-funnel"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Stage</label>
            <select
              value={form.stage_id}
              onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}
              data-testid="workflow-rule-stage"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {currentStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Reach out after (days)</label>
          <input
            type="number"
            min="1"
            value={form.days_threshold}
            onChange={e => setForm(f => ({ ...f, days_threshold: parseInt(e.target.value || '0', 10) }))}
            data-testid="workflow-rule-days"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="text-xs text-slate-400 mt-1">A lead stuck in this stage longer than this will appear at the top of the Leads page.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            data-testid="workflow-rule-description"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="What should reps do when this triggers?"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="workflow-rule-save-btn"
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : (rule ? 'Save Changes' : 'Create Rule')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export { WorkflowSection };
