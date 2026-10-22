"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";

import {
  BackgroundMusic,
  setBackgroundMusicMuted,
  useAutoUnmute,
} from "@/components/effects/BackgroundMusic";
import { MusicIcon, MusicOffIcon } from "@/components/icons";
import { Lamp } from "@/components/login/lamp/Lamp";
import stage from "@/components/login/lamp/login-stage.module.css";
import { LampRoom } from "@/components/login/lamp/LampRoom";
import { LoginCard, type SignInState } from "@/components/login/LoginCard";
import { Wind404 } from "@/components/effects/Wind404";
import { playClick, playError } from "@/lib/sounds";

/** When the card has finished arriving (see the stage's motion timeline),
    the username field takes focus -- on a mouse only, so a phone never
    throws its keyboard up over the scene. */
const FOCUS_AFTER_ON_MS = 1900;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Whether `error` is the login route turning this exact pair down
  // (wrong password), as opposed to a throttle, an outage or a dropped
  // connection -- which say nothing about the credentials, and must not
  // paint the button red or stop a retry.
  const [rejected, setRejected] = useState(false);
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(0);
  const [submitBlock, setSubmitBlock] = useState<BlockedScreen | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // The original login page forces music on and unmutes at the first
  // interaction; only the dashboard starts silent.
  const [muted, setMuted] = useState(false);
  useAutoUnmute(!muted);

  // The room starts dark. Pulling the lamp's cord lights it and brings
  // the sign-in card in; pulling again puts it all away.
  const [lit, setLit] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const cardId = useId();
  const stageRef = useRef<HTMLDivElement>(null);

  // Whether the typed pair is a real account. The browser cannot decide
  // this -- the original compared against localStorage, which anyone
  // could edit -- so it is asked of the server as you type.
  const check = useCredentialCheck(username, password, busy);

  // The button reads ready as soon as both fields hold something -- it
  // can be pressed then, so it should not look like it is waiting.
  //
  // Red means one specific thing: the server looked at this pair and
  // said no. Not "still typing" and not "asking" -- the debounce means
  // red only ever appears once you have stopped typing and been told the
  // credentials are wrong.
  const hasInput = username.trim().length > 0 && password.length > 0;
  const state: SignInState = rejected
    ? "invalid"
    : check === "invalid"
      ? "invalid"
      : hasInput || check === "valid"
        ? "ready"
        : "empty";

  // Whether pressing the button goes to the server. It used to wait for
  // the check to come back green, so a press while it was still asking
  // only shook the button -- and someone who typed and pressed straight
  // away had to press again a second later. The login route verifies the
  // pair itself and is the answer that counts, so everything goes through
  // except a pair the server has already turned down, or empty fields.
  const canSubmit =
    !busy &&
    !rejected &&
    username.trim().length > 0 &&
    password.length > 0 &&
    check !== "invalid";

  // Which full-screen panel, if any, this render should show. Derived
  // rather than pushed into state from an effect: the live check, a
  // rejected submit and a ?reason= redirect are three sources for one
  // screen, and deriving keeps them from racing each other.
  const reason = params.get("reason");
  const blocked =
    submitBlock ??
    (isBlockKind(check) ? { kind: check, username: username.toUpperCase() } : null) ??
    (reason && reason in BLOCK_COPY ? { kind: reason as BlockKind, username: "" } : null);

  const blockedKey = blocked ? `${blocked.kind}:${blocked.username}` : null;
  const showBlocked = blocked && blockedKey !== dismissed ? blocked : null;

  // Once the card has slid in, put the cursor in the username field --
  // with a mouse only: on a touch screen focusing would pop the keyboard
  // up over the scene the moment the light comes on. And only if focus
  // is still where the pull left it; someone who has moved on to another
  // control in the meantime keeps their place.
  useEffect(() => {
    if (!lit || !window.matchMedia("(pointer: fine)").matches) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && !active.hasAttribute("data-lamp-cord")) return;
      usernameRef.current?.focus({ preventScroll: true });
    }, FOCUS_AFTER_ON_MS);
    return () => window.clearTimeout(timer);
  }, [lit]);

  // "Back to sign in" from a blocked panel returns focus to the lamp's
  // cord, so a keyboard user lands back in the scene rather than on
  // <body>. (The panel focuses its own button when it opens.)
  const isBlocked = showBlocked !== null;
  const focusCordOnReturn = useRef(false);
  useEffect(() => {
    if (isBlocked || !focusCordOnReturn.current) return;
    focusCordOnReturn.current = false;
    document.querySelector<HTMLButtonElement>("[data-lamp-cord]")?.focus();
  }, [isBlocked]);

  // Paint the lit scene once, invisibly, while the room is still dark
  // (see usePrewarm), so the first pull does not stall on it.
  usePrewarm(stageRef, !isBlocked);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("cheat_tab_session");
    }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Belt and braces: the card cancels a locked press itself, but a
    // stray Enter must not fire a request either.
    if (!canSubmit) return;

    // The live check already found this pair blocked (suspended, banned,
    // wrong machine...) and its panel was dismissed with "Back to sign
    // in". The server would only say the same again, so the panel comes
    // straight back instead of spending an attempt -- where a press used
    // to do nothing at all.
    if (isBlockKind(check)) {
      setDismissed(null);
      return;
    }

    setBusy(true);
    setError("");
    setRejected(false);
    setSuccess("");

    const fail = (message: string, wrongPassword: boolean) => {
      setError(message);
      setRejected(wrongPassword);
      playError();
      setShake((n) => n + 1);
      setBusy(false);
    };

    // A plain fetch rather than postJson: that helper answers any 401 by
    // reloading the page onto /login -- right for a dashboard whose
    // session died, wrong here, where a 401 just means a wrong password
    // and reloading would put the lamp out and wipe what was typed.
    let response: Response;
    let data: { message?: string; user?: { sessionId?: string } };
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      data = (await response.json().catch(() => ({}))) as typeof data;
    } catch {
      fail("Could not reach the server. Check your connection and press Sign in again.", false);
      return;
    }

    if (!response.ok) {
      const message = data.message ?? `Sign-in failed (${response.status}). Try again.`;
      const kind = WIRE_TO_BLOCK[message];
      if (kind) {
        setSubmitBlock({ kind, username: username.toUpperCase() });
        // A block dismissed earlier carries the same key, and would keep
        // this one hidden.
        setDismissed(null);
        setBusy(false);
        return;
      }
      fail(message, response.status === 401);
      return;
    }

    // Marks this tab as the one that signed in: the dashboard layout
    // sends a tab without it (a closed-and-reopened browser) back here.
    try {
      sessionStorage.setItem("cheat_tab_session", data.user?.sessionId || "active");
    } catch {
      /* storage blocked -- the layout will ask for a fresh sign-in */
    }

    // Stays busy: the page is on its way out.
    setSuccess(data.message ?? "Login successful");
    enterDashboard(router, safeNext(params.get("next")));
  };

  const notice: React.ComponentProps<typeof LoginCard>["notice"] = error
    ? { tone: "error", text: error }
    : success
      ? { tone: "ok", text: success }
      : null;

  return (
    <>
      {/* Mounted once, outside both views, so the soundtrack plays on
          through a blocked panel and back again. */}
      <BackgroundMusic />

      {showBlocked ? (
        <BlockedPanel
          screen={showBlocked}
          onDismiss={() => {
            focusCordOnReturn.current = true;
            setSubmitBlock(null);
            setDismissed(blockedKey);
          }}
        />
      ) : (
        // data-lit drives every transition in the scene (login-stage.module.css
        // and the lamp's own), so toggling mid-animation simply reverses it.
        <div ref={stageRef} className={stage.stage} data-lit={lit ? "true" : "false"}>
          <LampRoom on={lit} />

          <p className={stage.hint}>
            <span aria-hidden className={stage.hintDash} />
            Pull the string to toggle login
          </p>

          <div className={stage.lampSlot}>
            <Lamp
              on={lit}
              controls={cardId}
              onToggle={() => {
                playClick();
                setLit((v) => !v);
              }}
            />
          </div>

          {/* Full-screen layer for the card, so a phone can scroll a card
              taller than the space under the lamp. It lets clicks through
              to the lamp everywhere the card is not. */}
          <div className={stage.cardLayer}>
            <div id={cardId} className={stage.cardSlot} inert={!lit} aria-hidden={!lit}>
              <div className={stage.cardMotion}>
                {/* The card plays its own typing and click sounds. */}
                <LoginCard
                  open={lit}
                  username={username}
                  password={password}
                  showPassword={showPassword}
                  onUsernameChange={(value) => {
                    setUsername(value);
                    setError("");
                    setRejected(false);
                  }}
                  onPasswordChange={(value) => {
                    setPassword(value);
                    setError("");
                    setRejected(false);
                  }}
                  onTogglePassword={() => setShowPassword((v) => !v)}
                  onSubmit={submit}
                  signIn={{
                    state,
                    label: busy ? "Signing in..." : "Sign in",
                    busy,
                    canSubmit,
                  }}
                  notice={notice}
                  shake={shake}
                  usernameRef={usernameRef}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Background music"
            aria-pressed={!muted}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setBackgroundMusicMuted(next);
              playClick();
            }}
            className={stage.music}
          >
            {muted ? (
              <MusicOffIcon className={stage.musicIcon} />
            ) : (
              <MusicIcon className={stage.musicIcon} />
            )}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Rasterises the lit scene ahead of the first pull.
 *
 * Everything that appears when the lamp comes on -- the cone, pool and
 * reflections, the room's warm and cool light, the card -- sits at
 * opacity 0 while the room is dark, and the browser does not paint a
 * layer nobody can see. So the first pull used to paint all of it at
 * once, a single frame of half a second or more that swallowed the
 * flicker and made the glide jump. Every pull after that was smooth.
 *
 * Once the page is idle this sets data-warm on the stage for a few
 * frames. CSS keyed off it (login-stage, lamp, lamp-room and login-card
 * modules) lifts those layers to opacity 0.003 -- painted, and far too
 * faint to see on the black room -- with transitions off; then they drop
 * back to 0 and their tiles are ready when the light comes on.
 */
function usePrewarm(stageRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = stageRef.current;
    if (!enabled || !el) return;

    let frame = 0;
    let frames = 0;
    const tick = () => {
      // Three frames: one to apply the style, one to paint, one spare.
      if (++frames < 3) {
        frame = requestAnimationFrame(tick);
        return;
      }
      delete el.dataset.warm;
    };
    const start = () => {
      // Only while dark: lit, it is all on screen already.
      if (el.dataset.lit === "true") return;
      el.dataset.warm = "";
      frame = requestAnimationFrame(tick);
    };

    const hasIdle = "requestIdleCallback" in window;
    const idle = hasIdle
      ? window.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 300);

    return () => {
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cancelAnimationFrame(frame);
      delete el.dataset.warm;
    };
  }, [stageRef, enabled]);
}

type CheckState =
  | "empty"
  | "checking"
  | "valid"
  | "invalid"
  | "banned"
  | "suspended"
  | "pending"
  | "expired"
  | "device"
  | "locked"
  /** The check itself failed. Never unlocks -- but says so, rather than
      leaving someone with correct credentials chasing a locked button. */
  | "unreachable";

type BlockKind =
  | "banned"
  | "suspended"
  | "pending"
  | "expired"
  | "device"
  | "locked"
  | "kicked"
  | "deleted"
  | "timeout";

interface BlockedScreen {
  kind: BlockKind;
  username: string;
}

/** Wire codes the login route throws, mapped to a full-screen panel. */
const WIRE_TO_BLOCK: Record<string, BlockKind | undefined> = {
  BANNED: "banned",
  SUSPENDED: "suspended",
  PENDING: "pending",
  EXPIRED: "expired",
  DEVICE_BANNED: "device",
  DEVICE_LOCKED: "locked",
};

const BLOCK_COPY: Record<BlockKind, { title: string; body: string; tone: string }> = {
  banned: {
    title: "ACCOUNT TERMINATED",
    body: "Access to this platform has been revoked.",
    tone: "#ef4444",
  },
  suspended: {
    title: "ACCOUNT SUSPENDED",
    body: "Your credentials are correct, but this account has been suspended by the owner. Contact support to have it restored.",
    tone: "#f59e0b",
  },
  pending: {
    title: "PENDING APPROVAL",
    body: "This account exists but has not been approved yet. You will be able to sign in once the owner activates it.",
    tone: "#f59e0b",
  },
  expired: {
    title: "VALIDITY ENDED",
    body: "Your credentials are correct, but this account's validity period has run out. Ask the owner to renew it.",
    tone: "#f59e0b",
  },
  device: {
    title: "DEVICE BLOCKED",
    body: "This device or network has been blocked from the panel. No account can be used from here.",
    tone: "#ef4444",
  },
  locked: {
    title: "WRONG DEVICE",
    body: "This account is locked to one machine and this is not it. If it is really yours, ask the owner to reset the HWID.",
    tone: "#f59e0b",
  },
  kicked: {
    title: "SESSION ENDED",
    body: "Your session was closed from the owner panel. Sign in again to continue.",
    tone: "#60a5fa",
  },
  timeout: {
    title: "SESSION EXPIRED",
    body: "Sessions expire after 1 hour of inactivity. Sign in again to continue.",
    tone: "#38bdf8",
  },
  deleted: {
    title: "ACCOUNT REMOVED",
    body: "This account no longer exists. Contact the owner if you think this is a mistake.",
    tone: "#ef4444",
  },
};

/**
 * Where to go once signed in: the `next` the proxy sent us here with, if
 * it is a path on this site, otherwise the dashboard.
 *
 * `next` comes from the address bar, so anyone can write a link that sets
 * it. Handed to the router unchecked, `?next=javascript:...` runs script
 * on this origin the moment someone signs in, and `?next=//elsewhere`
 * sends a freshly signed-in user off-site. Only a same-origin path
 * survives, and never /login itself, which would loop.
 *
 * The raw string is checked and then the parsed one is checked again:
 * dot segments and escapes (`/.//evil.com`, `/a/..//x`, `/%2e//x`)
 * pass the first test and only normalise into a protocol-relative
 * `//host` once parsed -- which the router and `location` would both
 * take as another site.
 */
function safeNext(raw: string | null): string {
  const fallback = "/dashboard";
  const offSite = (path: string) => path.startsWith("//") || path.startsWith("/\\");
  if (!raw || !raw.startsWith("/") || offSite(raw)) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || offSite(url.pathname)) return fallback;
    if (url.pathname === "/login") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Set once this document has signed someone in through the router. */
let signedInHere = false;

/**
 * Leaves for the dashboard, the quickest way that cannot show a stale one.
 *
 * A client-side navigation is the fast path: no fresh document, no
 * reloading every script -- one request for the dashboard and it paints.
 * It used to be followed by router.refresh(), which in this Next version
 * only refetches the route it is called on, so it simply rendered the
 * dashboard a second time.
 *
 * What the refresh was there for is real, though. next.config.ts keeps
 * visited dashboard pages in the client router cache for five minutes,
 * and signing out is a client-side navigation to /login, so a document
 * that has shown a dashboard may still hold one rendered for the session
 * that just ended -- the wrong account, the wrong session clock. A
 * document that started life on /login and has not signed anyone in yet
 * has never rendered a dashboard, so it has nothing cached and takes the
 * fast path. Any other document gets a full page load, which starts with
 * an empty cache by definition.
 */
function enterDashboard(router: ReturnType<typeof useRouter>, next: string): void {
  if (signedInHere || !documentStartedOnLogin()) {
    // replace, not assign: Back must not restore this page from the
    // back-forward cache still saying "Signing in...".
    window.location.replace(next);
    return;
  }
  signedInHere = true;
  // replace: Back from the dashboard should not land on a sign-in form
  // the proxy would only bounce straight back from.
  router.replace(next);
}

/** Whether this document was loaded at /login (after any redirect). */
function documentStartedOnLogin(): boolean {
  const entry = performance.getEntriesByType("navigation")[0];
  if (!entry) return false;
  try {
    return new URL(entry.name).pathname === "/login";
  } catch {
    return false;
  }
}

/**
 * How long to wait after the last keystroke before asking the server.
 * Short, so the button is usually green by the time the hand reaches it;
 * the verify route's rate limit and the 429 retry below absorb the extra
 * checks a fast typist produces.
 */
const CHECK_DEBOUNCE_MS = 180;

const BLOCKING_CHECKS = ["banned", "suspended", "pending", "expired", "device", "locked"] as const;

function isBlockKind(check: CheckState): check is BlockKind & CheckState {
  return (BLOCKING_CHECKS as readonly string[]).includes(check);
}

/**
 * Asks the server whether the typed pair would sign in.
 *
 * The answer is stored against the exact pair it was asked about and the
 * result is derived at render, so a reply that lands after the fields
 * have moved on simply stops matching -- it can never turn the button
 * green for credentials that are no longer on screen.
 *
 * `paused` is true while a sign-in is on its way. Turning it on runs the
 * effect's cleanup, which drops a check still waiting out the debounce
 * and aborts one already sent, and no new one starts until it turns off
 * again -- so no check can be answered after the login it raced.
 */
function useCredentialCheck(username: string, password: string, paused: boolean): CheckState {
  const [answer, setAnswer] = useState<{ key: string; state: CheckState } | null>(null);

  const key = `${username}\u0000${password}`;
  const askable = username.trim().length > 0 && password.length >= 3;

  useEffect(() => {
    if (!askable || paused) return;

    const controller = new AbortController();
    const timers: number[] = [];

    // One check, with a small budget of retries for a throttle. A busy
    // typist can out-run the verify rate limit, and a throttled check is
    // not an answer about the credentials -- so instead of flashing an
    // error, the button stays "checking" and asks again shortly.
    const runCheck = async (attempt: number) => {
      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: controller.signal,
          cache: "no-store",
        });

        // Throttled: wait out the window (the server says how long) and
        // retry, up to twice, without disturbing the "checking" state.
        if (response.status === 429 && attempt < 2) {
          const data = (await response.json().catch(() => ({}))) as { retryAfter?: number };
          const waitMs = Math.min(3000, Math.max(600, (data.retryAfter ?? 1) * 1000));
          timers.push(window.setTimeout(() => void runCheck(attempt + 1), waitMs));
          return;
        }

        // Any other non-2xx is a real fault, not a verdict on the
        // credentials, so it must not read as "wrong password".
        if (!response.ok) {
          setAnswer({ key, state: "unreachable" });
          return;
        }

        const data = (await response.json()) as { ok?: boolean; reason?: string };
        if (data.ok) setAnswer({ key, state: "valid" });
        else if (data.reason && data.reason !== "invalid") {
          setAnswer({ key, state: data.reason as CheckState });
        } else setAnswer({ key, state: "invalid" });
      } catch {
        // Offline or aborted. Stay locked -- only the server may unlock the
        // button -- but say so rather than lie about the credentials.
        if (!controller.signal.aborted) setAnswer({ key, state: "unreachable" });
      }
    };

    timers.push(window.setTimeout(() => void runCheck(0), CHECK_DEBOUNCE_MS));

    return () => {
      for (const t of timers) window.clearTimeout(t);
      controller.abort();
    };
  }, [key, askable, paused, username, password]);

  if (!askable) return "empty";
  return answer?.key === key ? answer.state : "checking";
}

function BlockedPanel({ screen, onDismiss }: { screen: BlockedScreen; onDismiss: () => void }) {
  // If the session expired / timed out, show the Wind 404 screen from _code_and_chill_ reel
  if (screen.kind === "timeout") {
    return (
      <Wind404
        title="404"
        subtitle="Nothing at this address but the wind. Sessions expire after 1 hour of inactivity."
        backText="Back to sign in"
        onBack={onDismiss}
      />
    );
  }

  return <BlockedCard screen={screen} onDismiss={onDismiss} />;
}

/** Its own component so its hooks never sit behind the early return above. */
function BlockedCard({ screen, onDismiss }: { screen: BlockedScreen; onDismiss: () => void }) {
  const copy = BLOCK_COPY[screen.kind];

  // The panel replaces the whole scene, focus included: move it to the
  // only control here so a keyboard or screen reader user starts on it.
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050814]/95 px-4 text-center backdrop-blur-2xl">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute h-[320px] w-[320px] rounded-full blur-[100px] opacity-25"
        style={{ background: copy.tone }}
      />

      {/* Cyber Glassmorphism Card */}
      <div
        className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0c1228]/85 p-8 shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_30px_rgba(56,189,248,0.12)] backdrop-blur-xl transition-all duration-300"
        style={{ borderColor: `${copy.tone}33` }}
      >
        {/* Glowing Status Icon Badge */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner"
          style={{
            borderColor: `${copy.tone}4d`,
            background: `radial-gradient(circle, ${copy.tone}22 0%, ${copy.tone}05 100%)`,
            boxShadow: `0 0 24px ${copy.tone}33`,
          }}
        >
          <svg
            className="h-8 w-8"
            style={{ color: copy.tone }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h1
          className="mb-2 text-[20px] font-black tracking-[2.5px] sm:text-[24px]"
          style={{
            color: copy.tone,
            textShadow: `0 0 20px ${copy.tone}66`,
          }}
        >
          {copy.title}
        </h1>

        <p className="mb-6 text-[13.5px] leading-relaxed text-slate-300">
          {copy.body}
        </p>

        {screen.username && (
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-xs tracking-wider"
            style={{
              borderColor: `${copy.tone}40`,
              background: `${copy.tone}15`,
              color: copy.tone,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: copy.tone }} />
            USER: {screen.username}
          </div>
        )}

        {/* Back to sign in button with cursor-pointer and hover glow */}
        <div>
          <button
            ref={backRef}
            type="button"
            onClick={onDismiss}
            className="group relative inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-[13px] font-semibold text-slate-200 shadow-md backdrop-blur-md transition-all duration-200 hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-white hover:shadow-[0_0_25px_rgba(56,189,248,0.35)] active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to sign in</span>
          </button>
        </div>
      </div>
    </div>
  );
}
