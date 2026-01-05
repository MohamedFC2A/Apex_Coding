// JSON repair utility for handling incomplete or malformed JSON from LLMs

export function repairJSON(text: string): string {
  // Remove any markdown code fences
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  
  // Trim whitespace
  text = text.trim();
  
  // Find the first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found');
  }
  
  text = text.substring(firstBrace, lastBrace + 1);
  
  // Try to fix common issues
  // 1. Missing closing quotes
  text = text.replace(/:\s*"([^"]*?)(?:\n|,|})/g, (match, content, ending) => {
    if (!content.endsWith('"')) {
      return `: "${content}"${ending}`;
    }
    return match;
  });
  
  // 2. Trailing commas
  text = text.replace(/,(\s*[}\]])/g, '$1');
  
  // 3. Missing commas between properties
  text = text.replace(/"\s*\n\s*"/g, '",\n"');
  
  return text;
}

export function validateAndRepairJSON(text: string): { success: boolean; data?: any; error?: string } {
  try {
    // First try: parse as-is
    const data = JSON.parse(text);
    return { success: true, data };
  } catch (e1) {
    try {
      // Second try: repair and parse
      const repaired = repairJSON(text);
      const data = JSON.parse(repaired);
      return { success: true, data };
    } catch (e2: any) {
      return {
        success: false,
        error: `JSON parse failed: ${e2.message}`
      };
    }
  }
}
