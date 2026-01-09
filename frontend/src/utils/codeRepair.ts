export const repairTruncatedContent = (content: string, path: string): string => {
  if (!content) return '';
  const ext = path.split('.').pop()?.toLowerCase();
  
  // Only attempt repair for code/data files
  if (!/(js|ts|tsx|jsx|json|css|html|md)$/.test(ext || '')) {
    return content;
  }

  let repaired = content;

  // 1. Fix "Unexpected identifier" caused by truncated keys in objects (e.g. "image")
  // Regex looks for a key-like identifier at the very end of the file, preceded by whitespace or comma/brace
  if (/(js|ts|tsx|jsx|json)$/.test(ext || '')) {
    if (/[\{\,]\s*[a-zA-Z0-9_]+$/.test(repaired)) {
        repaired += ': null';
    } else if (/:\s*$/.test(repaired)) {
        repaired += 'null';
    }
  }

  // 2. Close open braces/parens/brackets
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openParens = (repaired.match(/\(/g) || []).length;
  const closeParens = (repaired.match(/\)/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  
  // Close quotes if we are inside one? (Hard to track without tokenizer, but we can try simple heuristic)
  const doubleQuotes = (repaired.match(/"/g) || []).length;
  const singleQuotes = (repaired.match(/'/g) || []).length;
  const backticks = (repaired.match(/`/g) || []).length;

  if (doubleQuotes % 2 !== 0) repaired += '"';
  if (singleQuotes % 2 !== 0) repaired += "'";
  if (backticks % 2 !== 0) repaired += "`";

  for (let i = 0; i < openParens - closeParens; i++) repaired += ')';
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '\n}';

  // 3. Add a safety comment to indicate repair
  if (/(js|ts|tsx|jsx)$/.test(ext || '')) {
    repaired += '\n// [AI-REPAIRED] Truncated content auto-fixed';
  } else if (ext === 'html') {
    if (!repaired.includes('</html>')) repaired += '\n</html>';
  }

  return repaired;
};
