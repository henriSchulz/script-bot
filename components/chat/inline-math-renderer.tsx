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
          const rendered = katex.renderToString(latex, {
            throwOnError: false,
            displayMode: false,
          });
          span.innerHTML = rendered;
        } catch (e) {
          console.error('KaTeX rendering error:', e);
          span.textContent = `$${latex}$`;
        }
      }
    });

    // Force all text elements to have proper color
    const allElements = contentRef.current.querySelectorAll('*');
    allElements.forEach(el => {
      if (el instanceof HTMLElement && !el.querySelector('[data-type="math"]')) {
        // Don't override KaTeX styles
        if (!el.classList.contains('katex')) {
          el.style.color = 'inherit';
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
      style={{ color: 'var(--foreground)' }}
    />
  );
}
