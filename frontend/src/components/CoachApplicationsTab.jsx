import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Briefcase, RefreshCw, Search, User, Linkedin, Clock,
  Eye, CheckCircle, AlertCircle, Trash2, ExternalLink, Calendar
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const StatusBadge = ({ status }) => {
  const styles = {
    new: 'bg-red-100 text-red-700',
    reviewed: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-slate-100 text-slate-700'
  };
  
  const icons = {
    new: AlertCircle,
    reviewed: Clock,
    approved: CheckCircle,
    rejected: AlertCircle
  };
  
  const Icon = icons[status] || AlertCircle;
  
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${styles[status] || styles.new}`}>
      <Icon className="w-3 h-3" />
      {status?.toUpperCase()}
    </span>
  );
};

const CoachApplicationsTab = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, new: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/coach-applications?${params}`,
        { withCredentials: true }
      );
      
      setApplications(res.data.applications || []);
      setCounts(res.data.counts || { total: 0, new: 0 });
    } catch (error) {
      console.error('Failed to fetch coach applications:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Update status
  const updateStatus = async (applicationId, newStatus) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/coach-applications/${applicationId}/status?status=${newStatus}`,
        {},
        { withCredentials: true }
      );
      fetchApplications();
      if (selectedApplication?.id === applicationId) {
        setSelectedApplication({ ...selectedApplication, status: newStatus });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Delete application
  const deleteApplication = async (applicationId) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    
    try {
      setDeleting(true);
      await axios.delete(
        `${BACKEND_URL}/api/admin/coach-applications/${applicationId}`,
        { withCredentials: true }
      );
      fetchApplications();
      setSelectedApplication(null);
    } catch (error) {
      console.error('Failed to delete application:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Filter applications
  const filteredApplications = applications.filter(a => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      a.name?.toLowerCase().includes(search) ||
      a.consulting_company?.toLowerCase().includes(search) ||
      a.last_position?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Coach Applications</h2>
          <p className="text-slate-500 mt-1">Manage coach/mentor applications</p>
        </div>
        <Button
          onClick={fetchApplications}
          variant="outline"
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Applications</p>
              <p className="text-xl font-bold text-slate-900">{counts.total || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">New (Pending Review)</p>
              <p className="text-xl font-bold text-slate-900">{counts.new || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Approved</p>
              <p className="text-xl font-bold text-slate-900">
                {applications.filter(a => a.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, company, or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No coach applications found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Experience</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApplications.map((application) => (
                <tr key={application.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{application.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">{application.consulting_company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {application.last_position}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {application.years_in_consulting} years
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDate(application.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedApplication(application);
                          if (application.status === 'new') {
                            updateStatus(application.id, 'reviewed');
                          }
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {application.linkedin_profile && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(application.linkedin_profile, '_blank')}
                        >
                          <Linkedin className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteApplication(application.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Application Detail Modal */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-0">
          {selectedApplication && (
            <>
              {/* Header band */}
              <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50/60 to-transparent">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <DialogTitle className="text-xl font-semibold text-slate-900 truncate">
                        {selectedApplication.name}
                      </DialogTitle>
                      <DialogDescription className="mt-1 text-sm text-slate-500">
                        Submitted {formatDate(selectedApplication.created_at)}
                      </DialogDescription>
                    </div>
                    <div className="shrink-0"><StatusBadge status={selectedApplication.status} /></div>
                  </div>
                </DialogHeader>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Profile */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Profile</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 bg-slate-50 rounded-lg p-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Consulting Company</p>
                      <p className="text-sm text-slate-900 mt-0.5">{selectedApplication.consulting_company || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Last Position</p>
                      <p className="text-sm text-slate-900 mt-0.5">{selectedApplication.last_position || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Years in Consulting</p>
                      <p className="text-sm text-slate-900 mt-0.5">
                        {selectedApplication.years_in_consulting != null ? `${selectedApplication.years_in_consulting} years` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">LinkedIn</p>
                      {selectedApplication.linkedin_profile ? (
                        <a
                          href={selectedApplication.linkedin_profile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          View Profile <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="text-sm text-slate-400 mt-0.5">—</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Why Mentor */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Why they want to coach
                  </h4>
                  <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {selectedApplication.why_mentor || <span className="text-slate-400">—</span>}
                  </div>
                </section>

                {/* Mentoring Experience */}
                {selectedApplication.mentoring_experience && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Previous mentoring experience
                    </h4>
                    <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-800 whitespace-pre-wrap break-words">
                      {selectedApplication.mentoring_experience}
                    </div>
                  </section>
                )}
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {selectedApplication.status !== 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => updateStatus(selectedApplication.id, 'approved')}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  )}
                  {selectedApplication.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-slate-600 border-slate-200 hover:bg-slate-50"
                      onClick={() => updateStatus(selectedApplication.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteApplication(selectedApplication.id)}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachApplicationsTab;
