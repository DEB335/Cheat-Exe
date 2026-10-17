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
    patchDb((db) => {
      const newBans = rules.map((r) => ({
        scope: r.scope,
        value: r.value,
        reason: "Blocked from Active Devices",
        by: "Owner",
        user: name,
        at: new Date().toISOString(),
      }));
      const ruleValues = new Set(rules.map((r) => r.value.toLowerCase()));
      const remainingDevices = db.cheatExeDevices.filter((d) => {
        if (ruleValues.has(d.ip.toLowerCase())) return false;
        if (d.hwid && ruleValues.has(d.hwid.toLowerCase())) return false;
        if (d.fingerprint && ruleValues.has(d.fingerprint.toLowerCase())) return false;
        return true;
      });
      return {
        ...db,
        cheatExeBans: [...newBans, ...db.cheatExeBans],
        cheatExeDevices: remainingDevices,
      };
    });
    toast(`${label} blocked.`, "success");
    try {
      await postJson("/api/bans", { rules, reason: `Blocked from Active Devices`, user: name });
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
