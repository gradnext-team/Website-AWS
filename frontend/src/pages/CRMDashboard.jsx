import React, { useState, useEffect, useCallback, Suspense } from 'react';
import axios from 'axios';
import {
  BarChart3, Users, Target, Upload, ChevronDown, ChevronRight, UserPlus,
  ArrowLeft, Mail, Clock, CalendarClock, Loader2,
} from 'lucide-react';

import { BACKEND_URL, apiCall } from './crm/crmApi';

// ── Lazy-loaded CRM sections ──
const DashboardSection = React.lazy(() => import('./crm/sections/DashboardSection').then(m => ({ default: m.DashboardSection })));
const LeadsSection = React.lazy(() => import('./crm/sections/LeadsSection').then(m => ({ default: m.LeadsSection })));
const ReachOutsSection = React.lazy(() => import('./crm/sections/ReachOutsSection').then(m => ({ default: m.ReachOutsSection })));
const FunnelsSection = React.lazy(() => import('./crm/sections/FunnelsSection').then(m => ({ default: m.FunnelsSection })));
const WorkflowSection = React.lazy(() => import('./crm/sections/WorkflowSection').then(m => ({ default: m.WorkflowSection })));
const SalesTeamSection = React.lazy(() => import('./crm/sections/SalesTeamSection').then(m => ({ default: m.SalesTeamSection })));
const ImportSection = React.lazy(() => import('./crm/sections/ImportSection').then(m => ({ default: m.ImportSection })));

const CRMDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [salesReps, setSalesReps] = useState([]);
  const [funnels, setFunnels] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [crmUser, setCrmUser] = useState(null);

  // Bootstrap: single API call that returns user + sales_reps + funnels.
  // Replaces 3 sequential roundtrips (/auth/me, /sales-reps, /funnels) for a
  // much snappier initial CRM load — especially on production behind a CDN.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/crm/bootstrap`, { withCredentials: true });
        if (res.data?.user) {
          setIsAuthed(true);
          setCrmUser(res.data.user);
          setSalesReps(res.data.sales_reps || []);
          setFunnels(res.data.funnels || []);
        } else {
          setIsAuthed(false);
        }
      } catch {
        setIsAuthed(false);
      } finally {
        setAuthChecked(true);
      }
    };
    bootstrap();
  }, []);

  const fetchSalesReps = useCallback(async () => {
    try {
      const res = await apiCall.get('/api/crm/sales-reps');
      setSalesReps(res.data.sales_reps);
    } catch (err) {
      console.error('Failed to fetch reps', err);
    }
  }, []);

  const fetchFunnels = useCallback(async () => {
    try {
      const res = await apiCall.get('/api/crm/funnels');
      setFunnels(res.data.funnels);
    } catch (err) {
      console.error('Failed to fetch funnels', err);
    }
  }, []);

  // Note: salesReps + funnels are loaded by the /bootstrap call above.
  // We keep fetchSalesReps / fetchFunnels for tabs that mutate them (Sales Team, Funnels)
  // so they can refresh on demand without re-running the full bootstrap.

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/crm/auth/logout`, {}, { withCredentials: true });
    } catch { /* ignore */ }
    setIsAuthed(false);
    setCrmUser(null);
    window.location.href = '/crm/login';
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-slate-500">Loading CRM...</p>
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-md w-full mx-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mx-auto mb-5">
            <Target className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">CRM Access Required</h2>
          <p className="text-sm text-slate-500 mb-6">Please log in to access the CRM dashboard.</p>
          <div className="flex flex-col gap-3">
            <a href="/crm/login" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Mail className="w-4 h-4" /> Sales Rep Login
            </a>
            <a href="/admin" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Admin Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = crmUser?.is_admin === true;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'reach-outs', label: 'Reach Outs', icon: CalendarClock },
    ...(isAdmin ? [
      { id: 'funnels', label: 'Funnels', icon: Target },
      { id: 'workflow', label: 'Workflow', icon: Clock },
    ] : []),
    ...(isAdmin ? [
      { id: 'team', label: 'Sales Team', icon: UserPlus },
      { id: 'import', label: 'Import & Sync', icon: Upload },
    ] : []),
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">CRM</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              data-testid={`crm-nav-${item.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {crmUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{crmUser?.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{isAdmin ? 'Admin' : 'Sales Rep'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <a href="/admin" className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-1.5 rounded-lg hover:bg-slate-50">
                  <ArrowLeft className="w-3 h-3" /> Admin
                </a>
              )}
              <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-1 text-xs text-red-500 hover:text-red-600 py-1.5 rounded-lg hover:bg-red-50">
                Logout
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /><span className="ml-3 text-slate-500 text-sm">Loading…</span></div>}>
          {activeSection === 'dashboard' && <DashboardSection />}
          {activeSection === 'leads' && <LeadsSection salesReps={salesReps} funnels={funnels} isAdmin={isAdmin} crmUser={crmUser} />}
          {activeSection === 'reach-outs' && <ReachOutsSection salesReps={salesReps} funnels={funnels} isAdmin={isAdmin} crmUser={crmUser} />}
          {activeSection === 'funnels' && isAdmin && <FunnelsSection funnels={funnels} fetchFunnels={fetchFunnels} />}
          {activeSection === 'workflow' && isAdmin && <WorkflowSection funnels={funnels} />}
          {activeSection === 'team' && isAdmin && <SalesTeamSection salesReps={salesReps} fetchSalesReps={fetchSalesReps} />}
          {activeSection === 'import' && isAdmin && <ImportSection />}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default CRMDashboard;
