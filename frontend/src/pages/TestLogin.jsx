import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, BookOpen, Star, Crown, Briefcase, GraduationCap, Zap } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TestLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  const handleMockLogin = async (userType, redirectPath = '/dashboard') => {
    setLoading(userType);
    setError('');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/mock-login?user_type=${userType}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        // Store user data
        localStorage.setItem('auth_token', userData.auth_token || '');
        localStorage.setItem('session_token', userData.session_token || '');
        localStorage.setItem('user', JSON.stringify(userData.user || userData));
        
        // Navigate based on user type
        navigate(redirectPath);
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Login failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(null);
    }
  };

  const userTypes = [
    {
      category: 'Subscription Plans',
      users: [
        {
          type: 'free',
          name: 'Free Trial User',
          email: 'free@gradnext.co',
          plan: 'Free Trial',
          description: 'Limited access, 7-day trial',
          icon: <User className="w-5 h-5" />,
          color: 'bg-gray-100 hover:bg-gray-200 border-gray-300',
          textColor: 'text-gray-700',
          redirect: '/dashboard'
        },
        {
          type: 'basic',
          name: 'Basic User',
          email: 'basic@gradnext.co',
          plan: 'Basic Plan',
          description: 'Video courses & drills access',
          icon: <BookOpen className="w-5 h-5" />,
          color: 'bg-blue-50 hover:bg-blue-100 border-blue-300',
          textColor: 'text-blue-700',
          redirect: '/dashboard'
        },
      ]
    },
    {
      category: 'Coaching Plans',
      users: [
        {
          type: 'subscription',
          name: 'Pro Subscriber',
          email: 'pro@gradnext.co',
          plan: 'Full Prep',
          description: '10 coaching sessions, full access',
          icon: <Star className="w-5 h-5" />,
          color: 'bg-purple-50 hover:bg-purple-100 border-purple-300',
          textColor: 'text-purple-700',
          redirect: '/dashboard'
        },
        {
          type: 'full_prep',
          name: 'Aarav Agarwal',
          email: 'fullprep@gradnext.co',
          plan: 'Full Prep',
          description: '10 sessions (2 used), 3 strategy calls',
          icon: <GraduationCap className="w-5 h-5" />,
          color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-300',
          textColor: 'text-indigo-700',
          redirect: '/dashboard'
        },
        {
          type: 'megha_aggarwal',
          name: 'Megha Aggarwal',
          email: 'meghaaggarwal.2000@gmail.com',
          plan: 'Full Prep',
          description: '10 sessions, 4 strategy calls (2 bookings)',
          icon: <GraduationCap className="w-5 h-5" />,
          color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-300',
          textColor: 'text-indigo-700',
          redirect: '/dashboard'
        },
        {
          type: 'pro_plus',
          name: 'Pro Plus User',
          email: 'proplus@gradnext.co',
          plan: 'Pro Plus',
          description: '20 sessions (5 used), 5 strategy calls',
          icon: <Zap className="w-5 h-5" />,
          color: 'bg-amber-50 hover:bg-amber-100 border-amber-300',
          textColor: 'text-amber-700',
          redirect: '/dashboard'
        },
        {
          type: 'pinnacle',
          name: 'Megha Sharma',
          email: 'megha@gradnext.co',
          plan: 'Pinnacle',
          description: 'Unlimited coaching sessions',
          icon: <Crown className="w-5 h-5" />,
          color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-400',
          textColor: 'text-yellow-700',
          redirect: '/dashboard'
        },
      ]
    },
    {
      category: 'Staff Access',
      users: [
        {
          type: 'mentor',
          name: 'Priya Sharma (Mentor)',
          email: 'mentor@gradnext.co',
          plan: 'Mentor Account',
          description: 'Access to mentor dashboard',
          icon: <Briefcase className="w-5 h-5" />,
          color: 'bg-green-50 hover:bg-green-100 border-green-300',
          textColor: 'text-green-700',
          redirect: '/mentor-dashboard'
        },
        {
          type: 'admin',
          name: 'Admin User',
          email: 'admin@gradnext.co',
          plan: 'Admin Account',
          description: 'Full admin panel access',
          icon: <Shield className="w-5 h-5" />,
          color: 'bg-red-50 hover:bg-red-100 border-red-300',
          textColor: 'text-red-700',
          redirect: '/admin'
        },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            🧪 Test Login Portal
          </h1>
          <p className="text-slate-600">
            Select a test user to login and explore the application
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* User Categories */}
        <div className="space-y-8">
          {userTypes.map((category) => (
            <div key={category.category}>
              <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {category.category}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.users.map((user) => (
                  <button
                    key={user.type}
                    onClick={() => handleMockLogin(user.type, user.redirect)}
                    disabled={loading !== null}
                    className={`
                      relative p-5 rounded-xl border-2 transition-all duration-200
                      ${user.color}
                      ${loading === user.type ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                      disabled:opacity-50 disabled:cursor-not-allowed
                      text-left
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${user.textColor} bg-white/50`}>
                        {user.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold ${user.textColor}`}>
                            {user.name}
                          </h3>
                          {loading === user.type && (
                            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${user.textColor} bg-white/70`}>
                            {user.plan}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{user.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-10 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Testing Notes</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Coaching Sessions:</strong> Full Prep users can book coaching sessions with mentors</li>
            <li>• <strong>Join Button:</strong> Appears 10 minutes before session and stays for 15 minutes after start</li>
            <li>• <strong>Session Completion:</strong> Sessions are marked complete only when BOTH parties click Join</li>
            <li>• <strong>Mentor Dashboard:</strong> Login as mentor to see sessions from the mentor's perspective</li>
          </ul>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-slate-600 hover:text-slate-800 underline"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestLogin;
