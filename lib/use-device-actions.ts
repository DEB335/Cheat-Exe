"use client";

import { useToast } from "@/components/ui/Toast";

import { del, postJson } from "./client-api";
import { applyKickDevice } from "./optimistic";
import { useDashboard } from "./store";
import type { BanScope } from "./types";

/**
 * The two things anyone can do to a live session, shared by the
 * overview's device list and the full monitor on /devices so both
 * confirm, update and report the same way.
 */
export function useDeviceActions() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const patchDb = useDashboard((s) => s.patch);
  const restore = useDashboard((s) => s.restore);

  const kick = async (sessionId: string, name: string) => {
    if (!confirm(`Kick and ban the session for ${name}?`)) return;
    // The row disappears on click; the write and the vault entry that
    // follows it catch up behind.
    const snapshot = patchDb((db) => applyKickDevice(db, sessionId));
    toast(`Device session for user '${name}' has been kicked!`, "success");
    try {
      await del(`/api/devices/${encodeURIComponent(sessionId)}`);
      void refresh();
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  /**
   * Blocks at the connection rather than the account.
   *
   * Kicking suspends one reseller; this stops the address or the machine
   * reaching *any* account, and is checked before the password is, so a
   * blocked device cannot even probe for valid credentials.
   */
  const block = async (
    rules: Array<{ scope: BanScope; value: string }>,
    label: string,
    name: string,
  ) => {
    if (!confirm(`Block ${label} for ${name}? Nobody will be able to sign in from it.`)) return;
    toast(`${label} blocked.`, "success");
    try {
      await postJson("/api/bans", { rules, reason: `Blocked from Active Devices`, user: name });
      // A block also ends sessions it now covers, so take the real list.
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
      void refresh();
    }
  };

  return { kick, block };
}

/** The HWID and fingerprint rules for one session -- empty when it predates device tracking. */
export function deviceRules(device: { hwid?: string; fingerprint?: string }) {
  return [
    ...(device.hwid ? [{ scope: "hwid" as BanScope, value: device.hwid }] : []),
    ...(device.fingerprint ? [{ scope: "fingerprint" as BanScope, value: device.fingerprint }] : []),
  ];
}
