import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, Plus, Send, Trash2, Eye, Users, Clock, CheckCircle, 
  AlertCircle, X, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CandidateNotificationsAdmin = () => {
  const [notifications, setNotifications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [viewResponses, setViewResponses] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    type: 'informational',
    title: '',
    message: '',
    target_categories: [], // Changed from target_type to array of categories
    target_candidate_ids: [],
    send_email: true,
    form_fields: [],
    deadline: '',
    popup_enabled: false,
    popup_max_views: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchCandidates();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/candidate-notifications`, {
        withCredentials: true
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/users?limit=1000`, {
        withCredentials: true
      });
      setCandidates(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    }
  };

  const fetchResponses = async (notificationId) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/admin/candidate-notifications/${notificationId}/responses`,
        { withCredentials: true }
      );
      setViewResponses(response.data);
    } catch (error) {
      console.error('Failed to fetch responses:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'informational',
      title: '',
      message: '',
      target_categories: [],
      target_candidate_ids: [],
      send_email: true,
      form_fields: [],
      deadline: '',
      popup_enabled: false,
      popup_max_views: 0
    });
  };

  const handleCreateNotification = async () => {
    if (!formData.title || !formData.message) {
      alert('Please fill in title and message');
      return;
    }

    if (formData.type === 'response_required' && formData.form_fields.length === 0) {
      alert('Please add at least one form field for response-required notifications');
      return;
    }

    if (formData.target_categories.length === 0 && formData.target_candidate_ids.length === 0) {
      alert('Please select at least one target category or specific candidates');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        deadline: formData.deadline || null
      };
      
      const response = await axios.post(`${BACKEND_URL}/api/admin/candidate-notifications`, payload, {
        withCredentials: true
      });
      
      setIsCreateOpen(false);
      resetForm();
      fetchNotifications();
      
      // Show success message
      const recipientCount = response.data?.total_recipients || 0;
      alert(`✅ Notification sent successfully to ${recipientCount} candidates!`);
    } catch (error) {
      console.error('Failed to create notification:', error);
      
      // Better error handling
      let errorMessage = 'Failed to create notification';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/candidate-notifications/${notificationId}`, {
        withCredentials: true
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const addFormField = () => {
    setFormData(prev => ({
      ...prev,
      form_fields: [
        ...prev.form_fields,
        { name: `field_${Date.now()}`, label: '', type: 'text', options: [], required: false }
      ]
    }));
  };

  const updateFormField = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      form_fields: prev.form_fields.map((f, i) => {
        if (i !== index) return f;
        const next = { ...f, [field]: value };
        // When switching to "scale", default to a 1-5 scale
        if (field === 'type' && value === 'scale' && (!Array.isArray(f.options) || f.options.length < 2)) {
          next.options = ['1', '2', '3', '4', '5'];
        }
        return next;
      })
    }));
  };

  // Helpers for the scale field type
  const getScaleMax = (field) => {
    const opts = Array.isArray(field?.options) ? field.options : [];
    return opts.length || 5;
  };

  const setScaleMax = (index, max) => {
    const safe = Math.max(2, Math.min(10, parseInt(max, 10) || 5));
    const opts = Array.from({ length: safe }, (_, i) => String(i + 1));
    updateFormField(index, 'options', opts);
  };

  const removeFormField = (index) => {
    setFormData(prev => ({
      ...prev,
      form_fields: prev.form_fields.filter((_, i) => i !== index)
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportResponses = () => {
    if (!viewResponses?.responses) return;
    
    const formFields = viewResponses?.notification?.form_fields || [];
    const fieldLabelMap = {};
    formFields.forEach(f => {
      fieldLabelMap[f.name] = f.label;
    });
    
    const fieldNames = Object.keys(viewResponses.responses[0]?.response_data || {});
    const fieldLabels = fieldNames.map(name => fieldLabelMap[name] || name);
    
    const headers = ['Candidate Name', 'Candidate Email', 'Status', 'Responded At', ...fieldLabels];
    const rows = viewResponses.responses.map(r => [
      r.candidate_name,
      r.candidate_email,
      r.status,
      formatDate(r.responded_at),
      ...fieldNames.map(name => {
        const value = r.response_data?.[name];
        return Array.isArray(value) ? value.join(', ') : (value || '');
      })
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidate_notification_responses_${viewResponses.notification?.id}.csv`;
    a.click();
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Candidate Notifications</h2>
          <p className="text-slate-600">Send notifications to candidates and collect responses</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Notification
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <Bell className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No notifications created yet</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div key={notif.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      notif.type === 'response_required' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {notif.type === 'response_required' ? 'Response Required' : 'Informational'}
                    </span>
                    <h3 className="font-semibold text-slate-900">{notif.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{notif.message}</p>
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {notif.total_recipients} recipients
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {notif.total_read || 0} read
                    </span>
                    {notif.type === 'response_required' && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        {notif.total_responded || 0} responded
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {notif.type === 'response_required' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchResponses(notif.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Responses
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteNotification(notif.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Notification Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Notification</DialogTitle>
            <DialogDescription>
              Send a notification to candidates via email and in-platform notification
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Notification Type */}
            <div>
              <Label>Notification Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informational">Informational (Read Only)</SelectItem>
                  <SelectItem value="response_required">Response Required (With Form)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label>Title *</Label>
              <Input
                className="mt-1"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter notification title"
              />
            </div>

            {/* Message */}
            <div>
              <Label>Message *</Label>
              <Textarea
                className="mt-1"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter notification message"
                rows={4}
              />
            </div>

            {/* Target Selection */}
            <div>
              <Label>Target Candidates</Label>
              <p className="text-xs text-slate-500 mt-1 mb-2">Select one or more categories</p>
              <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                <label className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                  <Checkbox
                    checked={formData.target_categories.includes('all')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: [...prev.target_categories, 'all'] 
                        }));
                      } else {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: prev.target_categories.filter(c => c !== 'all') 
                        }));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">All Candidates</span>
                    <p className="text-xs text-slate-500">Send to everyone</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                  <Checkbox
                    checked={formData.target_categories.includes('coaching')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: [...prev.target_categories, 'coaching'] 
                        }));
                      } else {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: prev.target_categories.filter(c => c !== 'coaching') 
                        }));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">All Coaching Candidates</span>
                    <p className="text-xs text-slate-500">Users who have booked coaching sessions</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                  <Checkbox
                    checked={formData.target_categories.includes('subscription')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: [...prev.target_categories, 'subscription'] 
                        }));
                      } else {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: prev.target_categories.filter(c => c !== 'subscription') 
                        }));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">All Subscription Candidates</span>
                    <p className="text-xs text-slate-500">Users with active paid subscriptions</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                  <Checkbox
                    checked={formData.target_categories.includes('free_trial')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: [...prev.target_categories, 'free_trial'] 
                        }));
                      } else {
                        setFormData(prev => ({ 
                          ...prev, 
                          target_categories: prev.target_categories.filter(c => c !== 'free_trial') 
                        }));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">All Free Trial Candidates</span>
                    <p className="text-xs text-slate-500">Users on free trial plan</p>
                  </div>
                </label>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                {formData.target_categories.length} category(ies) selected
              </p>
            </div>

            {/* Specific Candidate Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Or Select Specific Candidates (Optional)</Label>
                <span className="text-xs text-slate-500">
                  {formData.target_candidate_ids.length} selected
                </span>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                {candidates.map((candidate) => (
                  <label key={candidate.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <Checkbox
                      checked={formData.target_candidate_ids.includes(candidate.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({ 
                            ...prev, 
                            target_candidate_ids: [...prev.target_candidate_ids, candidate.id] 
                          }));
                        } else {
                          setFormData(prev => ({ 
                            ...prev, 
                            target_candidate_ids: prev.target_candidate_ids.filter(id => id !== candidate.id) 
                          }));
                        }
                      }}
                    />
                    <span className="text-sm">{candidate.name}</span>
                    <span className="text-xs text-slate-500">({candidate.email})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Deadline (for response_required) */}
            {formData.type === 'response_required' && (
              <div>
                <Label>Response Deadline</Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
            )}

            {/* Form Fields (for response_required) */}
            {formData.type === 'response_required' && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Form Fields</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFormField}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                </div>
                
                <div className="space-y-3 mt-2">
                  {formData.form_fields.map((field, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-slate-50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Field Label"
                            value={field.label}
                            onChange={(e) => updateFormField(index, 'label', e.target.value)}
                          />
                          <Select
                            value={field.type}
                            onValueChange={(value) => updateFormField(index, 'type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="textarea">Text Area</SelectItem>
                              <SelectItem value="select">Dropdown</SelectItem>
                              <SelectItem value="radio">Radio Buttons</SelectItem>
                              <SelectItem value="checkbox">Checkboxes</SelectItem>
                              <SelectItem value="scale">Scale (1–N)</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFormField(index)}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Options for select/radio/checkbox */}
                      {['select', 'radio', 'checkbox'].includes(field.type) && (
                        <Input
                          className="mt-2"
                          placeholder="Options (comma separated)"
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => updateFormField(index, 'options', e.target.value.split(',').map(o => o.trim()))}
                        />
                      )}

                      {/* Scale max for scale */}
                      {field.type === 'scale' && (
                        <div className="mt-2 flex items-center gap-2">
                          <Label className="text-xs text-slate-600 whitespace-nowrap">Scale</Label>
                          <span className="text-xs text-slate-500">1 to</span>
                          <Select
                            value={String(getScaleMax(field))}
                            onValueChange={(v) => setScaleMax(index, v)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="7">7</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-slate-500">
                            (candidate sees pill buttons 1 → {getScaleMax(field)})
                          </span>
                        </div>
                      )}
                      
                      <label className="flex items-center gap-2 mt-2">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(checked) => updateFormField(index, 'required', checked)}
                        />
                        <span className="text-sm text-slate-600">Required</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popup-on-dashboard option */}
            <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer" data-testid="popup-toggle-label">
                <Checkbox
                  data-testid="popup-enabled-checkbox"
                  checked={formData.popup_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    popup_enabled: !!checked,
                    popup_max_views: checked ? (prev.popup_max_views || 1) : 0
                  }))}
                />
                <span className="text-sm font-medium">Show as popup on dashboard</span>
              </label>
              <p className="text-xs text-slate-500">
                When enabled, the notification appears as a modal the moment a candidate lands on the dashboard.
                Capped at once per calendar day per user.
              </p>
              {formData.popup_enabled && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-600 whitespace-nowrap">Show this popup</Label>
                  <Input
                    data-testid="popup-max-views-input"
                    type="number"
                    min={1}
                    max={30}
                    className="w-20"
                    value={formData.popup_max_views || ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setFormData(prev => ({
                        ...prev,
                        popup_max_views: isNaN(v) ? 0 : Math.max(0, v)
                      }));
                    }}
                  />
                  <span className="text-xs text-slate-600">more times (blank/0 disables popup)</span>
                </div>
              )}
            </div>

            {/* Send Email */}
            <label className="flex items-center gap-2">
              <Checkbox
                checked={formData.send_email}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_email: checked }))}
              />
              <span className="text-sm">Send email notification</span>
            </label>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateNotification} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Notification'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Responses Modal */}
      <Dialog open={!!viewResponses} onOpenChange={() => setViewResponses(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewResponses?.notification?.title} - Responses</DialogTitle>
            <DialogDescription>
              {viewResponses?.responses?.length || 0} of {viewResponses?.notification?.total_recipients} candidates have responded
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={exportResponses}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>

            {/* Responses Table */}
            {viewResponses?.responses?.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 font-medium">Candidate</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Response</th>
                      <th className="text-left p-3 font-medium">Responded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewResponses.responses.map((resp) => {
                      const formFields = viewResponses?.notification?.form_fields || [];
                      const fieldLabelMap = {};
                      formFields.forEach(f => {
                        fieldLabelMap[f.name] = f.label;
                      });
                      
                      return (
                        <tr key={resp.id}>
                          <td className="p-3">
                            <div className="font-medium">{resp.candidate_name}</div>
                            <div className="text-xs text-slate-500">{resp.candidate_email}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              resp.status === 'responded' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {resp.status}
                            </span>
                          </td>
                          <td className="p-3">
                            {resp.response_data && (
                              <div className="space-y-1">
                                {Object.entries(resp.response_data).map(([key, value]) => {
                                  const label = fieldLabelMap[key] || key;
                                  const displayValue = Array.isArray(value) ? value.join(', ') : value;
                                  return (
                                    <div key={key} className="text-sm">
                                      <span className="font-medium text-slate-700">{label}:</span>{' '}
                                      <span className="text-slate-600">{displayValue}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-500">
                            {formatDate(resp.responded_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                No responses yet
              </div>
            )}

            {/* Pending Candidates */}
            {viewResponses?.pending_candidates?.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-slate-900 mb-2">
                  Pending Responses ({viewResponses.pending_candidates.length})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {viewResponses.pending_candidates.map((candidate) => (
                    <div key={candidate.id} className="text-sm p-2 bg-slate-50 rounded">
                      <span className="font-medium">{candidate.name}</span>
                      <span className="text-slate-500 ml-2">({candidate.email})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateNotificationsAdmin;
