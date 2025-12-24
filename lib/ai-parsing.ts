import JSON5 from 'json5';

/**
 * Helper to reliably parse JSON from Gemini response.
 * Handles markdown code blocks, finding JSON start/end, and fixing common truncation issues.
 */
// Helper to fix common LaTeX/JSON escape issues
function fixJsonEscapes(text: string): string {
    // 1. Aggressively fix control-char-like LaTeX commands (\frac, \beta, \text, \rho, \nabla, etc.)
    // We assume that in this AI context, \f, \b, \r, \t, \v followed by any letter is meant to be LaTeX, not a control char.
    // \n is the only exception we treat carefully because newlines are valid.
    
    // Fix \f, \b, \r, \t, \v if followed by a letter (e.g. \frac, \beta, \rho, \text, \vec)
    let fixed = text.replace(/(?<!\\)\\(f|b|r|t|v)([a-zA-Z])/g, '\\\\$1$2');

    // 2. Fix specific newline-like LaTeX commands (\neq, \nabla, \nu, \not, \natural, \neg)
    // We don't want to break actual newlines \n
    fixed = fixed.replace(/(?<!\\)\\(n)(eq|abla|u|ot|atural|eg)/g, '\\\\$1$2');

    // 3. Fix backslashes followed by invalid escape characters (anything not " \ / b f n r t u)
    // This catches \left, \right, \alpha, \sum, etc.
    fixed = fixed.replace(/(?<!\\)\\([^"\\/bfnrtu])/g, '\\\\$1');
     
    // 4. Fix \u not followed by 4 hex digits (e.g. \underline, \usepackage)
    fixed = fixed.replace(/(?<!\\)\\u(?![0-9a-fA-F]{4})/g, '\\\\u');

    return fixed;
}

export function parseGeminiResponse(text: string): any {
  // 1. Remove markdown code blocks (global replace is safer than strict match)
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 2. Find JSON boundaries
  const startObject = cleanText.indexOf('{');
  const startArray = cleanText.indexOf('[');
  
  if (startObject !== -1 && (startArray === -1 || startObject < startArray)) {
      cleanText = cleanText.substring(startObject);
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

  // 3. Apply Escape Fixes GLOBALLY (Optimization: do this once)
  // This ensures that subsequent repair attempts (like truncation repair) 
  // also benefit from fixed escapes.
  const escapedText = fixJsonEscapes(cleanText);

  // 4. Try parsing the escaped text
  try {
    return JSON5.parse(escapedText);
  } catch (e) {
    // console.warn("Initial parse failed, trying repairs...");
  }

  // 5. Attempt repair for truncation on the ESCAPED text
  // Common missing endings due to token limit
  const quoteCount = (escapedText.match(/(?<!\\)"/g) || []).length;
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
      '" }', 
      '" ]'
  ];
  
  for (const closer of closers) {
      try {
          const repaired = JSON5.parse(escapedText + closer);
          console.log(`[AI] JSON repaired successfully with appended '${closer}'`);
          return repaired;
      } catch (e) {
          // continue trying
      }
  }

  // 6. Lossy Repair (Aggressive) on ESCAPED text
  if (escapedText.includes('"blocks":') || escapedText.trim().startsWith('[')) {
      try {
          // Find the last "}," pattern
          const lastObjectEnd = escapedText.lastIndexOf('},');
          if (lastObjectEnd !== -1) {
              const truncated = escapedText.substring(0, lastObjectEnd + 1);
              const candidates = [
                  truncated + ' ] }', 
                  truncated + ' ]',
              ];

              for (const candidate of candidates) {
                  try {
                      const repaired = JSON5.parse(candidate);
                      console.warn("[AI] JSON parsed with LOSSY REPAIR (truncated last block)");
                      return repaired;
                  } catch (e) {}
              }
          }
      } catch (e) {}
  }

  // 7. If all else fails
  console.error("Failed to parse/repair JSON. Content snippet:", cleanText.substring(0, 200) + "...");
  throw new Error("Failed to parse AI response");
}
