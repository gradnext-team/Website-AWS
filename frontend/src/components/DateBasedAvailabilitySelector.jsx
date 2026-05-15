import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Plus, X, Clock, Calendar } from 'lucide-react';

/**
 * DateBasedAvailabilitySelector - For mentor dashboard (date-specific availability)
 * Each day has From/To time slots with Hour:Minutes AM/PM dropdowns
 */

// Generate hours 1-12
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
// Generate minutes in 15-min increments
const MINUTES = ['00', '15', '30', '45'];
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
const formatTime12h = (time24) => {
  const { hour, minute, period } = parse24hTo12h(time24);
  return `${hour}:${minute} ${period}`;
};

/**
 * TimeRangePicker - From/To time picker with Hour, Minutes, AM/PM dropdowns
 */
const TimeRangePicker = ({ from, to, onChange, onRemove, index }) => {
  const fromParsed = parse24hTo12h(from);
  const toParsed = parse24hTo12h(to);
  
  const [fromHour, setFromHour] = useState(fromParsed.hour);
  const [fromMinute, setFromMinute] = useState(fromParsed.minute);
  const [fromPeriod, setFromPeriod] = useState(fromParsed.period);
  
  const [toHour, setToHour] = useState(toParsed.hour);
  const [toMinute, setToMinute] = useState(toParsed.minute);
  const [toPeriod, setToPeriod] = useState(toParsed.period);

  // Update parent when any value changes
  const handleFromChange = (h, m, p) => {
    const newFrom = convert12hTo24h({ hour: h || fromHour, minute: m || fromMinute, period: p || fromPeriod });
    onChange({ from: newFrom, to });
  };

  const handleToChange = (h, m, p) => {
    const newTo = convert12hTo24h({ hour: h || toHour, minute: m || toMinute, period: p || toPeriod });
    onChange({ from, to: newTo });
  };

  // Sync state with props
  useEffect(() => {
    const fp = parse24hTo12h(from);
    setFromHour(fp.hour);
    setFromMinute(fp.minute);
    setFromPeriod(fp.period);
    
    const tp = parse24hTo12h(to);
    setToHour(tp.hour);
    setToMinute(tp.minute);
    setToPeriod(tp.period);
  }, [from, to]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-slate-200" data-testid={`time-range-${index}`}>
      {/* From Time */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 font-medium min-w-[32px]">From</span>
        <Select value={fromHour} onValueChange={(v) => { setFromHour(v); handleFromChange(v, fromMinute, fromPeriod); }}>
          <SelectTrigger className="w-14 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-48">{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-slate-400 font-bold">:</span>
        <Select value={fromMinute} onValueChange={(v) => { setFromMinute(v); handleFromChange(fromHour, v, fromPeriod); }}>
          <SelectTrigger className="w-14 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fromPeriod} onValueChange={(v) => { setFromPeriod(v); handleFromChange(fromHour, fromMinute, v); }}>
          <SelectTrigger className="w-14 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <span className="text-slate-400 mx-1">→</span>

      {/* To Time */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 font-medium min-w-[24px]">To</span>
        <Select value={toHour} onValueChange={(v) => { setToHour(v); handleToChange(v, toMinute, toPeriod); }}>
          <SelectTrigger className="w-14 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-48">{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-slate-400 font-bold">:</span>
        <Select value={toMinute} onValueChange={(v) => { setToMinute(v); handleToChange(toHour, v, toPeriod); }}>
          <SelectTrigger className="w-14 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={toPeriod} onValueChange={(v) => { setToPeriod(v); handleToChange(toHour, toMinute, v); }}>
          <SelectTrigger className="w-14 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Button 
        type="button"
        size="sm" 
        variant="ghost" 
        onClick={onRemove}
        className="ml-auto hover:bg-red-50"
        data-testid={`remove-slot-${index}`}
      >
        <X className="w-4 h-4 text-red-500" />
      </Button>
    </div>
  );
};

/**
 * DayAvailabilityCard - A single day's availability editor with multiple slots
 */
const DayAvailabilityCard = ({ date, displayDate, slots = [], onChange }) => {
  const addSlot = () => {
    onChange([...slots, { from: '09:00', to: '17:00' }]);
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

  return (
    <div className="p-4 bg-slate-50 rounded-xl" data-testid={`day-card-${date}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-900">{displayDate}</h3>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={addSlot}
          data-testid={`add-slot-${date}`}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Time Slot
        </Button>
      </div>
      
      {slots.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-2">No availability set for this day</p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot, idx) => (
            <TimeRangePicker
              key={idx}
              index={idx}
              from={slot.from}
              to={slot.to}
              onChange={(newSlot) => updateSlot(idx, newSlot)}
              onRemove={() => removeSlot(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * DateBasedAvailabilitySelector - Full selector for next N days
 * Used in MentorDashboard for setting date-specific availability
 */
export const DateBasedAvailabilitySelector = ({ 
  availability = [], 
  onChange,
  daysToShow = 14
}) => {
  // Generate date labels for the next N days
  const dateCards = [];
  const today = new Date();
  
  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const displayDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    // Find existing availability for this date
    const existing = availability.find(a => a.date === dateStr);
    
    dateCards.push({
      date: dateStr,
      displayDate,
      slots: existing?.slots || []
    });
  }

  const updateDayAvailability = (date, newSlots) => {
    const filtered = availability.filter(a => a.date !== date);
    if (newSlots.length > 0) {
      filtered.push({ date, slots: newSlots });
    }
    onChange(filtered);
  };

  // Apply template to all days
  const applyTemplate = (fromTime, toTime) => {
    const newAvailability = dateCards.map(day => ({
      date: day.date,
      slots: [{ from: fromTime, to: toTime }]
    }));
    onChange(newAvailability);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4" data-testid="date-availability-selector">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
        <span className="text-sm text-blue-700 font-medium mr-2">Quick Set:</span>
        <Button 
          size="sm" 
          variant="outline" 
          className="bg-white"
          onClick={() => applyTemplate('09:00', '17:00')}
          data-testid="apply-9to5"
        >
          9 AM - 5 PM (All Days)
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="bg-white"
          onClick={() => applyTemplate('10:00', '18:00')}
          data-testid="apply-10to6"
        >
          10 AM - 6 PM (All Days)
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="bg-white text-red-600 hover:bg-red-50"
          onClick={clearAll}
          data-testid="clear-all"
        >
          Clear All
        </Button>
      </div>

      {/* Day Cards */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {dateCards.map((day) => (
          <DayAvailabilityCard
            key={day.date}
            date={day.date}
            displayDate={day.displayDate}
            slots={day.slots}
            onChange={(newSlots) => updateDayAvailability(day.date, newSlots)}
          />
        ))}
      </div>
    </div>
  );
};

export default DateBasedAvailabilitySelector;
