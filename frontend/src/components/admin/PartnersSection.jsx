import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Key, Eye, EyeOff,
  Search, Loader2, AlertCircle, CheckCircle2, Copy,
  Building, Mail, Calendar, RefreshCw, UserCheck
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PartnersSection = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignMentorsModal, setShowAssignMentorsModal] = useState(false);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Selected partner
  const [selectedPartner, setSelectedPartner] = useState(null);
  
  // New API key (shown after create/regenerate)
  const [newApiKey, setNewApiKey] = useState(null);
  
  // Available mentors for assignment
  const [availableMentors, setAvailableMentors] = useState([]);
  const [mentorSearchTerm, setMentorSearchTerm] = useState('');
  
  // Partner bookings
  const [partnerBookings, setPartnerBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    notes: ''
  });
  
  const [saving, setSaving] = useState(false);
  
  // Fetch partners
  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/partners`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch partners');
      }
      const data = await response.json();
      setPartners(data.partners || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching partners:', err);
      setError('Failed to load partners');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch available mentors (including hidden and inactive)
  const fetchAvailableMentors = useCallback(async () => {
    try {
      // Fetch all mentors including hidden and inactive ones
      const response = await fetch(`${BACKEND_URL}/api/admin/partners/mentors/available?include_hidden=true&include_inactive=true`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch mentors');
      }
      const data = await response.json();
      setAvailableMentors(data.mentors || []);
    } catch (err) {
      console.error('Error fetching mentors:', err);
    }
  }, []);
  
  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);
  
  // Create partner
  const handleCreate = async () => {
    if (!formData.name || !formData.contact_email) {
      alert('Name and email are required');
      return;
    }
    
    try {
      setSaving(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/partners`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create partner');
      }
      
      // Show the API key
      setNewApiKey(data.api_key);
      setShowApiKeyModal(true);
      setShowCreateModal(false);
      
      // Reset form and refresh
      setFormData({ name: '', contact_email: '', notes: '' });
      fetchPartners();
    } catch (err) {
      console.error('Error creating partner:', err);
      alert(err.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };
  
  // Update partner
  const handleUpdate = async () => {
    if (!selectedPartner) return;
    
    try {
      setSaving(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/partners/${selectedPartner.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contact_email: formData.contact_email,
          notes: formData.notes
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update partner');
      }
      
      setShowEditModal(false);
      fetchPartners();
    } catch (err) {
      console.error('Error updating partner:', err);
      alert(err.message || 'Failed to update partner');
    } finally {
      setSaving(false);
    }
  };
  
  // Toggle partner status
  const handleToggleStatus = async (partner) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/partners/${partner.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !partner.is_active })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      fetchPartners();
    } catch (err) {
      console.error('Error toggling partner status:', err);
      alert('Failed to update partner status');
    }
  };
  
  // Regenerate API key
  const handleRegenerateKey = async (partner) => {
    if (!confirm(`Are you sure you want to regenerate the API key for ${partner.name}? The old key will be immediately invalidated.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/partners/${partner.id}/regenerate-key`, {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to regenerate key');
      }
      
      setNewApiKey(data.api_key);
      setShowApiKeyModal(true);
      fetchPartners();
    } catch (err) {
      console.error('Error regenerating key:', err);
      alert('Failed to regenerate API key');
    }
  };
  
  // Assign mentors
  const handleAssignMentors = async (mentorIds) => {
    if (!selectedPartner) return;
    
    try {
      setSaving(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/partners/${selectedPartner.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_mentor_ids: mentorIds })
      });
      
      if (!response.ok) {
        throw new Error('Failed to assign mentors');
      }
      
      setShowAssignMentorsModal(false);
      fetchPartners();
    } catch (err) {
      console.error('Error assigning mentors:', err);
      alert('Failed to assign mentors');
    } finally {
      setSaving(false);
    }
  };
  
  // Fetch partner bookings
  const fetchPartnerBookings = async (partnerId) => {
    try {
      setBookingsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/partners/${partnerId}/bookings`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      setPartnerBookings(data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setPartnerBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  };
  
  // Open edit modal
  const openEditModal = (partner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      contact_email: partner.contact_email,
      notes: partner.notes || ''
    });
    setShowEditModal(true);
  };
  
  // Open assign mentors modal
  const openAssignMentorsModal = (partner) => {
    setSelectedPartner(partner);
    setMentorSearchTerm('');
    fetchAvailableMentors();
    setShowAssignMentorsModal(true);
  };
  
  // Open bookings modal
  const openBookingsModal = (partner) => {
    setSelectedPartner(partner);
    fetchPartnerBookings(partner.id);
    setShowBookingsModal(true);
  };
  
  // Copy API key to clipboard
  const copyApiKey = () => {
    navigator.clipboard.writeText(newApiKey);
    alert('API key copied to clipboard!');
  };
  
  // Filter partners
  const filteredPartners = partners.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter mentors for assignment
  const filteredMentors = availableMentors.filter(m =>
    m.name?.toLowerCase().includes(mentorSearchTerm.toLowerCase()) ||
    m.consulting_firm?.toLowerCase().includes(mentorSearchTerm.toLowerCase())
  );

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
          <h2 className="text-2xl font-bold text-slate-900">Partner Integrations</h2>
          <p className="text-slate-500 mt-1">Manage partner institutes and their API access</p>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="/partner-api-tester" 
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
          >
            🧪 API Tester
          </a>
          <a 
            href="/PARTNER_API_DOCUMENTATION.pdf" 
            download="GradNext_Partner_API_Documentation.pdf"
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
          >
            📄 Download API Docs
          </a>
          <Button 
            onClick={() => {
              setFormData({ name: '', contact_email: '', notes: '' });
              setShowCreateModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search partners..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      
      {/* Partners List */}
      <div className="space-y-4">
        {filteredPartners.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Partners Yet</h3>
            <p className="text-slate-500 mb-4">Create your first partner integration to get started.</p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Partner
            </Button>
          </div>
        ) : (
          filteredPartners.map(partner => (
            <div 
              key={partner.id}
              className={`bg-white rounded-xl border ${partner.is_active ? 'border-slate-200' : 'border-red-200 bg-red-50/30'} p-6`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${partner.is_active ? 'bg-blue-100' : 'bg-red-100'}`}>
                    <Building className={`w-6 h-6 ${partner.is_active ? 'text-blue-600' : 'text-red-600'}`} />
                  </div>
                  
                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{partner.name}</h3>
                      {!partner.is_active && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      {partner.contact_email}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      API Key: {partner.api_key_prefix}...
                    </p>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{partner.assigned_mentors?.length || 0}</div>
                    <div className="text-slate-500">Mentors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{partner.total_bookings || 0}</div>
                    <div className="text-slate-500">Bookings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{partner.scheduled_bookings || 0}</div>
                    <div className="text-slate-500">Scheduled</div>
                  </div>
                </div>
              </div>
              
              {/* Assigned Mentors */}
              {partner.assigned_mentors?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">Assigned Mentors:</p>
                  <div className="flex flex-wrap gap-2">
                    {partner.assigned_mentors.map(mentor => (
                      <span key={mentor.id} className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded-full">
                        {mentor.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAssignMentorsModal(partner)}
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  Assign Mentors
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBookingsModal(partner)}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  View Bookings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(partner)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerateKey(partner)}
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Regenerate Key
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStatus(partner)}
                  className={partner.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
                >
                  {partner.is_active ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {partner.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Create Partner Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Partner</DialogTitle>
            <DialogDescription>
              Create a new partner integration. An API key will be generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Partner Name *</label>
              <Input
                placeholder="e.g., ABC Institute"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Contact Email *</label>
              <Input
                type="email"
                placeholder="admin@institute.edu"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
              <Textarea
                placeholder="Any additional notes about this partner..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Partner Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Partner Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Contact Email</label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Mentors Modal */}
      <Dialog open={showAssignMentorsModal} onOpenChange={setShowAssignMentorsModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Mentors to {selectedPartner?.name}</DialogTitle>
            <DialogDescription>
              Select which mentors this partner can access via their API.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex-1 overflow-hidden flex flex-col">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search mentors..."
                value={mentorSearchTerm}
                onChange={(e) => setMentorSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Mentors List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredMentors.map(mentor => {
                const isAssigned = selectedPartner?.assigned_mentor_ids?.includes(mentor.id);
                const isHidden = mentor.is_hidden;
                const isInactive = mentor.is_active === false;
                return (
                  <div 
                    key={mentor.id}
                    onClick={() => {
                      const currentIds = selectedPartner?.assigned_mentor_ids || [];
                      const newIds = isAssigned 
                        ? currentIds.filter(id => id !== mentor.id)
                        : [...currentIds, mentor.id];
                      setSelectedPartner(prev => ({ ...prev, assigned_mentor_ids: newIds }));
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                      isAssigned 
                        ? 'border-blue-500 bg-blue-50' 
                        : isInactive
                          ? 'border-red-200 hover:border-red-300 hover:bg-red-50/50'
                          : isHidden
                            ? 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      isAssigned ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                    }`}>
                      {isAssigned && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <img 
                      src={mentor.picture || '/default-avatar.png'} 
                      alt={mentor.name}
                      className={`w-10 h-10 rounded-full object-cover ${(isHidden || isInactive) ? 'opacity-70' : ''}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {mentor.name}
                        {isHidden && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                            Hidden
                          </span>
                        )}
                        {isInactive && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        {mentor.title} {mentor.consulting_firm && `• ${mentor.consulting_firm}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Selected count */}
            <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-500">
              {selectedPartner?.assigned_mentor_ids?.length || 0} mentors selected
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignMentorsModal(false)}>Cancel</Button>
            <Button 
              onClick={() => handleAssignMentors(selectedPartner?.assigned_mentor_ids || [])} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bookings Modal */}
      <Dialog open={showBookingsModal} onOpenChange={setShowBookingsModal}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bookings - {selectedPartner?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {bookingsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : partnerBookings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                No bookings yet
              </div>
            ) : (
              <div className="space-y-3">
                {partnerBookings.map(booking => (
                  <div 
                    key={booking.id}
                    className="bg-slate-50 rounded-lg p-4 border border-slate-200"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-slate-900">{booking.candidate_name}</div>
                        <div className="text-sm text-slate-500">{booking.candidate_email}</div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        booking.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                        booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {booking.date} at {booking.time_slot}
                      </span>
                      <span>{booking.duration_minutes} min</span>
                      <span className="capitalize">{booking.session_type?.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Mentor: {booking.mentor_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookingsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* API Key Display Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              API Key Generated
            </DialogTitle>
            <DialogDescription>
              <span className="text-amber-600 font-medium">⚠️ Important:</span> Save this API key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 break-all">
              {newApiKey}
            </div>
            <Button 
              onClick={copyApiKey}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowApiKeyModal(false);
              setNewApiKey(null);
            }}>
              I've Saved the Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnersSection;
