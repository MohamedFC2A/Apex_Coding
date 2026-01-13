// Advanced Code Analysis Service
export class CodeAnalyzer {
  private static instance: CodeAnalyzer;
  private analysisCache = new Map<string, any>();

  static getInstance(): CodeAnalyzer {
    if (!CodeAnalyzer.instance) {
      CodeAnalyzer.instance = new CodeAnalyzer();
    }
    return CodeAnalyzer.instance;
  }

  // Comprehensive code analysis
  async analyzeFile(content: string, language: string, filePath: string): Promise<{
    metrics: CodeMetrics;
    quality: CodeQuality;
    security: SecurityIssues;
    performance: PerformanceIssues;
    maintainability: MaintainabilityMetrics;
    suggestions: CodeSuggestion[];
  }> {
    const cacheKey = this.hashContent(content + language + filePath);
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    const analysis = {
      metrics: this.calculateMetrics(content, language),
      quality: this.assessQuality(content, language),
      security: this.analyzeSecurity(content, language),
      performance: this.analyzePerformance(content, language),
      maintainability: this.assessMaintainability(content, language),
      suggestions: await this.generateSuggestions(content, language, filePath)
    };

    this.analysisCache.set(cacheKey, analysis);
    return analysis;
  }

  // Analyze entire project
  async analyzeProject(files: Array<{ path: string; content: string; language: string }>): Promise<{
    summary: ProjectSummary;
    files: Array<{ path: string; analysis: any }>;
    recommendations: ProjectRecommendation[];
    debt: TechnicalDebt;
  }> {
    const fileAnalyses = [];
    const totalMetrics = {
      linesOfCode: 0,
      complexity: 0,
      maintainability: 0,
      testCoverage: 0,
      duplicateLines: 0
    };

    for (const file of files) {
      const analysis = await this.analyzeFile(file.content, file.language, file.path);
      fileAnalyses.push({ path: file.path, analysis });
      
      totalMetrics.linesOfCode += analysis.metrics.linesOfCode;
      totalMetrics.complexity += analysis.metrics.cyclomaticComplexity;
      totalMetrics.maintainability += analysis.maintainability.index;
    }

    const avgMaintainability = totalMetrics.maintainability / files.length;
    const avgComplexity = totalMetrics.complexity / files.length;

    return {
      summary: {
        totalFiles: files.length,
        totalLines: totalMetrics.linesOfCode,
        averageComplexity: Math.round(avgComplexity * 100) / 100,
        averageMaintainability: Math.round(avgMaintainability),
        codeQuality: this.calculateOverallQuality(fileAnalyses),
        securityScore: this.calculateSecurityScore(fileAnalyses),
        testCoverage: this.calculateTestCoverage(files)
      },
      files: fileAnalyses,
      recommendations: this.generateProjectRecommendations(fileAnalyses),
      debt: this.calculateTechnicalDebt(fileAnalyses)
    };
  }

  // Detect code smells
  detectCodeSmells(content: string, language: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Long method
    lines.forEach((line, index) => {
      if (line.length > 120) {
        smells.push({
          type: 'long-line',
          line: index + 1,
          message: 'Line exceeds 120 characters',
          severity: 'minor',
          suggestion: 'Break long lines into multiple lines'
        });
      }
    });

    // Deep nesting
    let nestingLevel = 0;
    lines.forEach((line, index) => {
      const openBrackets = (line.match(/{/g) || []).length;
      const closeBrackets = (line.match(/}/g) || []).length;
      nestingLevel += openBrackets - closeBrackets;
      
      if (nestingLevel > 4) {
        smells.push({
          type: 'deep-nesting',
          line: index + 1,
          message: `Deep nesting detected (level ${nestingLevel})`,
          severity: 'major',
          suggestion: 'Extract nested logic into separate functions'
        });
      }
    });

    // Magic numbers
    const magicNumberRegex = /\b(?!1|0|2|10|100)\d{2,}\b/g;
    let match;
    while ((match = magicNumberRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      smells.push({
        type: 'magic-number',
        line: lineNumber,
        message: `Magic number found: ${match[0]}`,
        severity: 'minor',
        suggestion: 'Replace magic numbers with named constants'
      });
    }

    // Large functions
    const functions = this.extractFunctions(content, language);
    functions.forEach(func => {
      if (func.lineCount > 50) {
        smells.push({
          type: 'large-function',
          line: func.startLine,
          message: `Large function detected (${func.lineCount} lines)`,
          severity: 'major',
          suggestion: 'Break down large functions into smaller ones'
        });
      }
    });

    return smells;
  }

  // Find duplicate code
  findDuplicates(files: Array<{ path: string; content: string }>): DuplicateCode[] {
    const duplicates: DuplicateCode[] = [];
    const codeBlocks = new Map<string, string[]>();

    // Extract code blocks (simplified)
    files.forEach(file => {
      const blocks = this.extractCodeBlocks(file.content);
      blocks.forEach(block => {
        const hash = this.hashContent(block);
        if (!codeBlocks.has(hash)) {
          codeBlocks.set(hash, []);
        }
        codeBlocks.get(hash)!.push(file.path);
      });
    });

    // Find duplicates
    codeBlocks.forEach((paths, hash) => {
      if (paths.length > 1) {
        duplicates.push({
          hash,
          files: paths,
          similarity: 100, // Exact match
          lines: 0 // Would need more sophisticated analysis
        });
      }
    });

    return duplicates;
  }

  // Calculate code metrics
  private calculateMetrics(content: string, language: string): CodeMetrics {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    const commentLines = lines.filter(line => this.isCommentLine(line, language));
    
    // Cyclomatic complexity
    const complexityKeywords = this.getComplexityKeywords(language);
    let complexity = 1; // Base complexity
    
    nonEmptyLines.forEach(line => {
      complexityKeywords.forEach(keyword => {
        if (line.includes(keyword)) complexity++;
      });
    });

    // Halstead metrics (simplified)
    const operators = this.extractOperators(content);
    const operands = this.extractOperands(content);
    
    return {
      linesOfCode: nonEmptyLines.length - commentLines.length,
      totalLines: lines.length,
      commentLines: commentLines.length,
      cyclomaticComplexity: complexity,
      halsteadVolume: this.calculateHalsteadVolume(operators, operands),
      halsteadDifficulty: this.calculateHalsteadDifficulty(operators, operands),
      functionCount: this.countFunctions(content, language),
      classCount: this.countClasses(content, language)
    };
  }

  // Assess code quality
  private assessQuality(content: string, language: string): CodeQuality {
    const issues: QualityIssue[] = [];
    let score = 100;

    // Check for TODO/FIXME
    const todoRegex = /(TODO|FIXME|HACK|XXX):/gi;
    let match;
    while ((match = todoRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      issues.push({
        type: 'todo',
        line: lineNumber,
        message: `${match[1]} found`,
        severity: 'info'
      });
      score -= 2;
    }

    // Check for console.log
    const consoleRegex = /console\.(log|debug|info|warn|error)/g;
    while ((match = consoleRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      issues.push({
        type: 'console-log',
        line: lineNumber,
        message: 'Console statement found',
        severity: 'minor'
      });
      score -= 5;
    }

    // Check for unused imports
    const unusedImports = this.findUnusedImports(content, language);
    unusedImports.forEach(imp => {
      issues.push({
        type: 'unused-import',
        line: imp.line,
        message: `Unused import: ${imp.name}`,
        severity: 'minor'
      });
      score -= 3;
    });

    return {
      score: Math.max(0, score),
      grade: this.getGrade(score),
      issues
    };
  }

  // Analyze security issues
  private analyzeSecurity(content: string, language: string): SecurityIssues {
    const vulnerabilities: SecurityVulnerability[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for eval()
    if (content.includes('eval(')) {
      vulnerabilities.push({
        type: 'code-injection',
        line: this.findLineNumber(content, 'eval('),
        description: 'Use of eval() can lead to code injection',
        severity: 'critical',
        recommendation: 'Avoid using eval(), use safer alternatives'
      });
      riskLevel = 'critical';
    }

    // Check for innerHTML
    if (content.includes('innerHTML')) {
      vulnerabilities.push({
        type: 'xss',
        line: this.findLineNumber(content, 'innerHTML'),
        description: 'Direct innerHTML assignment can lead to XSS',
        severity: 'high',
        recommendation: 'Use textContent or sanitize HTML before assignment'
      });
      riskLevel = 'high';
    }

    // Check for hardcoded secrets
    const secretRegex = /(password|secret|key|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi;
    let match;
    while ((match = secretRegex.exec(content)) !== null) {
      vulnerabilities.push({
        type: 'hardcoded-secret',
        line: this.findLineNumber(content, match[0]),
        description: 'Hardcoded secret detected',
        severity: 'high',
        recommendation: 'Use environment variables for secrets'
      });
      riskLevel = 'high';
    }

    // Check for SQL injection patterns
    if (content.includes('SELECT') && content.includes('+')) {
      vulnerabilities.push({
        type: 'sql-injection',
        line: this.findLineNumber(content, 'SELECT'),
        description: 'Potential SQL injection vulnerability',
        severity: 'high',
        recommendation: 'Use parameterized queries or ORM'
      });
      riskLevel = 'high';
    }

    return {
      vulnerabilities,
      riskLevel,
      score: this.calculateSecurityScore(vulnerabilities)
    };
  }

  // Analyze performance issues
  private analyzePerformance(content: string, language: string): PerformanceIssues {
    const issues: PerformanceIssue[] = [];
    let score = 100;

    // Check for inefficient loops
    if (content.includes('for (') && content.includes('.length')) {
      issues.push({
        type: 'inefficient-loop',
        line: this.findLineNumber(content, 'for ('),
        description: 'Loop recalculates length on each iteration',
        impact: 'medium',
        recommendation: 'Cache array length before loop'
      });
      score -= 10;
    }

    // Check for missing React.memo
    if (language.includes('react') && content.includes('export const') && !content.includes('memo')) {
      issues.push({
        type: 'missing-memo',
        line: this.findLineNumber(content, 'export const'),
        description: 'Component not memoized, may re-render unnecessarily',
        impact: 'low',
        recommendation: 'Wrap component in React.memo'
      });
      score -= 5;
    }

    // Check for synchronous operations
    if (content.includes('fs.') || content.includes('readFileSync')) {
      issues.push({
        type: 'blocking-operation',
        line: this.findLineNumber(content, 'fs.'),
        description: 'Synchronous file operation blocks event loop',
        impact: 'high',
        recommendation: 'Use asynchronous file operations'
      });
      score -= 20;
    }

    return {
      issues,
      score: Math.max(0, score)
    };
  }

  // Assess maintainability
  private assessMaintainability(content: string, language: string): MaintainabilityMetrics {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // Calculate maintainability index (simplified)
    const complexity = this.calculateComplexity(content, language);
    const volume = nonEmptyLines.length;
    
    // Maintainability Index (Microsoft formula simplified)
    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(complexity) - 0.23 * complexity - 16.2 * Math.log(volume)
    );

    // Comment ratio
    const commentLines = lines.filter(line => this.isCommentLine(line, language));
    const commentRatio = commentLines.length / nonEmptyLines.length;

    return {
      index: Math.round(maintainabilityIndex),
      grade: this.getMaintainabilityGrade(maintainabilityIndex),
      commentRatio: Math.round(commentRatio * 100),
      duplicationRatio: 0, // Would need duplicate detection
      testCoverage: 0 // Would need test analysis
    };
  }

  // Generate AI-powered suggestions
  private async generateSuggestions(content: string, language: string, filePath: string): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    // Analyze patterns and suggest improvements
    if (this.hasRepeatedCode(content)) {
      suggestions.push({
        type: 'refactor',
        title: 'Extract repeated code',
        description: 'This file contains repeated code patterns that could be extracted into functions',
        priority: 'medium',
        effort: 'low',
        impact: 'improves maintainability',
        example: 'const commonLogic = () => { /* extracted code */ };'
      });
    }

    if (this.hasLargeFunctions(content)) {
      suggestions.push({
        type: 'refactor',
        title: 'Break down large functions',
        description: 'Some functions are too large and should be broken down',
        priority: 'high',
        effort: 'medium',
        impact: 'improves readability and testability',
        example: 'function largeFunction() {\n  const part1 = handlePart1();\n  const part2 = handlePart2();\n  return combine(part1, part2);\n}'
      });
    }

    if (!this.hasErrorHandling(content)) {
      suggestions.push({
        type: 'enhancement',
        title: 'Add error handling',
        description: 'Functions should include proper error handling',
        priority: 'high',
        effort: 'low',
        impact: 'improves reliability',
        example: 'try {\n  // risky operation\n} catch (error) {\n  console.error(error);\n  // handle error\n}'
      });
    }

    if (language.includes('typescript') && !this.hasTypeDefinitions(content)) {
      suggestions.push({
        type: 'enhancement',
        title: 'Add TypeScript types',
        description: 'Add explicit type definitions for better type safety',
        priority: 'medium',
        effort: 'low',
        impact: 'improves type safety',
        example: 'interface UserData {\n  id: string;\n  name: string;\n}'
      });
    }

    return suggestions;
  }

  // Helper methods
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private isCommentLine(line: string, language: string): boolean {
    const trimmed = line.trim();
    if (language.includes('javascript') || language.includes('typescript')) {
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    }
    if (language === 'python') {
      return trimmed.startsWith('#');
    }
    if (language.includes('css')) {
      return trimmed.startsWith('/*');
    }
    return false;
  }

  private getComplexityKeywords(language: string): string[] {
    if (language.includes('javascript') || language.includes('typescript')) {
      return ['if', 'else', 'while', 'for', '&&', '||', 'case', 'catch', '?'];
    }
    if (language === 'python') {
      return ['if', 'elif', 'else', 'while', 'for', 'and', 'or', 'except', 'try'];
    }
    return [];
  }

  private extractOperators(content: string): string[] {
    return content.match(/[+\-*/%=<>!&|^~?:]/g) || [];
  }

  private extractOperands(content: string): string[] {
    return content.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b|\b\d+(\.\d+)?\b/g) || [];
  }

  private calculateHalsteadVolume(operators: string[], operands: string[]): number {
    const n1 = operators.length;
    const n2 = operands.length;
    const N1 = operators.length;
    const N2 = operands.length;
    
    const vocabulary = n1 + n2;
    const length = N1 + N2;
    
    return length * Math.log2(vocabulary);
  }

  private calculateHalsteadDifficulty(operators: string[], operands: string[]): number {
    const n1 = operators.length;
    const n2 = operands.length;
    const N2 = operands.length;
    
    return (n1 / 2) * (N2 / n2);
  }

  private extractFunctions(content: string, language: string): Array<{ name: string; startLine: number; lineCount: number }> {
    const functions: Array<{ name: string; startLine: number; lineCount: number }> = [];
    const lines = content.split('\n');
    
    if (language.includes('javascript') || language.includes('typescript')) {
      const funcRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const name = match[1] || match[2];
        const startLine = content.substring(0, match.index).split('\n').length;
        functions.push({ name, startLine, lineCount: 0 });
      }
    }
    
    return functions;
  }

  private countFunctions(content: string, language: string): number {
    return this.extractFunctions(content, language).length;
  }

  private countClasses(content: string, language: string): number {
    if (language.includes('typescript') || language.includes('javascript')) {
      const matches = content.match(/class\s+\w+/g);
      return matches ? matches.length : 0;
    }
    return 0;
  }

  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private getMaintainabilityGrade(index: number): 'excellent' | 'good' | 'moderate' | 'poor' | 'very-poor' {
    if (index >= 85) return 'excellent';
    if (index >= 70) return 'good';
    if (index >= 50) return 'moderate';
    if (index >= 30) return 'poor';
    return 'very-poor';
  }

  private findLineNumber(content: string, searchString: string): number {
    const index = content.indexOf(searchString);
    return index >= 0 ? content.substring(0, index).split('\n').length : 0;
  }

  private findUnusedImports(content: string, language: string): Array<{ name: string; line: number }> {
    // Simplified implementation
    return [];
  }

  private calculateSecurityScore(vulnerabilities: SecurityVulnerability[]): number {
    let score = 100;
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score -= 40; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });
    return Math.max(0, score);
  }

  private calculateComplexity(content: string, language: string): number {
    const keywords = this.getComplexityKeywords(language);
    let complexity = 1;
    
    keywords.forEach(keyword => {
      const matches = content.match(new RegExp(keyword, 'g'));
      if (matches) complexity += matches.length;
    });
    
    return complexity;
  }

  private extractCodeBlocks(content: string): string[] {
    // Simplified - extract functions, classes, etc.
    const blocks: string[] = [];
    const lines = content.split('\n');
    let currentBlock = '';
    
    lines.forEach(line => {
      if (line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')) {
        currentBlock += line + '\n';
      } else if (currentBlock) {
        if (currentBlock.length > 50) {
          blocks.push(currentBlock.trim());
        }
        currentBlock = '';
      }
    });
    
    return blocks;
  }

  private hasRepeatedCode(content: string): boolean {
    // Simplified check
    const lines = content.split('\n');
    const lineMap = new Map<string, number>();
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length > 10) {
        lineMap.set(trimmed, (lineMap.get(trimmed) || 0) + 1);
      }
    });
    
    return Array.from(lineMap.values()).some(count => count > 2);
  }

  private hasLargeFunctions(content: string): boolean {
    const functions = this.extractFunctions(content, 'typescript');
    return functions.some(func => func.lineCount > 30);
  }

  private hasErrorHandling(content: string): boolean {
    return content.includes('try') && content.includes('catch');
  }

  private hasTypeDefinitions(content: string): boolean {
    return content.includes('interface ') || content.includes('type ');
  }

  private calculateOverallQuality(analyses: Array<{ analysis: any }>): number {
    const totalScore = analyses.reduce((sum, { analysis }) => sum + analysis.quality.score, 0);
    return Math.round(totalScore / analyses.length);
  }

  private calculateSecurityScore(analyses: Array<{ analysis: any }>): number {
    const totalScore = analyses.reduce((sum, { analysis }) => sum + analysis.security.score, 0);
    return Math.round(totalScore / analyses.length);
  }

  private calculateTestCoverage(files: Array<{ path: string; content: string; language: string }>): number {
    const testFiles = files.filter(file => 
      file.path.includes('.test.') || 
      file.path.includes('.spec.') ||
      file.path.includes('__tests__')
    );
    
    return Math.round((testFiles.length / files.length) * 100);
  }

  private generateProjectRecommendations(analyses: Array<{ path: string; analysis: any }>): ProjectRecommendation[] {
    const recommendations: ProjectRecommendation[] = [];
    
    // Analyze common issues across files
    const commonIssues = this.findCommonIssues(analyses);
    
    commonIssues.forEach(issue => {
      recommendations.push({
        type: 'improvement',
        title: `Address ${issue.type}`,
        description: issue.description,
        priority: 'high',
        affectedFiles: issue.files,
        estimatedEffort: issue.effort
      });
    });
    
    return recommendations;
  }

  private findCommonIssues(analyses: Array<{ path: string; analysis: any }>): any[] {
    // Simplified implementation
    return [];
  }

  private calculateTechnicalDebt(analyses: Array<{ path: string; analysis: any }>): TechnicalDebt {
    const totalHours = analyses.reduce((sum, { analysis }) => {
      const complexity = analysis.metrics.cyclomaticComplexity;
      const maintainability = analysis.maintainability.index;
      
      // Simplified debt calculation
      let debt = 0;
      if (complexity > 10) debt += (complexity - 10) * 0.5;
      if (maintainability < 50) debt += (50 - maintainability) * 0.3;
      
      return sum + debt;
    }, 0);
    
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      cost: Math.round(totalHours * 100), // Assuming $100/hour
      priority: totalHours > 40 ? 'high' : totalHours > 20 ? 'medium' : 'low'
    };
  }
}

// Type definitions
interface CodeMetrics {
  linesOfCode: number;
  totalLines: number;
  commentLines: number;
  cyclomaticComplexity: number;
  halsteadVolume: number;
  halsteadDifficulty: number;
  functionCount: number;
  classCount: number;
}

interface CodeQuality {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: QualityIssue[];
}

interface QualityIssue {
  type: string;
  line: number;
  message: string;
  severity: 'info' | 'minor' | 'major' | 'critical';
}

interface SecurityIssues {
  vulnerabilities: SecurityVulnerability[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

interface SecurityVulnerability {
  type: string;
  line: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

interface PerformanceIssues {
  issues: PerformanceIssue[];
  score: number;
}

interface PerformanceIssue {
  type: string;
  line: number;
  description: string;
  impact: 'low' | 'medium' | 'high';
  recommendation: string;
}

interface MaintainabilityMetrics {
  index: number;
  grade: 'excellent' | 'good' | 'moderate' | 'poor' | 'very-poor';
  commentRatio: number;
  duplicationRatio: number;
  testCoverage: number;
}

interface CodeSuggestion {
  type: 'refactor' | 'enhancement' | 'optimization';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: string;
  example: string;
}

interface CodeSmell {
  type: string;
  line: number;
  message: string;
  severity: 'minor' | 'major' | 'critical';
  suggestion: string;
}

interface DuplicateCode {
  hash: string;
  files: string[];
  similarity: number;
  lines: number;
}

interface ProjectSummary {
  totalFiles: number;
  totalLines: number;
  averageComplexity: number;
  averageMaintainability: number;
  codeQuality: number;
  securityScore: number;
  testCoverage: number;
}

interface ProjectRecommendation {
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  affectedFiles: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

interface TechnicalDebt {
  totalHours: number;
  cost: number;
  priority: 'low' | 'medium' | 'high';
}

export const codeAnalyzer = CodeAnalyzer.getInstance();
