import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Upload, Eye, EyeOff, Clock,
  DollarSign, Star, Loader2, Video, Calendar, FileText,
  Play, Pause, UserX, ExternalLink, CheckCircle2, Search, PlayCircle, RefreshCw,
  Users, Mail, Phone, MapPin, FolderOpen, Download, FileSpreadsheet,
  XCircle, ChevronLeft, ChevronRight, Ban, MessageSquare, ImageIcon, Send,
  GripVertical, Activity, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Import new enhanced components
import { WeeklyAvailabilitySelector } from './TimeSlotPicker';
import { ChunkedFileUpload, SimpleFileUpload } from './ChunkedFileUpload';
import { istToViewer, format12hWithAbbr, getTimezoneAbbr } from '../utils/timezone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Re-export enhanced availability selector
export const AvailabilitySelector = WeeklyAvailabilitySelector;

// Re-export file upload components
export const FileUpload = SimpleFileUpload;
export { ChunkedFileUpload };

// ============ Videos Section with Chunked File Upload ============
export const VideosSection = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', module: 'Case Fundamentals', duration: '', video_url: '', thumbnail: '', order: 0, is_free: false
  });

  const modules = ['Case Fundamentals', 'Market Sizing', 'Profitability', 'M&A', 'Pricing', 'Growth Strategy', 'Operations', 'Getting Started'];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/videos`, { withCredentials: true });
      setVideos(res.data.videos);
    } catch (error) { console.error('Failed to fetch:', error); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await axios.put(`${BACKEND_URL}/api/admin/videos/${editingItem.id}`, formData, { withCredentials: true });
      } else {
        await axios.post(`${BACKEND_URL}/api/admin/videos`, formData, { withCredentials: true });
      }
      fetchData();
      closeModal();
    } catch (error) { alert('Failed to save'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this video?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/videos/${id}`, { withCredentials: true });
      fetchData();
    } catch (error) { alert('Failed to delete'); }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ title: '', description: '', module: 'Case Fundamentals', duration: '', video_url: '', thumbnail: '', order: 0, is_free: false });
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="videos-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Recorded Videos</h2>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="add-video-btn"><Plus className="w-4 h-4 mr-2" /> Add Video</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Video</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Module</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Access</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {videos.map((video) => (
              <tr key={video.id} className="hover:bg-slate-50" data-testid={`video-row-${video.id}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-10 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                      {video.thumbnail ? <img src={video.thumbnail} alt="" className="w-full h-full object-cover" /> : <Video className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{video.title}</p>
                      <p className="text-xs text-slate-500">{video.description?.substring(0, 50)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{video.module}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{video.duration}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${video.is_free ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{video.is_free ? 'Free' : 'Premium'}</span></td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(video)} data-testid={`edit-video-${video.id}`}><Edit2 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(video.id)} data-testid={`delete-video-${video.id}`}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Video' : 'Add New Video'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-slate-700">Title</label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} data-testid="video-title-input" /></div>
            <div><label className="text-sm font-medium text-slate-700">Description</label><textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} data-testid="video-description-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-slate-700">Module</label>
                <Select value={formData.module} onValueChange={(v) => setFormData({ ...formData, module: v })}>
                  <SelectTrigger data-testid="video-module-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium text-slate-700">Duration</label><Input placeholder="e.g., 15:30" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} data-testid="video-duration-input" /></div>
            </div>
            <div><label className="text-sm font-medium text-slate-700">Video URL</label><Input placeholder="YouTube or direct URL" value={formData.video_url} onChange={(e) => setFormData({ ...formData, video_url: e.target.value })} data-testid="video-url-input" /></div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Or Upload Video (supports large files up to 2GB+)</label>
              <ChunkedFileUpload 
                category="videos" 
                accept="video/*" 
                label="Upload Video File" 
                onUpload={(url) => setFormData({ ...formData, video_url: url })} 
              />
            </div>
            <div><label className="text-sm font-medium text-slate-700">Thumbnail URL</label><Input placeholder="Image URL" value={formData.thumbnail} onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })} data-testid="video-thumbnail-input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-2 block">Or Upload Thumbnail</label><FileUpload category="thumbnails" accept="image/*" label="Upload Thumbnail" onUpload={(url) => setFormData({ ...formData, thumbnail: url })} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })} className="rounded" data-testid="video-free-checkbox" /><span className="text-sm">Free access</span></label>
            <DialogFooter><Button variant="outline" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} data-testid="save-video-btn">{editingItem ? 'Save Changes' : 'Add Video'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Drills Section with Quiz Builder ============
export const DrillsSection = () => {
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    title: '', category: 'Market Sizing', difficulty: 'intermediate', description: '', time_limit: '15 min', questions: [], tags: [], is_free: false
  });

  const categories = ['Market Sizing', 'Profitability', 'M&A', 'Pricing', 'Growth Strategy', 'Brain Teaser', 'Math'];
  const difficulties = ['beginner', 'intermediate', 'advanced'];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/drills`, { withCredentials: true });
      setDrills(res.data.drills);
    } catch (error) { console.error('Failed to fetch:', error); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await axios.put(`${BACKEND_URL}/api/admin/drills/${editingItem.id}`, formData, { withCredentials: true });
      } else {
        await axios.post(`${BACKEND_URL}/api/admin/drills`, formData, { withCredentials: true });
      }
      fetchData();
      closeModal();
    } catch (error) { alert('Failed to save'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this drill?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/drills/${id}`, { withCredentials: true });
      fetchData();
    } catch (error) { alert('Failed to delete'); }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ title: '', category: 'Market Sizing', difficulty: 'intermediate', description: '', time_limit: '15 min', questions: [], tags: [], is_free: false });
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item, questions: item.questions || [] });
    setShowModal(true);
  };

  // Question management
  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [...formData.questions, { question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }]
    });
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: newQuestions });
  };

  const difficultyColors = { beginner: 'bg-green-100 text-green-700', intermediate: 'bg-amber-100 text-amber-700', advanced: 'bg-rose-100 text-rose-700' };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Case Drills</h2>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Add Drill</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Difficulty</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Questions</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drills.map((drill) => (
              <tr key={drill.id} className="hover:bg-slate-50">
                <td className="px-6 py-4"><p className="font-medium text-slate-900">{drill.title}</p></td>
                <td className="px-6 py-4 text-sm text-slate-600">{drill.category}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${difficultyColors[drill.difficulty]}`}>{drill.difficulty}</span></td>
                <td className="px-6 py-4 text-sm text-slate-600">{drill.questions?.length || 0} questions</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(drill)}><Edit2 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(drill.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Drill' : 'Create New Drill'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Drill Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={2} placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-4">
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
                <SelectContent>{difficulties.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Time (e.g., 15 min)" value={formData.time_limit} onChange={(e) => setFormData({ ...formData, time_limit: e.target.value })} />
            </div>
            <Input placeholder="Tags (comma separated)" value={formData.tags?.join(', ')} onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(s => s.trim()) })} />

            {/* Quiz Builder */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Questions ({formData.questions.length})</h4>
                <Button size="sm" onClick={addQuestion}><Plus className="w-4 h-4 mr-1" /> Add Question</Button>
              </div>
              <div className="space-y-4">
                {formData.questions.map((q, qIndex) => (
                  <div key={qIndex} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-slate-500">Question {qIndex + 1}</span>
                      <Button size="sm" variant="ghost" onClick={() => removeQuestion(qIndex)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                    <Input placeholder="Question text" value={q.question} onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)} className="mb-3" />
                    <div className="space-y-2 mb-3">
                      {q.options.map((opt, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${qIndex}`} checked={q.correct_index === oIndex} onChange={() => updateQuestion(qIndex, 'correct_index', oIndex)} className="text-blue-600" />
                          <Input placeholder={`Option ${oIndex + 1}`} value={opt} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} className={q.correct_index === oIndex ? 'border-green-500 bg-green-50' : ''} />
                          {q.correct_index === oIndex && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        </div>
                      ))}
                    </div>
                    <Input placeholder="Explanation (shown after answer)" value={q.explanation || ''} onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })} className="rounded" /><span className="text-sm">Free Access</span></label>
            <DialogFooter><Button variant="outline" onClick={closeModal}>Cancel</Button><Button onClick={handleSave}>Save Drill</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Materials Section with Chunked File Upload ============
export const MaterialsSection = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ title: '', category: 'Framework', description: '', file_type: 'pdf', file_url: '', is_free: false });

  const categories = ['Framework', 'Industry Primer', 'Case Bank', 'Cheat Sheet', 'Template'];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/materials`, { withCredentials: true });
      setMaterials(res.data.materials);
    } catch (error) { console.error('Failed to fetch:', error); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await axios.put(`${BACKEND_URL}/api/admin/materials/${editingItem.id}`, formData, { withCredentials: true });
      } else {
        await axios.post(`${BACKEND_URL}/api/admin/materials`, formData, { withCredentials: true });
      }
      fetchData();
      setShowModal(false);
      setEditingItem(null);
    } catch (error) { alert('Failed to save'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try { await axios.delete(`${BACKEND_URL}/api/admin/materials/${id}`, { withCredentials: true }); fetchData(); }
    catch (error) { alert('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="materials-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Interview Materials</h2>
        <Button onClick={() => { setFormData({ title: '', category: 'Framework', description: '', file_type: 'pdf', file_url: '', is_free: false }); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700" data-testid="add-material-btn"><Plus className="w-4 h-4 mr-2" /> Add Material</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {materials.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-100 p-4" data-testid={`material-card-${item.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-lg"><FileText className="w-6 h-6 text-blue-600" /></div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${item.is_free ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{item.is_free ? 'Free' : 'Premium'}</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
            <p className="text-sm text-slate-500 mb-3">{item.category} • {item.file_type?.toUpperCase()}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditingItem(item); setFormData(item); setShowModal(true); }} data-testid={`edit-material-${item.id}`}><Edit2 className="w-4 h-4 mr-1" /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} data-testid={`delete-material-${item.id}`}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); setEditingItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Material' : 'Add Material'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} data-testid="material-title-input" />
            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={2} placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} data-testid="material-description-input" />
            <div className="grid grid-cols-2 gap-4">
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger data-testid="material-category-select"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={formData.file_type} onValueChange={(v) => setFormData({ ...formData, file_type: v })}>
                <SelectTrigger data-testid="material-type-select"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="doc">DOC</SelectItem>
                  <SelectItem value="ppt">PPT</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="File URL" value={formData.file_url} onChange={(e) => setFormData({ ...formData, file_url: e.target.value })} data-testid="material-url-input" />
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Upload from Computer (supports large files)</label>
              <ChunkedFileUpload 
                category="materials" 
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls" 
                label="Upload Material File" 
                onUpload={(url) => setFormData({ ...formData, file_url: url })} 
              />
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })} className="rounded" data-testid="material-free-checkbox" /><span className="text-sm">Free Access</span></label>
            <DialogFooter><Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={handleSave} data-testid="save-material-btn">Save</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Peer Practice Section ============
export const PeerPracticeSection = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    let filtered = users;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(query) || 
        user.email?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => (user.peer_practice_status || 'active') === statusFilter);
    }
    
    setFilteredUsers(filtered);
  }, [users, searchQuery, statusFilter]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-practice/users`, { withCredentials: true });
      setUsers(res.data.users);
      setFilteredUsers(res.data.users);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (userId, status) => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/peer-practice/users/${userId}/status`, { status }, { withCredentials: true });
      fetchData();
    } catch (error) { alert('Failed to update status'); }
  };

  const handleSaveAvailability = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/peer-practice/users/${selectedUser.id}/availability`, { availability }, { withCredentials: true });
      fetchData();
      setShowAvailModal(false);
    } catch (error) { alert('Failed to save'); }
  };

  const openAvailabilityModal = (user) => {
    setSelectedUser(user);
    setAvailability(user.peer_availability || []);
    setShowAvailModal(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="peer-practice-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Peer Practice Management</h2>
        <p className="text-sm text-slate-500">{filteredUsers.length} users</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-wrap gap-4 p-4 bg-white rounded-xl border border-slate-100">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="peer-search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="peer-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Rating</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Sessions</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No users found matching your search</td></tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50" data-testid={`peer-user-row-${user.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}`} alt="" className="w-10 h-10 rounded-full" />
                      <div><p className="font-medium text-slate-900">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" />{user.peer_rating?.toFixed(1) || '5.0'}</span></td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.peer_sessions_done || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.peer_practice_status === 'paused' ? 'bg-amber-100 text-amber-700' :
                      user.peer_practice_status === 'removed' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>{user.peer_practice_status || 'active'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openAvailabilityModal(user)} data-testid={`edit-avail-${user.id}`}><Clock className="w-4 h-4 mr-1" /> Edit Availability</Button>
                      {user.peer_practice_status !== 'paused' && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(user.id, 'paused')} title="Pause"><Pause className="w-4 h-4 text-amber-500" /></Button>
                      )}
                      {user.peer_practice_status === 'paused' && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(user.id, 'active')} title="Activate"><Play className="w-4 h-4 text-green-500" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleStatusChange(user.id, 'removed')} title="Remove"><UserX className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showAvailModal} onOpenChange={setShowAvailModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Availability - {selectedUser?.name}</DialogTitle>
            <DialogDescription>Set peer practice availability with From/To time slots</DialogDescription>
          </DialogHeader>
          <AvailabilitySelector availability={availability} onChange={setAvailability} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvailModal(false)}>Cancel</Button>
            <Button onClick={handleSaveAvailability} data-testid="save-peer-avail-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Peer Sessions Tracking Section ============
export const PeerSessionsSection = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    date_from: '',
    date_to: '',
    search: '',
  });
  
  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Participant management modal
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [managingParticipants, setManagingParticipants] = useState(false);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadStats();
    loadSessions();
  }, [page, filters]);

  // Real-time refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadSessions();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, page, filters]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.search) params.append('search', filters.search);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions?${params}`, { withCredentials: true });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (session) => {
    setSelectedSession(session);
    setDetailModalOpen(true);
    setLoadingDetails(true);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions/${session.id}`, { withCredentials: true });
      setSessionDetails(res.data);
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openStatusModal = (session) => {
    setSelectedSession(session);
    setNewStatus(session.status);
    setStatusNotes('');
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedSession) return;
    
    setUpdatingStatus(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/peer-sessions/${selectedSession.id}/update-status`,
        { status: newStatus, notes: statusNotes },
        { withCredentials: true }
      );
      setStatusModalOpen(false);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to update status: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const clearFilters = () => {
    setFilters({ status: '', date_from: '', date_to: '', search: '' });

  const openParticipantModal = (session) => {
    setSelectedSession(session);
    setParticipantModalOpen(true);
  };

  const handleRemoveParticipant = async (role) => {
    if (!selectedSession) return;
    
    const action = role === 'requester' ? 'remove_requester' : 'remove_partner';
    const participantName = role === 'requester' ? selectedSession.requester_name : selectedSession.partner_name;
    
    if (!window.confirm(`Are you sure you want to remove ${participantName} from this session? This will cancel the session.`)) {
      return;
    }
    
    setManagingParticipants(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/peer-sessions/${selectedSession.id}/participants`,
        { action, notes: `Removed ${participantName} via admin panel` },
        { withCredentials: true }
      );
      setParticipantModalOpen(false);
      loadSessions();
      loadStats();
      alert(`${participantName} removed successfully`);
    } catch (error) {
      alert('Failed to remove participant: ' + (error.response?.data?.detail || error.message));
    } finally {
      setManagingParticipants(false);
    }
  };

    setPage(1);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'pending': 'bg-amber-100 text-amber-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'cancelled': 'bg-slate-100 text-slate-700',
      'cancelled_by_mentor': 'bg-orange-100 text-orange-700',
      'cancelled_by_candidate': 'bg-red-100 text-red-700',
      'cancelled_by_admin': 'bg-purple-100 text-purple-700',
      'admin_cancelled': 'bg-purple-100 text-purple-700',
      'admin_rescheduled': 'bg-indigo-100 text-indigo-700',
      'declined': 'bg-red-100 text-red-700',
      'reschedule_pending': 'bg-purple-100 text-purple-700',
    };
    const statusLabels = {
      'cancelled_by_mentor': 'Cancelled by Mentor',
      'cancelled_by_candidate': 'Cancelled by Candidate',
      'cancelled_by_admin': 'Cancelled by Admin',
      'admin_cancelled': 'Admin Cancelled',
      'admin_rescheduled': 'Admin Rescheduled',
      'reschedule_pending': 'Reschedule Pending',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
        {statusLabels[status] || status?.replace('_', ' ')}
      </span>
    );
  };

  const formatDateTime = (date, time) => {
    if (!date) return 'N/A';
    try {
      const dateObj = new Date(date);
      return `${dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} ${time || ''}`;
    } catch {
      return `${date} ${time || ''}`;
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/peer-sessions/export-excel`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `peer_sessions_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download Excel: ' + (error.response?.data?.detail || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="peer-sessions-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peer Sessions Tracking</h1>
          <p className="text-sm text-slate-500">Monitor all peer practice sessions in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportExcel}
            variant="outline"
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Excel
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <Button onClick={() => { loadSessions(); loadStats(); }} variant="outline" size="sm">
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Today</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sessions_today}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">This Week</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.sessions_this_week}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-600">Pending</p>
            <p className="text-2xl font-bold text-amber-700">{stats.by_status?.pending || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-600">Confirmed</p>
            <p className="text-2xl font-bold text-blue-700">{stats.by_status?.confirmed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <p className="text-sm text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-700">{stats.by_status?.completed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Cancelled/Declined</p>
            <p className="text-2xl font-bold text-slate-600">{(stats.by_status?.cancelled || 0) + (stats.by_status?.declined || 0)}</p>
          </div>
        </div>
      )}

      {/* Feedback Stats */}
      {stats?.feedback_stats && (
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Feedback Completion Status</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-700">{stats.feedback_stats.both_feedback}</p>
              <p className="text-xs text-green-600">Both Submitted</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-700">{stats.feedback_stats.requester_feedback_only}</p>
              <p className="text-xs text-blue-600">Requester Only</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-lg font-bold text-purple-700">{stats.feedback_stats.partner_feedback_only}</p>
              <p className="text-xs text-purple-600">Partner Only</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-lg font-bold text-slate-700">{stats.feedback_stats.no_feedback}</p>
              <p className="text-xs text-slate-600">No Feedback</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Search & Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
              data-testid="filter-search"
            />
          </div>

          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
            <SelectTrigger data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="admin_cancelled">Admin Cancelled</SelectItem>
              <SelectItem value="admin_rescheduled">Admin Rescheduled</SelectItem>
              <SelectItem value="reschedule_pending">Reschedule Pending</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
            placeholder="From Date"
            data-testid="filter-date-from"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
            placeholder="To Date"
            data-testid="filter-date-to"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Search Results Indicator */}
      {filters.search && (
        <div className="flex items-center gap-2 px-1">
          <Search className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-slate-700">
            Showing <span className="font-semibold text-blue-600">{total}</span> session{total !== 1 ? 's' : ''} for &quot;<span className="font-medium">{filters.search}</span>&quot;
          </span>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Requester</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Req. Check-in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Partner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Partner Check-in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Req. Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Partner Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    {filters.search ? `No sessions found for "${filters.search}"` : 'No sessions found'}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50" data-testid={`peer-session-row-${session.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.date}</p>
                      <p className="text-sm text-slate-500">{session.time_slot}</p>
                      {session.reschedule_requested && (
                        <span className="text-xs text-purple-600">Rescheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={session.requester_picture || `https://ui-avatars.com/api/?name=${session.requester_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{session.requester_name}</p>
                          <p className="text-xs text-slate-500">{session.requester_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.requester_checked_in ? (
                        <div className="text-green-600">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Joined</span>
                          </div>
                          {session.requester_checked_in_at && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(session.requester_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not joined</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={session.partner_picture || `https://ui-avatars.com/api/?name=${session.partner_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{session.partner_name}</p>
                          <p className="text-xs text-slate-500">{session.partner_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {session.partner_checked_in ? (
                        <div className="text-green-600">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">Joined</span>
                          </div>
                          {session.partner_checked_in_at && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(session.partner_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not joined</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(session.status)}
                    </td>
                    <td className="px-4 py-3">
                      {session.requester_feedback_given ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {session.requester_rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {session.requester_rating.toFixed(1)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not given</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.partner_feedback_given ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {session.partner_rating && (
                            <span className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {session.partner_rating.toFixed(1)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Not given</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(session)}
                          data-testid={`view-peer-session-${session.id}`}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatusModal(session)}
                          data-testid={`edit-peer-session-${session.id}`}
                          title="Update Status"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openParticipantModal(session)}
                          data-testid={`manage-participants-${session.id}`}
                          title="Manage Participants"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} sessions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Peer Session Details</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Date & Time</p>
                  <p className="font-medium">{sessionDetails.session?.date} at {sessionDetails.session?.time_slot}</p>
                  {sessionDetails.session?.reschedule_requested && (
                    <p className="text-xs text-purple-600 mt-1">
                      Rescheduled from {sessionDetails.session?.previous_date} at {sessionDetails.session?.previous_time_slot}
                    </p>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Session Type</p>
                  <p className="font-medium">{sessionDetails.session?.session_type || 'General Practice'}</p>
                  {sessionDetails.session?.case_type && (
                    <p className="text-sm text-slate-600">{sessionDetails.session?.case_type}</p>
                  )}
                </div>
              </div>

              {/* Requester & Partner */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Requester</p>
                  <div className="flex items-center gap-3">
                    <img 
                      src={sessionDetails.requester?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.requester?.name}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full" 
                    />
                    <div>
                      <p className="font-medium text-slate-900">{sessionDetails.requester?.name}</p>
                      <p className="text-sm text-slate-500">{sessionDetails.requester?.email}</p>
                      <p className="text-xs text-slate-400">Plan: {sessionDetails.requester?.plan || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Partner</p>
                  <div className="flex items-center gap-3">
                    <img 
                      src={sessionDetails.partner?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.partner?.name}`} 
                      alt="" 
                      className="w-10 h-10 rounded-full" 
                    />
                    <div>
                      <p className="font-medium text-slate-900">{sessionDetails.partner?.name}</p>
                      <p className="text-sm text-slate-500">{sessionDetails.partner?.email}</p>
                      <p className="text-xs text-slate-400">Plan: {sessionDetails.partner?.plan || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase mb-2">Session Status</p>
                <div className="flex items-center gap-3">
                  {getStatusBadge(sessionDetails.session?.status)}
                  {sessionDetails.session?.meet_link && (
                    <a 
                      href={sessionDetails.session.meet_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Meeting Link
                    </a>
                  )}
                </div>
              </div>

              {/* Feedback Sections */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Requester Feedback (about Partner)</p>
                  {sessionDetails.requester_feedback ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${i <= (sessionDetails.requester_feedback.average_rating || sessionDetails.requester_feedback.rating_overall || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                          />
                        ))}
                        <span className="text-sm ml-2 text-slate-600">
                          {(sessionDetails.requester_feedback.average_rating || sessionDetails.requester_feedback.rating_overall || 0).toFixed(1)}
                        </span>
                      </div>
                      {sessionDetails.requester_feedback.qualitative_feedback && (
                        <p className="text-sm text-slate-600 mt-2">{sessionDetails.requester_feedback.qualitative_feedback}</p>
                      )}
                      <div className="text-xs text-slate-400 space-y-1 mt-2">
                        {sessionDetails.requester_feedback.rating_scoping_questions && (
                          <p>Scoping: {sessionDetails.requester_feedback.rating_scoping_questions}/5</p>
                        )}
                        {sessionDetails.requester_feedback.rating_case_structure && (
                          <p>Structure: {sessionDetails.requester_feedback.rating_case_structure}/5</p>
                        )}
                        {sessionDetails.requester_feedback.rating_communication && (
                          <p>Communication: {sessionDetails.requester_feedback.rating_communication}/5</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not yet provided</p>
                  )}
                </div>
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Partner Feedback (about Requester)</p>
                  {sessionDetails.partner_feedback ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${i <= (sessionDetails.partner_feedback.average_rating || sessionDetails.partner_feedback.rating_overall || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                          />
                        ))}
                        <span className="text-sm ml-2 text-slate-600">
                          {(sessionDetails.partner_feedback.average_rating || sessionDetails.partner_feedback.rating_overall || 0).toFixed(1)}
                        </span>
                      </div>
                      {sessionDetails.partner_feedback.qualitative_feedback && (
                        <p className="text-sm text-slate-600 mt-2">{sessionDetails.partner_feedback.qualitative_feedback}</p>
                      )}
                      <div className="text-xs text-slate-400 space-y-1 mt-2">
                        {sessionDetails.partner_feedback.rating_scoping_questions && (
                          <p>Scoping: {sessionDetails.partner_feedback.rating_scoping_questions}/5</p>
                        )}
                        {sessionDetails.partner_feedback.rating_case_structure && (
                          <p>Structure: {sessionDetails.partner_feedback.rating_case_structure}/5</p>
                        )}
                        {sessionDetails.partner_feedback.rating_communication && (
                          <p>Communication: {sessionDetails.partner_feedback.rating_communication}/5</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Not yet provided</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {sessionDetails.session?.requester_notes && (
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Session Notes</p>
                  <p className="text-sm text-slate-600">{sessionDetails.session.requester_notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Failed to load session details</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Session Status</DialogTitle>
            <DialogDescription>
              Change the status of the peer session between {selectedSession?.requester_name} and {selectedSession?.partner_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="new-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="admin_cancelled">Admin Cancelled</SelectItem>
                  <SelectItem value="admin_rescheduled">Admin Rescheduled</SelectItem>
                  <SelectItem value="reschedule_pending">Reschedule Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Admin Notes (optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1"
                rows={3}
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add any notes about this status change..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Status
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Participant Management Modal */}
      <Dialog open={participantModalOpen} onOpenChange={setParticipantModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Session Participants</DialogTitle>
            <DialogDescription>
              Remove participants who are not showing up or not suitable for this session
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              {/* Requester */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedSession.requester_picture || `https://ui-avatars.com/api/?name=${selectedSession.requester_name}&background=random`}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{selectedSession.requester_name}</p>
                      <p className="text-xs text-slate-500">{selectedSession.requester_email}</p>
                      <span className="text-xs text-blue-600 font-medium">Requester</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveParticipant('requester')}
                    disabled={managingParticipants}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>

              {/* Partner */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedSession.partner_picture || `https://ui-avatars.com/api/?name=${selectedSession.partner_name}&background=random`}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{selectedSession.partner_name}</p>
                      <p className="text-xs text-slate-500">{selectedSession.partner_email}</p>
                      <span className="text-xs text-purple-600 font-medium">Partner</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveParticipant('partner')}
                    disabled={managingParticipants}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  ⚠️ <strong>Note:</strong> Removing a participant will mark this session as <strong>Admin Cancelled</strong>. This action cannot be undone.
                </p>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setParticipantModalOpen(false)}
                  disabled={managingParticipants}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const PeerProfilesManagementSection = () => {
  const [profiles, setProfiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    is_listed: '',  // '', 'true', 'false'
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // Visibility toggle
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  useEffect(() => {
    loadStats();
    loadProfiles();
  }, [page, filters]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-profiles/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.search) params.append('search', filters.search);
      if (filters.is_listed) params.append('is_listed', filters.is_listed);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/peer-profiles?${params}`, { withCredentials: true });
      setProfiles(res.data.profiles);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (profile, newVisibility) => {
    const action = newVisibility ? 'show' : 'hide';
    if (!window.confirm(`Are you sure you want to ${action} ${profile.name} on the peer practice website?`)) {
      return;
    }

    setTogglingVisibility(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/peer-profiles/${profile.user_id}/toggle-visibility`,
        { 
          is_listed: newVisibility,
          notes: `Visibility toggled by admin to ${newVisibility ? 'visible' : 'hidden'}`
        },
        { withCredentials: true }
      );
      loadProfiles();
      loadStats();
      alert(`${profile.name} is now ${newVisibility ? 'visible' : 'hidden'} on the website`);
    } catch (error) {
      alert('Failed to update visibility: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTogglingVisibility(false);
    }
  };

  const openDetails = (profile) => {
    setSelectedProfile(profile);
    setDetailModalOpen(true);
  };

  const clearFilters = () => {
    setFilters({ search: '', is_listed: '', sort_by: 'created_at', sort_order: 'desc' });
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="peer-profiles-management-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peer Practice Profiles</h1>
          <p className="text-sm text-slate-500">Manage which mentees are visible on the peer practice website</p>
        </div>
        <Button onClick={() => { loadProfiles(); loadStats(); }} variant="outline" size="sm">
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Total Profiles</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total_profiles}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <p className="text-sm text-green-600">Visible on Website</p>
            <p className="text-2xl font-bold text-green-700">{stats.listed_profiles}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50">
            <p className="text-sm text-red-600">Hidden</p>
            <p className="text-2xl font-bold text-red-700">{stats.unlisted_profiles}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50">
            <p className="text-sm text-blue-600">Calendar Connected</p>
            <p className="text-2xl font-bold text-blue-700">{stats.calendar_connected}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-600">Avg Rating</p>
            <p className="text-2xl font-bold text-amber-700">{stats.average_rating.toFixed(1)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Search & Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or university..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
            />
          </div>

          <Select value={filters.is_listed || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, is_listed: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Visibility Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Profiles</SelectItem>
              <SelectItem value="true">Visible on Website</SelectItem>
              <SelectItem value="false">Hidden</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.sort_by} onValueChange={(v) => setFilters(f => ({ ...f, sort_by: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest First</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="peer_sessions_done">Most Sessions</SelectItem>
              <SelectItem value="peer_rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Profile</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">University</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Firms Targeting</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cases Done</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Visibility</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {filters.search ? `No profiles found for "${filters.search}"` : 'No profiles found'}
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.user_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={profile.profile_picture || `https://ui-avatars.com/api/?name=${profile.name}&background=random`}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900">{profile.name}</p>
                          <p className="text-xs text-slate-500">{profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{profile.university || profile.ug_college || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {profile.firms_targeting?.slice(0, 2).map((firm, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {firm}
                          </span>
                        ))}
                        {profile.firms_targeting?.length > 2 && (
                          <span className="text-xs text-slate-500">+{profile.firms_targeting.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">{profile.cases_done || 0}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="text-slate-900 font-medium">{profile.session_stats.total}</p>
                        <p className="text-xs text-green-600">{profile.session_stats.completed} completed</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {profile.peer_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium text-slate-700">{profile.peer_rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No rating</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {profile.is_listed ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <Eye className="w-4 h-4" />
                          Visible
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-sm">
                          <EyeOff className="w-4 h-4" />
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(profile)}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleVisibility(profile, !profile.is_listed)}
                          disabled={togglingVisibility}
                          title={profile.is_listed ? "Hide from Website" : "Show on Website"}
                          className={profile.is_listed ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                        >
                          {profile.is_listed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} profiles
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Peer Profile Details</DialogTitle>
          </DialogHeader>
          {selectedProfile && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <img 
                  src={selectedProfile.profile_picture || `https://ui-avatars.com/api/?name=${selectedProfile.name}&background=random`}
                  alt=""
                  className="w-20 h-20 rounded-full"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{selectedProfile.name}</h3>
                  <p className="text-sm text-slate-600">{selectedProfile.email}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {selectedProfile.is_listed ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <Eye className="w-4 h-4" />
                        Visible on Website
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <EyeOff className="w-4 h-4" />
                        Hidden from Website
                      </span>
                    )}
                    {selectedProfile.google_calendar_connected && (
                      <span className="flex items-center gap-1 text-blue-600 text-sm">
                        <Calendar className="w-4 h-4" />
                        Calendar Connected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">University</p>
                  <p className="font-medium">{selectedProfile.university || selectedProfile.ug_college || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Location</p>
                  <p className="font-medium">{selectedProfile.location || '-'}</p>
                </div>
              </div>

              {/* Career Info */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Career Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Firms Targeting</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedProfile.firms_targeting?.map((firm, idx) => (
                        <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {firm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Preparation Level</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">{selectedProfile.preparation_level || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Cases Done</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">{selectedProfile.cases_done || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500">Years of Experience</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">{selectedProfile.years_of_experience || 0}</p>
                  </div>
                </div>
              </div>

              {/* Session Stats */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Session Statistics</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-700">{selectedProfile.session_stats.total}</p>
                    <p className="text-xs text-blue-600">Total</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-700">{selectedProfile.session_stats.completed}</p>
                    <p className="text-xs text-green-600">Completed</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-700">{selectedProfile.session_stats.pending}</p>
                    <p className="text-xs text-amber-600">Pending</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-700">{selectedProfile.session_stats.cancelled}</p>
                    <p className="text-xs text-red-600">Cancelled</p>
                  </div>
                </div>
              </div>

              {/* Rating */}
              {selectedProfile.peer_rating && (
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-xs text-amber-600 uppercase mb-2">Peer Rating</p>
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(i => (
                      <Star 
                        key={i} 
                        className={`w-6 h-6 ${i <= selectedProfile.peer_rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} 
                      />
                    ))}
                    <span className="text-2xl font-bold text-amber-700 ml-2">{selectedProfile.peer_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {selectedProfile.linkedin_url && (
                <div>
                  <a 
                    href={selectedProfile.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View LinkedIn Profile
                  </a>
                </div>
              )}

              <DialogFooter>
                <Button
                  onClick={() => handleToggleVisibility(selectedProfile, !selectedProfile.is_listed)}
                  disabled={togglingVisibility}
                  className={selectedProfile.is_listed ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                >
                  {togglingVisibility ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {selectedProfile.is_listed ? 'Hide from Website' : 'Show on Website'}
                </Button>
                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Mentors Section ============

// Wraps an admin mentor row in dnd-kit's `useSortable` so the admin can
// reorder the active mentors list by dragging the GripVertical handle.
// We pass the dnd refs/listeners through the shared `renderRow` so we
// don't have to duplicate the (large) row markup.
const SortableMentorRow = ({ mentor, index, renderRow }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mentor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return renderRow(mentor, false, index, {
    setNodeRef,
    style,
    attributes,
    listeners,
    isDragging,
  });
};

export const MentorsSection = () => {
  const [mentors, setMentors] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [togglingVisibility, setTogglingVisibility] = useState(null);
  const [togglingStrategyVisibility, setTogglingStrategyVisibility] = useState(null);
  const [processingApproval, setProcessingApproval] = useState(null);
  const [deletingMentor, setDeletingMentor] = useState(null);
  const [restoringMentor, setRestoringMentor] = useState(null);
  const [logoRepository, setLogoRepository] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);
  const [selectedMentors, setSelectedMentors] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [importingData, setImportingData] = useState(false);
  const [importDataResult, setImportDataResult] = useState(null);
  const [importingFeedback, setImportingFeedback] = useState(false);
  const [importFeedbackResult, setImportFeedbackResult] = useState(null);
  const [clearingHistorical, setClearingHistorical] = useState(false);
  const [clearHistoricalResult, setClearHistoricalResult] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const photoInputRef = useRef(null);
  const bulkUploadRef = useRef(null);
  const importDataRef = useRef(null);
  const importFeedbackRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    location: '',
    consulting_position: '',
    consulting_firm: '',
    college: '',
    current_company: '',
    consulting_is_current: false,
    previous_company_1: '',
    previous_company_2: '',
    years_experience: '',
    hourly_rate: 12000,
    price_per_session: 1500,
    headline: '',
    is_top_coach: false,
    is_landing_featured: false,
    can_take_strategy_calls: false,
    picture: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [mentorsRes, pendingRes, logosRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/mentors`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/mentors/pending-changes`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/logos`, { withCredentials: true }).catch(() => ({ data: { logos: [] } }))
      ]);
      setMentors(mentorsRes.data.mentors || []);
      setPendingApprovals(pendingRes.data.pending_approvals || []);
      setLogoRepository(logosRes.data.logos || []);
      setSelectedMentors([]); // Clear selection on refresh
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const handleSelectAllMentors = (checked) => {
    if (checked) {
      setSelectedMentors(activeMentors.map(m => m.id));
    } else {
      setSelectedMentors([]);
    }
  };

  const handleSelectMentor = (mentorId, checked) => {
    if (checked) {
      setSelectedMentors(prev => [...prev, mentorId]);
    } else {
      setSelectedMentors(prev => prev.filter(id => id !== mentorId));
    }
  };

  const handleDeleteSelectedMentors = async () => {
    if (selectedMentors.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedMentors.length} mentor(s)? This action cannot be undone.`)) return;
    
    setBulkDeleting(true);
    try {
      for (const mentorId of selectedMentors) {
        await axios.delete(`${BACKEND_URL}/api/admin/mentors/${mentorId}`, { withCredentials: true });
      }
      fetchData();
    } catch (error) {
      alert('Failed to delete some mentors');
      fetchData();
    } finally {
      setBulkDeleting(false);
    }
  };

  // Drag-and-drop sensors for the active mentors list. PointerSensor with
  // a small activation distance prevents accidental drags when the admin
  // is just clicking the row (e.g. opening edit modal or toggling
  // checkboxes) while still feeling responsive once they actually drag.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Reorder the active mentors via drag-and-drop. We optimistically update
  // the UI by reordering the in-memory `mentors` state, then push the new
  // order to /api/admin/mentors/reorder. On failure we re-fetch to recover
  // the canonical order from the server.
  const handleMentorDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIdx = activeMentors.findIndex((m) => m.id === active.id);
    const toIdx = activeMentors.findIndex((m) => m.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const newActive = arrayMove(activeMentors, fromIdx, toIdx);

    // Optimistic update — preserve deleted mentors at the end
    setMentors((prev) => {
      const deleted = prev.filter((m) => m.is_deleted);
      // Map ids to mentor objects from prev (so we keep all fields)
      const byId = new Map(prev.map((m) => [m.id, m]));
      const reorderedActive = newActive.map((m) => byId.get(m.id) || m);
      return [...reorderedActive, ...deleted];
    });

    setReordering(true);
    try {
      const orders = newActive.map((m, idx) => ({ id: m.id, display_order: idx }));
      await axios.post(`${BACKEND_URL}/api/admin/mentors/reorder`, { orders }, { withCredentials: true });
    } catch (error) {
      console.error('Failed to reorder:', error);
      alert('Failed to reorder mentors');
      fetchData(); // recover canonical order
    } finally {
      setReordering(false);
    }
  };

  const filteredMentors = mentors.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate active and deleted mentors
  const activeMentors = filteredMentors.filter(m => !m.is_deleted);
  const deletedMentors = filteredMentors.filter(m => m.is_deleted);

  const handleApproveChanges = async (mentorId) => {
    setProcessingApproval(mentorId);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/mentors/${mentorId}/approve-changes`, {}, { withCredentials: true });
      fetchData();
      setShowApprovalModal(false);
    } catch (error) { 
      alert('Failed to approve changes: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleRejectChanges = async (mentorId, reason = '') => {
    setProcessingApproval(mentorId);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/mentors/${mentorId}/reject-changes`, { reason }, { withCredentials: true });
      fetchData();
      setShowApprovalModal(false);
    } catch (error) { 
      alert('Failed to reject changes: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setProcessingApproval(null);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      linkedin: '',
      location: '',
      consulting_position: '',
      consulting_firm: '',
      college: '',
      current_company: '',
      consulting_is_current: false,
      previous_company_1: '',
      previous_company_2: '',
      years_experience: '',
      hourly_rate: 12000,
      price_per_session: 1500,
      headline: '',
      is_top_coach: false,
      is_landing_featured: false,
      picture: ''
    });
  };

  // Validate required fields and return errors
  const validateMentorForm = () => {
    const errors = {};
    
    // Required fields
    if (!formData.name?.trim()) errors.name = 'Full name is required';
    if (!formData.email?.trim()) errors.email = 'Email is required';
    if (!formData.phone?.trim()) errors.phone = 'Phone number is required';
    if (!formData.linkedin?.trim()) errors.linkedin = 'LinkedIn ID is required';
    if (!formData.location?.trim()) errors.location = 'Location is required';
    if (!formData.consulting_position?.trim()) errors.consulting_position = 'Position is required';
    if (!formData.consulting_firm?.trim()) errors.consulting_firm = 'Consulting firm is required';
    if (!formData.consulting_is_current && !formData.current_company?.trim()) {
      errors.current_company = 'Current company is required';
    }
    if (!formData.years_experience) errors.years_experience = 'Years of experience is required';
    if (!formData.hourly_rate) errors.hourly_rate = 'Hourly rate is required';
    if (!formData.price_per_session) errors.price_per_session = 'Session price is required';
    
    return errors;
  };

  const [formErrors, setFormErrors] = useState({});

  // Get logo URL from repository by company name
  const getCompanyLogo = (companyName) => {
    if (!companyName) return null;
    const logo = logoRepository.find(l => 
      l.name?.toLowerCase() === companyName.toLowerCase() ||
      l.name?.toLowerCase().includes(companyName.toLowerCase()) ||
      companyName.toLowerCase().includes(l.name?.toLowerCase())
    );
    return logo?.logo_url || null;
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('category', 'mentors');
    uploadFormData.append('persist_to_db', 'true');

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/upload`, uploadFormData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setFormData(prev => ({ ...prev, picture: res.data.url }));
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkUploading(true);
    setBulkUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/mentors/bulk-upload`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setBulkUploadResult(res.data);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setBulkUploadResult({
        created: 0,
        errors: [error.response?.data?.detail || error.message]
      });
    } finally {
      setBulkUploading(false);
      if (bulkUploadRef.current) bulkUploadRef.current.value = '';
    }
  };

  // Handle import ratings/sessions data
  const handleImportData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingData(true);
    setImportDataResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/mentors/import-excel`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setImportDataResult(res.data);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setImportDataResult({
        updated: 0,
        not_found: 0,
        errors: [error.response?.data?.detail || error.message]
      });
    } finally {
      setImportingData(false);
      if (importDataRef.current) importDataRef.current.value = '';
    }
  };

  // Handle import feedback/testimonials
  const handleImportFeedback = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingFeedback(true);
    setImportFeedbackResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/mentors/import-feedback`, formData, {
        withCredentials: true,
        // Content-Type auto-set by axios for FormData
      });
      setImportFeedbackResult(res.data);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setImportFeedbackResult({
        imported: 0,
        mentor_not_found: 0,
        errors: [error.response?.data?.detail || error.message]
      });
    } finally {
      setImportingFeedback(false);
      if (importFeedbackRef.current) importFeedbackRef.current.value = '';
    }
  };

  const handleClearHistoricalData = async () => {
    setClearingHistorical(true);
    setClearHistoricalResult(null);
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/admin/feedbacks/clear-all-historical`, {
        withCredentials: true,
      });
      setClearHistoricalResult(res.data);
      setShowClearConfirm(false);
      fetchData(); // Refresh mentor list
    } catch (error) {
      setClearHistoricalResult({
        success: false,
        message: error.response?.data?.detail || error.message
      });
    } finally {
      setClearingHistorical(false);
    }
  };

  const [savingMentor, setSavingMentor] = useState(false);

  const handleInviteMentor = async () => {
    const errors = validateMentorForm();
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSavingMentor(true);
    try {
      // Add logo URLs from repository
      const mentorData = {
        ...formData,
        // Set current_company to consulting_firm if checkbox is checked
        current_company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company,
        consulting_firm_logo: getCompanyLogo(formData.consulting_firm),
        current_company_logo: formData.consulting_is_current 
          ? getCompanyLogo(formData.consulting_firm) 
          : getCompanyLogo(formData.current_company),
        // Set specialization from consulting firm for compatibility
        specialization: formData.consulting_firm,
        // Set title and company for compatibility with existing schema
        title: formData.consulting_position,
        company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company
      };

      await axios.post(`${BACKEND_URL}/api/admin/mentors/invite`, mentorData, { withCredentials: true });

      fetchData();
      setShowModal(false);
      resetFormData();
      setFormErrors({});
    } catch (error) { 
      alert('Failed to invite mentor: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setSavingMentor(false);
    }
  };

  const handleEditMentor = async () => {
    const errors = validateMentorForm();
    setFormErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      console.log('Validation errors:', errors);
      return;
    }

    setSavingMentor(true);
    try {
      // Add logo URLs from repository
      const mentorData = {
        ...formData,
        current_company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company,
        consulting_firm_logo: getCompanyLogo(formData.consulting_firm),
        current_company_logo: formData.consulting_is_current 
          ? getCompanyLogo(formData.consulting_firm) 
          : getCompanyLogo(formData.current_company),
        specialization: formData.consulting_firm,
        title: formData.consulting_position,
        company: formData.consulting_is_current ? formData.consulting_firm : formData.current_company
      };

      console.log('Updating mentor:', selectedMentor.id, mentorData);
      const response = await axios.put(`${BACKEND_URL}/api/admin/mentors/${selectedMentor.id}`, mentorData, { withCredentials: true });
      console.log('Update response:', response.data);
      fetchData();
      setShowEditModal(false);
      setSelectedMentor(null);
      setFormErrors({});
    } catch (error) { 
      console.error('Failed to update mentor:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert('Failed to update mentor: ' + errorMessage); 
    }
    finally {
      setSavingMentor(false);
    }
  };

  const handleToggleVisibility = async (mentorId) => {
    setTogglingVisibility(mentorId);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/mentors/${mentorId}/visibility`, {}, { withCredentials: true });
      fetchData();
    } catch (error) { 
      alert('Failed to toggle visibility'); 
    } finally {
      setTogglingVisibility(null);
    }
  };

  const handleToggleStrategyCallVisibility = async (mentorId) => {
    setTogglingStrategyVisibility(mentorId);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/mentors/${mentorId}/strategy-call-visibility`, {}, { withCredentials: true });
      fetchData();
    } catch (error) { 
      alert('Failed to toggle strategy call visibility'); 
    } finally {
      setTogglingStrategyVisibility(null);
    }
  };

  const handleDeleteMentor = async () => {
    if (!selectedMentor) return;
    setDeletingMentor(selectedMentor.id);
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/admin/mentors/${selectedMentor.id}`, { withCredentials: true });
      fetchData();
      setShowDeleteModal(false);
      setSelectedMentor(null);
      alert(`Mentor deleted. ${res.data.bookings_cancelled || 0} upcoming booking(s) cancelled.`);
    } catch (error) { 
      alert('Failed to delete mentor: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setDeletingMentor(null);
    }
  };

  const handleRestoreMentor = async (mentorId) => {
    setRestoringMentor(mentorId);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/mentors/${mentorId}/restore`, {}, { withCredentials: true });
      fetchData();
    } catch (error) { 
      alert('Failed to restore mentor: ' + (error.response?.data?.detail || error.message)); 
    } finally {
      setRestoringMentor(null);
    }
  };

  const handleSaveAvailability = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/mentors/${selectedMentor.id}/availability`, { 
        availability,
        blocked_days: blockedDays 
      }, { withCredentials: true });
      fetchData();
      setShowAvailModal(false);
    } catch (error) { alert('Failed to save availability'); }
  };

  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityInfo, setAvailabilityInfo] = useState(null);
  const [blockedDays, setBlockedDays] = useState([]);
  const [blockedDaysMonth, setBlockedDaysMonth] = useState(new Date());

  const openAvailabilityModal = async (mentor) => {
    setSelectedMentor(mentor);
    setShowAvailModal(true);
    setLoadingAvailability(true);
    setAvailability([]);
    setAvailabilityInfo(null);
    setBlockedDays([]);
    
    try {
      // Fetch current availability from backend
      const res = await axios.get(`${BACKEND_URL}/api/admin/mentors/${mentor.id}/availability`, {
        withCredentials: true
      });
      setAvailability(res.data.availability || []);
      setBlockedDays(res.data.blocked_days || []);
      setAvailabilityInfo({
        hasAdminOverride: res.data.has_admin_override,
        lastUpdated: res.data.last_updated,
        isEmpty: res.data.is_empty
      });
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      // Fall back to mentor object availability if API fails
      setAvailability(mentor.availability || []);
      setBlockedDays(mentor.blocked_days || []);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Toggle blocked day
  const toggleBlockedDay = (dateStr) => {
    setBlockedDays(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    );
  };

  // Generate calendar days for blocked days picker
  const getCalendarDays = () => {
    const year = blockedDaysMonth.getFullYear();
    const month = blockedDaysMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: i,
        dateStr,
        isBlocked: blockedDays.includes(dateStr),
        isPast: date < new Date(new Date().setHours(0, 0, 0, 0))
      });
    }
    
    return days;
  };

  const openEditModal = (mentor) => {
    setSelectedMentor(mentor);
    setFormData({
      name: mentor.name || '',
      email: mentor.email || '',
      phone: mentor.phone || '',
      linkedin: mentor.linkedin || '',
      location: mentor.location || '',
      consulting_position: mentor.consulting_position || mentor.title || '',
      consulting_firm: mentor.consulting_firm || mentor.specialization || '',
      college: mentor.college || '',
      current_company: mentor.current_company || mentor.company || '',
      consulting_is_current: mentor.consulting_is_current || false,
      previous_company_1: mentor.previous_company_1 || '',
      previous_company_2: mentor.previous_company_2 || '',
      years_experience: mentor.years_experience || '',
      hourly_rate: mentor.hourly_rate || 12000,
      price_per_session: mentor.price_per_session || 1500,
      headline: mentor.headline || '',
      is_top_coach: mentor.is_top_coach || false,
      is_landing_featured: mentor.is_landing_featured || false,
      can_take_strategy_calls: mentor.can_take_strategy_calls || false,
      picture: mentor.picture || ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (mentor) => {
    setSelectedMentor(mentor);
    setShowDeleteModal(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  // Render mentor row.
  // `sortable` (when provided) carries the dnd-kit refs/listeners so the
  // row can be dragged; the presence of `sortable` also triggers the
  // drag-handle in place of the legacy up/down arrows.
  const renderMentorRow = (mentor, isDeleted = false, index = -1, sortable = null) => (
    <div 
      key={mentor.id}
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
        isDeleted 
          ? 'bg-red-50/50 border-red-200 opacity-75' 
          : selectedMentors.includes(mentor.id)
            ? 'bg-blue-50 border-blue-200'
            : mentor.is_hidden 
              ? 'bg-amber-50/50 border-amber-200' 
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      } ${sortable?.isDragging ? 'shadow-lg ring-2 ring-blue-300 z-10' : ''}`}
      data-testid={`mentor-row-${mentor.id}`}
    >
      {/* Drag handle — only for active, sortable rows */}
      {!isDeleted && sortable && (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Drag to reorder ${mentor.name}`}
          title="Drag to reorder"
          className={`p-1.5 rounded hover:bg-slate-100 transition-colors touch-none select-none ${reordering ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
          data-testid={`drag-handle-${mentor.id}`}
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      )}
      
      {/* Checkbox - only for active mentors */}
      {!isDeleted && (
        <input 
          type="checkbox" 
          checked={selectedMentors.includes(mentor.id)}
          onChange={(e) => handleSelectMentor(mentor.id, e.target.checked)}
          className="w-4 h-4 rounded border-slate-300"
          data-testid={`select-mentor-${mentor.id}`}
        />
      )}
      
      {/* Avatar & Basic Info */}
      <div className="flex items-center gap-3 min-w-[250px]">
        <div className="relative">
          <img 
            src={mentor.picture || `https://ui-avatars.com/api/?name=${mentor.name}`} 
            alt="" 
            className={`w-12 h-12 rounded-full object-cover ${isDeleted || mentor.is_hidden ? 'opacity-50 grayscale' : ''}`} 
          />
          {isDeleted && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              Deleted
            </div>
          )}
          {!isDeleted && mentor.is_hidden && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              Hidden
            </div>
          )}
          {!isDeleted && !mentor.is_hidden && mentor.is_hidden_from_strategy_calls && mentor.can_take_strategy_calls && (
            <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full" title="Hidden from strategy calls">
              SC Hidden
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${isDeleted ? 'text-red-700 line-through' : 'text-slate-900'}`}>
            {mentor.name}
            {mentor.is_landing_featured && (
              <span
                className="ml-2 inline-flex items-center gap-0.5 align-middle px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700"
                title="Featured on landing page mentor carousel"
                data-testid={`mentor-row-featured-badge-${mentor.id}`}
              >
                Landing
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500 truncate">{mentor.email}</p>
          <p className="text-xs text-slate-400 font-mono truncate">{mentor.id}</p>
        </div>
      </div>

      {/* Title & Company */}
      <div className="hidden lg:block min-w-[180px]">
        <p className="text-sm font-medium text-slate-700 truncate">{mentor.title || '-'}</p>
        <p className="text-xs text-slate-500 truncate">{mentor.company || '-'}</p>
      </div>

      {/* Specialization */}
      <div className="hidden md:block min-w-[100px]">
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
          {mentor.specialization || 'General'}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-center gap-4 min-w-[120px]">
        <div className="text-center">
          <p className="text-sm font-bold text-blue-700">₹{(mentor.price_per_session || 1500).toLocaleString()}</p>
          <p className="text-xs text-slate-500">Per Session</p>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-2 min-w-[100px] flex-wrap">
        {mentor.can_take_strategy_calls && !isDeleted && (
          <span className="px-2 py-1 text-xs rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}>
            Strategy
          </span>
        )}
        {mentor.pending_changes && !isDeleted && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full whitespace-nowrap">
            Pending
          </span>
        )}
        {isDeleted && mentor.deleted_at && (
          <span className="text-xs text-red-500">
            {new Date(mentor.deleted_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto">
        {isDeleted ? (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleRestoreMentor(mentor.id)}
            disabled={restoringMentor === mentor.id}
            className="text-green-600 border-green-200 hover:bg-green-50"
            data-testid={`restore-mentor-${mentor.id}`}
          >
            {restoringMentor === mentor.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Restore
              </>
            )}
          </Button>
        ) : (
          <>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openEditModal(mentor)} 
              data-testid={`edit-mentor-btn-${mentor.id}`}
              title="Edit mentor"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openAvailabilityModal(mentor)} 
              data-testid={`edit-mentor-avail-${mentor.id}`}
              title="Edit availability"
            >
              <Clock className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleToggleVisibility(mentor.id)}
              disabled={togglingVisibility === mentor.id}
              className={mentor.is_hidden ? 'text-amber-600 hover:text-amber-700' : 'text-slate-500 hover:text-slate-700'}
              data-testid={`toggle-mentor-visibility-${mentor.id}`}
              title={mentor.is_hidden ? 'Show on candidate dashboard' : 'Hide from candidate dashboard'}
            >
              {togglingVisibility === mentor.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mentor.is_hidden ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleToggleStrategyCallVisibility(mentor.id)}
              disabled={togglingStrategyVisibility === mentor.id || !mentor.can_take_strategy_calls}
              className={mentor.is_hidden_from_strategy_calls ? 'text-purple-600 hover:text-purple-700' : 'text-slate-500 hover:text-slate-700'}
              data-testid={`toggle-strategy-visibility-${mentor.id}`}
              title={
                !mentor.can_take_strategy_calls 
                  ? 'Mentor not enabled for strategy calls' 
                  : mentor.is_hidden_from_strategy_calls 
                    ? 'Show in strategy call selection' 
                    : 'Hide from strategy call selection'
              }
            >
              {togglingStrategyVisibility === mentor.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mentor.is_hidden_from_strategy_calls ? (
                <Calendar className="w-4 h-4 line-through" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => openDeleteModal(mentor)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              data-testid={`delete-mentor-btn-${mentor.id}`}
              title="Delete mentor"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="mentors-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Mentor Management</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.open(`${BACKEND_URL}/api/admin/mentors/template`, '_blank')}
            className="text-slate-600"
            data-testid="download-template-btn"
          >
            <Download className="w-4 h-4 mr-2" /> Download Template
          </Button>
          <Button 
            variant="outline"
            onClick={() => bulkUploadRef.current?.click()}
            disabled={bulkUploading}
            className="text-green-600 border-green-200 hover:bg-green-50"
            data-testid="bulk-upload-btn"
          >
            {bulkUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Bulk Upload
          </Button>
          <input 
            type="file" 
            ref={bulkUploadRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <Button 
            variant="outline"
            onClick={() => importDataRef.current?.click()}
            disabled={importingData}
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
            data-testid="import-data-btn"
          >
            {importingData ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Update Ratings/Sessions
          </Button>
          <input 
            type="file" 
            ref={importDataRef} 
            onChange={handleImportData} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <Button 
            variant="outline"
            onClick={() => importFeedbackRef.current?.click()}
            disabled={importingFeedback}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
            data-testid="import-feedback-btn"
          >
            {importingFeedback ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4 mr-2" />
            )}
            Import Feedback
          </Button>
          <input 
            type="file" 
            ref={importFeedbackRef} 
            onChange={handleImportFeedback} 
            accept=".xlsx,.xls" 
            className="hidden" 
          />
          <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="invite-mentor-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Mentor
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowClearConfirm(true)}
            className="text-red-600 border-red-200 hover:bg-red-50"
            data-testid="clear-historical-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Historical Ratings
          </Button>
        </div>
      </div>

      {/* Clear Historical Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Clear All Historical Ratings?</h3>
            <p className="text-slate-600 mb-4">
              This will permanently delete:
            </p>
            <ul className="text-sm text-slate-600 mb-4 space-y-1">
              <li>• All imported feedback (from Excel uploads)</li>
              <li>• All imported ratings from mentor profiles</li>
              <li>• All imported session counts from mentor profiles</li>
            </ul>
            <p className="text-sm text-amber-600 mb-4">
              This action cannot be undone. Platform ratings from actual sessions will NOT be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingHistorical}
              >
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={handleClearHistoricalData}
                disabled={clearingHistorical}
              >
                {clearingHistorical ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  'Yes, Clear All'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Historical Result */}
      {clearHistoricalResult && (
        <div className={`p-4 rounded-lg border ${clearHistoricalResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${clearHistoricalResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {clearHistoricalResult.success ? 'Historical Data Cleared' : 'Error'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {clearHistoricalResult.message}
              </p>
              {clearHistoricalResult.details && (
                <div className="text-xs text-slate-500 mt-2">
                  <p>• {clearHistoricalResult.details.historical_feedbacks_deleted} feedbacks deleted</p>
                  <p>• {clearHistoricalResult.details.mentor_ratings_cleared} mentor ratings cleared</p>
                  <p>• {clearHistoricalResult.details.mentor_sessions_cleared} mentor session counts cleared</p>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setClearHistoricalResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Import Feedback Result */}
      {importFeedbackResult && (
        <div className={`p-4 rounded-lg border ${importFeedbackResult.errors?.length > 0 || importFeedbackResult.mentor_not_found > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${importFeedbackResult.errors?.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                Feedback Import Complete
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Imported <strong>{importFeedbackResult.imported}</strong> feedback(s)
                {importFeedbackResult.mentor_not_found > 0 && (
                  <span className="text-amber-600"> • {importFeedbackResult.mentor_not_found} mentor(s) not found</span>
                )}
                {importFeedbackResult.errors?.length > 0 && (
                  <span className="text-red-600"> • {importFeedbackResult.errors.length} error(s)</span>
                )}
              </p>
              {importFeedbackResult.not_found_emails?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 font-medium">Mentor emails not found:</p>
                  <ul className="text-xs text-amber-600 space-y-1 mt-1">
                    {importFeedbackResult.not_found_emails.slice(0, 5).map((email, i) => (
                      <li key={i}>• {email}</li>
                    ))}
                    {importFeedbackResult.not_found_emails.length > 5 && (
                      <li>...and {importFeedbackResult.not_found_emails.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {importFeedbackResult.imported_feedbacks?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-green-700 cursor-pointer font-medium">
                    View imported feedbacks ({importFeedbackResult.imported_feedbacks.length})
                  </summary>
                  <ul className="text-xs text-green-600 space-y-1 mt-1 max-h-32 overflow-y-auto">
                    {importFeedbackResult.imported_feedbacks.map((fb, i) => (
                      <li key={i}>• {fb.mentor}: {fb.candidate} (★{fb.rating})</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportFeedbackResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Import Data Result */}
      {importDataResult && (
        <div className={`p-4 rounded-lg border ${importDataResult.errors?.length > 0 || importDataResult.not_found > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${importDataResult.errors?.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                Data Import Complete
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Updated <strong>{importDataResult.updated}</strong> mentor(s)
                {importDataResult.not_found > 0 && (
                  <span className="text-amber-600"> • {importDataResult.not_found} not found</span>
                )}
                {importDataResult.errors?.length > 0 && (
                  <span className="text-red-600"> • {importDataResult.errors.length} error(s)</span>
                )}
              </p>
              {importDataResult.not_found_emails?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 font-medium">Emails not found:</p>
                  <ul className="text-xs text-amber-600 space-y-1 mt-1">
                    {importDataResult.not_found_emails.slice(0, 5).map((email, i) => (
                      <li key={i}>• {email}</li>
                    ))}
                    {importDataResult.not_found_emails.length > 5 && (
                      <li>...and {importDataResult.not_found_emails.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {importDataResult.errors?.length > 0 && (
                <ul className="mt-2 text-xs text-red-700 space-y-1">
                  {importDataResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {importDataResult.errors.length > 5 && (
                    <li>...and {importDataResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              )}
              {importDataResult.updated_mentors?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-green-700 cursor-pointer font-medium">
                    View updated mentors ({importDataResult.updated_mentors.length})
                  </summary>
                  <ul className="text-xs text-green-600 space-y-1 mt-1 max-h-32 overflow-y-auto">
                    {importDataResult.updated_mentors.map((m, i) => (
                      <li key={i}>• {m.name || m.email}: {m.fields_updated?.filter(f => f !== 'updated_at').join(', ')}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportDataResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Upload Result */}
      {bulkUploadResult && (
        <div className={`p-4 rounded-lg border ${bulkUploadResult.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`font-semibold ${bulkUploadResult.errors?.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                Bulk Upload Complete
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Successfully created <strong>{bulkUploadResult.created}</strong> mentor(s)
                {bulkUploadResult.errors?.length > 0 && (
                  <span className="text-amber-600"> • {bulkUploadResult.errors.length} error(s)</span>
                )}
              </p>
              {bulkUploadResult.errors?.length > 0 && (
                <ul className="mt-2 text-xs text-amber-700 space-y-1">
                  {bulkUploadResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {bulkUploadResult.errors.length > 5 && (
                    <li>...and {bulkUploadResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBulkUploadResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Pending Approvals Alert */}
      {pendingApprovals.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-orange-800">Profile Changes Pending Approval</h3>
                <p className="text-sm text-orange-600">{pendingApprovals.length} mentor(s) have submitted profile changes</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => setShowApprovalModal(true)}
            >
              Review Changes
            </Button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Search mentors by name, email, or specialization..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="mentor-search-input"
        />
      </div>

      {/* Active Mentors - Row Layout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={activeMentors.length > 0 && selectedMentors.length === activeMentors.length}
              onChange={(e) => handleSelectAllMentors(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
              data-testid="select-all-mentors"
            />
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Active Mentors ({activeMentors.length})</h3>
          </div>
          {selectedMentors.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDeleteSelectedMentors}
              disabled={bulkDeleting}
              data-testid="delete-selected-mentors-btn"
            >
              {bulkDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedMentors.length})</>
              )}
            </Button>
          )}
        </div>
        {activeMentors.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg">No active mentors found</div>
        ) : (
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMentorDragEnd}
          >
            <SortableContext
              items={activeMentors.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2" data-testid="active-mentors-list">
                {activeMentors.map((mentor, index) => (
                  <SortableMentorRow
                    key={mentor.id}
                    mentor={mentor}
                    index={index}
                    renderRow={renderMentorRow}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Deleted Mentors Section */}
      {deletedMentors.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-medium text-red-500 uppercase tracking-wide">Deleted Mentors ({deletedMentors.length})</h3>
          <div className="space-y-2">
            {deletedMentors.map((mentor) => renderMentorRow(mentor, true))}
          </div>
        </div>
      )}

      {/* Invite Mentor Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) { resetFormData(); setFormErrors({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Add New Mentor
            </DialogTitle>
            <DialogDescription>Fill in all required fields to onboard a new mentor</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {formData.picture ? (
                  <img src={formData.picture.startsWith('/api') ? `${BACKEND_URL}${formData.picture}` : formData.picture} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              <div>
                <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
                <p className="text-xs text-slate-500 mt-1">Recommended: Square image, min 200x200px</p>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="John Doe" className={formErrors.name ? 'border-red-500' : ''} />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" className={formErrors.email ? 'border-red-500' : ''} />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+91 98765 43210" className={formErrors.phone ? 'border-red-500' : ''} />
                  {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">LinkedIn ID <span className="text-red-500">*</span></label>
                  <Input value={formData.linkedin} onChange={(e) => setFormData({...formData, linkedin: e.target.value})} placeholder="linkedin.com/in/johndoe" className={formErrors.linkedin ? 'border-red-500' : ''} />
                  {formErrors.linkedin && <p className="text-xs text-red-500 mt-1">{formErrors.linkedin}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location <span className="text-red-500">*</span></label>
                <Input 
                  value={formData.location} 
                  onChange={(e) => setFormData({...formData, location: e.target.value})} 
                  placeholder="e.g., Mumbai, India" 
                  className={formErrors.location ? 'border-red-500' : ''} 
                />
                {formErrors.location && <p className="text-xs text-red-500 mt-1">{formErrors.location}</p>}
              </div>
            </div>

            {/* Consulting Experience */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Consulting Experience</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Last Position at Consulting Firm <span className="text-red-500">*</span></label>
                  <Input value={formData.consulting_position} onChange={(e) => setFormData({...formData, consulting_position: e.target.value})} placeholder="e.g., Senior Consultant" className={formErrors.consulting_position ? 'border-red-500' : ''} />
                  {formErrors.consulting_position && <p className="text-xs text-red-500 mt-1">{formErrors.consulting_position}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Consulting Firm <span className="text-red-500">*</span></label>
                  <select
                    value={formData.consulting_firm}
                    onChange={(e) => setFormData({...formData, consulting_firm: e.target.value})}
                    className={`w-full h-10 px-3 rounded-md border ${formErrors.consulting_firm ? 'border-red-500' : 'border-slate-300'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select consulting firm...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {formErrors.consulting_firm && <p className="text-xs text-red-500 mt-1">{formErrors.consulting_firm}</p>}
                  {getCompanyLogo(formData.consulting_firm) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.consulting_firm).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.consulting_firm)}` : getCompanyLogo(formData.consulting_firm)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">College/University</label>
                <select
                  value={formData.college}
                  onChange={(e) => setFormData({...formData, college: e.target.value})}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select college...</option>
                  {logoRepository.map((logo) => (
                    <option key={logo.id} value={logo.name}>{logo.name}</option>
                  ))}
                </select>
                {getCompanyLogo(formData.college) && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={getCompanyLogo(formData.college).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.college)}` : getCompanyLogo(formData.college)} alt="" className="w-6 h-6 object-contain" />
                    <span className="text-xs text-green-600">Logo auto-selected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Current & Previous Companies */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Current & Previous Companies</h3>
              
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  id="consulting-is-current" 
                  checked={formData.consulting_is_current}
                  onChange={(e) => setFormData({...formData, consulting_is_current: e.target.checked, current_company: e.target.checked ? formData.consulting_firm : ''})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="consulting-is-current" className="text-sm text-slate-600">Consulting firm is my current company</label>
              </div>

              {!formData.consulting_is_current && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Current Company <span className="text-red-500">*</span></label>
                  <select
                    value={formData.current_company}
                    onChange={(e) => setFormData({...formData, current_company: e.target.value})}
                    className={`w-full h-10 px-3 rounded-md border ${formErrors.current_company ? 'border-red-500' : 'border-slate-300'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="">Select current company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {formErrors.current_company && <p className="text-xs text-red-500 mt-1">{formErrors.current_company}</p>}
                  {getCompanyLogo(formData.current_company) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.current_company).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.current_company)}` : getCompanyLogo(formData.current_company)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 1 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_1}
                    onChange={(e) => setFormData({...formData, previous_company_1: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select previous company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_1) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_1).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_1)}` : getCompanyLogo(formData.previous_company_1)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 2 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_2}
                    onChange={(e) => setFormData({...formData, previous_company_2: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select previous company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_2) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_2).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_2)}` : getCompanyLogo(formData.previous_company_2)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Total Years of Experience <span className="text-red-500">*</span></label>
                <Input type="number" value={formData.years_experience} onChange={(e) => setFormData({...formData, years_experience: e.target.value})} placeholder="e.g., 8" className={formErrors.years_experience ? 'border-red-500' : ''} />
                {formErrors.years_experience && <p className="text-xs text-red-500 mt-1">{formErrors.years_experience}</p>}
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Hourly Rate (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.hourly_rate} onChange={(e) => setFormData({...formData, hourly_rate: parseInt(e.target.value) || 0})} placeholder="e.g., 12000" className={formErrors.hourly_rate ? 'border-red-500' : ''} />
                  {formErrors.hourly_rate && <p className="text-xs text-red-500 mt-1">{formErrors.hourly_rate}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Single Session Price (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.price_per_session} onChange={(e) => setFormData({...formData, price_per_session: parseInt(e.target.value) || 0})} placeholder="e.g., 1500" className={formErrors.price_per_session ? 'border-red-500' : ''} />
                  {formErrors.price_per_session && <p className="text-xs text-red-500 mt-1">{formErrors.price_per_session}</p>}
                </div>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Additional Information (Optional)</h3>
              <div>
                <label className="text-sm font-medium text-slate-700">Headline <span className="text-xs text-slate-400">(max 60 characters)</span></label>
                <Input 
                  value={formData.headline} 
                  onChange={(e) => setFormData({...formData, headline: e.target.value.slice(0, 60)})} 
                  placeholder="e.g., Ex-McKinsey | 100+ Cases Coached" 
                  maxLength={60}
                />
                <p className="text-xs text-slate-400 mt-1">{formData.headline?.length || 0}/60 characters</p>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="is-top-coach" 
                  checked={formData.is_top_coach}
                  onChange={(e) => setFormData({...formData, is_top_coach: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="is-top-coach" className="text-sm text-slate-600">Mark as Top Coach (featured badge)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-landing-featured"
                  checked={formData.is_landing_featured || false}
                  onChange={(e) => setFormData({ ...formData, is_landing_featured: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                  data-testid="add-mentor-landing-featured"
                />
                <label htmlFor="is-landing-featured" className="text-sm text-slate-600">
                  Show on Landing Page mentor carousel
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Public</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowModal(false); resetFormData(); setFormErrors({}); }}>Cancel</Button>
            <Button onClick={handleInviteMentor} disabled={savingMentor} className="bg-blue-600 hover:bg-blue-700" data-testid="send-invite-btn">
              {savingMentor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {savingMentor ? 'Adding...' : 'Add Mentor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Mentor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedMentor?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 space-y-2">
            <p className="font-semibold">This action will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Remove the mentor from candidate dashboard (Coaching page)</li>
              <li>Revoke mentor access - they will not be able to access the mentor dashboard</li>
              <li>Cancel all upcoming coaching sessions with this mentor</li>
              <li>Keep the mentor record for admin reference (shown as deleted)</li>
            </ul>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteMentor}
              disabled={deletingMentor === selectedMentor?.id}
              data-testid="confirm-delete-mentor-btn"
            >
              {deletingMentor === selectedMentor?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Mentor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Mentor Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Edit Mentor - {selectedMentor?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {formData.picture ? (
                  <img src={formData.picture.startsWith('/api') ? `${BACKEND_URL}${formData.picture}` : formData.picture} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              <div>
                <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                  <Upload className="w-4 h-4 mr-2" />
                  Change Photo
                </Button>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Basic Information</h3>
              {Object.keys(formErrors).length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">Please fix the following errors:</p>
                  <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                    {Object.values(formErrors).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    data-testid="edit-mentor-name"
                    className={formErrors.name ? 'border-red-500' : ''}
                  />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
                  <Input 
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    data-testid="edit-mentor-email"
                    className={formErrors.email ? 'border-red-500' : ''}
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.phone} 
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={formErrors.phone ? 'border-red-500' : ''}
                  />
                  {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">LinkedIn ID <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.linkedin} 
                    onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                    className={formErrors.linkedin ? 'border-red-500' : ''}
                  />
                  {formErrors.linkedin && <p className="text-xs text-red-500 mt-1">{formErrors.linkedin}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Location <span className="text-red-500">*</span></label>
                <Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
            </div>

            {/* Consulting Experience */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Consulting Experience</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Last Position at Consulting Firm <span className="text-red-500">*</span></label>
                  <Input value={formData.consulting_position} onChange={(e) => setFormData({...formData, consulting_position: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Consulting Firm <span className="text-red-500">*</span></label>
                  <select
                    value={formData.consulting_firm}
                    onChange={(e) => setFormData({...formData, consulting_firm: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select consulting firm...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.consulting_firm) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.consulting_firm).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.consulting_firm)}` : getCompanyLogo(formData.consulting_firm)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">College/University</label>
                <select
                  value={formData.college}
                  onChange={(e) => setFormData({...formData, college: e.target.value})}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select college...</option>
                  {logoRepository.map((logo) => (
                    <option key={logo.id} value={logo.name}>{logo.name}</option>
                  ))}
                </select>
                {getCompanyLogo(formData.college) && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={getCompanyLogo(formData.college).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.college)}` : getCompanyLogo(formData.college)} alt="" className="w-6 h-6 object-contain" />
                    <span className="text-xs text-green-600">Logo auto-selected</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Total Years of Experience <span className="text-red-500">*</span></label>
                <Input type="number" value={formData.years_experience} onChange={(e) => setFormData({...formData, years_experience: e.target.value})} />
              </div>
            </div>

            {/* Current & Previous Companies */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Current & Previous Companies</h3>
              
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  id="edit-consulting-is-current" 
                  checked={formData.consulting_is_current}
                  onChange={(e) => setFormData({...formData, consulting_is_current: e.target.checked, current_company: e.target.checked ? formData.consulting_firm : formData.current_company})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="edit-consulting-is-current" className="text-sm text-slate-600">Consulting firm is my current company</label>
              </div>

              {!formData.consulting_is_current && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Current Company <span className="text-red-500">*</span></label>
                  <select
                    value={formData.current_company}
                    onChange={(e) => setFormData({...formData, current_company: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.current_company) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.current_company).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.current_company)}` : getCompanyLogo(formData.current_company)} alt="" className="w-6 h-6 object-contain" />
                      <span className="text-xs text-green-600">Logo auto-selected</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 1 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_1}
                    onChange={(e) => setFormData({...formData, previous_company_1: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_1) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_1).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_1)}` : getCompanyLogo(formData.previous_company_1)} alt="" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Previous Company 2 <span className="text-slate-400 text-xs">(optional)</span></label>
                  <select
                    value={formData.previous_company_2}
                    onChange={(e) => setFormData({...formData, previous_company_2: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select company...</option>
                    {logoRepository.map((logo) => (
                      <option key={logo.id} value={logo.name}>{logo.name}</option>
                    ))}
                  </select>
                  {getCompanyLogo(formData.previous_company_2) && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={getCompanyLogo(formData.previous_company_2).startsWith('/api') ? `${BACKEND_URL}${getCompanyLogo(formData.previous_company_2)}` : getCompanyLogo(formData.previous_company_2)} alt="" className="w-6 h-6 object-contain" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Hourly Rate (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.hourly_rate} onChange={(e) => setFormData({...formData, hourly_rate: parseInt(e.target.value) || 0})} data-testid="edit-mentor-rate" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Single Session Price (₹) <span className="text-red-500">*</span></label>
                  <Input type="number" value={formData.price_per_session} onChange={(e) => setFormData({...formData, price_per_session: parseInt(e.target.value) || 0})} data-testid="edit-mentor-session-price" />
                </div>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">Additional Information (Optional)</h3>
              <div>
                <label className="text-sm font-medium text-slate-700">Headline <span className="text-xs text-slate-400">(max 60 characters)</span></label>
                <Input 
                  value={formData.headline} 
                  onChange={(e) => setFormData({...formData, headline: e.target.value.slice(0, 60)})} 
                  placeholder="e.g., Ex-McKinsey | 100+ Cases Coached" 
                  maxLength={60}
                />
                <p className="text-xs text-slate-400 mt-1">{formData.headline?.length || 0}/60 characters</p>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="edit-is-top-coach" 
                  checked={formData.is_top_coach}
                  onChange={(e) => setFormData({...formData, is_top_coach: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="edit-is-top-coach" className="text-sm text-slate-600">Mark as Top Coach (featured badge)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-landing-featured"
                  checked={formData.is_landing_featured || false}
                  onChange={(e) => setFormData({ ...formData, is_landing_featured: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                  data-testid="edit-mentor-landing-featured"
                />
                <label htmlFor="edit-is-landing-featured" className="text-sm text-slate-600">
                  Show on Landing Page mentor carousel
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Public</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="edit-can-take-strategy-calls" 
                  checked={formData.can_take_strategy_calls}
                  onChange={(e) => setFormData({...formData, can_take_strategy_calls: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300"
                  style={{ accentColor: 'var(--gn-periwinkle)' }}
                />
                <label htmlFor="edit-can-take-strategy-calls" className="text-sm text-slate-600">
                  Available for Strategy Calls
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">30-min 1:1 calls</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={savingMentor}>Cancel</Button>
            <Button onClick={handleEditMentor} disabled={savingMentor} className="bg-blue-600 hover:bg-blue-700" data-testid="save-mentor-edit-btn">
              {savingMentor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {savingMentor ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability Modal */}
      <Dialog open={showAvailModal} onOpenChange={setShowAvailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Availability - {selectedMentor?.name}
            </DialogTitle>
            <DialogDescription>
              View and override the mentor&apos;s weekly availability schedule
            </DialogDescription>
          </DialogHeader>
          
          {loadingAvailability ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-500">Loading availability...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Info */}
              <div className={`p-3 rounded-lg border ${
                availabilityInfo?.isEmpty 
                  ? 'bg-amber-50 border-amber-200' 
                  : availabilityInfo?.hasAdminOverride 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {availabilityInfo?.isEmpty ? (
                      <>
                        <EyeOff className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">No availability set by mentor</span>
                      </>
                    ) : availabilityInfo?.hasAdminOverride ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">Admin Override Active</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Set by Mentor</span>
                      </>
                    )}
                  </div>
                  {availabilityInfo?.lastUpdated && (
                    <span className="text-xs text-slate-500">
                      Updated: {new Date(availabilityInfo.lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Current Availability Summary */}
              {availability.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Current Schedule</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                      const dayData = availability.find(a => a.day === day);
                      const slots = dayData?.slots || [];
                      return (
                        <div key={day} className={`p-2 rounded border ${slots.length > 0 ? 'bg-white border-green-200' : 'bg-slate-100 border-slate-200'}`}>
                          <p className="text-xs font-medium text-slate-600">{day}</p>
                          {slots.length > 0 ? (
                            <div className="mt-1 space-y-0.5">
                              {slots.map((slot, idx) => (
                                <p key={idx} className="text-xs text-green-700">{slot.from} - {slot.to}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 mt-1">Not available</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Edit Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Edit2 className="w-4 h-4" />
                  Override Availability
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Changes here will override the mentor&apos;s self-set availability. The mentor will not be able to change it until you remove the override.
                </p>
                <AvailabilitySelector availability={availability} onChange={setAvailability} />
              </div>

              {/* Blocked Days Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Ban className="w-4 h-4" />
                  Block Specific Days
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Click on dates to block/unblock them. Blocked days will not show any availability.
                </p>
                
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setBlockedDaysMonth(new Date(blockedDaysMonth.getFullYear(), blockedDaysMonth.getMonth() - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {blockedDaysMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setBlockedDaysMonth(new Date(blockedDaysMonth.getFullYear(), blockedDaysMonth.getMonth() + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Calendar Grid */}
                <div className="bg-slate-50 rounded-lg p-3">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays().map((day, idx) => (
                      <div key={idx} className="aspect-square">
                        {day ? (
                          <button
                            onClick={() => !day.isPast && toggleBlockedDay(day.dateStr)}
                            disabled={day.isPast}
                            className={`w-full h-full rounded text-xs font-medium transition-colors ${
                              day.isPast 
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : day.isBlocked
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {day.date}
                          </button>
                        ) : (
                          <div className="w-full h-full"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Blocked Days Summary */}
                {blockedDays.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs font-medium text-red-700 mb-1">
                      {blockedDays.length} day(s) blocked
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {blockedDays.sort().slice(0, 10).map(dateStr => (
                        <span 
                          key={dateStr}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                        >
                          {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          <button 
                            onClick={() => toggleBlockedDay(dateStr)}
                            className="hover:text-red-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {blockedDays.length > 10 && (
                        <span className="text-xs text-red-600">+{blockedDays.length - 10} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAvailModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveAvailability} 
              disabled={loadingAvailability}
              data-testid="save-mentor-avail-btn"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Approvals Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pending Profile Changes</DialogTitle>
            <DialogDescription>Review and approve or reject mentor profile changes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No pending changes to review</p>
            ) : (
              pendingApprovals.map((mentor) => (
                <div key={mentor.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={mentor.picture || `https://ui-avatars.com/api/?name=${mentor.name}`} 
                      alt="" 
                      className="w-12 h-12 rounded-full" 
                    />
                    <div>
                      <h4 className="font-semibold text-slate-900">{mentor.name}</h4>
                      <p className="text-sm text-slate-500">{mentor.email}</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-slate-700 mb-2">Requested Changes:</h5>
                    <div className="space-y-1 text-sm">
                      {Object.entries(mentor.pending_changes || {}).map(([key, value]) => {
                        if (key === 'submitted_at') return null;
                        const currentValue = mentor[key];
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <span className="font-medium text-slate-600 capitalize w-24">{key.replace('_', ' ')}:</span>
                            <div className="flex-1">
                              {currentValue && (
                                <span className="text-red-500 line-through mr-2">
                                  {Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue)}
                                </span>
                              )}
                              <span className="text-green-600">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {mentor.pending_changes?.submitted_at && (
                      <p className="text-xs text-slate-400 mt-2">
                        Submitted: {new Date(mentor.pending_changes.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRejectChanges(mentor.id)}
                      disabled={processingApproval === mentor.id}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {processingApproval === mentor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                      Reject
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleApproveChanges(mentor.id)}
                      disabled={processingApproval === mentor.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processingApproval === mentor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                      Approve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Workshops Section ============
export const WorkshopsSection = () => {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    title: '', 
    description: '', 
    date: '', 
    time: '', 
    duration: '2 hours',
    instructor: '',
    instructor_title: '',
    thumbnail: '', 
    thumbnail_hero: '',
    thumbnail_card: '',
    thumbnail_recording: '',
    status: 'upcoming', 
    meeting_link: '',
    recording_url: '',
    video_url: '',
    topics: [],
    max_participants: 50,
    is_past: false,
    is_free: false
  });
  
  // Registrations modal state
  const [showRegistrationsModal, setShowRegistrationsModal] = useState(false);
  const [selectedWorkshopForRegistrations, setSelectedWorkshopForRegistrations] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [broadcastingWorkshopId, setBroadcastingWorkshopId] = useState(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [sendingPostWorkshopId, setSendingPostWorkshopId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/workshops`, { withCredentials: true });
      setWorkshops(res.data.workshops || []);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const fetchRegistrations = async (workshop) => {
    setSelectedWorkshopForRegistrations(workshop);
    setShowRegistrationsModal(true);
    setLoadingRegistrations(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/workshops/${workshop.id}/registrations`, { withCredentials: true });
      setRegistrations(res.data.registrations || []);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
      setRegistrations([]);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const handleRemoveRegistration = async (registrationId) => {
    if (!window.confirm('Remove this registration? The user will be notified.')) return;
    try {
      await axios.delete(
        `${BACKEND_URL}/api/admin/workshops/${selectedWorkshopForRegistrations.id}/registrations/${registrationId}`,
        { withCredentials: true }
      );
      // Refresh registrations
      fetchRegistrations(selectedWorkshopForRegistrations);
      // Refresh workshops to update count
      fetchData();
    } catch (error) {
      alert('Failed to remove registration: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Download registrations as CSV
  const handleDownloadRegistrations = () => {
    if (!registrations || registrations.length === 0) {
      alert('No registrations to download');
      return;
    }
    
    // Create CSV content
    const workshopTitle = selectedWorkshopForRegistrations?.title || 'Workshop';
    const workshopDate = selectedWorkshopForRegistrations?.date || '';
    const workshopTime = selectedWorkshopForRegistrations?.time || '';
    
    // CSV headers
    const headers = ['Name', 'Email', 'Phone', 'Current Plan', 'Registered At', 'Workshop', 'Workshop Date', 'Workshop Time'];
    
    // CSV rows
    const rows = registrations.map(reg => [
      reg.user_name || '',
      reg.user_email || '',
      reg.user_phone || '',
      reg.current_plan || 'Unknown',
      reg.registered_at ? new Date(reg.registered_at).toLocaleString() : '',
      workshopTitle,
      workshopDate,
      workshopTime
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${workshopTitle.replace(/[^a-z0-9]/gi, '_')}_registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Send updated invites to all registered users
  const handleSendUpdatedInvites = async () => {
    if (!selectedWorkshopForRegistrations) return;
    
    const workshop = selectedWorkshopForRegistrations;
    if (!workshop.meeting_link) {
      alert('Please set a meeting link for this workshop first before sending invites.');
      return;
    }
    
    if (registrations.length === 0) {
      alert('No registrations to send invites to.');
      return;
    }
    
    if (!window.confirm(`Send updated calendar invites with the new meeting link to ${registrations.length} registered user(s)?`)) {
      return;
    }
    
    setSendingInvites(true);
    
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/send-updated-invites`,
        {},
        { withCredentials: true }
      );
      
      const result = response.data;
      alert(`✅ Invites sent successfully!\n\nSent: ${result.sent || 0}\nFailed: ${result.failed || 0}${result.errors?.length > 0 ? `\n\nErrors:\n${result.errors.join('\n')}` : ''}`);
    } catch (error) {
      console.error('Failed to send invites:', error);
      alert('Failed to send invites: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSendingInvites(false);
    }
  };

  const handleSave = async () => {
    try {
      // Prepare data matching backend model
      const dataToSend = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        instructor: formData.instructor,
        instructor_title: formData.instructor_title,
        thumbnail: formData.thumbnail || null,
        thumbnail_hero: formData.thumbnail_hero || null,
        thumbnail_card: formData.thumbnail_card || null,
        thumbnail_recording: formData.thumbnail_recording || null,
        meeting_link: formData.meeting_link || null,
        video_url: formData.video_url || formData.recording_url || null,
        topics: formData.topics || [],
        status: formData.status,
        is_past: formData.status === 'completed',
        is_free: formData.is_free || false,
        max_participants: formData.max_participants || 50
      };
      
      // Debug logging for thumbnail save
      console.log('=== WORKSHOP SAVE DEBUG ===');
      console.log('formData thumbnails:', {
        thumbnail: formData.thumbnail,
        thumbnail_hero: formData.thumbnail_hero,
        thumbnail_card: formData.thumbnail_card,
        thumbnail_recording: formData.thumbnail_recording
      });
      console.log('dataToSend thumbnails:', {
        thumbnail: dataToSend.thumbnail,
        thumbnail_hero: dataToSend.thumbnail_hero,
        thumbnail_card: dataToSend.thumbnail_card,
        thumbnail_recording: dataToSend.thumbnail_recording
      });
      console.log('Full dataToSend:', JSON.stringify(dataToSend, null, 2));
      
      if (editingItem) {
        const response = await axios.put(`${BACKEND_URL}/api/admin/workshops/${editingItem.id}`, dataToSend, { withCredentials: true });
        console.log('Update response:', response.data);
      } else {
        const response = await axios.post(`${BACKEND_URL}/api/admin/workshops`, dataToSend, { withCredentials: true });
        console.log('Create response:', response.data);
      }
      fetchData();
      closeModal();
    } catch (error) { 
      console.error('Workshop save error:', error.response?.data || error);
      alert('Failed to save workshop: ' + (error.response?.data?.detail || error.message)); 
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workshop?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/workshops/${id}`, { withCredentials: true });
      fetchData();
    } catch (error) { alert('Failed to delete'); }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ 
      title: '', description: '', date: '', time: '', duration: '2 hours', 
      instructor: '', instructor_title: '', thumbnail: '', 
      thumbnail_hero: '', thumbnail_card: '', thumbnail_recording: '',
      status: 'upcoming', 
      meeting_link: '', recording_url: '', video_url: '', topics: [], max_participants: 50,
      is_past: false, is_free: false
    });
  };

  const openEdit = (workshop) => {
    setEditingItem(workshop);
    setFormData({
      title: workshop.title || '',
      description: workshop.description || '',
      date: workshop.date || '',
      time: workshop.time || '',
      duration: workshop.duration || '2 hours',
      instructor: workshop.instructor || workshop.host || '',
      instructor_title: workshop.instructor_title || '',
      thumbnail: workshop.thumbnail || '',
      thumbnail_hero: workshop.thumbnail_hero || '',
      thumbnail_card: workshop.thumbnail_card || '',
      thumbnail_recording: workshop.thumbnail_recording || '',
      status: workshop.is_past || workshop.status === 'completed' ? 'completed' : (workshop.status || 'upcoming'),
      meeting_link: workshop.meeting_link || '',
      recording_url: workshop.recording_url || '',
      video_url: workshop.video_url || '',
      topics: workshop.topics || [],
      max_participants: workshop.max_participants || 50,
      is_past: workshop.is_past || false,
      is_free: workshop.is_free || false
    });
    setShowModal(true);
  };

  const handleWhatsAppBroadcast = async (workshop) => {
    if (!window.confirm(`Send WhatsApp broadcast about "${workshop.title}" to ALL users with phone numbers?`)) return;
    setBroadcastingWorkshopId(workshop.id);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/whatsapp-broadcast`,
        {},
        { withCredentials: true }
      );
      alert(`Broadcast complete!\n\nSent: ${res.data.sent}\nFailed: ${res.data.failed}\nTotal users: ${res.data.total_users}`);
    } catch (error) {
      alert('Failed to send broadcast: ' + (error.response?.data?.detail || error.message));
    } finally {
      setBroadcastingWorkshopId(null);
    }
  };

  const handleWhatsAppRegisterReminder = async (workshop) => {
    if (!window.confirm(`Send WhatsApp register reminder for "${workshop.title}" to users who haven't registered yet?`)) return;
    setSendingReminderId(workshop.id);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/whatsapp-register-reminder`,
        {},
        { withCredentials: true }
      );
      alert(`Reminder sent!\n\nSent: ${res.data.sent}\nFailed: ${res.data.failed}\nUnregistered users: ${res.data.total_unregistered}`);
    } catch (error) {
      alert('Failed to send reminder: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSendingReminderId(null);
    }
  };

  const handlePostWorkshopMessages = async (workshop) => {
    if (!workshop.registration_count || workshop.registration_count === 0) {
      alert('No registrations for this workshop yet.');
      return;
    }
    
    if (!window.confirm(
      `Send post-workshop thank you messages to ${workshop.registration_count} registered participant(s)?\n\n` +
      `This will:\n` +
      `✅ Send WhatsApp thank you message\n` +
      `✅ Update workshop_name attribute in WATI\n` +
      `✅ Trigger feedback flow (if automation set up in WATI)`
    )) return;
    
    setSendingPostWorkshopId(workshop.id);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/workshops/${workshop.id}/whatsapp-post-workshop`,
        {},
        { withCredentials: true }
      );
      alert(
        `✅ Post-workshop messages sent!\n\n` +
        `Sent: ${res.data.sent}\n` +
        `Failed: ${res.data.failed}\n` +
        `Total Registered: ${res.data.total_registered}\n` +
        `With Phone Numbers: ${res.data.total_with_phone}`
      );
    } catch (error) {
      alert('Failed to send post-workshop messages: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSendingPostWorkshopId(null);
    }
  };



  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="workshops-section">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Workshops Management</h2>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="add-workshop-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Workshop
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workshops.map((workshop) => (
          <div key={workshop.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden" data-testid={`workshop-card-${workshop.id}`}>
            <div className="h-40 bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center relative">
              {(workshop.thumbnail_card || workshop.thumbnail_recording || workshop.thumbnail) ? (
                <img src={workshop.thumbnail_card || workshop.thumbnail_recording || workshop.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <Calendar className="w-12 h-12 text-white/80" />
              )}
              {workshop.is_free && (
                <span className="absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full bg-green-500 text-white">Free</span>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-900">{workshop.title}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  workshop.status === 'completed' ? 'bg-green-100 text-green-700' :
                  workshop.status === 'live' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{workshop.status || 'upcoming'}</span>
              </div>
              <p className="text-sm text-slate-500 mb-3">{workshop.description?.substring(0, 80)}...</p>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{workshop.date}</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{workshop.time}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                <span className="flex items-center gap-1 text-xs text-slate-400" title="Workshop ID">
                  🆔 ID: <code className="bg-slate-100 px-1 rounded">{workshop.id}</code>
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                <span 
                  className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => fetchRegistrations(workshop)}
                  title="Click to view registrations"
                >
                  <Users className="w-4 h-4" />
                  {workshop.registration_count || 0}/{workshop.max_participants || 50} registered
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(workshop)} data-testid={`edit-workshop-${workshop.id}`}>
                  <Edit2 className="w-4 h-4 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(workshop.id)} data-testid={`delete-workshop-${workshop.id}`}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={() => handleWhatsAppBroadcast(workshop)}
                  disabled={broadcastingWorkshopId === workshop.id}
                  data-testid={`broadcast-workshop-${workshop.id}`}
                >
                  {broadcastingWorkshopId === workshop.id ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3 h-3 mr-1" /> WhatsApp Broadcast</>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleWhatsAppRegisterReminder(workshop)}
                  disabled={sendingReminderId === workshop.id}
                  data-testid={`reminder-workshop-${workshop.id}`}
                >
                  {sendingReminderId === workshop.id ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <><MessageSquare className="w-3 h-3 mr-1" /> Register Reminder</>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => handlePostWorkshopMessages(workshop)}
                  disabled={sendingPostWorkshopId === workshop.id}
                  data-testid={`post-workshop-${workshop.id}`}
                  title="Send thank you messages and update WATI attributes"
                >
                  {sendingPostWorkshopId === workshop.id ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3 h-3 mr-1" /> Post-Workshop Messages</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workshop Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Workshop' : 'Add New Workshop'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Title</label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} data-testid="workshop-title-input" /></div>
            <div><label className="text-sm font-medium">Description</label><textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} data-testid="workshop-desc-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Date</label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} data-testid="workshop-date-input" /></div>
              <div><label className="text-sm font-medium">Time</label><Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} data-testid="workshop-time-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Duration</label><Input value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} placeholder="e.g., 2 hours" data-testid="workshop-duration-input" /></div>
              <div><label className="text-sm font-medium">Max Participants</label><Input type="number" value={formData.max_participants} onChange={(e) => setFormData({...formData, max_participants: parseInt(e.target.value)})} data-testid="workshop-max-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Instructor Name</label><Input value={formData.instructor} onChange={(e) => setFormData({...formData, instructor: e.target.value})} placeholder="e.g., John Doe" data-testid="workshop-instructor-input" /></div>
              <div><label className="text-sm font-medium">Instructor Title</label><Input value={formData.instructor_title} onChange={(e) => setFormData({...formData, instructor_title: e.target.value})} placeholder="e.g., Ex-McKinsey" data-testid="workshop-instructor-title-input" /></div>
            </div>
            <div><label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger data-testid="workshop-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Meeting Link for Upcoming/Live workshops */}
            {(formData.status === 'upcoming' || formData.status === 'live') && (
              <div><label className="text-sm font-medium">Meeting Link (Zoom/Google Meet)</label><Input value={formData.meeting_link} onChange={(e) => setFormData({...formData, meeting_link: e.target.value})} placeholder="https://zoom.us/j/... or https://meet.google.com/..." data-testid="workshop-meeting-link-input" /></div>
            )}
            
            {/* Thumbnails Section with Aspect Ratio Guidance */}
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Workshop Thumbnails
              </h4>
              <p className="text-xs text-slate-500">Upload different thumbnails optimized for each display context. The system will automatically use the appropriate thumbnail based on where the workshop is displayed.</p>
              
              {/* Hero Thumbnail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Hero Thumbnail (Featured Workshop)</label>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">21:9 ratio · 2100×900px recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Used when workshop is the featured/first upcoming workshop in the hero section. Wide cinematic format.</p>
                {formData.thumbnail_hero && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail_hero} alt="Hero preview" className="w-full h-24 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail_hero: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Hero Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail_hero: url})} />
              </div>
              
              {/* Card Thumbnail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Card Thumbnail (Upcoming Cards)</label>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">16:9 ratio · 1280×720px recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Used in upcoming workshop cards. Standard video thumbnail format.</p>
                {formData.thumbnail_card && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail_card} alt="Card preview" className="w-full h-24 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail_card: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Card Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail_card: url})} />
              </div>
              
              {/* Recording Thumbnail */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Recording Thumbnail (Past Workshops)</label>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">16:9 ratio · 1280×720px recommended</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">Used in past workshop recordings grid. Will be used automatically when status changes to "Completed".</p>
                {formData.thumbnail_recording && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail_recording} alt="Recording preview" className="w-full h-24 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail_recording: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Recording Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail_recording: url})} />
              </div>
              
              {/* Legacy Thumbnail (for backwards compatibility) */}
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-300">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-600">Legacy/Fallback Thumbnail</label>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">Optional · Used if specific thumbnails not set</span>
                </div>
                {formData.thumbnail && (
                  <div className="mb-2 relative">
                    <img src={formData.thumbnail} alt="Legacy preview" className="w-full h-20 object-cover rounded" />
                    <button onClick={() => setFormData({...formData, thumbnail: ''})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FileUpload category="thumbnails" accept="image/*" label="Upload Fallback Thumbnail" persistToDb={true} onUpload={(url) => setFormData({...formData, thumbnail: url})} />
              </div>
            </div>
            
            {/* Recording URL/Upload for Completed workshops */}
            {formData.status === 'completed' && (
              <>
                <div><label className="text-sm font-medium">Recording URL</label><Input value={formData.video_url || formData.recording_url} onChange={(e) => setFormData({...formData, video_url: e.target.value, recording_url: e.target.value})} placeholder="YouTube or direct video URL" data-testid="workshop-recording-input" /></div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Or Upload Recording (supports large files)</label>
                  <ChunkedFileUpload 
                    category="recordings" 
                    accept="video/*" 
                    label="Upload Workshop Recording" 
                    onUpload={(url) => setFormData({...formData, video_url: url, recording_url: url})} 
                  />
                </div>
              </>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({...formData, is_free: e.target.checked})} className="rounded" data-testid="workshop-free-checkbox" /><span className="text-sm">Free Access</span></label>
            <DialogFooter><Button variant="outline" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} data-testid="save-workshop-btn">{editingItem ? 'Save Changes' : 'Add Workshop'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registrations Modal */}
      <Dialog open={showRegistrationsModal} onOpenChange={setShowRegistrationsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workshop Registrations</DialogTitle>
            <DialogDescription>
              {selectedWorkshopForRegistrations?.title} - {registrations.length} registered
            </DialogDescription>
          </DialogHeader>
          
          {loadingRegistrations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No registrations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {registrations.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{reg.user_name}</p>
                    <p className="text-sm text-slate-500">{reg.user_email}</p>
                    <p className="text-xs text-slate-400">
                      Registered: {new Date(reg.registered_at).toLocaleString()}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemoveRegistration(reg.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleDownloadRegistrations}
                disabled={registrations.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
              <Button 
                variant="default"
                onClick={handleSendUpdatedInvites}
                disabled={registrations.length === 0 || sendingInvites || !selectedWorkshopForRegistrations?.meeting_link}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {sendingInvites ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendingInvites ? 'Sending...' : 'Send Updated Invites'}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowRegistrationsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Cohort Section with Lifecycle Management ============
export const CohortSection = () => {
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [cohortMembers, setCohortMembers] = useState([]);
  const [formData, setFormData] = useState({ name: '', description: '', start_date: '', end_date: '', status: 'registering', max_participants: 50, price: 0 });
  const [sectionData, setSectionData] = useState({ title: '', description: '', order: 0 });
  const [resourceData, setResourceData] = useState({ title: '', type: 'document', file_url: '', section_id: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/cohorts`, { withCredentials: true });
      setCohorts(res.data.cohorts || []);
    } catch (error) { console.error('Failed:', error); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/admin/cohorts`, formData, { withCredentials: true });
      fetchData();
      setShowModal(false);
      setFormData({ name: '', description: '', start_date: '', end_date: '', status: 'registering', max_participants: 50, price: 0 });
    } catch (error) { 
      alert(error.response?.data?.detail || 'Failed to save cohort');
    }
  };

  const handleStatusChange = async (cohortId, newStatus) => {
    try {
      await axios.put(`${BACKEND_URL}/api/admin/cohorts/${cohortId}/status`, { status: newStatus }, { withCredentials: true });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleAddSection = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/admin/cohorts/${selectedCohort.id}/sections`, sectionData, { withCredentials: true });
      fetchData();
      setShowSectionModal(false);
      setSectionData({ title: '', description: '', order: 0 });
    } catch (error) { alert('Failed to add section'); }
  };

  const handleAddResource = async () => {
    try {
      const dataToSend = { ...resourceData };
      if (selectedSection) {
        dataToSend.section_id = selectedSection.id;
      }
      await axios.post(`${BACKEND_URL}/api/admin/cohorts/${selectedCohort.id}/resources`, dataToSend, { withCredentials: true });
      fetchData();
      setShowResourceModal(false);
      setResourceData({ title: '', type: 'document', file_url: '', section_id: '' });
      setSelectedSection(null);
    } catch (error) { alert('Failed to add resource'); }
  };

  const openSectionModal = (cohort) => {
    setSelectedCohort(cohort);
    setShowSectionModal(true);
  };

  const openResourceModal = (cohort, section = null) => {
    setSelectedCohort(cohort);
    setSelectedSection(section);
    setShowResourceModal(true);
  };

  const openMembersModal = async (cohort) => {
    setSelectedCohort(cohort);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/cohorts/${cohort.id}/members`, { withCredentials: true });
      setCohortMembers(res.data.members || []);
    } catch (error) { console.error('Failed to fetch members:', error); }
    setShowMembersModal(true);
  };

  // Get active and registering cohorts for summary
  const activeCohort = cohorts.find(c => c.status === 'active');
  const registeringCohort = cohorts.find(c => c.status === 'registering');

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6" data-testid="cohort-section">
      {/* Lifecycle Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border-2 ${activeCohort ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${activeCohort ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <h3 className="font-semibold text-slate-900">Active Cohort</h3>
          </div>
          {activeCohort ? (
            <div>
              <p className="text-lg font-medium text-green-700">{activeCohort.name}</p>
              <p className="text-sm text-slate-600">{activeCohort.members_count || 0} members enrolled</p>
            </div>
          ) : (
            <p className="text-slate-500">No active cohort. Activate a registering cohort to start.</p>
          )}
        </div>
        <div className={`p-4 rounded-xl border-2 ${registeringCohort ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${registeringCohort ? 'bg-blue-500' : 'bg-slate-300'}`} />
            <h3 className="font-semibold text-slate-900">Registering Cohort</h3>
          </div>
          {registeringCohort ? (
            <div>
              <p className="text-lg font-medium text-blue-700">{registeringCohort.name}</p>
              <p className="text-sm text-slate-600">{registeringCohort.members_count || 0} registered</p>
            </div>
          ) : (
            <p className="text-slate-500">No cohort accepting registrations. Create one to start enrolling.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">All Cohorts ({cohorts.length})</h2>
        <Button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="add-cohort-btn">
          <Plus className="w-4 h-4 mr-2" /> Create Cohort
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {cohorts.map((cohort) => (
          <div key={cohort.id} className={`bg-white rounded-xl border-2 p-6 ${
            cohort.status === 'active' ? 'border-green-200' : 
            cohort.status === 'registering' ? 'border-blue-200' : 'border-slate-100'
          }`} data-testid={`cohort-card-${cohort.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{cohort.name}</h3>
                <p className="text-sm text-slate-500">{cohort.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={cohort.status || 'active'} onValueChange={(v) => handleStatusChange(cohort.id, v)}>
                  <SelectTrigger className={`w-36 ${
                    cohort.status === 'active' ? 'bg-green-50 border-green-200 text-green-700' :
                    cohort.status === 'registering' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    cohort.status === 'completed' ? 'bg-slate-50 border-slate-200 text-slate-700' :
                    'bg-amber-50 border-amber-200 text-amber-700'
                  }`} data-testid={`cohort-status-${cohort.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registering">🟡 Registering</SelectItem>
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="completed">⚪ Completed</SelectItem>
                    <SelectItem value="archived">📦 Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {cohort.start_date} - {cohort.end_date}</span>
              <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => openMembersModal(cohort)}>
                <Users className="w-4 h-4" /> {cohort.members_count || 0} members
              </span>
              {cohort.max_participants && (
                <span className="text-slate-400">Max: {cohort.max_participants}</span>
              )}
            </div>

            {/* Sections */}
            <div className="border-t border-slate-100 pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" /> Sections ({(cohort.sections || []).length})
                </h4>
                <Button size="sm" variant="outline" onClick={() => openSectionModal(cohort)} data-testid={`add-section-${cohort.id}`}>
                  <Plus className="w-4 h-4 mr-1" /> Add Section
                </Button>
              </div>
              
              {(cohort.sections || []).length === 0 ? (
                <p className="text-sm text-slate-400 mb-4">No sections created yet. Create sections to organize resources.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {cohort.sections.map((section, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-slate-800">{section.title}</h5>
                        <Button size="sm" variant="ghost" onClick={() => openResourceModal(cohort, section)} data-testid={`add-resource-section-${section.id}`}>
                          <Plus className="w-4 h-4 mr-1" /> Add Resource
                        </Button>
                      </div>
                      {section.description && <p className="text-xs text-slate-500 mb-2">{section.description}</p>}
                      
                      {(cohort.resources || []).filter(r => r.section_id === section.id).length > 0 ? (
                        <div className="space-y-1">
                          {cohort.resources.filter(r => r.section_id === section.id).map((res, resIdx) => (
                            <div key={resIdx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100">
                              <span className="text-sm text-slate-700 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500" /> {res.title}
                              </span>
                              <a href={res.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View</a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No resources in this section</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(cohort.resources || []).filter(r => !r.section_id).length > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <h5 className="font-medium text-slate-800 mb-2">General Resources</h5>
                  <div className="space-y-1">
                    {cohort.resources.filter(r => !r.section_id).map((res, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100">
                        <span className="text-sm text-slate-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" /> {res.title}
                        </span>
                        <a href={res.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button size="sm" variant="outline" onClick={() => openResourceModal(cohort)} className="w-full" data-testid={`add-resource-${cohort.id}`}>
              <Upload className="w-4 h-4 mr-2" /> Upload General Resource
            </Button>
          </div>
        ))}
      </div>

      {/* Create Cohort Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New Cohort</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Cohort Name</label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Batch 2026 January" data-testid="cohort-name-input" /></div>
            <div><label className="text-sm font-medium">Description</label><textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} data-testid="cohort-desc-input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Start Date</label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} data-testid="cohort-start-input" /></div>
              <div><label className="text-sm font-medium">End Date</label><Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} data-testid="cohort-end-input" /></div>
            </div>
            <div><label className="text-sm font-medium">Initial Status</label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger data-testid="cohort-status-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="registering">🟡 Registering (accepting enrollments)</SelectItem>
                  <SelectItem value="active">🟢 Active (cohort in progress)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Note: Only one active and one registering cohort allowed at a time.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Max Participants</label><Input type="number" value={formData.max_participants} onChange={(e) => setFormData({...formData, max_participants: parseInt(e.target.value)})} data-testid="cohort-max-input" /></div>
              <div><label className="text-sm font-medium">Price (₹)</label><Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})} data-testid="cohort-price-input" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={handleSave} data-testid="save-cohort-btn">Create Cohort</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cohort Members Modal */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Members - {selectedCohort?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cohortMembers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No members enrolled yet</p>
            ) : (
              cohortMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {member.picture && <img src={member.picture} alt="" className="w-8 h-8 rounded-full" />}
                    <div>
                      <p className="font-medium text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Modal */}
      <Dialog open={showSectionModal} onOpenChange={setShowSectionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Section - {selectedCohort?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Section Title</label><Input value={sectionData.title} onChange={(e) => setSectionData({...sectionData, title: e.target.value})} placeholder="e.g., Week 1 - Fundamentals" data-testid="section-title-input" /></div>
            <div><label className="text-sm font-medium">Description</label><textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} value={sectionData.description} onChange={(e) => setSectionData({...sectionData, description: e.target.value})} placeholder="Brief description of this section" /></div>
            <div><label className="text-sm font-medium">Order</label><Input type="number" value={sectionData.order} onChange={(e) => setSectionData({...sectionData, order: parseInt(e.target.value)})} placeholder="0" /></div>
            <DialogFooter><Button variant="outline" onClick={() => setShowSectionModal(false)}>Cancel</Button><Button onClick={handleAddSection} data-testid="save-section-btn">Add Section</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Resource Modal */}
      <Dialog open={showResourceModal} onOpenChange={setShowResourceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Resource - {selectedCohort?.name}</DialogTitle>
            {selectedSection && <DialogDescription>Adding to section: {selectedSection.title}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Resource Title</label><Input value={resourceData.title} onChange={(e) => setResourceData({...resourceData, title: e.target.value})} placeholder="e.g., Case Study Template" data-testid="resource-title-input" /></div>
            <div><label className="text-sm font-medium">Type</label>
              <Select value={resourceData.type} onValueChange={(v) => setResourceData({...resourceData, type: v})}>
                <SelectTrigger data-testid="resource-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Upload File</label>
              <ChunkedFileUpload 
                category="cohort-resources" 
                accept="*" 
                label="Upload Resource File" 
                onUpload={(url) => setResourceData({...resourceData, file_url: url})} 
              />
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowResourceModal(false)}>Cancel</Button><Button onClick={handleAddResource} data-testid="save-resource-btn">Add Resource</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Re-export CoursesSection from dedicated file
import CoursesManagementComponent from './CoursesManagement';
export const CoursesSection = CoursesManagementComponent;

// ============ Payouts Section ============
export const PayoutsSection = () => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    mentor_id: '',
    candidate_id: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  
  // Mark paid modal
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [amountOverride, setAmountOverride] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkMarkingPaid, setBulkMarkingPaid] = useState(false);

  useEffect(() => {
    loadStats();
    loadSessions();
  }, [page, filters]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/payouts/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.mentor_id) params.append('mentor_id', filters.mentor_id);
      if (filters.candidate_id) params.append('candidate_id', filters.candidate_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/payouts?${params}`, { withCredentials: true });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openMarkPaidModal = (session) => {
    setSelectedSession(session);
    setAmountOverride(session.amount?.toString() || '');
    setMarkPaidModalOpen(true);
  };

  const handleMarkPaid = async () => {
    if (!selectedSession) return;
    
    setMarkingPaid(true);
    try {
      const body = {};
      if (amountOverride && parseInt(amountOverride) !== selectedSession.mentor_hourly_rate) {
        body.amount_override = parseInt(amountOverride);
      }
      
      await axios.post(
        `${BACKEND_URL}/api/admin/payouts/${selectedSession.id}/mark-paid`,
        body,
        { withCredentials: true }
      );
      setMarkPaidModalOpen(false);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to mark as paid: ' + (error.response?.data?.detail || error.message));
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.length === 0) return;
    
    setBulkMarkingPaid(true);
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/admin/payouts/bulk-mark-paid`,
        { booking_ids: selectedIds },
        { withCredentials: true }
      );
      alert(`Marked ${res.data.marked_paid} sessions as paid.${res.data.failed?.length > 0 ? ` ${res.data.failed.length} failed.` : ''}`);
      setSelectedIds([]);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setBulkMarkingPaid(false);
    }
  };

  const toggleSelectAll = () => {
    const pendingSessions = sessions.filter(s => s.payment_status === 'pending');
    if (selectedIds.length === pendingSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingSessions.map(s => s.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const clearFilters = () => {
    setFilters({ mentor_id: '', candidate_id: '', status: '', date_from: '', date_to: '' });
    setPage(1);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'pending': 'bg-amber-100 text-amber-700',
      'on_hold': 'bg-red-100 text-red-700',
      'paid': 'bg-green-100 text-green-700',
    };
    const statusLabels = {
      'pending': 'Payment Pending',
      'on_hold': 'On Hold',
      'paid': 'Paid',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="payouts-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentor Payouts</h1>
          <p className="text-sm text-slate-500">Manage mentor payments for completed sessions</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <Button onClick={handleBulkMarkPaid} disabled={bulkMarkingPaid} className="bg-green-600 hover:bg-green-700">
              {bulkMarkingPaid ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Mark {selectedIds.length} as Paid
            </Button>
          )}
          <Button onClick={() => { loadSessions(); loadStats(); }} variant="outline" size="sm">
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-600">Payment Pending</p>
            <p className="text-2xl font-bold text-amber-700">₹{stats.summary.total_pending?.toLocaleString()}</p>
            <p className="text-xs text-amber-500">{stats.summary.pending_count} sessions</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-600">On Hold</p>
            <p className="text-2xl font-bold text-red-700">₹{stats.summary.total_on_hold?.toLocaleString()}</p>
            <p className="text-xs text-red-500">{stats.summary.on_hold_count} sessions</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">Paid</p>
            <p className="text-2xl font-bold text-green-700">₹{stats.summary.total_paid?.toLocaleString()}</p>
            <p className="text-xs text-green-500">{stats.summary.paid_count} sessions</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 col-span-2 md:col-span-3">
            <p className="text-sm text-blue-600 mb-2">Monthly Payouts (Last 6 months)</p>
            <div className="flex items-end gap-2 h-16">
              {stats.monthly_data?.slice(0, 6).reverse().map((m, idx) => {
                const maxPaid = Math.max(...stats.monthly_data.slice(0, 6).map(d => d.paid || 1));
                const height = maxPaid > 0 ? ((m.paid || 0) / maxPaid) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-500 rounded-t" 
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`₹${(m.paid || 0).toLocaleString()}`}
                    />
                    <span className="text-xs text-slate-500 mt-1">{m.month?.slice(5) || ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select value={filters.mentor_id || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, mentor_id: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Mentors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mentors</SelectItem>
              {stats?.mentors?.map(mentor => (
                <SelectItem key={mentor.id} value={mentor.id}>{mentor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.candidate_id || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, candidate_id: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Candidates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Candidates</SelectItem>
              {stats?.candidates?.map(candidate => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Payment Pending</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
            placeholder="From Date"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
            placeholder="To Date"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === sessions.filter(s => s.payment_status === 'pending').length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Session Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Feedback</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {session.payment_status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(session.id)}
                          onChange={() => toggleSelect(session.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{session.date}</p>
                      <p className="text-sm text-slate-500">{session.time_slot}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={session.mentor_picture || `https://ui-avatars.com/api/?name=${session.mentor_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{session.mentor_name}</p>
                          <p className="text-xs text-slate-500">₹{session.mentor_hourly_rate}/hr</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 text-sm">{session.candidate_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{session.session_type || 'Coaching'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">₹{session.amount?.toLocaleString()}</p>
                      {session.amount_override && (
                        <p className="text-xs text-blue-600">Override</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.has_feedback ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Given
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(session.payment_status)}
                      {session.paid_at && (
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(session.paid_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {session.payment_status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openMarkPaidModal(session)}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {session.payment_status === 'on_hold' && (
                        <span className="text-xs text-slate-500">Awaiting feedback</span>
                      )}
                      {session.payment_status === 'paid' && (
                        <span className="text-xs text-green-600">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} sessions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      <Dialog open={markPaidModalOpen} onOpenChange={setMarkPaidModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Session as Paid</DialogTitle>
            <DialogDescription>
              Confirm payment for session with {selectedSession?.candidate_name} on {selectedSession?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Mentor</label>
              <p className="text-slate-900">{selectedSession?.mentor_name}</p>
              <p className="text-xs text-slate-500">Hourly rate: ₹{selectedSession?.mentor_hourly_rate}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Amount</label>
              <Input
                type="number"
                value={amountOverride}
                onChange={(e) => setAmountOverride(e.target.value)}
                placeholder="Enter amount"
              />
              <p className="text-xs text-slate-500 mt-1">Leave as is or enter a different amount to override</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkPaidModalOpen(false)}>Cancel</Button>
              <Button onClick={handleMarkPaid} disabled={markingPaid} className="bg-green-600 hover:bg-green-700">
                {markingPaid ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Coaching Sessions Section ============
// =============================================================================
// Recording Health Check Panel
// =============================================================================
// Compact admin panel that runs the Meet recording self-test and surfaces
// the per-step pass/fail status with actionable remediation hints. Lives
// at the top of the CoachingSessionsSection so admins see it whenever
// they go to view sessions/recordings.
const RecordingHealthCheck = () => {
  const [config, setConfig] = useState(null);
  const [report, setReport] = useState(null);
  const [globalDiag, setGlobalDiag] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Force-sync-by-criteria modal state
  const [showForceSync, setShowForceSync] = useState(false);
  const [forceSyncForm, setForceSyncForm] = useState({ date: '', mentor_email: '', candidate_email: '', session_id: '' });
  const [forceSyncResult, setForceSyncResult] = useState(null);
  const [forceSyncing, setForceSyncing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, gdiag] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/admin/recordings/config`, { withCredentials: true }),
          axios.get(`${BACKEND_URL}/api/admin/recordings/global-diagnose`, { withCredentials: true }),
        ]);
        setConfig(cfg.data);
        setGlobalDiag(gdiag.data);
      } catch (e) {
        console.error('recording panel load failed', e);
      }
    };
    load();
  }, []);

  const refreshGlobalDiag = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/recordings/global-diagnose`, { withCredentials: true });
      setGlobalDiag(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const runSelfTest = async () => {
    setRunning(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/recordings/self-test`, {}, { withCredentials: true });
      setReport(res.data);
      setExpanded(true);
    } catch (e) {
      setReport({ error: e?.response?.data?.detail || e.message, steps: [] });
      setExpanded(true);
    } finally {
      setRunning(false);
    }
  };

  const syncAllPending = async () => {
    setRunning(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/recordings/sync-all-pending`, {}, { withCredentials: true });
      alert(`Sync complete: found=${res.data?.stats?.found || 0}, synced=${res.data?.stats?.synced || 0}, skipped=${res.data?.stats?.skipped || 0}`);
      await refreshGlobalDiag();
    } catch (e) {
      alert(`Sync failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const submitForceSync = async () => {
    setForceSyncing(true);
    setForceSyncResult(null);
    try {
      const payload = {};
      Object.entries(forceSyncForm).forEach(([k, v]) => { if (v && v.trim()) payload[k] = v.trim(); });
      const res = await axios.post(`${BACKEND_URL}/api/admin/recordings/find-and-force-sync`, payload, { withCredentials: true });
      setForceSyncResult(res.data);
      await refreshGlobalDiag();
    } catch (e) {
      setForceSyncResult({ error: e?.response?.data?.detail || e.message });
    } finally {
      setForceSyncing(false);
    }
  };

  const overallOk = report?.overall_ok;
  const hasReport = report && Array.isArray(report.steps);
  const stuckCount = globalDiag ? Object.values(globalDiag.counts_by_collection || {}).reduce((s, c) => s + (c.stuck_no_recording || 0), 0) : 0;
  const schedulerAlive = globalDiag?.scheduler_alive;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4" data-testid="recording-health-check">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${hasReport && overallOk ? 'bg-green-100' : hasReport ? 'bg-amber-100' : 'bg-indigo-100'}`}>
            {hasReport && overallOk ? (
              <ShieldCheck className="w-5 h-5 text-green-700" />
            ) : hasReport ? (
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            ) : (
              <Activity className="w-5 h-5 text-indigo-700" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Recording Infrastructure
              {config?.auto_record_enabled === false && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Auto-record disabled</span>
              )}
              {schedulerAlive === false && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full" data-testid="scheduler-stale-badge">Scheduler stale</span>
              )}
              {schedulerAlive === true && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full" data-testid="scheduler-alive-badge">Scheduler alive</span>
              )}
              {stuckCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full" data-testid="stuck-count-badge">
                  {stuckCount} stuck
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Sessions auto-record via Google Meet REST API. Recordings are moved to the configured Shared Drive folder.
            </p>
            {config && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Host: <code className="bg-white px-1 rounded">{config.impersonate_email}</code>
                </span>
                {config.recordings_drive_folder_url ? (
                  <a
                    href={config.recordings_drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Open Shared Drive folder
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-amber-700">No Shared Drive folder configured</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setShowForceSync(true)}
            disabled={running}
            variant="outline"
            size="sm"
            data-testid="force-sync-session-btn"
            className="bg-white"
            title="Find a specific session by date+mentor and pull its recording NOW"
          >
            <Search className="w-4 h-4 mr-1" />
            Force-sync session
          </Button>
          <Button
            onClick={runSelfTest}
            disabled={running}
            variant="outline"
            size="sm"
            data-testid="recording-self-test-btn"
            className="bg-white"
          >
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Activity className="w-4 h-4 mr-1" />}
            Run health check
          </Button>
          <Button
            onClick={syncAllPending}
            disabled={running}
            variant="outline"
            size="sm"
            data-testid="recording-sync-all-btn"
            className="bg-white"
            title="Force-pull all pending recordings from Google Meet API now"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${running ? 'animate-spin' : ''}`} />
            Sync all pending
          </Button>
        </div>
      </div>

      {/* Global diagnostic banner — shows actionable issues at a glance */}
      {globalDiag?.diagnosis && globalDiag.diagnosis.length > 0 && (
        <div className="mt-3 space-y-1.5" data-testid="recording-diagnosis-banner">
          {globalDiag.diagnosis.map((line, idx) => (
            <div
              key={idx}
              className={`text-xs rounded p-2 border ${
                line.includes('✅') ? 'bg-green-50 border-green-200 text-green-800' :
                line.includes('❌') || line.includes('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-900' :
                'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Stuck sessions sample — quick links to force-sync */}
      {globalDiag?.stuck_session_samples?.length > 0 && (
        <details className="mt-3 text-xs" data-testid="stuck-sessions-list">
          <summary className="cursor-pointer text-slate-700 font-medium">
            {globalDiag.stuck_session_samples.length} recent session(s) without a recording — click to expand
          </summary>
          <div className="mt-2 space-y-1.5">
            {globalDiag.stuck_session_samples.map((s) => (
              <div key={s.id} className="bg-white rounded p-2 border border-slate-200 flex items-center justify-between gap-2">
                <div className="text-[11px] min-w-0">
                  <div className="font-mono truncate">{s.id}</div>
                  <div className="text-slate-500">
                    {s.date} · {s.time_slot || '—'} · {s.mentor_email || s.mentor_id || '—'} → {s.user_email || s.user_id}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setForceSyncForm({ date: '', mentor_email: '', candidate_email: '', session_id: s.id });
                    setShowForceSync(true);
                  }}
                  data-testid={`force-sync-${s.id}`}
                >
                  Force sync
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}

      {hasReport && expanded && (
        <div className="mt-4 space-y-2 bg-white rounded-md p-3 border border-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Health check report</p>
            <button onClick={() => setExpanded(false)} className="text-xs text-slate-500 hover:text-slate-700">Hide</button>
          </div>
          {report.test_meeting && (
            <div className="text-xs bg-slate-50 rounded p-2 border border-slate-100">
              <div className="font-medium text-slate-700 mb-1">Test meeting created</div>
              <div className="text-slate-600">
                Tier: <code className="bg-white px-1 rounded">{report.test_meeting.tier}</code>
              </div>
              <div className="text-slate-600">
                Link: <a href={report.test_meeting.meeting_uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{report.test_meeting.meeting_uri}</a>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                You can join this test meeting briefly to verify recording — Google will produce artifacts within ~10 minutes after the call ends. Then click "Sync all pending" above.
              </div>
            </div>
          )}
          {report.steps.map((step, idx) => (
            <div
              key={idx}
              className={`text-xs rounded border p-2 ${step.ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
              data-testid={`recording-step-${step.name}`}
            >
              <div className="flex items-start gap-2">
                {step.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{step.name.replace(/_/g, ' ')}</p>
                  <p className="text-slate-600 mt-0.5 break-words">{step.detail}</p>
                  {step.remediation && !step.ok && (
                    <p className="mt-1.5 text-amber-800 font-medium border-l-2 border-amber-400 pl-2">
                      Action: {step.remediation}
                    </p>
                  )}
                  {step.attempts && step.attempts.length > 0 && (
                    <details className="mt-1 text-[11px] text-slate-500">
                      <summary className="cursor-pointer">Show raw attempts</summary>
                      <pre className="mt-1 p-1.5 bg-slate-50 rounded overflow-x-auto">{JSON.stringify(step.attempts, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
          {report.error && (
            <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-700">
              {report.error}
            </div>
          )}
        </div>
      )}

      {/* Force-sync modal — find session by date+mentor+candidate and pull recording NOW */}
      {showForceSync && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowForceSync(false)} data-testid="force-sync-modal">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Force-sync a specific session</h3>
                <p className="text-xs text-slate-500 mt-0.5">Find the session by ID, or by date + mentor/candidate email, then pull its recording from Google Meet RIGHT NOW.</p>
              </div>
              <button onClick={() => setShowForceSync(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Session ID (optional, fastest)</label>
                <input
                  type="text"
                  value={forceSyncForm.session_id}
                  onChange={(e) => setForceSyncForm({ ...forceSyncForm, session_id: e.target.value })}
                  placeholder="booking-xyz123 or strategy-xyz123"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                  data-testid="force-sync-session-id-input"
                />
              </div>
              <div className="text-xs text-slate-500 -my-1">— OR look up by criteria —</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={forceSyncForm.date}
                    onChange={(e) => setForceSyncForm({ ...forceSyncForm, date: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    data-testid="force-sync-date-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Mentor email</label>
                  <input
                    type="email"
                    value={forceSyncForm.mentor_email}
                    onChange={(e) => setForceSyncForm({ ...forceSyncForm, mentor_email: e.target.value })}
                    placeholder="mentor@example.com"
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    data-testid="force-sync-mentor-email-input"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Candidate email (optional, narrows match)</label>
                <input
                  type="email"
                  value={forceSyncForm.candidate_email}
                  onChange={(e) => setForceSyncForm({ ...forceSyncForm, candidate_email: e.target.value })}
                  placeholder="candidate@example.com"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  data-testid="force-sync-candidate-email-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowForceSync(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={submitForceSync}
                  disabled={forceSyncing || (!forceSyncForm.session_id && !forceSyncForm.date)}
                  data-testid="force-sync-submit-btn"
                >
                  {forceSyncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Find & sync now
                </Button>
              </div>

              {/* Result */}
              {forceSyncResult && (
                <div className="mt-3 p-3 rounded border border-slate-200 bg-slate-50 text-xs space-y-2" data-testid="force-sync-result">
                  {forceSyncResult.error ? (
                    <div className="text-red-700 font-medium">❌ {forceSyncResult.error}</div>
                  ) : (
                    <>
                      <div>
                        <div className="font-medium text-slate-800">Session found:</div>
                        <div className="font-mono text-[11px] text-slate-600">{forceSyncResult.session?.id} ({forceSyncResult.session?.collection})</div>
                        <div className="text-slate-600">{forceSyncResult.session?.date} · {forceSyncResult.session?.time_slot} · {forceSyncResult.session?.mentor_email} → {forceSyncResult.session?.user_email}</div>
                      </div>
                      {forceSyncResult.session?.recording_url_after ? (
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <div className="font-medium text-green-800">✅ Recording URL fetched</div>
                          <a href={forceSyncResult.session.recording_url_after} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline break-all">
                            {forceSyncResult.session.recording_url_after}
                          </a>
                          {forceSyncResult.session?.recording_drive_moved_after === false && (
                            <div className="mt-1 text-amber-800">⚠️ Recording exists but did NOT move to Shared Drive (Drive scope or Shared-Drive Manager permission missing).</div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-900">
                          <div className="font-medium">⚠️ No recording_url found yet</div>
                          {forceSyncResult.error && <div className="mt-1">{forceSyncResult.error}</div>}
                        </div>
                      )}
                      {forceSyncResult.diagnosis?.map((d, i) => (
                        <div key={i} className="text-slate-700">{d}</div>
                      ))}
                      <details>
                        <summary className="cursor-pointer text-slate-500">Raw response</summary>
                        <pre className="mt-1 p-2 bg-white rounded overflow-x-auto text-[10px]">{JSON.stringify(forceSyncResult, null, 2)}</pre>
                      </details>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export const CoachingSessionsSection = () => {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    mentor_id: '',
    date_from: '',
    date_to: '',
    search: '',
    booking_type: '',
  });
  
  // Quick date filter
  const [quickDateFilter, setQuickDateFilter] = useState('');
  
  // Debounced filters for API calls
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  
  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [filters]);
  
  // Detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [syncingRecording, setSyncingRecording] = useState(false);
  // Manual recording URL assignment
  const [setRecordingModalOpen, setSetRecordingModalOpen] = useState(false);
  const [manualRecordingUrl, setManualRecordingUrl] = useState('');
  const [manualTranscriptUrl, setManualTranscriptUrl] = useState('');
  const [savingRecordingUrl, setSavingRecordingUrl] = useState(false);

  
  // Status update modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Delete feedback confirmation modal
  const [deleteFeedbackModalOpen, setDeleteFeedbackModalOpen] = useState(false);
  const [deleteFeedbackType, setDeleteFeedbackType] = useState(null); // 'mentor' or 'candidate'
  const [deletingFeedback, setDeletingFeedback] = useState(false);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Manual session creation modal
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [mentorsList, setMentorsList] = useState([]);
  const [candidatesList, setCandidatesList] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState({
    mentor_id: '',
    candidate_id: '',
    date: '',
    time_slot: '',
    session_type: '',
    case_type: '',
    admin_remarks: '',
    booking_type: 'coaching',
    deduct_credit: false
  });

  useEffect(() => {
    loadStats();
    loadSessions();
  }, [page, debouncedFilters]);

  // Real-time refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadSessions();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, page, debouncedFilters]);

  // Load mentors when add session modal opens
  useEffect(() => {
    if (addSessionModalOpen) {
      loadMentorsForSession();
    }
  }, [addSessionModalOpen]);

  // Search candidates when typing
  useEffect(() => {
    if (addSessionModalOpen) {
      const timer = setTimeout(() => {
        loadCandidatesForSession(candidateSearch);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [candidateSearch, addSessionModalOpen]);

  const loadMentorsForSession = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/mentors-list`, { withCredentials: true });
      setMentorsList(res.data.mentors || []);
    } catch (error) {
      console.error('Failed to load mentors:', error);
    }
  };

  const loadCandidatesForSession = async (search = '') => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/candidates-list?search=${encodeURIComponent(search)}`, { withCredentials: true });
      setCandidatesList(res.data.candidates || []);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    }
  };

  const handleCreateManualSession = async () => {
    // Basic validation
    if (!newSession.mentor_id || !newSession.candidate_id || !newSession.date || !newSession.time_slot) {
      alert('Please fill all required fields');
      return;
    }

    // Session type is required only for coaching sessions
    if (newSession.booking_type === 'coaching' && !newSession.session_type) {
      alert('Please select a session type for coaching sessions');
      return;
    }

    // Case type required for Case sessions
    if (newSession.booking_type === 'coaching' && newSession.session_type === 'Case session' && !newSession.case_type) {
      alert('Please select a case type for Case sessions');
      return;
    }

    setCreatingSession(true);
    try {
      const result = await axios.post(`${BACKEND_URL}/api/admin/coaching-sessions/manual`, newSession, { withCredentials: true });
      setAddSessionModalOpen(false);
      setNewSession({
        mentor_id: '',
        candidate_id: '',
        date: '',
        time_slot: '',
        session_type: '',
        case_type: '',
        admin_remarks: '',
        booking_type: 'coaching',
        deduct_credit: false
      });
      setCandidateSearch('');
      loadSessions();
      loadStats();
      const creditMsg = result.data.credit_deducted ? ' (Credit deducted from candidate)' : ' (No credit deducted)';
      alert('Session created successfully!' + creditMsg);
    } catch (error) {
      alert('Failed to create session: ' + (error.response?.data?.detail || error.message));
    } finally {
      setCreatingSession(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/stats`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 20 });
      if (debouncedFilters.status) params.append('status', debouncedFilters.status);
      if (debouncedFilters.mentor_id) params.append('mentor_id', debouncedFilters.mentor_id);
      if (debouncedFilters.date_from) params.append('date_from', debouncedFilters.date_from);
      if (debouncedFilters.date_to) params.append('date_to', debouncedFilters.date_to);
      if (debouncedFilters.search) params.append('search', debouncedFilters.search);
      if (debouncedFilters.booking_type) params.append('booking_type', debouncedFilters.booking_type);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions?${params}`, { withCredentials: true });
      setSessions(res.data.sessions);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = async (session) => {
    setSelectedSession(session);
    setDetailModalOpen(true);
    setLoadingDetails(true);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/coaching-sessions/${session.id}`, { withCredentials: true });
      setSessionDetails(res.data);
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openStatusModal = (session) => {
    setSelectedSession(session);
    setNewStatus(session.status);
    setStatusNotes('');
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedSession) return;
    
    setUpdatingStatus(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/coaching-sessions/${selectedSession.id}/update-status`,
        { status: newStatus, notes: statusNotes },
        { withCredentials: true }
      );
      setStatusModalOpen(false);
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to update status: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Delete feedback handlers
  const openDeleteFeedbackModal = (type) => {
    setDeleteFeedbackType(type);
    setDeleteFeedbackModalOpen(true);
  };

  const handleDeleteFeedback = async () => {
    if (!sessionDetails || !deleteFeedbackType) return;
    
    setDeletingFeedback(true);
    try {
      const endpoint = deleteFeedbackType === 'mentor' 
        ? `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}/mentor-feedback`
        : `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}/candidate-feedback`;
      
      await axios.delete(endpoint, { withCredentials: true });
      
      alert(deleteFeedbackType === 'mentor' 
        ? 'Mentor feedback deleted successfully. Payout is now on hold.'
        : 'Candidate feedback deleted successfully. Candidate will see feedback prompt on next login.');
      
      setDeleteFeedbackModalOpen(false);
      setDeleteFeedbackType(null);
      
      // Refresh session details
      const res = await axios.get(
        `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}`,
        { withCredentials: true }
      );
      setSessionDetails(res.data);
      
      // Refresh sessions list
      loadSessions();
      loadStats();
    } catch (error) {
      alert('Failed to delete feedback: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeletingFeedback(false);
    }
  };

  const clearFilters = () => {
    setFilters({ status: '', mentor_id: '', date_from: '', date_to: '', search: '', booking_type: '' });
    setQuickDateFilter('');
    setPage(1);
  };

  // Quick date filter helper
  const applyQuickDateFilter = (filterType) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    let dateFrom = '';
    let dateTo = '';
    
    if (filterType === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      dateFrom = formatDate(yesterday);
      dateTo = formatDate(yesterday);
    } else if (filterType === 'today') {
      dateFrom = formatDate(today);
      dateTo = formatDate(today);
    } else if (filterType === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateFrom = formatDate(tomorrow);
      dateTo = formatDate(tomorrow);
    } else if (filterType === 'this_week') {
      // Monday to Sunday of current week
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + diffToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      dateFrom = formatDate(startOfWeek);
      dateTo = formatDate(endOfWeek);
    } else if (filterType === 'last_week') {
      // Monday to Sunday of last week
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + diffToMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      dateFrom = formatDate(lastMonday);
      dateTo = formatDate(lastSunday);
    }
    
    setQuickDateFilter(filterType);
    setFilters(f => ({ ...f, date_from: dateFrom, date_to: dateTo }));
    setPage(1);
  };

  const getStatusBadge = (status, session = null) => {
    const statusStyles = {
      'confirmed': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'mentor_no_show': 'bg-red-100 text-red-700',
      'candidate_no_show': 'bg-orange-100 text-orange-700',
      'both_no_show': 'bg-red-200 text-red-800',
      'mentor_cancelled': 'bg-slate-100 text-slate-700',
      'candidate_cancelled': 'bg-slate-100 text-slate-700',
      'admin_cancelled': 'bg-red-100 text-red-700',
      'mentor_rescheduled': 'bg-purple-100 text-purple-700',
      'candidate_rescheduled': 'bg-purple-100 text-purple-700',
      'admin_rescheduled': 'bg-indigo-100 text-indigo-700',
      // Legacy statuses for backward compatibility
      'pending': 'bg-amber-100 text-amber-700',
      'cancelled': 'bg-slate-100 text-slate-700',
      'cancelled_by_candidate': 'bg-slate-100 text-slate-700',
      'cancelled_by_mentor': 'bg-slate-100 text-slate-700',
      'cancelled_by_admin': 'bg-red-100 text-red-700',
      'no_show': 'bg-red-100 text-red-700',
      'rescheduled': 'bg-purple-100 text-purple-700',
    };
    
    const statusLabels = {
      'confirmed': 'Confirmed',
      'completed': 'Completed',
      'mentor_no_show': 'Mentor No Show',
      'candidate_no_show': 'Candidate No Show',
      'both_no_show': 'Both No Show',
      'mentor_cancelled': 'Mentor Cancelled',
      'candidate_cancelled': 'Candidate Cancelled',
      'admin_cancelled': 'Admin Cancelled',
      'mentor_rescheduled': 'Mentor Rescheduled',
      'candidate_rescheduled': 'Candidate Rescheduled',
      'admin_rescheduled': 'Admin Rescheduled',
      // Legacy
      'pending': 'Pending',
      'cancelled': 'Cancelled',
      'no_show': 'No Show',
      'rescheduled': 'Rescheduled',
    };
    
    // Special handling for legacy rescheduled status - show who rescheduled
    if (status === 'rescheduled' && session) {
      const byWhom = session.rescheduled_by_name || session.rescheduled_by || 'someone';
      return (
        <span 
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles['rescheduled']}`}
          title={`Rescheduled to ${session.rescheduled_to_date} at ${session.rescheduled_to_time}`}
        >
          Rescheduled by {byWhom}
        </span>
      );
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
        {statusLabels[status] || status?.replace(/_/g, ' ')}
      </span>
    );
  };

  const handleExportExcel = async () => {
    try {
      // Build query params from current filters
      const params = new URLSearchParams();
      if (debouncedFilters.status) params.append('status', debouncedFilters.status);
      if (debouncedFilters.mentor_id) params.append('mentor_id', debouncedFilters.mentor_id);
      if (debouncedFilters.date_from) params.append('date_from', debouncedFilters.date_from);
      if (debouncedFilters.date_to) params.append('date_to', debouncedFilters.date_to);
      if (debouncedFilters.search) params.append('search', debouncedFilters.search);
      if (debouncedFilters.booking_type) params.append('booking_type', debouncedFilters.booking_type);
      
      const queryString = params.toString();
      const url = `${BACKEND_URL}/api/admin/coaching-sessions/export-excel${queryString ? '?' + queryString : ''}`;
      
      const response = await axios.get(url, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Include filter info in filename if filters are applied
      const hasFilters = debouncedFilters.status || debouncedFilters.date_from || debouncedFilters.date_to || debouncedFilters.mentor_id;
      const filterSuffix = hasFilters ? '_filtered' : '_all';
      link.download = `coaching_sessions${filterSuffix}_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      alert('Failed to download Excel: ' + (error.response?.data?.detail || error.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="coaching-sessions-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coaching Sessions Tracking</h1>
          <p className="text-sm text-slate-500">Monitor all sessions in real-time (Coaching: 45 min, Strategy: 30 min)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportExcel}
            variant="outline"
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Excel
          </Button>
          <Button onClick={() => setAddSessionModalOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Session
          </Button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <Button onClick={() => { loadSessions(); loadStats(); }} variant="outline" size="sm">
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Recording Health Check */}
      <RecordingHealthCheck />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">Today</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sessions_today}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500">This Week</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.sessions_this_week}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-600">Confirmed</p>
            <p className="text-2xl font-bold text-amber-700">{stats.by_status?.confirmed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <p className="text-sm text-green-600">Completed</p>
            <p className="text-2xl font-bold text-green-700">{stats.by_status?.completed || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50">
            <p className="text-sm text-red-600">No Show</p>
            <p className="text-2xl font-bold text-red-700">{stats.by_status?.no_show || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Search & Filters</span>
        </div>
        
        {/* Quick Date Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-slate-500 mr-2">Quick Filters:</span>
          <Button 
            variant={quickDateFilter === 'yesterday' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('yesterday')}
            className="h-7 text-xs"
          >
            Yesterday
          </Button>
          <Button 
            variant={quickDateFilter === 'today' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('today')}
            className="h-7 text-xs"
          >
            Today
          </Button>
          <Button 
            variant={quickDateFilter === 'tomorrow' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('tomorrow')}
            className="h-7 text-xs"
          >
            Tomorrow
          </Button>
          <Button 
            variant={quickDateFilter === 'this_week' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('this_week')}
            className="h-7 text-xs"
          >
            This Week
          </Button>
          <Button 
            variant={quickDateFilter === 'last_week' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => applyQuickDateFilter('last_week')}
            className="h-7 text-xs"
          >
            Last Week
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
              data-testid="coaching-filter-search"
            />
          </div>

          <Select value={filters.status || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, status: v === 'all' ? '' : v })); setPage(1); }}>
            <SelectTrigger data-testid="coaching-filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="mentor_no_show">Mentor No Show</SelectItem>
              <SelectItem value="candidate_no_show">Candidate No Show</SelectItem>
              <SelectItem value="both_no_show">Both No Show</SelectItem>
              <SelectItem value="mentor_cancelled">Mentor Cancelled</SelectItem>
              <SelectItem value="candidate_cancelled">Candidate Cancelled</SelectItem>
              <SelectItem value="mentor_rescheduled">Mentor Rescheduled</SelectItem>
              <SelectItem value="candidate_rescheduled">Candidate Rescheduled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.booking_type || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, booking_type: v === 'all' ? '' : v })); setPage(1); }}>
            <SelectTrigger data-testid="coaching-filter-booking-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Session Types</SelectItem>
              <SelectItem value="coaching">Coaching Sessions</SelectItem>
              <SelectItem value="strategy_call">Strategy Calls</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.mentor_id || 'all'} onValueChange={(v) => { setFilters(f => ({ ...f, mentor_id: v === 'all' ? '' : v })); setPage(1); }}>
            <SelectTrigger data-testid="coaching-filter-mentor">
              <SelectValue placeholder="All Mentors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mentors</SelectItem>
              {stats?.mentors?.map(mentor => (
                <SelectItem key={mentor.id} value={mentor.id}>{mentor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => { setFilters(f => ({ ...f, date_from: e.target.value })); setQuickDateFilter(''); }}
            placeholder="From Date"
            data-testid="coaching-filter-date-from"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => { setFilters(f => ({ ...f, date_to: e.target.value })); setQuickDateFilter(''); }}
            placeholder="To Date"
            data-testid="coaching-filter-date-to"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Sessions Table.
          Table layout note: 10 separate columns made the page require
          horizontal scroll on most laptops. We merged related fields
          (Mentor + check-in into one cell, Candidate + check-in into
          one cell, both feedbacks into a single Feedback cell) so the
          table fits 1280-1440px wide screens without scrolling.   */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mentor</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Candidate</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Feedback</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Recording</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {filters.search ? `No sessions found for "${filters.search}"` : 'No sessions found'}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 align-top" data-testid={`coaching-session-row-${session.id}`}>
                    <td className="px-3 py-3" data-testid={`coaching-session-times-${session.id}`}>
                      {(() => {
                        const ist = `${session.time_slot || ''}`;
                        const mentorTz = session.mentor_timezone || 'Asia/Kolkata';
                        const candTz = session.candidate_timezone || 'Asia/Kolkata';
                        const istConv = { date: session.date, time: ist };
                        const mentorConv = istToViewer(session.date, ist, mentorTz);
                        const candConv = istToViewer(session.date, ist, candTz);
                        const Row = ({ label, time, tz, dateStr, highlight }) => (
                          <div className={`flex items-baseline gap-1.5 text-xs ${highlight ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                            <span className="w-14 shrink-0 uppercase tracking-wide" style={{ fontSize: '10px', color: highlight ? '#1e40af' : '#64748b' }}>{label}</span>
                            <span>{time ? format12hWithAbbr(time, tz) : '—'}</span>
                            {dateStr && dateStr !== session.date && (
                              <span className="text-[10px] text-amber-600">({dateStr})</span>
                            )}
                          </div>
                        );
                        return (
                          <div className="space-y-0.5 min-w-[150px]">
                            <p className="font-medium text-slate-900 text-sm mb-0.5">{session.date}</p>
                            <Row label="Mentor" time={mentorConv.time} tz={mentorTz} dateStr={mentorConv.date} />
                            <Row label="Candid." time={candConv.time} tz={candTz} dateStr={candConv.date} />
                            <Row label="IST" time={istConv.time} tz="Asia/Kolkata" dateStr={istConv.date} highlight />
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          session.booking_type === 'strategy_call' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {session.booking_type === 'strategy_call' ? 'Strategy Call' : (session.session_type || 'Coaching')}
                        </span>
                        {session.case_type && (
                          <p className="text-xs text-purple-600 font-medium">{session.case_type}</p>
                        )}
                      </div>
                    </td>
                    {/* Mentor cell: photo + name + email + check-in stacked */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2 min-w-[160px]">
                        <img 
                          src={session.mentor_picture || `https://ui-avatars.com/api/?name=${session.mentor_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{session.mentor_name}</p>
                          <p className="text-xs text-slate-500 truncate">{session.mentor_email}</p>
                          {session.mentor_checked_in ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-700 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Joined{session.mentor_checked_in_at && (
                                <> {new Date(session.mentor_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 mt-0.5">Not joined</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Candidate cell: same layout as Mentor */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2 min-w-[160px]">
                        <img 
                          src={session.candidate_picture || `https://ui-avatars.com/api/?name=${session.candidate_name}&background=random`} 
                          alt="" 
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{session.candidate_name}</p>
                          <p className="text-xs text-slate-500 truncate">{session.candidate_email}</p>
                          {session.candidate_plan && (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded mt-0.5">
                              {session.candidate_plan.replace('_', ' ')}
                            </span>
                          )}
                          {session.candidate_checked_in ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-700 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Joined{session.candidate_checked_in_at && (
                                <> {new Date(session.candidate_checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 mt-0.5 block">Not joined</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {getStatusBadge(session.status, session)}
                      {session.completion_status && (
                        <p className="text-xs text-slate-500 mt-1">{session.completion_status}</p>
                      )}
                    </td>
                    {/* Feedback cell — combined mentor + candidate */}
                    <td className="px-3 py-3">
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-14">Mentor:</span>
                          {session.mentor_feedback_given ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {session.mentor_feedback_rating && (
                                <>
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {session.mentor_feedback_rating}
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 w-14">Candid.:</span>
                          {session.candidate_feedback_given ? (
                            <span className="flex items-center gap-1 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {session.candidate_feedback_rating && (
                                <>
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {session.candidate_feedback_rating}
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Recording / transcript links — populated by the
                        background scheduler (every 30 min) or by the
                        admin "Sync recording" button in the details
                        modal. Empty until artifacts are produced. */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        {session.recording_url ? (
                          <a
                            href={session.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            data-testid={`recording-link-${session.id}`}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Recording
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {session.transcript_url && (
                          <a
                            href={session.transcript_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            data-testid={`transcript-link-${session.id}`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Transcript
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetails(session)}
                          data-testid={`view-coaching-session-${session.id}`}
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatusModal(session)}
                          data-testid={`edit-coaching-session-${session.id}`}
                          title="Update Status"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} sessions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coaching Session Details</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Reschedule Alert - For original session that was rescheduled */}
              {sessionDetails.session?.status === 'rescheduled' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-medium text-purple-700">📅 This session was rescheduled to a new date</p>
                  <p className="text-xs text-purple-600 mt-1">
                    New session: {sessionDetails.session?.rescheduled_to_date} at {sessionDetails.session?.rescheduled_to_time}
                  </p>
                  <p className="text-xs text-purple-600">
                    By: {sessionDetails.session?.rescheduled_by_name || sessionDetails.session?.rescheduled_by || 'Unknown'}
                  </p>
                  {sessionDetails.session?.rescheduled_at && (
                    <p className="text-xs text-purple-500 mt-1">
                      {new Date(sessionDetails.session?.rescheduled_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
              
              {/* Reschedule Info - For new session that came from reschedule */}
              {sessionDetails.session?.rescheduled_from_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">📅 This session was created from a reschedule</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Originally: {sessionDetails.session?.rescheduled_from_date} at {sessionDetails.session?.rescheduled_from_time}
                  </p>
                </div>
              )}
              
              {/* Session Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Date & Time</h4>
                  {(() => {
                    const s = sessionDetails.session || {};
                    const ist = s.time_slot || '';
                    const mentorTz = s.mentor_timezone || 'Asia/Kolkata';
                    const candTz = s.candidate_timezone || 'Asia/Kolkata';
                    const mentorConv = istToViewer(s.date, ist, mentorTz);
                    const candConv = istToViewer(s.date, ist, candTz);
                    return (
                      <div className="space-y-0.5">
                        <p className="text-slate-900 font-medium">{s.date}</p>
                        <p className="text-xs text-slate-600">
                          <span className="inline-block w-20 uppercase tracking-wide" style={{ fontSize: '10px', color: '#64748b' }}>Mentor</span>
                          {ist ? format12hWithAbbr(mentorConv.time, mentorTz) : '—'}
                          {mentorConv.date !== s.date && <span className="ml-1 text-amber-600">({mentorConv.date})</span>}
                        </p>
                        <p className="text-xs text-slate-600">
                          <span className="inline-block w-20 uppercase tracking-wide" style={{ fontSize: '10px', color: '#64748b' }}>Candidate</span>
                          {ist ? format12hWithAbbr(candConv.time, candTz) : '—'}
                          {candConv.date !== s.date && <span className="ml-1 text-amber-600">({candConv.date})</span>}
                        </p>
                        <p className="text-xs font-semibold text-blue-700">
                          <span className="inline-block w-20 uppercase tracking-wide" style={{ fontSize: '10px', color: '#1e40af' }}>IST</span>
                          {ist ? format12hWithAbbr(ist, 'Asia/Kolkata') : '—'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Status</h4>
                  {getStatusBadge(sessionDetails.session?.status, sessionDetails.session)}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Session Type</h4>
                  <p className="text-slate-900">{sessionDetails.session?.session_type || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Completion Status</h4>
                  <p className="text-slate-900">{sessionDetails.session?.completion_status || 'N/A'}</p>
                </div>
              </div>

              {/* Mentor Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Mentor</h4>
                <div className="flex items-center gap-3">
                  <img 
                    src={sessionDetails.mentor?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.mentor?.name}&background=random`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{sessionDetails.mentor?.name}</p>
                    <p className="text-sm text-slate-500">{sessionDetails.mentor?.email}</p>
                    <p className="text-xs text-slate-400">{sessionDetails.mentor?.title} at {sessionDetails.mentor?.company}</p>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className={sessionDetails.session?.mentor_checked_in ? 'text-green-600' : 'text-slate-400'}>
                    {sessionDetails.session?.mentor_checked_in 
                      ? `✓ Checked in at ${new Date(sessionDetails.session?.mentor_checked_in_at).toLocaleString()}`
                      : '✗ Not checked in'}
                  </span>
                </div>
              </div>

              {/* Candidate Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Candidate</h4>
                <div className="flex items-center gap-3">
                  <img 
                    src={sessionDetails.candidate?.picture || `https://ui-avatars.com/api/?name=${sessionDetails.candidate?.name}&background=random`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-slate-900">{sessionDetails.candidate?.name}</p>
                    <p className="text-sm text-slate-500">{sessionDetails.candidate?.email}</p>
                    {sessionDetails.candidate?.plan && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {sessionDetails.candidate?.plan.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className={sessionDetails.session?.candidate_checked_in ? 'text-green-600' : 'text-slate-400'}>
                    {sessionDetails.session?.candidate_checked_in 
                      ? `✓ Checked in at ${new Date(sessionDetails.session?.candidate_checked_in_at).toLocaleString()}`
                      : '✗ Not checked in'}
                  </span>
                </div>
              </div>

              {/* Recording / transcript section.
                  Pulls from booking.recording_url + booking.transcript_url.
                  The Sync button fires the admin-only
                  /api/admin/coaching-sessions/{id}/sync-recording
                  endpoint, which queries Google's Meet REST API for the
                  latest artifact URLs and writes them back. Useful when
                  the admin needs the recording immediately, before the
                  next 30-min scheduler cycle.                          */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700">Recording &amp; Transcript</h4>
                  {sessionDetails.session?.meet_space_name && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setSyncingRecording(true);
                          const res = await axios.post(
                            `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails.session.id}/sync-recording`,
                            {},
                            { withCredentials: true },
                          );
                          // Patch the in-modal state so the new URLs render immediately
                          setSessionDetails((prev) => ({
                            ...prev,
                            session: {
                              ...prev.session,
                              recording_url: res.data?.recording_url || prev.session?.recording_url,
                              transcript_url: res.data?.transcript_url || prev.session?.transcript_url,
                              meet_artifacts_checked_at: res.data?.checked_at || prev.session?.meet_artifacts_checked_at,
                            },
                          }));
                          if (!res.data?.recording_url && !res.data?.transcript_url) {
                            alert('No recording is available yet — Google may still be processing the meeting. Try again in a few minutes.');
                          }
                        } catch (err) {
                          alert(`Sync failed: ${err?.response?.data?.detail || err.message}`);
                        } finally {
                          setSyncingRecording(false);
                        }
                      }}
                      disabled={syncingRecording}
                      data-testid={`sync-recording-${sessionDetails.session?.id}`}
                    >
                      {syncingRecording ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Syncing…</>
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync now</>
                      )}
                    </Button>
                  )}
                </div>
                {sessionDetails.session?.recording_url || sessionDetails.session?.transcript_url ? (
                  <div className="space-y-2">
                    {sessionDetails.session?.recording_url && (
                      <a
                        href={sessionDetails.session.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <PlayCircle className="w-4 h-4" />
                        View recording on Google Drive
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {sessionDetails.session?.transcript_url && (
                      <a
                        href={sessionDetails.session.transcript_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        View transcript on Google Docs
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {sessionDetails.session?.meet_artifacts_checked_at && (
                      <p className="text-xs text-slate-400">
                        Last checked: {new Date(sessionDetails.session.meet_artifacts_checked_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : sessionDetails.session?.meet_space_name ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500">
                      No recording is available yet. Google generates artifacts a few minutes after the call ends — the system polls every 10 min and will move it to the Shared Drive folder automatically. Or click "Sync now" above to fetch immediately.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-slate-600 hover:text-slate-900"
                        onClick={async () => {
                          try {
                            const res = await axios.get(
                              `${BACKEND_URL}/api/admin/recordings/diagnose/${sessionDetails.session.id}`,
                              { withCredentials: true },
                            );
                            alert(
                              'Diagnosis: ' + (res.data.diagnosis || 'No diagnosis available') +
                              '\n\nMeet space: ' + (res.data.meet_space_name || '(none)') +
                              '\nLast checked: ' + (res.data.meet_artifacts_checked_at || 'never') +
                              '\nDrive moved: ' + (res.data.recording_drive_moved ? 'yes' : 'no') +
                              '\nLive Meet API found ' + ((res.data.live_artifacts?.recordings || []).length) + ' recording(s)'
                            );
                            console.log('Recording diagnose result:', res.data);
                          } catch (err) {
                            alert(`Diagnose failed: ${err?.response?.data?.detail || err.message}`);
                          }
                        }}
                        data-testid={`diagnose-recording-${sessionDetails.session?.id}`}
                      >
                        <Activity className="w-3 h-3 mr-1" />
                        Diagnose
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-blue-600 hover:text-blue-900"
                        onClick={() => {
                          setManualRecordingUrl(sessionDetails.session?.recording_url || '');
                          setManualTranscriptUrl(sessionDetails.session?.transcript_url || '');
                          setSetRecordingModalOpen(true);
                        }}
                      >
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Set manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-400 mb-3">
                      No recording linked yet. You can manually paste the Google Drive recording link (e.g. from kashish@gradnext.co's Drive).
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs"
                      onClick={() => {
                        setManualRecordingUrl(sessionDetails.session?.recording_url || '');
                        setManualTranscriptUrl(sessionDetails.session?.transcript_url || '');
                        setSetRecordingModalOpen(true);
                      }}
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                      Set recording URL manually
                    </Button>
                  </div>
                )}
              </div>

              {/* Mentor Feedback */}
              {sessionDetails.mentor_feedback && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-700">Mentor Feedback</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openDeleteFeedbackModal('mentor')}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Feedback
                    </Button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Overall Rating:</strong> {sessionDetails.mentor_feedback.rating_overall}/5</p>
                    {sessionDetails.mentor_feedback.qualitative_feedback && (
                      <p className="text-sm"><strong>Notes:</strong> {sessionDetails.mentor_feedback.qualitative_feedback}</p>
                    )}
                    {sessionDetails.mentor_feedback.areas_of_strength && (
                      <p className="text-sm"><strong>Strengths:</strong> {sessionDetails.mentor_feedback.areas_of_strength.join(', ')}</p>
                    )}
                    {sessionDetails.mentor_feedback.areas_of_improvement && (
                      <p className="text-sm"><strong>Areas to Improve:</strong> {sessionDetails.mentor_feedback.areas_of_improvement.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Candidate Feedback */}
              {sessionDetails.candidate_feedback && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-700">Candidate Feedback</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openDeleteFeedbackModal('candidate')}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Feedback
                    </Button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <p className="text-sm"><strong>Rating:</strong> {sessionDetails.candidate_feedback.rating_overall}/5</p>
                    {sessionDetails.candidate_feedback.comments && (
                      <p className="text-sm"><strong>Comments:</strong> {sessionDetails.candidate_feedback.comments}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-500">Failed to load session details</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Feedback Confirmation Modal */}
      <Dialog open={deleteFeedbackModalOpen} onOpenChange={setDeleteFeedbackModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete {deleteFeedbackType === 'mentor' ? 'Mentor' : 'Candidate'} Feedback</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this feedback? This action will:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {deleteFeedbackType === 'mentor' ? (
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Delete the mentor's feedback for this session</li>
                <li><strong>Put the payout on hold</strong> until new feedback is submitted</li>
                <li>Allow the mentor to submit feedback again</li>
                <li>Create an audit log of this deletion</li>
              </ul>
            ) : (
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>Delete the candidate's feedback for this session</li>
                <li>Allow the candidate to submit feedback again</li>
                <li>Candidate will see feedback prompt on next login</li>
                <li>Create an audit log of this deletion</li>
              </ul>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> The original feedback will be stored in the audit log for reference.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteFeedback}
              disabled={deletingFeedback}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingFeedback ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Recording URL Modal */}
      <Dialog open={setRecordingModalOpen} onOpenChange={(v) => { setSetRecordingModalOpen(v); if (!v) { setManualRecordingUrl(''); setManualTranscriptUrl(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-blue-600" />
              Set Recording URL
            </DialogTitle>
            <DialogDescription>
              Paste the Google Drive (or any) recording link for this session. Use this when the session was recorded manually or is in Kashish's Drive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Recording URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://drive.google.com/file/..."
                value={manualRecordingUrl}
                onChange={(e) => setManualRecordingUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Transcript URL <span className="text-xs text-slate-400">(optional)</span></label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://docs.google.com/..."
                value={manualTranscriptUrl}
                onChange={(e) => setManualTranscriptUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetRecordingModalOpen(false)}>Cancel</Button>
            <Button
              disabled={!manualRecordingUrl || savingRecordingUrl}
              onClick={async () => {
                if (!manualRecordingUrl) return;
                setSavingRecordingUrl(true);
                try {
                  await axios.patch(
                    `${BACKEND_URL}/api/admin/coaching-sessions/${sessionDetails?.session?.id}/set-recording`,
                    { recording_url: manualRecordingUrl, transcript_url: manualTranscriptUrl || undefined },
                    { withCredentials: true },
                  );
                  setSessionDetails((prev) => ({
                    ...prev,
                    session: {
                      ...prev.session,
                      recording_url: manualRecordingUrl,
                      transcript_url: manualTranscriptUrl || prev.session?.transcript_url,
                      recording_set_manually: true,
                    },
                  }));
                  setSetRecordingModalOpen(false);
                  setManualRecordingUrl('');
                  setManualTranscriptUrl('');
                } catch (err) {
                  alert(`Failed to save: ${err?.response?.data?.detail || err.message}`);
                } finally {
                  setSavingRecordingUrl(false);
                }
              }}
            >
              {savingRecordingUrl ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save recording URL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Session Status</DialogTitle>
            <DialogDescription>
              Change status for session on {selectedSession?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="mentor_no_show">Mentor No Show</SelectItem>
                  <SelectItem value="candidate_no_show">Candidate No Show</SelectItem>
                  <SelectItem value="both_no_show">Both No Show</SelectItem>
                  <SelectItem value="mentor_cancelled">Mentor Cancelled</SelectItem>
                  <SelectItem value="candidate_cancelled">Candidate Cancelled</SelectItem>
                  <SelectItem value="admin_cancelled">Admin Cancelled</SelectItem>
                  <SelectItem value="mentor_rescheduled">Mentor Rescheduled</SelectItem>
                  <SelectItem value="candidate_rescheduled">Candidate Rescheduled</SelectItem>
                  <SelectItem value="admin_rescheduled">Admin Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add any notes about this status change..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Status
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Manual Session Modal */}
      <Dialog open={addSessionModalOpen} onOpenChange={setAddSessionModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add Manual Session
            </DialogTitle>
            <DialogDescription>
              Create a coaching session manually. This will override mentor availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Session Type (Coaching vs Strategy Call) */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Session Category <span className="text-red-500">*</span></label>
              <Select value={newSession.booking_type} onValueChange={(v) => setNewSession(s => ({ ...s, booking_type: v }))}>
                <SelectTrigger data-testid="manual-booking-type">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coaching">Coaching Session</SelectItem>
                  <SelectItem value="strategy_call">Strategy Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mentor Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Mentor <span className="text-red-500">*</span></label>
              <Select value={newSession.mentor_id} onValueChange={(v) => setNewSession(s => ({ ...s, mentor_id: v }))}>
                <SelectTrigger data-testid="manual-mentor-select">
                  <SelectValue placeholder="Select a mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentorsList.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      <div className="flex items-center gap-2">
                        <span>{mentor.name}</span>
                        <span className="text-slate-400 text-xs">({mentor.firm})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Candidate Selection with Search */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Select Candidate <span className="text-red-500">*</span></label>
              <Input
                placeholder="Search candidate by name or email..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="mb-2"
                data-testid="manual-candidate-search"
              />
              <Select value={newSession.candidate_id} onValueChange={(v) => setNewSession(s => ({ ...s, candidate_id: v }))}>
                <SelectTrigger data-testid="manual-candidate-select">
                  <SelectValue placeholder="Select a candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidatesList.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      <div className="flex items-center gap-2">
                        <span>{candidate.name}</span>
                        <span className="text-slate-400 text-xs">({candidate.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Date <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession(s => ({ ...s, date: e.target.value }))}
                  data-testid="manual-session-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Time <span className="text-red-500">*</span></label>
                <Input
                  type="time"
                  value={newSession.time_slot}
                  onChange={(e) => setNewSession(s => ({ ...s, time_slot: e.target.value }))}
                  data-testid="manual-session-time"
                />
              </div>
            </div>

            {/* Session Type - Only for Coaching Sessions */}
            {newSession.booking_type === 'coaching' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Session Type <span className="text-red-500">*</span></label>
                <Select value={newSession.session_type} onValueChange={(v) => setNewSession(s => ({ ...s, session_type: v, case_type: '' }))}>
                  <SelectTrigger data-testid="manual-session-type">
                    <SelectValue placeholder="Select session type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Case session">Case Session</SelectItem>
                    <SelectItem value="Fit Interview">Fit Interview</SelectItem>
                    <SelectItem value="PEI session">PEI Session</SelectItem>
                    <SelectItem value="CV review session">CV Review Session</SelectItem>
                    <SelectItem value="General discussion">General Discussion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Case Type (only for Case sessions within Coaching) */}
            {newSession.booking_type === 'coaching' && newSession.session_type === 'Case session' && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Case Type <span className="text-red-500">*</span></label>
                <Select value={newSession.case_type} onValueChange={(v) => setNewSession(s => ({ ...s, case_type: v }))}>
                  <SelectTrigger data-testid="manual-case-type">
                    <SelectValue placeholder="Select case type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Random">Random</SelectItem>
                    <SelectItem value="Profitability">Profitability</SelectItem>
                    <SelectItem value="Market Entry">Market Entry</SelectItem>
                    <SelectItem value="Guesstimate">Guesstimate</SelectItem>
                    <SelectItem value="Pricing">Pricing</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="M&A">M&A</SelectItem>
                    <SelectItem value="Unconventional">Unconventional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Admin Remarks */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Admin Remarks (Optional)</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                value={newSession.admin_remarks}
                onChange={(e) => setNewSession(s => ({ ...s, admin_remarks: e.target.value }))}
                placeholder="Add any notes about this session..."
                data-testid="manual-admin-remarks"
              />
            </div>

            {/* Deduct Credit Checkbox - Only for coaching sessions */}
            {newSession.booking_type === 'coaching' && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="deduct-credit"
                  checked={newSession.deduct_credit}
                  onChange={(e) => setNewSession(s => ({ ...s, deduct_credit: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  data-testid="manual-deduct-credit"
                />
                <label htmlFor="deduct-credit" className="text-sm text-blue-800">
                  <span className="font-medium">Deduct session credit from candidate</span>
                  <p className="text-xs text-blue-600 mt-0.5">
                    If checked, this will count against the candidate's coaching session quota
                  </p>
                </label>
              </div>
            )}

            {/* Info Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium">Note:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                <li>This session will bypass mentor availability checks</li>
                <li>Calendar invites will be sent to both mentor and candidate</li>
                <li>Session duration: <strong>{newSession.booking_type === 'coaching' ? '45 minutes' : '30 minutes'}</strong></li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSessionModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateManualSession} 
              disabled={creatingSession}
              className="bg-green-600 hover:bg-green-700"
            >
              {creatingSession ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
