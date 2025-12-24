// A simple regex-based parser that is robust enough for typical AI output.
// Usage: converts markdown-like text with $math$ to HTML with <span data-type="math">

export function parseMathToHtml(text: string): string {
    if (!text) return "";

    // Regex to match:
    // 1. $$ ... $$  (Block)
    // 2. \[ ... \]  (Block)
    // 3. \( ... \)  (Inline)
    // 4. $ ... $    (Inline)
    
    // Note: We use [\s\S] to match across newlines for block math
    const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$((?:\\.|[^$])+)\$/g;

    return text.replace(regex, (match, block1, block2, inline1, inline2) => {
      const latex = block1 || block2 || inline1 || inline2;
      const isBlock = !!(block1 || block2);
      
      if (!latex) return match;

      // Escape HTML entities
      const safeLatex = latex
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      
      // We can add a data attribute if we want to style block math differently later
      const displayMode = isBlock ? ' data-display="true"' : '';
      
      return `<span data-type="math" data-latex="${safeLatex}"${displayMode}></span>`;
    });
}

