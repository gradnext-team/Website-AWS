import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, ChevronRight, ChevronDown, Loader2,
  Video, FileText, HelpCircle, Layers, FolderOpen, BookOpen,
  GripVertical, X, Upload
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
import { ChunkedFileUpload, SimpleFileUpload } from './ChunkedFileUpload';

// DnD Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ContentTypeIcon = ({ type }) => {
  switch (type) {
    case 'video': return <Video className="w-4 h-4 text-blue-500" />;
    case 'pdf': return <FileText className="w-4 h-4 text-red-500" />;
    case 'quiz': return <HelpCircle className="w-4 h-4 text-purple-500" />;
    case 'mixed': return <Layers className="w-4 h-4 text-emerald-500" />;
    default: return <Video className="w-4 h-4 text-blue-500" />;
  }
};

// Sortable Course Item
const SortableCourse = ({ course, children, isExpanded, onToggle, onEdit, onDelete, onAddModule }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-slate-100 overflow-hidden" data-testid={`course-${course.id}`}>
      <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded">
            <GripVertical className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={onToggle}>
            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-slate-900">{course.title}</h3>
              <p className="text-sm text-slate-500">{course.modules?.length || 0} modules</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onAddModule} data-testid={`add-module-${course.id}`}>
            <Plus className="w-4 h-4 mr-1" /> Module
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
};

// Sortable Module Item
const SortableModule = ({ module, children, isExpanded, onToggle, onEdit, onDelete, onAddSession }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between p-3 hover:bg-slate-50">
        <div className="flex items-center gap-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded">
            <GripVertical className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={onToggle}>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <div>
              <span className="font-medium text-slate-800">{module.title}</span>
              <span className="text-sm text-slate-500 ml-2">({module.sessions?.length || 0} sessions)</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onAddSession} data-testid={`add-session-${module.id}`}>
            <Plus className="w-3 h-3 mr-1" /> Session
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-3 h-3 text-red-500" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
};

// Sortable Session Item
const SortableSession = ({ session, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-2 ml-4 border-l-2 border-slate-200 hover:bg-slate-50 rounded-r-lg">
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 rounded">
          <GripVertical className="w-3 h-3 text-slate-400" />
        </div>
        <ContentTypeIcon type={session.content_type} />
        <div>
          <span className="text-sm text-slate-700">{session.title}</span>
          {session.duration && <span className="text-xs text-slate-400 ml-2">{session.duration}</span>}
        </div>
        {session.is_free && (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">Free Trial</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit2 className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-red-500" />
        </Button>
      </div>
    </div>
  );
};

// Quiz Builder Component
const QuizBuilder = ({ questions = [], onChange }) => {
  const addQuestion = () => {
    onChange([
      ...questions,
      { question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    onChange(newQuestions);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    onChange(newQuestions);
  };

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-700">Quiz Questions ({questions.length})</h4>
        <Button size="sm" variant="outline" onClick={addQuestion}>
          <Plus className="w-4 h-4 mr-1" /> Add Question
        </Button>
      </div>
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <span className="text-sm font-medium text-slate-500">Question {qIndex + 1}</span>
            <Button size="sm" variant="ghost" onClick={() => removeQuestion(qIndex)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
          <Input
            placeholder="Question text"
            value={q.question}
            onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            {q.options.map((opt, oIndex) => (
              <div key={oIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${qIndex}`}
                  checked={q.correct_index === oIndex}
                  onChange={() => updateQuestion(qIndex, 'correct_index', oIndex)}
                />
                <Input
                  placeholder={`Option ${oIndex + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
          <Input
            placeholder="Explanation (shown after answer)"
            value={q.explanation || ''}
            onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
};

export default function CoursesManagement() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourses, setExpandedCourses] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  
  // Modal states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [parentId, setParentId] = useState(null);
  
  // Form states
  const [courseForm, setCourseForm] = useState({ title: '', description: '', thumbnail: '', order: 0 });
  const [moduleForm, setModuleForm] = useState({ course_id: '', title: '', order: 0 });
  const [sessionForm, setSessionForm] = useState({
    module_id: '', title: '', content_type: 'video', content_url: '', duration: '', description: '', is_free: false, order: 0, quiz_questions: []
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/courses`, { withCredentials: true });
      setCourses(res.data.courses || []);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (courseId) => {
    setExpandedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  // Drag end handlers
  const handleCourseDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = courses.findIndex(c => c.id === active.id);
    const newIndex = courses.findIndex(c => c.id === over.id);

    const newCourses = arrayMove(courses, oldIndex, newIndex);
    setCourses(newCourses);

    // Update orders in backend
    try {
      const updates = newCourses.map((course, index) => 
        axios.put(`${BACKEND_URL}/api/admin/courses/${course.id}`, { order: index }, { withCredentials: true })
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Failed to update course order:', error);
      fetchCourses(); // Revert on error
    }
  };

  const handleModuleDragEnd = async (courseId, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const course = courses.find(c => c.id === courseId);
    if (!course || !course.modules) return;

    const oldIndex = course.modules.findIndex(m => m.id === active.id);
    const newIndex = course.modules.findIndex(m => m.id === over.id);

    const newModules = arrayMove(course.modules, oldIndex, newIndex);
    
    // Update local state
    setCourses(prev => prev.map(c => 
      c.id === courseId ? { ...c, modules: newModules } : c
    ));

    // Update orders in backend
    try {
      const updates = newModules.map((module, index) => 
        axios.put(`${BACKEND_URL}/api/admin/courses/modules/${module.id}`, { order: index }, { withCredentials: true })
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Failed to update module order:', error);
      fetchCourses();
    }
  };

  const handleSessionDragEnd = async (courseId, moduleId, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const module = course.modules?.find(m => m.id === moduleId);
    if (!module || !module.sessions) return;

    const oldIndex = module.sessions.findIndex(s => s.id === active.id);
    const newIndex = module.sessions.findIndex(s => s.id === over.id);

    const newSessions = arrayMove(module.sessions, oldIndex, newIndex);
    
    // Update local state
    setCourses(prev => prev.map(c => 
      c.id === courseId ? {
        ...c,
        modules: c.modules.map(m => 
          m.id === moduleId ? { ...m, sessions: newSessions } : m
        )
      } : c
    ));

    // Update orders in backend
    try {
      const updates = newSessions.map((session, index) => 
        axios.put(`${BACKEND_URL}/api/admin/courses/sessions/${session.id}`, { order: index }, { withCredentials: true })
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Failed to update session order:', error);
      fetchCourses();
    }
  };

  // Modal handlers
  const closeCourseModal = () => {
    setShowCourseModal(false);
    setEditingItem(null);
    setCourseForm({ title: '', description: '', thumbnail: '', order: 0 });
  };

  const closeModuleModal = () => {
    setShowModuleModal(false);
    setEditingItem(null);
    setParentId(null);
    setModuleForm({ course_id: '', title: '', order: 0 });
  };

  const closeSessionModal = () => {
    setShowSessionModal(false);
    setEditingItem(null);
    setParentId(null);
    setSessionForm({
      module_id: '', title: '', content_type: 'video', content_url: '', duration: '', description: '', is_free: false, order: 0, quiz_questions: []
    });
  };

  const openEditCourse = (course) => {
    setEditingItem(course);
    setCourseForm({ title: course.title, description: course.description || '', thumbnail: course.thumbnail || '', order: course.order || 0 });
    setShowCourseModal(true);
  };

  const openEditModule = (module) => {
    setEditingItem(module);
    setModuleForm({ course_id: module.course_id, title: module.title, order: module.order || 0 });
    setShowModuleModal(true);
  };

  const openEditSession = (session) => {
    setEditingItem(session);
    setSessionForm({
      module_id: session.module_id,
      title: session.title,
      content_type: session.content_type || 'video',
      content_url: session.content_url || session.video_url || session.pdf_url || '',
      duration: session.duration || '',
      description: session.description || '',
      is_free: session.is_free || false,
      order: session.order || 0,
      quiz_questions: session.quiz_questions || []
    });
    setShowSessionModal(true);
  };

  const openAddModule = (courseId) => {
    setParentId(courseId);
    setModuleForm({ course_id: courseId, title: '', order: 0 });
    setShowModuleModal(true);
  };

  const openAddSession = (moduleId) => {
    setParentId(moduleId);
    setSessionForm({
      module_id: moduleId, title: '', content_type: 'video', content_url: '', duration: '', description: '', is_free: false, order: 0, quiz_questions: []
    });
    setShowSessionModal(true);
  };

  // CRUD operations
  const handleSaveCourse = async () => {
    try {
      if (editingItem) {
        await axios.put(`${BACKEND_URL}/api/admin/courses/${editingItem.id}`, courseForm, { withCredentials: true });
      } else {
        await axios.post(`${BACKEND_URL}/api/admin/courses`, { ...courseForm, order: courses.length }, { withCredentials: true });
      }
      fetchCourses();
      closeCourseModal();
    } catch (error) {
      alert('Failed to save course');
    }
  };

  const handleSaveModule = async () => {
    try {
      if (editingItem) {
        await axios.put(`${BACKEND_URL}/api/admin/courses/modules/${editingItem.id}`, moduleForm, { withCredentials: true });
      } else {
        const course = courses.find(c => c.id === parentId);
        const order = course?.modules?.length || 0;
        await axios.post(`${BACKEND_URL}/api/admin/courses/modules`, { ...moduleForm, course_id: parentId, order }, { withCredentials: true });
      }
      fetchCourses();
      closeModuleModal();
    } catch (error) {
      alert('Failed to save module');
    }
  };

  const handleSaveSession = async () => {
    try {
      if (editingItem) {
        await axios.put(`${BACKEND_URL}/api/admin/courses/sessions/${editingItem.id}`, sessionForm, { withCredentials: true });
      } else {
        const course = courses.find(c => c.modules?.some(m => m.id === parentId));
        const module = course?.modules?.find(m => m.id === parentId);
        const order = module?.sessions?.length || 0;
        await axios.post(`${BACKEND_URL}/api/admin/courses/sessions`, { ...sessionForm, module_id: parentId, order }, { withCredentials: true });
      }
      fetchCourses();
      closeSessionModal();
    } catch (error) {
      alert('Failed to save session');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Delete this course and all its modules/sessions?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/courses/${courseId}`, { withCredentials: true });
      fetchCourses();
    } catch (error) {
      alert('Failed to delete course');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Delete this module and all its sessions?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/courses/modules/${moduleId}`, { withCredentials: true });
      fetchCourses();
    } catch (error) {
      alert('Failed to delete module');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Delete this session?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/courses/sessions/${sessionId}`, { withCredentials: true });
      fetchCourses();
    } catch (error) {
      alert('Failed to delete session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Course Management</h2>
          <p className="text-slate-500">Drag and drop to reorder courses, modules, and sessions</p>
        </div>
        <Button onClick={() => setShowCourseModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="create-course-btn">
          <Plus className="w-4 h-4 mr-2" /> Create Course
        </Button>
      </div>

      {/* Courses List with DnD */}
      <div className="space-y-4">
        {courses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">No courses yet</h3>
            <p className="text-slate-500 mb-4">Create your first course to get started</p>
            <Button onClick={() => setShowCourseModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Create Course
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCourseDragEnd}>
            <SortableContext items={courses.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {courses.map((course) => (
                <SortableCourse
                  key={course.id}
                  course={course}
                  isExpanded={expandedCourses[course.id]}
                  onToggle={() => toggleCourse(course.id)}
                  onEdit={() => openEditCourse(course)}
                  onDelete={() => handleDeleteCourse(course.id)}
                  onAddModule={() => openAddModule(course.id)}
                >
                  {expandedCourses[course.id] && (
                    <div className="pl-8">
                      {course.modules && course.modules.length > 0 ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleModuleDragEnd(course.id, e)}>
                          <SortableContext items={course.modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                            {course.modules.map((module) => (
                              <SortableModule
                                key={module.id}
                                module={module}
                                isExpanded={expandedModules[module.id]}
                                onToggle={() => toggleModule(module.id)}
                                onEdit={() => openEditModule(module)}
                                onDelete={() => handleDeleteModule(module.id)}
                                onAddSession={() => openAddSession(module.id)}
                              >
                                {expandedModules[module.id] && (
                                  <div className="pl-8 pb-2">
                                    {module.sessions && module.sessions.length > 0 ? (
                                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleSessionDragEnd(course.id, module.id, e)}>
                                        <SortableContext items={module.sessions.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                          {module.sessions.map((session) => (
                                            <SortableSession
                                              key={session.id}
                                              session={session}
                                              onEdit={() => openEditSession(session)}
                                              onDelete={() => handleDeleteSession(session.id)}
                                            />
                                          ))}
                                        </SortableContext>
                                      </DndContext>
                                    ) : (
                                      <p className="text-sm text-slate-400 ml-4 py-2">No sessions yet</p>
                                    )}
                                  </div>
                                )}
                              </SortableModule>
                            ))}
                          </SortableContext>
                        </DndContext>
                      ) : (
                        <p className="text-slate-400 p-4">No modules yet</p>
                      )}
                    </div>
                  )}
                </SortableCourse>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Course Modal */}
      <Dialog open={showCourseModal} onOpenChange={closeCourseModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Course' : 'Add New Course'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Course Title</label>
              <Input
                value={courseForm.title}
                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                placeholder="e.g., Case Interview Fundamentals"
                data-testid="course-title-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                rows={3}
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                placeholder="Course description..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Thumbnail URL</label>
              <Input
                value={courseForm.thumbnail}
                onChange={(e) => setCourseForm({ ...courseForm, thumbnail: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Or Upload Thumbnail</label>
              <SimpleFileUpload
                category="thumbnails"
                accept="image/*"
                label="Upload Thumbnail"
                onUpload={(url) => setCourseForm({ ...courseForm, thumbnail: url })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCourseModal}>Cancel</Button>
            <Button onClick={handleSaveCourse} className="bg-blue-600 hover:bg-blue-700" data-testid="save-course-btn">
              {editingItem ? 'Save Changes' : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Modal */}
      <Dialog open={showModuleModal} onOpenChange={closeModuleModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Module' : 'Add New Module'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Module Title</label>
              <Input
                value={moduleForm.title}
                onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                placeholder="e.g., Introduction"
                data-testid="module-title-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModuleModal}>Cancel</Button>
            <Button onClick={handleSaveModule} className="bg-blue-600 hover:bg-blue-700" data-testid="save-module-btn">
              {editingItem ? 'Save Changes' : 'Create Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Modal */}
      <Dialog open={showSessionModal} onOpenChange={closeSessionModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Session' : 'Add New Session'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Session Title</label>
              <Input
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                placeholder="e.g., Introduction to Consulting"
                data-testid="session-title-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Content Type</label>
              <Select value={sessionForm.content_type} onValueChange={(val) => setSessionForm({ ...sessionForm, content_type: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="mixed">Mixed Content</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sessionForm.content_type === 'video' && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700">Video URL</label>
                  <Input
                    value={sessionForm.content_url}
                    onChange={(e) => setSessionForm({ ...sessionForm, content_url: e.target.value })}
                    placeholder="YouTube, Vimeo, or direct video URL"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Or Upload Video</label>
                  <ChunkedFileUpload
                    category="videos"
                    accept="video/*"
                    label="Upload Video"
                    onUpload={(url) => setSessionForm({ ...sessionForm, content_url: url })}
                  />
                </div>
              </>
            )}

            {sessionForm.content_type === 'pdf' && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700">PDF URL</label>
                  <Input
                    value={sessionForm.content_url}
                    onChange={(e) => setSessionForm({ ...sessionForm, content_url: e.target.value })}
                    placeholder="Direct link to PDF"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Or Upload PDF</label>
                  <SimpleFileUpload
                    category="documents"
                    accept=".pdf"
                    label="Upload PDF"
                    onUpload={(url) => setSessionForm({ ...sessionForm, content_url: url })}
                  />
                </div>
              </>
            )}

            {sessionForm.content_type === 'quiz' && (
              <QuizBuilder
                questions={sessionForm.quiz_questions}
                onChange={(questions) => setSessionForm({ ...sessionForm, quiz_questions: questions })}
              />
            )}

            <div>
              <label className="text-sm font-medium text-slate-700">Duration</label>
              <Input
                value={sessionForm.duration}
                onChange={(e) => setSessionForm({ ...sessionForm, duration: e.target.value })}
                placeholder="e.g., 15 min"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                rows={3}
                value={sessionForm.description}
                onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                placeholder="Session description..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_free"
                checked={sessionForm.is_free}
                onChange={(e) => setSessionForm({ ...sessionForm, is_free: e.target.checked })}
              />
              <label htmlFor="is_free" className="text-sm text-slate-700">Available in Free Trial</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSessionModal}>Cancel</Button>
            <Button onClick={handleSaveSession} className="bg-blue-600 hover:bg-blue-700" data-testid="save-session-btn">
              {editingItem ? 'Save Changes' : 'Create Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
