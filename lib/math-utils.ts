export function processMathInHtml(html: string): string {
  // Replace $...$ with <span data-type="inline-math" data-content="..."></span>
  // We need to be careful with existing HTML tags.
  // But since AI returns simple HTML, a simple regex might suffice for now.
  // We ignore $$ for now as Tiptap InlineMath doesn't handle display math this way usually.
  
  console.log("[MathUtils] Processing HTML:", html.substring(0, 100) + "...");
  const result = html.replace(/\$([^$]+)\$/g, (match, content) => {
    console.log("[MathUtils] Found math:", content);
    return `<span data-type="inline-math" data-content="${content}"></span>`;
  });
  console.log("[MathUtils] Result:", result.substring(0, 100) + "...");
  return result;
}
