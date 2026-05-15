import React, { useState, useEffect } from 'react';
import {
  Tag,
  Percent,
  Calendar,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Search,
  Filter,
  Copy,
  Eye,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Layers
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Plan options for multi-select
const PLAN_OPTIONS = [
  { value: 'basic_plan', label: 'Basic Plan' },
  { value: 'pro_plan', label: 'Pro Plan' },
  { value: 'pro_plus', label: 'Pro+ Plan' },
  { value: 'single_session', label: 'Single Session' },
  { value: 'coaching_topup', label: 'Coaching Top-Up' },
  { value: 'last_mile', label: 'Last Mile' },
  { value: 'mid_mile', label: 'Mid Mile' },
  { value: 'full_prep', label: 'Full Prep' },
  { value: 'pinnacle', label: 'Pinnacle' },
];

const DiscountsSection = () => {
  const [discounts, setDiscounts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [usageData, setUsageData] = useState([]);
  const [filters, setFilters] = useState({ type: '', is_active: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'coupon',
    code: '',
    discount_type: 'percentage',
    subscription_discount_value: '',
    coaching_discount_value: '',
    cohort_discount_value: '',
    applies_to: [],
    applicable_plans: [],
    max_total_uses: '',
    max_uses_per_user: '',
    start_date: '',
    end_date: '',
    minimum_order_value: '',
    can_stack_with_automatic: false,
    is_active: true,
    razorpay_offer_id: ''  // Razorpay offer ID for subscription discounts
  });

  const [formErrors, setFormErrors] = useState({});

  // Fetch discounts
  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.is_active !== '') params.append('is_active', filters.is_active);

      const response = await fetch(`${API_BASE_URL}/api/admin/discounts?${params}`, {
        credentials: 'include'
      });
      const data = await response.json();
      setDiscounts(data.discounts || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Error fetching discounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, [filters]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'coupon',
      code: '',
      discount_type: 'percentage',
      subscription_discount_value: '',
      coaching_discount_value: '',
      cohort_discount_value: '',
      applies_to: [],
      applicable_plans: [],
      max_total_uses: '',
      max_uses_per_user: '',
      start_date: '',
      end_date: '',
      minimum_order_value: '',
      can_stack_with_automatic: false,
      is_active: true,
      razorpay_offer_id: ''
    });
    setFormErrors({});
    setEditingDiscount(null);
  };

  // Open modal for creating
  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Open modal for editing
  const openEditModal = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name || '',
      type: discount.type || 'coupon',
      code: discount.code || '',
      discount_type: discount.discount_type || 'percentage',
      subscription_discount_value: discount.subscription_discount_value || '',
      coaching_discount_value: discount.coaching_discount_value || '',
      cohort_discount_value: discount.cohort_discount_value || '',
      applies_to: discount.applies_to || [],
      applicable_plans: discount.applicable_plans || [],
      max_total_uses: discount.max_total_uses || '',
      max_uses_per_user: discount.max_uses_per_user || '',
      start_date: discount.start_date ? discount.start_date.split('T')[0] : '',
      end_date: discount.end_date ? discount.end_date.split('T')[0] : '',
      minimum_order_value: discount.minimum_order_value || '',
      can_stack_with_automatic: discount.can_stack_with_automatic || false,
      is_active: discount.is_active !== false,
      razorpay_offer_id: discount.razorpay_offer_id || ''
    });
    setShowModal(true);
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = 'Name is required';
    if (formData.type === 'coupon' && !formData.code.trim()) errors.code = 'Code is required for coupon type';
    if (formData.applies_to.length === 0) errors.applies_to = 'Select at least one category';
    if (formData.applies_to.includes('subscription') && !formData.subscription_discount_value) {
      errors.subscription_discount_value = 'Required when applying to subscriptions';
    }
    if (formData.applies_to.includes('coaching') && !formData.coaching_discount_value) {
      errors.coaching_discount_value = 'Required when applying to coaching';
    }
    if (formData.applies_to.includes('cohort') && !formData.cohort_discount_value) {
      errors.cohort_discount_value = 'Required when applying to cohort programs';
    }
    if (!formData.start_date) errors.start_date = 'Start date is required';
    if (!formData.end_date) errors.end_date = 'End date is required';
    if (formData.start_date && formData.end_date && new Date(formData.end_date) <= new Date(formData.start_date)) {
      errors.end_date = 'End date must be after start date';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const payload = {
        ...formData,
        subscription_discount_value: formData.subscription_discount_value ? parseFloat(formData.subscription_discount_value) : null,
        coaching_discount_value: formData.coaching_discount_value ? parseFloat(formData.coaching_discount_value) : null,
        cohort_discount_value: formData.cohort_discount_value ? parseFloat(formData.cohort_discount_value) : null,
        max_total_uses: formData.max_total_uses ? parseInt(formData.max_total_uses) : null,
        max_uses_per_user: formData.max_uses_per_user ? parseInt(formData.max_uses_per_user) : null,
        minimum_order_value: formData.minimum_order_value ? parseFloat(formData.minimum_order_value) : null,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        applicable_plans: formData.applicable_plans.length > 0 ? formData.applicable_plans : null
      };

      const url = editingDiscount
        ? `${API_BASE_URL}/api/admin/discounts/${editingDiscount.id}`
        : `${API_BASE_URL}/api/admin/discounts`;

      const response = await fetch(url, {
        method: editingDiscount ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save discount');
      }

      setShowModal(false);
      resetForm();
      fetchDiscounts();
    } catch (error) {
      alert(error.message);
    }
  };

  // Delete discount
  const handleDelete = async (discountId) => {
    if (!window.confirm('Are you sure you want to delete this discount?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/discounts/${discountId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete discount');

      fetchDiscounts();
    } catch (error) {
      alert(error.message);
    }
  };

  // Toggle discount status
  const toggleStatus = async (discount) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/discounts/${discount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !discount.is_active })
      });

      if (!response.ok) throw new Error('Failed to update status');

      fetchDiscounts();
    } catch (error) {
      alert(error.message);
    }
  };

  // View usage history
  const viewUsage = async (discount) => {
    setSelectedDiscount(discount);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/discounts/${discount.id}/usage`, {
        credentials: 'include'
      });
      const data = await response.json();
      setUsageData(data.usage || []);
      setShowUsageModal(true);
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  // Copy code to clipboard
  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    // Could add a toast notification here
  };

  // Filter discounts by search term
  const filteredDiscounts = discounts.filter(d => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.name?.toLowerCase().includes(term) ||
      d.code?.toLowerCase().includes(term)
    );
  });

  // Check if discount is expired
  const isExpired = (discount) => {
    return discount.end_date && new Date(discount.end_date) < new Date();
  };

  // Check if discount is upcoming
  const isUpcoming = (discount) => {
    return discount.start_date && new Date(discount.start_date) > new Date();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Discounts Management</h1>
        <p className="text-gray-600">Manage automatic discounts and coupon codes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Discounts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
            </div>
            <Tag className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active || 0}</p>
            </div>
            <Check className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Coupon Codes</p>
              <p className="text-2xl font-bold text-purple-600">{stats.coupons || 0}</p>
            </div>
            <Percent className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Savings Given</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.total_savings_given || 0)}</p>
            </div>
            <IndianRupee className="w-8 h-8 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 flex flex-wrap gap-4 items-center justify-between border-b">
          <div className="flex gap-4 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search discounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="automatic">Automatic</option>
              <option value="coupon">Coupon Code</option>
            </select>

            {/* Status Filter */}
            <select
              value={filters.is_active}
              onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Discount
          </button>
        </div>

        {/* Discounts Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No discounts found. Create your first discount!
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applies To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDiscounts.map((discount) => (
                  <tr key={discount.id} className={`hover:bg-gray-50 ${isExpired(discount) ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{discount.name}</p>
                        {discount.code && (
                          <div className="flex items-center gap-2 mt-1">
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{discount.code}</code>
                            <button
                              onClick={() => copyCode(discount.code)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Copy code"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        discount.type === 'automatic' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {discount.type === 'automatic' ? 'Automatic' : 'Coupon'}
                      </span>
                      {discount.can_stack_with_automatic && (
                        <span className="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Can stack with automatic discounts">
                          <Layers className="w-3 h-3 mr-1" />
                          Stackable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        {discount.applies_to?.includes('subscription') && discount.subscription_discount_value && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Sub:</span>
                            <span className="font-medium">
                              {discount.discount_type === 'percentage' 
                                ? `${discount.subscription_discount_value}%` 
                                : formatCurrency(discount.subscription_discount_value)}
                            </span>
                          </div>
                        )}
                        {discount.applies_to?.includes('coaching') && discount.coaching_discount_value && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Coach:</span>
                            <span className="font-medium">
                              {discount.discount_type === 'percentage' 
                                ? `${discount.coaching_discount_value}%` 
                                : formatCurrency(discount.coaching_discount_value)}
                            </span>
                          </div>
                        )}
                        {discount.applies_to?.includes('cohort') && discount.cohort_discount_value && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Cohort:</span>
                            <span className="font-medium">
                              {discount.discount_type === 'percentage' 
                                ? `${discount.cohort_discount_value}%` 
                                : formatCurrency(discount.cohort_discount_value)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {discount.applies_to?.map(type => (
                          <span key={type} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                            {type === 'subscription' ? '📦 Subscription' : type === 'cohort' ? '🎓 Cohort' : '👔 Coaching'}
                          </span>
                        ))}
                      </div>
                      {discount.applicable_plans && discount.applicable_plans.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          Plans: {discount.applicable_plans.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{formatDate(discount.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <span>to</span>
                          <span>{formatDate(discount.end_date)}</span>
                        </div>
                        {isExpired(discount) && (
                          <span className="text-xs text-red-600 font-medium">Expired</span>
                        )}
                        {isUpcoming(discount) && (
                          <span className="text-xs text-amber-600 font-medium">Upcoming</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <span className="font-medium">{discount.current_total_uses || 0}</span>
                        <span className="text-gray-500">
                          {discount.max_total_uses ? ` / ${discount.max_total_uses}` : ' / ∞'}
                        </span>
                        {discount.max_uses_per_user && (
                          <div className="text-xs text-gray-500">
                            {discount.max_uses_per_user}/user
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleStatus(discount)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          discount.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            discount.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewUsage(discount)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="View usage"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(discount)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(discount.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingDiscount ? 'Edit Discount' : 'Create New Discount'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Summer Sale 2025"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? 'border-red-500' : ''
                  }`}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="automatic"
                      checked={formData.type === 'automatic'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Automatic (Strikethrough)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value="coupon"
                      checked={formData.type === 'coupon'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Coupon Code</span>
                  </label>
                </div>
              </div>

              {/* Coupon Code (only for coupon type) */}
              {formData.type === 'coupon' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., SUMMER25"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono ${
                      formErrors.code ? 'border-red-500' : ''
                    }`}
                  />
                  {formErrors.code && <p className="text-red-500 text-xs mt-1">{formErrors.code}</p>}
                </div>
              )}

              {/* Discount Value Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Value Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="discount_type"
                      value="percentage"
                      checked={formData.discount_type === 'percentage'}
                      onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Percentage (%)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="discount_type"
                      value="fixed_amount"
                      checked={formData.discount_type === 'fixed_amount'}
                      onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Fixed Amount (₹)</span>
                  </label>
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applies To *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applies_to.includes('subscription')}
                      onChange={(e) => {
                        const newAppliesTo = e.target.checked
                          ? [...formData.applies_to, 'subscription']
                          : formData.applies_to.filter(t => t !== 'subscription');
                        setFormData({ ...formData, applies_to: newAppliesTo });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>📦 Subscriptions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applies_to.includes('coaching')}
                      onChange={(e) => {
                        const newAppliesTo = e.target.checked
                          ? [...formData.applies_to, 'coaching']
                          : formData.applies_to.filter(t => t !== 'coaching');
                        setFormData({ ...formData, applies_to: newAppliesTo });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>👔 Coaching</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer" data-testid="discount-applies-to-cohort">
                    <input
                      type="checkbox"
                      checked={formData.applies_to.includes('cohort')}
                      onChange={(e) => {
                        const newAppliesTo = e.target.checked
                          ? [...formData.applies_to, 'cohort']
                          : formData.applies_to.filter(t => t !== 'cohort');
                        setFormData({ ...formData, applies_to: newAppliesTo });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>🎓 Cohort</span>
                  </label>
                </div>
                {formErrors.applies_to && <p className="text-red-500 text-xs mt-1">{formErrors.applies_to}</p>}
              </div>

              {/* Discount Values */}
              <div className="grid grid-cols-2 gap-4">
                {formData.applies_to.includes('subscription') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subscription Discount {formData.discount_type === 'percentage' ? '(%)' : '(₹)'} *
                    </label>
                    <input
                      type="number"
                      value={formData.subscription_discount_value}
                      onChange={(e) => setFormData({ ...formData, subscription_discount_value: e.target.value })}
                      placeholder={formData.discount_type === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                      min="0"
                      max={formData.discount_type === 'percentage' ? '100' : undefined}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.subscription_discount_value ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.subscription_discount_value && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.subscription_discount_value}</p>
                    )}
                  </div>
                )}
                {formData.applies_to.includes('coaching') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coaching Discount {formData.discount_type === 'percentage' ? '(%)' : '(₹)'} *
                    </label>
                    <input
                      type="number"
                      value={formData.coaching_discount_value}
                      onChange={(e) => setFormData({ ...formData, coaching_discount_value: e.target.value })}
                      placeholder={formData.discount_type === 'percentage' ? 'e.g., 15' : 'e.g., 300'}
                      min="0"
                      max={formData.discount_type === 'percentage' ? '100' : undefined}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.coaching_discount_value ? 'border-red-500' : ''
                      }`}
                    />
                    {formErrors.coaching_discount_value && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.coaching_discount_value}</p>
                    )}
                  </div>
                )}
                {formData.applies_to.includes('cohort') && (
                  <div data-testid="discount-cohort-value-field">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cohort Discount {formData.discount_type === 'percentage' ? '(%)' : '(₹)'} *
                    </label>
                    <input
                      type="number"
                      value={formData.cohort_discount_value}
                      onChange={(e) => setFormData({ ...formData, cohort_discount_value: e.target.value })}
                      placeholder={formData.discount_type === 'percentage' ? 'e.g., 10' : 'e.g., 2500'}
                      min="0"
                      max={formData.discount_type === 'percentage' ? '100' : undefined}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.cohort_discount_value ? 'border-red-500' : ''
                      }`}
                      data-testid="discount-cohort-value-input"
                    />
                    {formErrors.cohort_discount_value && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.cohort_discount_value}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Applicable Plans */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicable Plans (leave empty for all plans)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLAN_OPTIONS.map(plan => (
                    <label key={plan.value} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applicable_plans.includes(plan.value)}
                        onChange={(e) => {
                          const newPlans = e.target.checked
                            ? [...formData.applicable_plans, plan.value]
                            : formData.applicable_plans.filter(p => p !== plan.value);
                          setFormData({ ...formData, applicable_plans: newPlans });
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">{plan.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Usage Limit (empty = unlimited)
                  </label>
                  <input
                    type="number"
                    value={formData.max_total_uses}
                    onChange={(e) => setFormData({ ...formData, max_total_uses: e.target.value })}
                    placeholder="e.g., 100"
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Per User Limit (empty = unlimited)
                  </label>
                  <input
                    type="number"
                    value={formData.max_uses_per_user}
                    onChange={(e) => setFormData({ ...formData, max_uses_per_user: e.target.value })}
                    placeholder="e.g., 1"
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Validity Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.start_date ? 'border-red-500' : ''
                    }`}
                  />
                  {formErrors.start_date && <p className="text-red-500 text-xs mt-1">{formErrors.start_date}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.end_date ? 'border-red-500' : ''
                    }`}
                  />
                  {formErrors.end_date && <p className="text-red-500 text-xs mt-1">{formErrors.end_date}</p>}
                </div>
              </div>

              {/* Minimum Order Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Order Value (₹) (empty = no minimum)
                </label>
                <input
                  type="number"
                  value={formData.minimum_order_value}
                  onChange={(e) => setFormData({ ...formData, minimum_order_value: e.target.value })}
                  placeholder="e.g., 1000"
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Stacking Option (only for coupon type) */}
              {formData.type === 'coupon' && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_stack_with_automatic}
                      onChange={(e) => setFormData({ ...formData, can_stack_with_automatic: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Can stack with automatic discounts
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 ml-6">
                    If enabled, this coupon can be applied on top of any active automatic discount
                  </p>
                </div>
              )}

              {/* Razorpay Offer ID (for subscription discounts) */}
              {formData.type === 'coupon' && formData.applies_to.includes('subscription') && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-medium text-blue-800 mb-1">
                    Razorpay Offer ID (Required for Subscription Discounts)
                  </label>
                  <input
                    type="text"
                    value={formData.razorpay_offer_id}
                    onChange={(e) => setFormData({ ...formData, razorpay_offer_id: e.target.value })}
                    placeholder="e.g., offer_SNWcxSAyBg5Kpe"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-blue-600 mt-2">
                    <strong>How to get this:</strong>
                    <br />1. Go to Razorpay Dashboard → Subscriptions → Offers
                    <br />2. Create an offer with the same discount percentage
                    <br />3. Copy the Offer ID (starts with "offer_")
                    <br />4. Paste it here
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Without a Razorpay Offer ID, users will see "Coupon not configured for subscription discounts" error.
                  </p>
                </div>
              )}

              {/* Active Status */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingDiscount ? 'Update Discount' : 'Create Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage History Modal */}
      {showUsageModal && selectedDiscount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Usage History</h2>
                <p className="text-sm text-gray-500">{selectedDiscount.name}</p>
              </div>
              <button onClick={() => setShowUsageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {usageData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No usage records yet
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Original</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Final</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {usageData.map((usage) => (
                      <tr key={usage.id}>
                        <td className="px-4 py-2 text-sm">{usage.user_email}</td>
                        <td className="px-4 py-2 text-sm capitalize">{usage.order_type}</td>
                        <td className="px-4 py-2 text-sm">{formatCurrency(usage.original_amount)}</td>
                        <td className="px-4 py-2 text-sm text-green-600">-{formatCurrency(usage.discount_applied)}</td>
                        <td className="px-4 py-2 text-sm font-medium">{formatCurrency(usage.final_amount)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{formatDate(usage.used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountsSection;
