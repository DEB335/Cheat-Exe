"use client";

import { useMemo, useState } from "react";

import { ActiveResellersPanel, type ResellerActions } from "@/components/resellers/ActiveResellersPanel";
import { CreateResellerPanel } from "@/components/resellers/CreateResellerPanel";
import { togglePackage } from "@/components/resellers/PackageToggles";
import { PassModal, PermsModal, RenewModal, ManageModal } from "@/components/resellers/ResellerModals";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { del, patchJson } from "@/lib/client-api";
import {
  applyRemoveReseller,
  applyResellerStatus,
} from "@/lib/optimistic";
import { PACKAGE_NAMES } from "@/lib/packages";
import { daysLeft } from "@/lib/reseller";
import { useDashboard } from "@/lib/store";
import type { ResellerStatus } from "@/lib/types";

export default function ResellersPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const patchDb = useDashboard((s) => s.patch);
  const restore = useDashboard((s) => s.restore);

  // The packages the provider currently offers, not the ones compiled
  // in. The store refreshes this from get_admin_packages, which is how
  // the generator already knew about a package this page did not: a
  // grant list that cannot name a package cannot give it away.
  const offered = useDashboard((s) => s.packages);
  const packageNames = useMemo(
    () => (offered.length > 0 ? offered.map((p) => p.name) : PACKAGE_NAMES),
    [offered],
  );

  const [permsFor, setPermsFor] = useState<string | null>(null);
  const [permsDraft, setPermsDraft] = useState<string[]>([]);
  const [passFor, setPassFor] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [renewLimit, setRenewLimit] = useState("");
  const [renewEmulatorCredits, setRenewEmulatorCredits] = useState("0");
  const [renewEmulatorAllowedDays, setRenewEmulatorAllowedDays] = useState<number[]>([1, 3, 7, 30, 60, 90, 180, 365]);

  const [manageFor, setManageFor] = useState<string | null>(null);
  const [manageUidBypass, setManageUidBypass] = useState(false);
  const [manageEmulatorBypass, setManageEmulatorBypass] = useState(false);

  const patch = async (name: string, body: Record<string, unknown>, message: string) => {
    const snapshot = patchDb((db) => {
      const users = { ...db.cheatExeUsers };
      const targetKey =
        Object.keys(users).find((k) => k.toLowerCase() === name.toLowerCase()) || name;
      if (users[targetKey]) {
        users[targetKey] = {
          ...users[targetKey],
          ...(body.status ? { status: body.status as ResellerStatus } : {}),
          ...(body.uidBypassAccess !== undefined
            ? { uidBypassAccess: Boolean(body.uidBypassAccess) }
            : {}),
          ...(body.emulatorBypassAccess !== undefined
            ? { emulatorBypassAccess: Boolean(body.emulatorBypassAccess) }
            : {}),
          ...(body.emulatorCredits !== undefined
            ? { emulatorCredits: Number(body.emulatorCredits) }
            : {}),
          ...(body.emulatorAllowedDays !== undefined
            ? { emulatorAllowedDays: body.emulatorAllowedDays as number[] }
            : {}),
          ...(body.packages !== undefined ? { packages: body.packages as string[] } : {}),
          ...(body.keyLimit !== undefined ? { keyLimit: Number(body.keyLimit) } : {}),
          ...(body.validityDays !== undefined
            ? {
                expiresAt:
                  Number(body.validityDays) > 0
                    ? new Date(Date.now() + Number(body.validityDays) * 86_400_000).toISOString()
                    : undefined,
              }
            : {}),
        };
      }
      return { ...db, cheatExeUsers: users };
    });
    toast(message, "success");
    try {
      await patchJson(`/api/resellers/${encodeURIComponent(name)}`, body);
      void refresh();
    } catch (err) {
      if (snapshot) restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const remove = async (name: string) => {
    setDeleteTarget(name);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget;
    setDeleteTarget(null);
    const snapshot = patchDb((db) => applyRemoveReseller(db, name));
    toast("Reseller deleted.", "success");
    try {
      await del(`/api/resellers/${encodeURIComponent(name)}`);
      void refresh();
    } catch (err) {
      restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  const actions: ResellerActions = {
    patch,
    remove,
    openPerms: (name, user) => {
      setPermsFor(name);
      setPermsDraft(user.packages);
    },
    openManage: (name, user) => {
      setManageFor(name);
      setManageUidBypass(Boolean(user.uidBypassAccess));
      setManageEmulatorBypass(Boolean(user.emulatorBypassAccess));
    },
    openPass: (name) => {
      setPassFor(name);
      setNewPass("");
      setShowPass(false);
    },
    openRenew: (name, user) => {
      setRenewFor(name);
      // Prefill with days still left (or 30 for an account with no end
      // date), and the current key limit and emulator config.
      const left = daysLeft(user);
      setRenewDays(String(left && left > 0 ? left : 30));
      setRenewLimit(user.keyLimit ? String(user.keyLimit) : "");
      setRenewEmulatorCredits(String(user.emulatorCredits ?? 0));
      setRenewEmulatorAllowedDays(user.emulatorAllowedDays ?? [1, 3, 7, 30, 60, 90, 180, 365]);
    },
  };

  return (
    <>
      <CreateResellerPanel packageNames={packageNames} />
      <ActiveResellersPanel actions={actions} />

      <RenewModal
        name={renewFor}
        days={renewDays}
        limit={renewLimit}
        emulatorCredits={renewEmulatorCredits}
        emulatorAllowedDays={renewEmulatorAllowedDays}
        onDays={setRenewDays}
        onLimit={setRenewLimit}
        onEmulatorCredits={setRenewEmulatorCredits}
        onToggleAllowedDay={(day) => {
          setRenewEmulatorAllowedDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
          );
        }}
        onClose={() => setRenewFor(null)}
        onSave={async () => {
          if (renewFor) {
            const credits = Number(renewEmulatorCredits) || 0;
            await patch(
              renewFor,
              {
                validityDays: Number(renewDays) || 0,
                keyLimit: Number(renewLimit) || 0,
                emulatorCredits: credits,
                emulatorAllowedDays: renewEmulatorAllowedDays,
              },
              `Validity, limits and emulator configuration updated for ${renewFor}.`,
            );
          }
          setRenewFor(null);
        }}
      />

      <ManageModal
        name={manageFor}
        uidBypassAccess={manageUidBypass}
        emulatorBypassAccess={manageEmulatorBypass}
        onUidBypassAccess={setManageUidBypass}
        onEmulatorBypassAccess={setManageEmulatorBypass}
        onClose={() => setManageFor(null)}
        onSave={async () => {
          const target = manageFor;
          setManageFor(null);
          if (target) {
            await patch(
              target,
              {
                uidBypassAccess: manageUidBypass,
                emulatorBypassAccess: manageEmulatorBypass,
              },
              `Access updated for ${target}.`,
            );
          }
        }}
      />

      <PermsModal
        name={permsFor}
        packageNames={packageNames}
        draft={permsDraft}
        onToggle={(name, on) => togglePackage(name, on, setPermsDraft)}
        onClose={() => setPermsFor(null)}
        onSave={async () => {
          if (permsFor) await patch(permsFor, { packages: permsDraft }, "Permissions updated.");
          setPermsFor(null);
        }}
      />

      <PassModal
        name={passFor}
        value={newPass}
        shown={showPass}
        onValue={setNewPass}
        onToggleShown={() => setShowPass((v) => !v)}
        onClose={() => setPassFor(null)}
        onSave={async () => {
          if (passFor) await patch(passFor, { password: newPass }, "Password updated.");
          setPassFor(null);
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Reseller"
        description={`Are you sure you want to permanently remove reseller "${deleteTarget}"? This cannot be undone.`}
        confirmText="Delete Reseller"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
