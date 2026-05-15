import React, { useState, useEffect } from 'react';
import { Clock, Globe, Check, X, MapPin } from 'lucide-react';

const TimezoneTest = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [testSessionTime, setTestSessionTime] = useState('15:00'); // 3:00 PM IST
  const [testSessionDate, setTestSessionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get browser timezone
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Parse session time as IST (the fix we implemented)
  const getSessionDateTimeIST = () => {
    const istDateTimeStr = `${testSessionDate}T${testSessionTime}:00+05:30`;
    return new Date(istDateTimeStr);
  };

  const sessionDateTime = getSessionDateTimeIST();
  const windowStart = new Date(sessionDateTime.getTime() - 10 * 60 * 1000); // 10 mins before
  const windowEnd = new Date(sessionDateTime.getTime() + 15 * 60 * 1000);   // 15 mins after
  
  const isJoinable = currentTime >= windowStart && currentTime <= windowEnd;
  
  // Format time in different timezones
  const formatInTimezone = (date, tz) => {
    try {
      return date.toLocaleString('en-US', { 
        timeZone: tz, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return 'Invalid timezone';
    }
  };

  const timezones = [
    { name: 'IST (India)', tz: 'Asia/Kolkata', flag: '🇮🇳' },
    { name: 'GMT (London)', tz: 'Europe/London', flag: '🇬🇧' },
    { name: 'EST (New York)', tz: 'America/New_York', flag: '🇺🇸' },
    { name: 'PST (Los Angeles)', tz: 'America/Los_Angeles', flag: '🇺🇸' },
    { name: 'SGT (Singapore)', tz: 'Asia/Singapore', flag: '🇸🇬' },
    { name: 'GST (Dubai)', tz: 'Asia/Dubai', flag: '🇦🇪' },
  ];

  const getTimeUntil = (targetDate) => {
    const diffMs = targetDate - currentTime;
    if (diffMs <= 0) return 'Now/Passed';
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins > 60) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🌍 Timezone Test Page</h1>
          <p className="text-slate-400">Test how session times work across different timezones</p>
        </div>

        {/* Your Browser Info */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Your Browser Timezone
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Detected Timezone</p>
              <p className="text-xl font-mono">{browserTimezone}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Current Local Time</p>
              <p className="text-xl font-mono">{currentTime.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-900/30 rounded-lg text-sm text-blue-300">
            💡 To test different timezones: Open DevTools (F12) → Press Ctrl+Shift+P → Type "sensors" → Change Location
          </div>
        </div>

        {/* Test Session Input */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-400" />
            Test Session (IST Time)
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-slate-400 text-sm block mb-1">Session Date</label>
              <input 
                type="date" 
                value={testSessionDate}
                onChange={(e) => setTestSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Session Time (IST)</label>
              <input 
                type="time" 
                value={testSessionTime}
                onChange={(e) => setTestSessionTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 rounded-lg text-white"
              />
            </div>
          </div>
          
          {/* Join Button Status */}
          <div className={`p-4 rounded-lg ${isJoinable ? 'bg-green-900/50 border border-green-500' : 'bg-slate-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isJoinable ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <X className="w-6 h-6 text-slate-400" />
                )}
                <div>
                  <p className="font-semibold">{isJoinable ? 'Join Button ENABLED' : 'Join Button DISABLED'}</p>
                  <p className="text-sm text-slate-400">
                    {currentTime < windowStart 
                      ? `Opens in ${getTimeUntil(windowStart)}`
                      : currentTime > windowEnd
                      ? 'Window closed'
                      : 'Join window is open!'}
                  </p>
                </div>
              </div>
              {isJoinable && (
                <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold">
                  Join Now
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Time Comparison Table */}
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            Session Time in Different Timezones
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                  <th className="pb-3">Timezone</th>
                  <th className="pb-3">Session Start</th>
                  <th className="pb-3">Join Opens</th>
                  <th className="pb-3">Join Closes</th>
                </tr>
              </thead>
              <tbody>
                {timezones.map((tz) => (
                  <tr key={tz.tz} className={`border-b border-slate-700/50 ${tz.tz === browserTimezone ? 'bg-blue-900/20' : ''}`}>
                    <td className="py-3">
                      <span className="mr-2">{tz.flag}</span>
                      {tz.name}
                      {tz.tz === browserTimezone && (
                        <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">You</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-sm">{formatInTimezone(sessionDateTime, tz.tz)}</td>
                    <td className="py-3 font-mono text-sm text-green-400">{formatInTimezone(windowStart, tz.tz)}</td>
                    <td className="py-3 font-mono text-sm text-red-400">{formatInTimezone(windowEnd, tz.tz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">🔧 Technical Details</h2>
          <div className="space-y-2 font-mono text-sm">
            <p><span className="text-slate-400">Stored session time:</span> {testSessionDate}T{testSessionTime}:00 IST</p>
            <p><span className="text-slate-400">Parsed as (with +05:30):</span> {sessionDateTime.toISOString()}</p>
            <p><span className="text-slate-400">Your local equivalent:</span> {sessionDateTime.toLocaleString()}</p>
            <p><span className="text-slate-400">Window start (UTC):</span> {windowStart.toISOString()}</p>
            <p><span className="text-slate-400">Window end (UTC):</span> {windowEnd.toISOString()}</p>
            <p><span className="text-slate-400">Current time (UTC):</span> {currentTime.toISOString()}</p>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <a href="/test-login" className="text-blue-400 hover:text-blue-300 underline">
            ← Back to Test Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default TimezoneTest;
