import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ChevronLeft, ChevronRight, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import CollegeAutocomplete from './CollegeAutocomplete';
import LocationAutocomplete from './LocationAutocomplete';
import { trackLead, getMetaHeaders, trackEvent } from '../utils/metaPixel';
import { trackGoogleAdsLead } from '../utils/googleAds';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Number of questions per form step
const QUESTIONS_PER_STEP = 3;

const DiscoveryCallModal = ({ isOpen, onClose, cohort = null }) => {
  const [step, setStep] = useState(2); // Skip calendar — start at form. step 2 = form, 3 = confirmation
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Calendar state (kept for legacy; not shown in new flow)
  const [settings, setSettings] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  
  // Form state
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [formStep, setFormStep] = useState(0); // Current form step (0-indexed)
  
  // Success state
  const [bookingId, setBookingId] = useState(null);

  // Calculate total form steps
  const totalFormSteps = Math.ceil(questions.length / QUESTIONS_PER_STEP);
  const isLastFormStep = formStep >= totalFormSteps - 1;
  const isConfirmationStep = step === 3;

  // Fetch settings and questions on mount
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchQuestions();
    }
  }, [isOpen]);

  // Fetch available slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/discovery-calls/settings`);
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/discovery-calls/questions`);
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
  };

  const fetchAvailableSlots = async (date) => {
    setSlotsLoading(true);
    try {
      // IMPORTANT: Don't use toISOString() as it converts to UTC and can shift the date
      // Instead, format the local date components directly
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      console.log('Fetching slots for date:', dateStr, '(from selected date:', date.toString(), ')');
      
      const res = await fetch(`${BACKEND_URL}/api/discovery-calls/available-slots?date=${dateStr}`);
      const data = await res.json();
      setAvailableSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleContinueToForm = () => {
    if (selectedDate && selectedTime) {
      setStep(2);
      setFormStep(0);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setFormErrors(prev => ({ ...prev, [questionId]: null }));
  };

  const handleMultiChoiceChange = (questionId, optionValue, checked) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, optionValue] };
      } else {
        return { ...prev, [questionId]: current.filter(v => v !== optionValue) };
      }
    });
  };

  // Get questions for current form step
  const getCurrentStepQuestions = () => {
    const startIndex = formStep * QUESTIONS_PER_STEP;
    const endIndex = startIndex + QUESTIONS_PER_STEP;
    return questions.slice(startIndex, endIndex);
  };

  // Validate current step's questions
  const validateCurrentStep = () => {
    const errors = {};
    const currentQuestions = getCurrentStepQuestions();
    
    currentQuestions.forEach(q => {
      const qId = q.id || q._id;
      const answer = answers[qId];
      
      if (q.required) {
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          errors[qId] = 'This field is required';
        }
      }
      
      // Email validation
      if (q.type === 'email' && answer) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(answer)) {
          errors[qId] = 'Please enter a valid email address';
        }
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextFormStep = () => {
    if (!validateCurrentStep()) {
      return;
    }

    // Validate scholarship question on last step (cohort only)
    if (cohort && isLastFormStep && !answers.__scholarship) {
      setFormErrors(prev => ({ ...prev, __scholarship: 'Please select an option' }));
      return;
    }
    
    if (isLastFormStep) {
      handleSubmit();
    } else {
      setFormStep(prev => prev + 1);
    }
  };

  const handlePrevFormStep = () => {
    if (formStep > 0) {
      setFormStep(prev => prev - 1);
    } else {
      // First chunk → close the modal (no calendar to go back to anymore)
      handleClose();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Always submit to the regular discovery-calls endpoint (full
      // questionnaire is captured in `answers`).
      const res = await fetch(`${BACKEND_URL}/api/discovery-calls/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
        credentials: 'include',
        body: JSON.stringify({ answers, cohort_id: cohort?.id || null, cohort_slug: cohort?.slug || null })
      });
      
      const resClone = res.clone();
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        const text = await resClone.text();
        console.error('Response parsing error:', text);
        throw new Error('Server error. Please try again.');
      }
      
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to submit discovery call request');
      }

      // NOTE: When the booking comes from a cohort landing page (cohort
      // prop is set), the backend `/api/discovery-calls/book` endpoint
      // automatically mirrors the booking to `cohort_discovery_calls` with
      // robust server-side phone extraction. We no longer make a separate
      // axios call here — that secondary path used to silently drop the
      // phone when the question text was renamed in admin settings.

      // Track Lead event with Meta Pixel + Google Ads
      trackLead({ content_name: 'discovery_call', content_category: 'booking' });
      trackGoogleAdsLead({ content_name: 'discovery_call', content_category: 'booking' });

      // Cohort-only: fire SubmitApplication on the cohort discovery call
      // submit. (Per Meta Pixel marketing spec — used for cohort-specific
      // remarketing & lookalike audiences. Do NOT fire for non-cohort calls.)
      if (cohort?.id || cohort?.slug) {
        trackEvent('SubmitApplication', {
          content_name: 'cohort_discovery_call',
          content_category: 'cohort',
          content_ids: [cohort?.id || cohort?.slug],
          cohort_name: cohort?.name || null,
          cohort_slug: cohort?.slug || null,
        });
      }
      
      setBookingId(data.booking_id);
      setStep(3);
    } catch (err) {
      console.error('Discovery call booking error:', err);
      setError(err.message || 'Failed to submit discovery call request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(2);
    setFormStep(0);
    setSelectedDate(null);
    setSelectedTime(null);
    setAnswers({});
    setFormErrors({});
    setError('');
    setBookingId(null);
    onClose();
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay };
  };

  const isDateAvailable = (date) => {
    if (!settings?.availability) return false;
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const dayConfig = settings.availability[dayName];
    
    if (!dayConfig?.enabled) return false;
    
    // Check if date is in the past or today (only allow from tomorrow)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date < tomorrow) return false;
    
    // Check max advance days
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (settings.max_advance_days || 30));
    if (date > maxDate) return false;
    
    return true;
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
    const days = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Day labels
    const labels = dayLabels.map(day => (
      <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
        {day}
      </div>
    ));
    
    // Empty cells for days before the first day
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isAvailable = isDateAvailable(date);
      const isSelected = selectedDate && 
        selectedDate.getDate() === day && 
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear();
      
      days.push(
        <button
          key={day}
          onClick={() => isAvailable && handleDateSelect(date)}
          disabled={!isAvailable}
          className="p-2 text-sm rounded-lg transition-all"
          style={
            isSelected 
              ? { backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }
              : isAvailable 
                ? { cursor: 'pointer' }
                : { color: '#cbd5e1', cursor: 'not-allowed' }
          }
          onMouseEnter={(e) => {
            if (isAvailable && !isSelected) {
              e.currentTarget.style.backgroundColor = 'var(--gn-chrome-lightest)';
            }
          }}
          onMouseLeave={(e) => {
            if (isAvailable && !isSelected) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {day}
        </button>
      );
    }
    
    return (
      <div>
        <div className="grid grid-cols-7 gap-1">{labels}</div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    );
  };

  // Check if question needs special autocomplete treatment
  const isLocationQuestion = (question) => {
    const text = question.question.toLowerCase();
    return text.includes('current location') || text.includes('where are you based');
  };

  const isUndergraduateQuestion = (question) => {
    const text = question.question.toLowerCase();
    return text.includes('undergraduate') || text.includes('undergrad') || text.includes('ug ');
  };

  const isPostgraduateQuestion = (question) => {
    const text = question.question.toLowerCase();
    return (text.includes('postgraduate') || text.includes('post-graduate') || text.includes('pg ') || text.includes('postgrad')) 
      && !text.includes('undergraduate');
  };

  const renderQuestion = (question) => {
    const qId = question.id || question._id;
    const error = formErrors[qId];
    
    // Special handling for location with autocomplete
    if (isLocationQuestion(question) && (question.type === 'short_text' || question.type === 'text')) {
      return (
        <div key={qId} className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <LocationAutocomplete
            value={answers[qId] || ''}
            onChange={(value) => handleAnswerChange(qId, value)}
            placeholder={question.placeholder || "Start typing your country..."}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    // Special handling for undergraduate university
    if (isUndergraduateQuestion(question) && (question.type === 'short_text' || question.type === 'text')) {
      return (
        <div key={qId} className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <CollegeAutocomplete
            value={answers[qId] || ''}
            onChange={(value) => handleAnswerChange(qId, value)}
            placeholder={question.placeholder || "Start typing to search colleges..."}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    // Special handling for postgraduate university
    if (isPostgraduateQuestion(question) && (question.type === 'short_text' || question.type === 'text')) {
      return (
        <div key={qId} className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            {question.question}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <CollegeAutocomplete
            value={answers[qId] || ''}
            onChange={(value) => handleAnswerChange(qId, value)}
            placeholder={question.placeholder || "Start typing to search colleges..."}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );
    }

    // Standard question rendering based on type
    switch (question.type) {
      case 'short_text':
      case 'email':
      case 'phone':
        return (
          <div key={qId} className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Input
              type={question.type === 'email' ? 'email' : 'text'}
              placeholder={question.placeholder}
              value={answers[qId] || ''}
              onChange={(e) => handleAnswerChange(qId, e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );
      
      case 'long_text':
        return (
          <div key={qId} className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Textarea
              placeholder={question.placeholder}
              value={answers[qId] || ''}
              onChange={(e) => handleAnswerChange(qId, e.target.value)}
              rows={4}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );
      
      case 'single_choice':
        return (
          <div key={qId} className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {question.options?.map(option => (
                <label key={option.id || option.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="radio"
                    name={qId}
                    value={option.value}
                    checked={answers[qId] === option.value}
                    onChange={() => handleAnswerChange(qId, option.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{option.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );
      
      case 'multiple_choice':
        return (
          <div key={qId} className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {question.options?.map(option => (
                <label key={option.id || option.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={(answers[qId] || []).includes(option.value)}
                    onChange={(e) => handleMultiChoiceChange(qId, option.value, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">{option.label}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );
      
      case 'dropdown':
        return (
          <div key={qId} className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={answers[qId] || ''}
              onChange={(e) => handleAnswerChange(qId, e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${error ? 'border-red-500' : 'border-slate-300'}`}
            >
              <option value="">Select an option</option>
              {question.options?.map(option => (
                <option key={option.id || option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
            {step === 2 && (totalFormSteps > 1
              ? `Tell Us About Yourself (${formStep + 1}/${totalFormSteps})`
              : cohort ? 'Apply for the Cohort' : 'Book a Free Discovery Call')}
            {step === 3 && (cohort ? 'Application Received!' : 'Request Received!')}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {step === 2 && (cohort
              ? 'Tell us about yourself so we can review your application.'
              : 'Tell us about yourself and our team will reach out shortly to schedule a time that works for you.'
            )}
            {step === 3 && (cohort
              ? 'Our team will review your application and get in touch shortly.'
              : 'Our team will be in touch with you shortly to schedule your discovery call.'
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Step 1: Calendar */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Calendar Grid */}
            <div className="border rounded-lg p-4">
              {renderCalendar()}
            </div>
            
            {/* Time Slots */}
            {selectedDate && (
              <div className="space-y-3">
                <h4 className="font-medium text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Available times for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  <span className="text-sm font-normal px-2 py-0.5 rounded" style={{ color: 'var(--gn-rhino)', backgroundColor: 'var(--gn-chrome-lightest)' }}>
                    IST (Indian Standard Time)
                  </span>
                </h4>
                
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--gn-chrome-yellow)' }} />
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map(time => (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        className="px-3 py-2 text-sm rounded-lg border transition-all"
                        style={selectedTime === time 
                          ? { backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)', borderColor: 'var(--gn-chrome-yellow)' }
                          : { borderColor: '#e2e8f0' }
                        }
                        onMouseEnter={(e) => {
                          if (selectedTime !== time) {
                            e.currentTarget.style.borderColor = 'var(--gn-chrome-light)';
                            e.currentTarget.style.backgroundColor = 'var(--gn-chrome-lightest)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTime !== time) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {time} IST
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No available slots for this date. Please select another date.
                  </p>
                )}
              </div>
            )}
            
            {/* Continue Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleContinueToForm}
                disabled={!selectedDate || !selectedTime}
                className="btn-primary"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 2: Form (in chunks) */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Intro card */}
            <div className="rounded-lg p-4 flex items-start gap-3" style={{ backgroundColor: 'var(--gn-chrome-lightest)' }}>
              <Calendar className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--gn-chrome-yellow)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>
                  {cohort ? 'Apply for the Cohort Program' : 'Free 15-minute discovery call'}
                </p>
                <p className="text-sm" style={{ color: 'var(--gn-grey-dark)' }}>
                  {cohort
                    ? 'Fill in a few details below and our team will review your application.'
                    : 'Share a few details and our team will reach out shortly to confirm a time that works for you.'
                  }
                </p>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalFormSteps }).map((_, idx) => (
                <div 
                  key={idx}
                  className="h-1.5 flex-1 rounded-full transition-colors"
                  style={{ backgroundColor: idx <= formStep ? 'var(--gn-chrome-yellow)' : '#e2e8f0' }}
                />
              ))}
            </div>
            
            {/* Form Questions (current chunk) */}
            <div className="space-y-5">
              {getCurrentStepQuestions().map(q => renderQuestion(q))}

              {/* Scholarship question — only on last form step for cohort applications */}
              {cohort && isLastFormStep && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <label className="block text-sm font-semibold text-slate-700">
                    Would you like to apply for a scholarship, or can you manage the fees on your own?
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: 'scholarship', label: 'I would like to apply for a scholarship' },
                      { value: 'self_funded', label: 'I can manage the fees on my own' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          answers.__scholarship === opt.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="scholarship_preference"
                          value={opt.value}
                          checked={answers.__scholarship === opt.value}
                          onChange={() => {
                            setAnswers(prev => ({ ...prev, __scholarship: opt.value }));
                            setFormErrors(prev => { const n = {...prev}; delete n.__scholarship; return n; });
                          }}
                          className="accent-blue-600"
                        />
                        <span className="text-sm text-slate-700">{opt.label}</span>
                      </label>
                    ))}
                    {formErrors.__scholarship && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.__scholarship}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={handlePrevFormStep}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNextFormStep}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : isLastFormStep ? (
                  <>
                    {cohort ? 'Submit Application' : 'Request to Book the Call'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-900">
                We Received Your Request!
              </h3>
              <p className="text-slate-600">
                Our team will reach out to you shortly to confirm a time that works for you. You will receive a confirmation email with the meeting details.
              </p>
            </div>

            <div className="pt-4">
              <Button onClick={handleClose} className="btn-primary">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DiscoveryCallModal;
