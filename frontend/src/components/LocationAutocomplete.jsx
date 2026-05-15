import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from './ui/input';
import { Check, MapPin, ChevronDown } from 'lucide-react';

// Comprehensive list of countries
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon",
  "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea North",
  "Korea South", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
  "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique",
  "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia",
  "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// Country codes mapping
const COUNTRY_CODES = {
  "India": "+91",
  "United States": "+1",
  "United Kingdom": "+44",
  "United Arab Emirates": "+971",
  "Singapore": "+65",
  "Hong Kong": "+852",
  "Australia": "+61",
  "Germany": "+49",
  "France": "+33",
  "China": "+86",
  "Japan": "+81",
  "Korea South": "+82",
  "Netherlands": "+31",
  "Spain": "+34",
  "Italy": "+39",
  "Switzerland": "+41",
  "Sweden": "+46",
  "Norway": "+47",
  "Malaysia": "+60",
  "Philippines": "+63",
  "New Zealand": "+64",
  "Saudi Arabia": "+966",
  "Qatar": "+974",
  "South Africa": "+27",
  "Brazil": "+55",
  "Mexico": "+52",
  "Canada": "+1",
};

/**
 * LocationAutocomplete - Autocomplete input for country selection
 * Features:
 * - Predictive search from comprehensive country list
 * - Returns country code for phone number formatting
 */
const LocationAutocomplete = ({ 
  value, 
  onChange, 
  onCountryCodeChange,
  placeholder = "Start typing your country...",
  label,
  required = false,
  disabled = false,
  className = ""
}) => {
  // Use value prop directly for controlled component, with internal state for typing
  const [localInput, setLocalInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Determine the display value - prefer localInput when typing, otherwise use value prop
  const displayValue = localInput || value || '';

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        // Reset local input to value when closing
        setLocalInput('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter countries based on input
  const suggestions = useMemo(() => {
    const searchTerm = displayValue;
    if (!searchTerm || searchTerm.length < 1) {
      return COUNTRIES.slice(0, 10); // Show top 10 by default
    }
    return COUNTRIES.filter(country => 
      country.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [displayValue]);

  const isValidCountry = COUNTRIES.includes(value);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setLocalInput(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
    
    // If it's a valid country, update parent immediately and clear local input
    if (COUNTRIES.includes(newValue)) {
      onChange(newValue);
      setLocalInput('');
      if (onCountryCodeChange) {
        onCountryCodeChange(COUNTRY_CODES[newValue] || '');
      }
    }
  };

  const handleSelectSuggestion = (country) => {
    setLocalInput('');
    onChange(country);
    if (onCountryCodeChange) {
      onCountryCodeChange(COUNTRY_CODES[country] || '');
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Reset local input on blur
    setTimeout(() => {
      setLocalInput('');
    }, 200);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-10 ${isValidCountry && value ? 'border-green-300 focus:border-green-500' : ''}`}
          autoComplete="off"
          data-testid="location-autocomplete-input"
        />
        
        {/* Valid country indicator */}
        {isValidCountry && value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <Check className="w-4 h-4" />
          </div>
        )}
        
        {/* Dropdown indicator */}
        {!isValidCountry && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          data-testid="location-suggestions-dropdown"
        >
          {suggestions.map((country, index) => (
            <button
              key={country}
              type="button"
              onClick={() => handleSelectSuggestion(country)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                index === highlightedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : value === country
                    ? 'bg-green-50 text-green-700'
                    : 'text-slate-700 hover:bg-slate-50'
              }`}
              data-testid={`location-suggestion-${index}`}
            >
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="truncate">{country}</span>
              {COUNTRY_CODES[country] && (
                <span className="ml-auto text-xs text-slate-400">{COUNTRY_CODES[country]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {displayValue && !isValidCountry && !isOpen && (
        <p className="mt-1 text-xs text-amber-600">
          Please select a valid country from the list
        </p>
      )}
    </div>
  );
};

export default LocationAutocomplete;
