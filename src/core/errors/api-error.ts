/**
 * Operational HTTP error.
 * code  → machine-readable string (used by OAuth2 RFC 6749 responses)
 * statusCode → HTTP status
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? `HTTP_${statusCode}`;
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────
  static badRequest(msg: string) {
    return new ApiError(msg, 400, "BAD_REQUEST");
  }
  static unauthorized(msg = "Invalid credentials") {
    return new ApiError(msg, 401, "UNAUTHORIZED");
  }
  static forbidden(msg = "Access denied") {
    return new ApiError(msg, 403, "FORBIDDEN");
  }
  static notFound(msg: string) {
    return new ApiError(msg, 404, "NOT_FOUND");
  }
  static conflict(msg: string) {
    return new ApiError(msg, 409, "CONFLICT");
  }
  static unprocessable(msg: string) {
    return new ApiError(msg, 422, "UNPROCESSABLE");
  }
  static tooManyRequests(msg = "Too many requests") {
    return new ApiError(msg, 429, "TOO_MANY_REQUESTS");
  }
  static internal(msg = "Internal server error") {
    return new ApiError(msg, 500, "INTERNAL_SERVER_ERROR");
  }

  // ── OAuth2 / RFC 6749 ──────────────────────────────────────────────────────
  static invalidGrant(msg = "Invalid or expired grant") {
    return new ApiError(msg, 400, "invalid_grant");
  }
  static invalidClient(msg = "Client authentication failed") {
    return new ApiError(msg, 401, "invalid_client");
  }
  static invalidRequest(msg = "Missing or malformed request parameter") {
    return new ApiError(msg, 400, "invalid_request");
  }
  static invalidScope(msg = "Requested scope is invalid or unknown") {
    return new ApiError(msg, 400, "invalid_scope");
  }
  static accessDenied(msg = "The resource owner denied the request") {
    return new ApiError(msg, 403, "access_denied");
  }
  static unsupportedGrantType(msg = "Unsupported grant type") {
    return new ApiError(msg, 400, "unsupported_grant_type");
  }
}
