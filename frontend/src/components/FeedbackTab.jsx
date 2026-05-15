import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Star, RefreshCw, Filter, Search, User, Mail, Calendar,
  ThumbsUp, MessageSquare, Trash2, Eye, TrendingUp,
  UserCheck, GraduationCap
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

const RatingStars = ({ rating, size = 'sm' }) => {
  const starSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </div>
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

const FeedbackTab = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    by_rating: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    candidate: 0,
    mentor: 0
  });
  const [averageRating, setAverageRating] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [ratingFilter, setRatingFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [feedbackDetails, setFeedbackDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch feedbacks
  const fetchFeedbacks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (ratingFilter) params.append('rating', ratingFilter);
      if (userTypeFilter) params.append('user_type', userTypeFilter);
      
      const res = await axios.get(
        `${BACKEND_URL}/api/support/admin/feedback?${params}`,
        { withCredentials: true }
      );
      
      setFeedbacks(res.data.feedbacks);
      setCounts(res.data.counts);
      setAverageRating(res.data.average_rating);
      setTotalCount(res.data.total);
    } catch (err) {
      console.error('Failed to fetch feedbacks:', err);
    } finally {
      setLoading(false);
    }
  }, [ratingFilter, userTypeFilter]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Fetch feedback details
  const fetchFeedbackDetails = async (feedbackId) => {
    try {
      setLoadingDetails(true);
      const res = await axios.get(
        `${BACKEND_URL}/api/support/admin/feedback/${feedbackId}`,
        { withCredentials: true }
      );
      setFeedbackDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch feedback details:', err);
      alert('Failed to load feedback details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = (feedback) => {
    setSelectedFeedback(feedback);
    fetchFeedbackDetails(feedback.id);
  };

  const closeModal = () => {
    setSelectedFeedback(null);
    setFeedbackDetails(null);
  };

  // Delete feedback
  const handleDelete = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      setDeleting(true);
      await axios.delete(
        `${BACKEND_URL}/api/support/admin/feedback/${feedbackId}`,
        { withCredentials: true }
      );
      
      alert('Feedback deleted successfully');
      closeModal();
      fetchFeedbacks();
    } catch (err) {
      console.error('Failed to delete feedback:', err);
      alert('Failed to delete feedback');
    } finally {
      setDeleting(false);
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

  // Filter feedbacks by search term
  const filteredFeedbacks = feedbacks.filter(feedback => 
    feedback.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    feedback.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    feedback.feedback?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Feedback</h2>
          <p className="text-sm text-slate-500">View and manage user feedback and ratings</p>
        </div>
        <Button onClick={fetchFeedbacks} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Total Feedback */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
              <p className="text-sm text-slate-500">Total Feedback</p>
            </div>
          </div>
        </div>
        
        {/* Average Rating */}
        <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Star className="w-6 h-6 text-amber-600 fill-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{averageRating || 'N/A'}</p>
              <p className="text-sm text-slate-500">Avg Rating</p>
            </div>
          </div>
        </div>
        
        {/* 5-Star */}
        <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <ThumbsUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{counts.by_rating?.['5'] || 0}</p>
              <p className="text-sm text-slate-500">5-Star Reviews</p>
            </div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm col-span-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-2">Rating Distribution</p>
              <div className="flex items-center gap-2 text-xs">
                {[5, 4, 3, 2, 1].map((r) => (
                  <div key={r} className="flex items-center gap-1">
                    <span className="font-medium">{r}★:</span>
                    <span className="text-slate-600">{counts.by_rating?.[String(r)] || 0}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs mt-1 text-slate-500">
                <span>Candidates: {counts.candidate}</span>
                <span>|</span>
                <span>Mentors: {counts.mentor}</span>
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
                placeholder="Search by name, email, or feedback..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
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

      {/* Feedback Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Feedback</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  </td>
                </tr>
              ) : filteredFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                    No feedback found
                  </td>
                </tr>
              ) : (
                filteredFeedbacks.map((feedback) => (
                  <tr key={feedback.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{feedback.user_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{feedback.user_email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-700 line-clamp-2">{feedback.feedback}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <UserTypeBadge userType={feedback.user_type} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <RatingStars rating={feedback.rating} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="text-xs text-slate-600">{formatDate(feedback.created_at)}</div>
                      <div className="text-xs text-slate-400 mt-1">{getTimeSince(feedback.created_at)}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          onClick={() => handleViewDetails(feedback)}
                          variant="ghost"
                          size="sm"
                          className="h-8"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          onClick={() => handleDelete(feedback.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
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
      </div>

      {/* Feedback Details Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Feedback Details
            </DialogTitle>
            <DialogDescription>
              View detailed feedback information
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : feedbackDetails ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3">User Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-medium text-slate-900">{feedbackDetails.user.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{feedbackDetails.user.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Type</p>
                    <UserTypeBadge userType={feedbackDetails.feedback.user_type} />
                  </div>
                  <div>
                    <p className="text-slate-500">Plan</p>
                    <p className="font-medium text-slate-900">{feedbackDetails.user.plan || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Rating</h3>
                  <span className="text-xs text-slate-500">{formatDate(feedbackDetails.feedback.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <RatingStars rating={feedbackDetails.feedback.rating} size="lg" />
                  <span className="text-2xl font-bold text-slate-900">{feedbackDetails.feedback.rating}/5</span>
                </div>
              </div>

              {/* Feedback Content */}
              <div className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Feedback</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{feedbackDetails.feedback.feedback}</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => handleDelete(feedbackDetails.feedback.id)}
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Delete Feedback'}
                </Button>
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedbackTab;
