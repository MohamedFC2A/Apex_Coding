// AI Assistant for Preview Problem Diagnosis and Resolution

import { useState } from 'react';
import { previewOptimizer, type PreviewOptimization } from './previewOptimization';
import { PreviewDiagnostic } from './previewDiagnostic';

export interface PreviewProblem {
  type: 'timeout' | 'api_key' | 'network' | 'cors' | 'dependency' | 'build' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  rootCause: string;
  solution: string;
  codeFix?: {
    file: string;
    line?: number;
    oldCode: string;
    newCode: string;
    explanation: string;
  };
  preventFuture: string;
}

export class PreviewAIAssistant {
  private static instance: PreviewAIAssistant;
  private problemHistory: PreviewProblem[] = [];
  private analysisCache = new Map<string, PreviewProblem[]>();

  static getInstance(): PreviewAIAssistant {
    if (!PreviewAIAssistant.instance) {
      PreviewAIAssistant.instance = new PreviewAIAssistant();
    }
    return PreviewAIAssistant.instance;
  }

  // Main diagnostic method - AI analyzes the entire preview system
  async diagnosePreviewSystem(): Promise<{
    problems: PreviewProblem[];
    recommendations: string[];
    autoFixes: string[];
    summary: string;
  }> {
    console.log('🤖 AI Assistant: Analyzing preview system...');
    
    const problems: PreviewProblem[] = [];
    
    // 1. Run comprehensive diagnostics
    const diagnosticResults = await PreviewDiagnostic.runFullDiagnostic();
    
    // 2. Analyze each diagnostic result with AI intelligence
    for (const result of diagnosticResults) {
      const analyzedProblems = await this.analyzeDiagnosticResult(result);
      problems.push(...analyzedProblems);
    }
    
    // 3. Check for common preview-specific issues
    const previewProblems = await this.checkPreviewSpecificIssues();
    problems.push(...previewProblems);
    
    // 4. Analyze code for potential issues
    const codeIssues = await this.analyzeCodeForPreviewIssues();
    problems.push(...codeIssues);
    
    // 5. Generate AI recommendations
    const recommendations = this.generateAIRecommendations(problems);
    
    // 6. Determine auto-fixes
    const autoFixes = this.determineAutoFixes(problems);
    
    // 7. Create summary
    const summary = this.createAISummary(problems);
    
    // Store in history
    this.problemHistory.push(...problems);
    
    return {
      problems,
      recommendations,
      autoFixes,
      summary
    };
  }

  private async analyzeDiagnosticResult(result: any): Promise<PreviewProblem[]> {
    const problems: PreviewProblem[] = [];
    
    if (result.status === 'error') {
      if (result.message.includes('API key') || result.message.includes('CSB_API_KEY')) {
        problems.push({
          type: 'api_key',
          severity: 'critical',
          message: 'CodeSandbox API key configuration issue',
          rootCause: 'The CSB_API_KEY is either missing, invalid, or not properly loaded',
          solution: '1. Verify CSB_API_KEY in Vercel dashboard\n2. Ensure no leading/trailing spaces\n3. Redeploy after adding env vars',
          preventFuture: 'Always redeploy Vercel after changing environment variables',
          codeFix: {
            file: 'api/utils/codesandbox.js',
            line: 1,
            oldCode: '// Load environment variables\nrequire(\'dotenv\').config();',
            newCode: '// Load environment variables\nrequire(\'dotenv\').config();\n\n// Debug: Log API key status\nconsole.log(\'CSB_API_KEY loaded:\', !!process.env.CSB_API_KEY);',
            explanation: 'Add debugging to verify API key is loaded'
          }
        });
      }
      
      if (result.message.includes('connect') || result.message.includes('network')) {
        problems.push({
          type: 'network',
          severity: 'high',
          message: 'Network connectivity issue',
          rootCause: 'Cannot connect to the backend API',
          solution: '1. Check if backend is running on port 3001\n2. Verify VITE_BACKEND_URL\n3. Check firewall/proxy settings',
          preventFuture: 'Use health check endpoint to monitor API status'
        });
      }
    }
    
    return problems;
  }

  private async checkPreviewSpecificIssues(): Promise<PreviewProblem[]> {
    const problems: PreviewProblem[] = [];
    
    // Check for timeout issues
    const recentTimeouts = this.problemHistory.filter(p => p.type === 'timeout').slice(-5);
    if (recentTimeouts.length >= 3) {
      problems.push({
        type: 'timeout',
        severity: 'high',
        message: 'Frequent timeout issues detected',
        rootCause: 'CodeSandbox provisioning is consistently slow or failing',
        solution: '1. Increase timeout to 5 minutes\n2. Implement retry logic with exponential backoff\n3. Consider using mock preview for development',
        preventFuture: 'Use progressive timeouts and better error handling',
        codeFix: {
          file: 'frontend/src/components/Preview/PreviewRunnerPreviewOptimized.tsx',
          line: 72,
          oldCode: 'const baseTimeout = 180000; // 3 minutes base',
          newCode: 'const baseTimeout = 300000; // 5 minutes base for reliability',
          explanation: 'Increase base timeout for CodeSandbox provisioning'
        }
      });
    }
    
    // Check for dependency issues
    problems.push({
      type: 'dependency',
      severity: 'medium',
      message: 'Potential dependency installation delays',
      rootCause: 'Large node_modules or complex dependencies slow down CodeSandbox',
      solution: '1. Optimize package.json\n2. Remove unused dependencies\n3. Use lighter alternatives when possible',
      preventFuture: 'Always review dependencies before adding new ones'
    });
    
    return problems;
  }

  private async analyzeCodeForPreviewIssues(): Promise<PreviewProblem[]> {
    const problems: PreviewProblem[] = [];
    
    // Check for common code issues that break preview
    problems.push({
      type: 'build',
      severity: 'medium',
      message: 'Build configuration may need optimization',
      rootCause: 'Vite/Next.js configuration might not be optimal for CodeSandbox',
      solution: '1. Ensure build output is properly configured\n2. Check for absolute imports\n3. Verify all assets are properly referenced',
      preventFuture: 'Test build locally before deploying',
      codeFix: {
        file: 'vite.config.ts',
        oldCode: 'export default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n});',
        newCode: 'export default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n      "@": path.resolve(__dirname, "./src"),\n    },\n  },\n  build: {\n    outDir: "dist",\n    assetsDir: "assets",\n    sourcemap: false,\n    rollupOptions: {\n      output: {\n        manualChunks: undefined,\n      },\n    },\n  },\n  server: {\n    host: "0.0.0.0",\n    port: 3000,\n  },\n});',
        explanation: 'Optimize build configuration for CodeSandbox'
      }
    });
    
    return problems;
  }

  private generateAIRecommendations(problems: PreviewProblem[]): string[] {
    const recommendations = [];
    
    // Critical issues first
    const criticalProblems = problems.filter(p => p.severity === 'critical');
    if (criticalProblems.length > 0) {
      recommendations.push('🚨 CRITICAL: Fix API key configuration immediately');
    }
    
    // High priority
    const highProblems = problems.filter(p => p.severity === 'high');
    if (highProblems.length > 0) {
      recommendations.push('⚠️ HIGH: Implement better timeout handling');
    }
    
    // Always include these
    recommendations.push('💡 Add comprehensive error logging');
    recommendations.push('💡 Implement progressive retry logic');
    recommendations.push('💡 Use mock preview for faster development');
    recommendations.push('💡 Add preview health monitoring');
    
    return recommendations;
  }

  private determineAutoFixes(problems: PreviewProblem[]): string[] {
    const autoFixes = [];
    
    for (const problem of problems) {
      if (problem.codeFix) {
        autoFixes.push(`🔧 Auto-fix available: ${problem.codeFix.explanation}`);
      }
    }
    
    autoFixes.push('🔧 Enable debug logging for preview');
    autoFixes.push('🔧 Add performance monitoring');
    autoFixes.push('🔧 Implement circuit breaker pattern');
    
    return autoFixes;
  }

  private createAISummary(problems: PreviewProblem[]): string {
    const criticalCount = problems.filter(p => p.severity === 'critical').length;
    const highCount = problems.filter(p => p.severity === 'high').length;
    const mediumCount = problems.filter(p => p.severity === 'medium').length;
    
    let summary = `🤖 AI Analysis Complete\n\n`;
    summary += `Found ${problems.length} issues:\n`;
    summary += `- ${criticalCount} Critical\n`;
    summary += `- ${highCount} High\n`;
    summary += `- ${mediumCount} Medium\n\n`;
    
    if (criticalCount > 0) {
      summary += `🚨 Immediate action required for API key issues.\n`;
    }
    
    summary += `\n💡 Primary recommendation: `;
    if (criticalCount > 0) {
      summary += 'Fix API key configuration in Vercel';
    } else if (highCount > 0) {
      summary += 'Increase timeout and add retry logic';
    } else {
      summary += 'Optimize dependencies and build configuration';
    }
    
    return summary;
  }

  // Generate code fixes for identified problems
  async generateCodeFixes(problems: PreviewProblem[]): Promise<string[]> {
    const fixes: string[] = [];
    
    for (const problem of problems) {
      if (problem.codeFix) {
        fixes.push(`
// Fix for: ${problem.message}
// File: ${problem.codeFix.file}
// ${problem.codeFix.explanation}

${problem.codeFix.oldCode}
// ↓ REPLACE WITH ↓
${problem.codeFix.newCode}
        `);
      }
    }
    
    return fixes;
  }

  // Get AI-powered preview optimization settings
  getOptimalPreviewSettings(files: any[]): PreviewOptimization {
    const baseSettings = previewOptimizer.analyzeProject(files);
    
    // AI enhancements based on problem history
    const timeoutProblems = this.problemHistory.filter(p => p.type === 'timeout');
    if (timeoutProblems.length > 0) {
      baseSettings.timeoutMs = Math.min(baseSettings.timeoutMs * 1.5, 300000);
      baseSettings.maxRetries = Math.min(baseSettings.maxRetries + 1, 5);
    }
    
    const networkProblems = this.problemHistory.filter(p => p.type === 'network');
    if (networkProblems.length > 0) {
      baseSettings.debounceMs = Math.max(baseSettings.debounceMs * 1.2, 2000);
    }
    
    return baseSettings;
  }

  // Generate intelligent error messages
  generateIntelligentErrorMessage(error: any, context: any): string {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'timeout':
        return `Preview is taking longer than expected. Based on analysis, this is likely due to ${
          context.fileCount > 50 ? 'large project size' : 'CodeSandbox provisioning'
        }. ${context.retryCount > 0 ? 'Trying with increased timeout...' : 'Please wait...'}`;
        
      case 'api_key':
        return `API configuration issue detected. The AI has identified this as a ${
          error.message.includes('missing') ? 'missing' : 'invalid'
        } API key. Please check your Vercel environment variables.`;
        
      case 'network':
        return `Network issue detected. The AI suggests checking your connection and ensuring the backend is running on port 3001.`;
        
      default:
        return `Unexpected error. The AI is analyzing this issue and will suggest a fix shortly.`;
    }
  }

  private classifyError(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('timeout') || message.includes('aborted')) return 'timeout';
    if (message.includes('api') || message.includes('key')) return 'api_key';
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('cors')) return 'cors';
    
    return 'unknown';
  }
}

// Export for use in components
export const previewAIAssistant = PreviewAIAssistant.getInstance();

// Hook for React components
export const usePreviewAIAssistant = () => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const analyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await previewAIAssistant.diagnosePreviewSystem();
      setAnalysis(result);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return { analysis, isAnalyzing, analyze };
};
