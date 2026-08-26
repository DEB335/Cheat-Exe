import "server-only";

/**
 * Fixed-window counter, kept in process memory.
 *
 * The credential check behind the login button is a live oracle: it
 * answers "is this pair valid?" on every keystroke, so it has to cost
 * something to grind. This caps it per IP.
 *
 * Memory is per instance, so a fleet of serverless workers multiplies
 * the effective ceiling by the instance count. That is fine for slowing
 * a browser down; a distributed store is what a real defence needs.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window rolls over. */
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return { ok: true, retryAfter: 0 };
  }

  entry.count += 1;
  return {
    ok: entry.count <= limit,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/** Drops expired windows so a long-lived instance does not grow forever. */
function sweep(now: number): void {
  if (windows.size < 512) return;
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
}
