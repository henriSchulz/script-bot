import JSON5 from 'json5';

/**
 * Helper to reliably parse JSON from Gemini response.
 * Handles markdown code blocks, finding JSON start/end, and fixing common truncation issues.
 */
export function parseGeminiResponse(text: string): any {
  // 1. Remove markdown code blocks (global replace is safer than strict match)
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 2. Find JSON boundaries (either object or array)
  const startObject = cleanText.indexOf('{');
  const startArray = cleanText.indexOf('[');
  
  // Simple heuristic: if we find { or [ early on, assume it starts there
  if (startObject !== -1 && (startArray === -1 || startObject < startArray)) {
      cleanText = cleanText.substring(startObject);
      // We assume the end is correct or handled by JSON5/repair, 
      // but finding the last } could also help if there is trailing text.
       const lastBrace = cleanText.lastIndexOf('}');
       if (lastBrace !== -1) {
           cleanText = cleanText.substring(0, lastBrace + 1);
       }
  } else if (startArray !== -1) {
      cleanText = cleanText.substring(startArray);
       const lastBracket = cleanText.lastIndexOf(']');
       if (lastBracket !== -1) {
           cleanText = cleanText.substring(0, lastBracket + 1);
       }
  }

  // 3. Try parsing with JSON5 (more forgiving on trailing commas, comments, etc)
  try {
    return JSON5.parse(cleanText);
  } catch (e) {
    console.warn("Initial JSON5 parse failed, attempting repairs on text length:", cleanText.length);
  }

  // 4. Attempt repair for "Bad escaped character" (common with LaTeX)
  try {
     // Fix specific LaTeX commands that start with JSON escape chars or invalid chars
     // We escape the backslash: \frac -> \\frac
     let fixedText = cleanText.replace(/\\(beta|bar|begin|bf|frac|forall|footnote|nu|nabla|neq|not|natural|rho|right|ref|tau|theta|times|text|tiny|title|usepackage|underbrace|underline|cdot|sum|int|partial|sqrt)/g, '\\\\$1');
     
     // Fix backslashes followed by invalid escape characters (anything not " \ / b f n r t u)
     fixedText = fixedText.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
     
     // Fix \u not followed by 4 hex digits (often used for units or text)
     fixedText = fixedText.replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');

     return JSON5.parse(fixedText);
  } catch (e) {
      console.warn("LaTeX repair failed, trying truncation repair...");
  }

  // 5. Attempt repair for truncation
  // Common missing endings due to token limit
  
  // First, check if we have an unclosed string (odd number of unescaped quotes)
  // This is a simple heuristic - count quotes that aren't preceded by backslash
  const quoteCount = (cleanText.match(/(?<!\\)"/g) || []).length;
  const hasUnclosedString = quoteCount % 2 !== 0;
  
  const closers = [
      ...(hasUnclosedString ? ['"', '" }', '" }]', '" } ]'] : []),
      '}', 
      ']', 
      '"}', 
      '"]', 
      '}]', 
      ']}', 
      '"}]', 
      '"]}',
      // Sometimes it cuts off inside a string value
      '" }', 
      '" ]'
  ];
  
  for (const closer of closers) {
      try {
          const repaired = JSON5.parse(cleanText + closer);
          console.log(`[AI] JSON repaired successfully with appended '${closer}'`);
          return repaired;
      } catch (e) {
          // continue trying
      }
  }

  // 5. If all else fails, throw original error or return null?
  console.error("Failed to parse/repair JSON. Content snippet:", cleanText.substring(0, 200) + "...");
  throw new Error("Failed to parse AI response");
}
