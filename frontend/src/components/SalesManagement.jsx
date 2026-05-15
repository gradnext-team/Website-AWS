import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Download,
  Search, Filter, X, ChevronRight, Calendar, User, ExternalLink,
  IndianRupee, Loader2, Eye, FileText, CreditCard, Package,
  PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Trash2,
  AlertTriangle, Activity
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ============ Stats Card Component ============
const StatCard = ({ label, value, subValue, icon: Icon, color, trend, trendValue }) => (
  <div className="bg-white rounded-xl p-5 border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {subValue && <p className="text-xs text-slate-400 mt-0.5">{subValue}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// ============ Purchase Type Badge ============
const PurchaseTypeBadge = ({ type }) => {
  const colors = {
    'Subscription Plan': 'bg-blue-100 text-blue-700',
    'Coaching Plan': 'bg-purple-100 text-purple-700',
    'Go-Out Plan': 'bg-amber-100 text-amber-700',
    'Cohort Plan': 'bg-emerald-100 text-emerald-700',
    'Single Session': 'bg-cyan-100 text-cyan-700',
    'Top-Up': 'bg-rose-100 text-rose-700',
    'Add-On': 'bg-indigo-100 text-indigo-700',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[type] || 'bg-slate-100 text-slate-700'}`}>
      {type}
    </span>
  );
};

// ============ Status Badge ============
const StatusBadge = ({ status }) => {
  const colors = {
    'paid': 'bg-green-100 text-green-700',
    'created': 'bg-amber-100 text-amber-700',
    'pending': 'bg-amber-100 text-amber-700',
    'failed': 'bg-red-100 text-red-700',
    'refunded': 'bg-slate-100 text-slate-700',
    'signature_failed': 'bg-red-100 text-red-700',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
};

// ============ Format Currency ============
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// ============ Format Date ============
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// ============ Main Sales Management Component ============
export const SalesManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [purchaseTypes, setPurchaseTypes] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    purchase_type: '',
    status: 'paid',
    date_from: '',
    date_to: '',
    search: ''
  });
  
  // Transaction detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Export state
  const [exporting, setExporting] = useState(false);

  // Diagnostic / skipped-row info — surfaces silent dropouts so admin can act.
  const [skippedInfo, setSkippedInfo] = useState(null);  // { count, samples }
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);

  // Manual sale modal
  const [showManualSale, setShowManualSale] = useState(false);
  const [manualSaleForm, setManualSaleForm] = useState({
    user_email: '', category: 'coaching', plan_key: '', billing_cycle: 'one_time',
    amount: '', payment_method: 'bank_transfer', activation_status: 'active',
    coupon_code: '', discount_amount: '', notes: '', purchase_date: ''
  });
  const [submittingManualSale, setSubmittingManualSale] = useState(false);
  const [plans, setPlans] = useState([]);

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPlans = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/resources/plans`, { withCredentials: true });
      setPlans(res.data.plans || []);
    } catch (err) { console.error('Failed to load plans:', err); }
  };

  useEffect(() => {
    loadSummary();
    loadPurchaseTypes();
    loadPlans();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [page, filters]);

  const loadSummary = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/summary`, { withCredentials: true });
      setSummary(res.data);
    } catch (error) {
      console.error('Failed to load sales summary:', error);
    }
  };

  const loadPurchaseTypes = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/purchase-types`, { withCredentials: true });
      setPurchaseTypes(res.data.purchase_types);
    } catch (error) {
      console.error('Failed to load purchase types:', error);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.purchase_type) params.append('purchase_type', filters.purchase_type);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.search) params.append('search', filters.search);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/transactions?${params}`, { withCredentials: true });
      setTransactions(res.data.transactions);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
      // Surface silently-skipped rows so admin can see them.
      if (res.data.skipped_count) {
        setSkippedInfo({ count: res.data.skipped_count, samples: res.data.skipped_samples || [] });
      } else {
        setSkippedInfo(null);
      }
      // Surface pipeline_error so silent backend crashes are visible.
      if (res.data.pipeline_error) {
        setSkippedInfo({ pipelineError: res.data.pipeline_error });
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      setSkippedInfo({ apiError: error?.response?.data?.detail || error.message || String(error) });
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async () => {
    setDiagnoseLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/transactions/_diagnose`, { withCredentials: true });
      setDiagnostic(res.data);
    } catch (error) {
      setDiagnostic({ error: error?.response?.data?.detail || error.message });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  const openTransactionDetails = async (transaction) => {
    setSelectedTransaction(transaction);
    setDetailModalOpen(true);
    setLoadingDetails(true);
    
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/transactions/${transaction.id}`, { withCredentials: true });
      setTransactionDetails(res.data);
    } catch (error) {
      console.error('Failed to load transaction details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const viewUserPurchases = (userId) => {
    navigate(`/admin/users/${userId}/purchases`);
  };

  // Delete transaction functions
  const openDeleteConfirmation = (transaction) => {
    setTransactionToDelete(transaction);
    setDeleteModalOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/sales/payment/${transactionToDelete.id}`, { 
        withCredentials: true 
      });
      
      // Refresh the transactions list
      loadTransactions();
      loadSummary();
      
      // Close the modal
      setDeleteModalOpen(false);
      setTransactionToDelete(null);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (filters.purchase_type) params.append('purchase_type', filters.purchase_type);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/export?${params}`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      purchase_type: '',
      status: 'paid',
      date_from: '',
      date_to: '',
      search: ''
    });
    setPage(1);
  };

  const handleSubmitManualSale = async () => {
    if (!manualSaleForm.user_email || !manualSaleForm.plan_key || !manualSaleForm.amount) {
      alert('Please fill in email, plan, and amount.');
      return;
    }
    setSubmittingManualSale(true);
    try {
      const payload = {
        ...manualSaleForm,
        amount: parseFloat(manualSaleForm.amount),
        discount_amount: manualSaleForm.discount_amount ? parseFloat(manualSaleForm.discount_amount) : 0
      };
      // Only include purchase_date if it's set
      if (!manualSaleForm.purchase_date) {
        delete payload.purchase_date;
      }
      const res = await axios.post(`${BACKEND_URL}/api/admin/sales/manual`, payload, { withCredentials: true });
      alert(res.data.message);
      setShowManualSale(false);
      setManualSaleForm({
        user_email: '', category: 'coaching', plan_key: '', billing_cycle: 'one_time',
        amount: '', payment_method: 'bank_transfer', activation_status: 'active',
        coupon_code: '', discount_amount: '', notes: '', purchase_date: ''
      });
      loadSummary();
      loadTransactions();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create manual sale');
    } finally {
      setSubmittingManualSale(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="sales-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Dashboard</h1>
          <p className="text-sm text-slate-500">Track all purchases, revenue, and GST</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowManualSale(true)} variant="outline" data-testid="add-manual-sale-btn">
            + Add Sale
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={exporting}
          variant="outline"
          data-testid="export-btn"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export CSV
        </Button>
        </div>
      </div>

      {/* Manual Sale Modal */}
      {showManualSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowManualSale(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-slate-900">Add Manual Sale</h2>
              <p className="text-sm text-slate-500">Record an offline or bank transfer payment</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User Email *</label>
                <input type="email" value={manualSaleForm.user_email} onChange={e => setManualSaleForm({...manualSaleForm, user_email: e.target.value})} placeholder="user@example.com" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" data-testid="manual-sale-email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
                <input 
                  type="date" 
                  value={manualSaleForm.purchase_date} 
                  onChange={e => setManualSaleForm({...manualSaleForm, purchase_date: e.target.value})} 
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" 
                  data-testid="manual-sale-date"
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty to use today's date</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <select value={manualSaleForm.category} onChange={e => setManualSaleForm({...manualSaleForm, category: e.target.value, plan_key: ''})} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
                    <option value="coaching">Coaching</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Plan *</label>
                  <select value={manualSaleForm.plan_key} onChange={e => setManualSaleForm({...manualSaleForm, plan_key: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" data-testid="manual-sale-plan">
                    <option value="">Select plan...</option>
                    {plans.filter(p => p.category === manualSaleForm.category).map(p => (
                      <option key={p.plan_key} value={p.plan_key}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle</label>
                  <select value={manualSaleForm.billing_cycle} onChange={e => setManualSaleForm({...manualSaleForm, billing_cycle: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
                    <option value="one_time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="6_month">6 Months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount (incl. GST) *</label>
                  <input type="number" value={manualSaleForm.amount} onChange={e => setManualSaleForm({...manualSaleForm, amount: e.target.value})} placeholder="e.g., 33983" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" data-testid="manual-sale-amount" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <select value={manualSaleForm.payment_method} onChange={e => setManualSaleForm({...manualSaleForm, payment_method: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="razorpay">Razorpay (Manual)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Activation Status</label>
                  <select value={manualSaleForm.activation_status} onChange={e => setManualSaleForm({...manualSaleForm, activation_status: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm">
                    <option value="active">Active (activate plan now)</option>
                    <option value="pending">Pending (record only)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code</label>
                  <input type="text" value={manualSaleForm.coupon_code} onChange={e => setManualSaleForm({...manualSaleForm, coupon_code: e.target.value.toUpperCase()})} placeholder="e.g., INSEAD10" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount</label>
                  <input type="number" value={manualSaleForm.discount_amount} onChange={e => setManualSaleForm({...manualSaleForm, discount_amount: e.target.value})} placeholder="0" className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={manualSaleForm.notes} onChange={e => setManualSaleForm({...manualSaleForm, notes: e.target.value})} placeholder="Any notes about this sale..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm min-h-[60px]" />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowManualSale(false)}>Cancel</Button>
              <Button onClick={handleSubmitManualSale} disabled={submittingManualSale} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="submit-manual-sale">
                {submittingManualSale ? 'Saving...' : 'Add Sale'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(summary.total_revenue)}
            subValue={`Base: ${formatCurrency(summary.total_base_amount)} + GST: ${formatCurrency(summary.total_gst)}`}
            icon={DollarSign}
            color="bg-emerald-500"
            trend={summary.growth_percentage > 0 ? 'up' : summary.growth_percentage < 0 ? 'down' : undefined}
            trendValue={summary.growth_percentage ? `${Math.abs(summary.growth_percentage).toFixed(1)}% from last month` : undefined}
          />
          <StatCard
            label="Today's Revenue"
            value={formatCurrency(summary.today_revenue)}
            icon={TrendingUp}
            color="bg-blue-500"
          />
          <StatCard
            label="This Month"
            value={formatCurrency(summary.month_revenue)}
            subValue={`Last month: ${formatCurrency(summary.prev_month_revenue)}`}
            icon={Calendar}
            color="bg-purple-500"
          />
          <StatCard
            label="Transactions"
            value={summary.transaction_count}
            subValue={`Avg: ${formatCurrency(summary.average_order_value)}`}
            icon={Receipt}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Revenue by Type */}
      {summary?.revenue_by_type && Object.keys(summary.revenue_by_type).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-slate-400" />
            Revenue by Purchase Type
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
            {Object.entries(summary.revenue_by_type).map(([type, amount]) => (
              <div key={type} className="p-3 bg-slate-50 rounded-lg">
                <div className="mb-2">
                  <PurchaseTypeBadge type={type} />
                </div>
                <p className="text-base font-bold text-slate-900">{formatCurrency(amount)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{type}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GST Summary Card */}
      {summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">GST Summary (18%)</p>
                <p className="text-xl font-bold text-blue-900">{formatCurrency(summary.total_gst)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Base Amount</p>
              <p className="font-semibold text-slate-900">{formatCurrency(summary.total_base_amount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-10"
              data-testid="search-input"
            />
          </div>

          <Select 
            value={filters.purchase_type || 'all'} 
            onValueChange={(v) => setFilters(f => ({ ...f, purchase_type: v === 'all' ? '' : v }))}
          >
            <SelectTrigger data-testid="filter-purchase-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {purchaseTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={filters.status || 'all'} 
            onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}
          >
            <SelectTrigger data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
            data-testid="filter-date-from"
          />

          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
            data-testid="filter-date-to"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Skipped-row / API-error / pipeline-error banner */}
      {skippedInfo && (skippedInfo.count > 0 || skippedInfo.pipelineError || skippedInfo.apiError) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-3" data-testid="sales-skipped-banner">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            {skippedInfo.apiError ? (
              <>
                <p className="font-semibold text-amber-900">Sales transactions API call failed</p>
                <p className="text-amber-800 mt-0.5">{skippedInfo.apiError}</p>
              </>
            ) : skippedInfo.pipelineError ? (
              <>
                <p className="font-semibold text-amber-900">Backend pipeline crashed while building transactions</p>
                <p className="text-amber-800 mt-0.5">The full transaction list could not be built. Error below — copy the message into chat for a fix.</p>
                <pre className="mt-2 text-[11px] bg-white rounded p-2 overflow-x-auto border border-amber-200 text-red-700 whitespace-pre-wrap">{skippedInfo.pipelineError}</pre>
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-900">
                  {skippedInfo.count} transaction{skippedInfo.count > 1 ? 's were' : ' was'} hidden due to row-build errors.
                </p>
                <p className="text-amber-800 mt-0.5">
                  The total revenue is correct in the cards above, but {skippedInfo.count} row{skippedInfo.count > 1 ? 's' : ''} could not be displayed. Check backend logs (search 'Sales transactions: skipping order') and click "Run diagnostic" below for details.
                </p>
                {skippedInfo.samples && skippedInfo.samples.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-900">Show sample errors</summary>
                    <pre className="mt-1 text-[11px] bg-white rounded p-2 overflow-x-auto border border-amber-200">{JSON.stringify(skippedInfo.samples, null, 2)}</pre>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Diagnostic panel */}
      {diagnostic && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3" data-testid="sales-diagnostic-panel">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-900">Sales transactions diagnostic</h4>
            <button onClick={() => setDiagnostic(null)} className="text-xs text-slate-500 hover:text-slate-700">Hide</button>
          </div>
          {diagnostic.error ? (
            <p className="text-xs text-red-600">{diagnostic.error}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="font-semibold text-slate-700">payment_orders collection</p>
                <p className="text-slate-600">Total: {diagnostic.payment_orders?.total ?? 0}</p>
                <p className="text-slate-600">paid/completed: <span className="font-semibold">{diagnostic.payment_orders?.matching_paid_or_completed ?? 0}</span></p>
                <p className="text-slate-600 mt-1">Status counts:</p>
                <pre className="text-[10px] mt-1 bg-slate-50 rounded p-1 overflow-x-auto">{JSON.stringify(diagnostic.payment_orders?.by_status, null, 2)}</pre>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="font-semibold text-slate-700">payments collection</p>
                <p className="text-slate-600">Total: {diagnostic.payments?.total ?? 0}</p>
                <p className="text-slate-600">captured: <span className="font-semibold">{diagnostic.payments?.matching_captured ?? 0}</span></p>
                <p className="text-slate-600 mt-1">Status counts:</p>
                <pre className="text-[10px] mt-1 bg-slate-50 rounded p-1 overflow-x-auto">{JSON.stringify(diagnostic.payments?.by_status, null, 2)}</pre>
              </div>
              <div className="md:col-span-2 bg-white rounded p-2 border border-slate-200">
                <p className="font-semibold text-slate-700">Expected min visible transactions: {diagnostic.expected_transactions_min ?? 0}</p>
                <p className="text-slate-500 mt-1">{diagnostic.note}</p>
              </div>
              {diagnostic.pipeline && (
                <div className="md:col-span-2 bg-white rounded p-2 border border-slate-200">
                  <p className="font-semibold text-slate-700">Pipeline replay (server-side):</p>
                  <pre className="text-[11px] mt-1 bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(diagnostic.pipeline, null, 2)}</pre>
                  <p className="text-slate-500 mt-1 text-[11px]">
                    If <code>merged_count</code> &gt; 0 but the table still says 0, share this output for further debugging.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Sales Transactions</h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostic}
              disabled={diagnoseLoading}
              data-testid="sales-diagnose-btn"
            >
              {diagnoseLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Activity className="w-4 h-4 mr-1" />}
              Run diagnostic
            </Button>
            <span className="text-sm text-slate-500">{total} transactions</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Customer</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Purchase</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Base</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Discount</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">After Disc.</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">GST (18%)</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Final Total</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  // Calculate amounts correctly
                  const baseAmount = tx.base_amount || 0;
                  const discountAmount = tx.discount_amount || 0;
                  const afterDiscount = baseAmount - discountAmount;
                  const gstAmount = tx.gst || 0;
                  const finalTotal = afterDiscount + gstAmount;
                  
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50" data-testid={`transaction-row-${tx.id}`}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p className="text-xs font-medium text-slate-900">
                          {formatDate(tx.paid_at || tx.created_at)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 max-w-[180px]">
                          <img
                            src={tx.user?.picture || `https://ui-avatars.com/api/?name=${tx.user_name || 'User'}&background=random`}
                            alt=""
                            className="w-7 h-7 rounded-full flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-xs truncate">{tx.user?.name || tx.user_name}</p>
                            <p className="text-xs text-slate-500 truncate">{tx.user?.email || tx.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[150px]">
                          <PurchaseTypeBadge type={tx.purchase_type} />
                          <p className="text-xs text-slate-600 mt-1 truncate" title={tx.purchase_name}>{tx.purchase_name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <p className="text-xs text-slate-600">{formatCurrency(baseAmount)}</p>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {discountAmount > 0 ? (
                          <p className="text-xs text-green-600 font-medium">-{formatCurrency(discountAmount)}</p>
                        ) : (
                          <p className="text-xs text-slate-400">₹0</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <p className="text-xs font-medium text-slate-700">{formatCurrency(afterDiscount)}</p>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <p className="text-xs text-slate-600">{formatCurrency(gstAmount)}</p>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <p className="text-xs font-bold text-slate-900">{formatCurrency(finalTotal)}</p>
                        <p className="text-[10px] text-slate-400">({formatCurrency(afterDiscount)}+{formatCurrency(gstAmount)})</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {tx.coupon_code && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded" title="Coupon Used">
                              {tx.coupon_code.slice(0, 6)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTransactionDetails(tx)}
                            title="View Details"
                            data-testid={`view-tx-${tx.id}`}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewUserPurchases(tx.user_id)}
                            title="View User History"
                            data-testid={`view-user-${tx.user_id}`}
                            className="h-7 w-7 p-0"
                          >
                            <User className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteConfirmation(tx)}
                            title="Delete Transaction"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                            data-testid={`delete-tx-${tx.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total}
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

      {/* Transaction Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : transactionDetails ? (
            <div className="space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Transaction ID</p>
                  <p className="font-mono text-sm">{transactionDetails.transaction?.id}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Status</p>
                  <StatusBadge status={transactionDetails.transaction?.status} />
                </div>
              </div>

              {/* Razorpay IDs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Razorpay Order ID</p>
                  <p className="font-mono text-xs">{transactionDetails.transaction?.razorpay_order_id || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-1">Razorpay Payment ID</p>
                  <p className="font-mono text-xs">{transactionDetails.transaction?.razorpay_payment_id || 'N/A'}</p>
                </div>
              </div>

              {/* Customer Info */}
              {transactionDetails.user && (
                <div className="border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase mb-2">Customer</p>
                  <div className="flex items-center gap-3">
                    <img
                      src={transactionDetails.user.picture || `https://ui-avatars.com/api/?name=${transactionDetails.user.name}`}
                      alt=""
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{transactionDetails.user.name}</p>
                      <p className="text-sm text-slate-500">{transactionDetails.user.email}</p>
                      <p className="text-xs text-slate-400">Plan: {transactionDetails.user.plan || 'N/A'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailModalOpen(false);
                        viewUserPurchases(transactionDetails.user.id);
                      }}
                    >
                      View History <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Purchase Details */}
              <div className="border border-slate-200 p-4 rounded-lg">
                <p className="text-xs text-slate-500 uppercase mb-2">Purchase Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Type</span>
                    <PurchaseTypeBadge type={transactionDetails.transaction?.purchase_type} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Product</span>
                    <span className="font-medium">{transactionDetails.transaction?.purchase_name}</span>
                  </div>
                  {transactionDetails.transaction?.mentor_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Mentor</span>
                      <span>{transactionDetails.transaction.mentor_name}</span>
                    </div>
                  )}
                  {transactionDetails.transaction?.session_count && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Sessions</span>
                      <span>{transactionDetails.transaction.session_count}</span>
                    </div>
                  )}
                  {transactionDetails.transaction?.discount_percent > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Discount</span>
                      <span className="text-green-600">-{transactionDetails.transaction.discount_percent}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 p-4 rounded-lg">
                <p className="text-xs text-emerald-600 uppercase mb-3 font-medium">Amount Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-700">
                    <span>Base Amount</span>
                    <span>{formatCurrency(transactionDetails.transaction?.base_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>GST (18%)</span>
                    <span>{formatCurrency(transactionDetails.transaction?.gst)}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 mt-2 flex justify-between font-bold text-emerald-800">
                    <span>Total Amount</span>
                    <span>{formatCurrency(transactionDetails.transaction?.total_amount || transactionDetails.transaction?.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium">{formatDate(transactionDetails.transaction?.created_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Paid</p>
                  <p className="font-medium">{formatDate(transactionDetails.transaction?.paid_at)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">Failed to load details</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Transaction
            </DialogTitle>
          </DialogHeader>
          
          {transactionToDelete && (
            <div className="py-4">
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
              
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">Customer:</span>
                    <p className="font-medium text-slate-900">{transactionToDelete.user_name || transactionToDelete.user_email}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount:</span>
                    <p className="font-medium text-slate-900">{formatCurrency(transactionToDelete.total_amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Purchase:</span>
                    <p className="font-medium text-slate-900">{transactionToDelete.purchase_name || transactionToDelete.plan_key}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Date:</span>
                    <p className="font-medium text-slate-900">{formatDate(transactionToDelete.paid_at || transactionToDelete.created_at)}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setTransactionToDelete(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteTransaction}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Transaction
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesManagement;
