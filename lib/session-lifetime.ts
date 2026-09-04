/**
 * How long a session lasts, measured from the moment of sign-in.
 *
 * This is a fixed lifetime, not an idle one: using the panel does not
 * extend it. Twenty minutes after signing in the session ends, whether
 * the screen has been sitting untouched or someone is mid-keystroke, and
 * the password is needed again.
 *
 * Its own module because both sides need the number and they cannot
 * share a file: the server reads it in lib/session.ts next to the JWT
 * signing, while the dashboard and the login screen only want to *name*
 * the limit in their copy. Importing lib/session.ts to reach it would
 * drag jose into the browser bundle for the sake of one integer, and
 * hard-coding "20 minutes" into the copy instead would quietly start
 * lying the first time this is tuned.
 */
export const SESSION_LIFETIME_SECONDS = 60 * 20;

export const SESSION_LIFETIME_MINUTES = SESSION_LIFETIME_SECONDS / 60;
