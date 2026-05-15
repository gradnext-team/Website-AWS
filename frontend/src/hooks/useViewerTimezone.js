import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getBrowserTimezone, getTimezoneAbbr } from '../utils/timezone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * useViewerTimezone
 * Source-of-truth for the current user's display timezone:
 *   1. If the user/mentor has a saved profile timezone → use it.
 *   2. Otherwise auto-detect from the browser AND save it to profile.
 *
 * Returns: { timezone, abbr, source }
 *   - source: 'profile' | 'browser-saved' | 'browser'
 *
 * Pass `user` from your auth context. If `user.timezone` is missing, the
 * browser TZ is used.  If `user.timezone === 'Asia/Kolkata'` AND the user has
 * no `timezone_set_by_user` flag, we treat it as default and overwrite with the
 * browser TZ on first mount (mentors via PUT /mentor-dashboard/profile/timezone,
 * candidates via PUT /auth/timezone).
 */
export const useViewerTimezone = (user) => {
  const browserTz = getBrowserTimezone();
  const profileTz = user?.timezone;
  const isMentor = !!user?.is_mentor;
  const wasSetByUser = !!user?.timezone_set_by_user;

  const initialTz = profileTz || browserTz;
  const [timezone, setTimezone] = useState(initialTz);
  const [source, setSource] = useState(profileTz ? 'profile' : 'browser');
  const autoSavedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    // If the user has a saved tz that they explicitly chose, respect it.
    if (profileTz && wasSetByUser) {
      setTimezone(profileTz);
      setSource('profile');
      return;
    }
    // If the saved tz already matches the browser tz, no-op.
    if (profileTz === browserTz) {
      setTimezone(profileTz);
      setSource('browser-saved');
      return;
    }
    // Otherwise, auto-detect from browser and persist (only once per mount).
    if (!autoSavedRef.current && browserTz) {
      autoSavedRef.current = true;
      setTimezone(browserTz);
      setSource('browser');
      const url = isMentor
        ? `${BACKEND_URL}/api/mentor-dashboard/profile/timezone`
        : `${BACKEND_URL}/api/auth/timezone`;
      axios.put(`${url}?tz=${encodeURIComponent(browserTz)}`, {}, { withCredentials: true })
        .then(() => setSource('browser-saved'))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.debug('[useViewerTimezone] auto-save failed (non-critical):', err?.response?.status);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profileTz, browserTz, isMentor]);

  return {
    timezone,
    abbr: getTimezoneAbbr(timezone),
    source,
    browserTimezone: browserTz,
  };
};

export default useViewerTimezone;
