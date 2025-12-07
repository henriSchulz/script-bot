import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertLatexToMarkup(content: string): string {
  if (!content) return "";
  
  // Replace $...$ with the Tiptap inline-math node markup
  // The regex looks for $...$ but avoids matches where the $ is escaped like \$
  // We use a negative lookbehind for the first $ and negative lookbehind for the closing $
  // to avoid matching escaped ones.
  // However, JS regex lookbehind support can be tricky in older environments,
  // so we'll handle the replacement carefully.
  
  // First, temporarily protect escaped dollars
  let processed = content.replace(/\\\$/g, '__ESCAPED_DOLLAR__');
  
  // Regex for $...$
  // structure: $ (captured content) $
  // We capture content ensuring it doesn't contain unescaped $
  processed = processed.replace(/\$([^$]+?)\$/g, (match, latex) => {
    return `<span data-type="inline-math" data-content="${latex}"></span>`;
  });
  
  // Restore escaped dollars
  processed = processed.replace(/__ESCAPED_DOLLAR__/g, '$');
  
  return processed;
}

export function preprocessLaTeX(content: string): string {
  if (!content) return "";
  
  // 1. Replace escaped dollar signs \$ with normal dollar signs $ (common LLM artifact)
  let processed = content.replace(/\\\$/g, '$');
  
  // 2. Replace \[ ... \] with $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  
  // 3. Replace \( ... \) with $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 4. Ensure space around math if missing (optional but helpful for parsers)
  // Not strictly enforcing to avoid modifying intended text, relying on strict parsing.
  
  return processed;
}
