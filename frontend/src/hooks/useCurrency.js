import React, { useState, createContext, useContext } from 'react';

// Currency context
const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};

// Currency symbols map
const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  AED: 'AED',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
};

export const CurrencyProvider = ({ children }) => {
  // FORCE INR for all users - regional pricing disabled for now
  const [currency] = useState('INR');
  const [currencySymbol] = useState('₹');
  const [region] = useState('IN');
  const [loading] = useState(false); // No loading needed since we're not detecting
  const [detected] = useState(true);

  // Format price with currency
  const formatPrice = (amount, showSymbol = true) => {
    if (!amount && amount !== 0) return '';
    
    const formatted = new Intl.NumberFormat('en-IN', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);

    // For non-symbol format, manually add symbol
    if (!showSymbol) {
      return `${currencySymbol}${formatted}`;
    }

    return formatted;
  };

  // Manual override (disabled for now since we're forcing INR)
  const overrideCurrency = (newCurrency) => {
    console.log('Currency override disabled - using INR only');
  };

  const value = {
    currency,
    currencySymbol,
    region,
    loading,
    detected,
    formatPrice,
    overrideCurrency
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export default CurrencyProvider;
