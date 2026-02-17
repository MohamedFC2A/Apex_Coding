/**
 * Error boundary and diagnostics service for API failures
 * Helps debug and display meaningful error messages when API calls fail
 */

export interface APIError {
  code: string;
  message: string;
  status?: number;
  originalError?: Error;
  suggestions?: string[];
}

/**
 * Parse fetch errors and provide diagnostic information
 */
export const parseFetchError = (error: unknown): APIError => {
  // Network error (no response from server)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the API endpoint. Check if the backend server is running.',
      suggestions: [
        'Verify backend is running on port 3001',
        'Check NEXT_PUBLIC_BACKEND_URL environment variable',
        'Ensure firewall allows localhost:3001',
        'Try refreshing the page and trying again'
      ]
    };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('aborted') || msg.includes('abort')) {
      return {
        code: 'REQUEST_ABORTED',
        message: 'Request was cancelled. This usually happens due to timeout or user action.',
        suggestions: ['Try again', 'Check your internet connection']
      };
    }

    if (msg.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Request took too long to complete.',
        suggestions: [
          'The AI service might be slow',
          'Try a shorter prompt',
          'Wait a moment and try again'
        ]
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      originalError: error
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error)
  };
};

/**
 * Parse HTTP error responses
 */
export const parseHTTPError = (status: number, responseText: string): APIError => {
  const suggestions: string[] = [];

  switch (status) {
    case 400:
      return {
        code: 'BAD_REQUEST',
        message: 'Invalid request. Check your input and try again.',
        status,
        suggestions: ['Verify all required fields are filled', 'Check input format']
      };

    case 401:
      return {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed. Check API credentials.',
        status,
        suggestions: [
          'Verify API key is valid',
          'Check DEEPSEEK_API_KEY environment variable',
          'Contact support if credentials are correct'
        ]
      };

    case 403:
      return {
        code: 'FORBIDDEN',
        message: 'Access denied. Your request was rejected by the server.',
        status,
        suggestions: [
          'Check CORS settings',
          'Verify frontend origin is allowed',
          'Check backend configuration'
        ]
      };

    case 404:
      return {
        code: 'NOT_FOUND',
        message: 'API endpoint not found. The backend might be misconfigured.',
        status,
        suggestions: [
          'Verify backend URL is correct',
          'Check API routes are properly configured',
          'Ensure backend is running'
        ]
      };

    case 429:
      return {
        code: 'RATE_LIMITED',
        message: 'Too many requests. You have hit the rate limit.',
        status,
        suggestions: ['Wait a moment before trying again', 'Try with a shorter prompt']
      };

    case 500:
      return {
        code: 'SERVER_ERROR',
        message: 'Internal server error. The backend encountered an error.',
        status,
        suggestions: [
          'Check backend logs for details',
          'Verify all environment variables are set',
          'Try refreshing and try again'
        ]
      };

    case 502:
      return {
        code: 'BAD_GATEWAY',
        message: 'Bad gateway. The backend server is unavailable.',
        status,
        suggestions: [
          'Check if backend server is running',
          'Wait a moment and try again',
          'Check network connectivity'
        ]
      };

    case 503:
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Backend service is temporarily unavailable.',
        status,
        suggestions: [
          'Wait for the service to be available',
          'Check if there is scheduled maintenance',
          'Try again in a few moments'
        ]
      };

    case 504:
      return {
        code: 'GATEWAY_TIMEOUT',
        message: 'Request took too long. The AI service is slow or offline.',
        status,
        suggestions: [
          'Try a shorter prompt',
          'Wait a moment and try again',
          'Check AI service status (DeepSeek)'
        ]
      };

    default:
      return {
        code: 'HTTP_ERROR',
        message: `HTTP Error ${status}. ${responseText || 'Unknown error'}`,
        status,
        suggestions: ['Check backend logs', 'Verify API configuration']
      };
  }
};

/**
 * Main error handler for API calls
 */
export const handleAPIError = async (response: Response): Promise<APIError> => {
  let text = '';
  try {
    text = await response.text();
  } catch {
    text = '';
  }

  // Try to parse as JSON error response
  try {
    const json = JSON.parse(text);
    if (json.error) {
      return {
        code: 'API_ERROR',
        message: json.error,
        status: response.status,
        suggestions: ['Check API configuration', 'Verify backend is running']
      };
    }
  } catch {
    // Not JSON, treat as plain text
  }

  return parseHTTPError(response.status, text);
};

/**
 * Wrapper for fetch that includes better error handling
 */
export const fetchWithErrorHandling = async (
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; response: Response; error?: APIError }> => {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await handleAPIError(response);
      return { ok: false, response, error };
    }

    return { ok: true, response };
  } catch (err) {
    const error = parseFetchError(err);
    return { ok: false, response: null as any, error };
  }
};

/**
 * Display user-friendly error message based on API error
 */
export const formatErrorForUser = (error: APIError): string => {
  let message = error.message;

  if (error.suggestions && error.suggestions.length > 0) {
    const tips = error.suggestions.join('\n• ');
    message += `\n\nSuggestions to fix:\n• ${tips}`;
  }

  return message;
};

export const apiErrorService = {
  parseFetchError,
  parseHTTPError,
  handleAPIError,
  fetchWithErrorHandling,
  formatErrorForUser
};
