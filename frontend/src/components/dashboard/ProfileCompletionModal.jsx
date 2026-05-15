import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import CollegeAutocomplete from '../CollegeAutocomplete';
import LocationAutocomplete from '../LocationAutocomplete';
import { CheckCircle, AlertCircle, ArrowRight, Loader2, Camera, Briefcase, Target, GraduationCap, Linkedin, Building2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Firm options
const FIRMS = [
  'McKinsey', 'BCG', 'Bain', 'Deloitte', 'PwC', 'EY', 'KPMG', 
  'Accenture', 'Oliver Wyman', 'Roland Berger', 'Kearney', 
  'L.E.K.', 'Strategy&', 'Other'
];

// Months for PG joining
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Years for PG joining
const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() + i).toString());

// Field container component with highlighting for missing fields
const FieldContainer = ({ fieldKey, icon: Icon, title, missing, complete, children }) => {
  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      missing && !complete 
        ? 'bg-amber-50 border-amber-300' 
        : complete 
          ? 'bg-green-50 border-green-200' 
          : 'bg-slate-50 border-slate-200'
    }`}>
      <Label className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <Icon className={`w-4 h-4 ${missing && !complete ? 'text-amber-600' : complete ? 'text-green-600' : 'text-slate-500'}`} />
        {title}
        {missing && !complete && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-normal ml-auto">
            <AlertCircle className="w-3 h-3" /> Required
          </span>
        )}
        {complete && (
          <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
        )}
      </Label>
      {children}
    </div>
  );
};

const ProfileCompletionModal = ({ 
  isOpen, 
  onClose, 
  missingFields = [], 
  currentProfileData = {},
  onProfileCompleted 
}) => {
  const [step, setStep] = useState('profile'); // 'profile' or 'availability'
  const [loading, setLoading] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  
  // Profile fields
  const [profilePicture, setProfilePicture] = useState(currentProfileData.profile_picture || null);
  const [linkedinUrl, setLinkedinUrl] = useState(currentProfileData.linkedin_url || '');
  const [location, setLocation] = useState(currentProfileData.location || '');
  const [yearsOfExperience, setYearsOfExperience] = useState(currentProfileData.years_of_experience ?? null);
  const [firmsTargeting, setFirmsTargeting] = useState(currentProfileData.firms_targeting || []);
  const [preparationLevel, setPreparationLevel] = useState(currentProfileData.preparation_level || '');
  const [ugCollege, setUgCollege] = useState(currentProfileData.ug_college || '');
  const [pgCollege, setPgCollege] = useState(currentProfileData.pg_college || '');
  const [noPg, setNoPg] = useState(currentProfileData.no_pg || false);
  const [pgIncoming, setPgIncoming] = useState(currentProfileData.pg_incoming || false);
  const [pgJoiningMonth, setPgJoiningMonth] = useState(currentProfileData.pg_joining_month || '');
  const [pgJoiningYear, setPgJoiningYear] = useState(currentProfileData.pg_joining_year || '');
  
  const experienceOptions = ['0-1', '1-2', '2-5', '5+'];
  const preparationLevels = ['Beginner', 'Intermediate', 'Advanced'];

  useEffect(() => {
    if (isOpen) {
      // Reset to profile step when modal opens
      setStep('profile');
      // Pre-fill with current data
      setProfilePicture(currentProfileData.profile_picture || null);
      setLinkedinUrl(currentProfileData.linkedin_url || '');
      setLocation(currentProfileData.location || '');
      setYearsOfExperience(currentProfileData.years_of_experience ?? null);
      setFirmsTargeting(currentProfileData.firms_targeting || []);
      setPreparationLevel(currentProfileData.preparation_level || '');
      setUgCollege(currentProfileData.ug_college || '');
      setPgCollege(currentProfileData.pg_college || '');
      setNoPg(currentProfileData.no_pg || false);
      setPgIncoming(currentProfileData.pg_incoming || false);
      setPgJoiningMonth(currentProfileData.pg_joining_month || '');
      setPgJoiningYear(currentProfileData.pg_joining_year || '');
    }
  }, [isOpen, currentProfileData]);

  const isMissing = (fieldName) => {
    return missingFields.some(field => 
      field.toLowerCase().includes(fieldName.toLowerCase())
    );
  };

  const isFieldComplete = (fieldName) => {
    switch(fieldName) {
      case 'picture': return !!profilePicture;
      case 'linkedin': return !!linkedinUrl;
      case 'location': return !!location;
      case 'experience': return yearsOfExperience !== null && yearsOfExperience !== '';
      case 'firms': return firmsTargeting.length > 0;
      case 'preparation': return !!preparationLevel;
      case 'ug': return !!ugCollege;
      case 'pg': return noPg || !!pgCollege;
      default: return false;
    }
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${BACKEND_URL}/api/profile/upload-picture`,
        formData,
        {
          withCredentials: true,
          // Content-Type auto-set by axios for FormData
        }
      );

      if (response.data && response.data.picture_url) {
        setProfilePicture(response.data.picture_url);
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (error) {
      console.error('Picture upload failed:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to upload picture. Please try again.';
      alert(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleToggleFirm = (firm) => {
    setFirmsTargeting(prev => 
      prev.includes(firm) 
        ? prev.filter(f => f !== firm)
        : [...prev, firm]
    );
  };

  const isProfileComplete = () => {
    for (const field of missingFields) {
      const fieldLower = field.toLowerCase();
      if (fieldLower.includes('picture') && !profilePicture) return false;
      if (fieldLower.includes('linkedin') && !linkedinUrl) return false;
      if (fieldLower.includes('location') && !location) return false;
      if (fieldLower.includes('experience') && (yearsOfExperience === null || yearsOfExperience === '')) return false;
      if (fieldLower.includes('firms') && firmsTargeting.length === 0) return false;
      if (fieldLower.includes('preparation') && !preparationLevel) return false;
      if (fieldLower.includes('ug') && !ugCollege) return false;
      if (fieldLower.includes('pg') && !noPg && !pgCollege) return false;
    }
    return true;
  };

  const handleSaveProfile = async () => {
    if (!isProfileComplete()) {
      alert('Please fill all highlighted fields');
      return;
    }

    setLoading(true);
    try {
      // Update main user profile (this will sync to peer profile)
      await axios.put(
        `${BACKEND_URL}/api/profile/update`,
        {
          picture: profilePicture,
          linkedin_url: linkedinUrl,
          location: location,
          years_of_experience: yearsOfExperience,
          target_firms: firmsTargeting,
          preparation_level: preparationLevel,
          ug_college: ugCollege,
          pg_college: noPg ? '' : pgCollege,
          no_pg: noPg,
          pg_incoming: pgIncoming,
          pg_joining_month: pgJoiningMonth,
          pg_joining_year: pgJoiningYear
        },
        { withCredentials: true }
      );

      // Also update peer profile to sync
      await axios.post(
        `${BACKEND_URL}/api/peers/update-profile`,
        {
          profile_picture: profilePicture,
          linkedin_url: linkedinUrl,
          location: location,
          years_of_experience: yearsOfExperience,
          firms_targeting: firmsTargeting,
          preparation_level: preparationLevel,
          ug_college: ugCollege,
          pg_college: noPg ? null : pgCollege,
          no_pg: noPg,
          pg_incoming: pgIncoming
        },
        { withCredentials: true }
      );

      // Now make the profile live by calling toggle-listing
      try {
        await axios.post(
          `${BACKEND_URL}/api/peers/toggle-listing`,
          {},
          { withCredentials: true }
        );
      } catch (toggleError) {
        // If toggle fails, log but continue to availability step
        console.error('Failed to make profile live:', toggleError);
      }

      // Move to availability step
      setStep('availability');
    } catch (error) {
      console.error('Profile update failed:', error);
      const errorDetail = error.response?.data?.detail;
      let errorMsg = 'Failed to update profile';
      if (errorDetail) {
        errorMsg = typeof errorDetail === 'string' ? errorDetail : 
                   errorDetail.message || JSON.stringify(errorDetail);
      }
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToAvailability = () => {
    onClose();
    if (onProfileCompleted) {
      onProfileCompleted();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === 'profile' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                  <Target className="w-4 h-4 text-blue-600" />
                </span>
                Complete Your Profile
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Fill in the highlighted fields below to make your profile visible for peer practice.
                {missingFields.length > 0 && (
                  <span className="block mt-1 text-amber-600 font-medium">
                    {missingFields.length} {missingFields.length === 1 ? 'field needs' : 'fields need'} to be completed.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Profile Picture */}
              <FieldContainer 
                fieldKey="picture" 
                icon={Camera} 
                title="Profile Picture"
                missing={isMissing('picture')}
                complete={isFieldComplete('picture')}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {profilePicture ? (
                      <img 
                        src={profilePicture} 
                        alt="Profile" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center border-2 border-dashed border-slate-300">
                        <Camera className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    {uploadingPicture && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePictureUpload}
                      disabled={uploadingPicture}
                      className="cursor-pointer text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Upload a professional photo (max 5MB). Google profile pictures do not count.
                    </p>
                  </div>
                </div>
              </FieldContainer>

              {/* LinkedIn URL */}
              <FieldContainer 
                fieldKey="linkedin" 
                icon={Linkedin} 
                title="LinkedIn Profile"
                missing={isMissing('linkedin')}
                complete={isFieldComplete('linkedin')}
              >
                <Input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full"
                />
              </FieldContainer>

              {/* Location - Predictive Search */}
              <FieldContainer 
                fieldKey="location" 
                icon={Target} 
                title="Country"
                missing={isMissing('location')}
                complete={isFieldComplete('location')}
              >
                <LocationAutocomplete
                  value={location}
                  onChange={setLocation}
                  placeholder="Start typing your country..."
                />
              </FieldContainer>

              {/* UG University - Predictive Search */}
              <FieldContainer 
                fieldKey="ug" 
                icon={Building2} 
                title="UG College/University"
                missing={isMissing('ug')}
                complete={isFieldComplete('ug')}
              >
                <CollegeAutocomplete
                  value={ugCollege}
                  onChange={setUgCollege}
                  placeholder="Start typing to search colleges..."
                />
              </FieldContainer>

              {/* PG University - Predictive Search with Checkboxes */}
              <FieldContainer 
                fieldKey="pg" 
                icon={GraduationCap} 
                title="PG College/University"
                missing={isMissing('pg')}
                complete={isFieldComplete('pg')}
              >
                <div className="space-y-3">
                  {/* Checkboxes row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        id="no-pg" 
                        checked={noPg}
                        onChange={(e) => {
                          setNoPg(e.target.checked);
                          if (e.target.checked) {
                            setPgCollege('');
                            setPgIncoming(false);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <label htmlFor="no-pg" className="text-sm text-slate-700 cursor-pointer">
                        Not Applicable
                      </label>
                    </div>
                    
                    {!noPg && (
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          id="pg-incoming" 
                          checked={pgIncoming}
                          onChange={(e) => setPgIncoming(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <label htmlFor="pg-incoming" className="text-sm text-slate-700 cursor-pointer">
                          I&apos;m an incoming student
                        </label>
                      </div>
                    )}
                  </div>

                  {/* College autocomplete */}
                  {!noPg && (
                    <CollegeAutocomplete
                      value={pgCollege}
                      onChange={setPgCollege}
                      placeholder="Start typing to search colleges..."
                    />
                  )}

                  {/* Joining date for incoming students */}
                  {!noPg && pgIncoming && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl">
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Joining Month</label>
                        <Select value={pgJoiningMonth} onValueChange={setPgJoiningMonth}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map(month => (
                              <SelectItem key={month} value={month}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Joining Year</label>
                        <Select value={pgJoiningYear} onValueChange={setPgJoiningYear}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEARS.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </FieldContainer>

              {/* Years of Experience */}
              <FieldContainer 
                fieldKey="experience" 
                icon={Briefcase} 
                title="Years of Experience"
                missing={isMissing('experience')}
                complete={isFieldComplete('experience')}
              >
                <Select value={yearsOfExperience?.toString() || ''} onValueChange={(val) => setYearsOfExperience(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceOptions.map(exp => (
                      <SelectItem key={exp} value={exp}>{exp} years</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContainer>

              {/* Target Firms */}
              <FieldContainer 
                fieldKey="firms" 
                icon={Target} 
                title="Target Firms"
                missing={isMissing('firms')}
                complete={isFieldComplete('firms')}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {FIRMS.map(firm => (
                    <button
                      key={firm}
                      type="button"
                      onClick={() => handleToggleFirm(firm)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                        firmsTargeting.includes(firm)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {firm}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Select at least one firm you are targeting
                </p>
              </FieldContainer>

              {/* Preparation Level */}
              <FieldContainer 
                fieldKey="preparation" 
                icon={GraduationCap} 
                title="Preparation Level"
                missing={isMissing('preparation')}
                complete={isFieldComplete('preparation')}
              >
                <div className="flex gap-2">
                  {preparationLevels.map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPreparationLevel(level)}
                      className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg border transition-all ${
                        preparationLevel === level
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </FieldContainer>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveProfile}
                disabled={!isProfileComplete() || loading}
                className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save & Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <span className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </span>
                You&apos;re Live!
              </DialogTitle>
              <DialogDescription>
                Your profile is now visible to other peers. Set your availability so they can book sessions with you.
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-green-50">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Profile is now live! 🎉</h3>
              <p className="text-slate-600 max-w-sm mx-auto">
                Set your availability so peers can find times that work for both of you.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Skip for Now
              </Button>
              <Button 
                onClick={handleGoToAvailability}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Set Availability Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCompletionModal;
