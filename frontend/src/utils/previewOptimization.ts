// Preview Optimization Utilities for AI Integration

export interface PreviewOptimization {
  autoRetry: boolean;
  debounceMs: number;
  maxRetries: number;
  timeoutMs: number;
  enableHotReload: boolean;
}

export class PreviewOptimizer {
  private static instance: PreviewOptimizer;
  private optimizationCache = new Map<string, PreviewOptimization>();
  private performanceMetrics = {
    sessionCreationTime: [] as number[],
    patchTime: [] as number[],
    errorCount: 0,
    successCount: 0
  };

  static getInstance(): PreviewOptimizer {
    if (!PreviewOptimizer.instance) {
      PreviewOptimizer.instance = new PreviewOptimizer();
    }
    return PreviewOptimizer.instance;
  }

  // Analyze file structure to determine optimal settings
  analyzeProject(files: any[]): PreviewOptimization {
    const fileCount = files.length;
    const hasPackageJson = files.some(f => f.path === 'package.json');
    const hasLargeFiles = files.some(f => f.content && f.content.length > 100000);
    const isReactProject = files.some(f => 
      f.path.endsWith('.jsx') || f.path.endsWith('.tsx') || 
      f.content?.includes('import React')
    );
    const isNodeProject = hasPackageJson || files.some(f => f.path.endsWith('.js') || f.path.endsWith('.ts'));

    // Base optimization
    const optimization: PreviewOptimization = {
      autoRetry: true,
      debounceMs: 800,
      maxRetries: 3,
      timeoutMs: 180000, // 3 minutes
      enableHotReload: true
    };

    // Adjust based on project characteristics
    if (fileCount > 50) {
      optimization.debounceMs = 1200;
      optimization.timeoutMs = 240000; // 4 minutes for large projects
    }

    if (hasLargeFiles) {
      optimization.timeoutMs = 300000; // 5 minutes for projects with large files
      optimization.debounceMs = 1500;
    }

    if (isReactProject) {
      optimization.enableHotReload = true;
      optimization.debounceMs = 600; // Faster for React
    }

    if (isNodeProject && !isReactProject) {
      optimization.timeoutMs = 120000; // 2 minutes for simple Node projects
    }

    // Cache the optimization
    const cacheKey = `${fileCount}-${hasPackageJson}-${hasLargeFiles}-${isReactProject}`;
    this.optimizationCache.set(cacheKey, optimization);

    return optimization;
  }

  // Record performance metrics
  recordMetric(type: 'session' | 'patch' | 'error' | 'success', duration?: number) {
    switch (type) {
      case 'session':
        if (duration) this.performanceMetrics.sessionCreationTime.push(duration);
        break;
      case 'patch':
        if (duration) this.performanceMetrics.patchTime.push(duration);
        break;
      case 'error':
        this.performanceMetrics.errorCount++;
        break;
      case 'success':
        this.performanceMetrics.successCount++;
        break;
    }
  }

  // Get performance insights for AI
  getPerformanceInsights(): string {
    const avgSessionTime = this.performanceMetrics.sessionCreationTime.length > 0
      ? this.performanceMetrics.sessionCreationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.sessionCreationTime.length
      : 0;

    const avgPatchTime = this.performanceMetrics.patchTime.length > 0
      ? this.performanceMetrics.patchTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.patchTime.length
      : 0;

    const errorRate = this.performanceMetrics.errorCount / (this.performanceMetrics.errorCount + this.performanceMetrics.successCount) * 100;

    return `
Preview Performance Insights:
- Average session creation: ${Math.round(avgSessionTime / 1000)}s
- Average patch time: ${Math.round(avgPatchTime)}ms
- Error rate: ${errorRate.toFixed(1)}%
- Total sessions: ${this.performanceMetrics.successCount}
- Total errors: ${this.performanceMetrics.errorCount}
    `.trim();
  }

  // Generate AI-friendly error messages
  generateErrorMessage(error: any, context: any): string {
    const messages: Record<string, string> = {
      'timeout': 'The preview environment is taking longer than expected. This might be due to complex dependencies or high server load. Consider simplifying the code or try again.',
      'unauthorized': 'The CodeSandbox API key is invalid or missing. Please check your environment configuration.',
      'network': 'Network connection issue. Please check your internet connection and try again.',
      'parse': 'There might be a syntax error in your code. Please check the console for details.',
      'default': 'An unexpected error occurred. The system will automatically retry.'
    };

    const errorType = this.detectErrorType(error);
    return messages[errorType] || messages.default;
  }

  private detectErrorType(error: any): 'timeout' | 'unauthorized' | 'network' | 'parse' | 'default' {
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('timeout') || message.includes('aborted')) return 'timeout';
    if (message.includes('unauthorized') || message.includes('401')) return 'unauthorized';
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('parse') || message.includes('json')) return 'parse';
    
    return 'default';
  }

  // Suggest optimizations to AI
  suggestOptimizations(): string[] {
    const suggestions = [];
    
    if (this.performanceMetrics.errorCount > this.performanceMetrics.successCount) {
      suggestions.push('Consider reducing file complexity or breaking down large components.');
    }
    
    const avgSessionTime = this.performanceMetrics.sessionCreationTime.reduce((a, b) => a + b, 0) / this.performanceMetrics.sessionCreationTime.length;
    if (avgSessionTime > 120000) { // 2 minutes
      suggestions.push('Preview initialization is slow. Consider optimizing package.json dependencies.');
    }
    
    return suggestions;
  }

  // Reset metrics
  resetMetrics() {
    this.performanceMetrics = {
      sessionCreationTime: [],
      patchTime: [],
      errorCount: 0,
      successCount: 0
    };
  }
}

// Export singleton instance
export const previewOptimizer = PreviewOptimizer.getInstance();

// Helper function to integrate with AI
export function getPreviewOptimizationContext(files: any[]) {
  const optimizer = PreviewOptimizer.getInstance();
  const optimization = optimizer.analyzeProject(files);
  const insights = optimizer.getPerformanceInsights();
  const suggestions = optimizer.suggestOptimizations();
  
  return {
    optimization,
    insights,
    suggestions,
    recommendations: generateAIRecommendations(optimization, files)
  };
}

function generateAIRecommendations(optimization: PreviewOptimization, files: any[]): string[] {
  const recommendations = [];
  
  // File-based recommendations
  const hasConfigFiles = files.some(f => 
    f.path.endsWith('.config.js') || 
    f.path.endsWith('.config.ts') ||
    f.path.includes('vite') ||
    f.path.includes('webpack')
  );
  
  if (!hasConfigFiles && files.length > 10) {
    recommendations.push('Consider adding a build configuration file to optimize preview performance.');
  }
  
  // Dependency recommendations
  const packageJson = files.find(f => f.path === 'package.json');
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson.content);
      const depCount = Object.keys(pkg.dependencies || {}).length;
      
      if (depCount > 50) {
        recommendations.push('Large number of dependencies detected. Consider removing unused packages to improve preview speed.');
      }
    } catch {}
  }
  
  return recommendations;
}
