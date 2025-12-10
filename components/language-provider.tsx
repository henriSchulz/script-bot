'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import en from '@/locales/en.json';
import de from '@/locales/de.json';

type Locale = 'en' | 'de';
type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  de
};

interface LanguageContextType {
  language: Locale;
  dict: Dictionary;
  setLanguage: (lang: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'app-language';

// Get initial language from localStorage or browser default
function getInitialLanguage(): Locale {
  if (typeof window === 'undefined') return 'en';
  
  // Try to get from localStorage
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'de' || stored === 'en') {
    return stored;
  }
  
  // Fallback to browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('de')) return 'de';
  
  return 'en';
}

export function LanguageProvider({ 
  children,
  initialLang = 'en'
}: { 
  children: React.ReactNode;
  initialLang?: Locale;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Locale>(initialLang);
  const [dict, setDict] = useState<Dictionary>(dictionaries[initialLang]);
  // We still track mounted state to know when we can safely access window/localStorage
  const [mounted, setMounted] = useState(false);

  // Initialize language on mount
  useEffect(() => {
    setMounted(true);
    
    // Check localStorage - it might have a more recent value than the cookie/default
    const localLang = getInitialLanguage();
    
    // If localStorage has a valid value and it differs from our initial (server) value, use it
    if (localLang && localLang !== language) {
       setLanguageState(localLang);
       setDict(dictionaries[localLang]);
    }
  }, []); // Run once on mount

  // Update dictionary when language changes
  useEffect(() => {
    setDict(dictionaries[language]);
  }, [language]);

  const setLanguage = (lang: Locale) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      // Also set a cookie so server actions can access it
      document.cookie = `app-language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
    }
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let value: any = dict;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key as keyof typeof value];
      } else {
        return path; // Return key if not found
      }
    }

    if (typeof value !== 'string') {
      return path;
    }

    if (params) {
      return value.replace(/{(\w+)}/g, (match: string, key: string) => {
        return params[key] !== undefined ? String(params[key]) : match;
      });
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, dict, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

