"""
Timezone utilities for gradnext platform
Handles timezone conversions for availability and session scheduling
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict

# Common timezone mappings for display
TIMEZONE_DISPLAY_NAMES = {
    "Asia/Kolkata": "IST",
    "America/New_York": "EST",
    "America/Los_Angeles": "PST",
    "America/Chicago": "CST",
    "Europe/London": "GMT",
    "Europe/Paris": "CET",
    "Asia/Dubai": "GST",
    "Asia/Singapore": "SGT",
    "Asia/Tokyo": "JST",
    "Australia/Sydney": "AEDT",
    "UTC": "UTC"
}

def get_timezone_abbr(timezone_str: str) -> str:
    """Get abbreviated timezone name for display"""
    if timezone_str in TIMEZONE_DISPLAY_NAMES:
        return TIMEZONE_DISPLAY_NAMES[timezone_str]
    # Try to get from the timezone itself
    try:
        tz = ZoneInfo(timezone_str)
        now = datetime.now(tz)
        return now.strftime('%Z')
    except:
        return timezone_str.split('/')[-1]

def convert_time_to_timezone(
    time_str: str,  # "HH:MM" in 24h format
    date_str: str,  # "YYYY-MM-DD"
    from_tz: str,   # Source timezone
    to_tz: str      # Target timezone
) -> Dict[str, str]:
    """
    Convert a time from one timezone to another
    Returns dict with converted date, time, and timezone abbreviation
    """
    try:
        from_zone = ZoneInfo(from_tz)
        to_zone = ZoneInfo(to_tz)
        
        # Parse the datetime in source timezone
        dt_str = f"{date_str} {time_str}"
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        dt_with_tz = dt.replace(tzinfo=from_zone)
        
        # Convert to target timezone
        dt_converted = dt_with_tz.astimezone(to_zone)
        
        return {
            "date": dt_converted.strftime("%Y-%m-%d"),
            "time": dt_converted.strftime("%H:%M"),
            "timezone": to_tz,
            "timezone_abbr": get_timezone_abbr(to_tz)
        }
    except Exception as e:
        # Return original if conversion fails
        return {
            "date": date_str,
            "time": time_str,
            "timezone": from_tz,
            "timezone_abbr": get_timezone_abbr(from_tz)
        }

def convert_time_to_utc(
    time_str: str,  # "HH:MM" in 24h format
    date_str: str,  # "YYYY-MM-DD"
    from_tz: str    # Source timezone
) -> Dict[str, str]:
    """Convert a local time to UTC"""
    return convert_time_to_timezone(time_str, date_str, from_tz, "UTC")

def convert_utc_to_local(
    time_str: str,  # "HH:MM" in 24h format (UTC)
    date_str: str,  # "YYYY-MM-DD"
    to_tz: str      # Target timezone
) -> Dict[str, str]:
    """Convert UTC time to local timezone"""
    return convert_time_to_timezone(time_str, date_str, "UTC", to_tz)

def get_current_utc_datetime() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(ZoneInfo("UTC"))

def format_time_with_timezone(
    time_str: str,
    timezone_str: str,
    format_12h: bool = True
) -> str:
    """
    Format time string with timezone indicator
    e.g., "14:00" + "Asia/Kolkata" -> "2:00 PM IST"
    """
    try:
        hour, minute = map(int, time_str.split(':'))
        tz_abbr = get_timezone_abbr(timezone_str)
        
        if format_12h:
            period = "AM" if hour < 12 else "PM"
            display_hour = hour if hour <= 12 else hour - 12
            if display_hour == 0:
                display_hour = 12
            return f"{display_hour}:{minute:02d} {period} {tz_abbr}"
        else:
            return f"{hour:02d}:{minute:02d} {tz_abbr}"
    except:
        return f"{time_str} {get_timezone_abbr(timezone_str)}"

def convert_availability_slots_to_viewer_tz(
    slots: List[Dict],  # List of {date, time} or {day, from, to}
    owner_tz: str,      # Timezone of the person who set availability
    viewer_tz: str      # Timezone of the person viewing
) -> List[Dict]:
    """
    Convert availability slots from owner's timezone to viewer's timezone
    """
    converted = []
    for slot in slots:
        if "date" in slot and "time" in slot:
            # Date-based slot
            result = convert_time_to_timezone(
                slot["time"], slot["date"], owner_tz, viewer_tz
            )
            converted.append({
                "date": result["date"],
                "time": result["time"],
                "original_date": slot["date"],
                "original_time": slot["time"],
                "timezone": result["timezone"],
                "timezone_abbr": result["timezone_abbr"]
            })
    return converted

def get_day_of_week_in_timezone(date_str: str, time_str: str, timezone_str: str) -> str:
    """Get the day of week for a given date/time in a specific timezone"""
    try:
        tz = ZoneInfo(timezone_str)
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        dt_with_tz = dt.replace(tzinfo=tz)
        return dt_with_tz.strftime("%A")  # Returns "Monday", "Tuesday", etc.
    except:
        return ""

# List of common timezones for dropdown selection
COMMON_TIMEZONES = [
    {"value": "Asia/Kolkata", "label": "India (IST)", "offset": "+05:30"},
    {"value": "America/New_York", "label": "US Eastern (EST/EDT)", "offset": "-05:00"},
    {"value": "America/Los_Angeles", "label": "US Pacific (PST/PDT)", "offset": "-08:00"},
    {"value": "America/Chicago", "label": "US Central (CST/CDT)", "offset": "-06:00"},
    {"value": "Europe/London", "label": "UK (GMT/BST)", "offset": "+00:00"},
    {"value": "Europe/Paris", "label": "Central Europe (CET/CEST)", "offset": "+01:00"},
    {"value": "Asia/Dubai", "label": "Dubai (GST)", "offset": "+04:00"},
    {"value": "Asia/Singapore", "label": "Singapore (SGT)", "offset": "+08:00"},
    {"value": "Asia/Tokyo", "label": "Japan (JST)", "offset": "+09:00"},
    {"value": "Australia/Sydney", "label": "Sydney (AEDT/AEST)", "offset": "+11:00"},
    {"value": "UTC", "label": "UTC", "offset": "+00:00"},
]
