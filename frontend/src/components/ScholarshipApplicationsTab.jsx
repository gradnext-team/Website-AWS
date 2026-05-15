import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  Eye, 
  Download, 
  Trash2, 
  CheckCircle, 
  Clock, 
  XCircle,
  MessageSquare,
  Calendar,
  Building2,
  Linkedin,
  FileText,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Image
} from 'lucide-react';
import { Button } from './ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const statusColors = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  reviewed: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Eye },
  contacted: { bg: 'bg-purple-100', text: 'text-purple-700', icon: MessageSquare },
  accepted: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle }
};

const ScholarshipApplicationsTab = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchApplications();
  }, [filterStatus]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const statusQuery = filterStatus !== 'all' ? `?status=${filterStatus}` : '';
      const res = await fetch(`${BACKEND_URL}/api/forms/scholarship-applications${statusQuery}`, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Failed to fetch applications');
      
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (applicationId, newStatus) => {
    try {
      setUpdating(applicationId);
      const res = await fetch(`${BACKEND_URL}/api/forms/scholarship-applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) throw new Error('Failed to update status');
      
      setApplications(apps => apps.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      ));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const deleteApplication = async (applicationId) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/forms/scholarship-applications/${applicationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Failed to delete application');
      
      setApplications(apps => apps.filter(app => app.id !== applicationId));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const downloadProof = async (applicationId, filename) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/forms/scholarship-applications/${applicationId}/proof`, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Failed to download proof');
      
      const data = await res.json();
      
      // Decode base64 and create download
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.content_type || 'application/octet-stream' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || filename || 'proof.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to download proof: ' + err.message);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchApplications} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
            Scholarship Applications
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {applications.length} total application{applications.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="contacted">Contacted</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No scholarship applications found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200" style={{ backgroundColor: 'var(--gn-grey-lightest)' }}>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Applicant</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Interview Details</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Proof</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Submitted</th>
                <th className="text-center p-4 font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Status</th>
                <th className="text-center p-4 font-semibold text-sm" style={{ color: 'var(--gn-rhino)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const StatusIcon = statusColors[app.status]?.icon || Clock;
                const isExpanded = expandedRows.has(app.id);
                
                return (
                  <React.Fragment key={app.id}>
                    <tr 
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(app.id)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                            <User className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
                          </div>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--gn-rhino)' }}>{app.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              {app.email && (
                                <a 
                                  href={`mailto:${app.email}`}
                                  className="flex items-center gap-1 hover:text-slate-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Mail className="w-3 h-3" />
                                  {app.email}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              {app.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {app.phone}
                                </span>
                              )}
                              {app.linkedin_url && (
                                <a 
                                  href={app.linkedin_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Linkedin className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-green-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-green-700">{app.interview_company}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(app.interview_date).split(',')[0]}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {app.proof_filename ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadProof(app.id, app.proof_filename);
                            }}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                          >
                            <Image className="w-4 h-4" />
                            View Proof
                          </button>
                        ) : (
                          <span className="text-sm text-slate-400">No proof</span>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-slate-600">{formatDate(app.submitted_at)}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[app.status]?.bg} ${statusColors[app.status]?.text}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="p-6">
                          <div className="space-y-4">
                            {/* Reason for Applying */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--gn-rhino)' }}>
                                Reason for Applying
                              </h4>
                              <p className="text-sm text-slate-600 bg-white p-4 rounded-lg border border-slate-200">
                                {app.reason_for_applying}
                              </p>
                            </div>
                            
                            {/* Status Update & Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-600">Update Status:</span>
                                <select
                                  value={app.status}
                                  onChange={(e) => updateStatus(app.id, e.target.value)}
                                  disabled={updating === app.id}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="reviewed">Reviewed</option>
                                  <option value="contacted">Contacted</option>
                                  <option value="accepted">Accepted</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                {updating === app.id && (
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {app.proof_filename && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadProof(app.id, app.proof_filename);
                                    }}
                                    className="text-xs"
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download Proof
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteApplication(app.id);
                                  }}
                                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScholarshipApplicationsTab;
