import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText, Trash2, Eye, Loader2, Mail, Phone, GraduationCap,
  CheckCircle2, Clock, MessageSquare, ChevronDown
} from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FormsSection = () => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({});
  const [formTypeFilter, setFormTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [formTypeFilter, statusFilter]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (formTypeFilter !== 'all') params.append('form_type', formTypeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/forms/submissions?${params}`, {
        withCredentials: true
      });
      setSubmissions(res.data.submissions || []);
      setCounts(res.data.counts || {});
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (submissionId, status) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/forms/submissions/${submissionId}/status?status=${status}`,
        {},
        { withCredentials: true }
      );
      await fetchSubmissions();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDelete = async (submissionId) => {
    if (!window.confirm('Are you sure you want to delete this submission?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/forms/submissions/${submissionId}`, {
        withCredentials: true
      });
      await fetchSubmissions();
    } catch (err) {
      console.error('Error deleting submission:', err);
    }
  };

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);
    setShowDetailModal(true);
    // Mark as read if new
    if (submission.status === 'new') {
      handleUpdateStatus(submission.id, 'read');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-yellow-100 text-yellow-800',
      read: 'bg-blue-100 text-blue-800',
      responded: 'bg-green-100 text-green-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.new}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getFormTypeBadge = (formType) => {
    const styles = {
      contact: 'bg-purple-100 text-purple-800'
    };
    const labels = {
      contact: 'Contact Query'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[formType] || 'bg-slate-100 text-slate-800'}`}>
        {labels[formType] || formType}
      </span>
    );
  };

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Form Submissions</h1>
          <p className="text-slate-500">View and manage all form submissions from the website</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-slate-100 text-slate-800">
          <p className="text-2xl font-bold">{counts.total || 0}</p>
          <p className="text-sm">Total Submissions</p>
        </div>
        <div className="p-4 rounded-lg bg-yellow-100 text-yellow-800">
          <p className="text-2xl font-bold">{counts.new || 0}</p>
          <p className="text-sm">New/Unread</p>
        </div>
        <div className="p-4 rounded-lg bg-purple-100 text-purple-800">
          <p className="text-2xl font-bold">{counts.contact || 0}</p>
          <p className="text-sm">Contact Queries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Form Type:</Label>
          <Select value={formTypeFilter} onValueChange={setFormTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="contact">Contact Queries</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Date</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No form submissions found
                </td>
              </tr>
            ) : (
              submissions.map(submission => (
                <tr key={submission.id} className={`border-t hover:bg-slate-50 ${submission.status === 'new' ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewDetails(submission)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {submission.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{submission.email}</td>
                  <td className="px-4 py-3">{getFormTypeBadge(submission.form_type)}</td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{formatDate(submission.created_at)}</td>
                  <td className="px-4 py-3">{getStatusBadge(submission.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(submission)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {submission.status !== 'responded' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(submission.id, 'responded')}
                          className="text-green-600"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(submission.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
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
                    <div className="shrink-0 flex flex-wrap items-center gap-2 justify-end">
                      {getFormTypeBadge(selectedSubmission.form_type)}
                      {getStatusBadge(selectedSubmission.status)}
                    </div>
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
                    {selectedSubmission.phone && (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Phone</p>
                        <p className="text-sm text-slate-900">{selectedSubmission.phone}</p>
                      </div>
                    )}
                    {selectedSubmission.college && (
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">College</p>
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
              <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-2">
                {selectedSubmission.status !== 'responded' && (
                  <Button
                    onClick={() => {
                      handleUpdateStatus(selectedSubmission.id, 'responded');
                      setShowDetailModal(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as Responded
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormsSection;
