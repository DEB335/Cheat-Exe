"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  BackgroundVideo,
  setBackgroundMusicMuted,
  useAutoUnmute,
} from "@/components/effects/BackgroundVideo";
import {
  DiscordIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MusicIcon,
  MusicOffIcon,
  SendIcon,
  UserIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@/components/icons";
import { BorderRunner } from "@/components/login/BorderRunner";
import { LoginDecor } from "@/components/login/GlassScene";
import { TetherButton, type TetherState } from "@/components/login/TetherButton";
import { postJson } from "@/lib/client-api";
import { SESSION_LIFETIME_MINUTES } from "@/lib/session-lifetime";
import { playClick, playError, playType } from "@/lib/sounds";
import { cn } from "@/lib/utils";


/** Each link is a glass marble tinted with its brand. `rgb` is an
    "r,g,b" triplet (fed to the classes as --c so they can vary its alpha);
    `ink` is the glyph, a pale tint of the brand that reads on its own
    colour. */
const SOCIALS = [
  {
    key: "discord",
    href: "https://discord.gg/Rt6FWbW8HD",
    label: "Discord",
    icon: DiscordIcon,
    rgb: "88,101,242",
    ink: "#f5f6ff",
  },
  {
    key: "telegram",
    href: "https://t.me/CHEAT_EXE_01",
    label: "Telegram",
    icon: SendIcon,
    rgb: "41,169,235",
    ink: "#d6f1ff",
  },
  {
    key: "youtube",
    href: "http://www.youtube.com/@cheatexe1",
    label: "YouTube",
    icon: YoutubeIcon,
    rgb: "255,0,0",
    ink: "#ffd6da",
  },
  {
    key: "whatsapp",
    href: "https://whatsapp.com/channel/0029VbChn2OFsn0YYp4Wp31d",
    label: "WhatsApp",
    icon: WhatsappIcon,
    rgb: "37,211,102",
    ink: "#d3fbe1",
  },
];

/**
 * A glass marble tinted by --c (an "r,g,b" triplet on the element): lit
 * from the top-left and deepening to a dark core so it reads as a ball
 * rather than a disc, with a rim and a bloom in its own colour that both
 * strengthen on hover. Needs a positioned element (for <Specular />).
 */
const SPHERE = cn(
  "rounded-full bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.3)_0%,rgba(var(--c),0.55)_24%,rgba(var(--c),0.2)_60%,rgba(6,12,32,0.72)_100%)]",
  "shadow-[inset_0_0_0_1px_rgba(var(--c),0.6),inset_0_-7px_12px_-2px_rgba(var(--c),0.5),inset_0_2px_3px_rgba(255,255,255,0.3),0_0_18px_-2px_rgba(var(--c),0.55),0_10px_18px_-8px_rgba(0,0,0,0.6)]",
  "transition-all duration-300 ease-smooth",
  "hover:shadow-[inset_0_0_0_1px_rgba(var(--c),0.9),inset_0_-7px_14px_-2px_rgba(var(--c),0.65),inset_0_2px_3px_rgba(255,255,255,0.45),0_0_30px_2px_rgba(var(--c),0.7),0_16px_22px_-10px_rgba(0,0,0,0.6)]",
);

/** The window-light glint on a SPHERE. Sized in percent so one glint
    fits every marble. Painted above the glyph, as a reflection would be. */
function Specular() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-[14%] left-[11%] h-[22%] w-[44%] -rotate-[38deg] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.85),rgba(255,255,255,0))]"
    />
  );
}

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
  const [bolt, setBolt] = useState(0);
  const [submitBlock, setSubmitBlock] = useState<BlockedScreen | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // The original login page forces music on and unmutes at the first
  // interaction; only the dashboard starts silent.
  const [muted, setMuted] = useState(false);
  useAutoUnmute(!muted);

  // Whether the typed pair is a real account. The browser cannot decide
  // this -- the original compared against localStorage, which anyone
  // could edit -- so it is asked of the server as you type.
  const check = useCredentialCheck(username, password);

  // The button only snaps home and turns green for credentials the
  // server confirms. Anything else keeps it running from the cursor.
  //
  // Red means one specific thing: the server looked at this pair and
  // said no. Not "still typing" (teal) and not "asking" (amber) -- the
  // debounce means red only ever appears once you have stopped typing
  // and been told the credentials are wrong.
  const state: TetherState = error
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
      setBolt((n) => n + 1);
      setBusy(false);
    }
  };

  if (showBlocked) {
    return (
      <BlockedPanel
        screen={showBlocked}
        onDismiss={() => {
          setSubmitBlock(null);
          setDismissed(blockedKey);
        }}
      />
    );
  }

  return (
    <>
      <BackgroundVideo />

      <button
        type="button"
        aria-label="Toggle music"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          setBackgroundMusicMuted(next);
          playClick();
        }}
        style={{ "--c": "96,165,250" } as React.CSSProperties}
        className={cn(
          "fixed top-5 right-5 z-[10000] flex size-[42px] items-center justify-center",
          SPHERE,
          "text-[#dbeafe] backdrop-blur-[10px]",
          "hover:-translate-y-0.5 hover:scale-105 hover:text-[#a5f3fc]",
        )}
      >
        {muted ? <MusicOffIcon className="size-5" /> : <MusicIcon className="size-5" />}
        <Specular />
      </button>

      {/* overflow-x-hidden is a safety net. LoginDecor's shield, orbit ring
          and particles all stay inside the card, but BorderRunner's glow
          spills a few px past its edge, and nothing decorative may ever
          widen the page on a phone. */}
      <div className="no-scrollbar flex min-h-app-screen w-full items-center justify-center overflow-x-hidden overflow-y-auto py-10 select-none">
        <div className="relative z-10 w-full max-w-[560px] px-5 py-6 sm:p-6">
          <div
            key={shake}
            className={cn(
              // No overflow-hidden: the blurred rim, the bottom-edge
              // reflection and BorderRunner's glow all bleed a few px past
              // the edge. LoginDecor clips its own particles to the corners.
              // The radius here is the one BorderRunner runs round.
              "relative rounded-[32px] px-6 pt-9 pb-8 sm:px-9 sm:pt-10 sm:pb-9",
              // Barely-there blue glass; the blur does the work of keeping
              // the text legible over the video, with a touch of depth
              // added towards the bottom.
              "bg-[linear-gradient(160deg,rgba(140,180,255,0.1)_0%,rgba(120,160,255,0.06)_45%,rgba(20,40,95,0.16)_100%)]",
              // Light mode hides the video and paints the page near-white,
              // where clear glass would lose the white text: go dark there.
              "lt:bg-[linear-gradient(160deg,rgba(22,40,88,0.92)_0%,rgba(8,15,40,0.95)_100%)]",
              "backdrop-blur-[20px] backdrop-saturate-140",
              "shadow-[0_24px_70px_-20px_rgba(2,6,23,0.8),0_0_60px_-6px_rgba(59,130,246,0.38),0_0_22px_rgba(56,189,248,0.12),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_0_42px_rgba(96,165,250,0.07)]",
              shake > 0 && "animate-shake-card",
            )}
          >
            <LoginDecor />
            {/* A comet of light running round the rim: on top of the
                content, but it only ever draws on the edge. */}
            <BorderRunner />

            {/* Luminous rim, brightest at the top-left and down the left
                and bottom edges where the light catches, dim on the right.
                The conic sweep starts at 12 o'clock and runs clockwise. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-70 blur-[5px]"
            >
              <span className="glass-edge bg-[conic-gradient(from_0deg,rgba(147,197,253,0.5),rgba(147,197,253,0.12)_40deg,rgba(96,165,250,0.14)_95deg,rgba(96,165,250,0.5)_145deg,rgba(125,196,255,0.85)_180deg,rgba(56,189,248,0.7)_230deg,rgba(103,232,249,0.8)_290deg,rgba(207,250,254,1)_328deg,rgba(147,197,253,0.5))] [--glass-edge:2px]" />
            </span>
            <span
              aria-hidden
              className="glass-edge bg-[conic-gradient(from_0deg,rgba(186,220,255,0.6),rgba(147,197,253,0.2)_40deg,rgba(96,165,250,0.22)_95deg,rgba(96,165,250,0.55)_145deg,rgba(165,214,255,0.9)_180deg,rgba(56,189,248,0.8)_230deg,rgba(103,232,249,0.9)_290deg,rgba(224,251,255,1)_328deg,rgba(186,220,255,0.6))]"
            />

            {/* Glass sheen: a flare off the top-left corner and two
                diagonal bands of reflected light across the pane. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(160px_circle_at_0%_0%,rgba(165,243,252,0.16),transparent_70%),linear-gradient(118deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.03)_22%,transparent_34%,transparent_58%,rgba(255,255,255,0.05)_64%,transparent_74%)]"
            />

            {/* Reflection along the bottom edge: a hard bright line over a
                soft bloom. Inset past the 32px corners so it stays on the
                straight. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 -bottom-[3px] h-[6px] rounded-full bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.75),transparent)] blur-[5px]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(207,237,255,0.95)_30%,rgba(207,237,255,0.95)_70%,transparent)]"
            />

            <div className="relative z-10">
              {/* The first two rows stop short of the top-right corner, where
                  LoginDecor parks its shield; the subtitle runs full width
                  beneath it. */}
              <div className="pr-[96px] sm:pr-[112px]">
                <div className="mb-6 flex items-center gap-3 whitespace-nowrap">
                  <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-[2.5px] border-[#5eead4] shadow-[0_0_14px_rgba(45,212,191,0.6),0_0_30px_rgba(34,211,238,0.25),inset_0_0_8px_rgba(45,212,191,0.45)] sm:size-8">
                    <div className="size-2 rounded-full bg-[#ccfbf1] shadow-[0_0_6px_1px_#5eead4,0_0_14px_3px_rgba(34,211,238,0.7)] sm:size-2.5" />
                  </div>
                  <div className="text-[14px] font-bold tracking-[4px] text-white uppercase [text-shadow:0_0_10px_rgba(191,219,254,0.35)] sm:text-[16px] sm:tracking-[5px]">
                    CHEAT{" "}
                    <span className="bg-linear-to-r from-[#5eead4] to-[#22d3ee] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.7)] [text-shadow:none]">
                      EXE
                    </span>
                  </div>
                </div>

                {/* pb-1 keeps the "g" descender inside the clipped gradient. */}
                <h1 className="mb-2 bg-linear-to-b from-white from-35% to-[#bfdbfe] bg-clip-text pb-1 text-[34px] leading-[1.1] font-extrabold tracking-[-0.8px] text-transparent drop-shadow-[0_0_16px_rgba(147,197,253,0.4)] sm:text-[40px]">
                  Sign in
                </h1>
              </div>
              <p className="mb-7 text-[14px] leading-[1.55] text-[#b4c6e7] sm:text-[14.5px]">
                Welcome back. The button holds still once your credentials check out.
              </p>

              {error && <Notice tone="error">{error}</Notice>}
              {!error && check === "unreachable" && (
                <Notice tone="warn">
                  Could not reach the server to check your credentials. The button stays locked until
                  it can -- edit a field to try again.
                </Notice>
              )}
              {success && <Notice tone="ok">{success}</Notice>}

              <form onSubmit={submit} autoComplete="off">
                <Field
                  id="logUsername"
                  label="Username"
                  icon={<UserIcon className="size-[18px]" />}
                  type="text"
                  value={username}
                  autoComplete="username"
                  onChange={(value) => {
                    setUsername(value);
                    setError("");
                    playType();
                  }}
                />

                <Field
                  id="logPassword"
                  label="Password"
                  icon={<LockIcon className="size-[18px]" />}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(value) => {
                    setPassword(value);
                    setError("");
                    playType();
                  }}
                  trailing={
                    <button
                      type="button"
                      title="Toggle password visibility"
                      onClick={() => {
                        playClick();
                        setShowPassword((v) => !v);
                      }}
                      className="absolute right-4 flex cursor-pointer items-center justify-center rounded-md p-1 text-[#7d8fb8] transition-colors hover:text-[#dbeafe]"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-[18px]" />
                      ) : (
                        <EyeIcon className="size-[18px]" />
                      )}
                    </button>
                  }
                />

                <TetherButton
                  state={state}
                  label={busy ? "Signing in..." : check === "checking" ? "Checking..." : "Log in"}
                  disabled={busy}
                  bolt={bolt}
                />
              </form>

              <div className="mt-[26px] mb-5 flex items-center gap-4">
                <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(147,197,253,0.08),rgba(147,197,253,0.55))]" />
                {/* The left padding balances the tracking after the last letter. */}
                <span className="pl-[4px] text-[10.5px] font-bold tracking-[4px] text-[#a5c8f5]">
                  CONNECT
                </span>
                <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(147,197,253,0.55),rgba(147,197,253,0.08))]" />
              </div>

              <div className="flex justify-center gap-3.5 sm:gap-5">
                {SOCIALS.map((social) => {
                  const Icon = social.icon;
                  return (
                    <button
                      key={social.key}
                      type="button"
                      title={social.label}
                      onClick={() => {
                        playClick();
                        window.open(social.href, "_blank", "noopener,noreferrer");
                      }}
                      style={{ "--c": social.rgb, color: social.ink } as React.CSSProperties}
                      className={cn(
                        "relative flex size-[52px] cursor-pointer items-center justify-center sm:size-[54px]",
                        SPHERE,
                        "hover:-translate-y-1 hover:scale-[1.06]",
                      )}
                    >
                      <Icon className="size-[22px] drop-shadow-[0_0_6px_rgba(var(--c),0.9)]" />
                      <Specular />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
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
        type="button"
        onClick={onDismiss}
        className="mt-8 rounded-xl border border-white/10 px-5 py-2.5 text-[12.5px] font-bold text-[#94a3b8] transition-colors hover:border-white/20 hover:text-white"
      >
        Back to sign in
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  type,
  value,
  autoComplete,
  onChange,
  trailing,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="relative mb-5">
      <div className="mb-2 flex items-center justify-between pl-1">
        <label htmlFor={id} className="text-[13.5px] font-semibold text-white">
          {label}
        </label>
      </div>
      <div className="group relative flex items-center rounded-full">
        {/* Gradient rim, cyan into blue (see glass-edge). It is positioned
            and the input is not, so it paints over the input's outer pixel
            -- exactly where a border would sit. Focus brightens and
            thickens it. */}
        <span
          aria-hidden
          className="glass-edge bg-[linear-gradient(90deg,#5eead4,#38bdf8_45%,#6366f1)] opacity-60 transition-opacity duration-250 group-focus-within:opacity-100 group-focus-within:[--glass-edge:1.5px]"
        />
        <span className="pointer-events-none absolute left-5 text-[#7d8fb8] transition-all duration-200 group-focus-within:text-[#5eead4] group-focus-within:drop-shadow-[0_0_6px_rgba(94,234,212,0.75)]">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          required
          value={value}
          autoComplete={autoComplete}
          placeholder={label}
          onFocus={playClick}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full rounded-full bg-[rgba(8,15,35,0.45)] py-[17px] pr-12 pl-[52px]",
            "text-[14.5px] font-medium text-white outline-none transition-all duration-250 select-text",
            "placeholder:font-normal placeholder:text-[#8497c4]",
            // Lit upper lip, a shaded lower one, and a soft blue bloom.
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-10px_18px_-8px_rgba(2,6,23,0.5),0_0_16px_-2px_rgba(59,130,246,0.3)]",
            "focus:bg-[rgba(8,15,35,0.55)]",
            "focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-10px_18px_-8px_rgba(2,6,23,0.5),0_0_24px_rgba(56,189,248,0.45),0_0_0_4px_rgba(56,189,248,0.1)]",
          )}
        />
        {trailing}
      </div>
    </div>
  );
}

const NOTICE_TONES = {
  error:
    "border-[rgba(248,113,113,0.4)] bg-[rgba(239,68,68,0.14)] text-[#fca5a5] shadow-[0_0_20px_-4px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]",
  warn: "border-[rgba(251,191,36,0.4)] bg-[rgba(245,158,11,0.13)] text-[#fcd34d] shadow-[0_0_20px_-4px_rgba(245,158,11,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
  ok: "border-[rgba(94,234,212,0.4)] bg-[rgba(45,212,191,0.13)] text-[#5eead4] shadow-[0_0_20px_-4px_rgba(45,212,191,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]",
};

/** A status line above the form, as a tinted pane of the same glass. */
function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONES; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mb-[18px] rounded-[20px] border px-4 py-[11px] text-center text-[12.5px] leading-[1.4] font-semibold",
        NOTICE_TONES[tone],
      )}
    >
      {children}
    </div>
  );
}
