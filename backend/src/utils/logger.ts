// Enhanced structured logger with timestamp and context support
const getTimestamp = () => new Date().toISOString();

const safeStringify = (value: unknown) => {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, val: any) => {
      if (typeof val === 'bigint') return val.toString();

      if (val instanceof Error) {
        return {
          name: val.name,
          message: val.message,
          code: (val as any).code,
          status: (val as any).status || (val as any).statusCode,
          stack: val.stack
        };
      }

      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }

      return val;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: 'UNSERIALIZABLE_CONTEXT', message });
  }
};

const formatLogMessage = (level: string, message: string, context?: any) => {
  const timestamp = getTimestamp();
  const contextStr = context ? ` ${safeStringify(context)}` : '';
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
};

const toSafeErrorContext = (error: any) => {
  // Axios errors can include internal request objects (sockets) which are circular.
  // Always project to a safe, JSON-serializable shape.
  if (error?.isAxiosError) {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      config: {
        method: error.config?.method,
        url: error.config?.url,
        timeout: error.config?.timeout
      }
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as any).code,
      status: (error as any).status || (error as any).statusCode,
      stack: error.stack
    };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      message: (error as any).message,
      code: (error as any).code,
      status: (error as any).response?.status || (error as any).status || (error as any).statusCode,
      data: (error as any).response?.data
    };
  }

  return { message: String(error) };
};

const formatAxiosError = (error: any) => {
  return toSafeErrorContext(error);
};

export const logger = {
  info: (message: string, context?: any) => {
    console.info(formatLogMessage('INFO', message, context));
  },
  
  error: (message: string, error?: any) => {
    const formattedError = error ? formatAxiosError(error) : undefined;
    console.error(formatLogMessage('ERROR', message, formattedError));
    
    // Print stack trace if available
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
  },
  
  warn: (message: string, context?: any) => {
    console.warn(formatLogMessage('WARN', message, context));
  },
  
  success: (message: string, context?: any) => {
    console.info(formatLogMessage('SUCCESS', message, context));
  },
  
  debug: (message: string, context?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLogMessage('DEBUG', message, context));
    }
  },
  
  // Helper for logging HTTP requests
  logRequest: (method: string, path: string, requestId: string, context?: any) => {
    console.info(formatLogMessage('REQ', `${method} ${path}`, { requestId, ...context }));
  },
  
  // Helper for logging HTTP responses
  logResponse: (method: string, path: string, requestId: string, statusCode: number, duration: number) => {
    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    console.info(formatLogMessage(level, `${method} ${path} ${statusCode} ${duration}ms`, { requestId }));
  }
};
