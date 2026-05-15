import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  MessageSquare, RefreshCw, Filter, Search, User, Mail, Calendar,
  Phone, GraduationCap, Eye, CheckCircle, Clock, AlertCircle, Trash2
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
    read: 'bg-amber-100 text-amber-700',
    responded: 'bg-green-100 text-green-700'
  };
  
  const icons = {
    new: AlertCircle,
    read: Clock,
    responded: CheckCircle
  };
  
  const Icon = icons[status] || AlertCircle;
  
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full ${styles[status] || styles.new}`}>
      <Icon className="w-3 h-3" />
      {status?.toUpperCase()}
    </span>
  );
};

const ContactSubmissionsTab = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, contact: 0, new: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('form_type', 'contact');
      if (statusFilter) params.append('status', statusFilter);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/forms/submissions?${params}`,
        { withCredentials: true }
      );
      
      setSubmissions(res.data.submissions || []);
      setCounts(res.data.counts || { total: 0, contact: 0, new: 0 });
    } catch (error) {
      console.error('Failed to fetch contact submissions:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Update status
  const updateStatus = async (submissionId, newStatus) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/forms/submissions/${submissionId}/status?status=${newStatus}`,
        {},
        { withCredentials: true }
      );
      fetchSubmissions();
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission({ ...selectedSubmission, status: newStatus });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Delete submission
  const deleteSubmission = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;
    
    try {
      setDeleting(true);
      await axios.delete(
        `${BACKEND_URL}/api/admin/forms/submissions/${submissionId}`,
        { withCredentials: true }
      );
      fetchSubmissions();
      setSelectedSubmission(null);
    } catch (error) {
      console.error('Failed to delete submission:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(search) ||
      s.email?.toLowerCase().includes(search) ||
      s.query?.toLowerCase().includes(search) ||
      s.college?.toLowerCase().includes(search)
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
          <h2 className="text-2xl font-bold text-slate-900">Contact Form Submissions</h2>
          <p className="text-slate-500 mt-1">Manage contact form submissions from the website</p>
        </div>
        <Button
          onClick={fetchSubmissions}
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
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Submissions</p>
              <p className="text-xl font-bold text-slate-900">{counts.contact || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">New (Unread)</p>
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
              <p className="text-sm text-slate-500">Responded</p>
              <p className="text-xl font-bold text-slate-900">
                {(counts.contact || 0) - (counts.new || 0)}
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
            placeholder="Search by name, email, college, or query..."
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
          <option value="read">Read</option>
          <option value="responded">Responded</option>
        </select>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No contact submissions found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">College</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{submission.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">{submission.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {submission.college ? (
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 truncate max-w-[150px]">{submission.college}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={submission.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDate(submission.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSubmission(submission);
                          if (submission.status === 'new') {
                            updateStatus(submission.id, 'read');
                          }
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteSubmission(submission.id)}
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

      {/* Submission Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-0">
          {selectedSubmission && (
            <>
              {/* Header band */}
              <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50/60 to-transparent">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <DialogTitle className="text-xl font-semibold text-slate-900 truncate">
                        {selectedSubmission.name}
                      </DialogTitle>
                      <DialogDescription className="mt-1 text-sm text-slate-500">
                        Submitted {formatDate(selectedSubmission.created_at)}
                      </DialogDescription>
                    </div>
                    <div className="shrink-0"><StatusBadge status={selectedSubmission.status} /></div>
                  </div>
                </DialogHeader>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Contact info */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Contact</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 bg-slate-50 rounded-lg p-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Email</p>
                      <a href={`mailto:${selectedSubmission.email}`} className="text-sm text-blue-600 hover:underline break-all">
                        {selectedSubmission.email}
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Phone</p>
                      <p className="text-sm text-slate-900">{selectedSubmission.phone || '—'}</p>
                    </div>
                    {selectedSubmission.college && (
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">College / University</p>
                        <p className="text-sm text-slate-900">{selectedSubmission.college}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Query */}
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Query</h4>
                  <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {selectedSubmission.query || <span className="text-slate-400">No message provided</span>}
                  </div>
                </section>
              </div>

              {/* Footer actions */}
              <div className="px-6 py-4 border-t bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {selectedSubmission.status !== 'responded' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => updateStatus(selectedSubmission.id, 'responded')}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark as Responded
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`mailto:${selectedSubmission.email}?subject=Re: Your Query to gradnext`, '_blank')}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Reply via Email
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => deleteSubmission(selectedSubmission.id)}
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

export default ContactSubmissionsTab;
