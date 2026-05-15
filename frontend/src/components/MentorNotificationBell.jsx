import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, X, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const MentorNotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingResponseCount, setPendingResponseCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [responseData, setResponseData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentor-dashboard/notifications/unread-count`, {
        withCredentials: true
      });
      setUnreadCount(response.data.unread_count || 0);
      setPendingResponseCount(response.data.pending_response_count || 0);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/mentor-dashboard/notifications`, {
        withCredentials: true
      });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
      setPendingResponseCount(response.data.pending_response_count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleBellClick = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/mentor-dashboard/notifications/${notificationId}/read`, {}, {
        withCredentials: true
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const openNotification = (notification) => {
    setSelectedNotification(notification);
    setResponseData({});
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
  };

  const handleFieldChange = (fieldName, value) => {
    setResponseData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleCheckboxChange = (fieldName, option, checked) => {
    setResponseData(prev => {
      const current = prev[fieldName] || [];
      if (checked) {
        return { ...prev, [fieldName]: [...current, option] };
      } else {
        return { ...prev, [fieldName]: current.filter(v => v !== option) };
      }
    });
  };

  const submitResponse = async () => {
    if (!selectedNotification) return;
    
    setIsSubmitting(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/mentor-dashboard/notifications/${selectedNotification.id}/respond`,
        { response_data: responseData },
        { withCredentials: true }
      );
      setSelectedNotification(null);
      fetchNotifications();
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

  const totalBadge = unreadCount + pendingResponseCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={handleBellClick}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5" />
        {totalBadge > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[500px] overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            {pendingResponseCount > 0 && (
              <p className="text-sm text-orange-600 mt-1">
                {pendingResponseCount} notification{pendingResponseCount > 1 ? 's' : ''} require your response
              </p>
            )}
          </div>

          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => openNotification(notif)}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                    !notif.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-1.5 rounded-full ${
                      notif.type === 'response_required' 
                        ? notif.is_responded ? 'bg-green-100' : 'bg-orange-100'
                        : notif.is_read ? 'bg-slate-100' : 'bg-blue-100'
                    }`}>
                      {notif.type === 'response_required' ? (
                        notif.is_responded ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                        )
                      ) : (
                        <Bell className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                          {notif.title}
                        </p>
                        {notif.type === 'response_required' && !notif.is_responded && !notif.is_expired && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                            Response needed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{formatDate(notif.created_at)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title}</DialogTitle>
            <DialogDescription>
              {formatDate(selectedNotification?.created_at)}
              {selectedNotification?.deadline && (
                <span className="ml-2 text-orange-600">
                  • Deadline: {formatDate(selectedNotification?.deadline)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="prose prose-sm max-w-none whitespace-pre-line text-slate-700">
              {selectedNotification?.message}
            </div>

            {/* Response Form */}
            {selectedNotification?.type === 'response_required' && !selectedNotification?.is_responded && !selectedNotification?.is_expired && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="font-medium text-slate-900 mb-4">Your Response</h4>
                <div className="space-y-4">
                  {selectedNotification?.form_fields?.map((field) => (
                    <div key={field.name}>
                      <Label className="text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      
                      {field.type === 'text' && (
                        <Input
                          className="mt-1"
                          value={responseData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      )}
                      
                      {field.type === 'textarea' && (
                        <Textarea
                          className="mt-1"
                          value={responseData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                          rows={3}
                        />
                      )}
                      
                      {field.type === 'select' && (
                        <Select
                          value={responseData[field.name] || ''}
                          onValueChange={(value) => handleFieldChange(field.name, value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {field.type === 'radio' && (
                        <div className="mt-2 space-y-2">
                          {field.options?.map((option) => (
                            <label key={option} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={field.name}
                                value={option}
                                checked={responseData[field.name] === option}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-slate-700">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === 'scale' && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex flex-wrap gap-2" role="radiogroup">
                            {field.options?.map((option) => {
                              const selected = String(responseData[field.name]) === String(option);
                              return (
                                <button
                                  type="button"
                                  key={option}
                                  onClick={() => handleFieldChange(field.name, option)}
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
                          {(field.options || []).length > 0 && (
                            <div className="flex justify-between text-[11px] text-slate-500 px-1">
                              <span>Low (1)</span>
                              <span>High ({field.options[field.options.length - 1]})</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {field.type === 'checkbox' && (
                        <div className="mt-2 space-y-2">
                          {field.options?.map((option) => (
                            <label key={option} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={(responseData[field.name] || []).includes(option)}
                                onCheckedChange={(checked) => handleCheckboxChange(field.name, option, checked)}
                              />
                              <span className="text-sm text-slate-700">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      
                      {field.type === 'number' && (
                        <Input
                          type="number"
                          className="mt-1"
                          value={responseData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      )}
                      
                      {field.type === 'date' && (
                        <Input
                          type="date"
                          className="mt-1"
                          value={responseData[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  onClick={submitResponse}
                  disabled={isSubmitting}
                  className="w-full mt-6"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Response'}
                </Button>
              </div>
            )}

            {/* Already Responded */}
            {selectedNotification?.is_responded && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 text-green-600 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">You have already responded</span>
                </div>
                {selectedNotification?.my_response && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">Your Response:</h5>
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(selectedNotification.my_response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Expired */}
            {selectedNotification?.is_expired && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Response deadline has passed</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MentorNotificationBell;
