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

// Aliases preserved from the legacy AdminComponents.jsx — when this
// section was extracted into its own file the aliases were not
// carried over, which caused a ReferenceError → white screen on the
// Mentor Details tab.
const AvailabilitySelector = WeeklyAvailabilitySelector;
const FileUpload = SimpleFileUpload;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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


export const MentorsSection = () => {
  const [mentors, setMentors] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [togglingVisibility, setTogglingVisibility] = useState(null);
  const [togglingStrategyVisibility, setTogglingStrategyVisibility] = useState(null);
  const [processingApproval, setProcessingApproval] = useState(null);
  const [deletingMentor, setDeletingMentor] = useState(null);
  const [restoringMentor, setRestoringMentor] = useState(null);
  const [logoRepository, setLogoRepository] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);
  const [selectedMentors, setSelectedMentors] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const [importDataResult, setImportDataResult] = useState(null);
  const [importingFeedback, setImportingFeedback] = useState(false);
  const [importFeedbackResult, setImportFeedbackResult] = useState(null);
  const [clearingHistorical, setClearingHistorical] = useState(false);
  const [clearHistoricalResult, setClearHistoricalResult] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const photoInputRef = useRef(null);
  const bulkUploadRef = useRef(null);
  const importDataRef = useRef(null);
  const importFeedbackRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    location: '',
    consulting_position: '',
    consulting_firm: '',
    college: '',
    current_company: '',
    consulting_is_current: false,
    previous_company_1: '',
    previous_company_2: '',
    years_experience: '',
    hourly_rate: 12000,
    price_per_session: 1500,
    headline: '',
    is_top_coach: false,
    is_landing_featured: false,
    can_take_strategy_calls: false,
    picture: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [mentorsRes, pendingRes, logosRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/mentors`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/mentors/pending-changes`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/logos`, { withCredentials: true }).catch(() => ({ data: { logos: [] } }))
      ]);
      setMentors(mentorsRes.data.mentors || []);
      setPendingApprovals(pendingRes.data.pending_approvals || []);
      setLogoRepository(logosRes.data.logos || []);
      setSelectedMentors([]); // Clear selection on refresh
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const handleSelectAllMentors = (checked) => {
    if (checked) {
      setSelectedMentors(activeMentors.map(m => m.id));
    } else {
      setSelectedMentors([]);
    }
  };

  const handleSelectMentor = (mentorId, checked) => {
    if (checked) {
      setSelectedMentors(prev => [...prev, mentorId]);
    } else {
      setSelectedMentors(prev => prev.filter(id => id !== mentorId));
    }
  };

  const handleDeleteSelectedMentors = async () => {
    if (selectedMentors.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedMentors.length} mentor(s)? This action cannot be undone.`)) return;
    
    setBulkDeleting(true);
    try {
      for (const mentorId of selectedMentors) {
        await axios.delete(`${BACKEND_URL}/api/admin/mentors/${mentorId}`, { withCredentials: true });
      }
      fetchData();
    } catch (error) {
      alert('Failed to delete some mentors');
      fetchData();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Drag-and-drop sensors for the active mentors list. PointerSensor with
  // a small activation distance prevents accidental drags when the admin
  // is just clicking the row (e.g. opening edit modal or toggling
  // checkboxes) while still feeling responsive once they actually drag.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Reorder the active mentors via drag-and-drop. We optimistically update
  // the UI by reordering the in-memory `mentors` state, then push the new
  // order to /api/admin/mentors/reorder. On failure we re-fetch to recover
  // the canonical order from the server.
  const handleMentorDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIdx = activeMentors.findIndex((m) => m.id === active.id);
    const toIdx = activeMentors.findIndex((m) => m.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const newActive = arrayMove(activeMentors, fromIdx, toIdx);

    // Optimistic update — preserve deleted mentors at the end
    setMentors((prev) => {
      const deleted = prev.filter((m) => m.is_deleted);
      // Map ids to mentor objects from prev (so we keep all fields)
      const byId = new Map(prev.map((m) => [m.id, m]));
      const reorderedActive = newActive.map((m) => byId.get(m.id) || m);
      return [...reorderedActive, ...deleted];
    });

    setReordering(true);
    try {
      const orders = newActive.map((m, idx) => ({ id: m.id, display_order: idx }));
      await axios.post(`${BACKEND_URL}/api/admin/mentors/reorder`, { orders }, { withCredentials: true });
    } catch (error) {
      console.error('Failed to reorder:', error);
      alert('Failed to reorder mentors');
      fetchData(); // recover canonical order
    } finally {
      setReordering(false);
    }
  };

  const filteredMentors = mentors.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate active and deleted mentors
  const activeMentors = filteredMentors.filter(m => !m.is_deleted);
  const deletedMentors = filteredMentors.filter(m => m.is_deleted);

  const handleApproveChanges = async (mentorId) => {
    setProcessingApproval(mentorId);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/mentors/${mentorId}/approve-changes`, {}, { withCredentials: true });
      fetchData();
      setShowApprovalModal(false);
    } catch (error) { 
      alert('Failed to approve changes: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleRejectChanges = async (mentorId, reason = '') => {
    setProcessingApproval(mentorId);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/mentors/${mentorId}/reject-changes`, { reason }, { withCredentials: true });
      fetchData();
      setShowApprovalModal(false);
    } catch (error) { 
      alert('Failed to reject changes: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setProcessingApproval(null);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      location: '',
      consulting_position: '',
      consulting_firm: '',
      college: '',
      current_company: '',
      consulting_is_current: false,
      previous_company_1: '',
      previous_company_2: '',
      years_experience: '',
      hourly_rate: 12000,
      price_per_session: 1500,
      headline: '',
      is_top_coach: false,
      is_landing_featured: false,
      picture: ''
    });
  };

  // Validate required fields and return errors
  const validateMentorForm = () => {
    const errors = {};
    
    // Required fields
    if (!formData.name?.trim()) errors.name = 'Full name is required';
    if (!formData.email?.trim()) errors.email = 'Email is required';
    if (!formData.phone?.trim()) errors.phone = 'Phone number is required';
    if (!formData.linkedin?.trim()) errors.linkedin = 'LinkedIn ID is required';
    if (!formData.location?.trim()) errors.location = 'Location is required';
    if (!formData.consulting_position?.trim()) errors.consulting_position = 'Position is required';
    if (!formData.consulting_firm?.trim()) errors.consulting_firm = 'Consulting firm is required';
    if (!formData.consulting_is_current && !formData.current_company?.trim()) {
      errors.current_company = 'Current company is required';
    }
    if (!formData.years_experience) errors.years_experience = 'Years of experience is required';
    if (!formData.hourly_rate) errors.hourly_rate = 'Hourly rate is required';
    if (!formData.price_per_session) errors.price_per_session = 'Session price is required';
    
    return errors;
  };

  const [formErrors, setFormErrors] = useState({});

  // Get logo URL from repository by company name
  const getCompanyLogo = (companyName) => {
    if (!companyName) return null;
    const logo = logoRepository.find(l => 
      l.name?.toLowerCase() === companyName.toLowerCase() ||
      l.name?.toLowerCase().includes(companyName.toLowerCase()) ||
      companyName.toLowerCase().includes(l.name?.toLowerCase())
    );
    return logo?.logo_url || null;
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('category', 'mentors');
    uploadFormData.append('persist_to_db', 'true');

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/upload`, uploadFormData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setFormData(prev => ({ ...prev, picture: res.data.url }));
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkUploading(true);
    setBulkUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/mentors/bulk-upload`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setBulkUploadResult(res.data);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setBulkUploadResult({
        created: 0,
        errors: [error.response?.data?.detail || error.message]
      });
    } finally {
      setBulkUploading(false);
      if (bulkUploadRef.current) bulkUploadRef.current.value = '';
    }
  };

  // Handle import ratings/sessions data
  const handleImportData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingData(true);
    setImportDataResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/mentors/import-excel`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setImportDataResult(res.data);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setImportDataResult({
        updated: 0,
        not_found: 0,
        errors: [error.response?.data?.detail || error.message]
      });
    } finally {
      setImportingData(false);
      if (importDataRef.current) importDataRef.current.value = '';
    }
  };

  // Handle import feedback/testimonials
  const handleImportFeedback = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingFeedback(true);
    setImportFeedbackResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/mentors/import-feedback`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setImportFeedbackResult(res.data);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setImportFeedbackResult({
        imported: 0,
        mentor_not_found: 0,
        errors: [error.response?.data?.detail || error.message]
      });
    } finally {
      setImportingFeedback(false);
      if (importFeedbackRef.current) importFeedbackRef.current.value = '';
    }
  };

  const handleClearHistoricalData = async () => {
    setClearingHistorical(true);
    setClearHistoricalResult(null);
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/admin/feedbacks/clear-all-historical`, {
        withCredentials: true,
      });
      setClearHistoricalResult(res.data);
      setShowClearConfirm(false);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setClearHistoricalResult({
        success: false,
        message: error.response?.data?.detail || error.message
      });
    } finally {
      setClearingHistorical(false);
    }
  };

  const [savingMentor, setSavingMentor] = useState(false);

  const handleInviteMentor = async () => {
    const errors = validateMentorForm();
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSavingMentor(true);
    try {
      // Add logo URLs from repository
      const mentorData = {
        ...formData,
        // Set current_company to consulting_firm if checkbox is checked
        current_company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company,
        consulting_firm_logo: getCompanyLogo(formData.consulting_firm),
        current_company_logo: formData.consulting_is_current 
          ? getCompanyLogo(formData.consulting_firm) 
          : getCompanyLogo(formData.current_company),
        // Set specialization from consulting firm for compatibility
        specialization: formData.consulting_firm,
        // Set title and company for compatibility with existing schema
        title: formData.consulting_position,
        company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company
      };

      await axios.post(`${BACKEND_URL}/api/admin/mentors/invite`, mentorData, { withCredentials: true });

      fetchData();
      setShowModal(false);
      resetFormData();
      setFormErrors({});
    } catch (error) { 
      alert('Failed to invite mentor: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setSavingMentor(false);
    }
  };

  const handleEditMentor = async () => {
    const errors = validateMentorForm();
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      console.log('Validation errors:', errors);
      return;
    }

    setSavingMentor(true);
    try {
      // Add logo URLs from repository
      const mentorData = {
        ...formData,
        current_company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company,
        consulting_firm_logo: getCompanyLogo(formData.consulting_firm),
        current_company_logo: formData.consulting_is_current 
          ? getCompanyLogo(formData.consulting_firm) 
          : getCompanyLogo(formData.current_company),
        specialization: formData.consulting_firm,
        title: formData.consulting_position,
        company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company
      };

      console.log('Updating mentor:', selectedMentor.id, mentorData);
      const response = await axios.put(`${BACKEND_URL}/api/admin/mentors/${selectedMentor.id}`, mentorData, { withCredentials: true });
      console.log('Update response:', response.data);
      fetchData();
      setShowEditModal(false);
      setSelectedMentor(null);
      setFormErrors({});
    } catch (error) { 
      console.error('Failed to update mentor:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert('Failed to update mentor: ' + errorMessage); 
    }
    finally {
      setSavingMentor(false);
    }
  };

  const handleToggleVisibility = async (mentorId) => {
    setTogglingVisibility(mentorId);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/mentors/${mentorId}/visibility`, {}, { withCredentials: true });
      fetchData();
    } catch (error) { 
      alert('Failed to toggle visibility'); 
    } finally {
      setTogglingVisibility(null);
    }
  };

  const handleToggleStrategyCallVisibility = async (mentorId) => {
    setTogglingStrategyVisibility(mentorId);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/mentors/${mentorId}/strategy-call-visibility`, {}, { withCredentials: true });
      fetchData();
    } catch (error) { 
      alert('Failed to toggle strategy call visibility'); 
    } finally {
      setTogglingStrategyVisibility(null);
    }
  };

  const handleDeleteMentor = async () => {
    if (!selectedMentor) return;
    setDeletingMentor(selectedMentor.id);
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/admin/mentors/${selectedMentor.id}`, { withCredentials: true });
      fetchData();
      setShowDeleteModal(false);
      setSelectedMentor(null);
      alert(`Mentor deleted. ${res.data.bookings_cancelled || 0} upcoming booking(s) cancelled.`);
    } catch (error) { 
      alert('Failed to delete mentor: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setDeletingMentor(null);
    }
  };

  const handleRestoreMentor = async (mentorId) => {
    setRestoringMentor(mentorId);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/mentors/${mentorId}/restore`, {}, { withCredentials: true });
      fetchData();
    } catch (error) { 
      alert('Failed to restore mentor: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setRestoringMentor(null);
    }
  };

  const handleSaveAvailability = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/mentors/${selectedMentor.id}/availability`, { 
        availability,
        blocked_days: blockedDays 
      }, { withCredentials: true });
      fetchData();
      setShowAvailModal(false);
    } catch (error) { alert('Failed to save availability'); }
  };

  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityInfo, setAvailabilityInfo] = useState(null);
  const [blockedDays, setBlockedDays] = useState([]);
  const [blockedDaysMonth, setBlockedDaysMonth] = useState(new Date());

  const openAvailabilityModal = async (mentor) => {
    setSelectedMentor(mentor);
    setShowAvailModal(true);
    setLoadingAvailability(true);
    setAvailability([]);
    setAvailabilityInfo(null);
    setBlockedDays([]);
    
    try {
      // Fetch current availability from backend
      const res = await axios.get(`${BACKEND_URL}/api/admin/mentors/${mentor.id}/availability`, {
        withCredentials: true
      });
      setAvailability(res.data.availability || []);
      setBlockedDays(res.data.blocked_days || []);
      setAvailabilityInfo({
        hasAdminOverride: res.data.has_admin_override,
        lastUpdated: res.data.last_updated,
        isEmpty: res.data.is_empty
      });
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      // Fall back to mentor object availability if API fails
      setAvailability(mentor.availability || []);
      setBlockedDays(mentor.blocked_days || []);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Toggle blocked day
  const toggleBlockedDay = (dateStr) => {
    setBlockedDays(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    );
  };

  // Generate calendar days for blocked days picker
  const getCalendarDays = () => {
    const year = blockedDaysMonth.getFullYear();
    const month = blockedDaysMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: i,
        dateStr,
        isBlocked: blockedDays.includes(dateStr),
        isPast: date < new Date(new Date().setHours(0, 0, 0, 0))
      });
    }
    
    return days;
  };

  const openEditModal = (mentor) => {
    setSelectedMentor(mentor);
    setFormData({
      name: mentor.name || '',
      email: mentor.email || '',
      phone: mentor.phone || '',
      linkedin: mentor.linkedin || '',
      location: mentor.location || '',
      consulting_position: mentor.consulting_position || mentor.title || '',
      consulting_firm: mentor.consulting_firm || mentor.specialization || '',
      college: mentor.college || '',
      current_company: mentor.current_company || mentor.company || '',
      consulting_is_current: mentor.consulting_is_current || false,
      previous_company_1: mentor.previous_company_1 || '',
      previous_company_2: mentor.previous_company_2 || '',
      years_experience: mentor.years_experience || '',
      hourly_rate: mentor.hourly_rate || 12000,
      price_per_session: mentor.price_per_session || 1500,
      headline: mentor.headline || '',
      is_top_coach: mentor.is_top_coach || false,
      is_landing_featured: mentor.is_landing_featured || false,
      can_take_strategy_calls: mentor.can_take_strategy_calls || false,
      picture: mentor.picture || ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (mentor) => {
    setSelectedMentor(mentor);
    setShowDeleteModal(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  // Render mentor row.
  // `sortable` (when provided) carries the dnd-kit refs/listeners so the
  // row can be dragged; the presence of `sortable` also triggers the
  // drag-handle in place of the legacy up/down arrows.
  const renderMentorRow = (mentor, isDeleted = false, index = -1, sortable = null) => (
    <div 
      key={mentor.id}
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
        isDeleted 
          ? 'bg-red-50/50 border-red-200 opacity-75' 
          : selectedMentors.includes(mentor.id)
            ? 'bg-blue-50 border-blue-200'
            : mentor.is_hidden 
              ? 'bg-amber-50/50 border-amber-200' 
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      } ${sortable?.isDragging ? 'shadow-lg ring-2 ring-blue-300 z-10' : ''}`}
      data-testid={`mentor-row-${mentor.id}`}
    >
      {/* Drag handle — only for active, sortable rows */}
      {!isDeleted && sortable && (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Drag to reorder ${mentor.name}`}
          title="Drag to reorder"
          className={`p-1.5 rounded hover:bg-slate-100 transition-colors touch-none select-none ${reordering ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
          data-testid={`drag-handle-${mentor.id}`}
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      )}
      
      {/* Checkbox - only for active mentors */}
      {!isDeleted && (
        <input 
          type="checkbox" 
          checked={selectedMentors.includes(mentor.id)}
          onChange={(e) => handleSelectMentor(mentor.id, e.target.checked)}
          className="w-4 h-4 rounded border-slate-300"
          data-testid={`select-mentor-${mentor.id}`}
        />
      )}
      
      {/* Avatar & Basic Info */}
      <div className="flex items-center gap-3 min-w-[250px]">
        <div className="relative">
          <img 
            src={mentor.picture || `https://ui-avatars.com/api/?name=${mentor.name}`} 
            alt="" 
            className={`w-12 h-12 rounded-full object-cover ${isDeleted || mentor.is_hidden ? 'opacity-50 grayscale' : ''}`} 
          />
          {isDeleted && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              Deleted
            </div>
          )}
          {!isDeleted && mentor.is_hidden && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              Hidden
            </div>
          )}
          {!isDeleted && !mentor.is_hidden && mentor.is_hidden_from_strategy_calls && mentor.can_take_strategy_calls && (
            <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full" title="Hidden from strategy calls">
              SC Hidden
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${isDeleted ? 'text-red-700 line-through' : 'text-slate-900'}`}>
            {mentor.name}
            {mentor.is_landing_featured && (
              <span
                className="ml-2 inline-flex items-center gap-0.5 align-middle px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700"
                title="Featured on landing page mentor carousel"
                data-testid={`mentor-row-featured-badge-${mentor.id}`}
              >
                Landing
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500 truncate">{mentor.email}</p>
          <p className="text-xs text-slate-400 font-mono truncate">{mentor.id}</p>
        </div>
      </div>

      {/* Title & Company */}
      <div className="hidden lg:block min-w-[180px]">
        <p className="text-sm font-medium text-slate-700 truncate">{mentor.title || '-'}</p>
        <p className="text-xs text-slate-500 truncate">{mentor.company || '-'}</p>
      </div>

      {/* Specialization */}
      <div className="hidden md:block min-w-[100px]">
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
          {mentor.specialization || 'General'}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-center gap-4 min-w-[120px]">
        <div className="text-center">
          <p className="text-sm font-bold text-blue-700">₹{(mentor.price_per_session || 1500).toLocaleString()}</p>
          <p className="text-xs text-slate-500">Per Session</p>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-2 min-w-[100px] flex-wrap">
        {mentor.can_take_strategy_calls && !isDeleted && (
          <span className="px-2 py-1 text-xs rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}>
            Strategy
          </span>
        )}
        {mentor.pending_changes && !isDeleted && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full whitespace-nowrap">
            Pending
          </span>
        )}
        {isDeleted && mentor.deleted_at && (
          <span className="text-xs text-red-500">
            {new Date(mentor.deleted_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto">
        {isDeleted ? (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleRestoreMentor(mentor.id)}
            disabled={restoringMentor === mentor.id}
            className="text-green-600 border-green-200 hover:bg-green-50"
            data-testid={`restore-mentor-${mentor.id}`}
          >
            {restoringMentor === mentor.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Restore
              </>
            )}
          </Button>
        ) : (
          <>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openEditModal(mentor)} 
              data-testid={`edit-mentor-btn-${mentor.id}`}
              title="Edit mentor"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openAvailabilityModal(mentor)} 
              data-testid={`edit-mentor-avail-${mentor.id}`}
              title="Edit availability"
            >
              <Clock className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleToggleVisibility(mentor.id)}
              disabled={togglingVisibility === mentor.id}
              className={mentor.is_hidden ? 'text-amber-600 hover:text-amber-700' : 'text-slate-500 hover:text-slate-700'}
              data-testid={`toggle-mentor-visibility-${mentor.id}`}
              title={mentor.is_hidden ? 'Show on candidate dashboard' : 'Hide from candidate dashboard'}
            >
              {togglingVisibility === mentor.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mentor.is_hidden ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleToggleStrategyCallVisibility(mentor.id)}
              disabled={togglingStrategyVisibility === mentor.id || !mentor.can_take_strategy_calls}
              className={mentor.is_hidden_from_strategy_calls ? 'text-purple-600 hover:text-purple-700' : 'text-slate-500 hover:text-slate-700'}
              data-testid={`toggle-strategy-visibility-${mentor.id}`}
              title={
                !mentor.can_take_strategy_calls 
                  ? 'Mentor not enabled for strategy calls' 
                  : mentor.is_hidden_from_strategy_calls 
                    ? 'Show in strategy call selection' 
                    : 'Hide from strategy call selection'
              }
            >
              {togglingStrategyVisibility === mentor.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mentor.is_hidden_from_strategy_calls ? (
                <Calendar className="w-4 h-4 line-through" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openDeleteModal(mentor)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              data-testid={`delete-mentor-btn-${mentor.id}`}
              title="Delete mentor"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="mentors-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Mentor Management</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.open(`${BACKEND_URL}/api/admin/mentors/template`, '_blank')}
            className="text-slate-600"
            data-testid="download-template-btn"
          >
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>
          <Button 
            variant="outline"
            onClick={() => bulkUploadRef.current?.click()}
            disabled={bulkUploading}
            className="text-green-600 border-green-200 hover:bg-green-50"
            data-testid="bulk-upload-btn"
          >
            {bulkUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Bulk Upload
          </Button>
          <input 
            type="file" 
            ref={bulkUploadRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <Button 
            variant="outline"
            onClick={() => importDataRef.current?.click()}
            disabled={importingData}
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
            data-testid="import-data-btn"
          >
            {importingData ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Update Ratings/Sessions
          </Button>
          <input 
            type="file" 
            ref={importDataRef} 
            onChange={handleImportData} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <Button 
            variant="outline"
            onClick={() => importFeedbackRef.current?.click()}
            disabled={importingFeedback}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
            data-testid="import-feedback-btn"
          >
            {importingFeedback ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4 mr-2" />
            )}
            Import Feedback
          </Button>
          <input 
            type="file" 
            ref={importFeedbackRef} 
            onChange={handleImportFeedback} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="invite-mentor-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Mentor
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowClearConfirm(true)}
            className="text-red-600 border-red-200 hover:bg-red-50"
            data-testid="clear-historical-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Historical Ratings
          </Button>
        </div>
      </div>

      {/* Clear Historical Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Clear All Historical Ratings?</h3>
            <p className="text-slate-600 mb-4">
              This will permanently delete:
            </p>
            <ul className="text-sm text-slate-600 mb-4 space-y-1">
              <li>• All imported feedback (from Excel uploads)</li>
              <li>• All imported ratings from mentor profiles</li>
              <li>• All imported session counts from mentor profiles</li>
            </ul>
            <p className="text-sm text-amber-600 mb-4">
              This action cannot be undone. Platform ratings from actual sessions will NOT be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingHistorical}
              >
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={handleClearHistoricalData}
                disabled={clearingHistorical}
              >
                {clearingHistorical ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  'Yes, Clear All'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Historical Result */}
      {clearHistoricalResult && (
        <div className={`p-4 rounded-lg border ${clearHistoricalResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${clearHistoricalResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {clearHistoricalResult.success ? 'Historical Data Cleared' : 'Error'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {clearHistoricalResult.message}
              </p>
              {clearHistoricalResult.details && (
                <div className="text-xs text-slate-500 mt-2">
                  <p>• {clearHistoricalResult.details.historical_feedbacks_deleted} feedbacks deleted</p>
                  <p>• {clearHistoricalResult.details.mentor_ratings_cleared} mentor ratings cleared</p>
                  <p>• {clearHistoricalResult.details.mentor_sessions_cleared} mentor session counts cleared</p>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setClearHistoricalResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Import Feedback Result */}
      {importFeedbackResult && (
        <div className={`p-4 rounded-lg border ${importFeedbackResult.errors?.length > 0 || importFeedbackResult.mentor_not_found > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${importFeedbackResult.errors?.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                Feedback Import Complete
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Imported <strong>{importFeedbackResult.imported}</strong> feedback(s)
                {importFeedbackResult.mentor_not_found > 0 && (
                  <span className="text-amber-600"> • {importFeedbackResult.mentor_not_found} mentor(s) not found</span>
                )}
                {importFeedbackResult.errors?.length > 0 && (
                  <span className="text-red-600"> • {importFeedbackResult.errors.length} error(s)</span>
                )}
              </p>
              {importFeedbackResult.not_found_emails?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 font-medium">Mentor emails not found:</p>
                  <ul className="text-xs text-amber-600 space-y-1 mt-1">
                    {importFeedbackResult.not_found_emails.slice(0, 5).map((email, i) => (
                      <li key={i}>• {email}</li>
                    ))}
                    {importFeedbackResult.not_found_emails.length > 5 && (
                      <li>...and {importFeedbackResult.not_found_emails.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {importFeedbackResult.imported_feedbacks?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-green-700 cursor-pointer font-medium">
                    View imported feedbacks ({importFeedbackResult.imported_feedbacks.length})
                  </summary>
                  <ul className="text-xs text-green-600 space-y-1 mt-1 max-h-32 overflow-y-auto">
                    {importFeedbackResult.imported_feedbacks.map((fb, i) => (
                      <li key={i}>• {fb.mentor}: {fb.candidate} (★{fb.rating})</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportFeedbackResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Import Data Result */}
      {importDataResult && (
        <div className={`p-4 rounded-lg border ${importDataResult.errors?.length > 0 || importDataResult.not_found > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${importDataResult.errors?.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                Data Import Complete
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Updated <strong>{importDataResult.updated}</strong> mentor(s)
                {importDataResult.not_found > 0 && (
                  <span className="text-amber-600"> • {importDataResult.not_found} not found</span>
                )}
                {importDataResult.errors?.length > 0 && (
                  <span className="text-red-600"> • {importDataResult.errors.length} error(s)</span>
                )}
              </p>
              {importDataResult.not_found_emails?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 font-medium">Emails not found:</p>
                  <ul className="text-xs text-amber-600 space-y-1 mt-1">
                    {importDataResult.not_found_emails.slice(0, 5).map((email, i) => (
                      <li key={i}>• {email}</li>
                    ))}
                    {importDataResult.not_found_emails.length > 5 && (
                      <li>...and {importDataResult.not_found_emails.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {importDataResult.errors?.length > 0 && (
                <ul className="mt-2 text-xs text-red-700 space-y-1">
                  {importDataResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {importDataResult.errors.length > 5 && (
                    <li>...and {importDataResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              )}
              {importDataResult.updated_mentors?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-green-700 cursor-pointer font-medium">
                    View updated mentors ({importDataResult.updated_mentors.length})
                  </summary>
                  <ul className="text-xs text-green-600 space-y-1 mt-1 max-h-32 overflow-y-auto">
                    {importDataResult.updated_mentors.map((m, i) => (
                      <li key={i}>• {m.name || m.email}: {m.fields_updated?.filter(f => f !== 'updated_at').join(', ')}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportDataResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Upload Result */}
      {bulkUploadResult && (
        <div className={`p-4 rounded-lg border ${bulkUploadResult.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${bulkUploadResult.errors?.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                Bulk Upload Complete
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Successfully created <strong>{bulkUploadResult.created}</strong> mentor(s)
                {bulkUploadResult.errors?.length > 0 && (
                  <span className="text-amber-600"> • {bulkUploadResult.errors.length} error(s)</span>
                )}
              </p>
              {bulkUploadResult.errors?.length > 0 && (
                <ul className="mt-2 text-xs text-amber-700 space-y-1">
                  {bulkUploadResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {bulkUploadResult.errors.length > 5 && (
                    <li>...and {bulkUploadResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBulkUploadResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Pending Approvals Alert */}
      {pendingApprovals.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-orange-800">Profile Changes Pending Approval</h3>
                <p className="text-sm text-orange-600">{pendingApprovals.length} mentor(s) have submitted profile changes</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => setShowApprovalModal(true)}
            >
              Review Changes
            </Button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Search mentors by name, email, or specialization..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="mentor-search-input"
        />
      </div>

      {/* Active Mentors - Row Layout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={activeMentors.length > 0 && selectedMentors.length === activeMentors.length}
              onChange={(e) => handleSelectAllMentors(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
              data-testid="select-all-mentors"
            />
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Active Mentors ({activeMentors.length})</h3>
          </div>
          {selectedMentors.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDeleteSelectedMentors}
              disabled={bulkDeleting}
              data-testid="delete-selected-mentors-btn"
            >
              {bulkDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedMentors.length})</>
              )}
            </Button>
          )}
        </div>
        {activeMentors.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg">No active mentors found</div>
        ) : (
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMentorDragEnd}
          >
            <SortableContext
              items={activeMentors.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2" data-testid="active-mentors-list">
                {activeMentors.map((mentor, index) => (
                  <SortableMentorRow
                    key={mentor.id}
                    mentor={mentor}
                    index={index}
                    renderRow={renderMentorRow}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Deleted Mentors Section */}
      {deletedMentors.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-medium text-red-500 uppercase tracking-wide">Deleted Mentors ({deletedMentors.length})</h3>
          <div className="space-y-2">
            {deletedMentors.map((mentor) => renderMentorRow(mentor, true))}
          </div>
        </div>
      )}

      {/* Invite Mentor Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) { resetFormData(); setFormErrors({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Add New Mentor
            </DialogTitle>
            <DialogDescription>Fill in all required fields to onboard a new mentor</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {formData.picture ? (
                  <img src={formData.picture.startsWith('/api') ? `${BACKEND_URL}${formData.picture}` : formData.picture} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              <div>
                <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <p className="text-xs text-slate-500 mt-1">Recommended: Square image, min 200x200px</p>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="John Doe" className={formErrors.name ? 'border-red-500' : ''} />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" className={formErrors.email ? 'border-red-500' : ''} />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+91 98765 43210" className={formErrors.phone ? 'border-red-500' : ''} />
                  {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">LinkedIn ID <span className="text-red-500">*</span></label>
                  <Input value={formData.linkedin} onChange={(e) => setFormData({...formData, linkedin: e.target.value})} placeholder="linkedin.com/in/johndoe" className={formErrors.linkedin ? 'border-red-500' : ''} />
                  {formErrors.linkedin && <p className="text-xs text-red-500 mt-1">{formErrors.linkedin}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location <span className="text-red-500">*</span></label>
                <Input 
                  value={formData.location} 
                  onChange={(e) => setFormData({...formData, location: e.target.value})} 
                  placeholder="e.g., Mumbai, India" 
                  className={formErrors.location ? 'border-red-500' : ''} 
                />
                {formErrors.location && <p className="text-xs text-red-500 mt-1">{formErrors.location}</p>}
              </div>
            </div>

            {/* Consulting Experience */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Consulting Experience</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Last Position at Consulting Firm <span className="text-red-500">*</span></label>
                  <Input value={formData.consulting_position} onChange={(e) => setFormData({...formData, consulting_position: e.target.value})} placeholder="e.g., Senior Consultant" className={formErrors.consulting_position ? 'border-red-500' : ''} />
                  {formErrors.consulting_position && <p className="text-xs text-red-500 mt-1">{formErrors.consulting_position}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Consulting Firm <span className="text-red-500">*</span></label>
                  <select
                    value={formData.consulting_firm}
                    onChange={(e) => setFormData({...formData, consulting_firm: e.target.value})}
                    className={`w-full h-10 px-3 rounded-md border ${formErrors.consulting_firm ? 'border-red-500' : 'border-slate-300'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select consulting firm...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {formErrors.consulting_firm && <p className="text-xs text-red-500 mt-1">{formErrors.consulting_firm}</p>}
                  {getCompanyLogo(formData.consulting_firm) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.consulting_firm).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.consulting_firm)}` : getCompanyLogo(formData.consulting_firm)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">College/University</label>
                <select
                  value={formData.college}
                  onChange={(e) => setFormData({...formData, college: e.target.value})}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select college...</option>
                  {logoRepository.map((logo) => (
                    <option key={logo.id} value={logo.name}>{logo.name}</option>
                  ))}
                </select>
                {getCompanyLogo(formData.college) && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={getCompanyLogo(formData.college).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.college)}` : getCompanyLogo(formData.college)} alt="" className="w-6 h-6 object-contain" />
                    <span className="text-xs text-green-600">Logo auto-selected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Current & Previous Companies */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Current & Previous Companies</h3>
              
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  id="consulting-is-current" 
                  checked={formData.consulting_is_current}
                  onChange={(e) => setFormData({...formData, consulting_is_current: e.target.checked, current_company: e.target.checked ? formData.consulting_firm : ''})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="consulting-is-current" className="text-sm text-slate-600">Consulting firm is my current company</label>
              </div>

              {!formData.consulting_is_current && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Current Company <span className="text-red-500">*</span></label>
                  <select
                    value={formData.current_company}
                    onChange={(e) => setFormData({...formData, current_company: e.target.value})}
                    className={`w-full h-10 px-3 rounded-md border ${formErrors.current_company ? 'border-red-500' : 'border-slate-300'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select current company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {formErrors.current_company && <p className="text-xs text-red-500 mt-1">{formErrors.current_company}</p>}
                  {getCompanyLogo(formData.current_company) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.current_company).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.current_company)}` : getCompanyLogo(formData.current_company)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 1 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_1}
                    onChange={(e) => setFormData({...formData, previous_company_1: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select previous company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_1) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_1).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_1)}` : getCompanyLogo(formData.previous_company_1)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 2 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_2}
                    onChange={(e) => setFormData({...formData, previous_company_2: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select previous company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_2) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_2).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_2)}` : getCompanyLogo(formData.previous_company_2)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Total Years of Experience <span className="text-red-500">*</span></label>
                <Input type="number" value={formData.years_experience} onChange={(e) => setFormData({...formData, years_experience: e.target.value})} placeholder="e.g., 8" className={formErrors.years_experience ? 'border-red-500' : ''} />
                {formErrors.years_experience && <p className="text-xs text-red-500 mt-1">{formErrors.years_experience}</p>}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Hourly Rate (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.hourly_rate} onChange={(e) => setFormData({...formData, hourly_rate: parseInt(e.target.value) || 0})} placeholder="e.g., 12000" className={formErrors.hourly_rate ? 'border-red-500' : ''} />
                  {formErrors.hourly_rate && <p className="text-xs text-red-500 mt-1">{formErrors.hourly_rate}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Single Session Price (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.price_per_session} onChange={(e) => setFormData({...formData, price_per_session: parseInt(e.target.value) || 0})} placeholder="e.g., 1500" className={formErrors.price_per_session ? 'border-red-500' : ''} />
                  {formErrors.price_per_session && <p className="text-xs text-red-500 mt-1">{formErrors.price_per_session}</p>}
                </div>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Additional Information (Optional)</h3>
              <div>
                <label className="text-sm font-medium text-slate-700">Headline <span className="text-xs text-slate-400">(max 60 characters)</span></label>
                <Input 
                  value={formData.headline} 
                  onChange={(e) => setFormData({...formData, headline: e.target.value.slice(0, 60)})} 
                  placeholder="e.g., Ex-McKinsey | 100+ Cases Coached" 
                  maxLength={60}
                />
                <p className="text-xs text-slate-400 mt-1">{formData.headline?.length || 0}/60 characters</p>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="is-top-coach" 
                  checked={formData.is_top_coach}
                  onChange={(e) => setFormData({...formData, is_top_coach: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="is-top-coach" className="text-sm text-slate-600">Mark as Top Coach (featured badge)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-landing-featured"
                  checked={formData.is_landing_featured || false}
                  onChange={(e) => setFormData({ ...formData, is_landing_featured: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                  data-testid="add-mentor-landing-featured"
                />
                <label htmlFor="is-landing-featured" className="text-sm text-slate-600">
                  Show on Landing Page mentor carousel
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Public</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowModal(false); resetFormData(); setFormErrors({}); }}>Cancel</Button>
            <Button onClick={handleInviteMentor} disabled={savingMentor} className="bg-blue-600 hover:bg-blue-700" data-testid="send-invite-btn">
              {savingMentor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {savingMentor ? 'Adding...' : 'Add Mentor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Mentor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedMentor?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 space-y-2">
            <p className="font-semibold">This action will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Remove the mentor from candidate dashboard (Coaching page)</li>
              <li>Revoke mentor access - they will not be able to access the mentor dashboard</li>
              <li>Cancel all upcoming coaching sessions with this mentor</li>
              <li>Keep the mentor record for admin reference (shown as deleted)</li>
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteMentor}
              disabled={deletingMentor === selectedMentor?.id}
              data-testid="confirm-delete-mentor-btn"
            >
              {deletingMentor === selectedMentor?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Mentor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Mentor Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Edit Mentor - {selectedMentor?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {formData.picture ? (
                  <img src={formData.picture.startsWith('/api') ? `${BACKEND_URL}${formData.picture}` : formData.picture} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              <div>
                <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  <Upload className="w-4 h-4 mr-2" />
                  Change Photo
                </Button>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Basic Information</h3>
              {Object.keys(formErrors).length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Please fix the following errors:</p>
                  <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                    {Object.values(formErrors).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    data-testid="edit-mentor-name"
                    className={formErrors.name ? 'border-red-500' : ''}
                  />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                  <Input 
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    data-testid="edit-mentor-email"
                    className={formErrors.email ? 'border-red-500' : ''}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.phone} 
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={formErrors.phone ? 'border-red-500' : ''}
                  />
                  {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">LinkedIn ID <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.linkedin} 
                    onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                    className={formErrors.linkedin ? 'border-red-500' : ''}
                  />
                  {formErrors.linkedin && <p className="text-xs text-red-500 mt-1">{formErrors.linkedin}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location <span className="text-red-500">*</span></label>
                <Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
            </div>

            {/* Consulting Experience */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Consulting Experience</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Last Position at Consulting Firm <span className="text-red-500">*</span></label>
                  <Input value={formData.consulting_position} onChange={(e) => setFormData({...formData, consulting_position: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Consulting Firm <span className="text-red-500">*</span></label>
                  <select
                    value={formData.consulting_firm}
                    onChange={(e) => setFormData({...formData, consulting_firm: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select consulting firm...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.consulting_firm) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.consulting_firm).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.consulting_firm)}` : getCompanyLogo(formData.consulting_firm)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">College/University</label>
                <select
                  value={formData.college}
                  onChange={(e) => setFormData({...formData, college: e.target.value})}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select college...</option>
                  {logoRepository.map((logo) => (
                    <option key={logo.id} value={logo.name}>{logo.name}</option>
                  ))}
                </select>
                {getCompanyLogo(formData.college) && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={getCompanyLogo(formData.college).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.college)}` : getCompanyLogo(formData.college)} alt="" className="w-6 h-6 object-contain" />
                    <span className="text-xs text-green-600">Logo auto-selected</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Total Years of Experience <span className="text-red-500">*</span></label>
                <Input type="number" value={formData.years_experience} onChange={(e) => setFormData({...formData, years_experience: e.target.value})} />
              </div>
            </div>

            {/* Current & Previous Companies */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Current & Previous Companies</h3>
              
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  id="edit-consulting-is-current" 
                  checked={formData.consulting_is_current}
                  onChange={(e) => setFormData({...formData, consulting_is_current: e.target.checked, current_company: e.target.checked ? formData.consulting_firm : formData.current_company})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="edit-consulting-is-current" className="text-sm text-slate-600">Consulting firm is my current company</label>
              </div>

              {!formData.consulting_is_current && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Current Company <span className="text-red-500">*</span></label>
                  <select
                    value={formData.current_company}
                    onChange={(e) => setFormData({...formData, current_company: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.current_company) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.current_company).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.current_company)}` : getCompanyLogo(formData.current_company)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 1 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_1}
                    onChange={(e) => setFormData({...formData, previous_company_1: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_1) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_1).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_1)}` : getCompanyLogo(formData.previous_company_1)} alt="" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 2 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_2}
                    onChange={(e) => setFormData({...formData, previous_company_2: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_2) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_2).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_2)}` : getCompanyLogo(formData.previous_company_2)} alt="" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Hourly Rate (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.hourly_rate} onChange={(e) => setFormData({...formData, hourly_rate: parseInt(e.target.value) || 0})} data-testid="edit-mentor-rate" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Single Session Price (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.price_per_session} onChange={(e) => setFormData({...formData, price_per_session: parseInt(e.target.value) || 0})} data-testid="edit-mentor-session-price" />
                </div>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Additional Information (Optional)</h3>
              <div>
                <label className="text-sm font-medium text-slate-700">Headline <span className="text-xs text-slate-400">(max 60 characters)</span></label>
                <Input 
                  value={formData.headline} 
                  onChange={(e) => setFormData({...formData, headline: e.target.value.slice(0, 60)})} 
                  placeholder="e.g., Ex-McKinsey | 100+ Cases Coached" 
                  maxLength={60}
                />
                <p className="text-xs text-slate-400 mt-1">{formData.headline?.length || 0}/60 characters</p>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="edit-is-top-coach" 
                  checked={formData.is_top_coach}
                  onChange={(e) => setFormData({...formData, is_top_coach: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="edit-is-top-coach" className="text-sm text-slate-600">Mark as Top Coach (featured badge)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-landing-featured"
                  checked={formData.is_landing_featured || false}
                  onChange={(e) => setFormData({ ...formData, is_landing_featured: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                  data-testid="edit-mentor-landing-featured"
                />
                <label htmlFor="edit-is-landing-featured" className="text-sm text-slate-600">
                  Show on Landing Page mentor carousel
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Public</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="edit-can-take-strategy-calls" 
                  checked={formData.can_take_strategy_calls}
                  onChange={(e) => setFormData({...formData, can_take_strategy_calls: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                  style={{ accentColor: 'var(--gn-periwinkle)' }}
                />
                <label htmlFor="edit-can-take-strategy-calls" className="text-sm text-slate-600">
                  Available for Strategy Calls
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">30-min 1:1 calls</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={savingMentor}>Cancel</Button>
            <Button onClick={handleEditMentor} disabled={savingMentor} className="bg-blue-600 hover:bg-blue-700" data-testid="save-mentor-edit-btn">
              {savingMentor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {savingMentor ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability Modal */}
      <Dialog open={showAvailModal} onOpenChange={setShowAvailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Availability - {selectedMentor?.name}
            </DialogTitle>
            <DialogDescription>
              View and override the mentor&apos;s weekly availability schedule
            </DialogDescription>
          </DialogHeader>
          
          {loadingAvailability ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-500">Loading availability...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Info */}
              <div className={`p-3 rounded-lg border ${
                availabilityInfo?.isEmpty 
                  ? 'bg-amber-50 border-amber-200' 
                  : availabilityInfo?.hasAdminOverride 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {availabilityInfo?.isEmpty ? (
                      <>
                        <EyeOff className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">No availability set by mentor</span>
                      </>
                    ) : availabilityInfo?.hasAdminOverride ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">Admin Override Active</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Set by Mentor</span>
                      </>
                    )}
                  </div>
                  {availabilityInfo?.lastUpdated && (
                    <span className="text-xs text-slate-500">
                      Updated: {new Date(availabilityInfo.lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Current Availability Summary */}
              {availability.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Current Schedule</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const dayData = availability.find(a => a.day === day);
                      const slots = dayData?.slots || [];
                      return (
                        <div key={day} className={`p-2 rounded border ${slots.length > 0 ? 'bg-white border-green-200' : 'bg-slate-100 border-slate-200'}`}>
                          <p className="text-xs font-medium text-slate-600">{day}</p>
                          {slots.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {slots.map((slot, idx) => (
                                <p key={idx} className="text-xs text-green-700">{slot.from} - {slot.to}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 mt-1">Not available</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Edit Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Edit2 className="w-4 h-4" />
                  Override Availability
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Changes here will override the mentor&apos;s self-set availability. The mentor will not be able to change it until you remove the override.
                </p>
                <AvailabilitySelector availability={availability} onChange={setAvailability} />
              </div>

              {/* Blocked Days Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Ban className="w-4 h-4" />
                  Block Specific Days
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Click on dates to block/unblock them. Blocked days will not show any availability.
                </p>
                
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setBlockedDaysMonth(new Date(blockedDaysMonth.getFullYear(), blockedDaysMonth.getMonth() - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {blockedDaysMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setBlockedDaysMonth(new Date(blockedDaysMonth.getFullYear(), blockedDaysMonth.getMonth() + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Calendar Grid */}
                <div className="bg-slate-50 rounded-lg p-3">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays().map((day, idx) => (
                      <div key={idx} className="aspect-square">
                        {day ? (
                          <button
                            onClick={() => !day.isPast && toggleBlockedDay(day.dateStr)}
                            disabled={day.isPast}
                            className={`w-full h-full rounded text-xs font-medium transition-colors ${
                              day.isPast 
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : day.isBlocked
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {day.date}
                          </button>
                        ) : (
                          <div className="w-full h-full"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Blocked Days Summary */}
                {blockedDays.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs font-medium text-red-700 mb-1">
                      {blockedDays.length} day(s) blocked
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {blockedDays.sort().slice(0, 10).map(dateStr => (
                        <span 
                          key={dateStr}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                        >
                          {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          <button 
                            onClick={() => toggleBlockedDay(dateStr)}
                            className="hover:text-red-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {blockedDays.length > 10 && (
                        <span className="text-xs text-red-600">+{blockedDays.length - 10} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAvailModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveAvailability} 
              disabled={loadingAvailability}
              data-testid="save-mentor-avail-btn"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Approvals Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pending Profile Changes</DialogTitle>
            <DialogDescription>Review and approve or reject mentor profile changes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No pending changes to review</p>
            ) : (
              pendingApprovals.map((mentor) => (
                <div key={mentor.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={mentor.picture || `https://ui-avatars.com/api/?name=${mentor.name}`} 
                      alt="" 
                      className="w-12 h-12 rounded-full" 
                    />
                    <div>
                      <h4 className="font-semibold text-slate-900">{mentor.name}</h4>
                      <p className="text-sm text-slate-500">{mentor.email}</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">Requested Changes:</h5>
                    <div className="space-y-1 text-sm">
                      {Object.entries(mentor.pending_changes || {}).map(([key, value]) => {
                        if (key === 'submitted_at') return null;
                        const currentValue = mentor[key];
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <span className="font-medium text-slate-600 capitalize w-24">{key.replace('_', ' ')}:</span>
                            <div className="flex-1">
                              {currentValue && (
                                <span className="text-red-500 line-through mr-2">
                                  {Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue)}
                                </span>
                              )}
                              <span className="text-green-600">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {mentor.pending_changes?.submitted_at && (
                      <p className="text-xs text-slate-400 mt-2">
                        Submitted: {new Date(mentor.pending_changes.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRejectChanges(mentor.id)}
                      disabled={processingApproval === mentor.id}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {processingApproval === mentor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                      Reject
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleApproveChanges(mentor.id)}
                      disabled={processingApproval === mentor.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processingApproval === mentor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                      Approve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default MentorsSection;
