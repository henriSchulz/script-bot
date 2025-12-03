'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionaries, Dictionary, en } from '@/lib/i18n/dictionaries';

type Language = 'en' | 'de';

interface LanguageContextType {
  language: Language;
  dict: Dictionary;
  setLanguage: (lang: Language) => void;
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
  const normalizedInitialLang = (initialLanguage === 'German' || initialLanguage === 'de') ? 'de' : 'en';
  
  const [language, setLanguage] = useState<Language>(normalizedInitialLang);
  const [dict, setDict] = useState<Dictionary>(dictionaries[normalizedInitialLang]);

  useEffect(() => {
    setDict(dictionaries[language]);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, dict, setLanguage }}>
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
