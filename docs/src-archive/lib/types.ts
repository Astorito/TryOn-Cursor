/**
 * Stub de tipos para la aplicación TryOn
 */

export class ValidationError extends Error {
  constructor(public errors: Array<{ message: string }> | string) {
    super(typeof errors === 'string' ? errors : errors[0].message)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message: string = 'Conflict') {
    super(message)
    this.name = 'ConflictError'
  }
}
