import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Flame, TrendingUp, Snowflake, Search, Loader2, User, Clock, Zap, Video, Users, Eye, CreditCard, Calendar } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const categoryConfig = {
  hot: { label: 'Hot', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: Flame, iconColor: 'text-red-500' },
  warm: { label: 'Warm', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: TrendingUp, iconColor: 'text-amber-500' },
  cold: { label: 'Cold', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Snowflake, iconColor: 'text-blue-400' },
};

const LeadScoringSection = () => {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedLead, setExpandedLead] = useState(null);

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/lead-scores`, { withCredentials: true });
      setLeads(res.data.leads || []);
      setStats(res.data.stats || {});
    } catch (err) {
      console.error('Failed to fetch lead scores:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = leads.filter(lead => {
    if (filterCategory !== 'all' && lead.category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return lead.name?.toLowerCase().includes(q) || lead.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const ScoreBar = ({ score }) => {
    const maxScore = 150;
    const pct = Math.min((score / maxScore) * 100, 100);
    const color = score >= 70 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#3b82f6';
    return (
      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6" data-testid="lead-scoring-section">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Free Trial', value: stats.total, icon: Users, color: 'text-slate-700', bg: 'bg-white' },
          { label: 'Hot Leads', value: stats.hot, icon: Flame, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Warm Leads', value: stats.warm, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cold Leads', value: stats.cold, icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} rounded-xl border border-slate-200 p-4`}>
            <div className="flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="pl-9" />
        </div>
        <div className="flex gap-1">
          {['all', 'hot', 'warm', 'cold'].map(cat => (
            <Button key={cat} size="sm" variant={filterCategory === cat ? 'default' : 'outline'}
              onClick={() => setFilterCategory(cat)} className="capitalize text-xs">
              {cat === 'all' ? 'All' : `${cat} (${stats[cat] || 0})`}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads}><Loader2 className="w-3.5 h-3.5 mr-1" />Refresh</Button>
      </div>

      {/* Lead List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_80px_80px_200px] gap-4 px-5 py-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>User</span>
          <span>Score</span>
          <span>Category</span>
          <span>Trial Left</span>
          <span>Key Activity</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No free trial users found</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(lead => {
              const config = categoryConfig[lead.category];
              const b = lead.breakdown || {};
              return (
                <div key={lead.user_id}>
                  <div className="grid grid-cols-[1fr_100px_80px_80px_200px] gap-4 px-5 py-3 items-center hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => setExpandedLead(expandedLead === lead.user_id ? null : lead.user_id)}>
                    {/* User */}
                    <div className="flex items-center gap-3 min-w-0">
                      {lead.picture ? (
                        <img src={lead.picture} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{lead.name}</p>
                        <p className="text-xs text-slate-400 truncate">{lead.email}</p>
                      </div>
                    </div>
                    {/* Score */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{lead.score}</span>
                      <ScoreBar score={lead.score} />
                    </div>
                    {/* Category */}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${config.bg}`}>
                      <config.icon className={`w-3 h-3 ${config.iconColor}`} />
                      {config.label}
                    </span>
                    {/* Trial Days */}
                    <span className={`text-sm font-medium ${lead.days_left <= 1 ? 'text-red-600' : lead.days_left <= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {lead.days_left !== null ? `${lead.days_left}d left` : '-'}
                    </span>
                    {/* Key Activity */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {b.drills_completed && <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{b.drills_completed.count} drills</span>}
                      {b.videos_watched && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{b.videos_watched.count} videos</span>}
                      {b.peer_sessions && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{b.peer_sessions.count} peers</span>}
                      {b.days_returned && <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{b.days_returned.count} visits</span>}
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {expandedLead === lead.user_id && (
                    <div className="px-5 pb-4 pt-1 bg-slate-50/50">
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                        {b.peer_profile_listed && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Users className="w-3.5 h-3.5 text-green-500" /><span>Listed for peer practice <strong>+{b.peer_profile_listed}</strong></span></div>}
                        {b.drills_completed && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Zap className="w-3.5 h-3.5 text-purple-500" /><span>{b.drills_completed.count} drills <strong>+{b.drills_completed.points}</strong></span></div>}
                        {b.videos_watched && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Video className="w-3.5 h-3.5 text-blue-500" /><span>{b.videos_watched.count} videos <strong>+{b.videos_watched.points}</strong></span></div>}
                        {b.peer_profile_listed && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Users className="w-3.5 h-3.5 text-green-500" /><span>Listed for peer practice <strong>+{b.peer_profile_listed}</strong></span></div>}
                        {b.peer_sessions && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Calendar className="w-3.5 h-3.5 text-green-500" /><span>{b.peer_sessions.count} peer sessions <strong>+{b.peer_sessions.points}</strong></span></div>}
                        {b.days_returned && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Clock className="w-3.5 h-3.5 text-slate-500" /><span>{b.days_returned.count} day returns <strong>+{b.days_returned.points}</strong></span></div>}
                        {b.coaching_page_viewed && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Eye className="w-3.5 h-3.5 text-amber-500" /><span>Coaching viewed {b.coaching_page_viewed.count}x <strong>+{b.coaching_page_viewed.points}</strong></span></div>}
                        {b.book_now_clicked && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><Calendar className="w-3.5 h-3.5 text-amber-500" /><span>Book Now {b.book_now_clicked.count}x <strong>+{b.book_now_clicked.points}</strong></span></div>}
                        {b.pricing_modal_opened && <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border"><CreditCard className="w-3.5 h-3.5 text-amber-500" /><span>Pricing opened {b.pricing_modal_opened.count}x <strong>+{b.pricing_modal_opened.points}</strong></span></div>}
                      </div>
                      {lead.phone && <p className="mt-2 text-xs text-slate-500">Phone: {lead.phone}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadScoringSection;
