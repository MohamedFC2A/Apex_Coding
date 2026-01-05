import { Request, Response, NextFunction } from 'express';

/**
 * Simple validation middleware without external dependencies.
 * Accepts a validator function that returns an object { valid: boolean, errors?: any }.
 * If validation fails, a 400 response with error details is sent.
 */
type Validator = (data: any) => { valid: boolean; errors?: any };

export const validateBody = (validator: Validator) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { valid, errors } = validator(req.body);
    if (!valid) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    // Attach validated data for downstream use
    (req as any).validatedBody = req.body;
    next();
  };
};

