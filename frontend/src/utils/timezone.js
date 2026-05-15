/**
 * Timezone utilities for gradnext platform
 * Handles timezone conversions and display formatting
 */

// Common timezone abbreviations
const TIMEZONE_ABBR = {
  'Asia/Kolkata': 'IST',
  'America/New_York': 'EST',
  'America/Los_Angeles': 'PST',
  'America/Chicago': 'CST',
  'Europe/London': 'GMT',
  'Europe/Paris': 'CET',
  'Asia/Dubai': 'GST',
  'Asia/Singapore': 'SGT',
  'Asia/Tokyo': 'JST',
  'Australia/Sydney': 'AEDT',
  'UTC': 'UTC'
};

/**
 * Get the user's browser timezone
 */
export const getBrowserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get timezone abbreviation for display
 */
export const getTimezoneAbbr = (timezone) => {
  if (TIMEZONE_ABBR[timezone]) {
    return TIMEZONE_ABBR[timezone];
  }
  // Try to get from Intl
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : timezone.split('/').pop();
  } catch {
    return timezone.split('/').pop();
  }
};

/**
 * Convert a time from one timezone to another
 * @param {string} timeStr - Time in "HH:MM" format
 * @param {string} dateStr - Date in "YYYY-MM-DD" format
 * @param {string} fromTz - Source timezone
 * @param {string} toTz - Target timezone
 * @returns {object} - { date, time, timezone, timezoneAbbr }
 */
export const convertTimezone = (timeStr, dateStr, fromTz, toTz) => {
  try {
    // Create date in source timezone
    const [hours, minutes] = timeStr.split(':').map(Number);
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create a date string that JavaScript can parse with timezone
    const sourceDate = new Date(`${dateStr}T${timeStr}:00`);
    
    // Get the offset difference
    const sourceFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: fromTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: toTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Parse the source time as if it's in the source timezone
    // Then convert to target timezone
    const tempDate = new Date(
      Date.UTC(year, month - 1, day, hours, minutes, 0)
    );
    
    // Adjust for source timezone offset
    const sourceOffset = getTimezoneOffset(fromTz, tempDate);
    const adjustedDate = new Date(tempDate.getTime() + sourceOffset * 60000);
    
    // Format in target timezone
    const targetParts = targetFormatter.formatToParts(adjustedDate);
    
    const getPartValue = (type) => {
      const part = targetParts.find(p => p.type === type);
      return part ? part.value : '';
    };
    
    const targetYear = getPartValue('year');
    const targetMonth = getPartValue('month');
    const targetDay = getPartValue('day');
    const targetHour = getPartValue('hour');
    const targetMinute = getPartValue('minute');
    
    return {
      date: `${targetYear}-${targetMonth}-${targetDay}`,
      time: `${targetHour}:${targetMinute}`,
      timezone: toTz,
      timezoneAbbr: getTimezoneAbbr(toTz)
    };
  } catch (error) {
    console.error('Timezone conversion error:', error);
    return {
      date: dateStr,
      time: timeStr,
      timezone: fromTz,
      timezoneAbbr: getTimezoneAbbr(fromTz)
    };
  }
};

/**
 * Get timezone offset in minutes for a given timezone and date
 */
const getTimezoneOffset = (timezone, date) => {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate - tzDate) / 60000;
};

/**
 * Format time with timezone indicator
 * @param {string} timeStr - Time in "HH:MM" format
 * @param {string} timezone - Timezone string
 * @param {boolean} use12Hour - Use 12-hour format (default: false for 24-hour)
 * @returns {string} - Formatted time like "14:00 IST"
 */
export const formatTimeWithTimezone = (timeStr, timezone, use12Hour = false) => {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const tzAbbr = getTimezoneAbbr(timezone);
    
    if (use12Hour) {
      const period = hours < 12 ? 'AM' : 'PM';
      let displayHour = hours % 12;
      if (displayHour === 0) displayHour = 12;
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period} ${tzAbbr}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${tzAbbr}`;
    }
  } catch {
    return `${timeStr} ${getTimezoneAbbr(timezone)}`;
  }
};

/**
 * Convert availability slots to viewer's timezone
 * @param {Array} slots - Array of {date, time} objects
 * @param {string} ownerTz - Owner's timezone
 * @param {string} viewerTz - Viewer's timezone
 * @returns {Array} - Converted slots with timezone info
 */
export const convertAvailabilityToViewerTz = (slots, ownerTz, viewerTz) => {
  if (!slots || !Array.isArray(slots)) return [];
  
  return slots.map(slot => {
    if (slot.date && slot.time) {
      const converted = convertTimezone(slot.time, slot.date, ownerTz, viewerTz);
      return {
        ...slot,
        displayDate: converted.date,
        displayTime: converted.time,
        originalDate: slot.date,
        originalTime: slot.time,
        timezone: viewerTz,
        timezoneAbbr: converted.timezoneAbbr
      };
    }
    return slot;
  });
};

/**
 * Format date with timezone-aware display
 */
export const formatDateTimeWithTz = (dateStr, timeStr, timezone) => {
  const tzAbbr = getTimezoneAbbr(timezone);
  const date = new Date(`${dateStr}T${timeStr}:00`);
  
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const formattedDate = date.toLocaleDateString('en-US', dateOptions);
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  return `${formattedDate} at ${formattedTime} ${tzAbbr}`;
};

export default {
  getBrowserTimezone,
  getTimezoneAbbr,
  convertTimezone,
  formatTimeWithTimezone,
  convertAvailabilityToViewerTz,
  formatDateTimeWithTz,
  istToViewer,
  viewerToIst,
};

/**
 * Convert an IST date+time pair to the viewer's local timezone.
 * Returns { date, time, abbr } in the viewer's TZ.
 * Use this everywhere we display IST-stored slots to candidates/mentors.
 */
export function istToViewer(dateStr, timeStr, viewerTz) {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr, abbr: getTimezoneAbbr(viewerTz || 'Asia/Kolkata') };
  const tz = viewerTz || 'Asia/Kolkata';
  const out = convertTimezone(timeStr, dateStr, 'Asia/Kolkata', tz);
  return { date: out.date, time: out.time, abbr: out.timezoneAbbr };
}

/**
 * Convert a viewer-local date+time pair to IST for canonical storage.
 * Mirror of istToViewer.
 */
export function viewerToIst(dateStr, timeStr, viewerTz) {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr, abbr: 'IST' };
  const tz = viewerTz || 'Asia/Kolkata';
  const out = convertTimezone(timeStr, dateStr, tz, 'Asia/Kolkata');
  return { date: out.date, time: out.time, abbr: 'IST' };
}

/**
 * Format a 12h-friendly time string with the timezone abbreviation, e.g.
 * "5:00 PM CST". Use when rendering converted slots in lists/cards.
 */
export function format12hWithAbbr(timeStr, tz) {
  return formatTimeWithTimezone(timeStr, tz, true);
}
