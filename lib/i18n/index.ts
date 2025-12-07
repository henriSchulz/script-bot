import 'server-only';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { cwd } from 'process';

export type Locale = 'en' | 'de' | 'ru';

// Infer the dictionary type from the English locale file structure
// We can't import JSON directly in all setups easily without "resolveJsonModule", 
// so we'll define a recursive type or just use 'any' for deep keys if needed, 
// but for type safety let's try to define the shape based on usage or a base type.
// For now, let's define a flexible Dictionary type.

export interface Dictionary {
  [key: string]: string | Dictionary;
}

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => loadDictionary('en'),
  de: () => loadDictionary('de'),
  ru: () => loadDictionary('ru'),
};

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  try {
    const filePath = join(cwd(), 'locales', `${locale}.json`);
    const fileContent = await readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Failed to load dictionary for locale: ${locale}`, error);
    // Fallback to English if loading fails (except if English fails)
    if (locale !== 'en') {
        return loadDictionary('en');
    }
    throw error;
  }
}

export async function getDictionary(locale: string): Promise<Dictionary> {
  // Normalize locale
  const normalizedLocale = (['en', 'de', 'ru'].includes(locale) ? locale : 'en') as Locale;
  return dictionaries[normalizedLocale]();
}

// Helper to get nested value from dictionary
export function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : null;
  }, obj) || path;
}

// Helper to replace placeholders in a string
// Usage: t("Hello {name}", { name: "World" }) -> "Hello World"
export function formatString(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  
  return template.replace(/{(\w+)}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}
