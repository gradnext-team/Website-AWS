import React, { useState } from 'react';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';
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
} from './ui/dialog';
import CollegeAutocomplete from './CollegeAutocomplete';
import { trackLead, getMetaHeaders } from '../utils/metaPixel';
import { trackGoogleAdsLead } from '../utils/googleAds';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ContactFormModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    college: '',
    query: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!formData.query.trim()) {
      errors.query = 'Please enter your query';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Include Meta cookies as headers for server-side deduplication
      const res = await fetch(`${BACKEND_URL}/api/contact/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getMetaHeaders() },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit form');
      }
      
      // Track Lead event with Meta Pixel
      trackLead({
        content_name: 'contact_form',
        content_category: 'contact'
      });
      // Track Lead event with Google Ads
      trackGoogleAdsLead({
        content_name: 'contact_form',
        content_category: 'contact'
      });
      
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      college: '',
      query: ''
    });
    setFormErrors({});
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
            {success ? 'Query Submitted!' : 'Contact Us'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {success 
              ? 'We have received your query and will get back to you soon.'
              : 'Have a question? Fill out the form below and we\'ll get back to you.'
            }
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-slate-600">
              Thank you for reaching out! Our team will respond to your query within 24-48 hours.
            </p>
            <Button onClick={handleClose} className="btn-primary">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={formErrors.email ? 'border-red-500' : ''}
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="+91 XXXXX XXXXX"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>College/University</Label>
              <CollegeAutocomplete
                value={formData.college}
                onChange={(value) => handleChange('college', value)}
                placeholder="Start typing to search colleges..."
              />
            </div>

            <div className="space-y-2">
              <Label>Your Query <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="How can we help you?"
                value={formData.query}
                onChange={(e) => handleChange('query', e.target.value)}
                rows={4}
                className={formErrors.query ? 'border-red-500' : ''}
              />
              {formErrors.query && <p className="text-xs text-red-500">{formErrors.query}</p>}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="btn-primary">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactFormModal;
