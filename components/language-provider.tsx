'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '@/locales/en.json';
import de from '@/locales/de.json';
import ru from '@/locales/ru.json';

type Locale = 'en' | 'de' | 'ru';
type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  de,
  ru
};

interface LanguageContextType {
  language: Locale;
  dict: Dictionary;
  setLanguage: (lang: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLanguage = 'en' 
}: { 
  children: React.ReactNode; 
  initialLanguage?: string;
}) {
  // Normalize initial language to supported types
  const normalizeLanguage = (lang?: string): Locale => {
    if (lang === 'German' || lang === 'de') return 'de';
    if (lang === 'Russian' || lang === 'ru') return 'ru';
    return 'en';
  };

  const [language, setLanguage] = useState<Locale>(normalizeLanguage(initialLanguage));
  const [dict, setDict] = useState<Dictionary>(dictionaries[normalizeLanguage(initialLanguage)]);

  useEffect(() => {
    setDict(dictionaries[language]);
  }, [language]);

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
