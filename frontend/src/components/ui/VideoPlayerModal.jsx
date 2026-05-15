import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Clock, User, SkipForward, Gauge, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to convert YouTube URL to embed URL with security parameters
const getEmbedUrl = (url) => {
  if (!url) return null;
  
  // YouTube URL patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      // Use youtube-nocookie.com with security parameters
      const videoId = match[1];
      const params = new URLSearchParams({
        autoplay: '1',
        modestbranding: '1',        // Hide YouTube logo (minimizes it)
        rel: '0',                    // Don't show related videos
        controls: '1',               // Show controls but with branding minimized
        fs: '1',                     // Allow fullscreen
        playsinline: '1',            // Better mobile support
        origin: window.location.origin  // Restrict embed to this domain
      });
      return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    }
  }
  
  // Vimeo URL patterns with security
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    const params = new URLSearchParams({
      autoplay: '1',
      title: '0',
      byline: '0',
      portrait: '0'
    });
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?${params.toString()}`;
  }
  
  // For local uploads, use streaming endpoint
  if (url.startsWith('/uploads/')) {
    return `${BACKEND_URL}/api/stream${url}`;
  }
  
  // Return original URL for direct video files
  return url;
};

// Check if URL is an embed type (YouTube, Vimeo) or direct video
const isEmbedUrl = (url) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
};

const PLAYBACK_SPEEDS = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
];

const VideoPlayerModal = ({ 
  isOpen, 
  onClose, 
  video,
  type = 'video',
  onNextVideo,
  hasNextVideo = false,
  userName = null, // For watermark
  onVideoComplete = null // Callback when video ends
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playbackSpeed, setPlaybackSpeed] = useState('1');
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isPausedByVisibility, setIsPausedByVisibility] = useState(false);
  const [showPausedOverlay, setShowPausedOverlay] = useState(false);
  const [hasMarkedComplete, setHasMarkedComplete] = useState(false);

  // Get user name from localStorage if not provided
  const displayName = userName || (() => {
    try {
      const userData = localStorage.getItem('gradnext_user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.name || user.email || 'User';
      }
    } catch (e) {}
    return 'User';
  })();

  // Reset state when video changes
  useEffect(() => {
    setIsVideoEnded(false);
    setPlaybackSpeed('1');
    setIsPausedByVisibility(false);
    setShowPausedOverlay(false);
    setHasMarkedComplete(false);
  }, [video?.id]);

  // Update playback speed when changed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = parseFloat(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Tab visibility change handler - pause when tab is hidden
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - pause the video
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setIsPausedByVisibility(true);
          setShowPausedOverlay(true);
        }
      }
    };

    const handleWindowBlur = () => {
      // Window lost focus - pause the video
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPausedByVisibility(true);
        setShowPausedOverlay(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isOpen]);

  // Block screenshot shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Block PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        alert('Screenshots are disabled for this content.');
        return false;
      }
      
      // Block Cmd+Shift+3/4 (Mac screenshot)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        alert('Screenshots are disabled for this content.');
        return false;
      }

      // Block Ctrl+Shift+I (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        return false;
      }

      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  // Prevent right-click context menu
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  // Prevent drag
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  if (!video) return null;

  const rawUrl = video.video_url || video.recording_url;
  
  if (!rawUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Video Available</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600">This session doesn't have a video yet.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const useIframe = isEmbedUrl(rawUrl);
  const videoSrc = getEmbedUrl(rawUrl);

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = parseFloat(speed);
    }
  };

  const handleVideoEnded = () => {
    setIsVideoEnded(true);
    
    // Mark video as completed when it ends
    if (onVideoComplete && !hasMarkedComplete) {
      onVideoComplete();
      setHasMarkedComplete(true);
    }
    
    if (hasNextVideo && onNextVideo) {
      setTimeout(() => {
        if (isVideoEnded) {
          onNextVideo();
        }
      }, 3000);
    }
  };

  const handleNextClick = () => {
    // Mark current video as complete when moving to next
    if (onVideoComplete && !hasMarkedComplete) {
      onVideoComplete();
      setHasMarkedComplete(true);
    }
    if (onNextVideo) {
      onNextVideo();
    }
  };

  const handleResumeVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPausedByVisibility(false);
      setShowPausedOverlay(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl p-0 overflow-hidden select-none"
        onContextMenu={handleContextMenu}
      >
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-slate-900">
                {video.title}
              </DialogTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {video.duration}
                  </span>
                )}
                {video.mentor_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {video.mentor_name}
                  </span>
                )}
                {video.module && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {video.module}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-4">
          {/* Video Player Container */}
          <div 
            ref={containerRef}
            className="relative aspect-video bg-black rounded-lg overflow-hidden"
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {useIframe ? (
              <div className="relative w-full h-full">
                {/* Add CSS to hide YouTube logo */}
                <style dangerouslySetInnerHTML={{__html: `
                  /* Hide YouTube logo in player */
                  .ytp-chrome-top-buttons,
                  .ytp-watermark,
                  .ytp-youtube-button,
                  .ytp-title-link {
                    display: none !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                  }
                `}} />
                
                <iframe
                  src={videoSrc}
                  title={video.title}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  data-testid="video-player-iframe"
                  style={{ pointerEvents: showPausedOverlay ? 'none' : 'auto' }}
                />
                
                {/* Block entire bottom-right corner where YouTube logo appears */}
                {/* This covers both normal and fullscreen modes */}
                <div 
                  className="absolute bottom-0 right-0 w-32 h-16 pointer-events-auto"
                  style={{ 
                    zIndex: 10,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
                    backdropFilter: 'blur(8px)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                  }}
                  title="Protected content"
                >
                  {/* Protected badge */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 text-white text-xs opacity-70">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>Protected</span>
                  </div>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                autoPlay
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                className="w-full h-full"
                data-testid="video-player"
                onEnded={handleVideoEnded}
                onPlay={() => setIsVideoEnded(false)}
                onContextMenu={handleContextMenu}
                style={{ 
                  pointerEvents: showPausedOverlay ? 'none' : 'auto',
                }}
              >
                Your browser does not support the video tag.
              </video>
            )}

            {/* Full-Screen Diagonal Watermark Pattern */}
            <div 
              className="absolute inset-0 pointer-events-none overflow-hidden select-none"
              style={{ 
                zIndex: 5,
              }}
            >
              {/* Repeating watermark grid */}
              <div 
                className="absolute"
                style={{
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  transform: 'rotate(-25deg)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gridTemplateRows: 'repeat(8, 1fr)',
                  gap: '40px',
                  alignItems: 'center',
                  justifyItems: 'center',
                }}
              >
                {Array(40).fill(null).map((_, idx) => (
                  <span
                    key={idx}
                    className="text-white whitespace-nowrap select-none"
                    style={{
                      opacity: 0.12,
                      fontSize: '16px',
                      fontWeight: '500',
                      letterSpacing: '1px',
                      textShadow: '0 0 8px rgba(0,0,0,0.3)',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                  >
                    {displayName}
                  </span>
                ))}
              </div>
            </div>

            {/* Corner Watermarks - More visible */}
            <div 
              className="absolute top-3 left-3 text-white text-xs select-none pointer-events-none px-2 py-1 rounded"
              style={{ 
                opacity: 0.4, 
                backgroundColor: 'rgba(0,0,0,0.3)',
                zIndex: 6,
              }}
            >
              {displayName}
            </div>
            <div 
              className="absolute bottom-14 right-3 text-white text-xs select-none pointer-events-none px-2 py-1 rounded"
              style={{ 
                opacity: 0.4, 
                backgroundColor: 'rgba(0,0,0,0.3)',
                zIndex: 6,
              }}
            >
              {displayName}
            </div>

            {/* Tab Switch / Window Blur Overlay */}
            {showPausedOverlay && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10">
                <ShieldAlert className="w-16 h-16 text-yellow-500 mb-4" />
                <h3 className="text-white text-xl font-semibold mb-2">Video Paused</h3>
                <p className="text-slate-300 text-center mb-6 max-w-md">
                  The video was paused because you switched tabs or windows.<br />
                  Please stay on this tab to continue watching.
                </p>
                <Button 
                  onClick={handleResumeVideo}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                  data-testid="resume-video-btn"
                >
                  Resume Video
                </Button>
              </div>
            )}

            {/* Video Ended Overlay with Next Button */}
            {isVideoEnded && hasNextVideo && !showPausedOverlay && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                <p className="text-white text-lg mb-4">Video finished</p>
                <Button 
                  onClick={handleNextClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                  data-testid="next-video-overlay-btn"
                >
                  <SkipForward className="w-5 h-5 mr-2" />
                  Next Video
                </Button>
                <p className="text-slate-400 text-sm mt-2">Auto-advancing in 3 seconds...</p>
              </div>
            )}

            {/* Anti-screenshot overlay (transparent but blocks some screen capture tools) */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(transparent, transparent)',
                mixBlendMode: 'difference',
                opacity: 0.001,
              }}
            />
          </div>

          {/* Video Controls */}
          <div className="flex items-center justify-between mt-4 p-3 bg-slate-100 rounded-lg">
            {/* Playback Speed - only for non-iframe videos */}
            {!useIframe && (
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">Speed:</span>
                <Select value={playbackSpeed} onValueChange={handleSpeedChange}>
                  <SelectTrigger className="w-24 h-8" data-testid="speed-selector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <SelectItem key={speed.value} value={speed.value}>
                        {speed.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {useIframe && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Gauge className="w-4 h-4 text-slate-500" />
                <span>Use the ⚙️ (settings) icon in the video player to adjust playback speed</span>
              </div>
            )}

            {/* Next Video Button */}
            {hasNextVideo && (
              <Button 
                variant="outline" 
                onClick={handleNextClick}
                className="flex items-center gap-2"
                data-testid="next-video-btn"
              >
                <SkipForward className="w-4 h-4" />
                Next Video
              </Button>
            )}
          </div>

          {/* Protected Content Notice */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <ShieldAlert className="w-3 h-3" />
            <span>This content is protected. Unauthorized copying or distribution is prohibited.</span>
          </div>

          {/* Video Description */}
          {video.description && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">About this {type}</h4>
              <p className="text-sm text-slate-600">{video.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoPlayerModal;
