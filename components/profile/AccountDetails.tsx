"use client";

import { useState } from "react";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon, LinkIcon, LockIcon, UserIcon } from "@/components/icons";
import {
  ImageIcon,
  NeonButton,
  NeonChip,
  NeonCta,
  NeonInput,
  NeonInset,
  NeonPanel,
  PanelHeader,
  SaveIcon,
  type NeonTone,
} from "@/components/neon";
import { CloudScene } from "@/components/scenes/ProfileScenes";
import { useToast } from "@/components/ui/Toast";
import { patchJson } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";
import type { ResellerStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Resellers keep the read-only treatment the original applied to them:
 * the whole field dimmed to 70% (the kit's own disabled fade is undone
 * on the input so the two do not stack) with a not-allowed cursor.
 */
const LOCKED_BOX = "cursor-not-allowed opacity-70";
const LOCKED_INPUT = "disabled:opacity-100";

/**
 * The reseller's own standing, where the mockup has "Account Verified".
 * Nothing verifies an account here, so that line would be made up; this
 * is the same verdict the login and the reseller table act on.
 */
const STANDING: Record<ResellerStatus, { tone: NeonTone; label: string }> = {
  ACTIVE: { tone: "green", label: "Account Active" },
  EXPIRED: { tone: "red", label: "Account Expired" },
  SUSPENDED: { tone: "amber", label: "Account Suspended" },
  "PENDING APPROVAL": { tone: "blue", label: "Pending Approval" },
};

/**
 * Where the cloud sits: in the header's empty middle, never over the
 * title or the fields. Measured against the panel's content box (it is
 * the @container), since both desktop widths clear every viewport
 * breakpoint. A wide panel gets the full 440x140 scene; a 1280px
 * screen's narrower panel a 300px copy tucked in the corner; the
 * single-column layout none. A reseller's status pill holds the
 * header's right end, so their cloud waits for a wider panel and keeps
 * to the pill's left.
 */
const CLOUD_BOX = {
  owner: "hidden @min-[780px]:block @min-[780px]:top-3 @min-[780px]:right-10 @min-[780px]:h-[96px] @min-[780px]:w-[300px]",
  reseller:
    "hidden @min-[940px]:block @min-[940px]:top-3 @min-[940px]:right-[210px] @min-[940px]:h-[96px] @min-[940px]:w-[300px]",
};
const CLOUD_WIDE = "@min-[1180px]:top-1 @min-[1180px]:right-[230px] @min-[1180px]:h-[140px] @min-[1180px]:w-[440px]";

export function AccountDetails({
  isOwner,
  initial,
  resellerName,
  status,
  avatarRef,
}: {
  isOwner: boolean;
  initial: { username: string; displayName: string; avatar: string; banner: string };
  resellerName: string;
  /** A reseller's effective status; null for the owner. */
  status: ResellerStatus | null;
  /** Lets the profile card's edit button jump to the avatar field. */
  avatarRef?: React.Ref<HTMLInputElement>;
}) {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);

  const [avatar, setAvatar] = useState(initial.avatar);
  const [banner, setBanner] = useState(initial.banner);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await patchJson("/api/profile", { username, password, displayName, avatar, banner });
      setPassword("");
      await refresh();
      toast("Profile changes saved successfully!", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied to clipboard!`, "success");
    } catch {
      toast("Could not copy -- the browser refused clipboard access.", "error");
    }
  };

  const locked = isOwner ? {} : { boxClassName: LOCKED_BOX, inputClassName: LOCKED_INPUT };
  const standing = status ? STANDING[status] : null;

  return (
    <NeonPanel rim="blue" className="@container">
      <CloudScene
        className={cn("pointer-events-none absolute", standing ? CLOUD_BOX.reseller : CLOUD_BOX.owner, CLOUD_WIDE)}
      />

      {/* The full-size scene's platform reaches ~144px down the panel;
          the wider gap under the header lets it rest on the fields'
          top edge rather than sink behind them. */}
      <PanelHeader
        icon={<UserIcon />}
        iconTone="teal"
        iconTone2="cyan"
        title="Account Details"
        subtitle={
          isOwner ? "Update your avatar and account information." : "View only. The owner manages these details."
        }
        actions={
          standing ? (
            <NeonChip
              tone={standing.tone}
              size="md"
              shape="pill"
              caps={false}
              dot={status !== "ACTIVE"}
              icon={status === "ACTIVE" ? <CheckIcon strokeWidth={3} /> : undefined}
            >
              {standing.label}
            </NeonChip>
          ) : undefined
        }
        className="relative z-[1] @min-[1180px]:mb-12"
      />

      <NeonInset rim="blue" className="relative z-[1] grid gap-5 @min-[640px]:grid-cols-2">
        <NeonInput
          variant="card"
          id="profAvatar"
          ref={avatarRef}
          label="Avatar Image URL"
          tone="blue"
          leftIcon={<LinkIcon />}
          value={avatar}
          disabled={!isOwner}
          onChange={(event) => setAvatar(event.target.value)}
          rightSlot={<CopyButton tone="blue" what="Avatar URL" disabled={!avatar} onCopy={() => copy(avatar, "Avatar URL")} />}
          {...locked}
        />
        <NeonInput
          variant="card"
          id="profBanner"
          label="Banner Image URL"
          tone="violet"
          leftIcon={<ImageIcon />}
          value={banner}
          disabled={!isOwner}
          onChange={(event) => setBanner(event.target.value)}
          rightSlot={<CopyButton tone="violet" what="Banner URL" disabled={!banner} onCopy={() => copy(banner, "Banner URL")} />}
          {...locked}
        />
        <NeonInput
          variant="card"
          id="profDisplayName"
          label="Display Name"
          tone="violet"
          leftIcon={<UserIcon />}
          value={displayName}
          disabled={!isOwner}
          onChange={(event) => setDisplayName(event.target.value)}
          className="@min-[640px]:col-span-2"
          {...locked}
        />
        <NeonInput
          variant="card"
          id="profUser"
          label="Username"
          tone="teal"
          leftIcon={<UserIcon />}
          value={isOwner ? username : resellerName}
          disabled={!isOwner}
          onChange={(event) => setUsername(event.target.value)}
          {...locked}
        />
        {/* The stored value is a hash, so this starts empty and only
            submits when the owner types a new password. */}
        <NeonInput
          variant="card"
          id="profPass"
          label="Password"
          tone="amber"
          leftIcon={<LockIcon />}
          type={showPassword ? "text" : "password"}
          value={password}
          disabled={!isOwner}
          placeholder="Enter a new password"
          onChange={(event) => setPassword(event.target.value)}
          rightSlot={
            <NeonButton
              tone="amber"
              variant="ghost"
              size="xs"
              // One signal for the state: the pressed flag. A label that
              // flipped as well would read "Hide password, pressed".
              aria-label="Show password"
              aria-pressed={showPassword}
              icon={showPassword ? <EyeOffIcon /> : <EyeIcon />}
              disabled={!isOwner}
              onClick={() => setShowPassword((shown) => !shown)}
            />
          }
          {...locked}
        />
      </NeonInset>

      <div className="relative z-[1] mt-7 flex justify-end">
        <NeonCta
          icon={<SaveIcon />}
          loading={saving}
          disabled={!isOwner}
          onClick={save}
          className="max-sm:w-full"
        >
          {saving ? "Saving..." : "Save Changes"}
        </NeonCta>
      </div>
    </NeonPanel>
  );
}

/**
 * Stays live in a reseller's locked field on purpose: a disabled input's
 * text cannot be selected, so this is their only way to copy the URL,
 * and it only reads the value.
 */
function CopyButton({
  tone,
  what,
  disabled,
  onCopy,
}: {
  tone: NeonTone;
  what: string;
  disabled: boolean;
  onCopy: () => void;
}) {
  return (
    <NeonButton
      tone={tone}
      size="xs"
      aria-label={`Copy ${what}`}
      title={`Copy ${what}`}
      icon={<CopyIcon />}
      disabled={disabled}
      onClick={onCopy}
    />
  );
}
