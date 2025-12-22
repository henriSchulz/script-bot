// A simple regex-based parser that is robust enough for typical AI output.
// Usage: converts markdown-like text with $math$ to HTML with <span data-type="math">

export function parseMathToHtml(text: string): string {
    if (!text) return "";

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
      // Escape double quotes and other HTML entities in latex attribute
      const safeLatex = latex
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      
      return `<span data-type="math" data-latex="${safeLatex}"></span>`;
    });
}

