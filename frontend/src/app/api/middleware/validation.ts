export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

export function validateRequest(body: any, rules: ValidationRule[]): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  for (const rule of rules) {
    const value = body[rule.field];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: rule.field, message: `${rule.field} is required` });
      continue;
    }

    // Skip further checks if not required and empty
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Check type
    if (rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be of type ${rule.type}`,
        });
        continue;
      }
    }

    // Check minLength
    if (rule.minLength !== undefined && typeof value === 'string') {
      if (value.length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at least ${rule.minLength} characters`,
        });
      }
    }

    // Check maxLength
    if (rule.maxLength !== undefined && typeof value === 'string') {
      if (value.length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at most ${rule.maxLength} characters`,
        });
      }
    }

    // Check pattern
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        errors.push({
          field: rule.field,
          message: `${rule.field} format is invalid`,
        });
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push({
          field: rule.field,
          message: typeof customResult === 'string' ? customResult : `${rule.field} is invalid`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function createValidationResponse(result: ValidationResult) {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: result.errors,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
