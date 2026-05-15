import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Upload, Loader2,
  MessageSquare, Building2, GraduationCap, Image, Eye, EyeOff, Database
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import LogoRepository from './LogoRepository';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Handle persistent images from MongoDB (new format)
  if (url.startsWith('/api/images/')) {
    return `${BACKEND_URL}${url}`;
  }
  // If it's a relative path starting with /api/uploads, prepend backend URL
  if (url.startsWith('/api/uploads')) {
    return `${BACKEND_URL}${url}`;
  }
  // If it's old format /uploads (without /api), convert to new format
  if (url.startsWith('/uploads')) {
    return `${BACKEND_URL}/api${url}`;
  }
  return url;
};

const LANDING_PAGES = [
  { id: 'home', label: 'Home Page' },
  { id: 'coaching', label: 'Coaching Page' },
  { id: 'cohort', label: 'Cohort Page' },
];

// File Upload Component
const ImageUpload = ({ onUpload, currentImage, label = "Upload Image" }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'testimonials');
    formData.append('persist_to_db', 'true');  // Persist to MongoDB for production

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/upload`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      onUpload(res.data.url);
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
      <div className="flex items-center gap-3">
        {currentImage && (
          <img src={getImageUrl(currentImage)} alt="Preview" className="w-12 h-12 rounded-lg object-cover border" />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          {label}
        </Button>
      </div>
    </div>
  );
};

export const TestimonialsSection = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [plans, setPlans] = useState([]);
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLogoRepo, setShowLogoRepo] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    testimonial: '',
    company_joined: '',
    company_joined_logo: '',
    plan_subscribed: '',
    college: '',
    college_logo: '',
    current_company: '',
    current_company_logo: '',
    image_url: '',
    rating: 5,
    linkedin_url: '',
    show_on_pages: ['home'],
    is_active: true,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [testimonialsRes, plansRes, logosRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/testimonials`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/plans`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/logos`, { withCredentials: true }),
      ]);
      setTestimonials(testimonialsRes.data.testimonials || []);
      setPlans(plansRes.data.plans || []);
      setLogos(logosRes.data.logos || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLogosByCategory = (category) => {
    // Handle company categories - include consulting_firm, consulting, and company
    if (category === 'consulting_firm' || category === 'company') {
      return logos.filter(l => 
        l.category === 'consulting_firm' || 
        l.category === 'consulting' || 
        l.category === 'company'
      );
    }
    return logos.filter(l => l.category === category);
  };

  // Get logos for current/previous company - includes both consulting firms and regular companies
  const getCompanyLogos = () => {
    return logos.filter(l => 
      l.category === 'consulting_firm' || 
      l.category === 'consulting' || 
      l.category === 'company'
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      testimonial: '',
      company_joined: '',
      company_joined_logo: '',
      plan_subscribed: '',
      college: '',
      college_logo: '',
      current_company: '',
      current_company_logo: '',
      image_url: '',
      show_on_pages: ['home'],
      is_active: true,
    });
    setEditingTestimonial(null);
  };

  const handleOpenModal = (testimonial = null) => {
    if (testimonial) {
      setFormData({
        name: testimonial.name || '',
        testimonial: testimonial.testimonial || '',
        company_joined: testimonial.company_joined || '',
        company_joined_logo: testimonial.company_joined_logo || '',
        plan_subscribed: testimonial.plan_subscribed || '',
        college: testimonial.college || '',
        college_logo: testimonial.college_logo || '',
        current_company: testimonial.current_company || '',
        current_company_logo: testimonial.current_company_logo || '',
        image_url: testimonial.image_url || '',
        show_on_pages: testimonial.show_on_pages || ['home'],
        is_active: testimonial.is_active !== false,
      });
      setEditingTestimonial(testimonial);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.testimonial) {
      alert('Name and testimonial are required');
      return;
    }

    setSaving(true);
    try {
      if (editingTestimonial) {
        await axios.put(
          `${BACKEND_URL}/api/admin/testimonials/${editingTestimonial.id}`,
          formData,
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${BACKEND_URL}/api/admin/testimonials`,
          formData,
          { withCredentials: true }
        );
      }
      fetchAll();
      setShowModal(false);
      resetForm();
    } catch (error) {
      alert('Failed to save: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this testimonial?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/testimonials/${id}`, { withCredentials: true });
      fetchAll();
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.detail || error.message));
    }
  };

  const togglePage = (pageId) => {
    setFormData(prev => ({
      ...prev,
      show_on_pages: prev.show_on_pages.includes(pageId)
        ? prev.show_on_pages.filter(p => p !== pageId)
        : [...prev.show_on_pages, pageId]
    }));
  };

  const handleCompanySelect = (companyName) => {
    // Handle consulting_firm, consulting, and company categories
    const logo = logos.find(l => 
      l.name === companyName && 
      (l.category === 'consulting_firm' || l.category === 'consulting' || l.category === 'company')
    );
    setFormData(prev => ({
      ...prev,
      company_joined: companyName,
      company_joined_logo: logo?.logo_url || prev.company_joined_logo
    }));
  };

  const handleCollegeSelect = (collegeName) => {
    const logo = logos.find(l => l.name === collegeName && l.category === 'college');
    setFormData(prev => ({
      ...prev,
      college: collegeName,
      college_logo: logo?.logo_url || prev.college_logo
    }));
  };

  const handleCurrentCompanySelect = (companyName) => {
    // Search in consulting_firm, consulting, and company categories
    const logo = logos.find(l => 
      l.name === companyName && 
      (l.category === 'company' || l.category === 'consulting_firm' || l.category === 'consulting')
    );
    setFormData(prev => ({
      ...prev,
      current_company: companyName,
      current_company_logo: logo?.logo_url || prev.current_company_logo
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show Logo Repository if opened
  if (showLogoRepo) {
    return (
      <div>
        <Button 
          variant="ghost" 
          onClick={() => { setShowLogoRepo(false); fetchAll(); }}
          className="mb-4"
        >
          ← Back to Testimonials
        </Button>
        <LogoRepository />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Testimonials</h2>
          <p className="text-slate-500">Manage testimonials displayed on landing pages</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLogoRepo(true)}>
            <Database className="w-4 h-4 mr-2" />
            Logo Repository
          </Button>
          <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Testimonial
          </Button>
        </div>
      </div>

      {/* Testimonials Grid */}
      <div className="grid gap-4">
        {testimonials.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No testimonials yet. Add your first one!</p>
          </div>
        ) : (
          testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className={`bg-white rounded-xl border p-6 ${
                testimonial.is_active ? 'border-slate-200' : 'border-orange-200 bg-orange-50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  {testimonial.image_url ? (
                    <img
                      src={getImageUrl(testimonial.image_url)}
                      alt={testimonial.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-slate-100"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xl font-bold">
                      {testimonial.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        {testimonial.name}
                        {!testimonial.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-700 rounded">Hidden</span>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
                        {testimonial.company_joined && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            Joined {testimonial.company_joined}
                          </span>
                        )}
                        {testimonial.college && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" />
                            {testimonial.college}
                          </span>
                        )}
                        {testimonial.plan_subscribed && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {testimonial.plan_subscribed}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Company Logo */}
                    {testimonial.company_joined_logo && (
                      <img
                        src={getImageUrl(testimonial.company_joined_logo)}
                        alt={testimonial.company_joined}
                        className="h-8 object-contain"
                      />
                    )}
                  </div>

                  {/* Testimonial Text */}
                  <p className="mt-3 text-slate-600 line-clamp-3">"{testimonial.testimonial}"</p>

                  {/* Pages & Actions */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                      {testimonial.show_on_pages?.map(page => (
                        <span key={page} className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                          {page}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenModal(testimonial)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(testimonial.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTestimonial ? 'Edit Testimonial' : 'Add New Testimonial'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name & Image */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Profile Photo
                </label>
                <ImageUpload
                  currentImage={formData.image_url}
                  onUpload={(url) => setFormData({ ...formData, image_url: url })}
                  label="Upload Photo"
                />
              </div>
            </div>

            {/* Testimonial */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Testimonial <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={formData.testimonial}
                onChange={(e) => setFormData({ ...formData, testimonial: e.target.value })}
                placeholder="Share their experience..."
                rows={4}
              />
            </div>

            {/* Rating and LinkedIn URL */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rating (1-5)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={formData.rating || 5}
                  onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) || 5 })}
                  placeholder="5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  LinkedIn Profile URL
                </label>
                <Input
                  value={formData.linkedin_url || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>

            {/* Plan Subscribed - Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Plan Subscribed
              </label>
              <Select
                value={formData.plan_subscribed || "none"}
                onValueChange={(value) => setFormData({ ...formData, plan_subscribed: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No plan --</SelectItem>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Company Joined (Consulting Firm) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Company Joined (Consulting Firm)
              </label>
              {getLogosByCategory('consulting_firm').length > 0 ? (
                <Select
                  value={formData.company_joined || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData({ ...formData, company_joined: '', company_joined_logo: '' });
                    } else if (value === "custom") {
                      setFormData({ ...formData, company_joined: '', company_joined_logo: '' });
                    } else {
                      handleCompanySelect(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getLogosByCategory('consulting_firm').map(logo => (
                      <SelectItem key={logo.id} value={logo.name}>
                        <span className="flex items-center gap-2">
                          <img src={getImageUrl(logo.logo_url)} alt="" className="h-4 w-auto" />
                          {logo.name}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">+ Custom (type below)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  No consulting firms in repository. <button onClick={() => setShowLogoRepo(true)} className="underline">Add logos first</button>
                </p>
              )}
              {(formData.company_joined === '' || !getLogosByCategory('consulting_firm').find(l => l.name === formData.company_joined)) && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={formData.company_joined}
                    onChange={(e) => setFormData({ ...formData, company_joined: e.target.value })}
                    placeholder="Type company name..."
                  />
                  <Input
                    value={formData.company_joined_logo}
                    onChange={(e) => setFormData({ ...formData, company_joined_logo: e.target.value })}
                    placeholder="Logo URL (optional)"
                  />
                </div>
              )}
              {formData.company_joined_logo && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <img src={getImageUrl(formData.company_joined_logo)} alt="" className="h-6 object-contain" />
                  <span className="text-sm text-slate-600">{formData.company_joined}</span>
                </div>
              )}
            </div>

            {/* College/University */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                College/University
              </label>
              {getLogosByCategory('college').length > 0 ? (
                <Select
                  value={formData.college || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData({ ...formData, college: '', college_logo: '' });
                    } else if (value === "custom") {
                      setFormData({ ...formData, college: '', college_logo: '' });
                    } else {
                      handleCollegeSelect(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select college..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {getLogosByCategory('college').map(logo => (
                      <SelectItem key={logo.id} value={logo.name}>
                        <span className="flex items-center gap-2">
                          <img src={getImageUrl(logo.logo_url)} alt="" className="h-4 w-auto" />
                          {logo.name}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">+ Custom (type below)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  No colleges in repository. <button onClick={() => setShowLogoRepo(true)} className="underline">Add logos first</button>
                </p>
              )}
              {(formData.college === '' || !getLogosByCategory('college').find(l => l.name === formData.college)) && (
                <Input
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  placeholder="Type college name..."
                />
              )}
              {formData.college_logo && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <img src={getImageUrl(formData.college_logo)} alt="" className="h-6 object-contain" />
                  <span className="text-sm text-slate-600">{formData.college}</span>
                </div>
              )}
            </div>

            {/* Previous/Current Company */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Previous/Current Company
              </label>
              {getCompanyLogos().length > 0 ? (
                <Select
                  value={formData.current_company || "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData({ ...formData, current_company: '', current_company_logo: '' });
                    } else if (value === "custom") {
                      setFormData({ ...formData, current_company: '', current_company_logo: '' });
                    } else {
                      handleCurrentCompanySelect(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    
                    {/* Consulting Firms Section - handle both 'consulting_firm' and 'consulting' */}
                    {logos.filter(l => l.category === 'consulting_firm' || l.category === 'consulting').length > 0 && (
                      <>
                        <SelectItem value="consulting_header" disabled className="font-semibold text-slate-500 text-xs">
                          CONSULTING FIRMS
                        </SelectItem>
                        {logos.filter(l => l.category === 'consulting_firm' || l.category === 'consulting').map(logo => (
                          <SelectItem key={logo.id} value={logo.name}>
                            <span className="flex items-center gap-2">
                              <img src={getImageUrl(logo.logo_url)} alt="" className="h-4 w-auto" />
                              {logo.name}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    {/* Regular Companies Section */}
                    {logos.filter(l => l.category === 'company').length > 0 && (
                      <>
                        <SelectItem value="company_header" disabled className="font-semibold text-slate-500 text-xs">
                          COMPANIES
                        </SelectItem>
                        {logos.filter(l => l.category === 'company').map(logo => (
                          <SelectItem key={logo.id} value={logo.name}>
                            <span className="flex items-center gap-2">
                              <img src={getImageUrl(logo.logo_url)} alt="" className="h-4 w-auto" />
                              {logo.name}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    <SelectItem value="custom">+ Custom (type below)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  No companies in repository. <button onClick={() => setShowLogoRepo(true)} className="underline">Add logos first</button>
                </p>
              )}
              {(formData.current_company === '' || !getCompanyLogos().find(l => l.name === formData.current_company)) && (
                <Input
                  value={formData.current_company}
                  onChange={(e) => setFormData({ ...formData, current_company: e.target.value })}
                  placeholder="e.g., Google, Flipkart"
                />
              )}
              {formData.current_company_logo && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <img src={getImageUrl(formData.current_company_logo)} alt="" className="h-6 object-contain" />
                  <span className="text-sm text-slate-600">{formData.current_company}</span>
                </div>
              )}
            </div>

            {/* Show on Pages */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Display on Pages
              </label>
              <div className="flex gap-4">
                {LANDING_PAGES.map(page => (
                  <label key={page.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.show_on_pages.includes(page.id)}
                      onCheckedChange={() => togglePage(page.id)}
                    />
                    <span className="text-sm">{page.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Active Status */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <span className="text-sm font-medium">Active (visible on website)</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingTestimonial ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestimonialsSection;
