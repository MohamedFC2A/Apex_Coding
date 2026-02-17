/**
 * Validates and repairs truncated code content from AI generation
 * Handles: closing unclosed braces, fixing unterminated strings, completing HTML structure
 */
const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

const normalizeForHtmlTagParsing = (html: string) => {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '<style></style>');
};

const getDanglingHtmlTags = (html: string): string[] => {
  const stack: string[] = [];
  const normalized = normalizeForHtmlTagParsing(html);
  const tagRegex = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(normalized)) !== null) {
    const fullTag = match[0];
    const tagName = (match[1] || '').toLowerCase();
    if (!tagName) continue;

    const isClosingTag = fullTag.startsWith('</');
    const isSelfClosing = /\/\s*>$/.test(fullTag) || VOID_HTML_TAGS.has(tagName);

    if (isClosingTag) {
      if (stack.length === 0) continue;
      if (stack[stack.length - 1] === tagName) {
        stack.pop();
        continue;
      }

      const openIndex = stack.lastIndexOf(tagName);
      if (openIndex >= 0) {
        stack.splice(openIndex);
      }
      continue;
    }

    if (!isSelfClosing) {
      stack.push(tagName);
    }
  }

  return stack;
};

const rebuildHtmlWithDomParser = (html: string): string => {
  if (typeof DOMParser === 'undefined') return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  if (!doc || !doc.documentElement) return html;
  const doctype = '<!DOCTYPE html>';
  return `${doctype}\n${doc.documentElement.outerHTML}`;
};

type RepairOptions = {
  isKnownPartial?: boolean;
  allowAggressiveFixes?: boolean;
};

const looksTruncated = (text: string) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  return /[\{\[\(,:=]\s*$/.test(trimmed) || /(?:\/\/|\/\*)\s*$/.test(trimmed);
};

export const repairTruncatedContent = (content: string, path: string, options: RepairOptions = {}): string => {
  if (!content) return '';
  const ext = path.split('.').pop()?.toLowerCase();
  const isKnownPartial = Boolean(options.isKnownPartial);
  const allowAggressiveFixes = Boolean(options.allowAggressiveFixes);
  
  // Only attempt repair for code/data files
  if (!/(js|ts|tsx|jsx|json|css|html|md)$/.test(ext || '')) {
    return content;
  }

  let repaired = content.trimEnd();

  // Special handling for HTML: ensure closing tags before any repairs
  if (ext === 'html') {
    const hasHtmlTag = /<html\b/i.test(repaired);
    if (!hasHtmlTag && repaired.trim().length > 0) {
      repaired = `<!DOCTYPE html>\n<html>\n<body>\n${repaired}\n</body>\n</html>`;
    }

    const danglingTags = getDanglingHtmlTags(repaired);
    if (danglingTags.length > 0) {
      const closingTags = [...danglingTags].reverse().map((tag) => `</${tag}>`).join('\n');
      repaired += `\n${closingTags}`;
    }

    // Final pass: let a real HTML parser normalize/rebuild the document.
    repaired = rebuildHtmlWithDomParser(repaired);
    return repaired;
  }

  const scriptLike = /(js|ts|tsx|jsx|json)$/.test(ext || '');
  if (!scriptLike) return repaired;

  // Conservative mode: do not mutate complete files unless partial truncation is known.
  if (!isKnownPartial && !looksTruncated(repaired)) {
    return repaired;
  }

  if (!allowAggressiveFixes && !isKnownPartial) {
    return repaired;
  }

  // Truncation-aware fallback repair for known partial files.
  if (/[\{\,\[]\s*[a-zA-Z_$][a-zA-Z0-9_]*$/.test(repaired)) {
    repaired += ': null';
  } else if (/:\s*$/.test(repaired)) {
    repaired += ' null';
  } else if (/[,\[]\s*$/.test(repaired)) {
    repaired += ' null';
  }

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openParens = (repaired.match(/\(/g) || []).length;
  const closeParens = (repaired.match(/\)/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  const doubleQuotes = (repaired.match(/"/g) || []).length;
  const singleQuotes = (repaired.match(/'/g) || []).length;
  const backticks = (repaired.match(/`/g) || []).length;

  if (doubleQuotes % 2 !== 0) repaired += '"';
  if (singleQuotes % 2 !== 0) repaired += "'";
  if (backticks % 2 !== 0) repaired += "`";

  // Close opening parentheses/brackets/braces in order (prevents syntax errors)
  for (let i = 0; i < openParens - closeParens; i++) repaired += ')';
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '\n}';

  return repaired;
};

/**
 * Validates HTML/CSS/JS content for common syntax errors before rendering
 * Used by preview components to catch issues early
 */
export const validatePreviewContent = (content: string): { valid: boolean; error?: string } => {
  if (!content) return { valid: false, error: 'Empty content' };
  
  try {
    const looksLikeHtml = /<\s*[a-z!/]/i.test(content);
    if (!looksLikeHtml) {
      return { valid: true };
    }

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      if (!doc || !doc.documentElement) {
        return { valid: false, error: 'Unable to parse HTML document' };
      }
      return { valid: true };
    }

    const danglingTags = getDanglingHtmlTags(content);
    if (danglingTags.length > 0) {
      return {
        valid: false,
        error: `HTML structure incomplete: ${danglingTags.length} unclosed tag(s) (${danglingTags.slice(-3).join(', ')})`
      };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
};
