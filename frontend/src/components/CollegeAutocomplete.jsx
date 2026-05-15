import React, { useState, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { searchColleges, isKnownCollege } from '../data/colleges';
import { Check, School, ChevronDown } from 'lucide-react';

/**
 * CollegeAutocomplete - Autocomplete input for college/university selection
 * Features:
 * - Predictive search from curated list
 * - Allows custom entry if not in list
 * - Shows visual indicator for known colleges
 */
const CollegeAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Start typing to search...",
  label,
  required = false,
  disabled = false,
  className = ""
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Update input when value prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (newValue.length >= 2) {
      const results = searchColleges(newValue, 8);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setHighlightedIndex(-1);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
    
    // Always update parent with current value
    onChange(newValue);
  };

  const handleSelectSuggestion = (college) => {
    setInputValue(college);
    onChange(college);
    setSuggestions([]);
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
    if (inputValue.length >= 2) {
      const results = searchColleges(inputValue, 8);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    }
  };

  const isKnown = isKnownCollege(inputValue);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <School className="w-4 h-4" />
        </div>
        
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-10 pr-10 ${isKnown && inputValue ? 'border-green-300 focus:border-green-500' : ''}`}
          autoComplete="off"
          data-testid="college-autocomplete-input"
        />
        
        {/* Known college indicator */}
        {isKnown && inputValue && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <Check className="w-4 h-4" />
          </div>
        )}
        
        {/* Dropdown indicator when focused */}
        {!isKnown && inputValue && inputValue.length >= 2 && (
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
          data-testid="college-suggestions-dropdown"
        >
          {suggestions.map((college, index) => (
            <button
              key={college}
              type="button"
              onClick={() => handleSelectSuggestion(college)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                index === highlightedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              data-testid={`college-suggestion-${index}`}
            >
              <School className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="truncate">{college}</span>
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {inputValue && inputValue.length >= 2 && !isKnown && !isOpen && (
        <p className="mt-1 text-xs text-slate-500">
          Using custom entry. Start typing to see suggestions.
        </p>
      )}
    </div>
  );
};

export default CollegeAutocomplete;
