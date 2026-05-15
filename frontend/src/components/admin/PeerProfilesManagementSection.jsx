import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Upload, Eye, EyeOff, Clock,
  DollarSign, Star, Loader2, Video, Calendar, FileText,
  Play, Pause, UserX, ExternalLink, CheckCircle2, Search, PlayCircle, RefreshCw,
  Users, Mail, Phone, MapPin, FolderOpen, Download, FileSpreadsheet,
  XCircle, ChevronLeft, ChevronRight, Ban, MessageSquare, ImageIcon, Send,
  GripVertical, Activity, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WeeklyAvailabilitySelector } from '../TimeSlotPicker';
import { ChunkedFileUpload, SimpleFileUpload } from '../ChunkedFileUpload';
import { istToViewer, format12hWithAbbr, getTimezoneAbbr } from '../../utils/timezone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const PeerProfilesManagementSection = () => {
  const [profiles, setProfiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    is_listed: '',  // '', 'true', 'false'
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // Visibility toggle
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    loadStats();
    loadProfiles();
  }, [page, filters]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-profiles/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.search) params.append('search', filters.search);
      if (filters.is_listed) params.append('is_listed', filters.is_listed);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-profiles?${params}`, { withCredentials: true });
      setProfiles(res.data.profiles);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (profile, newVisibility) => {
    const action = newVisibility ? 'show' : 'hide';
    if (!window.confirm(`Are you sure you want to ${action} ${profile.name} on the peer practice website?`)) {
      return;
    }

    setTogglingVisibility(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/peer-profiles/${profile.user_id}/toggle-visibility`,
        { 
          is_listed: newVisibility,
          notes: `Visibility toggled by admin to ${newVisibility ? 'visible' : 'hidden'}`
        },
        { withCredentials: true }
      );
      loadProfiles();
      loadStats();
      alert(`${profile.name} is now ${newVisibility ? 'visible' : 'hidden'} on the website`);
    } catch (error) {
      alert('Failed to update visibility: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTogglingVisibility(false);
    }
  };

  const openDetails = (profile) => {
    setSelectedProfile(profile);
    setDetailModalOpen(true);
  };

  const clearFilters = () => {
    setFilters({ search: '', is_listed: '', sort_by: 'created_at', sort_order: 'desc' });
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="peer-profiles-management-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peer Practice Profiles</h1>
          <p className="text-sm text-slate-500">Manage which mentees are visible on the peer practice website</p>
        </div>
        <Button onClick={() => { loadProfiles(); loadStats(); }} variant="outline" size="sm">
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Total Profiles</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total_profiles}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <p className="text-sm text-green-600">Visible on Website</p>
            <p className="text-2xl font-bold text-green-700">{stats.listed_profiles}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50">
            <p className="text-sm text-red-600">Hidden</p>
            <p className="text-2xl font-bold text-red-700">{stats.unlisted_profiles}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-600">Calendar Connected</p>
            <p className="text-2xl font-bold text-blue-700">{stats.calendar_connected}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-600">Avg Rating</p>
            <p className="text-2xl font-bold text-amber-700">{stats.average_rating.toFixed(1)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Search & Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or university..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
            />
          </div>

          <Select value={filters.is_listed || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, is_listed: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Visibility Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Profiles</SelectItem>
              <SelectItem value="true">Visible on Website</SelectItem>
              <SelectItem value="false">Hidden</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.sort_by} onValueChange={(v) => setFilters(f => ({ ...f, sort_by: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest First</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="peer_sessions_done">Most Sessions</SelectItem>
              <SelectItem value="peer_rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Profile</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">University</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Firms Targeting</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cases Done</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Visibility</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {filters.search ? `No profiles found for "${filters.search}"` : 'No profiles found'}
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.user_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={profile.profile_picture || `https://ui-avatars.com/api/?name=${profile.name}&background=random`}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900">{profile.name}</p>
                          <p className="text-xs text-slate-500">{profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{profile.university || profile.ug_college || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {profile.firms_targeting?.slice(0, 2).map((firm, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {firm}
                          </span>
                        ))}
                        {profile.firms_targeting?.length > 2 && (
                          <span className="text-xs text-slate-500">+{profile.firms_targeting.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">{profile.cases_done || 0}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="text-slate-900 font-medium">{profile.session_stats.total}</p>
                        <p className="text-xs text-green-600">{profile.session_stats.completed} completed</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {profile.peer_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium text-slate-700">{profile.peer_rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No rating</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {profile.is_listed ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <Eye className="w-4 h-4" />
                          Visible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-sm">
                          <EyeOff className="w-4 h-4" />
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(profile)}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleVisibility(profile, !profile.is_listed)}
                          disabled={togglingVisibility}
                          title={profile.is_listed ? "Hide from Website" : "Show on Website"}
                          className={profile.is_listed ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                        >
                          {profile.is_listed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} profiles
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Peer Profile Details</DialogTitle>
          </DialogHeader>
          {selectedProfile && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <img 
                  src={selectedProfile.profile_picture || `https://ui-avatars.com/api/?name=${selectedProfile.name}&background=random`}
                  alt=""
                  className="w-20 h-20 rounded-full"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{selectedProfile.name}</h3>
                  <p className="text-sm text-slate-600">{selectedProfile.email}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {selectedProfile.is_listed ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <Eye className="w-4 h-4" />
                        Visible on Website
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <EyeOff className="w-4 h-4" />
                        Hidden from Website
                      </span>
                    )}
                    {selectedProfile.google_calendar_connected && (
                      <span className="flex items-center gap-1 text-blue-600 text-sm">
                        <Calendar className="w-4 h-4" />
                        Calendar Connected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">University</p>
                  <p className="font-medium">{selectedProfile.university || selectedProfile.ug_college || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Location</p>
                  <p className="font-medium">{selectedProfile.location || '-'}</p>
                </div>
              </div>

              {/* Career Info */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Career Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Firms Targeting</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedProfile.firms_targeting?.map((firm, idx) => (
                        <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {firm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Preparation Level</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">{selectedProfile.preparation_level || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Cases Done</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">{selectedProfile.cases_done || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Years of Experience</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">{selectedProfile.years_of_experience || 0}</p>
                  </div>
                </div>
              </div>

              {/* Session Stats */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Session Statistics</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-700">{selectedProfile.session_stats.total}</p>
                    <p className="text-xs text-blue-600">Total</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-700">{selectedProfile.session_stats.completed}</p>
                    <p className="text-xs text-green-600">Completed</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-700">{selectedProfile.session_stats.pending}</p>
                    <p className="text-xs text-amber-600">Pending</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-700">{selectedProfile.session_stats.cancelled}</p>
                    <p className="text-xs text-red-600">Cancelled</p>
                  </div>
                </div>
              </div>

              {/* Rating */}
              {selectedProfile.peer_rating && (
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-xs text-amber-600 uppercase mb-2">Peer Rating</p>
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(i => (
                      <Star 
                        key={i} 
                        className={`w-6 h-6 ${i <= selectedProfile.peer_rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} 
                      />
                    ))}
                    <span className="text-2xl font-bold text-amber-700 ml-2">{selectedProfile.peer_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {selectedProfile.linkedin_url && (
                <div>
                  <a 
                    href={selectedProfile.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View LinkedIn Profile
                  </a>
                </div>
              )}

              <DialogFooter>
                <Button
                  onClick={() => handleToggleVisibility(selectedProfile, !selectedProfile.is_listed)}
                  disabled={togglingVisibility}
                  className={selectedProfile.is_listed ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                >
                  {togglingVisibility ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {selectedProfile.is_listed ? 'Hide from Website' : 'Show on Website'}
                </Button>
                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Mentors Section ============

// Wraps an admin mentor row in dnd-kit's `useSortable` so the admin can
// reorder the active mentors list by dragging the GripVertical handle.
// We pass the dnd refs/listeners through the shared `renderRow` so we
// don't have to duplicate the (large) row markup.
const SortableMentorRow = ({ mentor, index, renderRow }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mentor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return renderRow(mentor, false, index, {
    setNodeRef,
    style,
    attributes,
    listeners,
    isDragging,
  });
};


export default PeerProfilesManagementSection;
