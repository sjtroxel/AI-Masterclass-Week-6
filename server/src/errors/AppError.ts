export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(500, message, 'DATABASE_ERROR');
  }
}

export class AIServiceError extends AppError {
  constructor(message: string) {
    super(503, message, 'AI_SERVICE_ERROR');
  }
}

export class ExternalAPIError extends AppError {
  constructor(message: string) {
    super(502, message, 'EXTERNAL_API_ERROR');
  }
}

export class FatalAPIError extends AppError {
  constructor(message: string) {
    super(500, message, 'FATAL_API_ERROR');
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = 'Analyst session has expired') {
    super(410, message, 'SESSION_EXPIRED');
  }
}
