import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  MessageCircle, Send, Clock, CheckCircle, AlertCircle, X, 
  User, Mail, Calendar, Filter, Search, RefreshCw, Eye, Inbox,
  UserCheck, GraduationCap, Paperclip
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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
    open: 'bg-red-100 text-red-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-slate-100 text-slate-700'
  };
  
  return (
    <span className={`px-3 py-1 text-xs font-medium rounded-full ${styles[status] || styles.open}`}>
      {status?.replace('_', ' ').toUpperCase()}
    </span>
  );
};

const UserTypeBadge = ({ userType }) => {
  if (userType === 'mentor') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
        <GraduationCap className="w-3 h-3" />
        Mentor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
      <UserCheck className="w-3 h-3" />
      Candidate
    </span>
  );
};

const SupportTab = () => {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ 
    open: 0, 
    in_progress: 0, 
    in_progress_admin_side: 0,
    in_progress_user_side: 0,
    resolved: 0,
    candidate: 0,
    mentor: 0
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [queryDetails, setQueryDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Fetch queries
  const fetchQueries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (userTypeFilter) params.append('user_type', userTypeFilter);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/support/admin/queries?${params}`,
        { withCredentials: true }
      );
      
      setQueries(res.data.queries);
      setCounts(res.data.counts);
    } catch (err) {
      console.error('Failed to fetch queries:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, userTypeFilter]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  // Fetch query details
  const fetchQueryDetails = async (queryId) => {
    try {
      setLoadingDetails(true);
      const res = await axios.get(
        `${BACKEND_URL}/api/support/admin/queries/${queryId}`,
        { withCredentials: true }
      );
      setQueryDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch query details:', err);
      alert('Failed to load query details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = (query) => {
    setSelectedQuery(query);
    fetchQueryDetails(query.id);
    setReplyText('');
  };

  const closeModal = () => {
    setSelectedQuery(null);
    setQueryDetails(null);
    setReplyText('');
  };

  // Send reply
  const handleSendReply = async () => {
    if (!replyText.trim()) {
      alert('Please enter a reply message');
      return;
    }

    try {
      setSendingReply(true);
      await axios.post(
        `${BACKEND_URL}/api/support/admin/queries/${selectedQuery.id}/reply`,
        { reply: replyText },
        { withCredentials: true }
      );
      
      alert('Reply sent successfully! User will receive an email notification.');
      setReplyText('');
      fetchQueryDetails(selectedQuery.id);
      fetchQueries();
    } catch (err) {
      console.error('Failed to send reply:', err);
      alert('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Update status - now can be called from table
  const handleStatusChange = async (queryId, newStatus) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/support/admin/queries/${queryId}/status?status=${newStatus}`,
        {},
        { withCredentials: true }
      );
      
      fetchQueries();
      if (selectedQuery?.id === queryId) {
        fetchQueryDetails(queryId);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSince = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  // Filter queries by search term
  const filteredQueries = queries.filter(query => 
    query.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    query.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    query.query?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Support Queries</h2>
          <p className="text-sm text-slate-500">Manage and respond to user support requests</p>
        </div>
        <Button onClick={fetchQueries} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Overview Cards with Thumbnail */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Inbox className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{queries.length}</p>
              <p className="text-sm text-slate-500">Total</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.open}</p>
              <p className="text-sm text-slate-500">Open</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.in_progress}</p>
              <p className="text-sm text-slate-500">In Progress</p>
              <div className="text-xs text-slate-400 mt-1">
                <div>Admin: {counts.in_progress_admin_side}</div>
                <div>User: {counts.in_progress_user_side}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.resolved}</p>
              <p className="text-sm text-slate-500">Resolved</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">By Type</p>
              <div className="text-xs text-slate-600">
                <div>Candidates: {counts.candidate}</div>
                <div>Mentors: {counts.mentor}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name, email, or query..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Users</option>
              <option value="candidate">Candidates</option>
              <option value="mentor">Mentors</option>
            </select>
          </div>
        </div>
      </div>

      {/* Queries Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Query</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Waiting On</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Date Received</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Last Reply</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  </td>
                </tr>
              ) : filteredQueries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-500">
                    No queries found
                  </td>
                </tr>
              ) : (
                filteredQueries.map((query) => (
                  <tr key={query.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{query.user_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{query.user_email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-slate-700 line-clamp-2 flex-1">{query.query}</p>
                        {query.attachment_url && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700" title="Has attachment">
                            <Paperclip className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <UserTypeBadge userType={query.user_type} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <select
                        value={query.status}
                        onChange={(e) => handleStatusChange(query.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1 text-xs font-medium rounded-full border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        style={{
                          backgroundColor: query.status === 'open' ? '#fee2e2' : 
                                         query.status === 'in_progress' ? '#fef3c7' : 
                                         query.status === 'resolved' ? '#dcfce7' : '#f1f5f9',
                          color: query.status === 'open' ? '#991b1b' : 
                                 query.status === 'in_progress' ? '#92400e' : 
                                 query.status === 'resolved' ? '#166534' : '#475569'
                        }}
                      >
                        <option value="open">OPEN</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="resolved">RESOLVED</option>
                        <option value="closed">CLOSED</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {query.status === 'in_progress' ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          query.last_reply_by === 'admin' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {query.last_reply_by === 'admin' ? 'User' : 'Admin'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-xs text-slate-600">{formatDate(query.created_at)}</div>
                      <div className="text-xs text-slate-400 mt-1">{getTimeSince(query.created_at)}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-xs text-slate-600">
                        {query.updated_at ? formatDate(query.updated_at) : '-'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {query.updated_at ? getTimeSince(query.updated_at) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Button
                        onClick={() => handleViewDetails(query)}
                        variant="ghost"
                        size="sm"
                        className="h-8"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Query Details Modal - same as before */}
      <Dialog open={!!selectedQuery} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Support Query Details
            </DialogTitle>
            <DialogDescription>
              View query details and send a response to the user
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : queryDetails ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3">User Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-medium text-slate-900">{queryDetails.user.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{queryDetails.user.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Type</p>
                    <UserTypeBadge userType={queryDetails.query.user_type} />
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <StatusBadge status={queryDetails.query.status} />
                  </div>
                </div>
              </div>

              {/* Original Query */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Original Query</h3>
                  <span className="text-xs text-slate-500">{formatDate(queryDetails.query.created_at)}</span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap">{queryDetails.query.query}</p>
                
                {/* Attachment Preview */}
                {queryDetails.query.attachment_url && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Attached Screenshot:</h4>
                    <div className="relative">
                      <img 
                        src={queryDetails.query.attachment_url} 
                        alt="User attachment" 
                        className="max-w-full h-auto max-h-80 rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(queryDetails.query.attachment_url, '_blank')}
                      />
                      <p className="text-xs text-slate-500 mt-1">Click to view full size</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Previous Replies */}
              {queryDetails.replies && queryDetails.replies.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900">Previous Replies</h3>
                  {queryDetails.replies.map((reply) => (
                    <div key={reply.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-700">
                          {reply.admin_name} replied
                        </span>
                        <span className="text-xs text-green-600">{formatDate(reply.created_at)}</span>
                      </div>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap">{reply.reply}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Change */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Update Status:</label>
                <select
                  value={queryDetails.query.status}
                  onChange={(e) => handleStatusChange(queryDetails.query.id, e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Reply Section */}
              {queryDetails.query.status !== 'closed' && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900">Send Reply</h3>
                  <Textarea
                    placeholder="Type your reply here... This will be sent to the user via email."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={6}
                    className="w-full"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {sendingReply ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Reply via Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportTab;
