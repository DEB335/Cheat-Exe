"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

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
  const [banned, setBanned] = useState<string | null>(null);
  // The original login page forces music on and unmutes at the first
  // interaction; only the dashboard starts silent.
  const [muted, setMuted] = useState(false);
  useAutoUnmute(!muted);

  // The button locks home once the form is complete; red is reserved for
  // a rejected submit, which only the server can decide.
  const state: TetherState = error ? "invalid" : username && password ? "ready" : "empty";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      if (message === "BANNED") {
        setBanned(username.toUpperCase());
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

  if (banned) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#090e11]">
        <h1 className="mb-3 text-[28px] tracking-[2px] text-[#ef4444]">ACCOUNT TERMINATED</h1>
        <p className="mb-5 text-[14px] text-[#94a3b8]">
          Access to this platform has been revoked.
        </p>
        <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-5 py-3">
          <span className="text-[#f87171]">USER: {banned}</span>
        </div>
      </div>
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
              Welcome back. Two fields stand between you and that button.
            </p>

            {error && (
              <div className="mb-[18px] rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.12)] px-4 py-[11px] text-center text-[12.5px] leading-[1.4] font-semibold text-[#fca5a5]">
                {error}
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
                label={busy ? "Signing in..." : "Log in"}
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
