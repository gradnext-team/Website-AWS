import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, BookOpen, Video, Users, Zap, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useDashboard } from '../components/dashboard/DashboardLayout';

const Dashboard = ({ user }) => {
  const { showUpgradeModal } = useDashboard();
  
  const features = [
    { icon: <Video className="w-5 h-5" />, title: 'Video Course', desc: 'Access 30+ hours of content', link: '/subscription/video-course' },
    { icon: <Calendar className="w-5 h-5" />, title: 'Live Workshops', desc: 'Join upcoming sessions', link: '/subscription/workshops' },
    { icon: <Zap className="w-5 h-5" />, title: 'Case Drills', desc: 'Practice 100+ exercises', link: '/subscription/drills' },
    { icon: <BookOpen className="w-5 h-5" />, title: 'Resources', desc: '50+ casebooks & templates', link: '/subscription/resources' },
    { icon: <Users className="w-5 h-5" />, title: 'Peer Practice', desc: 'Connect with peers', link: '/subscription/peer-practice' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-8 md:p-12 text-white mb-8">
          <div className="flex items-center gap-4 mb-4">
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="w-16 h-16 rounded-full border-4 border-white/20"
              />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0] || 'User'}!</h1>
              <p className="text-blue-100">Ready to continue your consulting prep journey?</p>
            </div>
          </div>
        </div>

        {/* Trial Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Free Trial Active</p>
                <p className="text-sm text-slate-500">7 days remaining</p>
              </div>
            </div>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
              onClick={showUpgradeModal}
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>

        {/* Quick Access */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Access</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.link}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-500">{feature.desc}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        {/* Coming Soon */}
        <div className="bg-slate-100 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-700 mb-2">More features coming soon!</h3>
          <p className="text-slate-500">Your personalized dashboard with progress tracking, scheduled sessions, and more.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;