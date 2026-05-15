import React, { useState } from 'react';
import { X, Send, CheckCircle, Loader2, Briefcase, User, Linkedin, Clock, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const BecomeCoachModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    consulting_company: '',
    last_position: '',
    years_in_consulting: '',
    why_mentor: '',
    mentoring_experience: '',
    linkedin_profile: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.consulting_company || !formData.last_position || 
        !formData.years_in_consulting || !formData.why_mentor || !formData.linkedin_profile) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/coach-applications/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to submit application');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      consulting_company: '',
      last_position: '',
      years_in_consulting: '',
      why_mentor: '',
      mentoring_experience: '',
      linkedin_profile: ''
    });
    setSubmitted(false);
    setError('');
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 mb-2">
              Application Submitted!
            </DialogTitle>
            <DialogDescription className="text-slate-600 mb-6">
              Thank you for your interest in becoming a coach! Our team will review your application and get back to you within 3-5 business days.
            </DialogDescription>
            <Button onClick={handleClose} className="bg-slate-900 hover:bg-slate-800">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
            Become a Coach
          </DialogTitle>
          <DialogDescription>
            Join our team of expert coaches and help aspiring consultants achieve their dreams. Fill out the form below to apply.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Consulting Company */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Consulting Company <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                name="consulting_company"
                value={formData.consulting_company}
                onChange={handleChange}
                placeholder="e.g., McKinsey, BCG, Bain, etc."
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Last Position */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Last Position <span className="text-red-500">*</span>
            </label>
            <Input
              name="last_position"
              value={formData.last_position}
              onChange={handleChange}
              placeholder="e.g., Associate, Consultant, Manager, etc."
              required
            />
          </div>

          {/* Years in Consulting */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Years in Consulting <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                name="years_in_consulting"
                value={formData.years_in_consulting}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select years of experience</option>
                <option value="1-2">1-2 years</option>
                <option value="2-3">2-3 years</option>
                <option value="3-5">3-5 years</option>
                <option value="5-7">5-7 years</option>
                <option value="7-10">7-10 years</option>
                <option value="10+">10+ years</option>
              </select>
            </div>
          </div>

          {/* Why Mentor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Why do you want to become a coach? <span className="text-red-500">*</span>
            </label>
            <textarea
              name="why_mentor"
              value={formData.why_mentor}
              onChange={handleChange}
              placeholder="Tell us about your motivation to mentor aspiring consultants..."
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-none"
              required
            />
          </div>

          {/* Mentoring Experience */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Do you have any experience in mentoring before?
            </label>
            <textarea
              name="mentoring_experience"
              value={formData.mentoring_experience}
              onChange={handleChange}
              placeholder="Describe any previous mentoring or coaching experience (optional)"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
            />
          </div>

          {/* LinkedIn Profile */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              LinkedIn Profile <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                name="linkedin_profile"
                value={formData.linkedin_profile}
                onChange={handleChange}
                placeholder="https://linkedin.com/in/your-profile"
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
              style={{ background: 'var(--gn-rhino)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Apply Now
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BecomeCoachModal;
