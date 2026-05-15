import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, MessageSquarePlus, Eye, Trash2,
  Inbox, RotateCw, CheckCircle2, PhoneCall,
} from 'lucide-react';
import { apiCall } from '../crmApi';
import { sourceColors, sourceLabels } from '../crmConstants';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { LogContactModal } from '../modals/LogContactModal';
import { LeadDetailModal } from '../modals/LeadDetailModal';
import { WonPlanModal } from '../modals/WonPlanModal';

/* ── call outcome badge config ── */
const OUTCOME_STYLES = {
  reached:        { label: 'Reached',        bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  interested:     { label: 'Interested',     bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  not_reached:    { label: 'Not Reached',    bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' },
  busy:           { label: 'Busy',           bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  voicemail:      { label: 'Voicemail',      bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  not_interested: { label: 'Not Interested', bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
};

function OutcomeBadge({ outcome }) {
  const s = OUTCOME_STYLES[outcome] || { label: outcome || '—', bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const GROUPS = [
  {
    key: 'to_be_reached_out',
    title: 'To be reached out',
    subtitle: 'Fresh leads — never contacted yet. Top of the list = waiting the longest.',
    icon: Inbox,
    accent: 'text-amber-700',
    pill: 'orange',
  },
  {
    key: 'follow_up',
    title: 'Follow up',
    subtitle: "You've had at least one touch. Sorted by next follow-up date.",
    icon: RotateCw,
    accent: 'text-blue-700',
    pill: 'blue',
  },
  {
    key: 'closed',
    title: 'Closed leads',
    subtitle: 'Won or lost. Stays here for reference & reporting.',
    icon: CheckCircle2,
    accent: 'text-emerald-700',
    pill: 'green',
  },
];

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); } catch { return '—'; }
};

const ReachOutsSection = ({ salesReps, funnels, isAdmin, crmUser }) => {
  const [data, setData] = useState({ groups: { to_be_reached_out: [], follow_up: [], closed: [] }, totals: {} });
  const [loading, setLoading] = useState(true);
  const [filterRep, setFilterRep] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState('any');
  const [createdFilter, setCreatedFilter] = useState('any');
  const [monthFilter, setMonthFilter] = useState('any');
  const [openGroup, setOpenGroup] = useState({ to_be_reached_out: true, follow_up: true, closed: false });
  const [logFor, setLogFor] = useState(null);
  const [wonFor, setWonFor] = useState(null);
  const [showLeadDetail, setShowLeadDetail] = useState(null);

  // Generate last 12 months for month filter dropdown
  const monthOptions = React.useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      months.push({ value, label });
    }
    return months;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (isAdmin && filterRep) params.set('assigned_to', filterRep);
      if (followUpFilter && followUpFilter !== 'any') params.set('follow_up_filter', followUpFilter);
      if (createdFilter && createdFilter !== 'any') params.set('created_filter', createdFilter);
      if (monthFilter && monthFilter !== 'any') params.set('month_filter', monthFilter);
      const res = await apiCall.get(`/api/crm/leads/reach-outs?${params.toString()}`);
      setData(res.data || { groups: {}, totals: {} });
    } catch (err) {
      console.error('Failed to fetch reach-outs', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterRep, followUpFilter, createdFilter, monthFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtersActive = followUpFilter !== 'any' || createdFilter !== 'any' || monthFilter !== 'any' || (isAdmin && filterRep);

  const clearFilters = () => {
    setFilterRep('');
    setFollowUpFilter('any');
    setCreatedFilter('any');
    setMonthFilter('any');
  };

  const handleStatusChange = async (lead, newStatus) => {
    if (newStatus === 'won') { setWonFor(lead); return; }
    try {
      await apiCall.put(`/api/crm/leads/${lead.id}`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update');
    }
  };

  const handleDelete = async (leadId) => {
    if (!window.confirm('Delete this lead permanently? This cannot be undone.')) return;
    try {
      await apiCall.delete(`/api/crm/leads/${leadId}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed');
    }
  };

  const grandTotal = Object.values(data.totals || {}).reduce((s, n) => s + n, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reach Outs</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Your action center. Three sections: leads to contact, leads being followed up, and closed leads.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select
              value={filterRep}
              onChange={e => setFilterRep(e.target.value)}
              data-testid="reach-outs-rep-filter"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">All sales reps</option>
              {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <Badge variant="blue">{grandTotal} total</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Follow-up</label>
            <select
              value={followUpFilter}
              onChange={e => setFollowUpFilter(e.target.value)}
              data-testid="reach-outs-followup-filter"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="any">Any time</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="this_week">This week (next 7 days)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Created</label>
            <select
              value={createdFilter}
              onChange={e => { setCreatedFilter(e.target.value); if (e.target.value !== 'any') setMonthFilter('any'); }}
              data-testid="reach-outs-created-filter"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="any">Any time</option>
              <option value="today">Today</option>
              <option value="this_week">This week (last 7 days)</option>
              <option value="this_month">This month</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Month</label>
            <select
              value={monthFilter}
              onChange={e => { setMonthFilter(e.target.value); if (e.target.value !== 'any') setCreatedFilter('any'); }}
              data-testid="reach-outs-month-filter"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="any">All months</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <button
              onClick={clearFilters}
              data-testid="reach-outs-clear-filters"
              className="text-xs font-medium text-slate-500 hover:text-slate-700 underline decoration-dotted underline-offset-2 ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {grandTotal === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filtersActive ? 'No leads match the filters' : 'No leads yet'}
          description={filtersActive
            ? 'Try changing or clearing the filters above.'
            : "When new leads come in (from signups, B2B import, or manual entry), they'll show up here grouped by action stage."}
          action={filtersActive ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              data-testid="reach-outs-empty-clear-btn"
            >
              Clear filters
            </button>
          ) : null}
        />
      ) : (
        <div className="space-y-4">
          {GROUPS.map(g => {
            const items = data.groups[g.key] || [];
            const Icon = g.icon;
            const isOpen = openGroup[g.key];
            return (
              <div key={g.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`reach-outs-group-${g.key}`}>
                {/* Group Header */}
                <button
                  onClick={() => setOpenGroup(o => ({ ...o, [g.key]: !o[g.key] }))}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 border-b border-slate-100"
                  data-testid={`reach-outs-group-toggle-${g.key}`}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <Icon className={`w-5 h-5 ${g.accent} flex-shrink-0`} />
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${g.accent}`}>{g.title}</p>
                      <p className="text-xs text-slate-500 hidden sm:block">{g.subtitle}</p>
                    </div>
                  </div>
                  <Badge variant={g.pill}>{items.length}</Badge>
                </button>

                {/* Group Body — compact table */}
                {isOpen && (items.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">Nothing here right now.</div>
                ) : (
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[14%]" />{/* Name */}
                      <col className="w-[16%]" />{/* Contact */}
                      <col className="w-[7%]"  />{/* Created */}
                      <col className="w-[13%]" />{/* Last Contacted */}
                      {g.key === 'follow_up' && <col className="w-[7%]" />}{/* Next f-up */}
                      <col className="w-[8%]" />{/* Source */}
                      <col className="w-[8%]" />{/* Assigned */}
                      <col className="w-[9%]" />{/* Status/Plan */}
                      <col className={g.key === 'follow_up' ? "w-[12%]" : "w-[18%]"} />{/* Actions */}
                    </colgroup>
                    <thead>
                      <tr className="text-left text-slate-500 bg-slate-50/40 border-b border-slate-100 text-xs uppercase tracking-wide">
                        <th className="pl-5 py-2.5 font-medium">Name</th>
                        <th className="py-2.5 font-medium">Contact</th>
                        <th className="py-2.5 font-medium">Created</th>
                        <th className="py-2.5 font-medium">Last Contacted</th>
                        {g.key === 'follow_up' && <th className="py-2.5 font-medium">Next f-up</th>}
                        <th className="py-2.5 font-medium">Source</th>
                        <th className="py-2.5 font-medium">Assigned</th>
                        <th className="py-2.5 font-medium">{g.key === 'closed' ? 'Plan' : 'Status'}</th>
                        <th className="py-2.5 pr-5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map(lead => (
                        <tr key={lead.id} className="hover:bg-slate-50/40 align-top" data-testid={`reach-out-row-${lead.id}`}>
                          {/* Name + Company */}
                          <td className="pl-5 py-3">
                            <button onClick={() => setShowLeadDetail(lead.id)} className="text-left w-full">
                              <p className="font-medium text-slate-900 hover:text-blue-600 truncate" title={lead.name}>{lead.name}</p>
                              {lead.company && <p className="text-xs text-slate-400 truncate" title={lead.company}>{lead.company}</p>}
                            </button>
                          </td>

                          {/* Email + Phone (stacked, clickable) */}
                          <td className="py-3">
                            <div className="space-y-0.5">
                              {lead.email ? (
                                <a href={`mailto:${lead.email}`} className="block text-xs text-slate-600 hover:text-purple-600 truncate" title={lead.email}>{lead.email}</a>
                              ) : <span className="block text-xs text-slate-300">—</span>}
                              {lead.phone ? (
                                <a href={`tel:${lead.phone}`} className="block text-xs text-slate-500 hover:text-blue-600 truncate" title={lead.phone}>{lead.phone}</a>
                              ) : <span className="block text-xs text-slate-300">—</span>}
                            </div>
                          </td>

                          {/* Created date */}
                          <td className="py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(lead.created_at)}</td>

                          {/* Last Contacted — date + call outcome badge */}
                          <td className="py-3 min-w-0">
                            {lead.last_contacted_at || lead.last_call_date ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-slate-700 font-medium whitespace-nowrap">
                                  {fmtDate(lead.last_contacted_at || lead.last_call_date)}
                                </p>
                                {lead.last_call_outcome && <OutcomeBadge outcome={lead.last_call_outcome} />}
                                {lead.call_count > 1 && (
                                  <p className="text-[10px] text-slate-400">{lead.call_count} calls</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">Never</span>
                            )}
                          </td>

                          {/* Next follow-up (only for follow_up group) */}
                          {g.key === 'follow_up' && (
                            <td className="py-3 text-xs whitespace-nowrap">
                              {lead.next_follow_up_date ? (
                                <span className="text-blue-600 font-medium">{fmtDate(lead.next_follow_up_date)}</span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          )}

                          {/* Source */}
                          <td className="py-3">
                            <Badge variant={sourceColors[lead.source] || 'default'}>
                              <span className="truncate" title={sourceLabels[lead.source] || lead.source}>
                                {sourceLabels[lead.source] || lead.source}
                              </span>
                            </Badge>
                          </td>

                          {/* Assigned to */}
                          <td className="py-3">
                            <span className="text-xs text-slate-500 truncate" title={lead.assigned_to_name || 'Unassigned'}>
                              {lead.assigned_to_name || <span className="text-slate-300">Unassigned</span>}
                            </span>
                          </td>

                          {/* Status (Plan for closed) */}
                          <td className="py-3 min-w-0">
                            {g.key === 'closed' ? (
                              lead.won_plan_name ? (
                                <Badge variant="green">
                                  <span className="truncate" title={`${lead.won_plan_name}${lead.won_amount ? ` · ₹${Number(lead.won_amount).toLocaleString('en-IN')}` : ''}`}>
                                    {lead.won_plan_name}
                                  </span>
                                </Badge>
                              ) : <span className="text-xs text-slate-300">—</span>
                            ) : (
                              <select
                                value={lead.status}
                                onChange={e => handleStatusChange(lead, e.target.value)}
                                data-testid={`reach-out-status-${lead.id}`}
                                className={`max-w-full text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none truncate
                                  ${lead.status === 'won' ? 'bg-emerald-50 text-emerald-700'
                                  : lead.status === 'lost' ? 'bg-red-50 text-red-700'
                                  : 'bg-slate-100 text-slate-600'}`}
                              >
                                <option value="active">Active</option>
                                <option value="won">Won</option>
                                <option value="lost">Lost</option>
                              </select>
                            )}
                          </td>

                          {/* Actions — Log, View, Delete */}
                          <td className="py-3 pr-5 min-w-0">
                            <div className="flex items-center justify-end gap-1">
                              {g.key !== 'closed' && (
                                <button
                                  onClick={() => setLogFor(lead)}
                                  data-testid={`reach-out-log-btn-${lead.id}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-shrink-0"
                                >
                                  <MessageSquarePlus className="w-3.5 h-3.5" /> Log
                                </button>
                              )}
                              <button
                                onClick={() => setShowLeadDetail(lead.id)}
                                title="View details"
                                data-testid={`reach-out-view-btn-${lead.id}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(lead.id)}
                                  title="Delete lead"
                                  data-testid={`reach-out-delete-btn-${lead.id}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {logFor && (
        <LogContactModal
          lead={logFor}
          onClose={() => setLogFor(null)}
          onSuccess={() => { setLogFor(null); fetchData(); }}
        />
      )}
      {wonFor && (
        <WonPlanModal
          lead={wonFor}
          onClose={() => setWonFor(null)}
          onSuccess={() => { setWonFor(null); fetchData(); }}
        />
      )}
      {showLeadDetail && (
        <LeadDetailModal
          leadId={showLeadDetail}
          onClose={() => setShowLeadDetail(null)}
          onUpdate={fetchData}
          salesReps={salesReps}
          funnels={funnels}
        />
      )}
    </div>
  );
};

export { ReachOutsSection };
