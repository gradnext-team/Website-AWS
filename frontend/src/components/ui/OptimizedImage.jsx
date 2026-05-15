import React, { useState, useEffect, useRef } from 'react';

/**
 * OptimizedImage - A lazy-loading image component with loading states and error handling
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Loading placeholder (gradient or skeleton)
 * - Error handling with fallback
 * - Smooth fade-in transition when loaded
 */
const OptimizedImage = ({ 
  src, 
  alt = '', 
  className = '', 
  fallbackClassName = 'bg-gradient-to-br from-blue-600 to-purple-700',
  fallbackElement = null,
  style = {},
  onLoad = null,
  onError = null,
  eager = false, // Set to true to load immediately without lazy loading
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(eager);
  const imgRef = useRef(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (eager || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, eager]);

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setHasError(true);
    console.warn(`Failed to load image: ${src}`);
    if (onError) onError(e);
  };

  // If no src or error, show fallback
  if (!src || hasError) {
    if (fallbackElement) {
      return fallbackElement;
    }
    return <div className={`${className} ${fallbackClassName}`} style={style} />;
  }

  return (
    <div ref={imgRef} className={`relative ${className}`} style={style}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div className={`absolute inset-0 ${fallbackClassName} animate-pulse`} />
      )}
      
      {/* Actual image - only load when in view */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          loading={eager ? 'eager' : 'lazy'}
          {...props}
        />
      )}
    </div>
  );
};

export default OptimizedImage;
