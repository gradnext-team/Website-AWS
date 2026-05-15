import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, Plus, Search, UserCheck, X as XIcon, CheckCircle2, GitBranch,
} from 'lucide-react';
import { apiCall } from '../crmApi';
import { sourceColors, sourceLabels } from '../crmConstants';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { AddLeadModal } from '../modals/AddLeadModal';
import { LeadDetailModal } from '../modals/LeadDetailModal';

/**
 * Leads = repository of ALL leads. Browse, search, filter, AND assign to sales reps.
 * Assignment is the ONLY editable action here (admin only):
 *   - Per-row dropdown in the "Assigned To" column
 *   - Bulk-assign toolbar (select multiple rows via checkboxes)
 * All other actions (status change, log contact, delete, mark won/lost) live in the
 * Reach Outs tab. Click any lead row to open details.
 */
const LeadsSection = ({ salesReps, funnels, isAdmin = true }) => {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');    // raw input
  const [search, setSearch] = useState('');               // debounced value sent to API
  const [filterFunnel, setFilterFunnel] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [showLeadDetail, setShowLeadDetail] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Selection state for bulk actions (Set of lead.id)
  const [selected, setSelected] = useState(() => new Set());
  // Which bulk action is currently selected in the toolbar:
  //   'assign'  → pick a sales rep (or unassign)
  //   'funnel'  → pick a funnel + stage
  const [bulkAction, setBulkAction] = useState('assign');
  const [bulkRep, setBulkRep] = useState('');
  const [bulkFunnel, setBulkFunnel] = useState('');
  const [bulkStage, setBulkStage] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkToast, setBulkToast] = useState(null);  // {type:'success'|'error', text:string}

  // Debounce the search input — 350ms after user stops typing.
  const debounceTimer = useRef(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearch(searchInput);
    }, 350);
    return () => debounceTimer.current && clearTimeout(debounceTimer.current);
  }, [searchInput]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterFunnel) params.set('funnel_id', filterFunnel);
      if (filterStage) params.set('stage_id', filterStage);
      if (filterSource) params.set('source', filterSource);
      if (filterRep) params.set('assigned_to', filterRep);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', PAGE_SIZE);
      params.set('skip', page * PAGE_SIZE);
      const res = await apiCall.get(`/api/crm/leads?${params.toString()}`);
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch leads', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterFunnel, filterStage, filterSource, filterRep, filterStatus, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Reset to page 0 + clear selection whenever any filter changes
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [search, filterFunnel, filterStage, filterSource, filterRep, filterStatus]);

  // Admin-only: assign a single lead via the per-row dropdown.
  // Optimistic UI update for snappy UX.
  const handleAssign = async (leadId, repId) => {
    const repName = repId ? (salesReps.find(r => r.id === repId)?.name || null) : null;
    setLeads(prev => prev.map(l => l.id === leadId
      ? { ...l, assigned_to: repId || null, assigned_to_name: repName }
      : l));
    try {
      await apiCall.put(`/api/crm/leads/${leadId}`, { assigned_to: repId || null });
    } catch (err) {
      console.error('Failed to assign lead', err);
      alert(err.response?.data?.detail || 'Failed to assign lead');
      fetchLeads();  // roll back on error
    }
  };

  // Bulk-assign: send selected lead IDs + chosen rep (or null=unassign).
  const handleBulkAssign = async () => {
    if (selected.size === 0) return;
    const repId = bulkRep || null;  // empty string → unassign
    setBulkBusy(true);
    try {
      const res = await apiCall.post('/api/crm/leads/bulk-assign', {
        lead_ids: Array.from(selected),
        sales_rep_id: repId,
      });
      const modified = res.data?.modified ?? selected.size;
      const repName = repId
        ? (salesReps.find(r => r.id === repId)?.name || 'sales rep')
        : null;
      setBulkToast({
        type: 'success',
        text: repId
          ? `${modified} lead${modified === 1 ? '' : 's'} assigned to ${repName}`
          : `${modified} lead${modified === 1 ? '' : 's'} unassigned`,
      });
      setSelected(new Set());
      setBulkRep('');
      await fetchLeads();
      setTimeout(() => setBulkToast(null), 3500);
    } catch (err) {
      console.error('Bulk assign failed', err);
      setBulkToast({
        type: 'error',
        text: err.response?.data?.detail || 'Bulk assignment failed',
      });
      setTimeout(() => setBulkToast(null), 4500);
    } finally {
      setBulkBusy(false);
    }
  };

  // Bulk funnel/stage change. If stage isn't picked, backend defaults to the
  // first stage of the chosen funnel.
  const handleBulkFunnelChange = async () => {
    if (selected.size === 0) return;
    if (!bulkFunnel) {
      setBulkToast({ type: 'error', text: 'Please pick a funnel' });
      setTimeout(() => setBulkToast(null), 3500);
      return;
    }
    setBulkBusy(true);
    try {
      const res = await apiCall.post('/api/crm/leads/bulk-update-funnel', {
        lead_ids: Array.from(selected),
        funnel_id: bulkFunnel,
        stage_id: bulkStage || null,
      });
      const modified = res.data?.modified ?? selected.size;
      const funnelName = funnels.find(f => f.id === bulkFunnel)?.name || 'funnel';
      const stages = funnels.find(f => f.id === bulkFunnel)?.stages || [];
      const stageName = bulkStage
        ? (stages.find(s => s.id === bulkStage)?.name || '')
        : (stages[0]?.name || '');
      setBulkToast({
        type: 'success',
        text: `${modified} lead${modified === 1 ? '' : 's'} moved to ${funnelName}${stageName ? ` · ${stageName}` : ''}`,
      });
      setSelected(new Set());
      setBulkFunnel('');
      setBulkStage('');
      await fetchLeads();
      setTimeout(() => setBulkToast(null), 3500);
    } catch (err) {
      console.error('Bulk funnel change failed', err);
      setBulkToast({
        type: 'error',
        text: err.response?.data?.detail || 'Bulk funnel update failed',
      });
      setTimeout(() => setBulkToast(null), 4500);
    } finally {
      setBulkBusy(false);
    }
  };

  // Dispatcher for the toolbar's Apply button — runs whichever action is selected
  const handleBulkApply = () => {
    if (bulkAction === 'funnel') return handleBulkFunnelChange();
    return handleBulkAssign();
  };

  // Stages available in the currently-picked bulk funnel
  const bulkFunnelStages = bulkFunnel
    ? (funnels.find(f => f.id === bulkFunnel)?.stages || [])
    : [];

  const currentFunnelStages = filterFunnel
    ? (funnels.find(f => f.id === filterFunnel)?.stages || [])
    : [];

  // Memoize the funnel/stage lookup map so we don't search arrays on every row render
  const funnelMap = useMemo(() => {
    const m = new Map();
    funnels.forEach(f => m.set(f.id, f));
    return m;
  }, [funnels]);

  const getStageInfo = (lead) => {
    const f = funnelMap.get(lead.funnel_id);
    if (!f) return { name: '—', color: '#94a3b8', funnelName: '—' };
    const s = f.stages?.find(x => x.id === lead.stage_id);
    return { name: s?.name || '—', color: s?.color || '#94a3b8', funnelName: f.name };
  };

  // Selection helpers
  const toggleSelect = (leadId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const allOnPageSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
  const someOnPageSelected = leads.some(l => selected.has(l.id));

  const toggleSelectAllOnPage = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        leads.forEach(l => next.delete(l.id));
      } else {
        leads.forEach(l => next.add(l.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Leads <span className="text-sm font-normal text-slate-400">({total})</span></h2>
          <p className="text-sm text-slate-500 mt-0.5">Full repository of every lead. Assign leads to sales reps here. Other actions live in <span className="font-medium text-blue-600">Reach Outs</span>.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddLead(true)}
            data-testid="leads-add-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        )}
      </div>

      {/* Toast */}
      {bulkToast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
            ${bulkToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'}`}
          data-testid="leads-bulk-toast"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {bulkToast.text}
        </div>
      )}

      {/* Bulk-action toolbar — only when at least 1 row is selected (admin only) */}
      {isAdmin && selected.size > 0 && (
        <div
          className="sticky top-0 z-10 bg-blue-50/95 backdrop-blur border border-blue-200 rounded-xl p-3 flex items-center gap-3 flex-wrap"
          data-testid="leads-bulk-toolbar"
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span className="text-sm font-semibold text-blue-900">
              {selected.size} lead{selected.size === 1 ? '' : 's'} selected
            </span>
          </div>

          {/* Action picker — choose what bulk operation to perform */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Action</label>
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value)}
              data-testid="leads-bulk-action-select"
              className="px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="assign">Assign sales rep</option>
              <option value="funnel">Change funnel &amp; stage</option>
            </select>
          </div>

          <div className="flex-1 min-w-[100px]" />

          {/* Action-specific controls */}
          {bulkAction === 'assign' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Assign to</label>
              <select
                value={bulkRep}
                onChange={e => setBulkRep(e.target.value)}
                data-testid="leads-bulk-rep-select"
                className="px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[180px]"
              >
                <option value="">— Unassigned —</option>
                {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <GitBranch className="w-4 h-4 text-blue-700" />
              <select
                value={bulkFunnel}
                onChange={e => { setBulkFunnel(e.target.value); setBulkStage(''); }}
                data-testid="leads-bulk-funnel-select"
                className="px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[160px]"
              >
                <option value="">— Pick a funnel —</option>
                {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select
                value={bulkStage}
                onChange={e => setBulkStage(e.target.value)}
                disabled={!bulkFunnel}
                data-testid="leads-bulk-stage-select"
                className="px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[160px] disabled:opacity-50"
              >
                <option value="">First stage (default)</option>
                {bulkFunnelStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <button
            onClick={handleBulkApply}
            disabled={bulkBusy || (bulkAction === 'funnel' && !bulkFunnel)}
            data-testid="leads-bulk-apply-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkBusy ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                {bulkAction === 'funnel' ? <GitBranch className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                Apply
              </>
            )}
          </button>
          <button
            onClick={clearSelection}
            disabled={bulkBusy}
            data-testid="leads-bulk-clear-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <XIcon className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name, email, phone, company..."
              data-testid="leads-search"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={filterFunnel}
            onChange={e => { setFilterFunnel(e.target.value); setFilterStage(''); }}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            data-testid="leads-filter-funnel"
          >
            <option value="">All funnels</option>
            {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            disabled={!filterFunnel}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50"
            data-testid="leads-filter-stage"
          >
            <option value="">All stages</option>
            {currentFunnelStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            data-testid="leads-filter-source"
          >
            <option value="">All sources</option>
            {Object.keys(sourceLabels).map(s => <option key={s} value={s}>{sourceLabels[s]}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            data-testid="leads-filter-status"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          {isAdmin && (
            <select
              value={filterRep}
              onChange={e => setFilterRep(e.target.value)}
              className="lg:col-span-6 md:col-span-3 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
              data-testid="leads-filter-rep"
            >
              <option value="">All sales reps</option>
              <option value="__unassigned__">Unassigned only</option>
              {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads found"
          description="Try changing your filters, or add a new lead."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50/80 border-b border-slate-100">
                  {isAdmin && (
                    <th className="pl-5 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        ref={el => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                        onChange={toggleSelectAllOnPage}
                        data-testid="leads-select-all"
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label="Select all leads on this page"
                      />
                    </th>
                  )}
                  <th className={`${isAdmin ? '' : 'pl-5'} py-3 font-medium`}>Name</th>
                  <th className="py-3 font-medium">Email</th>
                  <th className="py-3 font-medium">Phone</th>
                  <th className="py-3 font-medium">Source</th>
                  <th className="py-3 font-medium">Funnel · Stage</th>
                  <th className="py-3 font-medium">Assigned To</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 pr-5 font-medium">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map(lead => {
                  const stage = getStageInfo(lead);
                  const isSelected = selected.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/40 ${isSelected ? 'bg-blue-50/40' : ''}`}
                      data-testid={`lead-row-${lead.id}`}
                    >
                      {isAdmin && (
                        <td className="pl-5 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(lead.id)}
                            data-testid={`lead-select-${lead.id}`}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            aria-label={`Select lead ${lead.name}`}
                          />
                        </td>
                      )}
                      <td className={`${isAdmin ? '' : 'pl-5'} py-3`}>
                        <button onClick={() => setShowLeadDetail(lead.id)} className="text-left">
                          <p className="font-medium text-slate-900 hover:text-blue-600">{lead.name}</p>
                          {lead.company && <p className="text-xs text-slate-400">{lead.company}</p>}
                        </button>
                      </td>
                      <td className="py-3 text-xs text-slate-500">{lead.email || '—'}</td>
                      <td className="py-3 text-xs text-slate-500">{lead.phone || '—'}</td>
                      <td className="py-3">
                        <Badge variant={sourceColors[lead.source] || 'default'}>{sourceLabels[lead.source] || lead.source}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                          <span className="text-xs text-slate-600">
                            <span className="text-slate-400">{stage.funnelName}</span> · {stage.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-xs text-slate-500">
                        {isAdmin ? (
                          <select
                            value={lead.assigned_to || ''}
                            onChange={e => handleAssign(lead.id, e.target.value)}
                            data-testid={`lead-assign-${lead.id}`}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-[160px] text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer truncate"
                          >
                            <option value="">Unassigned</option>
                            {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        ) : (
                          <span className="truncate" title={lead.assigned_to_name}>{lead.assigned_to_name || '—'}</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                          ${lead.status === 'won' ? 'bg-emerald-50 text-emerald-700'
                          : lead.status === 'lost' ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 pr-5">
                        {lead.status === 'won' && lead.won_plan_name ? (
                          <Badge variant="green">
                            {lead.won_plan_name}
                            {lead.won_amount ? ` · ₹${Number(lead.won_amount).toLocaleString('en-IN')}` : ''}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Lead Modal */}
      <AddLeadModal open={showAddLead} onClose={() => setShowAddLead(false)} onSuccess={() => { setShowAddLead(false); fetchLeads(); }} salesReps={salesReps} funnels={funnels} />

      {/* Lead Detail Modal */}
      {showLeadDetail && (
        <LeadDetailModal leadId={showLeadDetail} onClose={() => setShowLeadDetail(null)} onUpdate={fetchLeads} salesReps={salesReps} funnels={funnels} />
      )}
    </div>
  );
};

export { LeadsSection };
