import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  User, GraduationCap, Building, Target, BarChart3,
  ChevronRight, ChevronLeft, Phone
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
} from '../ui/dialog';
import CollegeAutocomplete from '../CollegeAutocomplete';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Common country codes for phone number
const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
];

// Firm options for multi-select
const FIRMS = [
  'McKinsey', 'BCG', 'Bain', 'Kearney', 'Strategy&', 
  'Monitor Deloitte', 'Deloitte', 'EY-Parthenon', 'LEK', 'Oliver Wyman', 
  'Accenture Strategy', 'Roland Berger', 'Simon-Kucher', 'ZS Associates', 
  'Alvarez & Marsal', 'PwC Strategy&', 'KPMG Strategy'
];

// Prep objectives options
const PREP_OBJECTIVES = [
  { value: 'passive', label: 'Passively preparing for consulting' },
  { value: 'applications_submitted', label: 'I have submitted my applications, waiting for an interview invite' },
  { value: 'interview_invite', label: 'I already have an interview invite' },
  { value: 'cleared_rounds', label: 'I have cleared one or more interview rounds' },
];

// Prep levels
const PREP_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Just starting my case prep journey' },
  { value: 'intermediate', label: 'Intermediate', description: 'Done some cases, building skills' },
  { value: 'advanced', label: 'Advanced', description: 'Interview-ready, polishing skills' },
];

const ProfileOnboarding = ({ isOpen, onComplete, userName }) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: userName?.split(' ')[0] || '',
    last_name: userName?.split(' ').slice(1).join(' ') || '',
    phone_country_code: '+91',
    phone_number: '',
    ug_college: '',
    pg_college: '',
    no_pg: false, // New field: "I haven't done post-graduation yet"
    pg_incoming: false,
    pg_joining_month: '',
    pg_joining_year: '',
    target_firms: [],
    other_firms: '',
    prep_objective: '',
    other_objective: '',
    preparation_level: '',
  });

  const totalSteps = 6; // Reduced from 8: Name, UG, PG, Firms (optional), Objective (optional), Level (optional)

  // Detect country code based on IP on mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_calling_code;
        if (countryCode) {
          const formattedCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
          setProfileData(prev => ({ ...prev, phone_country_code: formattedCode }));
        }
      } catch (error) {
        // Could not detect country, using default
      }
    };
    detectCountry();
  }, []);

  const updateField = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const toggleFirm = (firm) => {
    setProfileData(prev => ({
      ...prev,
      target_firms: prev.target_firms.includes(firm)
        ? prev.target_firms.filter(f => f !== firm)
        : [...prev.target_firms, firm]
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1: // Name & Phone - mandatory
        return profileData.first_name.trim() && profileData.last_name.trim() && profileData.phone_number.trim();
      case 2: // UG College - mandatory
        return profileData.ug_college.trim();
      case 3: // PG College - mandatory (unless "no_pg" is checked)
        return profileData.no_pg || profileData.pg_college.trim();
      case 4: // Target Firms - optional
      case 5: // Prep Objective - optional
      case 6: // Preparation Level - optional
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Combine target firms with other firms
      let allFirms = [...profileData.target_firms];
      if (profileData.other_firms.trim()) {
        allFirms.push(profileData.other_firms.trim());
      }

      // Use other_objective if selected "other"
      const finalObjective = profileData.prep_objective === 'other' 
        ? profileData.other_objective 
        : profileData.prep_objective;

      // Format full phone number
      const fullPhoneNumber = profileData.phone_number 
        ? `${profileData.phone_country_code}${profileData.phone_number}`
        : '';

      // Prepare the data
      const submitData = {
        name: `${profileData.first_name} ${profileData.last_name}`.trim(),
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone_number: fullPhoneNumber,
        phone_country_code: profileData.phone_country_code,
        ug_college: profileData.ug_college,
        pg_college: profileData.no_pg ? '' : profileData.pg_college,
        no_pg: profileData.no_pg,
        pg_incoming: profileData.pg_incoming,
        pg_joining_month: profileData.pg_joining_month,
        pg_joining_year: profileData.pg_joining_year,
        target_firms: allFirms,
        prep_objective: finalObjective,
        other_objective: profileData.other_objective,
        preparation_level: profileData.preparation_level || 'beginner', // Default to beginner if not set
        onboarding_completed: true,
      };

      await axios.put(`${BACKEND_URL}/api/profile/update`, submitData, {
        withCredentials: true
      });

      onComplete();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <User className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Let's get started</h2>
              <p className="text-slate-500 mt-2">Tell us a bit about yourself</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">First Name *</label>
                  <Input
                    value={profileData.first_name}
                    onChange={(e) => updateField('first_name', e.target.value)}
                    placeholder="First name"
                    className="text-base py-5"
                    data-testid="onboarding-first-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Last Name *</label>
                  <Input
                    value={profileData.last_name}
                    onChange={(e) => updateField('last_name', e.target.value)}
                    placeholder="Last name"
                    className="text-base py-5"
                    data-testid="onboarding-last-name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number *
                </label>
                <div className="flex gap-2">
                  <select
                    value={profileData.phone_country_code}
                    onChange={(e) => updateField('phone_country_code', e.target.value)}
                    className="w-28 px-3 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                    data-testid="onboarding-phone-country"
                  >
                    {COUNTRY_CODES.map(({ code, country, flag }) => (
                      <option key={code} value={code}>
                        {flag} {code}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="tel"
                    value={profileData.phone_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      updateField('phone_number', value);
                    }}
                    placeholder="Phone number"
                    className="flex-1 text-base py-5"
                    data-testid="onboarding-phone-number"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Country code auto-detected based on your location
                </p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <GraduationCap className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Your undergraduate college</h2>
              <p className="text-slate-500 mt-2">Where did you complete your undergrad?</p>
            </div>
            <CollegeAutocomplete
              label="UG College/University *"
              value={profileData.ug_college}
              onChange={(value) => updateField('ug_college', value)}
              placeholder="Start typing to search colleges..."
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <GraduationCap className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Your postgraduate college</h2>
              <p className="text-slate-500 mt-2">Where are you doing or did your PG?</p>
            </div>
            
            {/* Checkboxes row: Not Applicable and Incoming Student */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="no_pg"
                  checked={profileData.no_pg}
                  onChange={(e) => {
                    updateField('no_pg', e.target.checked);
                    if (e.target.checked) {
                      updateField('pg_college', '');
                      updateField('pg_incoming', false);
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  data-testid="onboarding-no-pg"
                />
                <label htmlFor="no_pg" className="text-slate-700 cursor-pointer">
                  Not Applicable
                </label>
              </div>
              
              {!profileData.no_pg && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pg_incoming"
                    checked={profileData.pg_incoming}
                    onChange={(e) => updateField('pg_incoming', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    data-testid="onboarding-pg-incoming"
                  />
                  <label htmlFor="pg_incoming" className="text-slate-700 cursor-pointer">
                    I'm an incoming student
                  </label>
                </div>
              )}
            </div>

            {!profileData.no_pg && (
              <>
                <CollegeAutocomplete
                  label="PG College/University *"
                  value={profileData.pg_college}
                  onChange={(value) => updateField('pg_college', value)}
                  placeholder="Start typing to search colleges..."
                />

                {profileData.pg_incoming && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Joining Month</label>
                      <select
                        value={profileData.pg_joining_month}
                        onChange={(e) => updateField('pg_joining_month', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Select month</option>
                        {['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Joining Year</label>
                      <select
                        value={profileData.pg_joining_year}
                        onChange={(e) => updateField('pg_joining_year', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Select year</option>
                        {[2024, 2025, 2026, 2027].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <Building className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Target firms</h2>
              <p className="text-slate-500 mt-2">Which firms are you targeting? (Optional)</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {FIRMS.map(firm => (
                <button
                  key={firm}
                  onClick={() => toggleFirm(firm)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    profileData.target_firms.includes(firm)
                      ? 'text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  style={profileData.target_firms.includes(firm) ? { backgroundColor: 'var(--gn-rhino)' } : {}}
                >
                  {firm}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Other firm (if not listed)</label>
              <Input
                value={profileData.other_firms}
                onChange={(e) => updateField('other_firms', e.target.value)}
                placeholder="Enter firm name"
                className="text-base py-5"
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <Target className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Your current objective</h2>
              <p className="text-slate-500 mt-2">Where are you in your prep journey? (Optional)</p>
            </div>
            
            <div className="space-y-3">
              {PREP_OBJECTIVES.map(obj => (
                <button
                  key={obj.value}
                  onClick={() => updateField('prep_objective', obj.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                    profileData.prep_objective === obj.value
                      ? ''
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={profileData.prep_objective === obj.value ? { 
                    borderColor: 'var(--gn-rhino)', 
                    backgroundColor: 'var(--gn-periwinkle-lighter)' 
                  } : {}}
                >
                  <span className="font-medium text-slate-900">{obj.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                <BarChart3 className="w-8 h-8" style={{ color: 'var(--gn-rhino)' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>Your preparation level</h2>
              <p className="text-slate-500 mt-2">How would you rate your case prep skills? (Optional)</p>
            </div>
            
            <div className="space-y-3">
              {PREP_LEVELS.map(level => (
                <button
                  key={level.value}
                  onClick={() => updateField('preparation_level', level.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                    profileData.preparation_level === level.value
                      ? ''
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={profileData.preparation_level === level.value ? { 
                    borderColor: 'var(--gn-rhino)', 
                    backgroundColor: 'var(--gn-periwinkle-lighter)' 
                  } : {}}
                >
                  <div className="font-medium text-slate-900">{level.label}</div>
                  <div className="text-sm text-slate-500 mt-1">{level.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Check if current step is optional (steps 4, 5, 6)
  const isOptionalStep = step >= 4;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" hideClose>
        <div className="py-4">
          {renderStepContent()}

          {/* Progress indicator */}
          <div className="mt-8">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${(step / totalSteps) * 100}%`,
                  background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-periwinkle) 100%)'
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-slate-500">Step {step} of {totalSteps}</span>
              <div className="flex gap-1">
                {[...Array(totalSteps)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < step ? '' : 'bg-slate-200'
                    }`}
                    style={i < step ? { backgroundColor: 'var(--gn-rhino)' } : {}}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <Button
              onClick={handleBack}
              variant="ghost"
              disabled={step === 1}
              className="text-slate-600"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            <div className="flex gap-2">
              {/* Skip button for optional steps */}
              {isOptionalStep && step < totalSteps && (
                <Button
                  onClick={handleNext}
                  variant="outline"
                  className="text-slate-600"
                >
                  Skip
                </Button>
              )}
              
              {step < totalSteps ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="text-white"
                  style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-periwinkle) 100%)' }}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="text-white"
                  style={{ background: 'linear-gradient(135deg, var(--gn-rhino) 0%, var(--gn-periwinkle) 100%)' }}
                >
                  {saving ? 'Saving...' : 'Complete Setup'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileOnboarding;
