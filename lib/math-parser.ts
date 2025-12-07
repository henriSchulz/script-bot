// A simple regex-based parser that is robust enough for typical AI output.
// Usage: converts markdown-like text with $math$ to HTML with <span data-type="math">

export function parseMathToHtml(text: string): string {
    if (!text) return "";

    // 1. Escape HTML characters to prevent XSS and broken HTML
    // (Basic escaping; Tiptap might handle this, but if we feed it HTML string, we must be careful)
    // Actually, if we are passing this to Tiptap's `content` prop, Tiptap expects HTML.
    // If the input `text` is meant to be Markdown/Text that contains $math$, we need to convert it to HTML.

    // Let's assume the input is mostly plain text or basic markdown, but we specifically want to handle $math$.
    // If we escape everything, we break formatting like <b> etc. if they exist.
    // Assuming the input is "content text" which might contain $...$.

    // Strategy:
    // Split by math delimiters.
    // Escape the non-math parts?
    // Or just replace math parts with the span.

    // The previous implementation had `processMathInHtml`.
    // We'll reimplement it with the new attribute `data-latex`.

    // Regex for $...$
    // Supports escaped dollars \$ inside the math.
    // Logic:
    // \$ matches literal $
    // (
    //   (?: \\. | [^$] )+   --> match escaped char OR non-$ char, one or more times
    // )
    // \$ matches literal $

    // Note: In JS strings, \\. becomes \. in regex.
    const regex = /\$((?:\\.|[^$])+)\$/g;

    return text.replace(regex, (match, latex) => {
      // Decode escaped dollars in latex content if needed,
      // but usually we want to keep them as is for Katex,
      // EXCEPT if the user typed \$ to mean a literal dollar inside math?
      // No, usually in LaTeX \$ is a dollar symbol.
      // But we captured it.

      // We need to escape double quotes in latex attribute
      const safeLatex = latex.replace(/"/g, '&quot;');
      return `<span data-type="math" data-latex="${safeLatex}"></span>`;
    });
  }
