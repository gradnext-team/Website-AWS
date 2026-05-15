import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Globe, Check } from 'lucide-react';
import { getBrowserTimezone, getTimezoneAbbr } from '../../utils/timezone';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Compact, popular timezone list. We add the browser TZ to the top automatically
// if it isn't already present.
const POPULAR_TZS = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

const labelFor = (tz) => `${tz.replace(/_/g, ' ')} · ${getTimezoneAbbr(tz)}`;

/**
 * TimezoneSelect — profile-side timezone picker.
 * Auto-detects browser TZ and shows a "Use browser timezone" hint.
 *
 * Props:
 *   value: current timezone string
 *   onChange(newTz): persisted by the parent (or via the built-in `endpoint`)
 *   endpoint: when provided, PUTs `?tz=<value>` to BACKEND_URL+endpoint on change.
 *             Defaults to the candidate endpoint. For mentors, pass
 *             `/api/mentor-dashboard/profile/timezone`.
 *   sourceLabel: optional small "viewing in: X" badge override
 */
const TimezoneSelect = ({
  value,
  onChange,
  endpoint = '/api/auth/timezone',
  sourceLabel,
}) => {
  const browserTz = useMemo(() => getBrowserTimezone(), []);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const options = useMemo(() => {
    const set = new Set([browserTz, ...POPULAR_TZS, value].filter(Boolean));
    return Array.from(set);
  }, [browserTz, value]);

  const handleChange = async (next) => {
    if (!next || next === value) return;
    onChange?.(next);
    if (!endpoint) return;
    setSaving(true);
    try {
      await axios.put(
        `${BACKEND_URL}${endpoint}?tz=${encodeURIComponent(next)}`,
        {},
        { withCredentials: true },
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[TimezoneSelect] save failed:', err?.response?.data || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--gn-grey-dark)' }}>
        <Globe className="w-4 h-4 inline mr-1" />
        Timezone
      </label>
      <select
        value={value || browserTz}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full px-3 py-2 rounded-lg bg-white focus:outline-none focus:ring-2"
        style={{ border: '1px solid var(--gn-grey-light)', '--tw-ring-color': 'var(--gn-periwinkle)' }}
        data-testid="profile-timezone-select"
      >
        {options.map((tz) => (
          <option key={tz} value={tz}>{labelFor(tz)}</option>
        ))}
      </select>

      <div className="mt-1.5 flex items-center justify-between text-xs" style={{ color: 'var(--gn-grey)' }}>
        <span data-testid="profile-timezone-hint">
          {sourceLabel || (
            <>
              {value && value === browserTz
                ? `Detected from your browser (${getTimezoneAbbr(browserTz)})`
                : value
                  ? `Saved on your profile · browser detected ${getTimezoneAbbr(browserTz)}`
                  : `Defaulting to your browser (${getTimezoneAbbr(browserTz)})`
              }
            </>
          )}
        </span>
        {value && value !== browserTz && (
          <button
            type="button"
            onClick={() => handleChange(browserTz)}
            disabled={saving}
            className="text-blue-600 hover:underline"
            data-testid="profile-timezone-use-browser"
          >
            Use browser timezone
          </button>
        )}
        {savedFlash && (
          <span className="text-green-600 inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
      </div>
    </div>
  );
};

export default TimezoneSelect;
