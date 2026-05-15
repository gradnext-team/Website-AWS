import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import {
  GraduationCap, Video, Calendar, Clock, Lock, Play, ArrowRight,
  FileText, Users, CheckCircle2, ExternalLink, FolderOpen, Download,
  AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '../ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CohortPage = () => {
  const { user, dashboardData, refreshDashboard } = useDashboard();
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [registeringCohort, setRegisteringCohort] = useState(null);
  const [programEnrollments, setProgramEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);

  const hasCohortAccess = dashboardData?.access?.cohort;

  useEffect(() => {
    fetchCohortData();
  }, []);

  const fetchCohortData = async () => {
    // Get the auth token from localStorage (set by auto-login after cohort payment)
    const authToken = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
    const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    try {
      setLoading(true);

      // NEW: paid cohort program enrollments (live sessions, Meet links, recordings)
      try {
        const progRes = await axios.get(`${BACKEND_URL}/api/cohorts/my-enrollments`, {
          withCredentials: true,
          headers: authHeaders,
        });
        setProgramEnrollments(progRes.data?.enrollments || []);
      } catch (e) {
        // Not signed in or no enrollments — silently ignore
        setProgramEnrollments([]);
      }

      // LEGACY: cohort-group enrollment + registering cohort for the original flow
      try {
        const enrollmentRes = await axios.get(`${BACKEND_URL}/api/resources/cohort/my-enrollment`, {
          withCredentials: true,
          headers: authHeaders,
        });
        setEnrollmentData(enrollmentRes.data);

        if (!enrollmentRes.data?.enrolled) {
          try {
            const regRes = await axios.get(`${BACKEND_URL}/api/resources/cohort/registering`, {
              withCredentials: true,
              headers: authHeaders,
            });
            setRegisteringCohort(regRes.data);
          } catch {
            setRegisteringCohort(null);
          }
        }
      } catch {
        // Legacy enrollment not available — that's OK for new-style cohort users
        setEnrollmentData({ enrolled: false });
      }
    } catch (error) {
      console.error('Failed to fetch cohort data:', error);
      setError('Failed to load cohort information');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (cohortId) => {
    const authToken = localStorage.getItem('session_token') || localStorage.getItem('auth_token');
    const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    try {
      setRegistering(true);
      setError(null);
      await axios.post(`${BACKEND_URL}/api/resources/cohort/register/${cohortId}`, {}, {
        withCredentials: true,
        headers: authHeaders,
      });
      // Refresh data
      await fetchCohortData();
      if (refreshDashboard) refreshDashboard();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to register for cohort');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // NEW: Live cohort program enrolment(s). Render at top — if user has
  // a paid cohort program enrolment, this becomes the primary view.
  const renderProgramEnrollments = () => {
    if (!programEnrollments?.length) return null;
    return (
      <div className="space-y-5" data-testid="cohort-program-enrollments">
        {programEnrollments.map((enr) => (
          <div key={enr.enrollment_id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded">
                  Enrolled
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-900">{enr.cohort?.name}</h2>
                {enr.cohort?.tagline && (
                  <p className="text-sm text-slate-600 mt-0.5">{enr.cohort.tagline}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {enr.cohort?.duration_weeks} weeks</span>
                  <span className="inline-flex items-center gap-1"><Video className="w-3 h-3" /> {enr.sessions?.length || 0} live sessions</span>
                </div>
              </div>
            </div>

            {/* Sessions list */}
            <div className="mt-5 border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden" data-testid={`cohort-program-sessions-${enr.cohort?.id}`}>
              {(enr.sessions || []).map((s) => {
                const hasMeet = !!s.meet_link;
                const isPast = s.status === 'completed' || (s.date && new Date(`${s.date}T${s.time_slot || '00:00'}`) < new Date());
                return (
                  <div key={s.id || `${s.week_number}-${s.topic}`} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
                    <div className="w-9 h-9 rounded-md bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 rounded">W{s.week_number}</span>
                        <p className="text-sm font-medium text-slate-900 truncate">{s.topic}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {s.day_label && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {s.day_label}</span>}
                        {s.date && <span>{s.date}</span>}
                        {s.time_slot && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {s.time_slot}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {s.recording_url && (
                        <a
                          href={s.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs inline-flex items-center gap-1 text-slate-700 hover:text-violet-700"
                        >
                          <Play className="w-3.5 h-3.5" /> Recording
                        </a>
                      )}
                      {hasMeet && !isPast && (
                        <a
                          href={s.meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded bg-violet-600 text-white font-medium hover:bg-violet-700 inline-flex items-center gap-1"
                          data-testid={`cohort-program-join-${s.id || s.week_number}`}
                        >
                          Join <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {!hasMeet && !isPast && (
                        <span className="text-xs text-slate-400">Link coming soon</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (programEnrollments?.length > 0 && !enrollmentData?.enrolled) {
    // Pure new-cohort-program experience
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Cohort</h1>
          <p className="text-slate-500">Your enrolled cohort programs</p>
        </div>
        {renderProgramEnrollments()}
      </div>
    );
  }

  // User is enrolled in a cohort - show their cohort content
  if (enrollmentData?.enrolled && enrollmentData?.cohort) {
    const cohort = enrollmentData.cohort;
    return (
      <div className="space-y-6" data-testid="cohort-enrolled-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Cohort</h1>
            <p className="text-slate-500">{cohort.name}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            cohort.status === 'active' ? 'bg-green-100 text-green-700' : 
            cohort.status === 'registering' ? 'bg-blue-100 text-blue-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {cohort.status === 'active' ? '🟢 Active' : 
             cohort.status === 'registering' ? '🟡 Starting Soon' : 
             '✅ Completed'}
          </span>
        </div>

        {/* Cohort Info */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-500 rounded-2xl p-6 text-white">
          <p className="text-violet-100 mb-2">{cohort.description}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" /> {cohort.start_date} - {cohort.end_date}
            </span>
          </div>
        </div>

        {/* Sections and Resources */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-900">Cohort Materials</h2>
          
          {(cohort.sections || []).length === 0 && (cohort.resources || []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No materials uploaded yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {/* Sections */}
              {(cohort.sections || []).map((section) => (
                <div key={section.id} className="bg-white rounded-xl border border-slate-100 p-6" data-testid={`section-${section.id}`}>
                  <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-violet-500" />
                    {section.title}
                  </h3>
                  {section.description && (
                    <p className="text-sm text-slate-500 mb-4">{section.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    {(cohort.resources || [])
                      .filter(r => r.section_id === section.id)
                      .map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                          data-testid={`resource-${resource.id}`}
                        >
                          <span className="flex items-center gap-2 text-slate-700">
                            {resource.type === 'video' ? (
                              <Video className="w-4 h-4 text-violet-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-violet-500" />
                            )}
                            {resource.title}
                          </span>
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                      ))}
                    {(cohort.resources || []).filter(r => r.section_id === section.id).length === 0 && (
                      <p className="text-sm text-slate-400 italic">No resources in this section yet</p>
                    )}
                  </div>
                </div>
              ))}

              {/* General Resources (no section) */}
              {(cohort.resources || []).filter(r => !r.section_id).length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-500" />
                    General Resources
                  </h3>
                  <div className="space-y-2">
                    {(cohort.resources || [])
                      .filter(r => !r.section_id)
                      .map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <span className="flex items-center gap-2 text-slate-700">
                            <FileText className="w-4 h-4 text-violet-500" />
                            {resource.title}
                          </span>
                          <Download className="w-4 h-4 text-slate-400" />
                        </a>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // User is NOT enrolled - show registration option
  return (
    <div className="space-y-6" data-testid="cohort-registration-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cohort Program</h1>
        <p className="text-slate-500">8-week intensive consulting prep program</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Registering Cohort Available */}
      {registeringCohort?.cohort && registeringCohort.can_register ? (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 text-center" data-testid="registering-cohort-card">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-blue-600" />
          </div>
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            🟡 Now Accepting Registrations
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{registeringCohort.cohort.name}</h2>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            {registeringCohort.cohort.description || 'Join our next cohort and get access to live sessions, mentorship, and peer practice.'}
          </p>
          
          <div className="flex items-center justify-center gap-4 text-sm text-slate-600 mb-6">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Starts: {registeringCohort.cohort.start_date}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {registeringCohort.cohort.spots_remaining} spots left
            </span>
          </div>

          {registeringCohort.cohort.price > 0 && (
            <p className="text-3xl font-bold text-slate-900 mb-6">
              ₹{registeringCohort.cohort.price?.toLocaleString()}
            </p>
          )}

          <Button 
            size="lg" 
            className="bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-700 hover:to-violet-600 text-white"
            onClick={() => handleRegister(registeringCohort.cohort.id)}
            disabled={registering}
            data-testid="register-cohort-btn"
          >
            {registering ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                Register Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      ) : registeringCohort?.is_enrolled_elsewhere ? (
        // User is enrolled in another cohort
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2">Already Enrolled</h3>
          <p className="text-slate-600">You are already enrolled in a cohort. Check your cohort page for details.</p>
        </div>
      ) : registeringCohort?.cohort?.is_full ? (
        // Cohort is full
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
          <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900 mb-2">Cohort Full</h3>
          <p className="text-slate-600">The current cohort is full. Please check back for the next batch.</p>
        </div>
      ) : (
        // No registering cohort available
        <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-violet-100 flex items-center justify-center mb-6">
            <GraduationCap className="w-10 h-10 text-violet-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Join Our Next Cohort</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            No cohort is currently accepting registrations. Check back soon or contact us for updates.
          </p>

          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <Video className="w-6 h-6 text-violet-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">8</p>
              <p className="text-xs text-slate-500">Live Sessions</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <Users className="w-6 h-6 text-violet-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">15+</p>
              <p className="text-xs text-slate-500">Peer Practice</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <Calendar className="w-6 h-6 text-violet-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">8</p>
              <p className="text-xs text-slate-500">Weeks</p>
            </div>
          </div>

          <Link to="/cohort">
            <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white">
              View Cohort Details
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      )}

      {/* What's Included */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">What You Get</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-violet-500" />
              8 live group sessions (2 hours each)
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-violet-500" />
              Expert-led case walkthroughs
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-violet-500" />
              Peer practice matching
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-violet-500" />
              Exclusive materials and frameworks
            </li>
          </ul>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Program Structure</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-violet-500" />
              8-week intensive program
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <Video className="w-4 h-4 text-violet-500" />
              Weekly live sessions
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="w-4 h-4 text-violet-500" />
              Small batch size (max 50)
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-600">
              <GraduationCap className="w-4 h-4 text-violet-500" />
              Certificate on completion
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CohortPage;
