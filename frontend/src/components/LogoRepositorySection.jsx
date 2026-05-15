import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Upload, Search, Trash2, Plus, RefreshCw, Building2, 
  GraduationCap, Image as ImageIcon, X, Check, Edit2, Home
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const LogoRepositorySection = () => {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLogo, setEditingLogo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [togglingHomepage, setTogglingHomepage] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    category: 'company',
    show_on_homepage: false
  });

  const categories = [
    { value: 'company', label: 'Company', icon: Building2 },
    { value: 'consulting', label: 'Consulting Firm', icon: Building2 },
    { value: 'college', label: 'College/University', icon: GraduationCap },
  ];

  useEffect(() => {
    fetchLogos();
  }, []);

  const fetchLogos = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/admin/logos`, { withCredentials: true });
      setLogos(res.data.logos || []);
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 500KB for logos)
    if (file.size > 500 * 1024) {
      alert('Logo file size should be less than 500KB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, logo_url: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleAddLogo = async () => {
    if (!formData.name.trim() || !formData.logo_url) {
      alert('Please provide company name and logo');
      return;
    }

    setUploading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/logos`, {
        name: formData.name,
        logo_url: formData.logo_url,
        category: formData.category,
        show_on_homepage: formData.show_on_homepage
      }, { withCredentials: true });
      setShowAddModal(false);
      setFormData({ name: '', logo_url: '', category: 'company', show_on_homepage: false });
      fetchLogos();
    } catch (error) {
      console.error('Failed to add logo:', error);
      alert('Failed to add logo: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateLogo = async () => {
    if (!editingLogo) return;

    setUploading(true);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/logos/${editingLogo.id}`, {
        name: formData.name,
        logo_url: formData.logo_url,
        category: formData.category,
        show_on_homepage: formData.show_on_homepage
      }, { withCredentials: true });
      setShowEditModal(false);
      setEditingLogo(null);
      setFormData({ name: '', logo_url: '', category: 'company', show_on_homepage: false });
      fetchLogos();
    } catch (error) {
      console.error('Failed to update logo:', error);
      alert('Failed to update logo: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
    }
  };

  // Toggle homepage visibility directly from the card
  const handleToggleHomepage = async (logo) => {
    setTogglingHomepage(logo.id);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/logos/${logo.id}`, {
        show_on_homepage: !logo.show_on_homepage
      }, { withCredentials: true });
      fetchLogos();
    } catch (error) {
      console.error('Failed to toggle homepage visibility:', error);
      alert('Failed to update: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTogglingHomepage(null);
    }
  };

  const handleDeleteLogo = async (logoId) => {
    if (!window.confirm('Are you sure you want to delete this logo?')) return;

    setDeleting(logoId);
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/logos/${logoId}`, { withCredentials: true });
      fetchLogos();
    } catch (error) {
      console.error('Failed to delete logo:', error);
      alert('Failed to delete logo');
    } finally {
      setDeleting(null);
    }
  };

  const openEditModal = (logo) => {
    setEditingLogo(logo);
    setFormData({
      name: logo.name,
      logo_url: logo.logo_url,
      category: logo.category || 'company',
      show_on_homepage: logo.show_on_homepage || false
    });
    setShowEditModal(true);
  };

  // Filter logos
  const filteredLogos = logos.filter(logo => {
    const matchesSearch = logo.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || logo.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group logos by category for display
  const groupedLogos = {
    consulting: filteredLogos.filter(l => l.category === 'consulting'),
    company: filteredLogos.filter(l => l.category === 'company' || !l.category),
    college: filteredLogos.filter(l => l.category === 'college'),
  };

  // Count logos shown on homepage
  const homepageLogosCount = logos.filter(l => l.show_on_homepage).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Logo Repository</h2>
          <p className="text-sm text-slate-500">Manage company and institution logos for mentors and testimonials</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchLogos} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Logo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{logos.length}</p>
              <p className="text-sm text-slate-500">Total Logos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{groupedLogos.consulting.length}</p>
              <p className="text-sm text-slate-500">Consulting Firms</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{groupedLogos.company.length}</p>
              <p className="text-sm text-slate-500">Companies</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{groupedLogos.college.length}</p>
              <p className="text-sm text-slate-500">Colleges</p>
            </div>
          </div>
        </div>
        {/* Homepage Logos Count */}
        <div className="bg-white rounded-xl p-4 border border-green-200 bg-green-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Home className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{homepageLogosCount}</p>
              <p className="text-sm text-green-600">On Homepage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company name..."
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="consulting">Consulting Firms</SelectItem>
              <SelectItem value="company">Companies</SelectItem>
              <SelectItem value="college">Colleges</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logo Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-slate-500">Loading logos...</p>
          </div>
        ) : filteredLogos.length === 0 ? (
          <div className="p-12 text-center">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No logos found</p>
            <Button onClick={() => setShowAddModal(true)} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add First Logo
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredLogos.map((logo) => (
                <div
                  key={logo.id}
                  className={`group relative bg-slate-50 rounded-xl p-4 border transition-all ${
                    logo.show_on_homepage 
                      ? 'border-green-300 ring-2 ring-green-100' 
                      : 'border-slate-200 hover:border-blue-300'
                  } hover:shadow-md`}
                >
                  {/* Homepage Badge - Top Left */}
                  {logo.show_on_homepage && (
                    <div className="absolute -top-2 -left-2 z-10">
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs rounded-full shadow-sm">
                        <Home className="w-3 h-3" />
                        Homepage
                      </span>
                    </div>
                  )}

                  {/* Logo Image */}
                  <div className="aspect-square flex items-center justify-center mb-3 bg-white rounded-lg p-2">
                    <img
                      src={logo.logo_url}
                      alt={logo.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  
                  {/* Company Name */}
                  <p className="text-sm font-medium text-slate-900 text-center truncate" title={logo.name}>
                    {logo.name}
                  </p>
                  
                  {/* Category Badge */}
                  <div className="mt-2 flex justify-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      logo.category === 'consulting' ? 'bg-purple-100 text-purple-700' :
                      logo.category === 'college' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {logo.category === 'consulting' ? 'Consulting' :
                       logo.category === 'college' ? 'College' : 'Company'}
                    </span>
                  </div>

                  {/* Homepage Toggle - Always visible at bottom */}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => handleToggleHomepage(logo)}
                      disabled={togglingHomepage === logo.id}
                      className={`w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        logo.show_on_homepage
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {togglingHomepage === logo.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Home className="w-3 h-3" />
                          {logo.show_on_homepage ? 'Shown on Homepage' : 'Show on Homepage'}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Action Buttons - Show on hover */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(logo)}
                      className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 text-blue-600"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLogo(logo.id)}
                      disabled={deleting === logo.id}
                      className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 text-red-600"
                    >
                      {deleting === logo.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Logo Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Logo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company/Institution Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., McKinsey & Company"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo *</label>
              {formData.logo_url ? (
                <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <img
                    src={formData.logo_url}
                    alt="Preview"
                    className="max-h-24 mx-auto object-contain"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Click to upload logo</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 500KB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Show on Homepage Checkbox */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <input
                type="checkbox"
                id="show_on_homepage_add"
                checked={formData.show_on_homepage}
                onChange={(e) => setFormData({ ...formData, show_on_homepage: e.target.checked })}
                className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="show_on_homepage_add" className="flex items-center gap-2 text-sm font-medium text-green-700 cursor-pointer">
                <Home className="w-4 h-4" />
                Show on Homepage
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAddLogo} disabled={uploading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {uploading ? 'Adding...' : 'Add Logo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Logo Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Logo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company/Institution Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., McKinsey & Company"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo *</label>
              {formData.logo_url ? (
                <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <img
                    src={formData.logo_url}
                    alt="Preview"
                    className="max-h-24 mx-auto object-contain"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, logo_url: '' })}
                    className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Click to upload logo</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 500KB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Show on Homepage Checkbox */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <input
                type="checkbox"
                id="show_on_homepage_edit"
                checked={formData.show_on_homepage}
                onChange={(e) => setFormData({ ...formData, show_on_homepage: e.target.checked })}
                className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="show_on_homepage_edit" className="flex items-center gap-2 text-sm font-medium text-green-700 cursor-pointer">
                <Home className="w-4 h-4" />
                Show on Homepage
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdateLogo} disabled={uploading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {uploading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogoRepositorySection;
