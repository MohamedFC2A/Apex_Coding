/**
 * Health check service for verifying API connectivity and configuration
 */

import { apiUrl, getApiBaseUrl } from './apiBase';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  backend: {
    reachable: boolean;
    responding: boolean;
    hasApiKey: boolean;
    errorMessage?: string;
  };
  cors: {
    preflight: boolean;
    requiresProxy: boolean;
  };
  frontend: {
    apiBaseUrl: string;
    expectedUrl: string;
  };
}

/**
 * Perform a simple health check on the backend
 */
export const checkBackendHealth = async (): Promise<HealthCheckResult> => {
  const apiBase = getApiBaseUrl();
  const result: HealthCheckResult = {
    status: 'unhealthy',
    backend: {
      reachable: false,
      responding: false,
      hasApiKey: false
    },
    cors: {
      preflight: false,
      requiresProxy: false
    },
    frontend: {
      apiBaseUrl: apiBase,
      expectedUrl: apiUrl('/')
    }
  };

  // Test root endpoint
  try {
    const rootUrl = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
    const response = await fetch(rootUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(5000)
    });

    result.backend.reachable = true;

    if (response.ok) {
      result.backend.responding = true;
      result.status = 'healthy';
    } else {
      result.backend.errorMessage = `HTTP ${response.status}`;
      result.status = 'degraded';
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    result.backend.errorMessage = msg;

    if (msg.includes('CORS') || msg.includes('cors')) {
      result.cors.preflight = false;
      result.backend.reachable = true; // Server exists but CORS failed
      result.status = 'degraded';
    } else if (msg.includes('fetch') || msg.includes('Failed')) {
      result.cors.requiresProxy = true;
      result.backend.reachable = false;
    }
  }

  // Test CORS preflight for /ai/chat
  try {
    const aiChatUrl = apiUrl('/ai/chat');
    const response = await fetch(aiChatUrl, {
      method: 'OPTIONS',
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(3000)
    });

    result.cors.preflight = response.ok || response.status === 204;
  } catch (err: any) {
    if (String(err).includes('CORS')) {
      result.cors.preflight = false;
      result.status = 'degraded';
    }
  }

  // Determine if backend has API key configured
  // (not foolproof, but helps diagnose)
  if (result.backend.responding) {
    result.backend.hasApiKey = true; // Assume it has key if responding
  }

  if (result.status === 'unhealthy' && result.backend.reachable && result.backend.errorMessage?.includes('403')) {
    result.status = 'degraded';
  }

  return result;
};

/**
 * Get human-readable diagnostic message
 */
export const formatHealthCheckMessage = (result: HealthCheckResult): string => {
  if (result.status === 'healthy') {
    return '✅ API connection is healthy';
  }

  const issues: string[] = [];

  if (!result.backend.reachable) {
    issues.push('❌ Cannot reach backend server');
    issues.push(`   Expected URL: ${result.frontend.apiBaseUrl}`);
    issues.push('   • Check if backend is running (port 3001)');
    issues.push('   • Verify NEXT_PUBLIC_BACKEND_URL is correct');
  }

  if (result.backend.reachable && !result.backend.responding) {
    issues.push('⚠️  Backend is reachable but not responding properly');
    issues.push(`   Error: ${result.backend.errorMessage}`);
  }

  if (!result.cors.preflight) {
    issues.push('⚠️  CORS preflight check failed');
    issues.push('   • Backend might not allow requests from this origin');
    issues.push('   • Check CORS configuration on backend');
  }

  if (!result.backend.hasApiKey) {
    issues.push('⚠️  API key might not be configured');
    issues.push('   • Set DEEPSEEK_API_KEY environment variable');
  }

  return issues.join('\n');
};

/**
 * Suggest fixes based on health check results
 */
export const suggestFixes = (result: HealthCheckResult): string[] => {
  const suggestions: string[] = [];

  if (!result.backend.reachable) {
    suggestions.push('Start the backend: npm run dev');
    suggestions.push('OR set NEXT_PUBLIC_BACKEND_URL to point to a running backend');
  }

  if (!result.cors.preflight && result.backend.reachable) {
    suggestions.push('Update backend CORS configuration to allow requests from http://localhost:5000');
  }

  if (!result.backend.hasApiKey) {
    suggestions.push('Configure DEEPSEEK_API_KEY in backend/.env');
  }

  if (result.cors.requiresProxy) {
    suggestions.push('Consider using a proxy or ensuring backend is accessible');
  }

  return suggestions;
};

export const healthCheckService = {
  checkBackendHealth,
  formatHealthCheckMessage,
  suggestFixes
};
