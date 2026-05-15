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
// section was extracted the aliases were not carried over, which
// caused a ReferenceError → white screen on the Workshops tab.
const AvailabilitySelector = WeeklyAvailabilitySelector;
const FileUpload = SimpleFileUpload;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const WorkshopsSection = () => {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    title: '', 
    description: '', 
    date: '', 
    time: '', 
    duration: '2 hours',
    instructor: '',
    instructor_title: '',
    thumbnail: '', 
    thumbnail_hero: '',
    thumbnail_card: '',
    thumbnail_recording: '',
    status: 'upcoming', 
    meeting_link: '',
    recording_url: '',
    video_url: '',
    topics: [],
    max_participants: 50,
    is_past: false,
    is_free: false
  });
  
  // Registrations modal state
  const [showRegistrationsModal, setShowRegistrationsModal] = useState(false);
  const [selectedWorkshopForRegistrations, setSelectedWorkshopForRegistrations] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [broadcastingWorkshopId, setBroadcastingWorkshopId] = useState(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [sendingPostWorkshopId, setSendingPostWorkshopId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/workshops`, { withCredentials: true });
      setWorkshops(res.data.workshops || []);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const fetchRegistrations = async (workshop) => {
    setSelectedWorkshopForRegistrations(workshop);
    setShowRegistrationsModal(true);
    setLoadingRegistrations(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/workshops/${workshop.id}/registrations`, { withCredentials: true });
      setRegistrations(res.data.registrations || []);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
      setRegistrations([]);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const handleRemoveRegistration = async (registrationId) => {
    if (!window.confirm('Remove this registration? The user will be notified.')) return;
    try {
      await axios.delete(
        `${BACKEND_URL}/api/admin/workshops/${selectedWorkshopForRegistrations.id}/registrations/${registrationId}`,
        { withCredentials: true }
      );
      // Refresh registrations
      fetchRegistrations(selectedWorkshopForRegistrations);
      // Refresh workshops to update count
      fetchData();
    } catch (error) {
      alert('Failed to remove registration: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Download registrations as CSV
  const handleDownloadRegistrations = () => {
    if (!registrations || registrations.length === 0) {
      alert('No registrations to download');
      return;
    }
    
    // Create CSV content
    const workshopTitle = selectedWorkshopForRegistrations?.title || 'Workshop';
    const workshopDate = selectedWorkshopForRegistrations?.date || '';
    const workshopTime = selectedWorkshopForRegistrations?.time || '';
    
    // CSV headers
    const headers = ['Name', 'Email', 'Phone', 'Current Plan', 'Registered At', 'Workshop', 'Workshop Date', 'Workshop Time'];
    
    // CSV rows
    const rows = registrations.map(reg => [
      reg.user_name || '',
      reg.user_email || '',
      reg.user_phone || '',
      reg.current_plan || 'Unknown',
      reg.registered_at ? new Date(reg.registered_at).toLocaleString() : '',
      workshopTitle,
      workshopDate,
      workshopTime
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${workshopTitle.replace(/[^a-z0-9]/gi, '_')}_registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Send updated invites to all registered users
  const handleSendUpdatedInvites = async () => {
    if (!selectedWorkshopForRegistrations) return;
    
    const workshop = selectedWorkshopForRegistrations;
    if (!workshop.meeting_link) {
      alert('Please set a meeting link for this workshop first before sending invites.');
      return;
    }
    
    if (registrations.length === 0) {
      alert('No registrations to send invites to.');
      return;
    }
    
    if (!window.confirm(`Send updated calendar invites with the new meeting link to ${registrations.length} registered user(s)?`)) {
      return;
    }
    
    setSendingInvites(true);
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/send-updated-invites`,
        {},
        { withCredentials: true }
      );
      
      const result = response.data;
      alert(`✅ Invites sent successfully!\n\nSent: ${result.sent || 0}\nFailed: ${result.failed || 0}${result.errors?.length > 0 ? `\n\nErrors:\n${result.errors.join('\n')}` : ''}`);
    } catch (error) {
      console.error('Failed to send invites:', error);
      alert('Failed to send invites: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSendingInvites(false);
    }
  };

  const handleSave = async () => {
    try {
      // Prepare data matching backend model
      const dataToSend = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        instructor: formData.instructor,
        instructor_title: formData.instructor_title,
        thumbnail: formData.thumbnail || null,
        thumbnail_hero: formData.thumbnail_hero || null,
        thumbnail_card: formData.thumbnail_card || null,
        thumbnail_recording: formData.thumbnail_recording || null,
        meeting_link: formData.meeting_link || null,
        video_url: formData.video_url || formData.recording_url || null,
        topics: formData.topics || [],
        status: formData.status,
        is_past: formData.status === 'completed',
        is_free: formData.is_free || false,
        max_participants: formData.max_participants || 50
      };
      
      // Debug logging for thumbnail save
      console.log('=== WORKSHOP SAVE DEBUG ===');
      console.log('formData thumbnails:', {
        thumbnail: formData.thumbnail,
        thumbnail_hero: formData.thumbnail_hero,
        thumbnail_card: formData.thumbnail_card,
        thumbnail_recording: formData.thumbnail_recording
      });
      console.log('dataToSend thumbnails:', {
        thumbnail: dataToSend.thumbnail,
        thumbnail_hero: dataToSend.thumbnail_hero,
        thumbnail_card: dataToSend.thumbnail_card,
        thumbnail_recording: dataToSend.thumbnail_recording
      });
      console.log('Full dataToSend:', JSON.stringify(dataToSend, null, 2));
      
      if (editingItem) {
        const response = await axios.put(`${BACKEND_URL}/api/admin/workshops/${editingItem.id}`, dataToSend, { withCredentials: true });
        console.log('Update response:', response.data);
      } else {
        const response = await axios.post(`${BACKEND_URL}/api/admin/workshops`, dataToSend, { withCredentials: true });
        console.log('Create response:', response.data);
      }
      fetchData();
      closeModal();
    } catch (error) { 
      console.error('Workshop save error:', error.response?.data || error);
      alert('Failed to save workshop: ' + (error.response?.data?.detail || error.message)); 
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workshop?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/workshops/${id}`, { withCredentials: true });
      fetchData();
    } catch (error) { alert('Failed to delete'); }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ 
      title: '', description: '', date: '', time: '', duration: '2 hours', 
      instructor: '', instructor_title: '', thumbnail: '', 
      thumbnail_hero: '', thumbnail_card: '', thumbnail_recording: '',
      status: 'upcoming', 
      meeting_link: '', recording_url: '', video_url: '', topics: [], max_participants: 50,
      is_past: false, is_free: false
    });
  };

  const openEdit = (workshop) => {
    setEditingItem(workshop);
    setFormData({
      title: workshop.title || '',
      description: workshop.description || '',
      date: workshop.date || '',
      time: workshop.time || '',
      duration: workshop.duration || '2 hours',
      instructor: workshop.instructor || workshop.host || '',
      instructor_title: workshop.instructor_title || '',
      thumbnail: workshop.thumbnail || '',
      thumbnail_hero: workshop.thumbnail_hero || '',
      thumbnail_card: workshop.thumbnail_card || '',
      thumbnail_recording: workshop.thumbnail_recording || '',
      status: workshop.is_past || workshop.status === 'completed' ? 'completed' : (workshop.status || 'upcoming'),
      meeting_link: workshop.meeting_link || '',
      recording_url: workshop.recording_url || '',
      video_url: workshop.video_url || '',
      topics: workshop.topics || [],
      max_participants: workshop.max_participants || 50,
      is_past: workshop.is_past || false,
      is_free: workshop.is_free || false
    });
    setShowModal(true);
  };

  const handleWhatsAppBroadcast = async (workshop) => {
    if (!window.confirm(`Send WhatsApp broadcast about "${workshop.title}" to ALL users with phone numbers?`)) return;
    setBroadcastingWorkshopId(workshop.id);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/whatsapp-broadcast`,
        {},
        { withCredentials: true }
      );
      alert(`Broadcast complete!\n\nSent: ${res.data.sent}\nFailed: ${res.data.failed}\nTotal users: ${res.data.total_users}`);
    } catch (error) {
      alert('Failed to send broadcast: ' + (error.response?.data?.detail || error.message));
    } finally {
      setBroadcastingWorkshopId(null);
    }
  };

  const handleWhatsAppRegisterReminder = async (workshop) => {
    if (!window.confirm(`Send WhatsApp register reminder for "${workshop.title}" to users who haven't registered yet?`)) return;
    setSendingReminderId(workshop.id);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/whatsapp-register-reminder`,
        {},
        { withCredentials: true }
      );
      alert(`Reminder sent!\n\nSent: ${res.data.sent}\nFailed: ${res.data.failed}\nUnregistered users: ${res.data.total_unregistered}`);
    } catch (error) {
      alert('Failed to send reminder: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSendingReminderId(null);
    }
  };

  const handlePostWorkshopMessages = async (workshop) => {
    if (!workshop.registration_count || workshop.registration_count === 0) {
      alert('No registrations for this workshop yet.');
      return;
    }
    
    if (!window.confirm(
      `Send post-workshop thank you messages to ${workshop.registration_count} registered participant(s)?\n\n` +
      `This will:\n` +
      `✅ Send WhatsApp thank you message\n` +
      `✅ Update workshop_name attribute in WATI\n` +
      `✅ Trigger feedback flow (if automation set up in WATI)`
    )) return;
    
    setSendingPostWorkshopId(workshop.id);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/whatsapp-post-workshop`,
        {},
        { withCredentials: true }
      );
      alert(
        `✅ Post-workshop messages sent!\n\n` +
        `Sent: ${res.data.sent}\n` +
        `Failed: ${res.data.failed}\n` +
        `Total Registered: ${res.data.total_registered}\n` +
        `With Phone Numbers: ${res.data.total_with_phone}`
      );
    } catch (error) {
      alert('Failed to send post-workshop messages: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSendingPostWorkshopId(null);
    }
  };



  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="workshops-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Workshops Management</h2>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="add-workshop-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Workshop
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workshops.map((workshop) => (
          <div key={workshop.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden" data-testid={`workshop-card-${workshop.id}`}>
            <div className="h-40 bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center relative">
              {(workshop.thumbnail_card || workshop.thumbnail_recording || workshop.thumbnail) ? (
                <img src={workshop.thumbnail_card || workshop.thumbnail_recording || workshop.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <Calendar className="w-12 h-12 text-white/80" />
              )}
              {workshop.is_free && (
                <span className="absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full bg-green-500 text-white">Free</span>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-900">{workshop.title}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  workshop.status === 'completed' ? 'bg-green-100 text-green-700' :
                  workshop.status === 'live' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{workshop.status || 'upcoming'}</span>
              </div>
              <p className="text-sm text-slate-500 mb-3">{workshop.description?.substring(0, 80)}...</p>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{workshop.date}</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{workshop.time}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                <span className="flex items-center gap-1 text-xs text-slate-400" title="Workshop ID">
                  🆔 ID: <code className="bg-slate-100 px-1 rounded">{workshop.id}</code>
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                <span 
                  className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => fetchRegistrations(workshop)}
                  title="Click to view registrations"
                >
                  <Users className="w-4 h-4" />
                  {workshop.registration_count || 0}/{workshop.max_participants || 50} registered
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(workshop)} data-testid={`edit-workshop-${workshop.id}`}>
                  <Edit2 className="w-4 h-4 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(workshop.id)} data-testid={`delete-workshop-${workshop.id}`}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={() => handleWhatsAppBroadcast(workshop)}
                  disabled={broadcastingWorkshopId === workshop.id}
                  data-testid={`broadcast-workshop-${workshop.id}`}
                >
                  {broadcastingWorkshopId === workshop.id ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3 h-3 mr-1" /> WhatsApp Broadcast</>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleWhatsAppRegisterReminder(workshop)}
                  disabled={sendingReminderId === workshop.id}
                  data-testid={`reminder-workshop-${workshop.id}`}
                >
                  {sendingReminderId === workshop.id ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <><MessageSquare className="w-3 h-3 mr-1" /> Register Reminder</>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => handlePostWorkshopMessages(workshop)}
                  disabled={sendingPostWorkshopId === workshop.id}
                  data-testid={`post-workshop-${workshop.id}`}
                  title="Send thank you messages and update WATI attributes"
                >
                  {sendingPostWorkshopId === workshop.id ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3 h-3 mr-1" /> Post-Workshop Messages</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workshop Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Workshop' : 'Add New Workshop'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Title</label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} data-testid="workshop-title-input" /></div>
            <div><label className="text-sm font-medium">Description</label><textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} data-testid="workshop-desc-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Date</label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} data-testid="workshop-date-input" /></div>
              <div><label className="text-sm font-medium">Time</label><Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} data-testid="workshop-time-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Duration</label><Input value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} placeholder="e.g., 2 hours" data-testid="workshop-duration-input" /></div>
              <div><label className="text-sm font-medium">Max Participants</label><Input type="number" value={formData.max_participants} onChange={(e) => setFormData({...formData, max_participants: parseInt(e.target.value)})} data-testid="workshop-max-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Instructor Name</label><Input value={formData.instructor} onChange={(e) => setFormData({...formData, instructor: e.target.value})} placeholder="e.g., John Doe" data-testid="workshop-instructor-input" /></div>
              <div><label className="text-sm font-medium">Instructor Title</label><Input value={formData.instructor_title} onChange={(e) => setFormData({...formData, instructor_title: e.target.value})} placeholder="e.g., Ex-McKinsey" data-testid="workshop-instructor-title-input" /></div>
            </div>
            <div><label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger data-testid="workshop-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Meeting Link for Upcoming/Live workshops */}
            {(formData.status === 'upcoming' || formData.status === 'live') && (
              <div><label className="text-sm font-medium">Meeting Link (Zoom/Google Meet)</label><Input value={formData.meeting_link} onChange={(e) => setFormData({...formData, meeting_link: e.target.value})} placeholder="https://zoom.us/j/... or https://meet.google.com/..." data-testid="workshop-meeting-link-input" /></div>
            )}
            
            {/* Thumbnails Section with Aspect Ratio Guidance */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Workshop Thumbnails
              </h4>
              <p className="text-xs text-slate-500">Upload different thumbnails optimized for each display context. The system will automatically use the appropriate thumbnail based on where the workshop is displayed.</p>
              
              {/* Hero Thumbnail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Hero Thumbnail (Featured Workshop)</label>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">21:9 ratio · 2100×900px recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Used when workshop is the featured/first upcoming workshop in the hero section. Wide cinematic format.</p>
                {formData.thumbnail_hero && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail_hero} alt="Hero preview" className="w-full h-24 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail_hero: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Hero Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail_hero: url})} />
              </div>
              
              {/* Card Thumbnail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Card Thumbnail (Upcoming Cards)</label>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">16:9 ratio · 1280×720px recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Used in upcoming workshop cards. Standard video thumbnail format.</p>
                {formData.thumbnail_card && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail_card} alt="Card preview" className="w-full h-24 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail_card: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Card Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail_card: url})} />
              </div>
              
              {/* Recording Thumbnail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Recording Thumbnail (Past Workshops)</label>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">16:9 ratio · 1280×720px recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Used in past workshop recordings grid. Will be used automatically when status changes to "Completed".</p>
                {formData.thumbnail_recording && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail_recording} alt="Recording preview" className="w-full h-24 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail_recording: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Recording Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail_recording: url})} />
              </div>
              
              {/* Legacy Thumbnail (for backwards compatibility) */}
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-600">Legacy/Fallback Thumbnail</label>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">Optional · Used if specific thumbnails not set</span>
                </div>
                {formData.thumbnail && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail} alt="Legacy preview" className="w-full h-20 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Fallback Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail: url})} />
              </div>
            </div>
            
            {/* Recording URL/Upload for Completed workshops */}
            {formData.status === 'completed' && (
              <>
                <div><label className="text-sm font-medium">Recording URL</label><Input value={formData.video_url || formData.recording_url} onChange={(e) => setFormData({...formData, video_url: e.target.value, recording_url: e.target.value})} placeholder="YouTube or direct video URL" data-testid="workshop-recording-input" /></div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Or Upload Recording (supports large files)</label>
                  <ChunkedFileUpload 
                    category="recordings" 
                    accept="video/*" 
                    label="Upload Workshop Recording" 
                    onUpload={(url) => setFormData({...formData, video_url: url, recording_url: url})} 
                  />
                </div>
              </>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({...formData, is_free: e.target.checked})} className="rounded" data-testid="workshop-free-checkbox" /><span className="text-sm">Free Access</span></label>
            <DialogFooter><Button variant="outline" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} data-testid="save-workshop-btn">{editingItem ? 'Save Changes' : 'Add Workshop'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrations Modal */}
      <Dialog open={showRegistrationsModal} onOpenChange={setShowRegistrationsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workshop Registrations</DialogTitle>
            <DialogDescription>
              {selectedWorkshopForRegistrations?.title} - {registrations.length} registered
            </DialogDescription>
          </DialogHeader>
          
          {loadingRegistrations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No registrations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{reg.user_name}</p>
                    <p className="text-sm text-slate-500">{reg.user_email}</p>
                    <p className="text-xs text-slate-400">
                      Registered: {new Date(reg.registered_at).toLocaleString()}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveRegistration(reg.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleDownloadRegistrations}
                disabled={registrations.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
              <Button 
                variant="default"
                onClick={handleSendUpdatedInvites}
                disabled={registrations.length === 0 || sendingInvites || !selectedWorkshopForRegistrations?.meeting_link}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {sendingInvites ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendingInvites ? 'Sending...' : 'Send Updated Invites'}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowRegistrationsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default WorkshopsSection;
