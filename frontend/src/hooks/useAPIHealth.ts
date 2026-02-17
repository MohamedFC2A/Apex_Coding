/**
 * API Integration Hook for managing API state and errors
 * Provides connection monitoring and helpful error messages
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { healthCheckService } from '@/services/healthCheck';
import { apiErrorService } from '@/services/apiErrorHandler';

export interface APIState {
  isHealthy: boolean;
  isChecking: boolean;
  error: string | null;
  suggestions: string[];
  lastCheckTime: number | null;
}

const initialState: APIState = {
  isHealthy: false,
  isChecking: false,
  error: null,
  suggestions: [],
  lastCheckTime: null
};

/**
 * Hook to monitor API health and provide diagnostics
 */
export const useAPIHealth = () => {
  const [state, setState] = useState<APIState>(initialState);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCheckRef = useRef<number>(0);

  const checkHealth = useCallback(async (force = false) => {
    const now = Date.now();
    // Don't check more than once per 30 seconds unless forced
    if (!force && lastCheckRef.current && now - lastCheckRef.current < 30000) {
      return;
    }

    lastCheckRef.current = now;
    setState(prev => ({ ...prev, isChecking: true }));

    try {
      const result = await healthCheckService.checkBackendHealth();
      const isHealthy = result.status === 'healthy';
      const message = healthCheckService.formatHealthCheckMessage(result);
      const suggestions = healthCheckService.suggestFixes(result);

      setState({
        isHealthy,
        isChecking: false,
        error: isHealthy ? null : message,
        suggestions,
        lastCheckTime: now
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isHealthy: false,
        isChecking: false,
        error: 'Failed to check API health',
        lastCheckTime: now
      }));
    }
  }, []);

  // Initial health check on mount
  useEffect(() => {
    const timer = setTimeout(() => checkHealth(true), 1000);
    return () => clearTimeout(timer);
  }, [checkHealth]);

  // Periodic health checks
  useEffect(() => {
    checkTimeoutRef.current = setTimeout(() => {
      checkHealth();
    }, 30000);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [checkHealth]);

  return {
    ...state,
    checkHealth
  };
};

/**
 * Hook for handling API request errors with helpful messages
 */
export const useAPIErrorHandler = () => {
  const handleFetchError = useCallback((error: unknown) => {
    const apiError = apiErrorService.parseFetchError(error);
    return {
      code: apiError.code,
      message: apiError.message,
      userMessage: apiErrorService.formatErrorForUser(apiError),
      suggestions: apiError.suggestions
    };
  }, []);

  const handleHTTPStatusError = useCallback(async (response: Response) => {
    const apiError = await apiErrorService.handleAPIError(response);
    return {
      code: apiError.code,
      message: apiError.message,
      userMessage: apiErrorService.formatErrorForUser(apiError),
      status: apiError.status,
      suggestions: apiError.suggestions
    };
  }, []);

  return {
    handleFetchError,
    handleHTTPStatusError
  };
};

/**
 * Validate input before making API request
 */
export const validateAPIInput = (prompt: string): { valid: boolean; error?: string } => {
  if (!prompt) {
    return {
      valid: false,
      error: 'Please enter a prompt or request'
    };
  }

  if (typeof prompt !== 'string') {
    return {
      valid: false,
      error: 'Prompt must be text'
    };
  }

  if (prompt.trim().length === 0) {
    return {
      valid: false,
      error: 'Prompt cannot be empty'
    };
  }

  if (prompt.length > 80000) {
    return {
      valid: false,
      error: 'Prompt is too long (maximum 80,000 characters)'
    };
  }

  return { valid: true };
};

/**
 * Wrapper function to safely make API requests with validation and error handling
 */
export const safeFetchAPI = async (
  url: string,
  options?: RequestInit,
  validateFn?: (input: any) => { valid: boolean; error?: string }
) => {
  // Validate input first
  if (options?.body) {
    const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    const bodyObj = JSON.parse(bodyStr);

    if (validateFn) {
      const validation = validateFn(bodyObj);
      if (!validation.valid) {
        return {
          ok: false,
          error: validation.error,
          code: 'VALIDATION_ERROR'
        };
      }
    }
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const apiError = await apiErrorService.handleAPIError(response);
      return {
        ok: false,
        error: apiError.message,
        code: apiError.code,
        status: apiError.status,
        suggestions: apiError.suggestions
      };
    }

    return {
      ok: true,
      response
    };
  } catch (err) {
    const error = apiErrorService.parseFetchError(err);
    return {
      ok: false,
      error: error.message,
      code: error.code,
      suggestions: error.suggestions
    };
  }
};
