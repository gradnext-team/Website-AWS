import React, { useState, useEffect } from 'react';
import { apiCall } from '../crmApi';
import { Modal } from '../components/Modal';

export const WonPlanModal = ({ lead, onClose, onSuccess }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planKey, setPlanKey] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiCall.get('/api/crm/plans');
        if (!cancelled) setPlans(res.data.plans || []);
      } catch (err) {
        console.error('Failed to load plans', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!planKey) return alert('Please pick a plan');
    try {
      setSaving(true);
      const payload = { status: 'won' };
      if (planKey === '__custom__') {
        payload.won_plan_key = 'custom';
        payload.won_plan_name = 'Custom Deal';
        const amt = parseFloat(customAmount);
        if (!isNaN(amt) && amt > 0) payload.won_amount = amt;
      } else {
        const plan = plans.find(p => p.plan_key === planKey);
        payload.won_plan_key = planKey;
        payload.won_plan_name = plan?.name || planKey;
        const inrYearly = plan?.pricing?.INR?.yearly?.amount
          ?? plan?.pricing?.INR?.amount
          ?? plan?.pricing?.amount;
        if (inrYearly) payload.won_amount = Number(inrYearly);
      }
      await apiCall.put(`/api/crm/leads/${lead.id}`, payload);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Mark "${lead.name}" as Won`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Which plan did they purchase?</p>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <select
              value={planKey}
              onChange={e => setPlanKey(e.target.value)}
              data-testid="won-plan-select"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">— Select plan —</option>
              {plans.map(p => (
                <option key={p.plan_key} value={p.plan_key}>
                  {p.name} {p.category ? `· ${p.category}` : ''}
                </option>
              ))}
              <option value="__custom__">Custom amount / other</option>
            </select>
            {planKey === '__custom__' && (
              <div>
                <label className="text-xs font-medium text-slate-600">Amount (₹)</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  data-testid="won-plan-custom-amount"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="e.g. 29999"
                />
              </div>
            )}
          </>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            data-testid="won-plan-save-btn"
            className="px-6 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Confirm Won'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
