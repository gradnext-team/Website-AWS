import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import { Play, Lock, CheckCircle2, Clock, BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import VideoPlayerModal from '../ui/VideoPlayerModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const VideosPage = () => {
  const { dashboardData, user, showUpgradeModal } = useDashboard();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/resources/videos`, {
          withCredentials: true,
        });
        setVideos(response.data);
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const handleVideoClick = (video) => {
    if (!video.locked) {
      setSelectedVideo(video);
      setIsPlayerOpen(true);
    }
  };

  const handleUpgradeClick = () => {
    // Use the new subscription plans modal from DashboardLayout
    if (showUpgradeModal) {
      showUpgradeModal();
    } else {
      // Fallback to pricing section
      navigate('/#pricing-section');
      setTimeout(() => {
        const el = document.getElementById('pricing-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const modules = ['all', ...new Set(videos.map(v => v.module))];
  const filteredVideos = selectedModule === 'all'
    ? videos
    : videos.filter(v => v.module === selectedModule);

  const unlockedCount = videos.filter(v => !v.locked).length;
  const hasFullAccess = dashboardData?.access?.subscription;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recorded Videos</h1>
          <p className="text-slate-500">
            {hasFullAccess
              ? `${videos.length} lessons available`
              : `${unlockedCount} of ${videos.length} lessons unlocked`}
          </p>
        </div>
        {!hasFullAccess && (
          <Button onClick={handleUpgradeClick} className="btn-primary-gradient">
            Unlock All Videos
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Course Progress</span>
          <span className="text-sm text-slate-500">
            {dashboardData?.progress?.videos_completed || 0}/{hasFullAccess ? videos.length : unlockedCount} completed
          </span>
        </div>
        <Progress
          value={((dashboardData?.progress?.videos_completed || 0) / (hasFullAccess ? videos.length : unlockedCount || 1)) * 100}
          className="h-2"
        />
      </div>

      {/* Module Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {modules.map((module) => (
          <button
            key={module}
            onClick={() => setSelectedModule(module)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedModule === module
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {module === 'all' ? 'All Modules' : module}
          </button>
        ))}
      </div>

      {/* Videos Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVideos.map((video) => (
          <div
            key={video.id}
            onClick={() => handleVideoClick(video)}
            className={`bg-white rounded-xl overflow-hidden border transition-all ${
              video.locked
                ? 'border-slate-200 opacity-75'
                : 'border-slate-100 hover:shadow-lg hover:border-blue-200 cursor-pointer'
            }`}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-slate-100">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              {video.locked ? (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-slate-900/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-6 h-6 text-blue-600 ml-1" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                {video.duration}
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {video.module}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{video.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">{video.description}</p>

              {video.locked && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpgradeClick();
                    }}
                  >
                    Unlock with Subscription
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        video={selectedVideo}
        type="video"
        userName={user?.name || user?.email}
      />
    </div>
  );
};

export default VideosPage;