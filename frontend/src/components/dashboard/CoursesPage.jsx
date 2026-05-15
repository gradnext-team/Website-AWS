import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import {
  Play, Lock, ChevronRight, ChevronDown, BookOpen,
  Video, FileText, HelpCircle, Layers, FolderOpen,
  Clock, CheckCircle2, ArrowRight, Download, ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import VideoPlayerModal from '../ui/VideoPlayerModal';
import '../../styles/cardStyles.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Content type icon component
const ContentTypeIcon = ({ type, className = "w-4 h-4" }) => {
  switch (type) {
    case 'video': return <Video className={`${className} text-blue-500`} />;
    case 'pdf': return <FileText className={`${className} text-red-500`} />;
    case 'quiz': return <HelpCircle className={`${className} text-purple-500`} />;
    case 'mixed': return <Layers className={`${className} text-[#8C9DFF]`} />;
    default: return <Video className={`${className} text-blue-500`} />;
  }
};

// Quiz Modal Component
const QuizModal = ({ isOpen, onClose, session }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const questions = session?.quiz_questions || [];

  const handleAnswer = (questionIndex, optionIndex) => {
    setAnswers({ ...answers, [questionIndex]: optionIndex });
  };

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach((q, index) => {
      if (answers[index] === q.correct_index) correct++;
    });
    setScore(correct);
    setShowResults(true);
  };

  const handleReset = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setScore(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{session?.title}</h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>
        </div>

        <div className="p-6">
          {showResults ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
              <p className="text-slate-600 mb-6">
                You scored {score} out of {questions.length} ({Math.round((score / questions.length) * 100)}%)
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleReset}>Try Again</Button>
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-slate-500 mb-2">
                  <span>Question {currentQuestion + 1} of {questions.length}</span>
                  <span>{Object.keys(answers).length} answered</span>
                </div>
                <Progress value={((currentQuestion + 1) / questions.length) * 100} className="h-2" />
              </div>

              {/* Question */}
              {questions[currentQuestion] && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{questions[currentQuestion].question}</h3>
                  <div className="space-y-2">
                    {questions[currentQuestion].options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleAnswer(currentQuestion, index)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                          answers[currentQuestion] === index
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-6 pt-6 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                >
                  Previous
                </Button>
                {currentQuestion < questions.length - 1 ? (
                  <Button onClick={() => setCurrentQuestion(currentQuestion + 1)}>
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length < questions.length}
                  >
                    Submit Quiz
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// PDF Viewer Modal
const PDFModal = ({ isOpen, onClose, session }) => {
  if (!isOpen) return null;

  const pdfUrl = session?.pdf_url;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full h-[85vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{session?.title}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-1" /> Open in New Tab
            </Button>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>
        </div>
        <div className="flex-1">
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title={session?.title}
          />
        </div>
      </div>
    </div>
  );
};

const CoursesPage = () => {
  const { dashboardData, user, refreshDashboard, showUpgradeModal } = useDashboard();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedVideos, setCompletedVideos] = useState([]);
  
  // Navigation state
  const [expandedCourses, setExpandedCourses] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  
  // Selected content state
  const [selectedSession, setSelectedSession] = useState(null);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isPDFOpen, setIsPDFOpen] = useState(false);

  // Helper function to parse duration string (e.g., "2:30" or "15:30") to minutes
  const parseDurationToMinutes = (duration) => {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] + parts[1] / 60; // minutes + seconds/60
    }
    return 0;
  };

  // Helper function to format minutes to readable string
  const formatDuration = (totalMinutes) => {
    if (totalMinutes === 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Calculate total duration for a module
  const getModuleDuration = (module) => {
    if (!module.sessions) return '';
    const totalMinutes = module.sessions.reduce((acc, session) => {
      return acc + parseDurationToMinutes(session.duration);
    }, 0);
    return formatDuration(totalMinutes);
  };

  // Calculate total duration for a course
  const getCourseDuration = (course) => {
    if (!course.modules) return '';
    let totalMinutes = 0;
    course.modules.forEach(module => {
      if (module.sessions) {
        module.sessions.forEach(session => {
          totalMinutes += parseDurationToMinutes(session.duration);
        });
      }
    });
    return formatDuration(totalMinutes);
  };

  // Check if a session is completed
  const isSessionCompleted = (sessionId) => {
    return completedVideos.includes(sessionId);
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/resources/courses`, {
          withCredentials: true,
        });
        // Handle new response format with plan_status
        const coursesData = response.data.courses || response.data;
        setCourses(coursesData);
        
        // Auto-expand first course
        if (coursesData.length > 0) {
          setExpandedCourses({ [coursesData[0].id]: true });
          if (coursesData[0].modules?.length > 0) {
            setExpandedModules({ [coursesData[0].modules[0].id]: true });
          }
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Fetch completed videos from progress
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/resources/progress`, {
          withCredentials: true,
        });
        setCompletedVideos(response.data?.videos_completed || []);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      }
    };
    fetchProgress();
  }, []);

  const toggleCourse = (id) => setExpandedCourses(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));

  // Mark video as completed
  const markVideoCompleted = async (sessionId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/resources/progress/video/${sessionId}`, {}, {
        withCredentials: true,
      });
      setCompletedVideos(prev => [...prev, sessionId]);
      // Refresh dashboard data to update progress
      if (refreshDashboard) {
        refreshDashboard();
      }
    } catch (error) {
      console.error('Failed to mark video as completed:', error);
    }
  };

  const handleSessionClick = (session) => {
    if (session.locked) {
      return;
    }
    
    setSelectedSession(session);
    
    switch (session.content_type) {
      case 'video':
      case 'mixed':
        setIsVideoPlayerOpen(true);
        break;
      case 'quiz':
        setIsQuizOpen(true);
        break;
      case 'pdf':
        setIsPDFOpen(true);
        break;
      default:
        setIsVideoPlayerOpen(true);
    }
  };

  // Get all video sessions in order for next video functionality
  const getAllVideoSessions = () => {
    const sessions = [];
    courses.forEach(course => {
      course.modules?.forEach(module => {
        module.sessions?.forEach(session => {
          if ((session.content_type === 'video' || session.content_type === 'mixed') && !session.locked) {
            sessions.push(session);
          }
        });
      });
    });
    return sessions;
  };

  const getNextVideoSession = () => {
    const videoSessions = getAllVideoSessions();
    if (!selectedSession) return null;
    
    const currentIndex = videoSessions.findIndex(s => s.id === selectedSession.id);
    if (currentIndex === -1 || currentIndex >= videoSessions.length - 1) return null;
    
    return videoSessions[currentIndex + 1];
  };

  const handleNextVideo = () => {
    const nextSession = getNextVideoSession();
    if (nextSession) {
      setSelectedSession(nextSession);
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

  // Count total VIDEO sessions and unlocked VIDEO sessions (exclude PDFs and quizzes)
  const countSessions = () => {
    let total = 0;
    let unlocked = 0;
    courses.forEach(course => {
      course.modules?.forEach(module => {
        module.sessions?.forEach(session => {
          // Only count video and mixed content types
          if (session.content_type === 'video' || session.content_type === 'mixed') {
            total++;
            if (!session.locked) unlocked++;
          }
        });
      });
    });
    return { total, unlocked };
  };

  // Count completed VIDEO sessions only
  const countCompletedVideos = () => {
    let count = 0;
    courses.forEach(course => {
      course.modules?.forEach(module => {
        module.sessions?.forEach(session => {
          if ((session.content_type === 'video' || session.content_type === 'mixed') && 
              completedVideos.includes(session.id)) {
            count++;
          }
        });
      });
    });
    return count;
  };

  const completedVideoCount = countCompletedVideos();
  const { total: totalSessions, unlocked: unlockedSessions } = countSessions();
  const hasFullAccess = dashboardData?.access?.subscription && dashboardData?.access?.courses !== false;
  const hasCoursesAccess = dashboardData?.access?.courses !== false;
  const isAdminRestricted = dashboardData?.admin_restricted?.courses === true;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check if access is revoked by admin
  if (!hasCoursesAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700">Access Restricted</h2>
        <p className="text-slate-500 mt-2">
          {isAdminRestricted 
            ? "Your access to Courses has been restricted by admin. Please contact support."
            : "Upgrade your plan to access Courses."}
        </p>
        {!isAdminRestricted && (
          <Button onClick={handleUpgradeClick} className="mt-4" data-testid="upgrade-courses-btn">
            Upgrade
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="courses-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold page-title-dark">Courses</h1>
          <p className="text-slate-500">
            {hasFullAccess
              ? `${totalSessions} lessons available`
              : `${unlockedSessions} of ${totalSessions} lessons unlocked`}
          </p>
        </div>
        {!hasFullAccess && (
          <Button onClick={handleUpgradeClick} className="bg-[#2E3558] hover:bg-[#363EA7] text-white" data-testid="unlock-courses-btn">
            Unlock All Courses
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Progress Bar - Videos Only */}
      <div className="card-3d-base rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium card-header-dark">Video Progress</span>
          <span className="text-sm text-slate-500">
            {completedVideoCount}/{hasFullAccess ? totalSessions : unlockedSessions} videos completed
          </span>
        </div>
        <Progress
          value={(completedVideoCount / (hasFullAccess ? totalSessions : unlockedSessions || 1)) * 100}
          className="h-2"
        />
      </div>

      {/* Courses Content */}
      {courses.length === 0 ? (
        <div className="text-center py-12 card-3d-base rounded-xl">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium card-header-dark mb-2">No Courses Available</h3>
          <p className="text-slate-500">Check back soon for new content!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <div key={course.id} className="card-3d-base rounded-xl overflow-hidden" data-testid={`course-card-${course.id}`}>
              {/* Course Header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/50 transition-colors"
                onClick={() => toggleCourse(course.id)}
              >
                <div className="flex-shrink-0">
                  {expandedCourses[course.id] ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-16 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold card-header-dark">{course.title}</h3>
                  <p className="text-sm text-slate-500">
                    {course.modules?.length || 0} {course.modules?.length === 1 ? 'module' : 'modules'}
                    {getCourseDuration(course) && (
                      <span className="ml-2 text-slate-400">• {getCourseDuration(course)}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Course Content - Modules with Sessions directly */}
              {expandedCourses[course.id] && (
                <div className="border-t border-slate-100">
                  {course.modules?.map((module) => (
                    <div key={module.id} className="border-b border-slate-100 last:border-b-0">
                      {/* Module Header */}
                      <div
                        className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleModule(module.id)}
                      >
                        {expandedModules[module.id] ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <FolderOpen className="w-4 h-4 text-amber-500" />
                        <span className="font-medium text-slate-800">{module.title}</span>
                        <span className="text-sm text-slate-400">
                          ({module.sessions?.length || 0} session{module.sessions?.length !== 1 ? 's' : ''}
                          {getModuleDuration(module) && ` • ${getModuleDuration(module)}`})
                        </span>
                      </div>

                      {/* Sessions - Directly under Module */}
                      {expandedModules[module.id] && (
                        <div className="pl-8 pb-2">
                          {module.sessions?.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => handleSessionClick(session)}
                              className={`flex items-center gap-3 px-6 py-3 ml-4 border-l-2 rounded-r-lg transition-colors ${
                                session.locked
                                  ? 'border-slate-200 opacity-60 cursor-not-allowed'
                                  : isSessionCompleted(session.id)
                                  ? 'border-[#B1BCFF] bg-[#DEE3FF]/50 hover:bg-[#DEE3FF] cursor-pointer'
                                  : 'border-blue-200 hover:bg-blue-50 cursor-pointer'
                              }`}
                              data-testid={`session-${session.id}`}
                            >
                              <div className="flex-shrink-0">
                                {session.locked ? (
                                  <Lock className="w-4 h-4 text-slate-400" />
                                ) : isSessionCompleted(session.id) ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#8C9DFF]" />
                                ) : (
                                  <ContentTypeIcon type={session.content_type} />
                                )}
                              </div>
                              <div className="flex-1">
                                <span className={`${isSessionCompleted(session.id) ? 'text-[#2E3558]' : 'text-slate-700'}`}>
                                  {session.title}
                                </span>
                                {session.duration && (
                                  <span className="text-xs text-slate-400 ml-2 flex items-center gap-1 inline-flex">
                                    <Clock className="w-3 h-3" /> {session.duration}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isSessionCompleted(session.id) && (
                                  <span className="px-2 py-0.5 bg-[#DEE3FF] text-[#2E3558] text-xs rounded-full font-medium">Completed</span>
                                )}
                                {session.is_free && !session.locked && !isSessionCompleted(session.id) && (
                                  <span className="px-2 py-0.5 bg-[#FFE6B7] text-[#2E3558] text-xs rounded-full">Free</span>
                                )}
                                {session.locked ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); handleUpgradeClick(); }}
                                  >
                                    Unlock
                                  </Button>
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </div>
                          ))}
                          {(!module.sessions || module.sessions.length === 0) && (
                            <p className="text-sm text-slate-400 ml-4 py-2">No sessions yet</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={isVideoPlayerOpen}
        onClose={() => setIsVideoPlayerOpen(false)}
        video={selectedSession}
        type="video"
        onNextVideo={handleNextVideo}
        hasNextVideo={!!getNextVideoSession()}
        userName={user?.name || user?.email}
        onVideoComplete={() => {
          if (selectedSession?.id) {
            markVideoCompleted(selectedSession.id);
          }
        }}
      />

      {/* Quiz Modal */}
      <QuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        session={selectedSession}
      />

      {/* PDF Modal */}
      <PDFModal
        isOpen={isPDFOpen}
        onClose={() => setIsPDFOpen(false)}
        session={selectedSession}
      />
    </div>
  );
};

export default CoursesPage;
