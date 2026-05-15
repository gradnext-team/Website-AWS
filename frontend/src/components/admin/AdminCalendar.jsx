import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ChevronLeft, ChevronRight, Loader2, Calendar, Clock, 
  User, X, Check, Ban, Filter, Plus
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export const AdminCalendar = () => {
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [firmFilter, setFirmFilter] = useState('all');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  // Manual session creation state
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [mentorsList, setMentorsList] = useState([]);
  const [candidatesList, setCandidatesList] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState({
    mentor_id: '',
    candidate_id: '',
    date: '',
    time_slot: '',
    session_type: '',
    case_type: '',
    admin_remarks: '',
    booking_type: 'coaching',
    deduct_credit: false
  });

  // Get unique firms from calendar data
  const getUniqueFirms = () => {
    if (!calendarData?.mentors) return [];
    const firms = [...new Set(calendarData.mentors.map(m => m.firm).filter(Boolean))];
    return firms.sort();
  };

  // Filter mentors based on criteria
  const getFilteredMentors = () => {
    if (!calendarData?.mentors) return [];
    let filtered = calendarData.mentors;
    
    if (firmFilter !== 'all') {
      filtered = filtered.filter(m => m.firm === firmFilter);
    }
    
    if (showOnlyAvailable && viewMode === 'day') {
      filtered = filtered.filter(m => m.total_available > 0);
    }
    
    return filtered;
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get date string for API
  const getDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Navigate date
  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Fetch calendar data
  useEffect(() => {
    const fetchCalendarData = async () => {
      setLoading(true);
      try {
        const dateStr = getDateString(currentDate);
        const endpoint = viewMode === 'day' 
          ? `/api/admin/calendar/day/${dateStr}`
          : `/api/admin/calendar/week/${dateStr}`;
        
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, { withCredentials: true });
        setCalendarData(res.data);
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [currentDate, viewMode]);

  // Load mentors when add session modal opens
  useEffect(() => {
    if (addSessionModalOpen) {
      loadMentorsForSession();
    }
  }, [addSessionModalOpen]);

  // Search candidates when typing
  useEffect(() => {
    if (addSessionModalOpen) {
      const timer = setTimeout(() => {
        loadCandidatesForSession(candidateSearch);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [candidateSearch, addSessionModalOpen]);

  const loadMentorsForSession = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/mentors-list`, { withCredentials: true });
      setMentorsList(res.data.mentors || []);
    } catch (error) {
      console.error('Failed to load mentors:', error);
    }
  };

  const loadCandidatesForSession = async (search = '') => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/candidates-list?search=${encodeURIComponent(search)}`, { withCredentials: true });
      setCandidatesList(res.data.candidates || []);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    }
  };

  const handleCreateManualSession = async () => {
    // Basic validation
    if (!newSession.mentor_id || !newSession.candidate_id || !newSession.date || !newSession.time_slot) {
      alert('Please fill all required fields');
      return;
    }

    // Session type is required only for coaching sessions
    if (newSession.booking_type === 'coaching' && !newSession.session_type) {
      alert('Please select a session type for coaching sessions');
      return;
    }

    // Case type required for Case sessions
    if (newSession.booking_type === 'coaching' && newSession.session_type === 'Case session' && !newSession.case_type) {
      alert('Please select a case type for Case sessions');
      return;
    }

    setCreatingSession(true);
    try {
      const result = await axios.post(`${BACKEND_URL}/api/admin/coaching-sessions/manual`, newSession, { withCredentials: true });
      setAddSessionModalOpen(false);
      setNewSession({
        mentor_id: '',
        candidate_id: '',
        date: '',
        time_slot: '',
        session_type: '',
        case_type: '',
        admin_remarks: '',
        booking_type: 'coaching',
        deduct_credit: false
      });
      setCandidateSearch('');
      // Refresh calendar data
      const dateStr = getDateString(currentDate);
      const endpoint = viewMode === 'day' 
        ? `/api/admin/calendar/day/${dateStr}`
        : `/api/admin/calendar/week/${dateStr}`;
      const res = await axios.get(`${BACKEND_URL}${endpoint}`, { withCredentials: true });
      setCalendarData(res.data);
      const creditMsg = result.data.credit_deducted ? ' (Credit deducted from candidate)' : ' (No credit deducted)';
      alert('Session created successfully!' + creditMsg);
    } catch (error) {
      alert('Failed to create session: ' + (error.response?.data?.detail || error.message));
    } finally {
      setCreatingSession(false);
    }
  };

  // Time slots to display (Full 24 hours, every hour for header)
  const timeHeaders = [];
  for (let hour = 0; hour < 24; hour++) {
    const time = hour === 0 ? '12AM' : hour === 12 ? '12PM' : hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
    timeHeaders.push({ hour, label: time });
  }

  // Refs for scroll synchronization
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);

  // Handle body scroll to sync header
  const handleBodyScroll = (e) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Render Day View
  const renderDayView = () => {
    const filteredMentors = getFilteredMentors();
    
    return (
      <div className="flex flex-col h-full" style={{ isolation: 'isolate' }}>
        {/* Header Row */}
        <div className="flex bg-slate-100 border-b flex-shrink-0">
          {/* Fixed Mentor Header */}
          <div className="flex-shrink-0 w-[180px] p-3 font-semibold text-slate-700 border-r bg-slate-100">
            Mentor
          </div>
          {/* Scrollable Time Headers */}
          <div 
            ref={headerScrollRef}
            className="flex-1 overflow-hidden"
          >
            <div className="flex" style={{ minWidth: '1440px' }}>
              {timeHeaders.map(({ hour, label }) => (
                <div 
                  key={hour} 
                  className="flex-shrink-0 w-[60px] p-2 text-center font-medium text-slate-600 text-xs"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Body with scroll - fills remaining height */}
        <div className="flex flex-1 min-h-0">
          {/* Fixed Mentor Names Column */}
          <div className="flex-shrink-0 w-[180px] overflow-y-auto border-r bg-white" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`.mentor-col::-webkit-scrollbar { display: none; }`}</style>
            <div className="mentor-col">
              {filteredMentors.map((mentor) => (
                <div key={mentor.mentor_id} className="h-[52px] p-2 border-b bg-white flex items-center">
                  <div className="flex items-center gap-2">
                    {mentor.picture ? (
                      <img 
                        src={mentor.picture.startsWith('/') ? `${BACKEND_URL}${mentor.picture}` : mentor.picture} 
                        alt={mentor.mentor_name}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-slate-800 truncate">{mentor.mentor_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{mentor.firm}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Scrollable Time Slots Area */}
          <div 
            ref={bodyScrollRef}
            className="flex-1 overflow-auto"
            onScroll={(e) => {
              // Sync header horizontal scroll
              if (headerScrollRef.current) {
                headerScrollRef.current.scrollLeft = e.target.scrollLeft;
              }
              // Sync mentor column vertical scroll
              const mentorCol = e.target.previousElementSibling;
              if (mentorCol) {
                mentorCol.scrollTop = e.target.scrollTop;
              }
            }}
          >
            <div style={{ minWidth: '1440px' }}>
              {filteredMentors.map((mentor) => (
                <div key={mentor.mentor_id} className="flex border-b hover:bg-slate-50 h-[52px]">
                  {/* Time Slots */}
                  {timeHeaders.map(({ hour }) => {
                    const hourSlots = mentor.time_slots?.filter(s => {
                      const slotHour = parseInt(s.time.split(':')[0]);
                      return slotHour === hour;
                    }) || [];
                    
                    return (
                      <div key={hour} className="flex-shrink-0 w-[60px] p-0.5 border-r flex items-center">
                        <div className="flex gap-0.5 w-full">
                          {hourSlots.map((slot, idx) => (
                            <div
                              key={idx}
                              onClick={() => slot.is_booked && setSelectedSession({ ...slot.booking, mentor_name: mentor.mentor_name, time: slot.time_display })}
                              className={`flex-1 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-colors ${
                                slot.is_booked
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : slot.is_available
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-400'
                              }`}
                              title={
                                slot.is_booked 
                                  ? `Booked: ${slot.booking?.candidate_name}` 
                                  : slot.is_available 
                                    ? 'Available' 
                                    : 'No availability'
                              }
                            >
                              {slot.is_booked ? (
                                <User className="w-2.5 h-2.5" />
                              ) : slot.is_available ? (
                                <Check className="w-2.5 h-2.5" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {filteredMentors.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No mentors match the current filters
          </div>
        )}
      </div>
    );
  };

  // Render Week View
  const renderWeekView = () => {
    const filteredMentors = getFilteredMentors();
    const weekDates = calendarData?.week_dates || [];
    
    return (
      <div className="flex flex-col h-full">
        {/* Header Row */}
        <div className="flex bg-slate-100 border-b flex-shrink-0">
          {/* Fixed Mentor Header */}
          <div className="flex-shrink-0 w-[200px] p-3 font-semibold text-slate-700 border-r">
            Mentor
          </div>
          {/* Week Day Headers */}
          <div className="flex flex-1">
            {weekDates.map((day) => (
              <div key={day.date} className="flex-1 p-3 text-center border-r min-w-[100px]">
                <div className="font-semibold text-slate-700">{day.day_short}</div>
                <div className="text-lg font-bold text-slate-800">{day.day_num}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Body - fills remaining height */}
        <div className="flex flex-1 min-h-0">
          {/* Fixed Mentor Names Column */}
          <div className="flex-shrink-0 w-[200px] overflow-y-auto border-r bg-white" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filteredMentors.map((mentor) => (
              <div key={mentor.mentor_id} className="h-[80px] p-3 border-b bg-white flex items-center">
                <div className="flex items-center gap-2">
                  {mentor.picture ? (
                    <img 
                      src={mentor.picture.startsWith('/') ? `${BACKEND_URL}${mentor.picture}` : mentor.picture} 
                      alt={mentor.mentor_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm text-slate-800">{mentor.mentor_name}</p>
                    <p className="text-xs text-slate-500">{mentor.firm}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Scrollable Week Data */}
          <div 
            className="flex-1 overflow-auto"
            onScroll={(e) => {
              // Sync mentor column vertical scroll
              const mentorCol = e.target.previousElementSibling;
              if (mentorCol) {
                mentorCol.scrollTop = e.target.scrollTop;
              }
            }}
          >
            {filteredMentors.map((mentor) => (
              <div key={mentor.mentor_id} className="flex border-b hover:bg-slate-50 h-[80px]">
                {mentor.week?.map((day) => (
                  <div key={day.date} className="flex-1 p-2 text-center border-r min-w-[100px] flex items-center justify-center">
                    {day.is_blocked ? (
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                        <Ban className="w-3 h-3" />
                        Blocked
                      </div>
                    ) : day.total_slots === 0 ? (
                      <span className="text-slate-400 text-sm">-</span>
                    ) : (
                      <div 
                        className="cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => {
                          setCurrentDate(new Date(day.date + 'T00:00:00'));
                          setViewMode('day');
                        }}
                        title="Click to view day details"
                      >
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${
                          day.booked === day.total_slots
                            ? 'bg-blue-100 text-blue-700'
                            : day.available > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          <div className="text-center">
                            <div className="font-bold text-sm">{day.booked}/{day.total_slots}</div>
                            <div className="text-[10px]">booked</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {filteredMentors.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No mentors match the current filters
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-32px)] overflow-hidden">
      {/* Fixed Header Area - Never scrolls */}
      <div className="flex-shrink-0 space-y-3 pb-3">
        {/* Title Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Mentor Calendar</h2>
            <span className="text-xs text-slate-500">(Coaching: 45 min, Strategy: 30 min)</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Add Session Button */}
            <Button onClick={() => setAddSessionModalOpen(true)} className="bg-green-600 hover:bg-green-700" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Session
            </Button>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Day View
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Week View
              </button>
            </div>
          </div>
        </div>

        {/* Date Navigation & Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center min-w-[200px]">
              <p className="font-semibold text-slate-800">
                {viewMode === 'day' 
                  ? formatDate(currentDate)
                  : `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                }
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday} className="text-blue-600">
              Today
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Firm Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={firmFilter}
                onChange={(e) => setFirmFilter(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                <option value="all">All Firms</option>
                {getUniqueFirms().map(firm => (
                  <option key={firm} value={firm}>{firm}</option>
                ))}
              </select>
            </div>
            
            {/* Show only available toggle */}
            {viewMode === 'day' && (
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyAvailable}
                  onChange={(e) => setShowOnlyAvailable(e.target.checked)}
                  className="rounded"
                />
                Show only available
              </label>
            )}
          </div>
        </div>

        {/* Legend Row */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-green-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-green-700" />
            </div>
            <span className="text-slate-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-600">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center">
              <span className="text-slate-400 text-xs">-</span>
            </div>
            <span className="text-slate-600">No availability</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-red-100 flex items-center justify-center">
              <Ban className="w-3 h-3 text-red-700" />
            </div>
            <span className="text-slate-600">Blocked</span>
          </div>
        </div>
      </div>

      {/* Scrollable Calendar Content - Only this area scrolls */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : viewMode === 'day' ? (
          renderDayView()
        ) : (
          renderWeekView()
        )}
      </div>

      {/* Session Details Modal */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Session Details
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Mentor</p>
                  <p className="font-medium text-slate-800">{selectedSession.mentor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Time</p>
                  <p className="font-medium text-slate-800">{selectedSession.time}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Candidate</p>
                  <p className="font-medium text-slate-800">{selectedSession.candidate_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                    selectedSession.status === 'scheduled' 
                      ? 'bg-green-100 text-green-700'
                      : selectedSession.status === 'completed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedSession.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Session Type</p>
                  <p className="font-medium text-slate-800 capitalize">{selectedSession.session_type}</p>
                </div>
                {selectedSession.candidate_email && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">Candidate Email</p>
                    <p className="font-medium text-slate-800">{selectedSession.candidate_email}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Manual Session Modal */}
      <Dialog open={addSessionModalOpen} onOpenChange={setAddSessionModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add Manual Session
            </DialogTitle>
            <DialogDescription>
              Create a coaching session manually. This will override mentor availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Session Type (Coaching vs Strategy Call) */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Session Category <span className="text-red-500">*</span></label>
              <Select value={newSession.booking_type} onValueChange={(v) => setNewSession(s => ({ ...s, booking_type: v, session_type: '', case_type: '' }))}>
                <SelectTrigger data-testid="calendar-manual-booking-type">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coaching">Coaching Session (45 min)</SelectItem>
                  <SelectItem value="strategy_call">Strategy Call (30 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mentor Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Mentor <span className="text-red-500">*</span></label>
              <Select value={newSession.mentor_id} onValueChange={(v) => setNewSession(s => ({ ...s, mentor_id: v }))}>
                <SelectTrigger data-testid="calendar-manual-mentor-select">
                  <SelectValue placeholder="Select a mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentorsList.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      <div className="flex items-center gap-2">
                        <span>{mentor.name}</span>
                        {mentor.firm && <span className="text-slate-400 text-xs">({mentor.firm})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Candidate Selection with Search */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Candidate <span className="text-red-500">*</span></label>
              <Input
                placeholder="Search candidate by name or email..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="mb-2"
                data-testid="calendar-manual-candidate-search"
              />
              <Select value={newSession.candidate_id} onValueChange={(v) => setNewSession(s => ({ ...s, candidate_id: v }))}>
                <SelectTrigger data-testid="calendar-manual-candidate-select">
                  <SelectValue placeholder="Select a candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidatesList.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      <div className="flex items-center gap-2">
                        <span>{candidate.name}</span>
                        <span className="text-slate-400 text-xs">({candidate.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Date <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession(s => ({ ...s, date: e.target.value }))}
                  data-testid="calendar-manual-session-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Time <span className="text-red-500">*</span></label>
                <Input
                  type="time"
                  value={newSession.time_slot}
                  onChange={(e) => setNewSession(s => ({ ...s, time_slot: e.target.value }))}
                  data-testid="calendar-manual-session-time"
                />
              </div>
            </div>

            {/* Session Type - Only for Coaching Sessions */}
            {newSession.booking_type === 'coaching' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Session Type <span className="text-red-500">*</span></label>
                <Select value={newSession.session_type} onValueChange={(v) => setNewSession(s => ({ ...s, session_type: v, case_type: '' }))}>
                  <SelectTrigger data-testid="calendar-manual-session-type">
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Case session">Case Session</SelectItem>
                    <SelectItem value="Fit Interview">Fit Interview</SelectItem>
                    <SelectItem value="PEI session">PEI Session</SelectItem>
                    <SelectItem value="CV review session">CV Review Session</SelectItem>
                    <SelectItem value="General discussion">General Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Case Type (only for Case sessions within Coaching) */}
            {newSession.booking_type === 'coaching' && newSession.session_type === 'Case session' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Case Type <span className="text-red-500">*</span></label>
                <Select value={newSession.case_type} onValueChange={(v) => setNewSession(s => ({ ...s, case_type: v }))}>
                  <SelectTrigger data-testid="calendar-manual-case-type">
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Random">Random</SelectItem>
                    <SelectItem value="Profitability">Profitability</SelectItem>
                    <SelectItem value="Market Entry">Market Entry</SelectItem>
                    <SelectItem value="Guesstimate">Guesstimate</SelectItem>
                    <SelectItem value="Pricing">Pricing</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="M&A">M&A</SelectItem>
                    <SelectItem value="Unconventional">Unconventional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Admin Remarks */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Admin Remarks (Optional)</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                value={newSession.admin_remarks}
                onChange={(e) => setNewSession(s => ({ ...s, admin_remarks: e.target.value }))}
                placeholder="Add any notes about this session..."
                data-testid="calendar-manual-admin-remarks"
              />
            </div>

            {/* Deduct Credit Checkbox - Only for coaching sessions */}
            {newSession.booking_type === 'coaching' && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="calendar-deduct-credit"
                  checked={newSession.deduct_credit}
                  onChange={(e) => setNewSession(s => ({ ...s, deduct_credit: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  data-testid="calendar-manual-deduct-credit"
                />
                <label htmlFor="calendar-deduct-credit" className="text-sm text-blue-800">
                  <span className="font-medium">Deduct session credit from candidate</span>
                  <p className="text-xs text-blue-600 mt-0.5">
                    If checked, this will count against the candidate's coaching session quota
                  </p>
                </label>
              </div>
            )}

            {/* Info Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium">Note:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                <li>This session will bypass mentor availability checks</li>
                <li>Calendar invites will be sent to both mentor and candidate</li>
                <li>Session duration: <strong>{newSession.booking_type === 'coaching' ? '45 minutes' : '30 minutes'}</strong></li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSessionModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateManualSession} 
              disabled={creatingSession}
              className="bg-green-600 hover:bg-green-700"
            >
              {creatingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCalendar;
