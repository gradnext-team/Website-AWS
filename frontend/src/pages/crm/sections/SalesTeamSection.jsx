import React, { useState } from 'react';
import axios from 'axios';
import { Users, UserPlus, Edit, X } from 'lucide-react';
import { apiCall, BACKEND_URL } from '../crmApi';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';

const SalesTeamSection = ({ salesReps, fetchSalesReps }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editRep, setEditRep] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const handleResendInvite = async (repId) => {
    try {
      setActionLoading(repId);
      await axios.post(`${BACKEND_URL}/api/crm/auth/resend-invite/${repId}`, {}, { withCredentials: true });
      alert('Invite email resent!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to resend invite');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Sales Team</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <UserPlus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {salesReps.length === 0 ? (
        <EmptyState icon={Users} title="No team members yet" description="Add sales reps to start assigning leads." action={
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Add Member</button>
        } />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {salesReps.map(rep => (
            <div key={rep.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {rep.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{rep.name}</p>
                    <p className="text-xs text-slate-500">{rep.email}</p>
                  </div>
                </div>
                <button onClick={() => setEditRep(rep)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant={rep.role === 'both' ? 'purple' : rep.role === 'admin' ? 'orange' : 'blue'}>
                  {rep.role === 'both' ? 'Admin + Sales' : rep.role === 'admin' ? 'Admin' : 'Sales Rep'}
                </Badge>
                {rep.account_setup ? (
                  <Badge variant="green">Active</Badge>
                ) : (
                  <Badge variant="yellow">Invite Pending</Badge>
                )}
                <span className="text-xs text-slate-400 ml-auto">{rep.leads_count || 0} leads</span>
              </div>
              {!rep.account_setup && (
                <button
                  onClick={() => handleResendInvite(rep.id)}
                  disabled={actionLoading === rep.id}
                  className="mt-3 w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === rep.id ? 'Sending...' : 'Resend Invite Email'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(showAdd || editRep) && (
        <SalesRepFormModal rep={editRep} onClose={() => { setShowAdd(false); setEditRep(null); }} onSuccess={() => { setShowAdd(false); setEditRep(null); fetchSalesReps(); }} />
      )}
    </div>
  );
};

const SalesRepFormModal = ({ rep, onClose, onSuccess }) => {
  const [form, setForm] = useState({ name: rep?.name || '', email: rep?.email || '', phone: rep?.phone || '', role: rep?.role || 'sales_rep' });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPw, setResettingPw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.email) return alert('Name and email are required');
    try {
      setSaving(true);
      if (rep) {
        await apiCall.put(`/api/crm/sales-reps/${rep.id}`, form);
      } else {
        await apiCall.post('/api/crm/sales-reps', form);
      }
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rep) return;
    if (!window.confirm('Deactivate this team member?')) return;
    try {
      await apiCall.delete(`/api/crm/sales-reps/${rep.id}`);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed');
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) return alert('Password must be at least 6 characters');
    try {
      setResettingPw(true);
      await axios.put(`${BACKEND_URL}/api/crm/auth/admin-reset-password/${rep.id}`, { new_password: newPassword }, { withCredentials: true });
      alert('Password reset successfully!');
      setNewPassword('');
      setShowResetPw(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setResettingPw(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={rep ? 'Edit Team Member' : 'Add Team Member'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Email *</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="sales_rep">Sales Rep</option>
              <option value="admin">Admin</option>
              <option value="both">Admin + Sales Rep</option>
            </select>
          </div>
        </div>

        {/* Admin Password Reset */}
        {rep && rep.account_setup && (
          <div className="border-t border-slate-100 pt-4">
            {!showResetPw ? (
              <button onClick={() => setShowResetPw(true)} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                Reset Password
              </button>
            ) : (
              <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 space-y-2">
                <label className="text-xs font-medium text-slate-600">New Password (min 6 chars)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button onClick={handleResetPassword} disabled={resettingPw || newPassword.length < 6}
                    className="px-3 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium">
                    {resettingPw ? '...' : 'Reset'}
                  </button>
                  <button onClick={() => { setShowResetPw(false); setNewPassword(''); }}
                    className="px-2 py-2 text-slate-400 hover:text-slate-600 text-sm rounded-lg hover:bg-slate-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {rep && <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600 font-medium">Deactivate</button>}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : rep ? 'Save' : 'Add Member'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export { SalesTeamSection };
