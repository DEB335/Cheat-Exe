import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_FIELDS, withLivePackages } from "@/lib/auth";
import { accountBlock, readSlice } from "@/lib/db";
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

  // Ensure account is still valid, not deleted, suspended, or kicked
  const accessDb = await readSlice([...ACCESS_FIELDS, "cheatExeDevices"]);
  const blocked = accountBlock(accessDb, state.user.username, state.user.role);
  if (blocked) {
    redirect(`/login?reason=${blocked}`);
  }

  const kicked =
    state.user.role !== "OWNER" &&
    !accessDb.cheatExeDevices.some((d) => d.sessionId === state.user.sessionId);
  if (kicked) {
    redirect("/login?reason=kicked");
  }

  const user = await withLivePackages(state.user);

  return (
    <Shell user={user} expiresIn={secondsUntil(state.expiresAt)}>
      {children}
    </Shell>
  );
}
