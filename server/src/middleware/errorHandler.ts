import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

// Four-parameter signature required by Express to recognize as error handler.
// _next is intentionally unused — the underscore prefix satisfies ESLint no-unused-vars.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code ?? 'ERROR',
        message: err.message,
      },
    });
    return;
  }

  // Unknown error — don't leak internals
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};
