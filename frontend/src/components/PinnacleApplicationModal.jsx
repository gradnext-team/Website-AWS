import React, { useState } from 'react';
import { X, Upload, Loader2, CheckCircle, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from './ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const PinnacleApplicationModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    undergrad_university: '',
    postgrad_university: '',
    has_interview: false,
    interview_company: '',
    interview_date: '',
    linkedin_url: '',
    cv_filename: '',
    reason_for_applying: ''
  });
  const [cvFile, setCvFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF or Word document');
        return;
      }
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setCvFile(file);
      setFormData(prev => ({ ...prev, cv_filename: file.name }));
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!formData.location.trim()) {
      setError('Please enter your location');
      return;
    }
    if (!formData.undergrad_university.trim()) {
      setError('Please enter your undergraduate university');
      return;
    }
    if (formData.has_interview && !formData.interview_company.trim()) {
      setError('Please enter the company name for your interview');
      return;
    }
    if (formData.has_interview && !formData.interview_date) {
      setError('Please enter your interview date');
      return;
    }
    if (!formData.linkedin_url.trim() && !cvFile) {
      setError('Please provide either your LinkedIn URL or upload your CV');
      return;
    }
    if (!formData.reason_for_applying.trim()) {
      setError('Please tell us why you want to apply to the Pinnacle Program');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create form data for file upload
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('email', formData.email);
      submitData.append('phone', formData.phone);
      submitData.append('location', formData.location);
      submitData.append('undergrad_university', formData.undergrad_university);
      submitData.append('postgrad_university', formData.postgrad_university || '');
      submitData.append('has_interview', formData.has_interview);
      submitData.append('interview_company', formData.interview_company || '');
      submitData.append('interview_date', formData.interview_date || '');
      submitData.append('linkedin_url', formData.linkedin_url || '');
      submitData.append('reason_for_applying', formData.reason_for_applying);
      
      if (cvFile) {
        submitData.append('cv_file', cvFile);
      }

      const response = await fetch(`${BACKEND_URL}/api/forms/pinnacle-application`, {
        method: 'POST',
        body: submitData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit application');
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          location: '',
          undergrad_university: '',
          postgrad_university: '',
          has_interview: false,
          interview_company: '',
          interview_date: '',
          linkedin_url: '',
          cv_filename: '',
          reason_for_applying: ''
        });
        setCvFile(null);
        setIsSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 rounded-t-2xl"
          style={{ backgroundColor: 'var(--gn-rhino)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Apply to Pinnacle Program</h2>
              <p className="text-sm text-white/70 mt-1">Our most comprehensive coaching program</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-light)' }}>
              <CheckCircle className="w-8 h-8" style={{ color: 'var(--gn-periwinkle)' }} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--gn-rhino)' }}>Application Submitted!</h3>
            <p className="text-slate-600">Thank you for applying to the Pinnacle Program. Our team will review your application and get back to you soon.</p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all"
                style={{ focusRing: 'var(--gn-periwinkle)' }}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your.email@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all"
                />
              </div>
            </div>

            {/* Phone and Location - Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Phone */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                  Location <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="City, Country"
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Undergrad University */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Undergraduate University <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="undergrad_university"
                value={formData.undergrad_university}
                onChange={handleInputChange}
                placeholder="e.g., IIT Delhi, SRCC, St. Xavier's"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all"
              />
            </div>

            {/* Postgrad University */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Post-graduate University <span className="text-slate-400 font-normal">(if applicable)</span>
              </label>
              <input
                type="text"
                name="postgrad_university"
                value={formData.postgrad_university}
                onChange={handleInputChange}
                placeholder="e.g., IIM Ahmedabad, ISB, XLRI"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all"
              />
            </div>

            {/* Interview Question */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="has_interview"
                  id="has_interview"
                  checked={formData.has_interview}
                  onChange={handleInputChange}
                  className="mt-1 w-5 h-5 rounded border-slate-300 cursor-pointer"
                  style={{ accentColor: 'var(--gn-periwinkle)' }}
                />
                <label htmlFor="has_interview" className="text-sm cursor-pointer" style={{ color: 'var(--gn-rhino)' }}>
                  <span className="font-medium">Do you have an upcoming interview scheduled?</span>
                </label>
              </div>

              {/* Conditional Interview Details */}
              {formData.has_interview && (
                <div className="mt-4 space-y-4 pl-8">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                      Which company? <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="interview_company"
                      value={formData.interview_company}
                      onChange={handleInputChange}
                      placeholder="e.g., McKinsey, BCG, Bain"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                      When is your interview? <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="interview_date"
                      value={formData.interview_date}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CV / LinkedIn */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Upload CV or LinkedIn Profile <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">Please provide at least one</p>
              
              {/* LinkedIn URL */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
                  <input
                    type="url"
                    name="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={handleInputChange}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all"
                  />
                </div>
              </div>

              {/* OR Divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs text-slate-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              {/* File Upload */}
              <div 
                className="relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-slate-400 transition-colors"
                style={{ borderColor: cvFile ? 'var(--gn-periwinkle)' : '#e2e8f0' }}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {cvFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--gn-rhino)' }}>{cvFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-600">
                      <span className="font-medium" style={{ color: 'var(--gn-periwinkle)' }}>Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PDF or Word (max 5MB)</p>
                  </>
                )}
              </div>
            </div>

            {/* Reason for Applying */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-rhino)' }}>
                Why do you want to apply to the Pinnacle Program? <span className="text-red-500">*</span>
              </label>
              <textarea
                name="reason_for_applying"
                value={formData.reason_for_applying}
                onChange={handleInputChange}
                placeholder="Tell us about your goals, background, and why you're interested in our Pinnacle Program..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 transition-all resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg font-semibold text-base transition-all"
              style={{ 
                backgroundColor: 'var(--gn-chrome-yellow)',
                color: 'var(--gn-rhino)'
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Application'
              )}
            </Button>

            <p className="text-xs text-center text-slate-500">
              By submitting, you agree to be contacted by our team regarding your application.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default PinnacleApplicationModal;
