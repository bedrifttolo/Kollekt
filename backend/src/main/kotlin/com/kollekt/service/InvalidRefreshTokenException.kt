package com.kollekt.service

/**
 * The presented refresh token is expired, revoked, malformed, or already used.
 *
 * Distinct from a generic bad request because the client has to react differently: this is the
 * one signal that means "the session is genuinely over, sign in again". Everything else the
 * refresh endpoint can return (a 5xx, a throttled response, a dropped connection) is transient
 * and must leave the stored tokens alone. Mapped to 401 by ApiExceptionHandler.
 */
class InvalidRefreshTokenException(
    message: String = "Refresh token is invalid or expired",
) : RuntimeException(message)
