"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import { AccountDetails } from "@/components/profile/AccountDetails";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { api } from "@/lib/client-api";
import { daysLeft, effectiveStatus } from "@/lib/reseller";
import { useDashboard } from "@/lib/store";

export default function ProfilePage() {
  const router = useRouter();
  const user = useDashboard((s) => s.user);
  const db = useDashboard((s) => s.db);
  const avatarField = useRef<HTMLInputElement>(null);

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
    <div className="grid gap-[30px] lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[370px_minmax(0,1fr)]">
      <ProfileCard
        isOwner={isOwner}
        name={shownName}
        avatar={avatar}
        banner={banner}
        own={own}
        left={left}
        status={status}
        // Only the owner can edit the avatar, so only the owner gets the
        // pencil. focus() also scrolls the field into view on a phone.
        onEditAvatar={isOwner ? () => avatarField.current?.focus() : undefined}
        onLogout={logout}
      />

      {/* Keyed on the saved values: a successful save refreshes the store,
          which remounts the form with the new defaults. Typing does not
          change the store, so edits are never clobbered mid-flight. */}
      <AccountDetails
        key={`${db.adminUser}|${displayName}|${avatar}|${banner}`}
        isOwner={isOwner}
        initial={{ username: db.adminUser, displayName, avatar, banner }}
        resellerName={user?.username ?? ""}
        status={isOwner ? null : status}
        avatarRef={avatarField}
      />
    </div>
  );
}
