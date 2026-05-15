import React, { useState } from 'react';
import {
  Key, Send, CheckCircle2, XCircle, Loader2, Copy,
  Users, Calendar, BookOpen, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Code, ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PartnerApiTester = () => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [availableMentors, setAvailableMentors] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [bookings, setBookings] = useState([]);
  
  // Booking form
  const [bookingForm, setBookingForm] = useState({
    mentor_id: '',
    date: '',
    time_slot: '',
    candidate_name: '',
    candidate_email: '',
    session_type: 'case_interview',
    duration_minutes: 45
  });
  
  const [expandedSections, setExpandedSections] = useState({
    mentors: true,
    availability: false,
    booking: false,
    bookings: false
  });

  const addResult = (endpoint, method, status, data, error = null) => {
    setResults(prev => [{
      id: Date.now(),
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      status,
      data,
      error
    }, ...prev].slice(0, 20)); // Keep last 20 results
  };

  const makeRequest = async (endpoint, method = 'GET', body = null) => {
    if (!apiKey) {
      alert('Please enter an API key first');
      return null;
    }

    setLoading(true);
    try {
      const options = {
        method,
        headers: {
          'X-Partner-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${BACKEND_URL}/api/partner${endpoint}`, options);
      
      // Clone the response before reading it (in case we need to read it twice)
      const responseClone = response.clone();
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, try to get text
        const textBody = await responseClone.text();
        data = { error: 'Invalid JSON response', body: textBody };
      }
      
      addResult(endpoint, method, response.status, data, response.ok ? null : (data.detail || data.error));
      
      return { ok: response.ok, data, status: response.status };
    } catch (err) {
      addResult(endpoint, method, 'ERROR', null, err.message);
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Test API Health
  const testHealth = async () => {
    await makeRequest('/health');
  };

  // List Mentors
  const listMentors = async () => {
    const result = await makeRequest('/mentors');
    if (result?.ok) {
      setAvailableMentors(result.data.mentors || []);
    }
  };

  // Get Mentor Availability
  const getMentorAvailability = async () => {
    if (!selectedMentor) {
      alert('Please select a mentor first');
      return;
    }
    
    // Get next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const startDate = today.toISOString().split('T')[0];
    const endDate = nextWeek.toISOString().split('T')[0];
    
    const result = await makeRequest(`/mentors/${selectedMentor.id}/availability?start_date=${startDate}&end_date=${endDate}`);
    if (result?.ok) {
      setAvailability(result.data.availability || []);
    }
  };

  // Create Booking
  const createBooking = async () => {
    if (!bookingForm.mentor_id || !bookingForm.date || !bookingForm.time_slot || 
        !bookingForm.candidate_name || !bookingForm.candidate_email) {
      alert('Please fill all required fields');
      return;
    }
    
    const result = await makeRequest('/bookings', 'POST', bookingForm);
    if (result?.ok) {
      alert('Booking created successfully!');
      listBookings();
    }
  };

  // List Bookings
  const listBookings = async () => {
    const result = await makeRequest('/bookings');
    if (result?.ok) {
      setBookings(result.data.bookings || []);
    }
  };

  // Cancel Booking
  const cancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    const result = await makeRequest(`/bookings/${bookingId}`, 'DELETE');
    if (result?.ok) {
      alert('Booking cancelled');
      listBookings();
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Partner API Tester</h1>
              <p className="text-slate-500 text-sm">Test your Partner API integration</p>
            </div>
            <a 
              href="/admin" 
              className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
            >
              Back to Admin <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - API Key & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* API Key Input */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                API Key
              </h2>
              <div className="flex gap-3">
                <Input
                  type="password"
                  placeholder="Enter your Partner API key (pk_live_...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 font-mono"
                />
                <Button onClick={testHealth} disabled={loading || !apiKey}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Get your API key from the Admin Panel → Partner Integrations
              </p>
            </div>

            {/* 1. List Mentors */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('mentors')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
              >
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  1. List Assigned Mentors
                </h2>
                {expandedSections.mentors ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {expandedSections.mentors && (
                <div className="px-6 pb-6 border-t border-slate-100">
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-3">
                      <code className="bg-slate-100 px-2 py-1 rounded">GET /api/partner/mentors</code>
                    </p>
                    <Button onClick={listMentors} disabled={loading || !apiKey} className="mb-4">
                      <Send className="w-4 h-4 mr-2" />
                      Fetch Mentors
                    </Button>
                    
                    {availableMentors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">Select a mentor:</p>
                        {availableMentors.map(mentor => (
                          <div
                            key={mentor.id}
                            onClick={() => {
                              setSelectedMentor(mentor);
                              setBookingForm(prev => ({ ...prev, mentor_id: mentor.id }));
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedMentor?.id === mentor.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <img 
                                src={mentor.picture || '/default-avatar.png'} 
                                alt={mentor.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              <div>
                                <div className="font-medium text-slate-900">{mentor.name}</div>
                                <div className="text-sm text-slate-500">{mentor.title} • {mentor.consulting_firm}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 font-mono">ID: {mentor.id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Get Availability */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('availability')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
              >
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-500" />
                  2. Get Mentor Availability
                </h2>
                {expandedSections.availability ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {expandedSections.availability && (
                <div className="px-6 pb-6 border-t border-slate-100">
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-3">
                      <code className="bg-slate-100 px-2 py-1 rounded">GET /api/partner/mentors/{'{mentor_id}'}/availability</code>
                    </p>
                    
                    {selectedMentor ? (
                      <>
                        <p className="text-sm text-slate-600 mb-3">
                          Selected: <strong>{selectedMentor.name}</strong>
                        </p>
                        <Button onClick={getMentorAvailability} disabled={loading} className="mb-4">
                          <Send className="w-4 h-4 mr-2" />
                          Get Next 7 Days Availability
                        </Button>
                        
                        {availability.length > 0 && (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {availability.map((day, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                <div className="font-medium text-slate-900">{day.date} ({day.day})</div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {day.slots?.map((slot, sIdx) => (
                                    <button
                                      key={sIdx}
                                      onClick={() => setBookingForm(prev => ({ 
                                        ...prev, 
                                        date: day.date, 
                                        time_slot: slot 
                                      }))}
                                      className={`px-2 py-1 text-xs rounded ${
                                        bookingForm.date === day.date && bookingForm.time_slot === slot
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-amber-600">⚠️ Please select a mentor first from Step 1</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Create Booking */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('booking')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
              >
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-500" />
                  3. Create Booking
                </h2>
                {expandedSections.booking ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {expandedSections.booking && (
                <div className="px-6 pb-6 border-t border-slate-100">
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-3">
                      <code className="bg-slate-100 px-2 py-1 rounded">POST /api/partner/bookings</code>
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Mentor ID</label>
                        <Input
                          value={bookingForm.mentor_id}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, mentor_id: e.target.value }))}
                          placeholder="Select from Step 1"
                          className="mt-1 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Date (YYYY-MM-DD)</label>
                        <Input
                          value={bookingForm.date}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                          placeholder="2026-03-15"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Time Slot (HH:MM)</label>
                        <Input
                          value={bookingForm.time_slot}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, time_slot: e.target.value }))}
                          placeholder="10:00"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Session Type</label>
                        <select
                          value={bookingForm.session_type}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, session_type: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
                        >
                          <option value="case_interview">Case Interview</option>
                          <option value="fit_interview">Fit Interview</option>
                          <option value="resume_review">Resume Review</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Candidate Name</label>
                        <Input
                          value={bookingForm.candidate_name}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, candidate_name: e.target.value }))}
                          placeholder="John Doe"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700">Candidate Email</label>
                        <Input
                          value={bookingForm.candidate_email}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, candidate_email: e.target.value }))}
                          placeholder="john@example.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <Button onClick={createBooking} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                      <Send className="w-4 h-4 mr-2" />
                      Create Booking
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. List Bookings */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('bookings')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
              >
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-orange-500" />
                  4. List & Manage Bookings
                </h2>
                {expandedSections.bookings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {expandedSections.bookings && (
                <div className="px-6 pb-6 border-t border-slate-100">
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-3">
                      <code className="bg-slate-100 px-2 py-1 rounded">GET /api/partner/bookings</code>
                    </p>
                    
                    <Button onClick={listBookings} disabled={loading} className="mb-4">
                      <Send className="w-4 h-4 mr-2" />
                      Fetch Bookings
                    </Button>
                    
                    {bookings.length > 0 ? (
                      <div className="space-y-2">
                        {bookings.map(booking => (
                          <div key={booking.id} className="p-4 bg-slate-50 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-slate-900">{booking.candidate_name}</div>
                                <div className="text-sm text-slate-500">{booking.candidate_email}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                  {booking.date} at {booking.time_slot} • {booking.duration_minutes} min
                                </div>
                                <div className="text-sm text-slate-500">
                                  Mentor: {booking.mentor_name} • {booking.session_type?.replace('_', ' ')}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  booking.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                                  booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {booking.status}
                                </span>
                                {booking.status === 'scheduled' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelBooking(booking.id)}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 font-mono">ID: {booking.id}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No bookings yet. Create one in Step 3!</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Results Log */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 sticky top-24">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Code className="w-5 h-5 text-slate-500" />
                  API Response Log
                </h2>
                {results.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setResults([])}>
                    Clear
                  </Button>
                )}
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {results.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    <Code className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>API responses will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {results.map(result => (
                      <div key={result.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {result.status >= 200 && result.status < 300 ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-sm font-medium ${
                              result.status >= 200 && result.status < 300 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {result.status}
                            </span>
                            <span className="text-xs text-slate-500">{result.method}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs font-mono text-slate-600 mb-2">{result.endpoint}</div>
                        {result.error && (
                          <div className="text-xs text-red-600 mb-2">Error: {result.error}</div>
                        )}
                        <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-40">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                        <div className="text-xs text-slate-400 mt-2">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* API Documentation */}
        <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick API Reference</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-2">Authentication</div>
              <code className="text-xs bg-slate-200 px-2 py-1 rounded block">
                Header: X-Partner-API-Key: pk_live_xxxxx
              </code>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-2">Production Base URL</div>
              <code className="text-xs bg-slate-200 px-2 py-1 rounded block break-all">
                https://app.gradnext.co/api/partner
              </code>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-2">List Mentors</div>
              <code className="text-xs bg-slate-200 px-2 py-1 rounded block">GET /mentors</code>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-2">Get Availability</div>
              <code className="text-xs bg-slate-200 px-2 py-1 rounded block">
                GET /mentors/{'{id}'}/availability?start_date=...&end_date=...
              </code>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-2">Create Booking</div>
              <code className="text-xs bg-slate-200 px-2 py-1 rounded block">POST /bookings</code>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-2">Cancel Booking</div>
              <code className="text-xs bg-slate-200 px-2 py-1 rounded block">DELETE /bookings/{'{id}'}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerApiTester;
