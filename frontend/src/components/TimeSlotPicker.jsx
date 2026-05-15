import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Plus, X, Clock } from 'lucide-react';

/**
 * TimeSlotPicker - A user-friendly time picker with Hour, Minutes, AM/PM dropdowns
 * Supports 15-minute increments as requested
 */

// Generate hours 1-12
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
// Generate minutes in 30-min increments
const MINUTES = ['00', '30'];
// AM/PM periods
const PERIODS = ['AM', 'PM'];

// Convert 24h format (HH:MM) to { hour, minute, period }
const parse24hTo12h = (time24) => {
  if (!time24 || !time24.includes(':')) return { hour: '09', minute: '00', period: 'AM' };
  
  const [h, m] = time24.split(':');
  let hour = parseInt(h, 10);
  const minute = m;
  let period = 'AM';
  
  if (hour === 0) {
    hour = 12;
    period = 'AM';
  } else if (hour === 12) {
    period = 'PM';
  } else if (hour > 12) {
    hour -= 12;
    period = 'PM';
  }
  
  return { 
    hour: hour.toString().padStart(2, '0'), 
    minute: minute, 
    period 
  };
};

// Convert { hour, minute, period } to 24h format (HH:MM)
const convert12hTo24h = ({ hour, minute, period }) => {
  let h = parseInt(hour, 10);
  
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  
  return `${h.toString().padStart(2, '0')}:${minute}`;
};

// Format for display
const formatTimeDisplay = ({ hour, minute, period }) => {
  return `${hour}:${minute} ${period}`;
};

/**
 * SingleTimePicker - Renders Hour, Minutes, AM/PM dropdowns for one time
 */
export const SingleTimePicker = ({ value, onChange, label = 'Time', showLabel = false }) => {
  const parsed = parse24hTo12h(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  useEffect(() => {
    const p = parse24hTo12h(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const handleChange = (newHour, newMinute, newPeriod) => {
    const time24 = convert12hTo24h({ 
      hour: newHour || hour, 
      minute: newMinute || minute, 
      period: newPeriod || period 
    });
    onChange(time24);
  };

  return (
    <div className="flex items-center gap-1">
      {showLabel && label && <span className="text-xs text-slate-500 mr-1 min-w-[35px]">{label}</span>}
      <Select 
        value={hour} 
        onValueChange={(v) => { setHour(v); handleChange(v, minute, period); }}
      >
        <SelectTrigger className="w-16 h-9 text-sm" data-testid={`time-hour-${label.toLowerCase()}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {HOURS.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-slate-400 font-bold">:</span>
      <Select 
        value={minute} 
        onValueChange={(v) => { setMinute(v); handleChange(hour, v, period); }}
      >
        <SelectTrigger className="w-16 h-9 text-sm" data-testid={`time-minute-${label.toLowerCase()}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-48">
          {MINUTES.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select 
        value={period} 
        onValueChange={(v) => { setPeriod(v); handleChange(hour, minute, v); }}
      >
        <SelectTrigger className="w-16 h-9 text-sm" data-testid={`time-period-${label.toLowerCase()}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map(p => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// Helper to convert time string to minutes for comparison
const timeToMinutes = (time) => {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Check if two time slots overlap
const slotsOverlap = (slot1, slot2) => {
  const start1 = timeToMinutes(slot1.from);
  const end1 = timeToMinutes(slot1.to);
  const start2 = timeToMinutes(slot2.from);
  const end2 = timeToMinutes(slot2.to);
  
  // Handle overnight slots (end time < start time)
  // For simplicity, we assume no overnight slots for now
  // Two slots overlap if one starts before the other ends and ends after the other starts
  return start1 < end2 && end1 > start2;
};

// Check if a slot overlaps with any other slots in the array (excluding itself)
const hasOverlap = (slots, currentIndex) => {
  const currentSlot = slots[currentIndex];
  if (!currentSlot) return false;
  
  for (let i = 0; i < slots.length; i++) {
    if (i !== currentIndex && slotsOverlap(currentSlot, slots[i])) {
      return true;
    }
  }
  return false;
};

// Check if slot times are valid (end > start)
const isSlotValid = (slot) => {
  const start = timeToMinutes(slot.from);
  const end = timeToMinutes(slot.to);
  return end > start;
};

/**
 * TimeSlotRow - A single From/To time slot row with validation
 */
export const TimeSlotRow = ({ slot, onChange, onRemove, index, hasOverlapError = false, hasTimeError = false }) => {
  const showError = hasOverlapError || hasTimeError;
  const errorMessage = hasTimeError 
    ? "End time must be after start time" 
    : hasOverlapError 
      ? "This slot overlaps with another" 
      : "";

  return (
    <div className={`flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border ${showError ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-slate-500 font-medium min-w-[32px]">From</span>
        <SingleTimePicker 
          value={slot.from} 
          onChange={(v) => onChange({ ...slot, from: v })}
          label="From"
        />
      </div>
      <span className="text-slate-400 mx-1 hidden sm:inline">→</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-slate-500 font-medium min-w-[20px]">To</span>
        <SingleTimePicker 
          value={slot.to} 
          onChange={(v) => onChange({ ...slot, to: v })}
          label="To"
        />
      </div>
      <Button 
        type="button"
        size="sm" 
        variant="ghost" 
        onClick={onRemove}
        className="ml-auto hover:bg-red-50 flex-shrink-0"
        data-testid={`remove-slot-${index}`}
      >
        <X className="w-4 h-4 text-red-500" />
      </Button>
      {showError && (
        <div className="w-full mt-1">
          <span className="text-xs text-red-500">{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

/**
 * DayAvailabilityEditor - Availability editor for a single day with multiple slots
 */
export const DayAvailabilityEditor = ({ day, slots = [], onChange }) => {
  const addSlot = () => {
    // Find a non-overlapping default slot
    let defaultFrom = '09:00';
    let defaultTo = '17:00';
    
    // If there are existing slots, try to find a gap
    if (slots.length > 0) {
      // Sort existing slots by start time
      const sortedSlots = [...slots].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
      const lastSlot = sortedSlots[sortedSlots.length - 1];
      const lastEnd = timeToMinutes(lastSlot.to);
      
      // Start new slot after the last one ends (if reasonable)
      if (lastEnd < 22 * 60) { // Before 10 PM
        const newStartHour = Math.floor(lastEnd / 60);
        const newStartMin = lastEnd % 60;
        defaultFrom = `${newStartHour.toString().padStart(2, '0')}:${newStartMin.toString().padStart(2, '0')}`;
        const newEndMinutes = Math.min(lastEnd + 120, 23 * 60); // 2 hours later or 11 PM
        const newEndHour = Math.floor(newEndMinutes / 60);
        const newEndMin = newEndMinutes % 60;
        defaultTo = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;
      }
    }
    
    onChange([...slots, { from: defaultFrom, to: defaultTo }]);
  };

  const updateSlot = (index, newSlot) => {
    const newSlots = [...slots];
    newSlots[index] = newSlot;
    onChange(newSlots);
  };

  const removeSlot = (index) => {
    const newSlots = slots.filter((_, i) => i !== index);
    onChange(newSlots);
  };

  // Check for any overlaps or invalid slots
  const hasAnyErrors = slots.some((slot, idx) => 
    hasOverlap(slots, idx) || !isSlotValid(slot)
  );

  return (
    <div className="p-4 bg-slate-50 rounded-xl" data-testid={`day-editor-${day.toLowerCase()}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-900 whitespace-nowrap">{day}</span>
          {hasAnyErrors && (
            <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Has errors</span>
          )}
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={addSlot}
          className="flex-shrink-0"
          data-testid={`add-slot-${day.toLowerCase()}`}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Slot
        </Button>
      </div>
      
      {slots.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No availability set</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot, idx) => (
            <TimeSlotRow
              key={idx}
              index={idx}
              slot={slot}
              onChange={(newSlot) => updateSlot(idx, newSlot)}
              onRemove={() => removeSlot(idx)}
              hasOverlapError={hasOverlap(slots, idx)}
              hasTimeError={!isSlotValid(slot)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * WeeklyAvailabilitySelector - Full weekly availability editor
 */
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WeeklyAvailabilitySelector = ({ 
  availability = [], 
  onChange, 
  showWeeklyTemplate = true 
}) => {
  // Template state for quick apply
  const [templateFrom, setTemplateFrom] = useState({ hour: '09', minute: '00', period: 'AM' });
  const [templateTo, setTemplateTo] = useState({ hour: '05', minute: '00', period: 'PM' });

  const getAvailabilityForDay = (day) => {
    const existing = availability.find(a => a.day === day);
    return existing?.slots || [];
  };

  const updateDayAvailability = (day, newSlots) => {
    const filtered = availability.filter(a => a.day !== day);
    if (newSlots.length > 0) {
      filtered.push({ day, slots: newSlots });
    }
    onChange(filtered);
  };

  const applyTemplate = () => {
    const from24 = convert12hTo24h(templateFrom);
    const to24 = convert12hTo24h(templateTo);
    const newSlot = { from: from24, to: to24 };
    
    // ADD the template slot to each day's existing slots (don't replace)
    const newAvailability = DAYS_OF_WEEK.map(day => {
      const existingSlots = getAvailabilityForDay(day);
      return {
        day,
        slots: [...existingSlots, newSlot]
      };
    });
    onChange(newAvailability);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4" data-testid="weekly-availability-selector">
      {showWeeklyTemplate && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
          <h4 className="font-medium text-blue-900 mb-3">Quick Add - Add Slot to All Days</h4>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700">From</span>
              <div className="flex items-center gap-1">
                <Select 
                  value={templateFrom.hour} 
                  onValueChange={(v) => setTemplateFrom({ ...templateFrom, hour: v })}
                >
                  <SelectTrigger className="w-16 h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-blue-400 font-bold">:</span>
                <Select 
                  value={templateFrom.minute} 
                  onValueChange={(v) => setTemplateFrom({ ...templateFrom, minute: v })}
                >
                  <SelectTrigger className="w-16 h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select 
                  value={templateFrom.period} 
                  onValueChange={(v) => setTemplateFrom({ ...templateFrom, period: v })}
                >
                  <SelectTrigger className="w-16 h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <span className="text-blue-400">→</span>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-700">To</span>
              <div className="flex items-center gap-1">
                <Select 
                  value={templateTo.hour} 
                  onValueChange={(v) => setTemplateTo({ ...templateTo, hour: v })}
                >
                  <SelectTrigger className="w-16 h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-blue-400 font-bold">:</span>
                <Select 
                  value={templateTo.minute} 
                  onValueChange={(v) => setTemplateTo({ ...templateTo, minute: v })}
                >
                  <SelectTrigger className="w-16 h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select 
                  value={templateTo.period} 
                  onValueChange={(v) => setTemplateTo({ ...templateTo, period: v })}
                >
                  <SelectTrigger className="w-16 h-9 text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2 ml-auto">
              <Button 
                size="sm" 
                onClick={applyTemplate} 
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="apply-template-btn"
              >
                Add to All Days
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={clearAll}
                data-testid="clear-all-btn"
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {DAYS_OF_WEEK.map((day) => (
          <DayAvailabilityEditor
            key={day}
            day={day}
            slots={getAvailabilityForDay(day)}
            onChange={(slots) => updateDayAvailability(day, slots)}
          />
        ))}
      </div>
    </div>
  );
};

// Export validation functions for use in parent components
export const validateAvailability = (availability) => {
  for (const dayData of availability) {
    const slots = dayData.slots || [];
    for (let i = 0; i < slots.length; i++) {
      // Check if slot is valid (end > start)
      if (!isSlotValid(slots[i])) {
        return { 
          valid: false, 
          error: `Invalid time slot on ${dayData.day}: end time must be after start time` 
        };
      }
      // Check for overlaps
      if (hasOverlap(slots, i)) {
        return { 
          valid: false, 
          error: `Overlapping time slots on ${dayData.day}` 
        };
      }
    }
  }
  return { valid: true, error: null };
};

export { timeToMinutes, slotsOverlap, hasOverlap, isSlotValid };

export default WeeklyAvailabilitySelector;
