import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to persist state in localStorage
 * @param key - localStorage key
 * @param initialValue - Initial value if nothing in localStorage
 * @returns [value, setValue] tuple like useState
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Always start with initialValue to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
    } finally {
      setIsInitialized(true);
    }
  }, [key]);

  // Update localStorage when value changes (but only after initialization)
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue, isInitialized]);

  // Keep a ref to the latest value so the setter stays referentially stable
  // (it must never read `storedValue` from its closure, or it would need to be
  // in every consumer's effect deps — which is precisely what we're avoiding).
  const valueRef = useRef(storedValue);
  useEffect(() => {
    valueRef.current = storedValue;
  }, [storedValue]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? (value as (val: T) => T)(valueRef.current) : value;
      setStoredValue(valueToStore);
    } catch (error) {
      console.error(`Error setting value for localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}
