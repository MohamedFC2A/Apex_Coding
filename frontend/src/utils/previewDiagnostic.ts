// Preview Diagnostic Tool for Troubleshooting

export interface DiagnosticResult {
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  fix?: string;
}

export class PreviewDiagnostic {
  static async runFullDiagnostic(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    // 1. Check API connectivity
    results.push(await this.checkApiConnectivity());
    
    // 2. Check CodeSandbox configuration
    results.push(await this.checkCodeSandboxConfig());
    
    // 3. Check environment variables
    results.push(this.checkEnvironmentVariables());
    
    // 4. Check CORS configuration
    results.push(this.checkCorsConfiguration());
    
    // 5. Check rate limiting
    results.push(await this.checkRateLimiting());
    
    return results;
  }
  
  private static async checkApiConnectivity(): Promise<DiagnosticResult> {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'success',
          message: 'API is accessible',
          details: data
        };
      } else {
        return {
          status: 'error',
          message: `API returned status ${response.status}`,
          fix: 'Check if the backend server is running on port 3001'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: 'Cannot connect to API',
        details: error,
        fix: 'Ensure the backend server is running and VITE_BACKEND_URL is correct'
      };
    }
  }
  
  private static async checkCodeSandboxConfig(): Promise<DiagnosticResult> {
    try {
      const response = await fetch('/api/preview/config', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const config = await response.json();
        
        if (config.configured) {
          return {
            status: 'success',
            message: 'CodeSandbox is properly configured',
            details: {
              provider: config.provider,
              tokenPresent: config.tokenPresent,
              tokenLast4: config.tokenLast4
            }
          };
        } else {
          return {
            status: 'error',
            message: 'CodeSandbox API key is not configured',
            details: {
              missing: config.missing,
              tokenPresent: config.tokenPresent
            },
            fix: 'Set CSB_API_KEY in your .env file or Vercel environment variables'
          };
        }
      } else {
        return {
          status: 'error',
          message: 'Failed to check CodeSandbox configuration',
          fix: 'Check API server logs for details'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: 'Cannot check CodeSandbox configuration',
        details: error,
        fix: 'Ensure the backend server is running'
      };
    }
  }
  
  private static checkEnvironmentVariables(): DiagnosticResult {
    const issues: string[] = [];
    
    // Check frontend env vars
    if (!import.meta.env.VITE_BACKEND_URL) {
      issues.push('VITE_BACKEND_URL is not set');
    }
    
    // Check if backend URL is accessible
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) {
        issues.push('VITE_BACKEND_URL is not set');
      } else {
        const url = new URL(backendUrl);
        if (url.hostname === 'localhost' && window.location.hostname !== 'localhost') {
          issues.push('Using localhost backend URL from non-localhost frontend');
        }
      }
    } catch {
      issues.push('VITE_BACKEND_URL is not a valid URL');
    }
    
    if (issues.length > 0) {
      return {
        status: 'error',
        message: 'Environment variable issues detected',
        details: issues,
        fix: 'Check your .env file and ensure all required variables are set'
      };
    }
    
    return {
      status: 'success',
      message: 'Environment variables are properly configured'
    };
  }
  
  private static checkCorsConfiguration(): DiagnosticResult {
    // This is a client-side check - actual CORS is server-side
    const currentOrigin = window.location.origin;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    
    try {
      if (!backendUrl) {
        return {
          status: 'error',
          message: 'Backend URL is not configured',
          fix: 'Check VITE_BACKEND_URL in your .env file'
        };
      }
      
      const backend = new URL(backendUrl);
      const isSameOrigin = currentOrigin === backend.origin;
      const isLocalhost = currentOrigin.includes('localhost') && backend.hostname.includes('localhost');
      
      if (isSameOrigin || isLocalhost) {
        return {
          status: 'success',
          message: 'CORS should not be an issue for current configuration'
        };
      } else {
        return {
          status: 'warning',
          message: 'Cross-origin request detected',
          details: {
            frontend: currentOrigin,
            backend: backend.origin
          },
          fix: 'Ensure the backend allows requests from your frontend origin'
        };
      }
    } catch {
      return {
        status: 'error',
        message: 'Invalid backend URL for CORS check',
        fix: 'Check VITE_BACKEND_URL in your .env file'
      };
    }
  }
  
  private static async checkRateLimiting(): Promise<DiagnosticResult> {
    try {
      const response = await fetch('/api/preview/config', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const rateLimitHeaders = {
        limit: response.headers.get('X-RateLimit-Limit'),
        remaining: response.headers.get('X-RateLimit-Remaining'),
        reset: response.headers.get('X-RateLimit-Reset')
      };
      
      return {
        status: 'success',
        message: 'Rate limiting information retrieved',
        details: rateLimitHeaders
      };
    } catch {
      return {
        status: 'warning',
        message: 'Could not check rate limiting status',
        fix: 'This is not critical but check server logs if issues persist'
      };
    }
  }
  
  // Generate a helpful report
  static generateReport(results: DiagnosticResult[]): string {
    const report = ['🔍 Preview Diagnostic Report\n'];
    
    const errors = results.filter(r => r.status === 'error');
    const warnings = results.filter(r => r.status === 'warning');
    const successes = results.filter(r => r.status === 'success');
    
    if (errors.length === 0 && warnings.length === 0) {
      report.push('✅ All checks passed! Your preview should work correctly.');
    } else {
      if (errors.length > 0) {
        report.push(`\n❌ ${errors.length} Error(s):`);
        errors.forEach(r => {
          report.push(`  • ${r.message}`);
          if (r.fix) report.push(`    Fix: ${r.fix}`);
        });
      }
      
      if (warnings.length > 0) {
        report.push(`\n⚠️ ${warnings.length} Warning(s):`);
        warnings.forEach(r => {
          report.push(`  • ${r.message}`);
          if (r.fix) report.push(`    Fix: ${r.fix}`);
        });
      }
      
      report.push(`\n✅ ${successes.length} Check(s) passed`);
    }
    
    report.push('\n📋 Quick Fixes:');
    report.push('1. Restart your development server');
    report.push('2. Check .env file for CSB_API_KEY');
    report.push('3. Ensure backend is running on port 3001');
    report.push('4. Clear browser cache and reload');
    
    return report.join('\n');
  }
}

// Export for use in components
export const runPreviewDiagnostic = () => {
  console.log('🔍 Running preview diagnostic...');
  PreviewDiagnostic.runFullDiagnostic().then(results => {
    const report = PreviewDiagnostic.generateReport(results);
    console.log(report);
    return results;
  });
};
