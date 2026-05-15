import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Loader2, Check, X, Crown, Clock, Eye, EyeOff,
  CreditCard, Users, RefreshCw, Package, Sparkles, ChevronDown, ChevronUp,
  Copy, BarChart3, UserPlus, FileText, Video, BookOpen, Calendar, Zap,
  Star, Award, Shield, Settings
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
import { Switch } from './ui/switch';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Category configuration
const CATEGORIES = {
  subscription: {
    label: 'Subscription',
    icon: RefreshCw,
    color: 'blue',
    description: 'Monthly/yearly recurring plans'
  },
  coaching: {
    label: 'Coaching',
    icon: Users,
    color: 'violet',
    description: '1:1 coaching packages'
  },
  cohort: {
    label: 'Cohort',
    icon: Calendar,
    color: 'emerald',
    description: 'Group programs'
  },
  addon: {
    label: 'Add-ons',
    icon: Plus,
    color: 'amber',
    description: 'Additional features'
  }
};

// Feature configuration with detailed labels
const FEATURE_CONFIG = {
  course_recordings: { label: 'Course Recordings', icon: Video, description: 'Access to recorded courses' },
  course_recordings_limited: { label: 'Limited Course Access', icon: Video, description: 'Partial course access (for trials)' },
  drills_exercises: { label: 'Drills & Exercises', icon: Zap, description: 'Practice exercises' },
  drills_limited: { label: 'Limited Drills', icon: Zap, description: 'Partial drills access' },
  case_materials: { label: 'Case Materials', icon: BookOpen, description: 'Interview resources' },
  case_materials_limited: { label: 'Limited Materials', icon: BookOpen, description: 'Partial materials access' },
  workshops: { label: 'Workshops', icon: Calendar, type: 'select', options: ['none', 'only_recorded', 'recorded_and_live'] },
  workshops_limited: { label: 'Limited Workshops', icon: Calendar, description: 'For trial access' },
  peer_sessions_per_month: { label: 'Peer Sessions/Month', icon: Users, type: 'number', description: '0 = none, -1 = unlimited' },
  coaching_sessions: { label: 'Coaching Sessions', icon: Award, type: 'number', description: '0 = none, -1 = unlimited' },
  strategy_calls: { label: 'Strategy Calls', icon: FileText, type: 'number', description: '0 = none, -1 = unlimited' },
  dedicated_coach: { label: 'Dedicated Coach', icon: Star, description: 'Personal mentor assigned' }
};

// Workshop options labels
const WORKSHOP_LABELS = {
  none: 'No Access',
  only_recorded: 'Recorded Only',
  recorded_and_live: 'Recorded + Live'
};

// Peer practice labels helper
const getPeerLabel = (sessionsPerMonth) => {
  if (sessionsPerMonth === 0) return 'No Access';
  if (sessionsPerMonth === -1) return 'Unlimited';
  return `${sessionsPerMonth}/Month`;
};

// Available landing pages for plan display
const PAGE_OPTIONS = [
  { value: 'home', label: 'Home Page' },
  { value: 'pricing', label: 'Pricing Page' },
  { value: 'coaching', label: 'Coaching Page' },
  { value: 'cohort', label: 'Cohort Page' }
];

// Format price display
const formatPrice = (pricing) => {
  if (!pricing) return 'Free';
  if (pricing.one_time) return `₹${pricing.one_time.toLocaleString()}`;
  if (pricing.one_month) return `₹${pricing.one_month.toLocaleString()}/mo`;
  return 'Free';
};

// Plan Card Component
const PlanCard = ({ plan, onEdit, onDelete, onDuplicate, onToggleActive, onToggleHidden }) => {
  const [expanded, setExpanded] = useState(false);
  const features = plan.features || {};
  const pricing = plan.pricing || {};
  
  const categoryConfig = CATEGORIES[plan.category] || CATEGORIES.subscription;
  const CategoryIcon = categoryConfig.icon;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${
      !plan.is_active ? 'border-red-200 bg-red-50/30' : 
      plan.is_hidden ? 'border-amber-200 bg-amber-50/30' : 
      'border-slate-200 hover:shadow-md'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${categoryConfig.color}-100`}>
              <CategoryIcon className={`w-5 h-5 text-${categoryConfig.color}-600`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                {plan.badge && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                    {plan.badge}
                  </span>
                )}
                {plan.highlight && (
                  <Crown className="w-4 h-4 text-amber-500" />
                )}
                {!plan.is_active && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                    Inactive
                  </span>
                )}
                {plan.is_hidden && plan.is_active && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                    Hidden
                  </span>
                )}
                {plan.application_only && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                    Application Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{plan.plan_key}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(plan)} title="Duplicate">
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(plan)} title="Edit">
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(plan.id || plan.plan_key)} title="Delete">
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="p-4 grid grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50/50">
        {pricing.one_month !== null && pricing.one_month !== undefined && (
          <div>
            <p className="text-xs text-slate-500 mb-1">1 Month</p>
            <p className="font-semibold text-slate-900">₹{pricing.one_month?.toLocaleString() || 0}</p>
          </div>
        )}
        {pricing.six_month !== null && pricing.six_month !== undefined && (
          <div>
            <p className="text-xs text-slate-500 mb-1">6 Months</p>
            <p className="font-semibold text-slate-900">₹{pricing.six_month?.toLocaleString() || 0}</p>
          </div>
        )}
        {pricing.one_time !== null && pricing.one_time !== undefined && (
          <div>
            <p className="text-xs text-slate-500 mb-1">One-Time</p>
            <p className="font-semibold text-slate-900">₹{pricing.one_time?.toLocaleString() || 0}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 mb-1">Duration</p>
          <p className="font-semibold text-slate-900">
            {plan.duration_months ? `${plan.duration_months} mo` : plan.duration_days ? `${plan.duration_days} days` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Billing</p>
          <p className="font-semibold text-slate-900 flex items-center gap-1">
            {plan.is_auto_renew ? (
              <><RefreshCw className="w-3 h-3 text-blue-500" /> Auto</>
            ) : (
              <><CreditCard className="w-3 h-3 text-emerald-500" /> Once</>
            )}
          </p>
        </div>
      </div>

      {/* Key Features Summary */}
      <div className="p-4 flex flex-wrap gap-2">
        {features.coaching_sessions !== 0 && (
          <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded font-medium">
            {features.coaching_sessions === -1 ? '∞' : features.coaching_sessions} Coaching
          </span>
        )}
        {features.strategy_calls !== 0 && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">
            {features.strategy_calls === -1 ? '∞' : features.strategy_calls} Strategy
          </span>
        )}
        {(features.peer_sessions_per_month !== undefined && features.peer_sessions_per_month !== 0) && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded font-medium">
            Peer: {getPeerLabel(features.peer_sessions_per_month)}
          </span>
        )}
        {/* Legacy support for old peer_to_peer format */}
        {features.peer_to_peer && features.peer_to_peer !== 'none' && !features.peer_sessions_per_month && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded font-medium">
            Peer: {features.peer_to_peer}
          </span>
        )}
        {features.workshops && features.workshops !== 'none' && (
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded font-medium">
            {WORKSHOP_LABELS[features.workshops]}
          </span>
        )}
        {features.dedicated_coach && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-medium">
            Dedicated Coach
          </span>
        )}
      </div>

      {/* Expandable Features */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-sm text-slate-600 hover:text-slate-900 py-2"
        >
          <span>View all features</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {expanded && (
          <div className="mt-2 space-y-1 text-sm">
            <div className={`flex items-center gap-2 p-2 rounded ${features.course_recordings ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
              {features.course_recordings ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              Course Recordings {features.course_recordings_limited && '(Limited)'}
            </div>
            <div className={`flex items-center gap-2 p-2 rounded ${features.drills_exercises ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
              {features.drills_exercises ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              Drills & Exercises {features.drills_limited && '(Limited)'}
            </div>
            <div className={`flex items-center gap-2 p-2 rounded ${features.case_materials ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
              {features.case_materials ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              Case Materials {features.case_materials_limited && '(Limited)'}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Switch 
              checked={plan.is_active} 
              onCheckedChange={() => onToggleActive(plan.id || plan.plan_key, !plan.is_active)}
            />
            <span className={plan.is_active ? 'text-emerald-600' : 'text-slate-400'}>Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Switch 
              checked={!plan.is_hidden} 
              onCheckedChange={() => onToggleHidden(plan.id || plan.plan_key, !plan.is_hidden)}
            />
            <span className={!plan.is_hidden ? 'text-blue-600' : 'text-slate-400'}>Visible</span>
          </label>
        </div>
        <span className="text-xs text-slate-400">Order: {plan.order}</span>
      </div>
    </div>
  );
};

// Main Plans Section Component
export const PlansSection = () => {
  const [plans, setPlans] = useState([]);
  const [groupedPlans, setGroupedPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [activeTab, setActiveTab] = useState('subscription');
  const [stats, setStats] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Top-up settings (base price + discount tiers)
  const [topupSettings, setTopupSettings] = useState({
    base_price: 2999,
    discount_tiers: [
      { min_sessions: 5, discount: 5 },
      { min_sessions: 10, discount: 10 },
      { min_sessions: 15, discount: 15 },
      { min_sessions: 20, discount: 20 }
    ]
  });
  const [editingTopup, setEditingTopup] = useState(false);
  const [tempTopup, setTempTopup] = useState({
    base_price: 2999,
    discount_tiers: []
  });
  const [savingTopup, setSavingTopup] = useState(false);
  
  // Form state with comprehensive structure
  const [form, setForm] = useState({
    name: '',
    plan_key: '',
    category: 'subscription',
    description: '',
    pricing: { one_month: null, six_month: null, one_time: null },
    currency: 'INR',
    duration_months: null,
    duration_days: null,
    is_auto_renew: false,
    features: {
      course_recordings: true,
      course_recordings_limited: false,
      drills_exercises: true,
      drills_limited: false,
      case_materials: true,
      case_materials_limited: false,
      workshops: 'none',
      workshops_limited: false,
      peer_sessions_per_month: 0,
      coaching_sessions: 0,
      strategy_calls: 0,
      dedicated_coach: false
    },
    display_features: [],
    is_active: true,
    is_hidden: false,
    order: 0,
    highlight: false,
    badge: '',
    application_only: false,
    requires_base_plan: false,
    show_on_pages: ['home'],
    auto_add_to_subscription: false
  });

  // State for new display feature input
  const [newFeatureText, setNewFeatureText] = useState('');

  useEffect(() => {
    fetchPlans();
    fetchStats();
    fetchTopupSettings();
  }, []);

  const fetchTopupSettings = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/settings/topup`, { withCredentials: true });
      setTopupSettings({
        base_price: res.data.base_price || 2999,
        discount_tiers: res.data.discount_tiers || []
      });
      setTempTopup({
        base_price: res.data.base_price || 2999,
        discount_tiers: res.data.discount_tiers || []
      });
    } catch (error) {
      console.error('Failed to fetch top-up settings:', error);
    }
  };

  const saveTopupSettings = async () => {
    setSavingTopup(true);
    try {
      await axios.put(`${BACKEND_URL}/api/admin/settings/topup`, tempTopup, { withCredentials: true });
      setTopupSettings({ ...tempTopup });
      setEditingTopup(false);
    } catch (error) {
      alert('Failed to save top-up settings: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingTopup(false);
    }
  };

  const addDiscountTier = () => {
    const lastTier = tempTopup.discount_tiers[tempTopup.discount_tiers.length - 1];
    const newMinSessions = lastTier ? lastTier.min_sessions + 5 : 5;
    const newDiscount = lastTier ? Math.min(lastTier.discount + 5, 50) : 5;
    setTempTopup(prev => ({
      ...prev,
      discount_tiers: [...prev.discount_tiers, { min_sessions: newMinSessions, discount: newDiscount }]
    }));
  };

  const removeDiscountTier = (index) => {
    setTempTopup(prev => ({
      ...prev,
      discount_tiers: prev.discount_tiers.filter((_, i) => i !== index)
    }));
  };

  const updateDiscountTier = (index, field, value) => {
    setTempTopup(prev => ({
      ...prev,
      discount_tiers: prev.discount_tiers.map((tier, i) => 
        i === index ? { ...tier, [field]: parseInt(value) || 0 } : tier
      )
    }));
  };

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/plans`, { withCredentials: true });
      setPlans(res.data.plans || []);
      setGroupedPlans(res.data.grouped || {});
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/plans/stats`, { withCredentials: true });
      setStats(res.data.stats || []);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      plan_key: '',
      category: activeTab,
      description: '',
      pricing: { one_month: null, six_month: null, one_time: null },
      currency: 'INR',
      duration_months: null,
      duration_days: null,
      is_auto_renew: activeTab === 'subscription',
      features: {
        course_recordings: true,
        course_recordings_limited: false,
        drills_exercises: true,
        drills_limited: false,
        case_materials: true,
        case_materials_limited: false,
        workshops: 'none',
        workshops_limited: false,
        peer_sessions_per_month: 0,
        coaching_sessions: 0,
        strategy_calls: 0,
        dedicated_coach: false
      },
      display_features: [],
      is_active: true,
      is_hidden: false,
      order: (groupedPlans[activeTab]?.length || 0) * 10,
      highlight: false,
      badge: '',
      application_only: false,
      requires_base_plan: activeTab === 'addon',
      show_on_pages: activeTab === 'subscription' ? ['home', 'pricing'] : 
                     activeTab === 'coaching' ? ['coaching'] :
                     activeTab === 'cohort' ? ['cohort'] : ['pricing'],
      auto_add_to_subscription: false
    });
    setEditingPlan(null);
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    
    // Convert legacy peer_to_peer format to new peer_sessions_per_month format
    const features = plan.features || {};
    let peerSessionsPerMonth = features.peer_sessions_per_month;
    
    // If peer_sessions_per_month is not set, convert from legacy peer_to_peer
    if (peerSessionsPerMonth === undefined && features.peer_to_peer) {
      const legacyValue = features.peer_to_peer;
      if (legacyValue === 'none') peerSessionsPerMonth = 0;
      else if (legacyValue === 'unlimited') peerSessionsPerMonth = -1;
      else if (legacyValue === '1_only') peerSessionsPerMonth = 1;
      else if (legacyValue === '1_per_week') peerSessionsPerMonth = 4; // ~4 weeks per month
      else if (legacyValue === '2_per_week') peerSessionsPerMonth = 8;
      else peerSessionsPerMonth = 0;
    }
    
    setForm({
      name: plan.name,
      plan_key: plan.plan_key,
      category: plan.category || 'subscription',
      description: plan.description || '',
      pricing: plan.pricing || { one_month: null, six_month: null, one_time: null },
      currency: plan.currency || 'INR',
      duration_months: plan.duration_months,
      duration_days: plan.duration_days,
      is_auto_renew: plan.is_auto_renew || false,
      features: {
        course_recordings: features.course_recordings ?? true,
        course_recordings_limited: features.course_recordings_limited ?? false,
        drills_exercises: features.drills_exercises ?? true,
        drills_limited: features.drills_limited ?? false,
        case_materials: features.case_materials ?? true,
        case_materials_limited: features.case_materials_limited ?? false,
        workshops: features.workshops || 'none',
        workshops_limited: features.workshops_limited ?? false,
        peer_sessions_per_month: peerSessionsPerMonth ?? 0,
        coaching_sessions: features.coaching_sessions ?? 0,
        strategy_calls: features.strategy_calls ?? 0,
        dedicated_coach: features.dedicated_coach ?? false
      },
      display_features: plan.display_features || [],
      is_active: plan.is_active !== false,
      is_hidden: plan.is_hidden || false,
      order: plan.order || 0,
      highlight: plan.highlight || false,
      badge: plan.badge || '',
      application_only: plan.application_only || false,
      requires_base_plan: plan.requires_base_plan || false,
      show_on_pages: plan.show_on_pages || ['home'],
      auto_add_to_subscription: plan.auto_add_to_subscription || false
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingPlan) {
        // Use plan id, fallback to plan_key if id is missing
        const planId = editingPlan.id || editingPlan.plan_key;
        if (!planId) {
          throw new Error('Plan ID is missing. Please refresh and try again.');
        }
        await axios.put(
          `${BACKEND_URL}/api/admin/plans/${planId}`,
          form,
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${BACKEND_URL}/api/admin/plans`,
          form,
          { withCredentials: true }
        );
      }
      fetchPlans();
      fetchStats();
      closeModal();
    } catch (error) {
      alert(error.response?.data?.detail || error.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/admin/plans/${planId}`, { withCredentials: true });
      if (res.data.soft_delete) {
        alert(res.data.message);
      }
      fetchPlans();
      fetchStats();
    } catch (error) {
      alert('Failed to delete plan');
    }
  };

  const handleDuplicate = async (plan) => {
    try {
      const planId = plan.id || plan.plan_key;
      await axios.post(`${BACKEND_URL}/api/admin/plans/${planId}/duplicate`, {}, { withCredentials: true });
      fetchPlans();
    } catch (error) {
      alert('Failed to duplicate plan');
    }
  };

  const handleToggleActive = async (planId, isActive) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/plans/${planId}`,
        { is_active: isActive },
        { withCredentials: true }
      );
      fetchPlans();
    } catch (error) {
      alert('Failed to update plan status');
    }
  };

  const handleToggleHidden = async (planId, isHidden) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/plans/${planId}`,
        { is_hidden: isHidden },
        { withCredentials: true }
      );
      fetchPlans();
    } catch (error) {
      alert('Failed to update plan visibility');
    }
  };

  const updateFeature = (key, value) => {
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: value }
    }));
  };

  const updatePricing = (key, value) => {
    setForm(prev => ({
      ...prev,
      pricing: { ...prev.pricing, [key]: value === '' ? null : parseFloat(value) }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentPlans = groupedPlans[activeTab] || [];

  return (
    <div className="space-y-6" data-testid="plans-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Plan Management</h2>
          <p className="text-sm text-slate-500">Configure plans, pricing, and feature access</p>
        </div>
        <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700" data-testid="add-plan-btn">
          <Plus className="w-4 h-4 mr-2" /> Add New Plan
        </Button>
      </div>

      {/* Top-Up Session Settings */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Top-Up Session Pricing</h3>
              <p className="text-sm text-slate-500">Configure base price and volume discounts for session top-ups</p>
            </div>
          </div>
          {!editingTopup ? (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setEditingTopup(true)}
              data-testid="edit-topup-btn"
            >
              <Edit2 className="w-4 h-4 mr-1" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={saveTopupSettings}
                disabled={savingTopup}
                className="bg-green-600 hover:bg-green-700"
              >
                {savingTopup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => { setEditingTopup(false); setTempTopup({ ...topupSettings }); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {editingTopup ? (
          <div className="space-y-4">
            {/* Base Price */}
            <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200">
              <Label className="text-sm font-medium min-w-32">Base Price per Session</Label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">₹</span>
                <Input
                  type="number"
                  value={tempTopup.base_price}
                  onChange={(e) => setTempTopup(prev => ({ ...prev, base_price: parseInt(e.target.value) || 0 }))}
                  className="w-32"
                  data-testid="topup-base-price-input"
                />
              </div>
            </div>

            {/* Discount Tiers */}
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Volume Discount Tiers</Label>
                <Button size="sm" variant="outline" onClick={addDiscountTier}>
                  <Plus className="w-3 h-3 mr-1" /> Add Tier
                </Button>
              </div>
              
              {tempTopup.discount_tiers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No discount tiers configured. Click &quot;Add Tier&quot; to create one.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-slate-500 font-medium px-2">
                    <div className="col-span-5">Min Sessions</div>
                    <div className="col-span-5">Discount %</div>
                    <div className="col-span-2"></div>
                  </div>
                  {tempTopup.discount_tiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_sessions}
                          onChange={(e) => updateDiscountTier(index, 'min_sessions', e.target.value)}
                          className="w-full"
                        />
                        <span className="text-xs text-slate-400">+</span>
                      </div>
                      <div className="col-span-5 flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.discount}
                          onChange={(e) => updateDiscountTier(index, 'discount', e.target.value)}
                          className="w-full"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeDiscountTier(index)}
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Display Base Price */}
            <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
              <span className="text-sm text-slate-600">Base Price per Session</span>
              <span className="text-xl font-bold text-violet-700">₹{topupSettings.base_price.toLocaleString('en-IN')}</span>
            </div>
            
            {/* Display Discount Tiers */}
            {topupSettings.discount_tiers.length > 0 && (
              <div className="p-3 bg-white/60 rounded-lg">
                <p className="text-sm text-slate-600 mb-2">Volume Discounts</p>
                <div className="flex flex-wrap gap-2">
                  {topupSettings.discount_tiers.map((tier, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-sm font-medium"
                    >
                      {tier.min_sessions}+ sessions → {tier.discount}% off
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(CATEGORIES).map(([key, config]) => {
          const categoryPlans = groupedPlans[key] || [];
          const activePlans = categoryPlans.filter(p => p.is_active);
          return (
            <div key={key} className={`bg-${config.color}-50 border border-${config.color}-200 rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <config.icon className={`w-5 h-5 text-${config.color}-600`} />
                <span className="font-medium text-slate-900">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{categoryPlans.length}</p>
              <p className="text-sm text-slate-500">{activePlans.length} active</p>
            </div>
          );
        })}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {Object.entries(CATEGORIES).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === key
                ? `bg-${config.color}-100 text-${config.color}-700`
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <config.icon className="w-4 h-4" />
            {config.label}
            <span className="px-1.5 py-0.5 bg-white rounded text-xs">
              {(groupedPlans[key] || []).length}
            </span>
          </button>
        ))}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onToggleActive={handleToggleActive}
            onToggleHidden={handleToggleHidden}
          />
        ))}
      </div>

      {currentPlans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">No {CATEGORIES[activeTab]?.label} Plans</h3>
          <p className="text-slate-500 mb-4">Create your first {activeTab} plan</p>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Create Plan
          </Button>
        </div>
      )}

      {/* Create/Edit Plan Modal */}
      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPlan ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plan Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Pro Plan"
                  data-testid="plan-name-input"
                />
              </div>
              <div>
                <Label>Plan Key (Internal) *</Label>
                <Input
                  value={form.plan_key}
                  onChange={(e) => setForm({ ...form, plan_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., pro_plan"
                  disabled={!!editingPlan}
                />
                <p className="text-xs text-slate-400 mt-1">Cannot be changed after creation</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => {
                  // Reset pricing fields based on category
                  const newPricing = v === 'subscription' 
                    ? { one_month: form.pricing.one_month, six_month: form.pricing.six_month, one_time: null }
                    : { one_month: null, six_month: null, one_time: form.pricing.one_time };
                  setForm({ ...form, category: v, pricing: newPricing });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className="w-4 h-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description..."
                />
              </div>
            </div>

            {/* Pricing Section - Conditional based on category */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-4">
              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Pricing ({form.currency})
              </h4>
              
              {form.category === 'subscription' ? (
                // Subscription: 1-month and 6-month pricing with auto duration
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>1-Month Price (₹)</Label>
                      <Input
                        type="number"
                        value={form.pricing.one_month ?? ''}
                        onChange={(e) => updatePricing('one_month', e.target.value)}
                        placeholder="e.g., 699"
                      />
                      <p className="text-xs text-slate-400 mt-1">Duration: 1 month (auto)</p>
                    </div>
                    <div>
                      <Label>6-Month Price (₹)</Label>
                      <Input
                        type="number"
                        value={form.pricing.six_month ?? ''}
                        onChange={(e) => updatePricing('six_month', e.target.value)}
                        placeholder="e.g., 599/mo"
                      />
                      <p className="text-xs text-slate-400 mt-1">Duration: 6 months (auto)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={form.is_auto_renew}
                        onCheckedChange={(v) => setForm({ ...form, is_auto_renew: v })}
                      />
                      <span className="text-sm font-medium">Auto-Renew Subscription</span>
                    </label>
                  </div>
                </div>
              ) : (
                // Coaching/Cohort/Add-on: One-time pricing with manual duration
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>One-Time Price (₹)</Label>
                      <Input
                        type="number"
                        value={form.pricing.one_time ?? ''}
                        onChange={(e) => updatePricing('one_time', e.target.value)}
                        placeholder="e.g., 16999"
                      />
                    </div>
                    <div>
                      <Label>Duration (Months)</Label>
                      <Input
                        type="number"
                        value={form.duration_months ?? ''}
                        onChange={(e) => setForm({ ...form, duration_months: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="e.g., 3"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Features Section - Simplified */}
            <div className="p-4 bg-blue-50 rounded-lg space-y-4">
              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Feature Access
              </h4>
              
              {/* Core Content Access */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Courses</span>
                  <Switch
                    checked={form.features.course_recordings}
                    onCheckedChange={(v) => updateFeature('course_recordings', v)}
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Drills & Exercises</span>
                  <Switch
                    checked={form.features.drills_exercises}
                    onCheckedChange={(v) => updateFeature('drills_exercises', v)}
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Case Materials</span>
                  <Switch
                    checked={form.features.case_materials}
                    onCheckedChange={(v) => updateFeature('case_materials', v)}
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-50">
                  <span className="text-sm text-slate-700">Dedicated Coach</span>
                  <Switch
                    checked={form.features.dedicated_coach}
                    onCheckedChange={(v) => updateFeature('dedicated_coach', v)}
                  />
                </label>
              </div>

              {/* Workshops */}
              <div className="p-3 bg-white rounded-lg space-y-2">
                <Label className="text-sm font-medium">Workshops</Label>
                <Select value={form.features.workshops} onValueChange={(v) => updateFeature('workshops', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Access</SelectItem>
                    <SelectItem value="only_recorded">Recorded Only</SelectItem>
                    <SelectItem value="recorded_and_live">Recorded + Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Peer-to-Peer Sessions - Monthly */}
              <div className="p-3 bg-white rounded-lg space-y-2">
                <Label className="text-sm font-medium">Peer-to-Peer Sessions (Monthly)</Label>
                <Input
                  type="number"
                  min="-1"
                  value={form.features.peer_sessions_per_month}
                  onChange={(e) => updateFeature('peer_sessions_per_month', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  data-testid="peer-sessions-input"
                />
                <p className="text-xs text-slate-400">Sessions per month. 0 = no access, -1 = unlimited. Credits reset monthly from subscription start date.</p>
              </div>

              {/* Coaching & Strategy */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white rounded-lg space-y-2">
                  <Label className="text-sm font-medium">Coaching Sessions</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={form.features.coaching_sessions === -1 ? '' : form.features.coaching_sessions}
                      onChange={(e) => updateFeature('coaching_sessions', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      disabled={form.features.coaching_sessions === -1}
                      className={form.features.coaching_sessions === -1 ? 'opacity-50' : ''}
                    />
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.features.coaching_sessions === -1}
                        onChange={(e) => updateFeature('coaching_sessions', e.target.checked ? -1 : 0)}
                        className="rounded border-slate-300"
                      />
                      Unlimited
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">Number of 1:1 coaching sessions included</p>
                </div>
                <div className="p-3 bg-white rounded-lg space-y-2">
                  <Label className="text-sm font-medium">Strategy Calls</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={form.features.strategy_calls === -1 ? '' : form.features.strategy_calls}
                      onChange={(e) => updateFeature('strategy_calls', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      disabled={form.features.strategy_calls === -1}
                      className={form.features.strategy_calls === -1 ? 'opacity-50' : ''}
                    />
                    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.features.strategy_calls === -1}
                        onChange={(e) => updateFeature('strategy_calls', e.target.checked ? -1 : 0)}
                        className="rounded border-slate-300"
                      />
                      Unlimited
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">Number of strategy calls included</p>
                </div>
              </div>
            </div>

            {/* Display Features for Plan Cards */}
            <div className="p-4 bg-amber-50 rounded-lg space-y-4">
              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Plan Card Features
                <span className="text-xs font-normal text-slate-500">(shown on "Choose Your Plan" cards)</span>
              </h4>
              
              {/* Current Features List */}
              <div className="space-y-2">
                {form.display_features?.length > 0 ? (
                  <div className="space-y-2">
                    {form.display_features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-amber-200">
                        <Check className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span className="flex-1 text-sm text-slate-700">{feature}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (index > 0) {
                                const newFeatures = [...form.display_features];
                                [newFeatures[index - 1], newFeatures[index]] = [newFeatures[index], newFeatures[index - 1]];
                                setForm({ ...form, display_features: newFeatures });
                              }
                            }}
                            className="p-1 hover:bg-slate-100 rounded"
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-3 h-3 text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index < form.display_features.length - 1) {
                                const newFeatures = [...form.display_features];
                                [newFeatures[index], newFeatures[index + 1]] = [newFeatures[index + 1], newFeatures[index]];
                                setForm({ ...form, display_features: newFeatures });
                              }
                            }}
                            className="p-1 hover:bg-slate-100 rounded"
                            disabled={index === form.display_features.length - 1}
                          >
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newFeatures = form.display_features.filter((_, i) => i !== index);
                              setForm({ ...form, display_features: newFeatures });
                            }}
                            className="p-1 hover:bg-red-100 rounded"
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No features added yet. Add features that will be displayed on the plan card.</p>
                )}
              </div>
              
              {/* Add New Feature */}
              <div className="flex gap-2">
                <Input
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  placeholder="e.g., Full course access, 4 coaching sessions..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newFeatureText.trim()) {
                      e.preventDefault();
                      setForm({ ...form, display_features: [...(form.display_features || []), newFeatureText.trim()] });
                      setNewFeatureText('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (newFeatureText.trim()) {
                      setForm({ ...form, display_features: [...(form.display_features || []), newFeatureText.trim()] });
                      setNewFeatureText('');
                    }
                  }}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400">These features will be shown on the plan cards in the "Choose Your Plan" section</p>
            </div>

            {/* Display Options */}
            <div className="p-4 bg-slate-50 rounded-lg space-y-4">
              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Display Options
              </h4>
              
              {/* Show on Pages - Multi-select */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Show on Landing Pages</Label>
                <div className="flex flex-wrap gap-2">
                  {PAGE_OPTIONS.map((page) => (
                    <label 
                      key={page.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        form.show_on_pages?.includes(page.value) 
                          ? 'bg-blue-100 border-blue-300 text-blue-700' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={form.show_on_pages?.includes(page.value) || false}
                        onChange={(e) => {
                          const current = form.show_on_pages || [];
                          if (e.target.checked) {
                            setForm({ ...form, show_on_pages: [...current, page.value] });
                          } else {
                            setForm({ ...form, show_on_pages: current.filter(p => p !== page.value) });
                          }
                        }}
                      />
                      <span className="text-sm">{page.label}</span>
                      {form.show_on_pages?.includes(page.value) && (
                        <Check className="w-4 h-4" />
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400">Select which pages this plan should appear on</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Badge (optional)</Label>
                  <Input
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="e.g., Most Popular"
                  />
                </div>
                <div>
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.highlight} onCheckedChange={(v) => setForm({ ...form, highlight: v })} />
                  <span className="text-sm">Highlight Plan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={!form.is_hidden} onCheckedChange={(v) => setForm({ ...form, is_hidden: !v })} />
                  <span className="text-sm">Visible to Users</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.application_only} onCheckedChange={(v) => setForm({ ...form, application_only: v })} />
                  <span className="text-sm">Application Only</span>
                </label>
                {form.category === 'addon' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={form.auto_add_to_subscription} onCheckedChange={(v) => setForm({ ...form, auto_add_to_subscription: v })} />
                    <span className="text-sm">Auto-add to Subscriptions</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.plan_key} data-testid="save-plan-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlansSection;
