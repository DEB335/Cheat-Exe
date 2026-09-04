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
import { TetherButton, type TetherState } from "@/components/login/TetherButton";
import { postJson } from "@/lib/client-api";
import { SESSION_LIFETIME_MINUTES } from "@/lib/session-lifetime";
import { playClick, playError, playType } from "@/lib/sounds";
import { cn } from "@/lib/utils";


const SOCIALS = [
  {
    key: "discord",
    href: "https://discord.gg/Rt6FWbW8HD",
    label: "Discord",
    icon: DiscordIcon,
    hover: "hover:text-[#5865F2] hover:border-[#5865F2] hover:bg-[rgba(88,101,242,0.1)] hover:shadow-[0_8px_24px_rgba(88,101,242,0.3)]",
  },
  {
    key: "telegram",
    href: "https://t.me/CHEAT_EXE_01",
    label: "Telegram",
    icon: SendIcon,
    hover: "hover:text-[#0088CC] hover:border-[#0088CC] hover:bg-[rgba(0,136,204,0.1)] hover:shadow-[0_8px_24px_rgba(0,136,204,0.3)]",
  },
  {
    key: "youtube",
    href: "http://www.youtube.com/@cheatexe1",
    label: "YouTube",
    icon: YoutubeIcon,
    hover: "hover:text-[#FF0000] hover:border-[#FF0000] hover:bg-[rgba(255,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(255,0,0,0.3)]",
  },
  {
    key: "whatsapp",
    href: "https://whatsapp.com/channel/0029VbChn2OFsn0YYp4Wp31d",
    label: "WhatsApp",
    icon: WhatsappIcon,
    hover: "hover:text-[#25D366] hover:border-[#25D366] hover:bg-[rgba(37,211,102,0.1)] hover:shadow-[0_8px_24px_rgba(37,211,102,0.3)]",
  },
];

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
        className={cn(
          "fixed top-5 right-5 z-[10000] flex size-[42px] items-center justify-center rounded-full",
          "border border-white/10 bg-[rgba(10,15,30,0.7)] text-white backdrop-blur-[10px]",
          "transition-all duration-300 ease-smooth",
          "hover:-translate-y-0.5 hover:scale-105 hover:border-[rgba(255,31,90,0.4)]",
          "hover:text-[#ff1f5a] hover:shadow-[0_0_15px_rgba(255,31,90,0.25)]",
        )}
      >
        {muted ? <MusicOffIcon className="size-5" /> : <MusicIcon className="size-5" />}
      </button>

      <div className="no-scrollbar flex min-h-screen w-full items-center justify-center overflow-y-auto py-10 select-none">
        <div className="relative z-10 w-full max-w-[440px] p-6">
          <div
            key={shake}
            className={cn(
              "relative rounded-[32px] border border-[rgba(45,212,191,0.25)] bg-[rgba(13,19,21,0.55)]",
              "px-9 pt-10 pb-9 backdrop-blur-[12px]",
              "shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_50px_rgba(45,212,191,0.35),0_0_20px_rgba(45,212,191,0.2),0_0_1px_1px_rgba(45,212,191,0.15)]",
              shake > 0 && "animate-shake-card",
            )}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-7 items-center justify-center rounded-full border-[2.5px] border-[#2dd4bf] shadow-[0_0_14px_rgba(45,212,191,0.35)]">
                <div className="size-2 rounded-full bg-[#2dd4bf]" />
              </div>
              <div className="text-[13px] font-bold tracking-[3px] text-[#94a3b8] uppercase">
                CHEAT EXE
              </div>
            </div>

            <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.5px] text-white">Sign in</h1>
            <p className="mb-7 text-[13.5px] leading-[1.5] text-[#94a3b8]">
              Welcome back. The button holds still once your credentials check out.
            </p>

            {error && (
              <div className="mb-[18px] rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)] px-4 py-[11px] text-center text-[12.5px] leading-[1.4] font-semibold text-[#fca5a5]">
                {error}
              </div>
            )}
            {!error && check === "unreachable" && (
              <div className="mb-[18px] rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.12)] px-4 py-[11px] text-center text-[12.5px] leading-[1.4] font-semibold text-[#fcd34d]">
                Could not reach the server to check your credentials. The button stays locked until
                it can -- edit a field to try again.
              </div>
            )}
            {success && (
              <div className="mb-[18px] rounded-xl border border-[rgba(45,212,191,0.25)] bg-[rgba(45,212,191,0.12)] px-4 py-[11px] text-center text-[12.5px] leading-[1.4] font-semibold text-[#5eead4]">
                {success}
              </div>
            )}

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
                    className="absolute right-4 flex cursor-pointer items-center justify-center rounded-md p-1 text-[#64748b] transition-colors hover:text-[#cbd5e1]"
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

            <div className="my-[26px] mb-5 flex items-center text-center text-[10px] font-bold tracking-[2px] text-[#475569] before:mr-[1.2em] before:flex-1 before:border-b before:border-white/6 before:content-[''] after:ml-[1.2em] after:flex-1 after:border-b after:border-white/6 after:content-['']">
              CONNECT
            </div>

            <div className="flex justify-center gap-4">
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
                    className={cn(
                      "flex size-[46px] cursor-pointer items-center justify-center rounded-full",
                      "border border-white/8 bg-[#0b0f12] text-[#94a3b8]",
                      "shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all duration-300 ease-smooth",
                      "hover:-translate-y-1 hover:scale-[1.06]",
                      social.hover,
                    )}
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
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
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold text-[#cbd5e1]">
          {label}
        </label>
      </div>
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-[18px] text-[#64748b] transition-colors duration-200 group-focus-within:text-[#2dd4bf]">
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
            "w-full rounded-2xl border border-white/8 bg-[#0b0f12] px-12 py-4",
            "text-[14.5px] font-medium text-white outline-none transition-all duration-250 select-text",
            "placeholder:font-normal placeholder:text-[#475569]",
            "focus:border-[rgba(45,212,191,0.5)] focus:bg-[#090c0e] focus:shadow-[0_0_0_3px_rgba(45,212,191,0.15)]",
          )}
        />
        {trailing}
      </div>
    </div>
  );
}
