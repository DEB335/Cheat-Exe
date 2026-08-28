"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckIcon, DiscordIcon, LogOutIcon, UserIcon } from "@/components/icons";
import { GlowingPackageBadge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/buttons";
import { FormLabel, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/Toast";
import { api, patchJson } from "@/lib/client-api";
import { shortPackageLabel } from "@/lib/packages";
import { daysLeft, effectiveStatus, formatExpiry } from "@/lib/reseller";
import { useDashboard } from "@/lib/store";
import { cn } from "@/lib/utils";

const DISCORD = "https://discord.gg/Rt6FWbW8HD";

/** Resellers keep the read-only treatment the original applied to them. */
const LOCKED = "opacity-70 cursor-not-allowed bg-white/2";

export default function ProfilePage() {
  const router = useRouter();
  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);

  const isOwner = user?.role === "OWNER";
  const { avatar, banner, displayName } = db.profile;
  const shownName = isOwner ? displayName : (user?.username ?? "");

  // A reseller's own record comes down with /api/db, so the card can say
  // when their access ends rather than just "Paid" -- the whole point of
  // the validity is that they can see it running out.
  const own = Object.entries(db.cheatExeUsers).find(
    ([name]) => name.toLowerCase() === (user?.username ?? "").toLowerCase(),
  )?.[1];
  const left = own ? daysLeft(own) : null;
  const status = own ? effectiveStatus(own) : null;

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <div className="grid gap-[30px] lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-[30px]">
        <div className="card-surface flex flex-col items-center rounded-[20px] border border-line p-[30px] text-center">
          <div className="relative mb-[-55px] h-[110px] w-full overflow-hidden rounded-[14px] border border-line bg-[linear-gradient(135deg,#1e1b4b,#311042)]">
            {/* Remote GIFs from an arbitrary CDN -- next/image would need a
                configured loader for no benefit. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="size-full object-cover" />
          </div>

          <div className="z-[2] mb-4 size-24 overflow-hidden rounded-full border-4 border-transparent bg-input-bg shadow-[0_4px_15px_rgba(0,0,0,0.5)] lt:border-[#f8fafc]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt="" className="size-full object-cover" />
          </div>

          <div className="mb-1 font-display text-[18px] font-extrabold text-fg">{shownName}</div>

          <div className="mb-6 flex w-full flex-col gap-3.5 border-t border-line pt-5 text-left">
            <MetaRow label="Role">
              <span className="flex items-center gap-1.5 rounded-lg bg-[rgba(168,85,247,0.12)] px-2.5 py-1 font-extrabold text-purple">
                <CheckIcon className="size-3" strokeWidth={2.5} />
                {isOwner ? "Account Owner" : "Reseller"}
              </span>
            </MetaRow>
            {/* No creation date is stored for the owner account, only for
                resellers (`own.created`) -- omit rather than invent one. */}
            {own?.created && (
              <MetaRow label="Joined">
                <span className="font-bold text-fg">{own.created}</span>
              </MetaRow>
            )}
            <MetaRow label="Subscription Tier">
              <span className="font-extrabold text-green">{isOwner ? "Owner" : "Paid"}</span>
            </MetaRow>

            {!isOwner && own && (
              <>
                {/* Straight off `own`, the record /api/db refreshes -- so a
                    panel the owner grants or revokes shows up here on the
                    next ping rather than at the next sign-in. */}
                <MetaRow label="Panels">
                  <div className="flex max-w-[175px] flex-wrap justify-end gap-0.5">
                    {own.packages.length > 0 ? (
                      own.packages.map((pkg) => (
                        <GlowingPackageBadge key={pkg}>{shortPackageLabel(pkg)}</GlowingPackageBadge>
                      ))
                    ) : (
                      <span className="m-0.5 inline-block rounded-full border border-white/10 px-2.5 py-[3px] text-[9.5px] font-[750] tracking-[0.8px] text-muted uppercase">
                        None
                      </span>
                    )}
                  </div>
                </MetaRow>

                <MetaRow label="Valid Until">
                  <span
                    className={cn(
                      "font-extrabold",
                      left === null
                        ? "text-green"
                        : left <= 0
                          ? "text-[#ef4444]"
                          : left <= 7
                            ? "text-orange"
                            : "text-fg",
                    )}
                  >
                    {left === null ? "No end date" : formatExpiry(own)}
                  </span>
                </MetaRow>

                {left !== null && (
                  <MetaRow label="Days Remaining">
                    <span
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-extrabold",
                        left <= 0
                          ? "bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
                          : left <= 7
                            ? "bg-orange-glow text-orange"
                            : "bg-green-glow text-green",
                      )}
                    >
                      {left <= 0 ? "EXPIRED" : `${left} day${left === 1 ? "" : "s"} left`}
                    </span>
                  </MetaRow>
                )}

                {status === "EXPIRED" && (
                  <p className="rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11.5px] leading-[1.45] text-[#fca5a5]">
                    Your access has ended. Ask the owner to renew it.
                  </p>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => window.open(DISCORD, "_blank", "noopener,noreferrer")}
            className={cn(
              "group relative mb-3 flex w-full cursor-pointer items-center justify-center overflow-hidden",
              "rounded-[25px] border border-[rgb(24,119,242)] bg-transparent px-[15px] py-[5px]",
              "text-[17px] font-semibold text-[rgb(24,119,242)] outline-none",
              "transition-colors delay-100 duration-300 ease-out hover:text-white",
              // Circle that expands via inset box-shadow to flood the button.
              "before:absolute before:inset-0 before:-left-[5em] before:z-[-1] before:m-auto",
              "before:block before:size-[20em] before:rounded-full before:transition-shadow before:duration-500 before:content-['']",
              "hover:before:shadow-[inset_0_0_0_10em_rgb(24,119,242)]",
            )}
          >
            <span className="z-[1] flex size-[26px] items-center justify-center rounded-full bg-[rgb(24,119,242)] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-[rgb(24,119,242)]">
              <DiscordIcon className="size-3.5" />
            </span>
            <span className="z-[1] m-2.5">Discord</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className={cn(
              "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[22px]",
              "border border-[#e62843] bg-[linear-gradient(to_bottom,#601418,#ad1d25)]",
              "text-[13.5px] font-bold text-white shadow-[0_4px_15px_rgba(230,40,67,0.25)]",
              "transition-all duration-300 select-none",
              "hover:-translate-y-px hover:bg-[linear-gradient(to_bottom,#781c20,#c42730)]",
              "hover:shadow-[0_6px_20px_rgba(230,40,67,0.45)] active:translate-y-0",
            )}
          >
            <LogOutIcon className="size-[15px]" strokeWidth={2.5} />
            Logout
          </button>
        </div>
      </div>

      {/* Keyed on the saved values: a successful save refreshes the store,
          which remounts the form with the new defaults. Typing does not
          change the store, so edits are never clobbered mid-flight. */}
      <AccountDetails
        key={`${db.adminUser}|${displayName}|${avatar}|${banner}`}
        isOwner={isOwner}
        initial={{ username: db.adminUser, displayName, avatar, banner }}
        resellerName={user?.username ?? ""}
      />
    </div>
  );
}

function AccountDetails({
  isOwner,
  initial,
  resellerName,
}: {
  isOwner: boolean;
  initial: { username: string; displayName: string; avatar: string; banner: string };
  resellerName: string;
}) {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);

  const [avatar, setAvatar] = useState(initial.avatar);
  const [banner, setBanner] = useState(initial.banner);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
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

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="card-surface glow-ring hover:glow-ring-slow relative rounded-[20px] border border-line p-[30px]">
        <h3 className="mb-6 flex items-center gap-2.5 font-display text-[16px] font-[850] tracking-[1px] text-fg uppercase">
          <UserIcon className="size-[18px] text-purple" />
          Account Details
        </h3>

        <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
          <div>
            <FormLabel htmlFor="profAvatar">Avatar Image URL</FormLabel>
            <Input
              id="profAvatar"
              value={avatar}
              disabled={!isOwner}
              onChange={(event) => setAvatar(event.target.value)}
              className={isOwner ? "bg-white/5" : LOCKED}
            />
          </div>
          <div>
            <FormLabel htmlFor="profBanner">Banner Image URL</FormLabel>
            <Input
              id="profBanner"
              value={banner}
              disabled={!isOwner}
              onChange={(event) => setBanner(event.target.value)}
              className={isOwner ? "bg-white/5" : LOCKED}
            />
          </div>
        </div>

        <div className="mb-5 grid gap-5">
          <div>
            <FormLabel htmlFor="profDisplayName">Display Name</FormLabel>
            <Input
              id="profDisplayName"
              value={displayName}
              disabled={!isOwner}
              onChange={(event) => setDisplayName(event.target.value)}
              className={isOwner ? "bg-white/5" : LOCKED}
            />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
          <div>
            <FormLabel htmlFor="profUser">Username</FormLabel>
            <Input
              id="profUser"
              value={isOwner ? username : resellerName}
              disabled={!isOwner}
              onChange={(event) => setUsername(event.target.value)}
              className={isOwner ? "bg-white/5" : LOCKED}
            />
          </div>
          <div>
            <FormLabel htmlFor="profPass">Password</FormLabel>
            {/* The stored value is a hash, so this starts empty and only
                submits when the owner types a new password. */}
            <Input
              id="profPass"
              type="password"
              value={password}
              disabled={!isOwner}
              placeholder="Enter a new password"
              onChange={(event) => setPassword(event.target.value)}
              className={isOwner ? "bg-white/5" : LOCKED}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <PrimaryButton
            onClick={save}
            disabled={!isOwner || saving}
            className="h-[46px] w-auto min-w-[160px] p-0"
            innerClassName="px-6 text-[11.5px] tracking-[1px]"
          >
            {saving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-[10px] font-extrabold tracking-[1px] text-muted uppercase">{label}</span>
      {children}
    </div>
  );
}
