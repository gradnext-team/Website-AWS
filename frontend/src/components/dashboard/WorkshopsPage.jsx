import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import { Calendar, Clock, Lock, Play, ArrowRight, Video, User, CheckCircle, Users, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import VideoPlayerModal from '../ui/VideoPlayerModal';
import OptimizedImage from '../ui/OptimizedImage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const WorkshopsPage = () => {
  const { dashboardData, user, showUpgradeModal } = useDashboard();
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState([]);
  const [accessLevel, setAccessLevel] = useState('none');
  const [loading, setLoading] = useState(true);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isPlanExpired, setIsPlanExpired] = useState(false);
  const [isFreeTrial, setIsFreeTrial] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);

  const fetchWorkshops = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/resources/workshops`, {
        withCredentials: true,
      });
      if (response.data.workshops) {
        setWorkshops(response.data.workshops);
        setAccessLevel(response.data.access_level || 'none');
        setIsPlanExpired(response.data.is_plan_expired || false);
        setIsFreeTrial(response.data.is_free_trial || false);
      } else {
        setWorkshops(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const handleWorkshopClick = (workshop) => {
    if (!workshop.locked && workshop.is_past && (workshop.video_url || workshop.recording_url)) {
      setSelectedWorkshop(workshop);
      setIsPlayerOpen(true);
    }
  };

  const handleJoinWorkshop = (workshop) => {
    const meetLink = workshop.meet_link || workshop.meeting_link;
    if (meetLink) {
      // Ensure the link has a protocol (https://)
      const formattedLink = meetLink.startsWith('http://') || meetLink.startsWith('https://') 
        ? meetLink 
        : `https://${meetLink}`;
      window.open(formattedLink, '_blank');
    } else {
      alert(`Meeting link is not available yet. Please check back closer to the workshop time.`);
    }
  };

  const handleRegister = async (workshop) => {
    setRegisteringId(workshop.id);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/resources/workshops/${workshop.id}/register`,
        {},
        { withCredentials: true }
      );
      if (response.data.success) {
        alert('Successfully registered! You will receive a calendar invite shortly.');
        fetchWorkshops();
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to register. Please try again.');
    } finally {
      setRegisteringId(null);
    }
  };

  const handleUnregister = async (workshop) => {
    if (!window.confirm('Are you sure you want to unregister from this workshop?')) return;
    try {
      await axios.delete(
        `${BACKEND_URL}/api/resources/workshops/${workshop.id}/unregister`,
        { withCredentials: true }
      );
      alert('Successfully unregistered from workshop.');
      fetchWorkshops();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to unregister. Please try again.');
    }
  };

  /**
   * Parse workshop date + time string (e.g., "2025-01-10" + "10:00 AM IST") into a proper Date object.
   * Handles 12h format with AM/PM and IST timezone.
   */
  const parseWorkshopDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    
    // Remove timezone abbreviation (IST, etc.) and trim
    const cleanTime = timeStr.replace(/\s*(IST|GMT|UTC|EST|PST|CST|MST)\s*/gi, '').trim();
    
    // Parse 12h format: "10:00 AM", "2:30 PM", "02:30PM", etc.
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) {
      // Try direct ISO parse as fallback (e.g., time is already "14:00")
      const fallback = new Date(`${dateStr}T${cleanTime}`);
      return isNaN(fallback.getTime()) ? null : fallback;
    }
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = (match[3] || '').toUpperCase();
    
    // Convert 12h to 24h
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    
    // Workshop times are in IST (UTC+5:30)
    // Create date in IST by appending the IST offset
    const isoString = `${dateStr}T${h}:${m}:00+05:30`;
    const parsed = new Date(isoString);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const canJoinWorkshop = (workshop) => {
    if (!workshop.is_registered) return false;
    try {
      const workshopDateTime = parseWorkshopDateTime(workshop.date, workshop.time);
      if (!workshopDateTime) return false;
      const now = new Date();
      const diffMinutes = (workshopDateTime - now) / (1000 * 60);
      return diffMinutes <= 15 && diffMinutes >= -120;
    } catch {
      return false;
    }
  };

  const getCountdown = (dateStr, timeStr) => {
    try {
      const workshopDateTime = parseWorkshopDateTime(dateStr, timeStr);
      if (!workshopDateTime) return null;
      const now = new Date();
      const diff = workshopDateTime - now;
      
      if (diff <= 0) return null;
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return { days, hours, mins };
    } catch {
      return null;
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleUpgradeClick = () => {
    // Open the PlansModal (in-dashboard upgrade modal with coupon support)
    if (showUpgradeModal && typeof showUpgradeModal === 'function') {
      showUpgradeModal();
    } else {
      // Fallback: navigate to dashboard with upgrade modal trigger
      console.warn('showUpgradeModal not available, using fallback');
      navigate('/dashboard?upgrade=true');
    }
  };

  const hasWorkshopsAccess = dashboardData?.access?.workshops !== false;
  const isAdminRestricted = dashboardData?.admin_restricted?.workshops === true;
  const pastWorkshops = workshops.filter(w => w.is_past);
  const upcomingWorkshops = workshops.filter(w => !w.is_past);
  const featuredWorkshop = upcomingWorkshops[0];
  const otherUpcoming = upcomingWorkshops.slice(1);

  const hasAnyAccess = accessLevel !== 'none';
  const hasLiveAccess = accessLevel === 'recorded_and_live';
  const hasRecordedOnly = accessLevel === 'only_recorded';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasWorkshopsAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Access Restricted</h2>
        <p className="text-slate-500 mt-2">
          {isAdminRestricted 
            ? "Your access to Workshops has been restricted by admin. Please contact support."
            : "Upgrade your plan to access Workshops."}
        </p>
        {!isAdminRestricted && (
          <Button onClick={showUpgradeModal} className="mt-4">
            Upgrade Plan
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Access Level Info Banners */}
      {isPlanExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            <strong>Plan Expired:</strong> Your subscription has expired. Renew your plan to regain access to workshops.
          </p>
        </div>
      )}

      {isFreeTrial && !isPlanExpired && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>Free Trial:</strong> Workshop access is not included in the free trial. Upgrade to a paid plan to access workshops.
          </p>
        </div>
      )}

      {hasRecordedOnly && !isPlanExpired && !isFreeTrial && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-blue-800">
            <strong>Your Plan:</strong> You have access to recorded workshop sessions. Upgrade to join live workshops.
          </p>
          <Button size="sm" onClick={handleUpgradeClick} className="ml-4 bg-blue-600 hover:bg-blue-700">
            Upgrade for Live Access
          </Button>
        </div>
      )}

      {/* Hero Section - Featured Workshop */}
      {featuredWorkshop && (
        <div className="relative rounded-2xl overflow-hidden" style={{ height: '420px' }}>
          {/* Use hero thumbnail for featured section, fallback to card then legacy thumbnail */}
          <OptimizedImage 
            src={featuredWorkshop.thumbnail_hero || featuredWorkshop.thumbnail_card || featuredWorkshop.thumbnail}
            alt={featuredWorkshop.title}
            className="w-full h-full"
            fallbackClassName="bg-gradient-to-br from-blue-600 to-purple-700"
            eager={true}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          
          {/* Locked Overlay */}
          {featuredWorkshop.locked && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-center">
                <Lock className="w-16 h-16 text-white/60 mx-auto mb-4" />
                <p className="text-white/80 text-lg">Upgrade to access live workshops</p>
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 p-8 flex flex-col justify-end">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--gn-chrome-yellow)', color: 'var(--gn-rhino)' }}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  Next Workshop
                </span>
                {featuredWorkshop.is_registered && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500 text-white text-sm font-medium">
                    <CheckCircle className="w-4 h-4" /> Registered
                  </span>
                )}
                {featuredWorkshop.is_free && (
                  <span className="px-3 py-1 rounded-full bg-green-500 text-white text-sm font-medium">
                    Free
                  </span>
                )}
              </div>
              <h2 className="text-4xl font-bold text-white mb-3">{featuredWorkshop.title}</h2>
              <p className="text-white/80 text-lg mb-4">{featuredWorkshop.description}</p>
              <div className="flex items-center gap-6 text-white/70 mb-6">
                <span className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {featuredWorkshop.mentor_name} {featuredWorkshop.instructor_title && `· ${featuredWorkshop.instructor_title}`}
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {formatDate(featuredWorkshop.date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {featuredWorkshop.time} IST
                </span>
                {featuredWorkshop.registration_count > 0 && (
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {featuredWorkshop.registration_count} registered
                  </span>
                )}
              </div>
              
              {/* Action Buttons */}
              {!featuredWorkshop.locked && (
                <div className="flex gap-4">
                  {featuredWorkshop.is_registered ? (
                    <>
                      {canJoinWorkshop(featuredWorkshop) ? (
                        <Button 
                          className="bg-white text-black hover:bg-white/90 px-8 py-6 text-lg"
                          onClick={() => handleJoinWorkshop(featuredWorkshop)}
                        >
                          <Video className="w-5 h-5 mr-2" /> Join Now
                        </Button>
                      ) : (
                        <Button className="bg-white/20 text-white px-8 py-6 text-lg" disabled>
                          <Clock className="w-5 h-5 mr-2" /> Join available 15 min before
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        className="border-white/30 text-white hover:bg-white/10 px-6 py-6"
                        onClick={() => handleUnregister(featuredWorkshop)}
                      >
                        Cancel Registration
                      </Button>
                    </>
                  ) : featuredWorkshop.can_register ? (
                    <Button 
                      className="bg-white text-black hover:bg-white/90 px-8 py-6 text-lg"
                      onClick={() => handleRegister(featuredWorkshop)}
                      disabled={registeringId === featuredWorkshop.id}
                    >
                      {registeringId === featuredWorkshop.id ? 'Registering...' : 'Register Now'}
                    </Button>
                  ) : (
                    <Button 
                      className="bg-white text-black hover:bg-white/90 px-8 py-6 text-lg"
                      onClick={handleUpgradeClick}
                    >
                      Upgrade to Register
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Countdown */}
          {!featuredWorkshop.locked && getCountdown(featuredWorkshop.date, featuredWorkshop.time) && (
            <div className="absolute top-8 right-8 bg-white/10 backdrop-blur-md rounded-xl p-4">
              <p className="text-white/60 text-sm mb-2">Starts in</p>
              <div className="flex gap-3">
                {(() => {
                  const countdown = getCountdown(featuredWorkshop.date, featuredWorkshop.time);
                  return (
                    <>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">{countdown.days}</div>
                        <div className="text-xs text-white/60">Days</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">{countdown.hours}</div>
                        <div className="text-xs text-white/60">Hours</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">{countdown.mins}</div>
                        <div className="text-xs text-white/60">Mins</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* More Upcoming Workshops */}
      {otherUpcoming.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-900">More Upcoming Workshops</h3>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
            {otherUpcoming.map((workshop) => (
              <div 
                key={workshop.id} 
                className={`flex-shrink-0 w-80 bg-white rounded-xl border overflow-hidden transition-all ${
                  workshop.locked 
                    ? 'border-slate-200 opacity-75' 
                    : 'border-slate-200 hover:shadow-lg hover:-translate-y-1'
                }`}
              >
                <div className="relative h-40">
                  {/* Use card thumbnail for upcoming cards, fallback to legacy */}
                  <OptimizedImage 
                    src={workshop.thumbnail_card || workshop.thumbnail}
                    alt={workshop.title}
                    className="w-full h-full"
                    fallbackClassName="bg-gradient-to-br from-blue-500 to-purple-600"
                    eager
                  />
                  {workshop.locked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-white/70" />
                    </div>
                  )}
                  {workshop.is_registered && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Registered
                    </div>
                  )}
                  {workshop.is_free && !workshop.is_registered && (
                    <div className="absolute top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      Free
                    </div>
                  )}
                  {/* Registration count tag */}
                  {!workshop.is_past && workshop.registration_count > 0 && (
                    <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3" /> {workshop.registration_count} registered
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-slate-900 mb-1">{workshop.title}</h4>
                  <p className="text-sm text-slate-500 mb-3">
                    {workshop.mentor_name} {workshop.instructor_title && `· ${workshop.instructor_title}`}
                  </p>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-slate-600">{formatDate(workshop.date)} · {workshop.time}</span>
                  </div>
                  
                  {workshop.locked ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={handleUpgradeClick}>
                      <Lock className="w-4 h-4 mr-2" /> Upgrade to Register
                    </Button>
                  ) : workshop.is_registered ? (
                    canJoinWorkshop(workshop) ? (
                      <Button size="sm" className="w-full btn-primary-gradient" onClick={() => handleJoinWorkshop(workshop)}>
                        <Video className="w-4 h-4 mr-2" /> Join Now
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full" disabled>
                        <Clock className="w-4 h-4 mr-2" /> Join 15 min before
                      </Button>
                    )
                  ) : workshop.can_register ? (
                    <Button 
                      size="sm" 
                      className="w-full btn-primary-gradient"
                      onClick={() => handleRegister(workshop)}
                      disabled={registeringId === workshop.id}
                    >
                      {registeringId === workshop.id ? 'Registering...' : 'Register'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={handleUpgradeClick}>
                      Upgrade to Register
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Upcoming Workshops */}
      {upcomingWorkshops.length === 0 && (
        <div className="bg-slate-50 rounded-xl p-8 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Upcoming Workshops</h3>
          <p className="text-slate-500">Check back soon for new workshop announcements!</p>
        </div>
      )}

      {/* Past Workshop Recordings */}
      <div>
        <h3 className="text-xl font-semibold text-slate-900 mb-6">Past Workshop Recordings</h3>
        {pastWorkshops.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-8 text-center">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No recorded workshops available yet</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-4 gap-6">
            {pastWorkshops.map((workshop) => (
              <div 
                key={workshop.id} 
                className={`group cursor-pointer ${workshop.locked ? 'opacity-75' : ''}`}
                onClick={() => handleWorkshopClick(workshop)}
              >
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                  {/* Use recording thumbnail for past workshops, fallback to card then legacy */}
                  <OptimizedImage 
                    src={workshop.thumbnail_recording || workshop.thumbnail_card || workshop.thumbnail}
                    alt={workshop.title}
                    className={`w-full h-full ${!workshop.locked ? 'group-hover:scale-105 transition-transform duration-300' : ''}`}
                    fallbackClassName="bg-gradient-to-br from-slate-700 to-slate-900"
                    eager
                  />
                  
                  {workshop.locked ? (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <Lock className="w-8 h-8 text-white/70 mb-2" />
                      <span className="text-white/70 text-sm">Upgrade to unlock</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-slate-900 ml-1" />
                      </div>
                    </div>
                  )}
                  
                  {workshop.duration && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs">
                      {workshop.duration}
                    </div>
                  )}
                  {workshop.is_free && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-green-500 text-white text-xs">
                      Free
                    </div>
                  )}
                </div>
                <h4 className={`font-medium text-slate-900 mb-1 ${!workshop.locked ? 'group-hover:text-blue-600' : ''} transition-colors`}>
                  {workshop.title}
                </h4>
                <p className="text-sm text-slate-500">{workshop.mentor_name}</p>
                
                {workshop.locked && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpgradeClick();
                    }}
                  >
                    Unlock Recording
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedWorkshop && (
        <VideoPlayerModal
          isOpen={isPlayerOpen}
          onClose={() => {
            setIsPlayerOpen(false);
            setSelectedWorkshop(null);
          }}
          video={{
            id: selectedWorkshop.id,
            title: selectedWorkshop.title,
            video_url: selectedWorkshop.video_url || selectedWorkshop.recording_url,
            recording_url: selectedWorkshop.recording_url || selectedWorkshop.video_url,
            description: selectedWorkshop.description,
            duration: selectedWorkshop.duration
          }}
          type="workshop"
        />
      )}
    </div>
  );
};

export default WorkshopsPage;
