/**
 * AI-Preview Integration Service
 * Handles bidirectional communication between AI code generation and live preview
 * Allows AI to understand preview feedback and adapt code generation
 */

import { ProjectFile } from '@/types';

export interface PreviewFeedback {
  // Rendering state
  status: 'rendering' | 'error' | 'success';
  errorMessage?: string;
  warnings?: string[];
  
  // Performance metrics
  renderTime?: number;
  
  // DOM structure feedback
  htmlValid?: boolean;
  cssValid?: boolean;
  jsValid?: boolean;
  
  // Common issues detected
  isTruncated?: boolean;
  isSyntaxError?: boolean;
  isMissingDependencies?: boolean;
  
  // Responsive design feedback
  mobileIssues?: string[];
  desktopIssues?: string[];
}

export interface PreviewContext {
  currentPreviewUrl?: string;
  previewEngineType?: 'simple' | 'webcontainer' | 'previewrunner';
  lastFeedback?: PreviewFeedback;
  projectType?: 'FRONTEND_ONLY' | 'FULL_STACK';
}

export interface EnhancedCodeGenRequest {
  prompt: string;
  previewContext?: PreviewContext;
  currentFiles?: ProjectFile[];
  targetLanguage?: string;
  includeResponsive?: boolean;
  autoFixIssues?: boolean;
}

/**
 * Analyzes preview feedback and generates suggested fixes
 */
export const analyzePreviewIssues = (feedback: PreviewFeedback): string[] => {
  const suggestions: string[] = [];

  if (!feedback) return suggestions;

  if (feedback.status === 'error' && feedback.errorMessage) {
    const errorMsg = feedback.errorMessage.toLowerCase();
    
    if (errorMsg.includes('unexpected end of input') || errorMsg.includes('truncated')) {
      suggestions.push('Content is truncated - AI should verify all closing tags and brackets are included');
    }
    
    if (errorMsg.includes('syntax error')) {
      suggestions.push('Syntax error detected - review all code for proper syntax');
    }
    
    if (errorMsg.includes('undefined') || errorMsg.includes('is not defined')) {
      suggestions.push('Variable or function not defined - check all dependencies are loaded');
    }
    
    if (errorMsg.includes('cannot read properties') || errorMsg.includes('cannot access')) {
      suggestions.push('Property access error - verify all objects exist before accessing properties');
    }
  }

  if (feedback.isTruncated) {
    suggestions.push('Content appears truncated - generate complete code blocks with proper closing syntax');
  }

  if (!feedback.htmlValid) {
    suggestions.push('HTML structure issue - ensure all tags are properly closed');
  }

  if (!feedback.cssValid) {
    suggestions.push('CSS syntax issue - verify all rules have proper syntax');
  }

  if (!feedback.jsValid) {
    suggestions.push('JavaScript error - check for typos and syntax errors');
  }

  if (feedback.mobileIssues && feedback.mobileIssues.length > 0) {
    suggestions.push(`Mobile responsiveness issues: ${feedback.mobileIssues.join(', ')}`);
  }

  if (feedback.desktopIssues && feedback.desktopIssues.length > 0) {
    suggestions.push(`Desktop layout issues: ${feedback.desktopIssues.join(', ')}`);
  }

  return suggestions;
};

/**
 * Builds enhanced prompt for AI code generation with preview context
 */
export const buildPreviewAwarePrompt = (
  basePrompt: string,
  context?: PreviewContext
): string => {
  if (!context || !context.lastFeedback) {
    return basePrompt;
  }

  const issues = analyzePreviewIssues(context.lastFeedback);
  if (issues.length === 0) {
    return basePrompt;
  }

  const previewAwareInstructions = `
[PREVIEW FEEDBACK CONTEXT]
The code was previously tested in Live Preview (${context.previewEngineType || 'browser'}) with the following feedback:

Issues detected:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Instructions:
- Fix the above issues in the regenerated code
- Ensure all HTML/CSS/JS is complete and not truncated
- Test the code mentally against the reported issues
- If the engine is "simple" (browser-only), avoid relative asset paths
- Include proper error handling for edge cases
- Verify all closing tags and brackets are included

${basePrompt}`;

  return previewAwareInstructions;
};

/**
 * Detects common preview issues from error messages
 */
export const detectPreviewIssues = (errorMessage: string): PreviewFeedback => {
  const feedback: PreviewFeedback = { status: 'error' };

  if (!errorMessage) {
    feedback.status = 'success';
    return feedback;
  }

  const lowerError = errorMessage.toLowerCase();
  feedback.errorMessage = errorMessage;

  // Detect specific issues
  if (lowerError.includes('unexpected end of input') || lowerError.includes('eof')) {
    feedback.isTruncated = true;
  }

  if (lowerError.includes('syntaxerror')) {
    feedback.isSyntaxError = true;
  }

  if (lowerError.includes('undefined') || lowerError.includes('is not defined')) {
    feedback.isMissingDependencies = true;
  }

  // Try to parse structured error information
  if (lowerError.includes('mobile') || lowerError.includes('responsive')) {
    feedback.mobileIssues = [errorMessage];
  }

  return feedback;
};

/**
 * Validates generated code for common preview compatibility issues
 */
export const validateCodeForPreview = (
  code: string,
  fileType: 'html' | 'css' | 'js' | 'tsx' | 'jsx'
): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];

  if (!code) {
    return { valid: false, issues: ['Code is empty'] };
  }

  // Check HTML
  if (fileType === 'html') {
    const openTags = (code.match(/<[^/>]+>/g) || []).length;
    const closeTags = (code.match(/<\/\w+>/g) || []).length;
    
    if (openTags > closeTags + 5) {
      issues.push('Many unclosed HTML tags detected');
    }

    if (!code.includes('</html>') && code.includes('<html')) {
      issues.push('Missing closing </html> tag');
    }

    if (!code.includes('</body>') && code.includes('<body')) {
      issues.push('Missing closing </body> tag');
    }

    if (code.match(/<script[^>]*>/g)?.length !== code.match(/<\/script>/g)?.length) {
      issues.push('Mismatched script tags');
    }
  }

  // Check JavaScript/TypeScript
  if (fileType === 'js' || fileType === 'tsx' || fileType === 'jsx') {
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    
    if (openBraces > closeBraces) {
      issues.push(`Unclosed braces: ${openBraces - closeBraces} more opening than closing`);
    }

    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    if (openParens > closeParens) {
      issues.push(`Unclosed parentheses: ${openParens - closeParens} more opening than closing`);
    }
  }

  // Check CSS
  if (fileType === 'css') {
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      issues.push(`CSS brace mismatch: ${Math.abs(openBraces - closeBraces)} unbalanced`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

/**
 * Generates a repair prompt when preview detects issues
 */
export const generateRepairPrompt = (
  fileContent: string,
  fileType: string,
  feedback: PreviewFeedback
): string => {
  const issues = analyzePreviewIssues(feedback);

  return `The following code has issues detected by the live preview:

File type: ${fileType}
Current content: 
\`\`\`${fileType}
${fileContent}
\`\`\`

Issues to fix:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Please regenerate the complete, fixed version of this code:
1. Ensure all syntax is correct
2. Close all unclosed tags/braces/parentheses
3. Include complete code - don't truncate
4. Test the code mentally for correctness
5. Return ONLY the fixed code block, no explanation

Fixed code:`;
};

export const aiPreviewService = {
  analyzePreviewIssues,
  buildPreviewAwarePrompt,
  detectPreviewIssues,
  validateCodeForPreview,
  generateRepairPrompt,
};
