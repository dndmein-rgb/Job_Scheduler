export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      "NOT_FOUND",
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
    );
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, 409, details);
    this.name = "ConflictError";
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      "INVALID_STATE_TRANSITION",
      `Cannot transition job from ${from} to ${to}`,
      409,
    );
    this.name = "InvalidStateTransitionError";
  }
}

export class RetryableError extends AppError {
  constructor(message: string, details?: unknown) {
    super("RETRYABLE", message, 503, details);
    this.name = "RetryableError";
  }
}

export class PermanentError extends AppError {
  constructor(message: string, details?: unknown) {
    super("PERMANENT", message, 422, details);
    this.name = "PermanentError";
  }
}

/** HTTP 429 – too many requests in the current window */
export class RateLimitError extends AppError {
  constructor(
    message = "Rate limit exceeded",
    public readonly retryAfterSec: number = 60,
    details?: unknown,
  ) {
    super("RATE_LIMITED", message, 429, details);
    this.name = "RateLimitError";
  }
}