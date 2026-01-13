import { useAIStore } from '@/stores/aiStore';

// Enhanced AI Code Generator with Advanced Features
export class AICodeGenerator {
  private static instance: AICodeGenerator;
  private completionCache = new Map<string, any[]>();
  private analysisCache = new Map<string, any>();

  static getInstance(): AICodeGenerator {
    if (!AICodeGenerator.instance) {
      AICodeGenerator.instance = new AICodeGenerator();
    }
    return AICodeGenerator.instance;
  }

  // Smart code completion with context awareness
  async getCompletions(code: string, language: string, position: any): Promise<any[]> {
    const cacheKey = `${code.slice(-100)}_${language}_${position.lineNumber}_${position.column}`;
    
    if (this.completionCache.has(cacheKey)) {
      return this.completionCache.get(cacheKey) || [];
    }

    const { appendThinkingContent } = useAIStore.getState();
    appendThinkingContent(`[AI] Generating code completions for ${language}...\n`);

    // Get current line and context
    const lines = code.split('\n');
    const currentLine = lines[position.lineNumber - 1] || '';
    const beforeCursor = currentLine.slice(0, position.column - 1);
    
    // Generate context-aware completions
    const completions = await this.generateContextualCompletions(
      beforeCursor,
      code,
      language,
      position
    );

    // Cache for 5 minutes
    this.completionCache.set(cacheKey, completions);
    setTimeout(() => this.completionCache.delete(cacheKey), 300000);

    return completions;
  }

  // Advanced code analysis with multiple metrics
  async analyzeCode(code: string, language: string): Promise<{
    suggestions: string[];
    optimizations: string[];
    issues: Array<{ line: number; message: string; severity: 'error' | 'warning' | 'info' }>;
    complexity: number;
    improvements: string[];
    metrics: {
      linesOfCode: number;
      cyclomaticComplexity: number;
      maintainabilityIndex: number;
      technicalDebt: number;
      testCoverage: number;
    };
  }> {
    const cacheKey = this.hashString(code + language);
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    const { appendThinkingContent } = useAIStore.getState();
    appendThinkingContent(`[AI] Analyzing ${language} code...\n`);

    // Calculate metrics
    const metrics = this.calculateMetrics(code, language);
    
    // Generate suggestions based on analysis
    const suggestions = this.generateSuggestions(code, language, metrics);
    
    // Find optimization opportunities
    const optimizations = this.findOptimizations(code, language, metrics);
    
    // Detect issues
    const issues = this.detectIssues(code, language);
    
    // Generate improvement recommendations
    const improvements = this.generateImprovements(metrics, issues);

    const analysis = {
      suggestions,
      optimizations,
      issues,
      complexity: metrics.cyclomaticComplexity,
      improvements,
      metrics
    };

    // Cache for 10 minutes
    this.analysisCache.set(cacheKey, analysis);
    setTimeout(() => this.analysisCache.delete(cacheKey), 600000);

    return analysis;
  }

  // Smart code refactoring
  async refactorCode(code: string, instructions: string, language: string): Promise<string> {
    // Import AI service dynamically to avoid circular dependencies
    const { useAIStore } = await import('@/stores/aiStore');
    const { generateCode } = useAIStore.getState();
    
    const prompt = `Refactor the following ${language} code based on these instructions: "${instructions}"

Original code:
\`\`\`${language}
${code}
\`\`\`

Requirements:
1. Maintain the same functionality
2. Follow ${language} best practices
3. Improve readability and maintainability
4. Add comments where necessary
5. Optimize for performance

Refactored code:`;

    const refactoredCode = await generateCode(prompt);
    return this.extractCodeFromResponse(refactoredCode);
  }

  // Generate code from natural language
  async generateCodeFromDescription(description: string, context: {
    language: string;
    framework?: string;
    style?: string;
    dependencies?: string[];
  }): Promise<string> {
    // Import AI service dynamically to avoid circular dependencies
    const { useAIStore } = await import('@/stores/aiStore');
    const { generateCode } = useAIStore.getState();
    
    const prompt = `Generate ${context.language} code for: ${description}

Context:
- Framework: ${context.framework || 'None'}
- Style: ${context.style || 'Modern'}
- Available dependencies: ${context.dependencies?.join(', ') || 'None'}

Requirements:
1. Follow ${context.language} best practices
2. Include error handling
3. Add TypeScript types if applicable
4. Include comments for complex logic
5. Make it production-ready

Generated code:`;

    const generatedCode = await generateCode(prompt);
    return this.extractCodeFromResponse(generatedCode);
  }

  // Explain code in natural language
  async explainCode(code: string, language: string): Promise<string> {
    // Import AI service dynamically to avoid circular dependencies
    const { useAIStore } = await import('@/stores/aiStore');
    const { generateCode } = useAIStore.getState();
    
    const prompt = `Explain the following ${language} code in simple terms:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. High-level overview
2. Step-by-step explanation
3. Key concepts used
4. Potential improvements
5. Common pitfalls to avoid

Explanation:`;

    return await generateCode(prompt);
  }

  // Generate unit tests
  async generateTests(code: string, language: string, testFramework: string = 'jest'): Promise<string> {
    // Import AI service dynamically to avoid circular dependencies
    const { useAIStore } = await import('@/stores/aiStore');
    const { generateCode } = useAIStore.getState();
    
    const prompt = `Generate comprehensive unit tests for the following ${language} code using ${testFramework}:

\`\`\`${language}
${code}
\`\`\`

Requirements:
1. Test all functions and edge cases
2. Include happy path and error scenarios
3. Use proper assertions
4. Add setup and teardown if needed
5. Aim for high code coverage

Tests:`;

    const tests = await generateCode(prompt);
    return this.extractCodeFromResponse(tests);
  }

  // Private helper methods
  private async generateContextualCompletions(
    beforeCursor: string,
    fullCode: string,
    language: string,
    position: any
  ): Promise<any[]> {
    const completions: any[] = [];
    
    // Import completions
    if (beforeCursor.match(/^(import|from)\s*\w*$/)) {
      completions.push(...this.getImportCompletions(language));
    }
    
    // React component completions
    if (language.includes('typescript') || language.includes('javascript')) {
      if (beforeCursor.includes('function') || beforeCursor.includes('const')) {
        completions.push(...this.getFunctionCompletions());
      }
      if (beforeCursor.includes('return')) {
        completions.push(...this.getJSXCompletions());
      }
    }
    
    // CSS completions
    if (language === 'css' || language === 'scss') {
      completions.push(...this.getCSSCompletions(beforeCursor));
    }
    
    // Python completions
    if (language === 'python') {
      completions.push(...this.getPythonCompletions(beforeCursor));
    }
    
    return completions;
  }

  private getImportCompletions(language: string): any[] {
    const imports = {
      typescript: [
        { label: 'import React', insertText: 'import React from "react";' },
        { label: 'import { useState }', insertText: 'import { useState } from "react";' },
        { label: 'import { useEffect }', insertText: 'import { useEffect } from "react";' },
        { label: 'import type', insertText: 'import type { ${1:Type} } from "${2:module}";' },
      ],
      javascript: [
        { label: 'import React', insertText: 'import React from "react";' },
        { label: 'import { useState }', insertText: 'import { useState } from "react";' },
        { label: 'import { useEffect }', insertText: 'import { useEffect } from "react";' },
      ],
      python: [
        { label: 'import os', insertText: 'import os' },
        { label: 'import sys', insertText: 'import sys' },
        { label: 'from typing', insertText: 'from typing import ${1:List, Dict}' },
      ]
    };
    
    return imports[language as keyof typeof imports] || [];
  }

  private getFunctionCompletions(): any[] {
    return [
      {
        label: 'arrow function',
        insertText: 'const ${1:functionName} = (${2:params}) => {\n  ${3:// body}\n};'
      },
      {
        label: 'async function',
        insertText: 'const ${1:functionName} = async (${2:params}) => {\n  ${3:// body}\n};'
      },
      {
        label: 'React component',
        insertText: 'const ${1:ComponentName} = ({${2:props}}) => {\n  return (\n    <div>\n      ${3}\n    </div>\n  );\n};'
      }
    ];
  }

  private getJSXCompletions(): any[] {
    return [
      { label: 'div', insertText: '<div>${1}</div>' },
      { label: 'span', insertText: '<span>${1}</span>' },
      { label: 'button', insertText: '<button onClick={${1}}>${2}</button>' },
      { label: 'input', insertText: '<input type="${1:text}" value={${2}} onChange={${3}} />' },
      { label: 'Fragment', insertText: '<<React.Fragment>${1}</React.Fragment>' }
    ];
  }

  private getCSSCompletions(beforeCursor: string): any[] {
    const properties = [
      { label: 'display', insertText: 'display: ${1:flex};' },
      { label: 'flex-direction', insertText: 'flex-direction: ${1:column};' },
      { label: 'justify-content', insertText: 'justify-content: ${1:center};' },
      { label: 'align-items', insertText: 'align-items: ${1:center};' },
      { label: 'position', insertText: 'position: ${1:relative};' },
      { label: 'z-index', insertText: 'z-index: ${1:10};' }
    ];
    
    return properties;
  }

  private getPythonCompletions(beforeCursor: string): any[] {
    return [
      { label: 'def', insertText: 'def ${1:function_name}(${2:params}):\n    """${3:docstring}"""\n    ${4:pass}' },
      { label: 'class', insertText: 'class ${1:ClassName}:\n    """${2:docstring}"""\n    \n    def __init__(self${3:, params}):\n        ${4:pass}' },
      { label: 'async def', insertText: 'async def ${1:function_name}(${2:params}):\n    """${3:docstring}"""\n    ${4:pass}' }
    ];
  }

  private calculateMetrics(code: string, language: string): any {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // Simplified cyclomatic complexity calculation
    const complexityKeywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||'];
    let complexity = 1;
    
    nonEmptyLines.forEach(line => {
      complexityKeywords.forEach(keyword => {
        if (line.includes(keyword)) complexity++;
      });
    });
    
    // Maintainability index (simplified)
    const maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(complexity) - 0.23 * complexity - 16.2 * Math.log(nonEmptyLines.length));
    
    // Technical debt (hours)
    const technicalDebt = Math.max(0, (complexity - 10) * 0.5);
    
    return {
      linesOfCode: nonEmptyLines.length,
      cyclomaticComplexity: complexity,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      technicalDebt: Math.round(technicalDebt * 10) / 10,
      testCoverage: 0 // Would need test files to calculate
    };
  }

  private generateSuggestions(code: string, language: string, metrics: any): string[] {
    const suggestions: string[] = [];
    
    if (metrics.cyclomaticComplexity > 10) {
      suggestions.push('Consider breaking down complex functions into smaller ones');
    }
    
    if (metrics.maintainabilityIndex < 50) {
      suggestions.push('Code maintainability is low. Add comments and simplify logic');
    }
    
    if (metrics.technicalDebt > 5) {
      suggestions.push(`High technical debt (${metrics.technicalDebt}h). Consider refactoring`);
    }
    
    if (!code.includes('try') && !code.includes('catch')) {
      suggestions.push('Add error handling with try-catch blocks');
    }
    
    if (language.includes('typescript') && !code.includes(':')) {
      suggestions.push('Add TypeScript type annotations for better type safety');
    }
    
    return suggestions;
  }

  private findOptimizations(code: string, language: string, metrics: any): string[] {
    const optimizations: string[] = [];
    
    // Performance optimizations
    if (code.includes('useState') && !code.includes('useMemo')) {
      optimizations.push('Use useMemo to prevent expensive recalculations');
    }
    
    if (code.includes('useEffect') && !code.includes('dependency array')) {
      optimizations.push('Add dependency array to useEffect to prevent unnecessary re-renders');
    }
    
    if (code.includes('map') && !code.includes('key=')) {
      optimizations.push('Add key prop to mapped elements for optimal rendering');
    }
    
    // Code quality optimizations
    if (code.split('\n').length > 50) {
      optimizations.push('Consider splitting large files into smaller modules');
    }
    
    if ((code.match(/console\.log/g) || []).length > 3) {
      optimizations.push('Remove or replace console.log statements with proper logging');
    }
    
    return optimizations;
  }

  private detectIssues(code: string, language: string): Array<{ line: number; message: string; severity: 'error' | 'warning' | 'info' }> {
    const issues: Array<{ line: number; message: string; severity: 'error' | 'warning' | 'info' }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Common issues
      if (line.includes('TODO:') || line.includes('FIXME:')) {
        issues.push({
          line: lineNumber,
          message: line.includes('TODO:') ? 'TODO item found' : 'FIXME item found',
          severity: 'info'
        });
      }
      
      if (line.includes('debugger') || line.includes('console.log')) {
        issues.push({
          line: lineNumber,
          message: 'Debug statement found',
          severity: 'warning'
        });
      }
      
      if (line.includes('eval(')) {
        issues.push({
          line: lineNumber,
          message: 'Avoid using eval() for security reasons',
          severity: 'error'
        });
      }
      
      // Language-specific issues
      if (language.includes('typescript') || language.includes('javascript')) {
        if (line.includes('any') && !line.includes('// @ts-ignore')) {
          issues.push({
            line: lineNumber,
            message: 'Avoid using "any" type',
            severity: 'warning'
          });
        }
      }
    });
    
    return issues;
  }

  private generateImprovements(metrics: any, issues: any[]): string[] {
    const improvements: string[] = [];
    
    improvements.push('Add comprehensive unit tests');
    improvements.push('Document complex logic with comments');
    improvements.push('Consider implementing error boundaries');
    improvements.push('Add performance monitoring');
    
    if (issues.filter(i => i.severity === 'error').length > 0) {
      improvements.push('Address critical errors before deployment');
    }
    
    if (metrics.testCoverage === 0) {
      improvements.push('Increase test coverage to at least 80%');
    }
    
    return improvements;
  }

  private extractCodeFromResponse(response: string): string {
    // Extract code from markdown code blocks
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1];
    }
    
    // If no code block, return the response as is
    return response;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

export const aiCodeGenerator = AICodeGenerator.getInstance();
