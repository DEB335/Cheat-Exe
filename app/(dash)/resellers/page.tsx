"use client";

import { useMemo, useState } from "react";

import { ActiveResellersPanel, type ResellerActions } from "@/components/resellers/ActiveResellersPanel";
import { CreateResellerPanel } from "@/components/resellers/CreateResellerPanel";
import { togglePackage } from "@/components/resellers/PackageToggles";
import { PassModal, PermsModal, RenewModal } from "@/components/resellers/ResellerModals";
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

  const patch = async (name: string, body: Record<string, unknown>, message: string) => {
    // Status is the one field worth painting ahead of the server -- it is
    // the visible result of the click. Everything else lands on the
    // refresh, which no longer blocks the confirmation.
    const snapshot =
      typeof body.status === "string"
        ? patchDb((db) => applyResellerStatus(db, name, body.status as ResellerStatus))
        : null;
    toast(message, "success");
    try {
      await patchJson(`/api/resellers/${encodeURIComponent(name)}`, body);
      void refresh();
    } catch (err) {
      if (snapshot) restore(snapshot);
      toast((err as Error).message, "error");
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete reseller ${name}?`)) return;
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
    openPass: (name) => {
      setPassFor(name);
      setNewPass("");
      setShowPass(false);
    },
    openRenew: (name, user) => {
      setRenewFor(name);
      // Prefill with days still left (or 30 for an account with no end
      // date), and the current key limit.
      const left = daysLeft(user);
      setRenewDays(String(left && left > 0 ? left : 30));
      setRenewLimit(user.keyLimit ? String(user.keyLimit) : "");
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
        onDays={setRenewDays}
        onLimit={setRenewLimit}
        onClose={() => setRenewFor(null)}
        onSave={async () => {
          if (renewFor) {
            await patch(
              renewFor,
              { validityDays: Number(renewDays) || 0, keyLimit: Number(renewLimit) || 0 },
              `Validity and limit updated for ${renewFor}.`,
            );
          }
          setRenewFor(null);
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
    </>
  );
}
