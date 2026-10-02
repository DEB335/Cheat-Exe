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
import { postJson } from "@/lib/client-api";
import { SESSION_LIFETIME_MINUTES } from "@/lib/session-lifetime";
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
  const check = useCredentialCheck(username, password);

  // The sign-in button only goes live for credentials the server
  // confirms.
  //
  // Red means one specific thing: the server looked at this pair and
  // said no. Not "still typing" and not "asking" -- the debounce means
  // red only ever appears once you have stopped typing and been told the
  // credentials are wrong.
  const state: SignInState = error
    ? "invalid"
    : check === "valid"
      ? "ready"
      : check === "checking"
        ? "checking"
        : check === "invalid"
          ? "invalid"
          : "empty";

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Belt and braces: the button is disabled until the check passes,
    // but a stray Enter must not fire a request either.
    if (check !== "valid" || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const data = await postJson<{ message?: string }>("/api/auth/login", {
        username,
        password,
      });
      setSuccess(data.message ?? "Login successful");
      const next = params.get("next") ?? "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err) {
      const message = (err as Error).message;
      const kind = WIRE_TO_BLOCK[message];
      if (kind) {
        setSubmitBlock({ kind, username: username.toUpperCase() });
        setBusy(false);
        return;
      }
      setError(message);
      playError();
      setShake((n) => n + 1);
      setBusy(false);
    }
  };

  const notice: React.ComponentProps<typeof LoginCard>["notice"] = error
    ? { tone: "error", text: error }
    : check === "unreachable"
      ? {
          tone: "warn",
          text: "Could not reach the server to check your credentials. The button stays locked until it can -- edit a field to try again.",
        }
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
                  }}
                  onPasswordChange={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  onTogglePassword={() => setShowPassword((v) => !v)}
                  onSubmit={submit}
                  signIn={{
                    state,
                    label: busy ? "Signing in..." : check === "checking" ? "Checking..." : "Sign in",
                    busy,
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
    body: `Sessions last ${SESSION_LIFETIME_MINUTES} minutes. Sign in again to continue.`,
    tone: "#60a5fa",
  },
  deleted: {
    title: "ACCOUNT REMOVED",
    body: "This account no longer exists. Contact the owner if you think this is a mistake.",
    tone: "#ef4444",
  },
};

/** How long to wait after the last keystroke before asking the server. */
const CHECK_DEBOUNCE_MS = 400;

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
 */
function useCredentialCheck(username: string, password: string): CheckState {
  const [answer, setAnswer] = useState<{ key: string; state: CheckState } | null>(null);

  const key = `${username}\u0000${password}`;
  const askable = username.trim().length > 0 && password.length >= 3;

  useEffect(() => {
    if (!askable) return;

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
  }, [key, askable, username, password]);

  if (!askable) return "empty";
  return answer?.key === key ? answer.state : "checking";
}

function BlockedPanel({ screen, onDismiss }: { screen: BlockedScreen; onDismiss: () => void }) {
  const copy = BLOCK_COPY[screen.kind];

  // The panel replaces the whole scene, focus included: move it to the
  // only control here so a keyboard or screen reader user starts on it.
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#090e11] px-6 text-center">
      <h1
        className="mb-3 text-[22px] tracking-[2px] sm:text-[28px]"
        style={{ color: copy.tone }}
      >
        {copy.title}
      </h1>
      <p className="mb-5 max-w-[420px] text-[13.5px] leading-[1.6] text-[#94a3b8]">{copy.body}</p>

      {screen.username && (
        <div
          className="rounded-lg border px-5 py-3"
          style={{ borderColor: `${copy.tone}4d`, background: `${copy.tone}1a` }}
        >
          <span style={{ color: copy.tone }}>USER: {screen.username}</span>
        </div>
      )}

      <button
        ref={backRef}
        type="button"
        onClick={onDismiss}
        className="mt-8 rounded-xl border border-white/10 px-5 py-2.5 text-[12.5px] font-bold text-[#94a3b8] transition-colors hover:border-white/20 hover:text-white"
      >
        Back to sign in
      </button>
    </div>
  );
}
