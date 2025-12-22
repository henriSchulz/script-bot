'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface InlineMathRendererProps {
  html: string;
}

export function InlineMathRenderer({ html }: InlineMathRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current || !html) return;

    // Find all math spans and render them with KaTeX
    const mathSpans = contentRef.current.querySelectorAll('[data-type="math"]');
    
    mathSpans.forEach(span => {
      const latex = span.getAttribute('data-latex');
      if (latex && span instanceof HTMLElement) {
        try {
          // Decode HTML entities in the latex string
          const decodedLatex = latex
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          
          const rendered = katex.renderToString(decodedLatex, {
            throwOnError: false,
            displayMode: false,
          });
          span.innerHTML = rendered;
        } catch (e) {
          console.error('KaTeX rendering error:', e, 'LaTeX:', latex);
          span.textContent = `$${latex}$`;
        }
      }
    });
  }, [html]);

  // Return null or placeholder if no content
  if (!html || html.trim() === '') {
    return null;
  }

  return (
    <div 
      ref={contentRef} 
      dangerouslySetInnerHTML={{ __html: html }} 
      className="text-sm leading-relaxed"
    />
  );
}
