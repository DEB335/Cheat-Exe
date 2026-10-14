/**
 * How long a session lasts when idle.
 *
 * Sessions now refresh automatically while the user is actively working.
 * If left idle and untouched for 1 hour (60 minutes), the session expires.
 */
export const SESSION_LIFETIME_SECONDS = 60 * 60;

export const SESSION_LIFETIME_MINUTES = SESSION_LIFETIME_SECONDS / 60;
