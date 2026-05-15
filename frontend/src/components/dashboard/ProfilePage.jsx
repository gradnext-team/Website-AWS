import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDashboard } from './DashboardLayout';
import { 
  User, Mail, Save, Camera,
  Building, GraduationCap, Target, BarChart3, Linkedin, Check, Briefcase, CreditCard,
  Phone, MessageCircle, X, Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import CollegeAutocomplete from '../CollegeAutocomplete';
import LocationAutocomplete from '../LocationAutocomplete';
import SubscriptionManagement from '../ui/SubscriptionManagement';
import TimezoneSelect from './TimezoneSelect';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
  { value: 'other', label: 'Other' },
];

// Prep levels
const PREP_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'Just starting my case prep journey' },
  { value: 'intermediate', label: 'Intermediate', description: 'Done some cases, building skills' },
  { value: 'advanced', label: 'Advanced', description: 'Interview-ready, polishing skills' },
];

const ProfilePage = () => {
  const { user, refreshUser } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [linkedinError, setLinkedinError] = useState('');
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    location: '',
    location_country_code: '',
    years_of_experience: 0,
    ug_college: '',
    pg_college: '',
    no_pg: false,
    pg_incoming: false,
    pg_joining_month: '',
    pg_joining_year: '',
    linkedin_url: '',
    target_firms: [],
    other_firms: '',
    prep_objective: '',
    other_objective: '',
    preparation_level: 'beginner',
    picture: null,
  });
  const [picturePreview, setPicturePreview] = useState(null);
  const fileInputRef = useRef(null);

  // WhatsApp phone state
  const [phoneState, setPhoneState] = useState({
    countryCode: '+91',
    phoneNumber: '',
    savedNumber: '',
    savedCountryCode: '',
    hasSaved: false,
  });
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');

  // Validate LinkedIn URL
  const isValidLinkedInUrl = (url) => {
    if (!url) return true; // Empty is ok
    const linkedinPattern = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
    return linkedinPattern.test(url.trim());
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await axios.get(`${BACKEND_URL}/api/profile/me`, { withCredentials: true });
        
        const data = profileRes.data;
        // Separate other firms from target_firms if any non-standard firm exists
        const standardFirms = data.target_firms?.filter(f => FIRMS.includes(f)) || [];
        const otherFirms = data.target_firms?.filter(f => !FIRMS.includes(f)).join(', ') || '';
        
        setProfile({
          first_name: data.first_name || data.name?.split(' ')[0] || '',
          last_name: data.last_name || data.name?.split(' ').slice(1).join(' ') || '',
          location: data.location || '',
          location_country_code: data.location_country_code || '',
          years_of_experience: data.years_of_experience || 0,
          ug_college: data.ug_college || '',
          pg_college: data.pg_college || '',
          no_pg: data.no_pg || false,
          pg_incoming: data.pg_incoming || false,
          pg_joining_month: data.pg_joining_month || '',
          pg_joining_year: data.pg_joining_year || '',
          linkedin_url: data.linkedin_url || '',
          target_firms: standardFirms,
          other_firms: otherFirms,
          prep_objective: data.prep_objective || '',
          other_objective: data.other_objective || '',
          preparation_level: data.preparation_level || data.preparation_stage || 'beginner',
          picture: data.picture || null,
        });
        setPicturePreview(data.picture);
        
        // Load phone state
        const hasPhone = !!(data.phone_number);
        setPhoneState({
          countryCode: data.phone_country_code || '+91',
          phoneNumber: data.phone_number || '',
          savedNumber: hasPhone ? data.phone_number : '',
          savedCountryCode: hasPhone ? (data.phone_country_code || '+91') : '',
          hasSaved: hasPhone,
        });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    // Validate LinkedIn URL before saving
    if (profile.linkedin_url && !isValidLinkedInUrl(profile.linkedin_url)) {
      setLinkedinError('Please enter a valid LinkedIn profile URL');
      return;
    }
    
    setSaving(true);
    try {
      // Combine target firms with other firms
      let allFirms = [...profile.target_firms];
      if (profile.other_firms.trim()) {
        allFirms.push(...profile.other_firms.split(',').map(f => f.trim()).filter(f => f));
      }

      await axios.put(`${BACKEND_URL}/api/profile/update`, {
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        first_name: profile.first_name,
        last_name: profile.last_name,
        location: profile.location,
        location_country_code: profile.location_country_code,
        years_of_experience: profile.years_of_experience,
        ug_college: profile.ug_college,
        pg_college: profile.no_pg ? '' : profile.pg_college,
        no_pg: profile.no_pg,
        pg_incoming: profile.pg_incoming,
        pg_joining_month: profile.pg_joining_month,
        pg_joining_year: profile.pg_joining_year,
        linkedin_url: profile.linkedin_url?.trim() || '',
        target_firms: allFirms,
        prep_objective: profile.prep_objective,
        other_objective: profile.other_objective,
        preparation_level: profile.preparation_level,
      }, {
        withCredentials: true
      });
      
      // Refresh dashboard data
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPicturePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(
        `${BACKEND_URL}/api/profile/upload-picture`,
        formData,
        { 
          withCredentials: true,
          // Content-Type auto-set by axios for FormData
        }
      );
      
      if (res.data.picture_url) {
        setProfile(prev => ({ ...prev, picture: res.data.picture_url }));
        setPicturePreview(res.data.picture_url);
        // Refresh user data in context to update sidebar
        if (refreshUser) {
          await refreshUser();
        }
      }
    } catch (error) {
      console.error('Failed to upload picture:', error);
    } finally {
      setUploadingPicture(false);
    }
  };

  const toggleFirm = (firm) => {
    setProfile(prev => ({
      ...prev,
      target_firms: prev.target_firms.includes(firm)
        ? prev.target_firms.filter(f => f !== firm)
        : [...prev.target_firms, firm]
    }));
  };

  // ===== Phone Save Handlers =====

  const handleSavePhone = async () => {
    setPhoneError('');
    setPhoneSuccess('');

    if (!phoneState.phoneNumber || phoneState.phoneNumber.length < 7) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }

    setPhoneSaving(true);
    try {
      await axios.post(`${BACKEND_URL}/api/profile/phone/save`, {
        phone_number: phoneState.phoneNumber,
        country_code: phoneState.countryCode,
      }, { withCredentials: true });

      setPhoneState(prev => ({
        ...prev,
        savedNumber: prev.phoneNumber,
        savedCountryCode: prev.countryCode,
        hasSaved: true,
      }));
      setPhoneEditing(false);
      setPhoneSuccess('Phone number saved successfully!');
      if (refreshUser) await refreshUser();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to save phone number.';
      setPhoneError(detail);
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleRemovePhone = async () => {
    setPhoneError('');
    setPhoneSuccess('');
    try {
      await axios.delete(`${BACKEND_URL}/api/profile/phone/remove`, { withCredentials: true });
      setPhoneState({
        countryCode: '+91',
        phoneNumber: '',
        savedNumber: '',
        savedCountryCode: '',
        hasSaved: false,
      });
      setPhoneEditing(false);
      setPhoneSuccess('Phone number removed.');
      if (refreshUser) await refreshUser();
    } catch (err) {
      setPhoneError('Failed to remove phone number.');
    }
  };

  const handleCancelPhoneEdit = () => {
    setPhoneEditing(false);
    setPhoneError('');
    setPhoneSuccess('');
    if (phoneState.hasSaved) {
      setPhoneState(prev => ({
        ...prev,
        phoneNumber: prev.savedNumber,
        countryCode: prev.savedCountryCode,
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gn-periwinkle)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--gn-rhino)' }}>My Profile</h1>
          <p style={{ color: 'var(--gn-grey)' }}>Manage your profile information</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: 'var(--gn-rhino)' }}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Profile Picture & Basic Info */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid var(--gn-periwinkle-lighter)' }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
          <User className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
          Basic Information
        </h2>
        
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Picture */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {picturePreview ? (
                <img
                  src={picturePreview.startsWith('http') || picturePreview.startsWith('/') 
                    ? (picturePreview.startsWith('/') ? `${BACKEND_URL}/api${picturePreview}` : picturePreview)
                    : picturePreview}
                  alt="Profile"
                  className="w-28 h-28 rounded-full object-cover"
                  style={{ border: '4px solid var(--gn-periwinkle-lighter)' }}
                />
              ) : (
                <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', border: '4px solid var(--gn-periwinkle-light)' }}>
                  <span className="text-3xl font-bold" style={{ color: 'var(--gn-rhino)' }}>
                    {profile.first_name?.[0]}{profile.last_name?.[0]}
                  </span>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 text-white rounded-full flex items-center justify-center shadow-lg hover:opacity-90"
                style={{ backgroundColor: 'var(--gn-rhino)' }}
                disabled={uploadingPicture}
              >
                {uploadingPicture ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>Click to change photo</p>
          </div>

          {/* Name & Email */}
          <div className="flex-1 grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>First Name</label>
              <Input
                value={profile.first_name}
                onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>Last Name</label>
              <Input
                value={profile.last_name}
                onChange={(e) => setProfile({...profile, last_name: e.target.value})}
                placeholder="Last name"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>Email</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--gn-grey-light)', border: '1px solid var(--gn-grey-light)' }}>
                <Mail className="w-4 h-4" style={{ color: 'var(--gn-grey)' }} />
                <span style={{ color: 'var(--gn-grey-dark)' }}>{user?.email}</span>
              </div>
            </div>

            {/* WhatsApp Number */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--gn-grey-dark)' }}>
                <MessageCircle className="w-4 h-4" style={{ color: '#25D366' }} />
                WhatsApp Number
              </label>

              {/* Error / Success Messages */}
              {phoneError && (
                <div className="mb-3 p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  <X className="w-4 h-4 flex-shrink-0" />
                  {phoneError}
                </div>
              )}
              {phoneSuccess && (
                <div className="mb-3 p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {phoneSuccess}
                </div>
              )}

              {/* Display: saved number or add prompt */}
              {!phoneEditing && (
                <div>
                  {phoneState.hasSaved ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <Phone className="w-4 h-4" style={{ color: '#25D366' }} />
                        <span className="font-medium" style={{ color: 'var(--gn-grey-dark)' }}>
                          {phoneState.savedCountryCode} {phoneState.savedNumber}
                        </span>
                      </div>
                      <button
                        onClick={() => { setPhoneEditing(true); setPhoneError(''); setPhoneSuccess(''); }}
                        className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
                        style={{ backgroundColor: 'var(--gn-periwinkle-lighter)', color: 'var(--gn-rhino)' }}
                      >
                        Change
                      </button>
                      <button
                        onClick={handleRemovePhone}
                        className="px-3 py-2.5 text-sm rounded-lg transition-colors hover:bg-red-100"
                        style={{ color: '#dc2626' }}
                        title="Remove number"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPhoneEditing(true); setPhoneError(''); setPhoneSuccess(''); }}
                      className="w-full p-4 rounded-lg border-2 border-dashed text-sm transition-all hover:border-solid flex items-center justify-center gap-2"
                      style={{ borderColor: 'var(--gn-periwinkle-light)', color: 'var(--gn-grey)' }}
                    >
                      <Phone className="w-4 h-4" />
                      Add WhatsApp number to receive updates
                    </button>
                  )}
                </div>
              )}

              {/* Edit Mode: Enter and save phone number */}
              {phoneEditing && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={phoneState.countryCode}
                      onChange={(e) => setPhoneState(prev => ({ ...prev, countryCode: e.target.value }))}
                      className="px-3 py-2.5 rounded-lg bg-white focus:outline-none focus:ring-2 text-sm w-24"
                      style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                    >
                      <option value="+91">+91</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+971">+971</option>
                      <option value="+65">+65</option>
                      <option value="+61">+61</option>
                      <option value="+49">+49</option>
                      <option value="+33">+33</option>
                      <option value="+81">+81</option>
                      <option value="+86">+86</option>
                      <option value="+82">+82</option>
                      <option value="+60">+60</option>
                      <option value="+63">+63</option>
                      <option value="+66">+66</option>
                      <option value="+62">+62</option>
                    </select>
                    <Input
                      value={phoneState.phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d]/g, '');
                        setPhoneState(prev => ({ ...prev, phoneNumber: val }));
                      }}
                      placeholder="Enter phone number"
                      className="flex-1"
                      maxLength={15}
                    />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--gn-grey)' }}>
                    This number will be used for WhatsApp updates about your sessions and preparation.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSavePhone}
                      disabled={phoneSaving || !phoneState.phoneNumber || phoneState.phoneNumber.length < 7}
                      className="text-white"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      {phoneSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> Save Number</>
                      )}
                    </Button>
                    <Button
                      onClick={handleCancelPhoneEdit}
                      variant="outline"
                      style={{ borderColor: 'var(--gn-grey-light)', color: 'var(--gn-grey-dark)' }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>LinkedIn Profile</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gn-grey)' }}>
                  <Linkedin className="w-4 h-4" />
                </div>
                <Input
                  value={profile.linkedin_url}
                  onChange={(e) => {
                    setProfile({...profile, linkedin_url: e.target.value});
                    if (e.target.value && !isValidLinkedInUrl(e.target.value)) {
                      setLinkedinError('Please enter a valid LinkedIn URL (e.g., linkedin.com/in/yourname)');
                    } else {
                      setLinkedinError('');
                    }
                  }}
                  placeholder="linkedin.com/in/yourprofile"
                  className={`pl-10 ${linkedinError ? 'border-red-300' : ''}`}
                />
              </div>
              {linkedinError && (
                <p className="text-sm text-red-500 mt-1">{linkedinError}</p>
              )}
              {profile.linkedin_url && !linkedinError && isValidLinkedInUrl(profile.linkedin_url) && (
                <p className="text-sm mt-1 flex items-center gap-1" style={{ color: 'var(--gn-periwinkle)' }}>
                  <Check className="w-4 h-4" /> Valid LinkedIn URL
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <LocationAutocomplete
                label="Location"
                value={profile.location}
                onChange={(value) => setProfile({...profile, location: value})}
                onCountryCodeChange={(code) => setProfile(prev => ({...prev, location_country_code: code}))}
                placeholder="Start typing your country..."
              />
              <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>This will be shown on your peer practice card</p>
            </div>
            <div>
              <TimezoneSelect
                value={user?.timezone}
                onChange={(tz) => { /* persisted by component; user context refreshes via refreshUser on next mount */ refreshUser?.(); }}
                endpoint="/api/auth/timezone"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>
                Coaching slots, peer practice and your sessions display in this timezone.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>
                <Briefcase className="w-4 h-4 inline mr-1" />
                Years of Experience
              </label>
              <select
                value={profile.years_of_experience}
                onChange={(e) => setProfile({...profile, years_of_experience: parseInt(e.target.value) || 0})}
                className="w-full px-3 py-2 rounded-lg bg-white focus:outline-none focus:ring-2"
                style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                data-testid="profile-experience"
              >
                <option value={0}>No experience / Fresher</option>
                <option value={1}>1 year</option>
                <option value={2}>2 years</option>
                <option value={3}>3 years</option>
                <option value={4}>4 years</option>
                <option value={5}>5 years</option>
                <option value={6}>6 years</option>
                <option value={7}>7 years</option>
                <option value={8}>8 years</option>
                <option value={9}>9 years</option>
                <option value={10}>10+ years</option>
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>Your work experience will be shown on your peer card</p>
            </div>
          </div>
        </div>
      </div>

      {/* Education */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid var(--gn-periwinkle-lighter)' }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
          <GraduationCap className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
          Education
        </h2>
        
        <div className="space-y-4">
          <CollegeAutocomplete
            label="UG College/University"
            value={profile.ug_college}
            onChange={(value) => setProfile({...profile, ug_college: value})}
            placeholder="Start typing to search colleges..."
          />
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>PG College/University</label>
            
            {/* Checkboxes row: Not Applicable and Incoming Student */}
            <div className="flex items-center gap-6 mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="no_pg"
                  checked={profile.no_pg}
                  onChange={(e) => {
                    setProfile({
                      ...profile, 
                      no_pg: e.target.checked,
                      pg_college: e.target.checked ? '' : profile.pg_college,
                      pg_incoming: e.target.checked ? false : profile.pg_incoming
                    });
                  }}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--gn-periwinkle)' }}
                  data-testid="profile-no-pg"
                />
                <label htmlFor="no_pg" className="text-sm cursor-pointer" style={{ color: 'var(--gn-grey-dark)' }}>
                  Not Applicable
                </label>
              </div>
              
              {!profile.no_pg && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pg_incoming"
                    checked={profile.pg_incoming}
                    onChange={(e) => setProfile({...profile, pg_incoming: e.target.checked})}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--gn-periwinkle)' }}
                  />
                  <label htmlFor="pg_incoming" className="text-sm cursor-pointer" style={{ color: 'var(--gn-grey-dark)' }}>
                    I&apos;m an incoming student
                  </label>
                </div>
              )}
            </div>

            {!profile.no_pg && (
              <>
                <CollegeAutocomplete
                  value={profile.pg_college}
                  onChange={(value) => setProfile({...profile, pg_college: value})}
                  placeholder="Start typing to search colleges..."
                />

                {profile.pg_incoming && (
                  <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--gn-periwinkle-lighter)' }}>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>Joining Month</label>
                      <select
                        value={profile.pg_joining_month}
                        onChange={(e) => setProfile({...profile, pg_joining_month: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg bg-white focus:outline-none focus:ring-2"
                        style={{ border: '1px solid var(--gn-periwinkle-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                      >
                        <option value="">Select month</option>
                        {['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>Joining Year</label>
                      <select
                        value={profile.pg_joining_year}
                        onChange={(e) => setProfile({...profile, pg_joining_year: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg bg-white focus:outline-none focus:ring-2"
                        style={{ border: '1px solid var(--gn-periwinkle-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
                      >
                        <option value="">Select year</option>
                        {[2025, 2026, 2027].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Target Firms */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid var(--gn-periwinkle-lighter)' }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
          <Building className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
          Target Firms
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--gn-grey)' }}>Select firms you&apos;re targeting for consulting roles</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {FIRMS.map((firm) => (
            <button
              key={firm}
              onClick={() => toggleFirm(firm)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={profile.target_firms.includes(firm) 
                ? { backgroundColor: 'var(--gn-rhino)', color: 'white' }
                : { backgroundColor: 'var(--gn-grey-light)', color: 'var(--gn-grey-dark)' }
              }
            >
              {firm}
            </button>
          ))}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>Other firms</label>
          <Input
            value={profile.other_firms}
            onChange={(e) => setProfile({...profile, other_firms: e.target.value})}
            placeholder="Enter other firms (comma separated)"
          />
        </div>
      </div>

      {/* Prep Objective */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid var(--gn-periwinkle-lighter)' }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
          <Target className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
          Current Objective
        </h2>
        
        <div className="grid gap-3">
          {PREP_OBJECTIVES.map((objective) => (
            <button
              key={objective.value}
              onClick={() => setProfile({...profile, prep_objective: objective.value})}
              className="w-full p-4 rounded-xl border-2 text-left transition-all"
              style={profile.prep_objective === objective.value
                ? { borderColor: 'var(--gn-periwinkle)', backgroundColor: 'var(--gn-periwinkle-lighter)' }
                : { borderColor: 'var(--gn-grey-light)' }
              }
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={profile.prep_objective === objective.value
                    ? { borderColor: 'var(--gn-periwinkle)', backgroundColor: 'var(--gn-periwinkle)' }
                    : { borderColor: 'var(--gn-grey-light)' }
                  }
                >
                  {profile.prep_objective === objective.value && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="font-medium" style={{ color: 'var(--gn-rhino)' }}>{objective.label}</span>
              </div>
            </button>
          ))}
          
          {profile.prep_objective === 'other' && (
            <div className="mt-2">
              <Input
                value={profile.other_objective}
                onChange={(e) => setProfile({...profile, other_objective: e.target.value})}
                placeholder="Please specify your objective"
              />
            </div>
          )}
        </div>
      </div>

      {/* Preparation Level */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid var(--gn-periwinkle-lighter)' }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
          <BarChart3 className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
          Preparation Level
        </h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          {PREP_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => setProfile({...profile, preparation_level: level.value})}
              className="p-4 rounded-xl border-2 text-center transition-all"
              style={profile.preparation_level === level.value
                ? { borderColor: 'var(--gn-periwinkle)', backgroundColor: 'var(--gn-periwinkle-lighter)' }
                : { borderColor: 'var(--gn-grey-light)' }
              }
            >
              <p className="font-semibold" style={{ color: 'var(--gn-rhino)' }}>{level.label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--gn-grey)' }}>{level.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Billing & Subscription Section */}
      {(user?.plan === 'basic_plan' || user?.plan === 'pro_plan' || user?.plan === 'pro_plus' || user?.plan === 'free_trial') && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--gn-rhino)' }}>
            <CreditCard className="w-5 h-5" style={{ color: 'var(--gn-periwinkle)' }} />
            Billing & Subscription
          </h2>
          <SubscriptionManagement user={user} onUpdate={refreshUser} />
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          size="lg" 
          className="text-white"
          style={{ backgroundColor: 'var(--gn-rhino)' }}
          data-testid="save-profile-btn"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
};

export default ProfilePage;
