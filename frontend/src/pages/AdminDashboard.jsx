import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// ── Lazy-loaded section components (code-split per section) ──
// Each section only downloads its JS when the user first navigates to it.
const AnalysisSectionWithTabs = React.lazy(() => import('../components/AnalysisSectionWithTabs'));
const SupportTab = React.lazy(() => import('../components/SupportTab'));
const FeedbackTab = React.lazy(() => import('../components/FeedbackTab'));
const ContactSubmissionsTab = React.lazy(() => import('../components/ContactSubmissionsTab'));
const CoachApplicationsTab = React.lazy(() => import('../components/CoachApplicationsTab'));
const PinnacleApplicationsTab = React.lazy(() => import('../components/PinnacleApplicationsTab'));
const ScholarshipApplicationsTab = React.lazy(() => import('../components/ScholarshipApplicationsTab'));
const LogoRepositorySection = React.lazy(() => import('../components/LogoRepositorySection'));
const DiscoveryCallsSection = React.lazy(() => import('../components/DiscoveryCallsSection'));
const DiscountsSection = React.lazy(() => import('../components/admin/DiscountsSection'));
const CompetitionsSection = React.lazy(() => import('../components/admin/CompetitionsSection'));
const AutomationsSection = React.lazy(() => import('../components/admin/AutomationsSection'));
const LeadScoringSection = React.lazy(() => import('../components/admin/LeadScoringSection'));
const PartnersSection = React.lazy(() => import('../components/admin/PartnersSection'));
const PlansSection = React.lazy(() => import('../components/PlansManagement').then(m => ({ default: m.PlansSection })));
const TestimonialsSection = React.lazy(() => import('../components/TestimonialsManagement').then(m => ({ default: m.TestimonialsSection })));
const SalesManagement = React.lazy(() => import('../components/SalesManagement').then(m => ({ default: m.SalesManagement })));
const MentorAnalytics = React.lazy(() => import('../components/MentorAnalytics').then(m => ({ default: m.MentorAnalytics })));
const CandidateAnalytics = React.lazy(() => import('../components/CandidateAnalytics').then(m => ({ default: m.CandidateAnalytics })));
const BlogManagement = React.lazy(() => import('../components/admin/BlogManagement').then(m => ({ default: m.BlogManagement })));
const AdminCalendar = React.lazy(() => import('../components/admin/AdminCalendar').then(m => ({ default: m.AdminCalendar })));
const MentorNotificationsAdmin = React.lazy(() => import('../components/MentorNotificationsAdmin').then(m => ({ default: m.MentorNotificationsAdmin })));
const CandidateNotificationsAdmin = React.lazy(() => import('../components/CandidateNotificationsAdmin').then(m => ({ default: m.CandidateNotificationsAdmin })));
const CohortProgramsAdmin = React.lazy(() => import('../components/admin/CohortProgramsAdmin'));

import {
  Users, UserCog, Video, Calendar, FileText, BookOpen, 
  Users2, GraduationCap, LayoutDashboard, Settings, LogOut,
  Plus, Edit2, Trash2, Save, X, Upload, Eye, EyeOff,
  ChevronRight, ChevronDown, Search, Filter, MoreVertical, Clock,
  DollarSign, Star, AlertCircle, CheckCircle2, Loader2,
  TrendingUp, TrendingDown, Receipt, PieChart, BarChart3,
  Play, Pause, UserX, Download, ExternalLink, Package, UserCheck, MessageCircle, ThumbsUp, Image as ImageIcon, Phone, ChevronUp, GripVertical, ClipboardList, MessageSquare, Briefcase, Award, Tag, Trophy,
  Menu, PanelLeftClose, Zap, Building, Bell
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

// Import enhanced availability selector
import { WeeklyAvailabilitySelector } from '../components/TimeSlotPicker';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Use enhanced availability selector
const AvailabilitySelector = WeeklyAvailabilitySelector;

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ============ File Upload Component ============
const FileUpload = ({ onUpload, category = "general", accept = "*", label = "Upload File", persistToDB = false }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    // Persist small images to MongoDB for production
    if (persistToDB || ['thumbnails', 'logos', 'testimonials', 'mentors', 'profile'].includes(category)) {
      formData.append('persist_to_db', 'true');
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/upload`, formData, {
        withCredentials: true,
        // DO NOT manually set Content-Type for FormData - axios auto-sets it with correct boundary
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(pct);
        }
      });
      onUpload(res.data.url, file.name);
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={accept}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading {progress}%
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            {label}
          </>
        )}
      </Button>
      {uploading && (
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

// ============ Stats Card Component ============
const StatCard = ({ label, value, icon: Icon, color, trend, trendValue }) => (
  <div className="bg-white rounded-xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// ============ Users Management Section ============
const UsersSection = () => {
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(100);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', is_mentor: false, is_admin: false });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [deleting, setDeleting] = useState(false);
  
  // Excel Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [skipExisting, setSkipExisting] = useState(true);
  const importFileRef = useRef(null);

  useEffect(() => { 
    fetchUsers(); 
  }, [currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * usersPerPage;
      const res = await axios.get(`${BACKEND_URL}/api/admin/users?skip=${skip}&limit=${usersPerPage}`, { withCredentials: true });
      setUsers(res.data.users);
      setTotalUsers(res.data.total || res.data.users.length);
      setSelectedUsers([]); // Clear selection on refresh
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/admin/users`, { ...newUser, plan: 'free_trial', coaching_sessions_total: 0 }, { withCredentials: true });
      fetchUsers();
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', is_mentor: false, is_admin: false });
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdateRole = async (userId, data) => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/users/${userId}`, data, { withCredentials: true });
      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      alert('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone and will remove their bookings, payments, and all associated data.')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/users/${userId}`, { withCredentials: true });
      fetchUsers();
    } catch (error) {
      // Surface the real backend error so admins can act on it instead
      // of staring at a generic "failed" toast.
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      alert(`Failed to delete user: ${detail}`);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId, checked) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedUsers.length} user(s)? This action cannot be undone.`)) return;
    
    setDeleting(true);
    try {
      // Single backend call — atomic-ish, with per-user success/failure
      // reporting so partial failures don't masquerade as total failure.
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/users/bulk-delete`,
        { user_ids: selectedUsers },
        { withCredentials: true },
      );
      const { deleted_count, failed_count, failed } = res.data || {};
      if (failed_count) {
        const sample = (failed || []).slice(0, 3).map(f => `${f.user_id}: ${f.error}`).join('\n');
        alert(`Deleted ${deleted_count} user(s). ${failed_count} failed:\n${sample}`);
      }
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      alert(`Failed to delete users: ${detail}`);
      fetchUsers();
    } finally {
      setDeleting(false);
    }
  };

  // Excel Import Handler
  const handleImportExcel = async () => {
    if (!importFile) return;
    
    setImporting(true);
    setImportResults(null);
    
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('skip_existing', skipExisting);
    
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/users/import-excel`,
        formData,
        {
          withCredentials: true,

        }
      );
      setImportResults(res.data);
      fetchUsers(); // Refresh users list
    } catch (error) {
      setImportResults({
        error: error.response?.data?.detail || 'Failed to import users'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
      setImportResults(null);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResults(null);
    setSkipExisting(true);
  };

  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Role filter
    let matchesRole = true;
    if (roleFilter === 'admin') {
      matchesRole = user.is_admin === true;
    } else if (roleFilter === 'mentor') {
      matchesRole = user.is_mentor === true && !user.is_admin;
    } else if (roleFilter === 'user') {
      matchesRole = !user.is_admin && !user.is_mentor;
    }
    
    return matchesSearch && matchesRole;
  });

  // Count users by role
  const adminCount = users.filter(u => u.is_admin).length;
  const mentorCount = users.filter(u => u.is_mentor && !u.is_admin).length;
  const userCount = users.filter(u => !u.is_admin && !u.is_mentor).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="users-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowImportModal(true)}
            data-testid="import-excel-btn"
          >
            <Upload className="w-4 h-4 mr-2" /> Import Excel
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Add User
          </Button>
        </div>
      </div>

      {/* Role Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 mr-2">Filter by:</span>
          <Button 
            variant={roleFilter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setRoleFilter('all')}
          >
            All ({totalUsers})
          </Button>
          <Button 
            variant={roleFilter === 'admin' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setRoleFilter('admin')}
            className={roleFilter === 'admin' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            Admin ({adminCount})
          </Button>
          <Button 
            variant={roleFilter === 'mentor' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setRoleFilter('mentor')}
            className={roleFilter === 'mentor' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Mentor ({mentorCount})
          </Button>
          <Button 
            variant={roleFilter === 'user' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setRoleFilter('user')}
          >
            User ({userCount})
          </Button>
        </div>
        {selectedUsers.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleDeleteSelected}
            disabled={deleting}
            data-testid="delete-selected-users-btn"
          >
            {deleting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedUsers.length})</>
            )}
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <input 
                  type="checkbox" 
                  checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-slate-300"
                  data-testid="select-all-users"
                />
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  No users found
                </td>
              </tr>
            ) : filteredUsers.map((user) => (
              <tr key={user.id} className={`hover:bg-slate-50 ${selectedUsers.includes(user.id) ? 'bg-blue-50' : ''}`}>
                <td className="w-12 px-4 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                    className="rounded border-slate-300"
                    data-testid={`select-user-${user.id}`}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {user.is_admin && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Admin</span>}
                    {user.is_mentor && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Mentor</span>}
                    {!user.is_admin && !user.is_mentor && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">User</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                      <Edit2 className="w-4 h-4 mr-1" /> Role
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteUser(user.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalUsers > usersPerPage && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 rounded-b-lg">
          <div className="text-sm text-slate-600">
            Showing {((currentPage - 1) * usersPerPage) + 1} to {Math.min(currentPage * usersPerPage, totalUsers)} of {totalUsers} users
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm font-medium text-slate-700">
              Page {currentPage} of {Math.ceil(totalUsers / usersPerPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalUsers / usersPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(totalUsers / usersPerPage)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.ceil(totalUsers / usersPerPage))}
              disabled={currentPage >= Math.ceil(totalUsers / usersPerPage)}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newUser.is_admin} onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} className="rounded" />
                <span className="text-sm">Admin</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newUser.is_mentor} onChange={(e) => setNewUser({ ...newUser, is_mentor: e.target.checked })} className="rounded" />
                <span className="text-sm">Mentor</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={handleCreateUser}>Create User</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role - {editingUser?.name}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingUser.is_admin} onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.checked })} className="rounded" />
                  <span className="text-sm">Admin</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingUser.is_mentor} onChange={(e) => setEditingUser({ ...editingUser, is_mentor: e.target.checked })} className="rounded" />
                  <span className="text-sm">Mentor</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button onClick={() => handleUpdateRole(editingUser.id, { is_admin: editingUser.is_admin, is_mentor: editingUser.is_mentor })}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Excel Modal */}
      <Dialog open={showImportModal} onOpenChange={closeImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Candidates from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx) with candidate data. Required columns: name, email
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Upload */}
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFileChange}
                ref={importFileRef}
                className="hidden"
                data-testid="import-file-input"
              />
              {importFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900">{importFile.name}</p>
                    <p className="text-sm text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setImportFile(null)}
                    className="ml-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div 
                  onClick={() => importFileRef.current?.click()}
                  className="cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">Click to select Excel file</p>
                  <p className="text-sm text-slate-400 mt-1">Supports .xlsx and .xls files</p>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skip-existing"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="skip-existing" className="text-sm text-slate-700">
                Skip users with existing email addresses
              </label>
            </div>

            {/* Expected Columns Info */}
            <div className="bg-slate-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-slate-700 mb-2">Expected Columns:</p>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-red-500">*</span> name, 
                  <span className="text-red-500">*</span> email
                </div>
                <div>plan, plan_start_date, plan_end_date</div>
                <div>coaching_sessions_total, coaching_sessions_used</div>
                <div>strategy_calls_total, strategy_calls_used</div>
                <div>phone, college, linkedin_url</div>
              </div>
              <p className="mt-2 text-slate-500">
                <span className="text-red-500">*</span> Required columns
              </p>
            </div>

            {/* Import Results */}
            {importResults && (
              <div className={`rounded-lg p-4 ${importResults.error ? 'bg-red-50' : 'bg-green-50'}`}>
                {importResults.error ? (
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span>{importResults.error}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Import Complete!</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-white rounded p-2 text-center">
                        <p className="text-2xl font-bold text-green-600">{importResults.imported}</p>
                        <p className="text-slate-600">Imported</p>
                      </div>
                      <div className="bg-white rounded p-2 text-center">
                        <p className="text-2xl font-bold text-yellow-600">{importResults.skipped_existing}</p>
                        <p className="text-slate-600">Skipped (exists)</p>
                      </div>
                      <div className="bg-white rounded p-2 text-center">
                        <p className="text-2xl font-bold text-red-600">{importResults.skipped_invalid}</p>
                        <p className="text-slate-600">Invalid</p>
                      </div>
                    </div>
                    {importResults.imported_users?.length > 0 && (
                      <div className="mt-2 text-sm text-slate-600">
                        <p className="font-medium">Imported users:</p>
                        <ul className="max-h-32 overflow-y-auto">
                          {importResults.imported_users.slice(0, 10).map((u, i) => (
                            <li key={i}>{u.name} ({u.email}) - {u.plan}</li>
                          ))}
                          {importResults.imported_users.length > 10 && (
                            <li>...and {importResults.imported_users.length - 10} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {importResults.errors?.length > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        <p className="font-medium">Errors:</p>
                        <ul className="max-h-24 overflow-y-auto">
                          {importResults.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImportModal}>
              {importResults ? 'Close' : 'Cancel'}
            </Button>
            {!importResults && (
              <Button 
                onClick={handleImportExcel} 
                disabled={!importFile || importing}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="import-submit-btn"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Import Users</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Candidates Section ============
const CandidatesSection = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [planTypeFilter, setPlanTypeFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [deleting, setDeleting] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageInput, setPageInput] = useState('');
  const pageSize = 50;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, planTypeFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * pageSize;
      
      // Build query params
      const params = new URLSearchParams();
      params.append('skip', skip);
      params.append('limit', pageSize);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (planTypeFilter && planTypeFilter !== 'all') params.append('plan_category', planTypeFilter);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/users?${params}`, { withCredentials: true });
      // Filter to show only candidates (not admins or mentors)
      const candidates = res.data.users.filter(u => !u.is_admin && !u.is_mentor);
      setUsers(candidates);
      setTotalUsers(res.data.total || candidates.length);
      setSelectedCandidates([]); // Clear selection on refresh
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, planTypeFilter]);

  useEffect(() => { 
    fetchUsers(); 
    fetchAvailablePlans();
  }, [fetchUsers]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedCandidates(filteredUsers.map(u => u.id));
    } else {
      setSelectedCandidates([]);
    }
  };

  const handleSelectCandidate = (userId, checked) => {
    if (checked) {
      setSelectedCandidates(prev => [...prev, userId]);
    } else {
      setSelectedCandidates(prev => prev.filter(id => id !== userId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCandidates.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedCandidates.length} candidate(s)? This action cannot be undone.`)) return;
    
    try {
      setDeleting(true);
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/users/bulk-delete`,
        { user_ids: selectedCandidates },
        { withCredentials: true },
      );
      const { deleted_count, failed_count, failed } = res.data || {};
      if (failed_count) {
        const sample = (failed || []).slice(0, 3).map(f => `${f.user_id}: ${f.error}`).join('\n');
        alert(`Deleted ${deleted_count} candidate(s). ${failed_count} failed:\n${sample}`);
      }
      setSelectedCandidates([]);
      fetchUsers();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      console.error('Failed to delete users:', error);
      alert(`Failed to delete candidates: ${detail}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadCandidates = async () => {
    try {
      // Fetch all candidates (without pagination)
      const params = new URLSearchParams();
      params.append('limit', 10000); // Get all
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (planTypeFilter && planTypeFilter !== 'all') params.append('plan_category', planTypeFilter);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/users?${params}`, { withCredentials: true });
      const candidates = res.data.users.filter(u => !u.is_admin && !u.is_mentor);
      
      if (candidates.length === 0) {
        alert('No candidates to download');
        return;
      }
      
      // CSV headers
      const headers = [
        'Name',
        'Email',
        'Phone',
        'Plan Type',
        'Plan Name',
        'Subscription Start',
        'Subscription End',
        'Sessions Remaining',
        'Cohort Name',
        'Created At',
        'Last Login'
      ];
      
      // CSV rows
      const rows = candidates.map(user => [
        user.name || '',
        user.email || '',
        user.phone_number || '',
        user.plan || 'free',
        user.plan_name || user.plan || 'Free',
        user.subscription_start ? new Date(user.subscription_start).toLocaleDateString() : '',
        user.subscription_end ? new Date(user.subscription_end).toLocaleDateString() : '',
        user.sessions_remaining ?? '',
        user.cohort_name || '',
        user.created_at ? new Date(user.created_at).toLocaleDateString() : '',
        user.last_login ? new Date(user.last_login).toLocaleDateString() : ''
      ]);
      
      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const filename = `candidates_${planTypeFilter !== 'all' ? planTypeFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download candidates:', error);
      alert('Failed to download candidates');
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/plans`, { withCredentials: true });
      setAvailablePlans(res.data.plans || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  const fetchUserDetails = async (userId) => {
    setDetailsLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/users/${userId}/details`, { withCredentials: true });
      setUserDetails(res.data);
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      const response = await axios.put(`${BACKEND_URL}/api/admin/users/${userId}`, data, { withCredentials: true });
      await fetchUsers();
      setEditingUser(null);
      alert('User updated successfully');
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update user: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleUpdateAccess = async (accessType, granted) => {
    try {
      await axios.post(`${BACKEND_URL}/api/admin/users/${selectedUser.id}/access`, {
        user_id: selectedUser.id,
        access_type: accessType,
        granted
      }, { withCredentials: true });
      fetchUsers();
      // Refresh selected user data
      const updatedUser = users.find(u => u.id === selectedUser.id);
      if (updatedUser) {
        setSelectedUser({ ...updatedUser, custom_access: { ...updatedUser.custom_access, [accessType]: granted } });
      }
    } catch (error) {
      alert('Failed to update access');
    }
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
    fetchUserDetails(user.id);
  };

  // Get plan category from plan key
  const getPlanCategory = (planKey) => {
    const plan = availablePlans.find(p => p.plan_key === planKey);
    return plan?.category || 'subscription';
  };

  // Users are already filtered server-side, just use them directly
  const filteredUsers = users;

  // Count by plan type - need to fetch counts separately since we're paginating
  const [planCounts, setPlanCounts] = useState({ subscription: 0, coaching: 0, cohort: 0, addon: 0, total: 0 });
  
  useEffect(() => {
    // Fetch plan counts separately
    const fetchPlanCounts = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/admin/users/counts`, { withCredentials: true });
        if (res.data) {
          setPlanCounts(res.data);
        }
      } catch (error) {
        // Fallback to current page counts if endpoint doesn't exist
        console.log('Plan counts endpoint not available, using page counts');
      }
    };
    fetchPlanCounts();
  }, []);

  const subscriptionCount = planCounts.subscription || users.filter(u => getPlanCategory(u.plan) === 'subscription').length;
  const coachingCount = planCounts.coaching || users.filter(u => getPlanCategory(u.plan) === 'coaching').length;
  const cohortCount = planCounts.cohort || users.filter(u => getPlanCategory(u.plan) === 'cohort').length;
  const addonCount = planCounts.addon || users.filter(u => getPlanCategory(u.plan) === 'addon').length;

  // Pagination calculations
  const totalPages = Math.ceil(totalUsers / pageSize);

  const planColors = {
    'free_trial': 'bg-slate-100 text-slate-700',
    'basic_plan': 'bg-blue-100 text-blue-700',
    'pro_plan': 'bg-purple-100 text-purple-700',
    'pro_plus': 'bg-violet-100 text-violet-700',
    'last_mile': 'bg-amber-100 text-amber-700',
    'mid_mile': 'bg-orange-100 text-orange-700',
    'full_prep': 'bg-rose-100 text-rose-700',
    'pinnacle': 'bg-yellow-100 text-yellow-700',
    'cohort_premium': 'bg-emerald-100 text-emerald-700',
    'cohort_elite': 'bg-cyan-100 text-cyan-700',
  };

  const categoryColors = {
    'subscription': 'bg-blue-50 text-blue-600',
    'coaching': 'bg-amber-50 text-amber-600',
    'cohort': 'bg-emerald-50 text-emerald-600',
    'addon': 'bg-purple-50 text-purple-600',
  };

  // Format session count (handle -1 as unlimited)
  const formatCount = (used, total) => {
    if (total === -1 || total === null) return `${used || 0}/∞`;
    return `${used || 0}/${total || 0}`;
  };

  // Check if user has access to feature
  const hasAccess = (user, feature) => {
    const customAccess = user.custom_access || {};
    if (customAccess[feature] !== undefined) return customAccess[feature];
    // Default based on plan
    return true; // Default to true, can be refined based on plan features
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="candidates-section">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Candidate Management</h2>
          <p className="text-sm text-slate-500">
            Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} candidates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCandidates}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Excel
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {/* Plan Type Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 mr-2">Plan Type:</span>
          <Button 
            variant={planTypeFilter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPlanTypeFilter('all')}
          >
            All ({users.length})
          </Button>
          <Button 
            variant={planTypeFilter === 'subscription' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPlanTypeFilter('subscription')}
            className={planTypeFilter === 'subscription' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            Subscription ({subscriptionCount})
          </Button>
          <Button 
            variant={planTypeFilter === 'coaching' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPlanTypeFilter('coaching')}
            className={planTypeFilter === 'coaching' ? 'bg-amber-600 hover:bg-amber-700' : ''}
          >
            Coaching ({coachingCount})
          </Button>
          <Button 
            variant={planTypeFilter === 'cohort' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPlanTypeFilter('cohort')}
            className={planTypeFilter === 'cohort' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            Cohort ({cohortCount})
          </Button>
        </div>
        {selectedCandidates.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleDeleteSelected}
            disabled={deleting}
            data-testid="delete-selected-candidates-btn"
          >
            {deleting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedCandidates.length})</>
            )}
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-12 px-3 py-3">
                <input 
                  type="checkbox" 
                  checked={filteredUsers.length > 0 && selectedCandidates.length === filteredUsers.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-slate-300"
                  data-testid="select-all-candidates"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Candidate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">End Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Coach</th>
              <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Peer</th>
              <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Strategy</th>
              <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Courses</th>
              <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Drills</th>
              <th className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase">Workshops</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                  No candidates found
                </td>
              </tr>
            ) : filteredUsers.map((user) => (
              <tr key={user.id} className={`hover:bg-slate-50 ${selectedCandidates.includes(user.id) ? 'bg-blue-50' : ''}`}>
                <td className="w-12 px-3 py-3">
                  <input 
                    type="checkbox" 
                    checked={selectedCandidates.includes(user.id)}
                    onChange={(e) => handleSelectCandidate(user.id, e.target.checked)}
                    className="rounded border-slate-300"
                    data-testid={`select-candidate-${user.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}`} alt="" className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${planColors[user.plan] || 'bg-slate-100 text-slate-700'}`}>
                    {user.plan?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.plan_end_date ? (
                    <span className={`text-xs font-medium ${new Date(user.plan_end_date) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
                      {new Date(user.plan_end_date).toLocaleDateString()}
                      {new Date(user.plan_end_date) < new Date() && (
                        <span className="ml-1 text-red-500">(Expired)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-red-500">Not Set</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${categoryColors[getPlanCategory(user.plan)] || 'bg-slate-50 text-slate-600'}`}>
                    {getPlanCategory(user.plan)}
                  </span>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="text-sm font-medium text-slate-700">
                    {formatCount(user.coaching_sessions_used, user.coaching_sessions_total)}
                  </span>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="text-sm font-medium text-slate-700">
                    {formatCount(user.peer_sessions_used, user.peer_sessions_total)}
                  </span>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="text-sm font-medium text-slate-700">
                    {formatCount(user.strategy_calls_used, user.strategy_calls_total)}
                  </span>
                </td>
                <td className="px-2 py-3 text-center">
                  {hasAccess(user, 'courses') ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300 mx-auto" />
                  )}
                </td>
                <td className="px-2 py-3 text-center">
                  {hasAccess(user, 'drills') ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300 mx-auto" />
                  )}
                </td>
                <td className="px-2 py-3 text-center">
                  {hasAccess(user, 'workshops') ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-slate-200 bg-white rounded-b-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Page {currentPage} of {totalPages} ({totalUsers} total candidates)
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* First Page */}
            <Button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
              className="px-2"
            >
              First
            </Button>
            
            {/* Previous */}
            <Button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {(() => {
                const pages = [];
                const current = currentPage;
                
                // Show first page
                if (current > 3) {
                  pages.push(
                    <Button key={1} onClick={() => setCurrentPage(1)} variant="outline" size="sm" className="w-9">1</Button>
                  );
                  if (current > 4) {
                    pages.push(<span key="dots1" className="px-1 text-slate-400">...</span>);
                  }
                }
                
                // Show pages around current
                for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
                  pages.push(
                    <Button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      variant={i === current ? "default" : "outline"}
                      size="sm"
                      className="w-9"
                    >
                      {i}
                    </Button>
                  );
                }
                
                // Show last page
                if (current < totalPages - 2) {
                  if (current < totalPages - 3) {
                    pages.push(<span key="dots2" className="px-1 text-slate-400">...</span>);
                  }
                  pages.push(
                    <Button key={totalPages} onClick={() => setCurrentPage(totalPages)} variant="outline" size="sm" className="w-9">{totalPages}</Button>
                  );
                }
                
                return pages;
              })()}
            </div>
            
            {/* Next */}
            <Button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
            
            {/* Last Page */}
            <Button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
              className="px-2"
            >
              Last
            </Button>
            
            {/* Go to Page Input */}
            {totalPages > 10 && (
              <div className="flex items-center gap-1 ml-2 border-l pl-2">
                <span className="text-sm text-slate-500">Go to:</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const page = parseInt(pageInput);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                        setPageInput('');
                      }
                    }
                  }}
                  className="w-16 h-8 text-sm"
                  placeholder="#"
                />
                <Button
                  onClick={() => {
                    const page = parseInt(pageInput);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                      setPageInput('');
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  Go
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Candidate - {editingUser?.name}</DialogTitle>
            <DialogDescription>Update plan, sessions, and access permissions</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-6">
              {/* Plan Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Plan</label>
                  <Select value={editingUser.plan} onValueChange={(value) => setEditingUser({ ...editingUser, plan: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availablePlans.length > 0 ? (
                        availablePlans.map((plan) => (
                          <SelectItem key={plan.plan_key || plan.id} value={plan.plan_key || plan.id}>
                            {plan.name} ({plan.category})
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="free_trial">Free Trial</SelectItem>
                          <SelectItem value="basic_plan">Basic Plan</SelectItem>
                          <SelectItem value="pro_plan">Pro Plan</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Plan Type</label>
                  <p className={`mt-2 px-3 py-2 rounded text-sm font-medium capitalize ${categoryColors[getPlanCategory(editingUser.plan)] || 'bg-slate-50'}`}>
                    {getPlanCategory(editingUser.plan)}
                  </p>
                </div>
              </div>

              {/* Plan End Date - Single Source of Truth */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Plan Duration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Plan End Date</label>
                    <Input 
                      type="date" 
                      value={editingUser.plan_end_date ? editingUser.plan_end_date.split('T')[0] : ''} 
                      onChange={(e) => {
                        const newDate = e.target.value ? `${e.target.value}T23:59:59.000Z` : null;
                        setEditingUser({ 
                          ...editingUser, 
                          plan_end_date: newDate,
                          // Sync to category-specific fields
                          subscription_end: newDate,
                          subscription_end_date: newDate,
                          coaching_program_end_date: newDate
                        });
                      }}
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      This is when the user's access expires
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Days Remaining</label>
                    <p className="mt-2 px-3 py-2 bg-slate-50 rounded text-sm font-medium">
                      {editingUser.plan_end_date ? (
                        (() => {
                          const endDate = new Date(editingUser.plan_end_date);
                          const now = new Date();
                          const days = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                          if (days < 0) return <span className="text-red-600">Expired ({Math.abs(days)} days ago)</span>;
                          if (days === 0) return <span className="text-orange-600">Expires today</span>;
                          return <span className="text-green-600">{days} days left</span>;
                        })()
                      ) : (
                        <span className="text-red-600">Not set (expired)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Allocations */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Session Allocations</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <label className="text-xs font-medium text-blue-700">Coach Sessions</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        type="number" 
                        value={editingUser.coaching_sessions_used || 0} 
                        onChange={(e) => setEditingUser({ ...editingUser, coaching_sessions_used: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-center"
                        min={0}
                      />
                      <span className="text-slate-400">/</span>
                      <Input 
                        type="number" 
                        value={editingUser.coaching_sessions_total === -1 ? '' : (editingUser.coaching_sessions_total || 0)} 
                        onChange={(e) => setEditingUser({ ...editingUser, coaching_sessions_total: e.target.value === '' ? -1 : parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-center"
                        placeholder="∞"
                        min={-1}
                      />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Leave empty for unlimited</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <label className="text-xs font-medium text-green-700">Peer Sessions</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        type="number" 
                        value={editingUser.peer_sessions_used || 0} 
                        onChange={(e) => setEditingUser({ ...editingUser, peer_sessions_used: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-center"
                        min={0}
                      />
                      <span className="text-slate-400">/</span>
                      <Input 
                        type="number" 
                        value={editingUser.peer_sessions_total === -1 ? '' : (editingUser.peer_sessions_total || 0)} 
                        onChange={(e) => setEditingUser({ ...editingUser, peer_sessions_total: e.target.value === '' ? -1 : parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-center"
                        placeholder="∞"
                        min={-1}
                      />
                    </div>
                    <p className="text-xs text-green-600 mt-1">Leave empty for unlimited</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <label className="text-xs font-medium text-purple-700">Strategy Calls</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        type="number" 
                        value={editingUser.strategy_calls_used || 0} 
                        onChange={(e) => setEditingUser({ ...editingUser, strategy_calls_used: parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-center"
                        min={0}
                      />
                      <span className="text-slate-400">/</span>
                      <Input 
                        type="number" 
                        value={editingUser.strategy_calls_total === -1 ? '' : (editingUser.strategy_calls_total || 0)} 
                        onChange={(e) => setEditingUser({ ...editingUser, strategy_calls_total: e.target.value === '' ? -1 : parseInt(e.target.value) || 0 })}
                        className="w-16 h-8 text-center"
                        placeholder="∞"
                        min={-1}
                      />
                    </div>
                    <p className="text-xs text-purple-600 mt-1">Leave empty for unlimited</p>
                  </div>
                </div>
              </div>

              {/* Content Access */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Content Access</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'courses', label: 'Courses', icon: Video },
                    { key: 'drills', label: 'Case Drills', icon: FileText },
                    { key: 'workshops', label: 'Workshops', icon: Calendar },
                    { key: 'materials', label: 'Materials', icon: BookOpen },
                    { key: 'peer_practice', label: 'Peer Practice', icon: Users2 },
                    { key: 'coaching', label: 'Coaching', icon: UserCog },
                  ].map(({ key, label, icon: Icon }) => {
                    const hasCustomAccess = editingUser.custom_access?.[key] !== undefined;
                    const isEnabled = editingUser.custom_access?.[key] ?? true;
                    return (
                      <div 
                        key={key}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isEnabled 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                        onClick={() => {
                          const newAccess = { ...(editingUser.custom_access || {}), [key]: !isEnabled };
                          setEditingUser({ ...editingUser, custom_access: newAccess });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isEnabled ? 'text-green-600' : 'text-slate-400'}`} />
                            <span className={`text-sm font-medium ${isEnabled ? 'text-green-700' : 'text-slate-500'}`}>{label}</span>
                          </div>
                          {isEnabled ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <X className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button onClick={() => handleUpdateUser(editingUser.id, editingUser)}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidate Details</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : userDetails && userDetails.user ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <img src={userDetails.user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDetails.user?.name || 'User')}`} alt="" className="w-16 h-16 rounded-full" />
                <div>
                  <h3 className="font-semibold text-lg">{userDetails.user?.name || 'Unknown'}</h3>
                  <p className="text-slate-500">{userDetails.user?.email || ''}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${planColors[userDetails.user?.plan] || 'bg-slate-100'}`}>
                      {userDetails.user?.plan?.replace(/_/g, ' ') || 'Free'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${categoryColors[getPlanCategory(userDetails.user?.plan)] || 'bg-slate-50'}`}>
                      {getPlanCategory(userDetails.user?.plan)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{userDetails.stats?.completed_coaching_sessions || 0}</p>
                  <p className="text-sm text-blue-600">Coaching Sessions</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{userDetails.stats?.completed_peer_sessions || 0}</p>
                  <p className="text-sm text-green-600">Peer Sessions</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-700">{userDetails.stats?.videos_watched || 0}</p>
                  <p className="text-sm text-purple-600">Videos Watched</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-700">₹{userDetails.stats?.total_spent?.toLocaleString() || 0}</p>
                  <p className="text-sm text-amber-600">Total Spent</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h4 className="font-medium mb-3">Recent Coaching Sessions</h4>
                {userDetails.recent_bookings?.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.recent_bookings.slice(0, 5).map((booking, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{booking.mentor_name || 'Mentor'}</p>
                          <p className="text-xs text-slate-500">{booking.date} at {booking.time_slot}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${booking.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {booking.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No coaching sessions yet</p>}
              </div>

              {/* Feedbacks */}
              <div>
                <h4 className="font-medium mb-3">Recent Feedbacks</h4>
                {userDetails.recent_feedbacks?.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.recent_feedbacks.slice(0, 3).map((feedback, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className="font-medium text-sm">{feedback.rating}/5</span>
                        </div>
                        <p className="text-sm text-slate-600">{feedback.notes || 'No comments'}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">No feedbacks received</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p>Failed to load user details</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => selectedUser && fetchUserDetails(selectedUser.id)}>
                Retry
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Access Control Modal (legacy - kept for compatibility) */}
      <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Access - {selectedUser?.name}</DialogTitle>
            <DialogDescription>Grant or revoke access to specific services</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {['videos', 'workshops', 'drills', 'materials', 'peer_practice', 'coaching', 'cohort'].map((accessType) => (
                <div key={accessType} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="font-medium capitalize">{accessType.replace('_', ' ')}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant={selectedUser.custom_access?.[accessType] === true ? 'default' : 'outline'} onClick={() => handleUpdateAccess(accessType, true)}>
                      <Eye className="w-4 h-4 mr-1" /> Grant
                    </Button>
                    <Button size="sm" variant={selectedUser.custom_access?.[accessType] === false ? 'destructive' : 'outline'} onClick={() => handleUpdateAccess(accessType, false)}>
                      <EyeOff className="w-4 h-4 mr-1" /> Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Sales & Invoices Section ============
const SalesSection = () => {
  const [metrics, setMetrics] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ user_id: '', plan: '', amount: 0, payment_method: 'razorpay', status: 'paid' });
  const [users, setUsers] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [metricsRes, invoicesRes, pnlRes, usersRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/sales/metrics`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/sales/invoices`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/sales/pnl`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/users`, { withCredentials: true })
      ]);
      setMetrics(metricsRes.data);
      setInvoices(invoicesRes.data.invoices);
      setPnl(pnlRes.data);
      setUsers(usersRes.data.users);
    } catch (error) {
      console.error('Failed to fetch sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/sales/invoices`, newInvoice, { withCredentials: true });
      fetchData();
      setShowInvoiceModal(false);
      setNewInvoice({ user_id: '', plan: '', amount: 0, payment_method: 'razorpay', status: 'paid' });
    } catch (error) {
      alert('Failed to create invoice');
    }
  };

  const handleRefund = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to refund this invoice?')) return;
    try {
      await axios.post(`${BACKEND_URL}/api/sales/invoices/${invoiceId}/refund`, {}, { withCredentials: true });
      fetchData();
    } catch (error) {
      alert('Failed to refund invoice');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Sales & Invoices</h2>
        <Button onClick={() => setShowInvoiceModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Create Invoice
        </Button>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Total Revenue" 
            value={`₹${metrics.total_revenue?.toLocaleString() || 0}`} 
            icon={DollarSign} 
            color="bg-emerald-500"
            trend={metrics.growth_percentage > 0 ? 'up' : 'down'}
            trendValue={`${Math.abs(metrics.growth_percentage || 0).toFixed(1)}%`}
          />
          <StatCard label="This Month" value={`₹${metrics.this_month_revenue?.toLocaleString() || 0}`} icon={TrendingUp} color="bg-blue-500" />
          <StatCard label="Paid Invoices" value={metrics.paid_invoices || 0} icon={Receipt} color="bg-purple-500" />
          <StatCard label="Avg Order Value" value={`₹${metrics.average_order_value?.toLocaleString() || 0}`} icon={BarChart3} color="bg-amber-500" />
        </div>
      )}

      {/* P&L Summary */}
      {pnl && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="font-semibold mb-4">P&L Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Gross Profit</p>
              <p className="text-xl font-bold text-green-700">₹{pnl.gross_profit?.toLocaleString() || 0}</p>
              <p className="text-xs text-green-600">{pnl.gross_margin?.toFixed(1)}% margin</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">Operating Expenses</p>
              <p className="text-xl font-bold text-red-700">₹{pnl.operating_expenses?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">Net Profit</p>
              <p className="text-xl font-bold text-blue-700">₹{pnl.net_profit?.toLocaleString() || 0}</p>
              <p className="text-xs text-blue-600">{pnl.net_margin?.toFixed(1)}% margin</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600">Mentor Payouts</p>
              <p className="text-xl font-bold text-purple-700">₹{pnl.costs?.mentor_payouts?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Revenue by Plan */}
      {metrics?.revenue_by_plan && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="font-semibold mb-4">Revenue by Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.revenue_by_plan).map(([plan, revenue]) => (
              <div key={plan} className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 capitalize">{plan.replace('_', ' ')}</p>
                <p className="text-lg font-bold">₹{revenue?.toLocaleString() || 0}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold">Recent Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Invoice ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Base Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Discount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Paid Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">GST</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 text-sm font-mono text-xs">{invoice.id?.slice(0, 12)}...</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <img src={invoice.user?.picture || 'https://via.placeholder.com/32'} alt="" className="w-8 h-8 rounded-full" />
                      <div>
                        <p className="font-medium text-sm">{invoice.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{invoice.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm capitalize">{(invoice.plan_name || invoice.plan)?.replace('_', ' ')}</td>
                  <td className="px-4 py-4 text-sm text-right">₹{(invoice.base_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-right">
                    {invoice.discount_amount > 0 ? (
                      <span className="text-green-600">-₹{invoice.discount_amount.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-right">₹{(invoice.discounted_price || invoice.base_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-right text-slate-500">₹{(invoice.gst || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-right font-semibold">₹{(invoice.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                      invoice.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {invoice.coupon_code && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full" title="Coupon Used">
                          {invoice.coupon_code}
                        </span>
                      )}
                      {invoice.status === 'paid' && (
                        <Button size="sm" variant="ghost" onClick={() => handleRefund(invoice.id)} className="text-xs">
                          Refund
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">No invoices yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Customer</label>
              <Select value={newInvoice.user_id} onValueChange={(v) => setNewInvoice({ ...newInvoice, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Plan</label>
              <Select value={newInvoice.plan} onValueChange={(v) => setNewInvoice({ ...newInvoice, plan: v })}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic - ₹4,999</SelectItem>
                  <SelectItem value="pro">Pro - ₹7,999</SelectItem>
                  <SelectItem value="last_mile">Last Mile - ₹16,999</SelectItem>
                  <SelectItem value="mid_mile">Mid Mile - ₹29,999</SelectItem>
                  <SelectItem value="full_prep">Full Prep - ₹44,999</SelectItem>
                  <SelectItem value="cohort_premium">Cohort Premium - ₹34,999</SelectItem>
                  <SelectItem value="cohort_elite">Cohort Elite - ₹49,999</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Amount (₹)</label>
              <Input type="number" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select value={newInvoice.status} onValueChange={(v) => setNewInvoice({ ...newInvoice, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
              <Button onClick={handleCreateInvoice}>Create Invoice</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Sessions Tracking Section ============
const SessionsSection = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mentorsList, setMentorsList] = useState([]);
  const [candidatesList, setCandidatesList] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    mentor_id: '',
    candidate_id: '',
    date_from: '',
    date_to: '',
    status: '',
    completion_status: ''
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Detail modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [page, filters]);

  const loadInitialData = async () => {
    try {
      const [statsRes, mentorsRes, candidatesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/sessions/stats`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/sessions/mentors-list`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/sessions/candidates-list`, { withCredentials: true })
      ]);
      setStats(statsRes.data);
      setMentorsList(mentorsRes.data);
      setCandidatesList(candidatesRes.data);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 20);
      
      if (filters.mentor_id) params.append('mentor_id', filters.mentor_id);
      if (filters.candidate_id) params.append('candidate_id', filters.candidate_id);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.status) params.append('status', filters.status);
      if (filters.completion_status) params.append('completion_status', filters.completion_status);
      
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/sessions?${params.toString()}`,
        { withCredentials: true }
      );
      
      setSessions(response.data.sessions);
      setTotal(response.data.total);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSessionDetails = async (session) => {
    setSelectedSession(session);
    setDetailModalOpen(true);
    
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/sessions/${session.id}`,
        { withCredentials: true }
      );
      setSessionDetails(response.data);
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
  };

  // Mark session status modal state
  const [markStatusModalOpen, setMarkStatusModalOpen] = useState(false);
  const [markStatusSession, setMarkStatusSession] = useState(null);
  const [newStatus, setNewStatus] = useState('completed');
  const [statusNotes, setStatusNotes] = useState('');
  const [markingStatus, setMarkingStatus] = useState(false);

  const openMarkStatusModal = (session) => {
    setMarkStatusSession(session);
    setNewStatus('completed');
    setStatusNotes('');
    setMarkStatusModalOpen(true);
  };

  const handleMarkStatus = async () => {
    if (!markStatusSession) return;
    
    setMarkingStatus(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/sessions/${markStatusSession.id}/mark-status`,
        {
          status: newStatus,
          notes: statusNotes || undefined
        },
        { withCredentials: true }
      );
      
      setMarkStatusModalOpen(false);
      setMarkStatusSession(null);
      loadSessions();
      loadInitialData(); // Refresh stats
    } catch (error) {
      console.error('Failed to mark session status:', error);
      alert(error.response?.data?.detail || 'Failed to update session status');
    } finally {
      setMarkingStatus(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      mentor_id: '',
      candidate_id: '',
      date_from: '',
      date_to: '',
      status: '',
      completion_status: ''
    });
    setPage(1);
  };

  const getStatusBadge = (status, completionStatus) => {
    if (completionStatus === 'completed') {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Completed</span>;
    }
    if (completionStatus === 'no_show_candidate') {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">No-Show (Candidate)</span>;
    }
    if (completionStatus === 'no_show_mentor') {
      return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">No-Show (Mentor)</span>;
    }
    if (status === 'cancelled') {
      return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">Cancelled</span>;
    }
    if (status === 'confirmed') {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Confirmed</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Session Tracking</h1>
          <p className="text-sm text-slate-500">Monitor all coaching sessions, check-ins, and feedback status</p>
        </div>
        <Button onClick={loadSessions} variant="outline" size="sm">
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total_sessions}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Today</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sessions_today}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.by_status?.completed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Cancelled</p>
            <p className="text-2xl font-bold text-slate-600">{stats.by_status?.cancelled || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Pending Confirmation</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending_confirmation}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">No-Shows</p>
            <p className="text-2xl font-bold text-red-600">{stats.by_status?.no_show || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Select value={filters.mentor_id || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, mentor_id: v === 'all' ? '' : v }))}>
            <SelectTrigger data-testid="filter-mentor">
              <SelectValue placeholder="All Mentors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mentors</SelectItem>
              {mentorsList.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.candidate_id || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, candidate_id: v === 'all' ? '' : v }))}>
            <SelectTrigger data-testid="filter-candidate">
              <SelectValue placeholder="All Candidates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Candidates</SelectItem>
              {candidatesList.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
            placeholder="From Date"
            data-testid="filter-date-from"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
            placeholder="To Date"
            data-testid="filter-date-to"
          />

          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
            <SelectTrigger data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.completion_status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, completion_status: v === 'all' ? '' : v }))}>
            <SelectTrigger data-testid="filter-completion">
              <SelectValue placeholder="Completion Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending Confirmation</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no_show_candidate">No-Show (Candidate)</SelectItem>
              <SelectItem value="no_show_mentor">No-Show (Mentor)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Check-ins</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Candidate Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.date}</p>
                      <p className="text-sm text-slate-500">{session.time_slot}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.mentor_name}</p>
                      <p className="text-xs text-slate-500">{session.mentor_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.candidate_name}</p>
                      <p className="text-xs text-slate-500">{session.candidate_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(session.status, session.completion_status)}
                      {session.was_rescheduled && (
                        <span 
                          className="ml-1 px-1.5 py-0.5 text-xs bg-amber-50 text-amber-600 rounded cursor-help"
                          title={`Rescheduled by ${session.rescheduled_by_name || session.rescheduled_by || 'unknown'} from ${session.previous_date} at ${session.previous_time_slot}`}
                        >
                          Rescheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${session.mentor_checked_in ? 'bg-green-500' : 'bg-slate-300'}`} title="Mentor" />
                        <span className={`w-2 h-2 rounded-full ${session.candidate_checked_in ? 'bg-green-500' : 'bg-slate-300'}`} title="Candidate" />
                        <span className="text-xs text-slate-500">
                          {session.mentor_checked_in && session.candidate_checked_in ? 'Both' :
                           session.mentor_checked_in ? 'Mentor only' :
                           session.candidate_checked_in ? 'Candidate only' : 'None'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.mentor_feedback_given ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {session.mentor_feedback_rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {session.mentor_feedback_rating}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not given</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.candidate_feedback_given ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {session.candidate_feedback_rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {session.candidate_feedback_rating}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not given</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSessionDetails(session)}
                          data-testid={`view-session-${session.id}`}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!session.completion_status && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openMarkStatusModal(session)}
                            data-testid={`mark-status-${session.id}`}
                            title="Mark Status"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
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
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} sessions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>
          {sessionDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Date & Time</p>
                  <p className="font-medium">{sessionDetails.session?.date} at {sessionDetails.session?.time_slot}</p>
                  {sessionDetails.session?.was_rescheduled && (
                    <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                      <p className="text-xs text-amber-700 font-medium">⚠️ Rescheduled</p>
                      <p className="text-xs text-amber-600 mt-1">
                        From: {sessionDetails.session?.previous_date} at {sessionDetails.session?.previous_time_slot}
                      </p>
                      <p className="text-xs text-amber-600">
                        By: {sessionDetails.session?.rescheduled_by_name || sessionDetails.session?.rescheduled_by || 'Unknown'}
                        {sessionDetails.session?.rescheduled_by && ` (${sessionDetails.session?.rescheduled_by})`}
                      </p>
                      {sessionDetails.session?.rescheduled_at && (
                        <p className="text-xs text-amber-500 mt-1">
                          {new Date(sessionDetails.session?.rescheduled_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Session Type</p>
                  <p className="font-medium">{sessionDetails.session?.session_type || 'Coaching Session'}</p>
                </div>
              </div>

              {/* Mentor & Candidate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Mentor</p>
                  <p className="font-medium text-slate-900">{sessionDetails.mentor?.name}</p>
                  <p className="text-sm text-slate-500">{sessionDetails.mentor?.email}</p>
                  <p className="text-sm text-slate-500">{sessionDetails.mentor?.company}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Check-in: {sessionDetails.session?.mentor_checked_in ? (
                        <span className="text-green-600">✓ {new Date(sessionDetails.session?.mentor_checked_in_at).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">Not checked in</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Candidate</p>
                  <p className="font-medium text-slate-900">{sessionDetails.candidate?.name}</p>
                  <p className="text-sm text-slate-500">{sessionDetails.candidate?.email}</p>
                  <p className="text-sm text-slate-500">Plan: {sessionDetails.candidate?.plan || 'N/A'}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Check-in: {sessionDetails.session?.candidate_checked_in ? (
                        <span className="text-green-600">✓ {new Date(sessionDetails.session?.candidate_checked_in_at).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">Not checked in</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase mb-2">Session Status</p>
                <div className="flex items-center gap-3">
                  {getStatusBadge(sessionDetails.session?.status, sessionDetails.session?.completion_status)}
                  {sessionDetails.session?.completion_notes && (
                    <p className="text-sm text-slate-600">Notes: {sessionDetails.session?.completion_notes}</p>
                  )}
                  {!sessionDetails.session?.completion_status && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailModalOpen(false);
                        openMarkStatusModal(sessionDetails.session);
                      }}
                      className="ml-auto"
                    >
                      Mark Status
                    </Button>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Mentor Feedback (to Candidate)</p>
                  {sessionDetails.mentor_feedback ? (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= sessionDetails.mentor_feedback.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                        ))}
                      </div>
                      {sessionDetails.mentor_feedback.notes && (
                        <p className="text-sm text-slate-600">{sessionDetails.mentor_feedback.notes}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not yet provided</p>
                  )}
                </div>
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Candidate Feedback (to Mentor)</p>
                  {sessionDetails.candidate_feedback ? (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= sessionDetails.candidate_feedback.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                        ))}
                      </div>
                      {sessionDetails.candidate_feedback.comment && (
                        <p className="text-sm text-slate-600">{sessionDetails.candidate_feedback.comment}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not yet provided</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark Status Modal */}
      <Dialog open={markStatusModalOpen} onOpenChange={setMarkStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Session Status</DialogTitle>
          </DialogHeader>
          {markStatusSession && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-slate-900">
                  {markStatusSession.mentor_name} → {markStatusSession.candidate_name}
                </p>
                <p className="text-sm text-slate-500">
                  {markStatusSession.date} at {markStatusSession.time_slot}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className={markStatusSession.mentor_checked_in ? 'text-green-600' : 'text-slate-400'}>
                    {markStatusSession.mentor_checked_in ? '✓ Mentor joined' : '✗ Mentor didn\'t join'}
                  </span>
                  <span className={markStatusSession.candidate_checked_in ? 'text-green-600' : 'text-slate-400'}>
                    {markStatusSession.candidate_checked_in ? '✓ Candidate joined' : '✗ Candidate didn\'t join'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Session Status
                </label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">✓ Completed Successfully</SelectItem>
                    <SelectItem value="no_show_candidate">✗ Candidate No-Show</SelectItem>
                    <SelectItem value="no_show_mentor">✗ Mentor No-Show</SelectItem>
                    <SelectItem value="cancelled">✗ Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Admin Notes (optional)
                </label>
                <Textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Any notes about this session..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkStatus}
              disabled={markingStatus}
              className={newStatus === 'completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}
            >
              {markingStatus ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Placeholder Sections (Videos, Workshops, Drills, Materials, Mentors, Peer Practice, Cohort) ============
// Lazy-loaded AdminComponents sections — each is its own file for optimal code-splitting
const VideosSection = React.lazy(() => import('../components/AdminComponents').then(m => ({ default: m.VideosSection })));
const DrillsSection = React.lazy(() => import('../components/AdminComponents').then(m => ({ default: m.DrillsSection })));
const MaterialsSection = React.lazy(() => import('../components/AdminComponents').then(m => ({ default: m.MaterialsSection })));
const PeerPracticeSection = React.lazy(() => import('../components/AdminComponents').then(m => ({ default: m.PeerPracticeSection })));

// Heavy sections — split into individual files for fast loading
const PeerSessionsSection = React.lazy(() => import('../components/admin/PeerSessionsSection'));
const PeerProfilesManagementSection = React.lazy(() => import('../components/admin/PeerProfilesManagementSection'));
const WorkshopsSection = React.lazy(() => import('../components/admin/WorkshopsSection'));
const MentorsSection = React.lazy(() => import('../components/admin/MentorsSection'));
const CoursesSection = React.lazy(() => import('../components/CoursesManagement'));
const CoachingSessionsSection = React.lazy(() => import('../components/admin/CoachingSessionsSection'));
const PayoutsSection = React.lazy(() => import('../components/admin/PayoutsSection'));
const CohortSection = CohortProgramsAdmin;



// ============ Cancellation Policy Section ============
const CancellationPolicySection = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidateHours, setCandidateHours] = useState(4);
  const [mentorHours, setMentorHours] = useState(4);

  useEffect(() => {
    loadPolicy();
  }, []);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/admin/cancellation-policy`, {
        withCredentials: true
      });
      setCandidateHours(response.data.candidate_hours);
      setMentorHours(response.data.mentor_hours);
    } catch (error) {
      console.error('Failed to load policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${BACKEND_URL}/api/admin/cancellation-policy`,
        {
          candidate_hours: candidateHours,
          mentor_hours: mentorHours
        },
        { withCredentials: true }
      );
      alert('Cancellation policy updated successfully!');
    } catch (error) {
      console.error('Failed to save policy:', error);
      alert('Failed to update policy: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cancellation & Reschedule Policy</h1>
        <p className="text-slate-600 mt-2">
          Configure the minimum hours required before a session for cancellation or rescheduling.
          Same policy applies to both actions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Candidate Policy */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Candidate Policy</h3>
              <p className="text-sm text-slate-600">
                Minimum hours before session that candidates must cancel or reschedule
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Hours Before Session
              </label>
              <Select
                value={candidateHours.toString()}
                onValueChange={(v) => setCandidateHours(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 12, 24, 48, 72].map((hours) => (
                    <SelectItem key={hours} value={hours.toString()}>
                      {hours} hour{hours > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Current: Candidates must cancel/reschedule at least <strong>{candidateHours} hours</strong> before the session
              </p>
            </div>
          </div>

          {/* Mentor Policy */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Mentor Policy</h3>
              <p className="text-sm text-slate-600">
                Minimum hours before session that mentors must cancel or reschedule
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Hours Before Session
              </label>
              <Select
                value={mentorHours.toString()}
                onValueChange={(v) => setMentorHours(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 12, 24, 48, 72].map((hours) => (
                    <SelectItem key={hours} value={hours.toString()}>
                      {hours} hour{hours > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Current: Mentors must cancel/reschedule at least <strong>{mentorHours} hours</strong> before the session
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <Clock className="w-4 h-4 inline mr-1" />
              Changes take effect immediately for all new cancellation/reschedule requests
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Policy
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>If a user tries to cancel/reschedule within the policy window, they will be blocked</li>
              <li>The same hours apply to both cancellation and rescheduling</li>
              <li>Users will see the deadline on their booking cards</li>
              <li>Setting to 0 hours means users can cancel/reschedule anytime</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ Case Drills Section (AI-Generated Drills Management) ============
const CaseDrillsSection = () => {
  const [drills, setDrills] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDrills();
  }, []);

  const fetchDrills = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/admin/ai-drills`, { withCredentials: true });
      setDrills(res.data.drills || []);
      setStats(res.data.stats || {});
    } catch (error) {
      console.error('Failed to fetch drills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFreeTrial = async (drillId, currentValue) => {
    try {
      setSaving(true);
      await axios.put(`${BACKEND_URL}/api/admin/ai-drills/${drillId}`, 
        { is_free_trial: !currentValue },
        { withCredentials: true }
      );
      // Update local state
      setDrills(prev => prev.map(d => 
        d.id === drillId ? { ...d, is_free_trial: !currentValue, is_custom_setting: true } : d
      ));
      // Refresh stats
      fetchDrills();
    } catch (error) {
      console.error('Failed to update drill:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBasicPlan = async (drillId, currentValue) => {
    try {
      setSaving(true);
      await axios.put(`${BACKEND_URL}/api/admin/ai-drills/${drillId}`, 
        { is_basic_plan: !currentValue },
        { withCredentials: true }
      );
      // Update local state
      setDrills(prev => prev.map(d => 
        d.id === drillId ? { ...d, is_basic_plan: !currentValue, is_custom_setting: true } : d
      ));
      // Refresh stats
      fetchDrills();
    } catch (error) {
      console.error('Failed to update drill:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all drill settings to defaults? First 3 drills of each type will be free trial.')) return;
    
    try {
      setSaving(true);
      await axios.post(`${BACKEND_URL}/api/admin/ai-drills/reset-defaults`, {}, { withCredentials: true });
      fetchDrills();
    } catch (error) {
      console.error('Failed to reset drills:', error);
    } finally {
      setSaving(false);
    }
  };

  // Filter drills
  const filteredDrills = drills.filter(drill => {
    const matchesType = typeFilter === 'all' || drill.drill_type === typeFilter;
    const matchesSearch = searchQuery === '' || drill.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Count free trial drills in filtered list
  const filteredFreeCount = filteredDrills.filter(d => d.is_free_trial).length;

  if (loading) {
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
          <h1 className="text-2xl font-bold text-slate-900">Case Drills Management</h1>
          <p className="text-slate-500 mt-1">Control which AI-generated drills are available for free trial users</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleResetDefaults}
          disabled={saving}
          className="text-amber-600 border-amber-300 hover:bg-amber-50"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Case Math</p>
              <p className="text-lg font-semibold text-slate-900">{stats?.case_math || 0} drills</p>
              <p className="text-xs text-emerald-600">{stats?.case_math_free || 0} free trial</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <Play className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Case Structuring</p>
              <p className="text-lg font-semibold text-slate-900">{stats?.case_structuring || 0} drills</p>
              <p className="text-xs text-emerald-600">{stats?.case_structuring_free || 0} free trial</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Free Trial</p>
              <p className="text-lg font-semibold text-slate-900">{(stats?.case_math_free || 0) + (stats?.case_structuring_free || 0)} drills</p>
              <p className="text-xs text-slate-500">available for trial users</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Drills</p>
              <p className="text-lg font-semibold text-slate-900">{drills.length}</p>
              <p className="text-xs text-slate-500">AI-generated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search drills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="case_math">Case Math</SelectItem>
            <SelectItem value="case_structuring">Case Structuring</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-slate-500">
          Showing {filteredDrills.length} drills ({filteredFreeCount} free trial, {filteredDrills.filter(d => d.is_basic_plan).length} basic)
        </div>
      </div>

      {/* Drills Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Drill</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Difficulty</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Questions</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Free Trial</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Basic Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDrills.map((drill) => (
              <tr key={drill.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      drill.drill_type === 'case_math' ? 'bg-blue-100' : 'bg-cyan-100'
                    }`}>
                      <Play className={`w-4 h-4 ${
                        drill.drill_type === 'case_math' ? 'text-blue-600' : 'text-cyan-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{drill.name}</p>
                      {drill.is_custom_setting && (
                        <p className="text-xs text-amber-600">Custom setting</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    drill.drill_type === 'case_math' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-cyan-100 text-cyan-700'
                  }`}>
                    {drill.drill_type_label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    drill.difficulty === 'beginner' ? 'bg-emerald-100 text-emerald-700' :
                    drill.difficulty === 'intermediate' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {drill.difficulty_label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{drill.question_count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => handleToggleFreeTrial(drill.id, drill.is_free_trial)}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        drill.is_free_trial ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      data-testid={`toggle-free-${drill.id}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          drill.is_free_trial ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => handleToggleBasicPlan(drill.id, drill.is_basic_plan)}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        drill.is_basic_plan ? 'bg-blue-500' : 'bg-slate-300'
                      }`}
                      data-testid={`toggle-basic-${drill.id}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          drill.is_basic_plan ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">How it works</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500"></div>
            <span><strong>Free Trial ON:</strong> Drill is accessible to free trial users</span>
          </li>
          <li className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span><strong>Basic Plan ON:</strong> Drill is accessible to basic plan users</span>
          </li>
          <li className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-300"></div>
            <span><strong>Toggle OFF:</strong> Drill requires higher subscription (Pro/Pro+)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-amber-600">Custom setting</span>
            <span>- Admin has modified the default setting</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

// ============ Main Admin Dashboard ============
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('analytics'); // Default to analytics
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [supportCount, setSupportCount] = useState(0);
  const [pendingMentorApprovals, setPendingMentorApprovals] = useState(0);
  const [formsCount, setFormsCount] = useState(0);
  const [formsCounts, setFormsCounts] = useState({ contact: 0, support: 0, feedback: 0, coach: 0, pinnacle: 0, scholarship: 0 });
  const [discoveryCallsCount, setDiscoveryCallsCount] = useState(0);
  const [newSalesCount, setNewSalesCount] = useState(0);

  // Handle OAuth redirect tokens from URL params (Mobile Safari)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionToken = urlParams.get('session_token');
    const authSuccess = urlParams.get('auth_success');
    const authError = urlParams.get('auth_error');
    
    // Handle OAuth error
    if (authError) {
      console.error('[AdminDashboard] OAuth error:', authError);
      window.history.replaceState({}, document.title, '/admin');
      window.location.href = '/';
      return;
    }
    
    if (authSuccess === 'true' && sessionToken) {
      // Store tokens from OAuth redirect
      localStorage.setItem('session_token', sessionToken);
      // Clean up URL params
      window.history.replaceState({}, document.title, '/admin');
      console.log('[AdminDashboard] OAuth tokens stored from redirect');
    }
  }, []);

  useEffect(() => { checkAdminAccess(); }, []);
  useEffect(() => { fetchSupportCount(); fetchPendingMentorApprovals(); fetchFormsCount(); fetchDiscoveryCallsCount(); fetchNewSalesCount(); }, []);
  
  // Fetch counts every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSupportCount();
      fetchPendingMentorApprovals();
      fetchFormsCount();
      fetchDiscoveryCallsCount();
      fetchNewSalesCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSupportCount = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/support/admin/queries/count`, { withCredentials: true });
      setSupportCount(res.data.total);
    } catch (error) {
      console.error('Failed to fetch support count:', error);
    }
  };

  const fetchPendingMentorApprovals = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/mentors/pending-changes/count`, { withCredentials: true });
      setPendingMentorApprovals(res.data.count);
    } catch (error) {
      console.error('Failed to fetch pending mentor approvals:', error);
    }
  };

  const fetchFormsCount = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/forms/counts`, { withCredentials: true });
      // Also fetch pinnacle and scholarship applications count
      let pinnacleCount = 0;
      let scholarshipCount = 0;
      try {
        const pinnacleRes = await axios.get(`${BACKEND_URL}/api/forms/pinnacle-applications?status=pending`, { withCredentials: true });
        pinnacleCount = pinnacleRes.data.total || 0;
      } catch (e) {
        console.log('Could not fetch pinnacle count');
      }
      try {
        const scholarshipRes = await axios.get(`${BACKEND_URL}/api/forms/scholarship-applications?status=pending`, { withCredentials: true });
        scholarshipCount = scholarshipRes.data.total || 0;
      } catch (e) {
        console.log('Could not fetch scholarship count');
      }
      
      setFormsCount((res.data.total_unresponded || 0) + pinnacleCount + scholarshipCount);
      setFormsCounts({
        contact: res.data.contact?.new || 0,
        support: res.data.support?.open || 0,
        feedback: 0, // Feedback has no "new" concept
        coach: res.data.coach_applications?.new || 0,
        pinnacle: pinnacleCount,
        scholarship: scholarshipCount
      });
    } catch (error) {
      console.error('Failed to fetch forms count:', error);
    }
  };

  const fetchDiscoveryCallsCount = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/discovery-calls/pending-count`, { withCredentials: true });
      setDiscoveryCallsCount(res.data.pending_count || 0);
    } catch (error) {
      console.error('Failed to fetch discovery calls count:', error);
    }
  };

  const fetchNewSalesCount = async () => {
    try {
      // Get sales from last 24 hours
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/summary`, { withCredentials: true });
      // Use today's transaction count as "new" sales
      setNewSalesCount(res.data.today?.count || 0);
    } catch (error) {
      console.error('Failed to fetch new sales count:', error);
    }
  };

  const checkAdminAccess = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/auth/me`, { withCredentials: true });
      if (!res.data.is_admin) {
        // Not an admin - redirect to appropriate dashboard
        if (res.data.is_mentor) {
          navigate('/mentor-dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }
      setUser(res.data);
      const statsRes = await axios.get(`${BACKEND_URL}/api/admin/stats`, { withCredentials: true });
      setStats(statsRes.data);
    } catch (error) {
      // Not logged in - redirect to home
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error) {}
    navigate('/');
  };

  const sidebarItems = [
    // 1. Analytics first
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    
    // 2. Candidates
    { 
      id: 'candidates-group', 
      label: 'Candidates', 
      icon: Users,
      isDropdown: true,
      children: [
        { id: 'candidates', label: 'Candidate Details', icon: Users },
        { id: 'candidate-analytics', label: 'Candidate Analytics', icon: TrendingUp },
        { id: 'candidate-notifications', label: 'Candidate Notifications', icon: Bell },
      ]
    },
    
    // 4. Mentors
    { 
      id: 'mentors-group', 
      label: 'Mentors', 
      icon: UserCog,
      isDropdown: true,
      badge: pendingMentorApprovals,
      children: [
        { id: 'mentors', label: 'Mentor Details', icon: UserCog },
        { id: 'mentor-notifications', label: 'Mentor Notifications', icon: Bell },
        { id: 'mentor-calendar', label: 'Mentor Calendar', icon: Calendar },
        { id: 'mentor-analytics', label: 'Mentor Analytics', icon: BarChart3 },
      ]
    },
    
    // 5. Sessions (Coaching Sessions + Peer Sessions)
    { 
      id: 'sessions-group', 
      label: 'Sessions', 
      icon: Calendar,
      isDropdown: true,
      children: [
        { id: 'coaching-sessions', label: 'Coaching Sessions', icon: Calendar },
        { id: 'peer-sessions', label: 'Peer Sessions', icon: Users2 },
        { id: 'peer-profiles', label: 'Peer Profiles', icon: Users2 },
      ]
    },
    
    // 6. Forms (moved here after Sessions)
    { 
      id: 'forms-group', 
      label: 'Forms', 
      icon: ClipboardList,
      isDropdown: true,
      badge: formsCount,
      children: [
        { id: 'contact-submissions', label: 'Contact Us', icon: MessageSquare, badge: formsCounts.contact },
        { id: 'support', label: 'Support', icon: MessageCircle, badge: formsCounts.support },
        { id: 'feedback', label: 'Feedback', icon: ThumbsUp },
        { id: 'coach-applications', label: 'Become a Coach', icon: Briefcase, badge: formsCounts.coach },
        { id: 'pinnacle-applications', label: 'Pinnacle Program', icon: Award, badge: formsCounts.pinnacle },
        { id: 'scholarship-applications', label: 'Scholarship', icon: GraduationCap, badge: formsCounts.scholarship },
      ]
    },
    
    // 7. Discovery Calls
    { id: 'discovery-calls', label: 'Discovery Calls', icon: Phone, badge: discoveryCallsCount },
    
    // 8. Courses
    { id: 'courses', label: 'Courses', icon: Video },
    
    // 9. Case Drills
    { id: 'case-drills', label: 'Case Drills', icon: Play },
    
    // 9. Workshops
    { id: 'workshops', label: 'Workshops', icon: Calendar },
    
    // 10. Materials
    { id: 'materials', label: 'Materials', icon: BookOpen },
    
    // 11. Blogs
    { id: 'blogs', label: 'Blogs', icon: FileText },
    
    // Rest of items
    { id: 'plans', label: 'Plans', icon: Package },
    { id: 'discounts', label: 'Discounts', icon: Tag },
    { id: 'competitions', label: 'Competitions', icon: Trophy },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'lead-scoring', label: 'Lead Scoring', icon: TrendingUp },
    { id: 'crm', label: 'CRM Dashboard', icon: BarChart3, isLink: true, href: '/crm' },
    { id: 'partners', label: 'Partner Integrations', icon: Building },
    { id: 'payouts', label: 'Mentor Payouts', icon: DollarSign },
    { id: 'cohort', label: 'Cohort', icon: GraduationCap },
    { id: 'sales', label: 'Sales', icon: Receipt, badge: newSalesCount },
    { id: 'logo-repository', label: 'Logo Repository', icon: ImageIcon },
    { id: 'testimonials', label: 'Testimonials', icon: Star },
    { id: 'cancellation-policy', label: 'Cancellation Policy', icon: Clock },
    { id: 'users', label: 'Users', icon: Users },
  ];

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Track expanded dropdowns
  const [expandedDropdowns, setExpandedDropdowns] = useState([]);

  const toggleDropdown = (groupId) => {
    setExpandedDropdowns(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isChildActive = (item) => {
    if (!item.children) return false;
    return item.children.some(child => child.id === activeSection);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  if (accessError) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Access Required</h1>
      <p className="text-slate-500 mb-6">Please log in as an admin to access this page.</p>
      <Button onClick={() => navigate('/')} className="bg-blue-600 hover:bg-blue-700">Back to Home</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Collapsible Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-white fixed h-full z-40 transition-all duration-300`}>
        {/* Header with Logo and Toggle */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_mentor-match-98/artifacts/it3j6j4a_Gradnext%20logo%20-%20White.png" 
                alt="gradnext" 
                className="h-8 w-auto"
              />
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <img 
                src="https://customer-assets.emergentagent.com/job_mentor-match-98/artifacts/it3j6j4a_Gradnext%20logo%20-%20White.png" 
                alt="gradnext" 
                className="h-6 w-auto"
              />
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
        
        {/* User info - only show when expanded */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm text-slate-400 truncate">{user?.name}</p>
          </div>
        )}
        
        {/* Navigation */}
        <nav className={`${sidebarCollapsed ? 'px-2' : 'px-4'} py-4 space-y-1 overflow-y-auto`} style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {sidebarItems.map((item) => (
            item.isDropdown ? (
              <div key={item.id}>
                {/* Dropdown Header */}
                {sidebarCollapsed ? (
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false);
                      if (!expandedDropdowns.includes(item.id)) {
                        toggleDropdown(item.id);
                      }
                    }}
                    className={`w-full flex items-center justify-center p-3 rounded-lg text-sm font-medium transition-colors ${
                      isChildActive(item) ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    <div className="relative">
                      <item.icon className="w-5 h-5" />
                      {item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </div>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => toggleDropdown(item.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isChildActive(item) ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        {item.label}
                        {item.badge > 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedDropdowns.includes(item.id) ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Dropdown Children */}
                    {expandedDropdowns.includes(item.id) && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => setActiveSection(child.id)}
                            className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              activeSection === child.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <child.icon className="w-4 h-4" />
                              {child.label}
                            </div>
                            {child.badge > 0 && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                                {child.badge}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : item.isLink ? (
              <a
                key={item.id}
                href={item.href}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} rounded-lg text-sm font-medium transition-colors text-slate-300 hover:bg-slate-800 hover:text-white`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {sidebarCollapsed ? (
                  <item.icon className="w-5 h-5" />
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                  </>
                )}
              </a>
            ) : (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} rounded-lg text-sm font-medium transition-colors ${
                  activeSection === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {sidebarCollapsed ? (
                  <div className="relative">
                    <item.icon className="w-5 h-5" />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </div>
                    {item.badge > 0 && (
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          ))}
        </nav>
        
        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors`}
            title={sidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5" />
            {!sidebarCollapsed && "Logout"}
          </button>
        </div>
      </aside>

      <main className={`${sidebarCollapsed ? 'ml-20' : 'ml-64'} flex-1 transition-all duration-300 ${activeSection === 'mentor-calendar' ? 'p-4 h-screen overflow-hidden' : 'p-8'}`}>
        <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /><span className="ml-3 text-slate-500">Loading section…</span></div>}>
        {activeSection === 'overview' && (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Users" value={stats.users} icon={Users} color="bg-blue-500" />
                <StatCard label="Mentors" value={stats.mentors} icon={UserCog} color="bg-purple-500" />
                <StatCard label="Videos" value={stats.videos} icon={Video} color="bg-emerald-500" />
                <StatCard label="Workshops" value={stats.workshops} icon={Calendar} color="bg-amber-500" />
                <StatCard label="Materials" value={stats.materials} icon={BookOpen} color="bg-cyan-500" />
                <StatCard label="Bookings" value={stats.bookings} icon={Clock} color="bg-indigo-500" />
                <StatCard label="Peer Sessions" value={stats.peer_sessions} icon={Users2} color="bg-pink-500" />
              </div>
            )}
          </div>
        )}
        {activeSection === 'analytics' && <AnalysisSectionWithTabs />}
        {activeSection === 'contact-submissions' && <ContactSubmissionsTab />}
        {activeSection === 'support' && <SupportTab />}
        {activeSection === 'feedback' && <FeedbackTab />}
        {activeSection === 'coach-applications' && <CoachApplicationsTab />}
        {activeSection === 'pinnacle-applications' && <PinnacleApplicationsTab />}
        {activeSection === 'scholarship-applications' && <ScholarshipApplicationsTab />}
        {activeSection === 'users' && <UsersSection />}
        {activeSection === 'candidates' && <CandidatesSection />}
        {activeSection === 'mentors' && <MentorsSection />}
        {activeSection === 'mentor-notifications' && <MentorNotificationsAdmin />}
        {activeSection === 'candidate-notifications' && <CandidateNotificationsAdmin />}
        {activeSection === 'mentor-calendar' && <AdminCalendar />}
        {activeSection === 'mentor-analytics' && <MentorAnalytics />}
        {activeSection === 'candidate-analytics' && <CandidateAnalytics />}
        {activeSection === 'coaching-sessions' && <CoachingSessionsSection />}
        {activeSection === 'plans' && <PlansSection />}
        {activeSection === 'discounts' && <DiscountsSection />}
        {activeSection === 'competitions' && <CompetitionsSection />}
        {activeSection === 'automations' && <AutomationsSection />}
        {activeSection === 'lead-scoring' && <LeadScoringSection />}
        {activeSection === 'partners' && <PartnersSection />}
        {activeSection === 'discovery-calls' && <DiscoveryCallsSection />}
        {activeSection === 'logo-repository' && <LogoRepositorySection />}
        {activeSection === 'testimonials' && <TestimonialsSection />}
        {activeSection === 'courses' && <CoursesSection />}
        {activeSection === 'case-drills' && <CaseDrillsSection />}
        {activeSection === 'cancellation-policy' && <CancellationPolicySection />}
        {activeSection === 'workshops' && <WorkshopsSection />}
        {activeSection === 'materials' && <MaterialsSection />}
        {activeSection === 'blogs' && <BlogManagement />}
        {activeSection === 'peer-sessions' && <PeerSessionsSection />}
        {activeSection === 'peer-profiles' && <PeerProfilesManagementSection />}
        {activeSection === 'payouts' && <PayoutsSection />}
        {activeSection === 'cohort' && <CohortSection />}
        {activeSection === 'sales' && <SalesManagement />}
        </Suspense>
      </main>
    </div>
  );
};

export default AdminDashboard;
