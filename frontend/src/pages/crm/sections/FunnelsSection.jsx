import React, { useState } from 'react';
import { Plus, Edit, ChevronRight, Trash2 } from 'lucide-react';
import { apiCall } from '../crmApi';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

const FunnelsSection = ({ funnels, fetchFunnels }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editFunnel, setEditFunnel] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Funnels</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Funnel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {funnels.map(funnel => (
          <div key={funnel.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">{funnel.name}</h3>
                {funnel.is_default && <Badge variant="blue">Default</Badge>}
              </div>
              <button onClick={() => setEditFunnel(funnel)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <Edit className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {(funnel.stages || []).map((stage, idx) => (
                <React.Fragment key={stage.id}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 flex-shrink-0">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-medium text-slate-700 whitespace-nowrap">{stage.name}</span>
                  </div>
                  {idx < funnel.stages.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Funnel Modal */}
      {(showAdd || editFunnel) && (
        <FunnelFormModal
          funnel={editFunnel}
          onClose={() => { setShowAdd(false); setEditFunnel(null); }}
          onSuccess={() => { setShowAdd(false); setEditFunnel(null); fetchFunnels(); }}
        />
      )}
    </div>
  );
};

const FunnelFormModal = ({ funnel, onClose, onSuccess }) => {
  const [name, setName] = useState(funnel?.name || '');
  const [stages, setStages] = useState(funnel?.stages || [
    { id: crypto.randomUUID(), name: 'New', color: '#6B7280', order: 0 },
    { id: crypto.randomUUID(), name: 'Won', color: '#22C55E', order: 1 },
    { id: crypto.randomUUID(), name: 'Lost', color: '#EF4444', order: 2 },
  ]);
  const [sourceMappings, setSourceMappings] = useState(funnel?.source_mappings || []);
  const [saving, setSaving] = useState(false);

  // All available lead sources — keep this list in sync with crmConstants.sourceLabels
  const SOURCE_OPTIONS = [
    { value: 'free_signup', label: 'Free Signup' },
    { value: 'discovery_call', label: 'Discovery Call' },
    { value: 'b2b_manual', label: 'B2B Manual' },
    { value: 'csv_import', label: 'CSV Import' },
    { value: 'cohort', label: 'Cohort' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'manual', label: 'Manual' },
  ];

  const addMapping = () => {
    const used = new Set(sourceMappings.map(m => m.source));
    const next = SOURCE_OPTIONS.find(o => !used.has(o.value));
    setSourceMappings([
      ...sourceMappings,
      { source: next?.value || SOURCE_OPTIONS[0].value, stage_id: stages[0]?.id || '' },
    ]);
  };

  const updateMapping = (idx, field, value) => {
    setSourceMappings(sourceMappings.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeMapping = (idx) => {
    setSourceMappings(sourceMappings.filter((_, i) => i !== idx));
  };

  const addStage = () => {
    setStages([...stages, { id: crypto.randomUUID(), name: '', color: '#3B82F6', order: stages.length }]);
  };

  const removeStage = (idx) => {
    const removed = stages[idx];
    setStages(stages.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
    // Drop any source mappings that pointed to the deleted stage
    setSourceMappings(sourceMappings.filter(m => m.stage_id !== removed?.id));
  };

  const updateStage = (idx, field, value) => {
    setStages(stages.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (!name) return alert('Funnel name is required');
    if (stages.some(s => !s.name)) return alert('All stages need names');
    // Validate mappings: source non-empty, stage_id refers to one of our stages, no duplicate source
    const stageIds = new Set(stages.map(s => s.id));
    const seen = new Set();
    for (const m of sourceMappings) {
      if (!m.source || !m.stage_id) return alert('Each source routing rule needs both source and stage');
      if (!stageIds.has(m.stage_id)) return alert('A routing rule references a stage that no longer exists');
      if (seen.has(m.source)) return alert(`Source "${m.source}" is mapped twice — pick a different source.`);
      seen.add(m.source);
    }
    try {
      setSaving(true);
      const payload = { name, stages, source_mappings: sourceMappings };
      if (funnel) {
        await apiCall.put(`/api/crm/funnels/${funnel.id}`, payload);
      } else {
        await apiCall.post('/api/crm/funnels', payload);
      }
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!funnel) return;
    if (!window.confirm('Delete this funnel? Leads will be moved to the default funnel.')) return;
    try {
      await apiCall.delete(`/api/crm/funnels/${funnel.id}`);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete');
    }
  };

  const stageColors = ['#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#F97316', '#22C55E', '#EF4444', '#14B8A6', '#6366F1'];

  return (
    <Modal open={true} onClose={onClose} title={funnel ? 'Edit Funnel' : 'Create Funnel'}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Funnel Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="e.g., B2B Sales Pipeline" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Stages</label>
            <button onClick={addStage} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Stage
            </button>
          </div>
          <div className="space-y-2">
            {stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-6 text-center">{idx + 1}</span>
                <input
                  type="color" value={stage.color}
                  onChange={e => updateStage(idx, 'color', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input value={stage.name} onChange={e => updateStage(idx, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Stage name" />
                {stages.length > 1 && (
                  <button onClick={() => removeStage(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Source Routing</label>
              <p className="text-xs text-slate-500 mt-0.5">Auto-route new leads from a specific source straight into one of this funnel's stages.</p>
            </div>
            <button
              onClick={addMapping}
              disabled={!stages.length}
              data-testid="funnel-source-add-btn"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Add Rule
            </button>
          </div>
          {sourceMappings.length === 0 ? (
            <p className="text-xs text-slate-400 italic px-2">
              No routing rules yet. Without rules, new leads land in your default funnel.
            </p>
          ) : (
            <div className="space-y-2">
              {sourceMappings.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2" data-testid={`funnel-source-row-${idx}`}>
                  <span className="text-xs text-slate-400 w-20">When source</span>
                  <select
                    value={m.source}
                    onChange={e => updateMapping(idx, 'source', e.target.value)}
                    data-testid={`funnel-source-select-${idx}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="text-xs text-slate-400">→ stage</span>
                  <select
                    value={m.stage_id}
                    onChange={e => updateMapping(idx, 'stage_id', e.target.value)}
                    data-testid={`funnel-source-stage-${idx}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    onClick={() => removeMapping(idx)}
                    data-testid={`funnel-source-remove-${idx}`}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {funnel && !funnel.is_default && (
              <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600 font-medium">Delete Funnel</button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : funnel ? 'Save Changes' : 'Create Funnel'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export { FunnelsSection };
