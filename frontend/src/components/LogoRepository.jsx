import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Upload, Loader2,
  Building2, GraduationCap, Briefcase, Image
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Handle persistent images from MongoDB
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

const CATEGORIES = [
  { id: 'consulting_firm', label: 'Consulting Firm', icon: Briefcase },
  { id: 'college', label: 'College/University', icon: GraduationCap },
  { id: 'company', label: 'Company', icon: Building2 },
];

export const LogoRepository = ({ onClose }) => {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLogo, setEditingLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    category: 'consulting_firm',
  });

  useEffect(() => {
    fetchLogos();
  }, []);

  const fetchLogos = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/logos`, { withCredentials: true });
      setLogos(res.data.logos || []);
    } catch (error) {
      console.error('Failed to fetch logos:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      logo_url: '',
      category: 'consulting_firm',
    });
    setEditingLogo(null);
  };

  const handleOpenModal = (logo = null) => {
    if (logo) {
      setFormData({
        name: logo.name || '',
        logo_url: logo.logo_url || '',
        category: logo.category || 'consulting_firm',
      });
      setEditingLogo(logo);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('category', 'logos');
    formDataUpload.append('persist_to_db', 'true');  // Persist to MongoDB for production

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/upload`, formDataUpload, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setFormData(prev => ({ ...prev, logo_url: res.data.url }));
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.logo_url) {
      alert('Name and logo are required');
      return;
    }

    setSaving(true);
    try {
      if (editingLogo) {
        await axios.put(
          `${BACKEND_URL}/api/admin/logos/${editingLogo.id}`,
          formData,
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${BACKEND_URL}/api/admin/logos`,
          formData,
          { withCredentials: true }
        );
      }
      fetchLogos();
      setShowModal(false);
      resetForm();
    } catch (error) {
      alert('Failed to save: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this logo?')) return;
    
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/logos/${id}`, { withCredentials: true });
      fetchLogos();
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.detail || error.message));
    }
  };

  const filteredLogos = activeCategory === 'all' 
    ? logos 
    : logos.filter(l => l.category === activeCategory);

  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat ? cat.icon : Building2;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Logo Repository</h2>
          <p className="text-slate-500">Manage logos for companies, colleges, and consulting firms</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Logo
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeCategory === 'all' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({logos.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = logos.filter(l => l.category === cat.id).length;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                activeCategory === cat.id 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Logos Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredLogos.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
            <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No logos yet. Add your first one!</p>
          </div>
        ) : (
          filteredLogos.map((logo) => {
            const Icon = getCategoryIcon(logo.category);
            return (
              <div
                key={logo.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow group"
              >
                <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center mb-3 p-4">
                  <img
                    src={getImageUrl(logo.logo_url)}
                    alt={logo.name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden items-center justify-center w-full h-full text-slate-400">
                    <Image className="w-8 h-8" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-900 text-sm truncate">{logo.name}</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mt-1">
                    <Icon className="w-3 h-3" />
                    {CATEGORIES.find(c => c.id === logo.category)?.label || logo.category}
                  </div>
                </div>
                <div className="flex justify-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(logo)}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(logo.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLogo ? 'Edit Logo' : 'Add New Logo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., McKinsey & Company"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <cat.icon className="w-4 h-4" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Logo <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="flex items-center gap-3">
                {formData.logo_url && (
                  <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center p-2 border">
                    <img 
                      src={getImageUrl(formData.logo_url)} 
                      alt="Preview" 
                      className="max-w-full max-h-full object-contain" 
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Logo
                  </Button>
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="Or paste URL..."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingLogo ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogoRepository;
