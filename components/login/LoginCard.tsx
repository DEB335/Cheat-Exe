"use client";

import { useEffect, useRef, useState } from "react";

import {
  ArrowRightIcon,
  DiscordIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  UserIcon,
} from "@/components/icons";
import { playClick, playSnap, playType } from "@/lib/sounds";

import { CardTitle } from "./CardTitle";
import styles from "./login-card.module.css";

/** Support server. There is no self-serve reset: the owner resets
    passwords, so "Forgot Password?" sends people here too. */
const DISCORD_URL = "https://discord.gg/Rt6FWbW8HD";

export type SignInState = "empty" | "checking" | "ready" | "invalid";

export interface LoginCardProps {
  open: boolean;
  username: string;
  password: string;
  showPassword: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
  signIn: { state: SignInState; label: string; busy: boolean };
  notice: { tone: "error" | "warn" | "ok"; text: string } | null;
  shake: number;
  usernameRef?: React.Ref<HTMLInputElement>;
}

/** Entrance order of the rows; each one starts 70ms after the last. */
const ROW = {
  title: 0,
  subtitle: 1,
  notice: 2,
  username: 2,
  password: 3,
  forgot: 4,
  signIn: 5,
  divider: 6,
  discord: 7,
} as const;

function rowStyle(index: number) {
  return { "--i": index } as React.CSSProperties;
}

/** Alternates between two identical animations so every bump of a
    counter restarts the animation without remounting anything. */
function pulse(count: number) {
  if (count === 0) return undefined;
  return count % 2 ? "a" : "b";
}

/**
 * The sign-in card from the lamp design. Purely presentational: the page
 * owns the fields, the live credential check and the submit, and passes
 * the button's state down. The stage positions and fades the card; this
 * only staggers its rows in when `open` turns true.
 */
export function LoginCard({
  open,
  username,
  password,
  showPassword,
  onUsernameChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
  signIn,
  notice,
  shake,
  usernameRef,
}: LoginCardProps) {

  // The form only goes through once the server has confirmed the pair.
  const ready = signIn.state === "ready" && !signIn.busy;
  const visualState: SignInState = signIn.busy ? "checking" : signIn.state;

  // Clicks (and Enter) on a locked button shake it instead of submitting.
  const [nudge, setNudge] = useState(0);

  // The lock chord, once each time the credentials come back valid.
  const wasReady = useRef(false);
  useEffect(() => {
    const isReady = signIn.state === "ready";
    if (isReady && !wasReady.current) playSnap();
    wasReady.current = isReady;
  }, [signIn.state]);

  return (
    <div className={styles.card} data-open={open ? "" : undefined} data-shake={pulse(shake)}>
      <span aria-hidden className={styles.halo} />
      <span aria-hidden className={styles.pane}>
        <span className={styles.glowFar} />
        <span className={styles.glowNear} />
      </span>
      <span aria-hidden className={styles.rim} />

      <CardTitle className={styles.row} style={rowStyle(ROW.title)} />

      <p className={`${styles.row} ${styles.subtitle}`} style={rowStyle(ROW.subtitle)}>
        Sign in to continue your journey
      </p>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          data-tone={notice.tone}
          className={`${styles.row} ${styles.notice}`}
          style={rowStyle(ROW.notice)}
        >
          {notice.text}
        </div>
      )}

      <form className={styles.form} onSubmit={onSubmit} autoComplete="off">
        <div className={`${styles.row} ${styles.field}`} style={rowStyle(ROW.username)}>
          <label htmlFor="logUsername" className={styles.srOnly}>
            Username
          </label>
          <UserIcon aria-hidden className={styles.fieldIcon} />
          <input
            ref={usernameRef}
            id="logUsername"
            type="text"
            required
            value={username}
            autoComplete="username"
            spellCheck={false}
            placeholder="Username"
            onFocus={playClick}
            onChange={(event) => {
              onUsernameChange(event.target.value);
              playType();
            }}
            className={styles.input}
          />
        </div>

        <div className={`${styles.row} ${styles.field}`} style={rowStyle(ROW.password)}>
          <label htmlFor="logPassword" className={styles.srOnly}>
            Password
          </label>
          <LockIcon aria-hidden className={styles.fieldIcon} />
          <input
            id="logPassword"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            autoComplete="current-password"
            placeholder="Password"
            onFocus={playClick}
            onChange={(event) => {
              onPasswordChange(event.target.value);
              playType();
            }}
            className={`${styles.input} ${styles.inputWithToggle}`}
          />
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={showPassword}
            title="Toggle password visibility"
            onClick={() => {
              playClick();
              onTogglePassword();
            }}
            className={styles.eye}
          >
            {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          </button>
        </div>

        <div className={`${styles.row} ${styles.forgotRow}`} style={rowStyle(ROW.forgot)}>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Password resets are handled by the owner -- ask on our Discord"
            onClick={() => playClick()}
            className={styles.forgot}
          >
            Forgot Password?
          </a>
        </div>

        {/* Stays a real submit button so Enter works -- but it is never
            `disabled` (a disabled button cannot shake), so a locked click
            or Enter is cancelled here instead. The page guards as well. */}
        <div className={styles.row} style={rowStyle(ROW.signIn)}>
          <button
            type="submit"
            data-state={visualState}
            data-nudge={pulse(nudge)}
            aria-disabled={!ready}
            aria-busy={visualState === "checking"}
            onClick={(event) => {
              if (ready) {
                playClick();
                return;
              }
              event.preventDefault();
              setNudge((n) => n + 1);
            }}
            className={styles.signIn}
          >
            <span aria-hidden className={styles.signInGlow} />
            <span aria-hidden className={styles.signInGlowRed} />
            <span aria-hidden className={styles.signInFill} />
            <span aria-hidden className={styles.signInRed} />
            <span aria-hidden className={styles.signInClip}>
              <span className={styles.signInShimmer} />
            </span>
            <span aria-hidden className={styles.signInEdge} />
            <span className={styles.signInLabel}>
              <ArrowRightIcon aria-hidden className={styles.signInArrow} />
              {signIn.label}
            </span>
          </button>
        </div>
      </form>

      <div className={`${styles.row} ${styles.divider}`} style={rowStyle(ROW.divider)}>
        or
      </div>

      <div className={styles.row} style={rowStyle(ROW.discord)}>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => playClick()}
          className={styles.discord}
        >
          <DiscordIcon aria-hidden className={styles.discordLogo} />
          <span className={styles.discordLabel}>Join us on Discord</span>
        </a>
      </div>
    </div>
  );
}
