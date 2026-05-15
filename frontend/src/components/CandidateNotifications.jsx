import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { useDashboard } from './dashboard/DashboardLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CandidateNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNotification, setExpandedNotification] = useState(null);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [responseData, setResponseData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get refresh function from dashboard context
  const { refreshUnreadNotifications } = useDashboard();

  useEffect(() => {
    fetchNotifications();
    // Mark all notifications as read when page loads
    markAllAsRead();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/candidate/notifications`, {
        withCredentials: true
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/candidate/notifications/mark-all-read`,
        {},
        { withCredentials: true }
      );
      // Refresh navbar badge count after marking all as read
      if (refreshUnreadNotifications) {
        refreshUnreadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/candidate/notifications/${notificationId}/read`,
        {},
        { withCredentials: true }
      );
      fetchNotifications();
      // Refresh navbar badge count
      if (refreshUnreadNotifications) {
        refreshUnreadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const openResponseModal = (notification) => {
    setSelectedNotification(notification);
    setResponseData({});
    setResponseModalOpen(true);
    if (notification.status === 'pending') {
      markAsRead(notification.id);
    }
  };

  const handleResponseSubmit = async () => {
    if (!selectedNotification) return;

    // Validate required fields
    const formFields = selectedNotification.form_fields || [];
    const requiredFields = formFields.filter(f => f.required);
    
    for (const field of requiredFields) {
      if (!responseData[field.name] || responseData[field.name] === '') {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/candidate/notifications/${selectedNotification.id}/respond`,
        { response_data: responseData },
        { withCredentials: true }
      );
      
      setResponseModalOpen(false);
      setResponseData({});
      fetchNotifications();
      // Refresh navbar badge count
      if (refreshUnreadNotifications) {
        refreshUnreadNotifications();
      }
      alert('Response submitted successfully!');
    } catch (error) {
      console.error('Failed to submit response:', error);
      alert(error.response?.data?.detail || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
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

  const isDeadlinePassed = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const renderFormField = (field) => {
    const value = responseData[field.name] || '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => setResponseData(prev => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => setResponseData(prev => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setResponseData(prev => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setResponseData(prev => ({ ...prev, [field.name]: e.target.value }))}
          />
        );

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) => setResponseData(prev => ({ ...prev, [field.name]: val }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={(e) => setResponseData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'scale': {
        const options = field.options || [];
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {options.map((option) => {
                const selected = String(value) === String(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setResponseData(prev => ({ ...prev, [field.name]: option }))}
                    role="radio"
                    aria-checked={selected}
                    className={`min-w-[2.5rem] h-10 px-3 rounded-full border text-sm font-semibold transition-all ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {options.length > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500 px-1">
                <span>Low (1)</span>
                <span>High ({options[options.length - 1]})</span>
              </div>
            )}
          </div>
        );
      }

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => {
              const currentValue = Array.isArray(value) ? value : [];
              const isChecked = currentValue.includes(option);
              
              return (
                <label key={option} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setResponseData(prev => ({ 
                          ...prev, 
                          [field.name]: [...currentValue, option] 
                        }));
                      } else {
                        setResponseData(prev => ({ 
                          ...prev, 
                          [field.name]: currentValue.filter(v => v !== option) 
                        }));
                      }
                    }}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notifications
        </h2>
        <p className="text-slate-600">Stay updated with important announcements</p>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <Bell className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const isExpanded = expandedNotification === notif.id;
            const deadlinePassed = isDeadlinePassed(notif.deadline);
            const canRespond = notif.type === 'response_required' && notif.status !== 'responded' && !deadlinePassed;

            return (
              <div 
                key={notif.id} 
                className={`bg-white rounded-lg border-2 p-4 transition-all ${
                  notif.status === 'pending' 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {notif.status === 'pending' && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                          New
                        </span>
                      )}
                      {notif.type === 'response_required' && (
                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                          Response Required
                        </span>
                      )}
                      {notif.status === 'responded' && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      <h3 className="font-semibold text-slate-900">{notif.title}</h3>
                    </div>

                    <p className={`text-sm text-slate-700 ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(notif.created_at)}
                      </span>
                      {notif.deadline && (
                        <span className={`flex items-center gap-1 ${deadlinePassed ? 'text-red-600' : ''}`}>
                          <AlertCircle className="w-3 h-3" />
                          Deadline: {formatDate(notif.deadline)}
                        </span>
                      )}
                    </div>

                    {isExpanded && notif.type === 'response_required' && notif.form_fields && (
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm font-medium text-slate-700 mb-2">Response fields:</p>
                        <ul className="space-y-1">
                          {notif.form_fields.map((field) => (
                            <li key={field.name} className="text-sm text-slate-600">
                              • {field.label} {field.required && <span className="text-red-600">*</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 ml-4">
                    {canRespond && (
                      <Button 
                        size="sm"
                        onClick={() => openResponseModal(notif)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Respond
                      </Button>
                    )}
                    {notif.status === 'responded' && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Responded
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedNotification(isExpanded ? null : notif.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Response Modal */}
      <Dialog open={responseModalOpen} onOpenChange={setResponseModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title}</DialogTitle>
            <DialogDescription>
              Please fill in all required fields and submit your response
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-700 whitespace-pre-line">
                  {selectedNotification.message}
                </p>
              </div>

              {selectedNotification.form_fields?.map((field) => (
                <div key={field.name}>
                  <Label>
                    {field.label}
                    {field.required && <span className="text-red-600 ml-1">*</span>}
                  </Label>
                  <div className="mt-1">
                    {renderFormField(field)}
                  </div>
                </div>
              ))}

              {selectedNotification.deadline && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Deadline:</strong> {formatDate(selectedNotification.deadline)}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setResponseModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleResponseSubmit}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Response'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidateNotifications;
