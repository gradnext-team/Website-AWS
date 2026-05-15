import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';

export const BulkMoveFunnelModal = ({ funnels, count, onClose, onConfirm }) => {
  const defaultFunnel = funnels.find(f => f.is_default) || funnels[0];
  const [funnelId, setFunnelId] = useState(defaultFunnel?.id || '');
  const [stageId, setStageId] = useState(defaultFunnel?.stages?.[0]?.id || '');
  const currentFunnel = funnels.find(f => f.id === funnelId) || defaultFunnel;
  const currentStages = currentFunnel?.stages || [];

  useEffect(() => {
    if (currentStages.length && !currentStages.find(s => s.id === stageId)) {
      setStageId(currentStages[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelId]);

  return (
    <Modal open={true} onClose={onClose} title={`Move ${count} lead${count > 1 ? 's' : ''} to funnel`}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600">Funnel</label>
          <select
            value={funnelId}
            onChange={e => setFunnelId(e.target.value)}
            data-testid="bulk-funnel-select"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Stage</label>
          <select
            value={stageId}
            onChange={e => setStageId(e.target.value)}
            data-testid="bulk-stage-select"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {currentStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onConfirm(funnelId, stageId)}
            data-testid="bulk-move-confirm-btn"
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
          >
            Move {count} {count > 1 ? 'leads' : 'lead'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
