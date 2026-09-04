import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { withLivePackages } from "@/lib/auth";
import { SESSION_COOKIE, readSessionState, secondsUntil } from "@/lib/session";

import { Shell } from "./shell";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const store = await cookies();
  const state = await readSessionState(store.get(SESSION_COOKIE)?.value);

  if (state.status !== "valid") {
    // Carry the reason across, so a session that simply ran out of time
    // says so. The poll in Shell normally gets there first and shows the
    // notice in place, but it cannot when nothing is mounted to run it:
    // a tab that was closed before the deadline and reopened after it
    // arrives straight here, and without this would land on a blank
    // sign-in form with no hint that anything had expired.
    redirect(state.status === "expired" ? "/login?reason=timeout" : "/login");
  }

  // How long this session has left, resolved here rather than in the
  // browser. The deadline is the server's, and a client whose clock runs
  // fast or slow would otherwise place it minutes off; a remaining count
  // started at mount is immune to that, since only the elapsed time
  // matters and both agree on how long a second is.
  // Permissions resolved from the account record, not from the copy the
  // token was signed with. Without this a hard reload paints the sidebar
  // from a grant that may have been revoked hours ago, and the section
  // only vanishes once the first /api/db lands.
  const user = await withLivePackages(state.user);

  return (
    <Shell user={user} expiresIn={secondsUntil(state.expiresAt)}>
      {children}
    </Shell>
  );
}
