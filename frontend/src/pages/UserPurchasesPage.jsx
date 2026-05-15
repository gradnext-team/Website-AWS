import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, User, Mail, Calendar, CreditCard, Package,
  DollarSign, Receipt, FileText, Loader2, TrendingUp,
  ChevronRight, Clock, Star, IndianRupee
} from 'lucide-react';
import { Button } from '../components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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

const formatShortDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// ============ User Purchases Page ============
const UserPurchasesPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUserPurchases();
  }, [userId]);

  const loadUserPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/sales/users/${userId}/purchases`, { withCredentials: true });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load user purchases:', err);
      setError(err.response?.data?.detail || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={goBack} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600">{error}</p>
            <Button onClick={loadUserPurchases} className="mt-4">Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const { user, summary, purchases } = data || {};

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8" data-testid="user-purchases-page">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={goBack} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sales
          </Button>
        </div>

        {/* User Profile Card */}
        {user && (
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <div className="flex items-start gap-6">
              <img
                src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&size=96&background=random`}
                alt=""
                className="w-20 h-20 rounded-full object-cover"
              />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
                <p className="text-slate-500 flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4" /> {user.email}
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {user.plan_name || user.plan || 'Free Trial'}
                  </span>
                  {user.subscription_end && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Expires: {formatShortDate(user.subscription_end)}
                    </span>
                  )}
                  {(user.coaching_sessions_total > 0 || user.coaching_sessions_remaining > 0) && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      Sessions: {user.coaching_sessions_remaining || (user.coaching_sessions_total - user.coaching_sessions_used) || 0} remaining
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Member since</p>
                <p className="text-sm font-medium text-slate-600">{formatShortDate(user.created_at)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Spent</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.total_spent)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">GST Paid</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.total_gst_paid)}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Receipt className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Purchases</p>
                  <p className="text-xl font-bold text-slate-900">{summary.purchase_count}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Avg. Purchase</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.average_purchase_value)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Purchases by Type */}
        {summary?.purchases_by_type && Object.keys(summary.purchases_by_type).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Purchases by Type</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(summary.purchases_by_type).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                  <PurchaseTypeBadge type={type} />
                  <span className="font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchase Timeline */}
        {summary && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600">First Purchase</p>
                  <p className="font-medium text-blue-900">{formatDate(summary.first_purchase)}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-300" />
              <div className="text-right">
                <p className="text-sm text-blue-600">Latest Purchase</p>
                <p className="font-medium text-blue-900">{formatDate(summary.last_purchase)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Purchase History Table */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Purchase History</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Base Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">GST</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!purchases || purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      No purchases found for this user
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase, idx) => (
                    <tr key={purchase.id || idx} className="hover:bg-slate-50" data-testid={`purchase-row-${idx}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                          {formatDate(purchase.paid_at || purchase.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <PurchaseTypeBadge type={purchase.purchase_type} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-900">{purchase.purchase_name}</p>
                        {purchase.mentor_name && (
                          <p className="text-xs text-slate-500">with {purchase.mentor_name}</p>
                        )}
                        {purchase.session_count && (
                          <p className="text-xs text-slate-500">{purchase.session_count} sessions</p>
                        )}
                        {purchase.discount_percent > 0 && (
                          <span className="text-xs text-green-600">-{purchase.discount_percent}% discount</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm text-slate-600">{formatCurrency(purchase.base_amount)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm text-slate-600">{formatCurrency(purchase.gst)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(purchase.total_amount)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={purchase.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {purchases && purchases.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-slate-700">
                      Total ({summary?.purchase_count} purchases)
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      {formatCurrency(summary?.total_spent - summary?.total_gst_paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                      {formatCurrency(summary?.total_gst_paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                      {formatCurrency(summary?.total_spent)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPurchasesPage;
