import { NextResponse } from "next/server";

import { HttpError, clientIp } from "@/lib/auth";
import { readJson, route } from "@/lib/api-helpers";
import { readDb } from "@/lib/db";
import { deviceIdentity } from "@/lib/device";
import { resolveLogin, type LoginReason } from "@/lib/login";
import { rateLimit } from "@/lib/rate-limit";

interface VerifyBody {
  username?: string;
  password?: string;
}

/**
 * Answers "would this pair sign in?" without creating a session.
 *
 * The sign-in button only turns green and holds still once the typed
 * credentials are real, and the browser cannot be trusted to decide
 * that -- the original compared against localStorage, which anyone
 * could edit. So the check runs here.
 *
 * That makes this endpoint a credential oracle by design, which is why
 * it is rate limited harder than the login route itself, never says
 * *which* half was wrong, and writes nothing: no session, no device
 * row, no audit entry.
 */
export const POST = route(async (request: Request) => {
  const { username = "", password = "" } = await readJson<VerifyBody>(request);
  const ip = await clientIp();

  const limit = rateLimit(`verify:${ip}`, 60, 60_000);
  if (!limit.ok) {
    throw new HttpError(429, `Too many checks. Try again in ${limit.retryAfter}s.`);
  }

  if (!username.trim() || !password) {
    return NextResponse.json({ ok: false, reason: "invalid" satisfies LoginReason });
  }

  const { hwid, fingerprint } = await deviceIdentity();
  const outcome = await resolveLogin(await readDb(), username, password, { ip, hwid, fingerprint });

  // Only ever ok/reason -- no username, role or package list leaks from
  // an endpoint that runs before authentication.
  return NextResponse.json(
    outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason },
    { headers: { "Cache-Control": "no-store" } },
  );
});
