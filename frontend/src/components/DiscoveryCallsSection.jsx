import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Phone, Calendar, Clock, Settings, Users, Plus, Edit2, Trash2, 
  Save, X, CheckCircle2, XCircle, Loader2, ChevronUp, ChevronDown,
  GripVertical, AlertCircle, Mail, MessageSquare, List, Link2, Unlink,
  Search, Filter, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

// Drag and drop imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Sortable Question Item Component
const SortableQuestionItem = ({ question, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id || question._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? '#f8fafc' : 'transparent',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-4 p-4 hover:bg-slate-50 border-b last:border-b-0"
    >
      <div 
        {...attributes} 
        {...listeners}
        className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-900">
          {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </p>
        <p className="text-sm text-slate-500 capitalize">
          {question.type.replace('_', ' ')}
          {question.options?.length > 0 && ` • ${question.options.length} options`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(question)}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(question.id || question._id)}
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};


const DiscoveryCallsSection = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('coaching'); // 'coaching', 'cohort', 'settings', 'questions'
  const [loading, setLoading] = useState(true);
  
  // Calendar connection state
  const [calendarStatus, setCalendarStatus] = useState({ connected: false, email: null });
  const [calendarLoading, setCalendarLoading] = useState(false);
  
  // Bookings state
  const [bookings, setBookings] = useState([]);
  const [bookingCounts, setBookingCounts] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingBooking, setViewingBooking] = useState(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    admin_email: 'bookings@gradnext.co',
    call_duration_minutes: 15,
    buffer_minutes: 15,
    max_advance_days: 30,
    timezone: 'Asia/Kolkata',
    availability: {
      monday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
      tuesday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
      wednesday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
      thursday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
      friday: { enabled: true, slots: [{ start: '09:00', end: '18:00' }] },
      saturday: { enabled: false, slots: [] },
      sunday: { enabled: false, slots: [] },
    }
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  
  // Questions state
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    question: '',
    type: 'short_text',
    required: true,
    options: [],
    placeholder: ''
  });
  
  // Booking detail modal
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Check for calendar connection callback
    const calendarConnected = searchParams.get('calendar_connected');
    if (calendarConnected === 'true') {
      setActiveTab('settings');
      fetchCalendarStatus();
    }
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBookings(),
        fetchSettings(),
        fetchQuestions(),
        fetchCalendarStatus()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarStatus = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/discovery-calls/calendar/status`, {
        withCredentials: true
      });
      setCalendarStatus(res.data);
    } catch (err) {
      console.error('Error fetching calendar status:', err);
      setCalendarStatus({ connected: false, email: null });
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/discovery-calls/calendar/connect`, {
        withCredentials: true
      });
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url;
      }
    } catch (err) {
      console.error('Error connecting calendar:', err);
      alert('Failed to initiate calendar connection');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Calendar?')) return;
    
    setCalendarLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/discovery-calls/calendar/disconnect`, {
        withCredentials: true
      });
      setCalendarStatus({ connected: false, email: null });
    } catch (err) {
      console.error('Error disconnecting calendar:', err);
      alert('Failed to disconnect calendar');
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/discovery-calls/bookings`, {
        withCredentials: true
      });
      setBookings(res.data.bookings || []);
      setBookingCounts(res.data.counts || {});
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/discovery-calls/settings`, {
        withCredentials: true
      });
      setSettings(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/discovery-calls/questions`, {
        withCredentials: true
      });
      setQuestions(res.data || []);
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/discovery-calls/settings`, settings, {
        withCredentials: true
      });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Admin "Accept" flow now opens a calendar+slot picker. The actual API call
  // happens in `confirmAcceptBooking` once the admin chooses a slot.
  const [acceptDialogBooking, setAcceptDialogBooking] = useState(null);
  const [acceptDate, setAcceptDate] = useState(null);
  const [acceptTime, setAcceptTime] = useState(null);
  const [acceptSlots, setAcceptSlots] = useState([]); // [{time, booked, booked_with}]
  const [acceptSlotsLoading, setAcceptSlotsLoading] = useState(false);
  const [acceptMonth, setAcceptMonth] = useState(new Date());
  const [acceptMonthCounts, setAcceptMonthCounts] = useState({}); // { 'YYYY-MM-DD': count }
  const [acceptError, setAcceptError] = useState('');
  const [accepting, setAccepting] = useState(false);

  const handleAcceptBooking = (booking) => {
    // Pre-populate with whatever the booking already has (if anything) so
    // re-accepting (e.g. after a typo) doesn't reset the admin's choice.
    setAcceptDialogBooking(booking);
    setAcceptError('');
    setAccepting(false);
    if (booking?.scheduled_date && booking?.scheduled_time) {
      const [yy, mm, dd] = booking.scheduled_date.split('-').map((n) => parseInt(n, 10));
      const dt = new Date(yy, (mm || 1) - 1, dd || 1);
      setAcceptDate(dt);
      setAcceptTime(booking.scheduled_time);
      setAcceptMonth(dt);
    } else {
      // Default to today IST so the admin can pick literally any future slot.
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const today = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
      setAcceptDate(today);
      setAcceptTime(null);
      setAcceptMonth(today);
    }
  };

  const fetchAcceptAvailableSlots = async (date) => {
    if (!date) return;
    setAcceptSlotsLoading(true);
    try {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      // Admin endpoint returns the full day grid (including booked slots),
      // so the admin can see free vs taken at a glance.
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/discovery-calls/all-slots?date=${dateStr}`,
        { withCredentials: true },
      );
      setAcceptSlots(res.data?.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots for accept:', err);
      setAcceptSlots([]);
    } finally {
      setAcceptSlotsLoading(false);
    }
  };

  const fetchAcceptMonthOverview = async (monthDate) => {
    if (!monthDate) return;
    try {
      const yyyy = monthDate.getFullYear();
      const mm = String(monthDate.getMonth() + 1).padStart(2, '0');
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/discovery-calls/calendar-overview?month=${yyyy}-${mm}`,
        { withCredentials: true },
      );
      setAcceptMonthCounts(res.data?.counts || {});
    } catch (err) {
      console.error('Failed to fetch month overview:', err);
      setAcceptMonthCounts({});
    }
  };

  useEffect(() => {
    if (acceptDialogBooking && acceptDate) {
      fetchAcceptAvailableSlots(acceptDate);
      setAcceptTime(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptDate, acceptDialogBooking?.id]);

  useEffect(() => {
    if (acceptDialogBooking) {
      fetchAcceptMonthOverview(acceptMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptMonth, acceptDialogBooking?.id]);

  const confirmAcceptBooking = async () => {
    if (!acceptDialogBooking) return;
    if (!acceptDate || !acceptTime) {
      setAcceptError('Please pick both a date and a time slot.');
      return;
    }
    setAccepting(true);
    setAcceptError('');
    try {
      const yyyy = acceptDate.getFullYear();
      const mm = String(acceptDate.getMonth() + 1).padStart(2, '0');
      const dd = String(acceptDate.getDate()).padStart(2, '0');
      const payload = {
        selected_date: `${yyyy}-${mm}-${dd}`,
        selected_time: acceptTime,
      };
      await axios.post(
        `${BACKEND_URL}/api/admin/discovery-calls/bookings/${acceptDialogBooking.id}/accept`,
        payload,
        { withCredentials: true },
      );
      setAcceptDialogBooking(null);
      await fetchBookings();
      alert('Booking accepted — calendar invite sent.');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to accept booking';
      console.error('Error accepting booking:', err);
      setAcceptError(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to reject this booking?')) return;
    
    try {
      await axios.post(`${BACKEND_URL}/api/admin/discovery-calls/bookings/${bookingId}/reject`, {}, {
        withCredentials: true
      });
      await fetchBookings();
      alert('Booking rejected');
    } catch (err) {
      console.error('Error rejecting booking:', err);
      alert('Failed to reject booking');
    }
  };

  const handleCompleteBooking = async (bookingId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/admin/discovery-calls/bookings/${bookingId}/complete`, {}, {
        withCredentials: true
      });
      await fetchBookings();
    } catch (err) {
      console.error('Error completing booking:', err);
    }
  };

  const handleSaveQuestion = async () => {
    try {
      if (editingQuestion) {
        await axios.put(
          `${BACKEND_URL}/api/admin/discovery-calls/questions/${editingQuestion.id || editingQuestion._id}`,
          { ...questionForm, id: editingQuestion.id || editingQuestion._id },
          { withCredentials: true }
        );
      } else {
        await axios.post(`${BACKEND_URL}/api/admin/discovery-calls/questions`, questionForm, {
          withCredentials: true
        });
      }
      await fetchQuestions();
      setShowQuestionModal(false);
      setEditingQuestion(null);
      setQuestionForm({
        question: '',
        type: 'short_text',
        required: true,
        options: [],
        placeholder: ''
      });
    } catch (err) {
      console.error('Error saving question:', err);
      alert('Failed to save question');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/discovery-calls/questions/${questionId}`, {
        withCredentials: true
      });
      await fetchQuestions();
    } catch (err) {
      console.error('Error deleting question:', err);
      alert('Failed to delete question');
    }
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question: question.question,
      type: question.type,
      required: question.required,
      options: question.options || [],
      placeholder: question.placeholder || ''
    });
    setShowQuestionModal(true);
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...prev.options, { id: Date.now().toString(), label: '', value: '' }]
    }));
  };

  const updateOption = (index, field, value) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => 
        i === index ? { ...opt, [field]: value, value: field === 'label' ? value.toLowerCase().replace(/\s+/g, '_') : opt.value } : opt
      )
    }));
  };

  const removeOption = (index) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for question reordering
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = questions.findIndex(q => (q.id || q._id) === active.id);
      const newIndex = questions.findIndex(q => (q.id || q._id) === over.id);

      const newQuestions = arrayMove(questions, oldIndex, newIndex);
      setQuestions(newQuestions);

      // Save new order to backend
      try {
        const questionIds = newQuestions.map(q => q.id || q._id);
        await axios.post(`${BACKEND_URL}/api/admin/discovery-calls/questions/reorder`, questionIds, {
          withCredentials: true
        });
      } catch (err) {
        console.error('Error reordering questions:', err);
        // Revert on error
        await fetchQuestions();
      }
    }
  };

  const filteredBookings = bookings.filter(b => {
    // Status filter
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    // Source filter — driven by the active tab. The "Coaching Discovery
    // Calls" tab shows only `source==='coaching'` rows; the "Cohort
    // Discovery Calls" tab shows only `source==='cohort'` rows.
    const src = b.source || 'coaching';
    if (activeTab === 'coaching' && src !== 'coaching') return false;
    if (activeTab === 'cohort' && src !== 'cohort') return false;
    // Date filter
    if (dateFilter) {
      const bookingDate = b.scheduled_date || '';
      if (bookingDate !== dateFilter) return false;
    }
    // Search filter (name or email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (b.name || '').toLowerCase();
      const email = (b.email || '').toLowerCase();
      const phone = (b.phone || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  // Per-source counts for the tab badges + the stats cards inside the
  // currently active tab. Computed client-side from the merged list.
  const sourceCounts = bookings.reduce((acc, b) => {
    const src = b.source || 'coaching';
    acc[src] = acc[src] || { total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 };
    acc[src].total += 1;
    const st = b.status || 'pending';
    if (acc[src][st] !== undefined) acc[src][st] += 1;
    return acc;
  }, {});
  const currentSourceCounts = sourceCounts[activeTab] || { total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 };

  const formatDate = (booking) => {
    // Use the pre-formatted IST display string from backend if available
    if (booking.scheduled_datetime_display) {
      return booking.scheduled_datetime_display;
    }
    // Fallback: use separate date and time fields
    if (booking.scheduled_date && booking.scheduled_time) {
      return `${booking.scheduled_date} ${booking.scheduled_time} IST`;
    }
    // Legacy fallback: try to format scheduled_datetime
    if (booking.scheduled_datetime) {
      try {
        return new Date(booking.scheduled_datetime).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return 'Invalid Date';
      }
    }
    return 'Not scheduled';
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-slate-100 text-slate-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discovery Calls</h1>
          <p className="text-slate-500">Manage discovery call bookings, settings, and form questions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { id: 'coaching', label: 'Coaching Discovery Calls', icon: Calendar, count: sourceCounts.coaching?.total || 0 },
            { id: 'cohort', label: 'Cohort Discovery Calls', icon: Users, count: sourceCounts.cohort?.total || 0 },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'questions', label: 'Form Questions', icon: MessageSquare, count: questions.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`discovery-tab-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Bookings Tab — single block reused for both "Coaching" and
          "Cohort" tabs; the `activeTab` value drives the source filter
          above. */}
      {(activeTab === 'coaching' || activeTab === 'cohort') && (
        <div className="space-y-4">
          {/* Stats Cards — per active source */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Total', count: currentSourceCounts.total || 0, color: 'bg-slate-100 text-slate-800' },
              { label: 'Pending', count: currentSourceCounts.pending || 0, color: 'bg-yellow-100 text-yellow-800' },
              { label: 'Accepted', count: currentSourceCounts.accepted || 0, color: 'bg-green-100 text-green-800' },
              { label: 'Rejected', count: currentSourceCounts.rejected || 0, color: 'bg-red-100 text-red-800' },
              { label: 'Completed', count: currentSourceCounts.completed || 0, color: 'bg-blue-100 text-blue-800' },
            ].map(stat => (
              <div key={stat.label} className={`p-4 rounded-lg ${stat.color}`}>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-slate-400 hover:text-slate-600"
                  title="Clear date filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source filter dropdown removed — the active tab
                (Coaching / Cohort) now drives the source filter. */}
            
            {/* Results count */}
            <span className="text-sm text-slate-500">
              {filteredBookings.length} {activeTab === 'cohort' ? 'cohort' : 'coaching'} bookings
            </span>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Scheduled</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {searchQuery || dateFilter ? 'No bookings match your filters' : 'No bookings found'}
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map(booking => (
                    <tr key={booking.id} className="border-t hover:bg-slate-50" data-testid={`discovery-call-row-${booking.id}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setViewingBooking(booking)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {booking.name}
                        </button>
                        {booking.source === 'cohort' && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200" data-testid={`cohort-badge-${booking.id}`}>
                            <Users className="w-3 h-3" />
                            Cohort{booking.cohort_name ? ` · ${booking.cohort_name}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{booking.email}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{booking.phone || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{formatDate(booking)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(booking.status)}
                          {booking.meet_link && (
                            <a
                              href={booking.meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="Join Google Meet"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingBooking(booking)}
                            className="text-slate-600"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {booking.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAcceptBooking(booking)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectBooking(booking.id)}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {booking.status === 'accepted' && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteBooking(booking.id)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Mark Complete
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

          {/* Booking Detail Modal */}
          {viewingBooking && (
            <Dialog open={!!viewingBooking} onOpenChange={() => setViewingBooking(null)}>
              <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-0">
                {/* Header band */}
                <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50/60 to-transparent">
                  <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <DialogTitle className="text-xl font-semibold text-slate-900 truncate">
                          {viewingBooking.name}
                        </DialogTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                          <a href={`mailto:${viewingBooking.email}`} className="text-blue-600 hover:underline truncate">
                            {viewingBooking.email}
                          </a>
                          {viewingBooking.phone && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{viewingBooking.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">{getStatusBadge(viewingBooking.status)}</div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-6 py-5 space-y-6">
                  {/* Schedule card */}
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Schedule</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 bg-slate-50 rounded-lg p-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Date</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{viewingBooking.scheduled_date || 'Not scheduled'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Time</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{viewingBooking.scheduled_time ? `${viewingBooking.scheduled_time} IST` : '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Booked at</p>
                        <p className="text-sm text-slate-700 mt-0.5">
                          {viewingBooking.created_at
                            ? new Date(viewingBooking.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
                            : '—'}
                        </p>
                      </div>
                      {viewingBooking.meet_link && (
                        <div className="col-span-2 sm:col-span-4">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Google Meet</p>
                          <a
                            href={viewingBooking.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline break-all mt-0.5"
                          >
                            {viewingBooking.meet_link}
                          </a>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Form responses — preserve question order, decode labels */}
                  {viewingBooking.answers && Object.keys(viewingBooking.answers).length > 0 && (() => {
                    // Helper: convert raw value(s) back to human-readable label using question.options
                    const formatAnswer = (q, raw) => {
                      if (raw === null || raw === undefined || raw === '') return null;
                      const opts = q?.options || [];
                      const lookup = (val) => {
                        const found = opts.find((o) => (o.value ?? o.label) === val);
                        return found?.label || (typeof val === 'string' ? val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : String(val));
                      };
                      if (Array.isArray(raw)) {
                        return raw.length ? raw.map(lookup) : null;
                      }
                      if (opts.length) return lookup(raw);
                      return String(raw);
                    };

                    // Preserve admin-defined question order
                    const orderedQs = [...questions].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
                    const rendered = orderedQs
                      .map((q) => {
                        const qId = q.id || q._id;
                        const raw = viewingBooking.answers[qId];
                        const formatted = formatAnswer(q, raw);
                        if (formatted === null || formatted === undefined) return null;
                        const isLong =
                          q.type === 'long_text' ||
                          q.type === 'multiple_choice' ||
                          (typeof formatted === 'string' && formatted.length > 60) ||
                          Array.isArray(formatted);
                        return { qId, q, formatted, isLong };
                      })
                      .filter(Boolean);

                    if (rendered.length === 0) return null;

                    return (
                      <section>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Form Responses
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-slate-200 p-5 bg-white">
                          {rendered.map(({ qId, q, formatted, isLong }) => (
                            <div
                              key={qId}
                              className={isLong ? 'sm:col-span-2' : ''}
                            >
                              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                {q.question}
                              </p>
                              {Array.isArray(formatted) ? (
                                <ul className="mt-1 flex flex-wrap gap-1.5">
                                  {formatted.map((item, i) => (
                                    <li
                                      key={i}
                                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
                                    >
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap break-words">
                                  {formatted}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}
                </div>

                {/* Actions footer */}
                <div className="px-6 py-4 border-t bg-slate-50 flex flex-wrap justify-end gap-2">
                  {viewingBooking.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => { handleRejectBooking(viewingBooking.id); setViewingBooking(null); }}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => { handleAcceptBooking(viewingBooking); setViewingBooking(null); }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                    </>
                  )}
                  {viewingBooking.status === 'accepted' && (
                    <Button
                      onClick={() => { handleCompleteBooking(viewingBooking.id); setViewingBooking(null); }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Mark Complete
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setViewingBooking(null)}>
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Calendar Connection Section */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Google Calendar Integration</h3>
                <p className="text-sm text-slate-500">Connect your Google Calendar to automatically create meeting invites</p>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                calendarStatus.connected ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {calendarStatus.connected ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    Not Connected
                  </span>
                )}
              </div>
            </div>
            
            {calendarStatus.connected ? (
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Calendar Connected</p>
                    <p className="text-sm text-green-700">{calendarStatus.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnectCalendar}
                  disabled={calendarLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {calendarLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border">
                    <Calendar className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Connect Google Calendar</p>
                    <p className="text-sm text-slate-500">Required to send calendar invites for accepted bookings</p>
                  </div>
                </div>
                <Button
                  onClick={handleConnectCalendar}
                  disabled={calendarLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {calendarLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Connect Calendar
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border p-6 space-y-6">
            <h3 className="text-lg font-semibold">General Settings</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Admin Email (receives booking notifications)</Label>
                <Input
                  value={settings.admin_email}
                  onChange={(e) => setSettings(prev => ({ ...prev, admin_email: e.target.value }))}
                  placeholder="bookings@gradnext.co"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Call Duration (minutes)</Label>
                <Input
                  type="number"
                  value={settings.call_duration_minutes}
                  onChange={(e) => setSettings(prev => ({ ...prev, call_duration_minutes: parseInt(e.target.value) || 15 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Buffer Between Calls (minutes)</Label>
                <Input
                  type="number"
                  value={settings.buffer_minutes}
                  onChange={(e) => setSettings(prev => ({ ...prev, buffer_minutes: parseInt(e.target.value) || 15 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Max Advance Booking (days)</Label>
                <Input
                  type="number"
                  value={settings.max_advance_days}
                  onChange={(e) => setSettings(prev => ({ ...prev, max_advance_days: parseInt(e.target.value) || 30 }))}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6 space-y-6">
            <h3 className="text-lg font-semibold">Availability</h3>
            
            <div className="space-y-4">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                <div key={day} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <label className="flex items-center gap-2 w-32">
                    <input
                      type="checkbox"
                      checked={settings.availability[day]?.enabled || false}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        availability: {
                          ...prev.availability,
                          [day]: { ...prev.availability[day], enabled: e.target.checked }
                        }
                      }))}
                      className="rounded"
                    />
                    <span className="font-medium capitalize">{day}</span>
                  </label>
                  
                  {settings.availability[day]?.enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={settings.availability[day]?.slots?.[0]?.start || '09:00'}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          availability: {
                            ...prev.availability,
                            [day]: {
                              ...prev.availability[day],
                              slots: [{ 
                                start: e.target.value, 
                                end: prev.availability[day]?.slots?.[0]?.end || '18:00' 
                              }]
                            }
                          }
                        }))}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={settings.availability[day]?.slots?.[0]?.end || '18:00'}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          availability: {
                            ...prev.availability,
                            [day]: {
                              ...prev.availability[day],
                              slots: [{ 
                                start: prev.availability[day]?.slots?.[0]?.start || '09:00', 
                                end: e.target.value 
                              }]
                            }
                          }
                        }))}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={settingsSaving} className="bg-blue-600 hover:bg-blue-700">
              {settingsSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-600">Configure the questions shown in the discovery call booking form</p>
              <p className="text-sm text-slate-400 mt-1">Drag and drop to reorder questions</p>
            </div>
            <Button onClick={() => {
              setEditingQuestion(null);
              setQuestionForm({
                question: '',
                type: 'short_text',
                required: true,
                options: [],
                placeholder: ''
              });
              setShowQuestionModal(true);
            }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </div>

          <div className="bg-white rounded-lg border">
            {questions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No questions configured. Add your first question.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={questions.map(q => q.id || q._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div>
                    {questions.map((question) => (
                      <SortableQuestionItem
                        key={question.id || question._id}
                        question={question}
                        onEdit={handleEditQuestion}
                        onDelete={handleDeleteQuestion}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}

      {/* Question Edit Modal */}
      <Dialog open={showQuestionModal} onOpenChange={setShowQuestionModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>Configure the question details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Input
                value={questionForm.question}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Enter your question"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select
                value={questionForm.type}
                onValueChange={(value) => setQuestionForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_text">Short Text</SelectItem>
                  <SelectItem value="long_text">Long Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="single_choice">Single Choice (Radio)</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice (Checkbox)</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={questionForm.required}
                onChange={(e) => setQuestionForm(prev => ({ ...prev, required: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="required">Required field</Label>
            </div>
            
            {['short_text', 'long_text', 'email', 'phone'].includes(questionForm.type) && (
              <div className="space-y-2">
                <Label>Placeholder Text</Label>
                <Input
                  value={questionForm.placeholder}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, placeholder: e.target.value }))}
                  placeholder="Enter placeholder text"
                />
              </div>
            )}
            
            {['single_choice', 'multiple_choice', 'dropdown'].includes(questionForm.type) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button size="sm" variant="outline" onClick={addOption}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {questionForm.options.map((option, index) => (
                    <div key={option.id || index} className="flex items-center gap-2">
                      <Input
                        value={option.label}
                        onChange={(e) => updateOption(index, 'label', e.target.value)}
                        placeholder="Option label"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeOption(index)}
                        className="text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Detail Modal */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>View all information for this booking</DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Name</p>
                  <p className="font-medium">{selectedBooking.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{selectedBooking.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium">{selectedBooking.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  {getStatusBadge(selectedBooking.status)}
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Scheduled Time</p>
                  <p className="font-medium">{formatDate(selectedBooking)}</p>
                </div>
                {selectedBooking.meet_link && (
                  <div className="col-span-2">
                    <p className="text-sm text-slate-500">Google Meet Link</p>
                    <a 
                      href={selectedBooking.meet_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline flex items-center gap-2"
                    >
                      {selectedBooking.meet_link}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
              
              {/* Answers */}
              <div>
                <h4 className="font-semibold mb-3">Form Responses</h4>
                <div className="space-y-3">
                  {questions.map(q => {
                    const qId = q.id || q._id;
                    const answer = selectedBooking.answers?.[qId];
                    if (!answer) return null;
                    
                    return (
                      <div key={qId} className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-500">{q.question}</p>
                        <p className="font-medium">
                          {Array.isArray(answer) ? answer.join(', ') : answer}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Actions */}
              {selectedBooking.status === 'pending' && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleRejectBooking(selectedBooking.id)}
                    className="text-red-600 border-red-300"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleAcceptBooking(selectedBooking)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Accept & Send Invite
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Accept-with-slot dialog (new flow) */}
      <Dialog
        open={!!acceptDialogBooking}
        onOpenChange={(o) => { if (!o) setAcceptDialogBooking(null); }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0" data-testid="accept-booking-dialog">
          {/* Hero header band */}
          <div
            className="px-6 pt-6 pb-5"
            style={{
              background:
                'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.0) 100%)',
              borderBottom: '1px solid rgb(226, 232, 240)',
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <span className="inline-flex w-9 h-9 rounded-full bg-blue-600 text-white items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </span>
                Schedule discovery call
              </DialogTitle>
              <DialogDescription className="ml-11 mt-0.5">
                {acceptDialogBooking ? (
                  <>
                    For <span className="font-medium text-slate-900">{acceptDialogBooking.name}</span>{' '}
                    <span className="text-slate-400">·</span>{' '}
                    <span className="text-slate-500">{acceptDialogBooking.email}</span>
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
          </div>

          {acceptDialogBooking && (
            <div className="px-6 py-5 space-y-5">
              {/* Selected slot summary banner */}
              <div
                className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-blue-50/30 px-4 py-3 flex items-center gap-3"
                data-testid="accept-selected-summary"
              >
                <span className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </span>
                <div className="text-sm flex-1">
                  <div className="font-semibold text-slate-900">
                    {acceptDate ? (
                      <>
                        {acceptDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {acceptTime ? (
                          <span className="ml-2 text-blue-700 font-bold">at {acceptTime} IST</span>
                        ) : (
                          <span className="ml-2 text-slate-500 font-normal">— pick a time slot below</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-600 font-normal">Pick a date in the calendar to see available slots.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Month nav */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAcceptMonth(new Date(acceptMonth.getFullYear(), acceptMonth.getMonth() - 1))}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                  data-testid="accept-prev-month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-base font-semibold">
                  {acceptMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  type="button"
                  onClick={() => setAcceptMonth(new Date(acceptMonth.getFullYear(), acceptMonth.getMonth() + 1))}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                  data-testid="accept-next-month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Calendar grid */}
              <div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const cells = [];
                    const firstDay = new Date(acceptMonth.getFullYear(), acceptMonth.getMonth(), 1);
                    const lastDay = new Date(acceptMonth.getFullYear(), acceptMonth.getMonth() + 1, 0);
                    const startOffset = firstDay.getDay();
                    const today = new Date(); today.setHours(0,0,0,0);
                    for (let i = 0; i < startOffset; i++) cells.push(<div key={`pad-${i}`} />);
                    for (let day = 1; day <= lastDay.getDate(); day++) {
                      const dt = new Date(acceptMonth.getFullYear(), acceptMonth.getMonth(), day);
                      const isPast = dt < today;
                      const selected = acceptDate && acceptDate.toDateString() === dt.toDateString();
                      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const busy = acceptMonthCounts[ymd] || 0;
                      cells.push(
                        <button
                          key={day}
                          type="button"
                          disabled={isPast}
                          onClick={() => setAcceptDate(dt)}
                          data-testid={`accept-date-${day}`}
                          title={busy ? `${busy} booking${busy === 1 ? '' : 's'} on this day` : undefined}
                          className={`relative aspect-square rounded-lg text-sm transition-colors ${
                            selected ? 'bg-blue-600 text-white font-semibold' :
                            isPast ? 'text-slate-300 cursor-not-allowed' :
                            busy > 0 ? 'bg-amber-50 hover:bg-amber-100 text-slate-800' :
                            'hover:bg-blue-50 text-slate-700'
                          }`}
                        >
                          {day}
                          {busy > 0 && (
                            <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium px-1 rounded ${
                              selected ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                            }`}>
                              {busy}
                            </span>
                          )}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
                    has bookings
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-600" />
                    selected
                  </span>
                </div>
              </div>

              {/* Slot picker — admin sees ALL slots in the day, with already-booked ones disabled */}
              {acceptDate && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Time slots (IST) — pick any free time</Label>
                    {acceptSlots.length > 0 && (
                      <span className="text-xs text-slate-500">
                        {acceptSlots.filter((s) => !s.booked).length} free · {acceptSlots.filter((s) => s.booked).length} booked
                      </span>
                    )}
                  </div>
                  {acceptSlotsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading slots…
                    </div>
                  ) : acceptSlots.length === 0 ? (
                    <p className="text-sm text-slate-500 mt-2">No slots available on this day.</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-2 max-h-72 overflow-y-auto pr-1">
                      {acceptSlots.map((slot) => {
                        const time = slot.time;
                        const isBooked = !!slot.booked;
                        const isSelected = acceptTime === time;
                        return (
                          <button
                            type="button"
                            key={time}
                            onClick={() => !isBooked && setAcceptTime(time)}
                            disabled={isBooked}
                            data-testid={`accept-slot-${time}`}
                            title={isBooked ? `Booked${slot.booked_with ? ` — ${slot.booked_with}` : ''}` : `Pick ${time} IST`}
                            className={`px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : isBooked
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="font-medium">{time}</div>
                            {isBooked && (
                              <div className="text-[10px] uppercase tracking-wide mt-0.5 text-slate-400">
                                Booked
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {acceptError && (
                <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {acceptError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAcceptDialogBooking(null)}
              disabled={accepting}
              data-testid="accept-dialog-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAcceptBooking}
              disabled={accepting || !acceptDate || !acceptTime}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="accept-dialog-confirm"
            >
              {accepting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Accepting…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm & Send Invite</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscoveryCallsSection;
