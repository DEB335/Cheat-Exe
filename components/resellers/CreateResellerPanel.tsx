"use client";

import { useId, useState } from "react";

import { CalendarIcon, KeyIcon, LockIcon, UserIcon, UserPlusIcon } from "@/components/icons";
import { IconTile, NeonCta, NeonInput, NeonLabel, NeonPanel, NeonToggle, PanelHeader } from "@/components/neon";
import { ResellerScene } from "@/components/scenes/ResellerScene";
import { useToast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client-api";
import { useDashboard } from "@/lib/store";

import { PackageToggles, togglePackage } from "./PackageToggles";

/**
 * The create form, with the reseller hologram standing beside it.
 *
 * `packageNames` is the live grant vocabulary (see the page), so a
 * package the provider added since the last deploy can be granted here.
 */
export function CreateResellerPanel({ packageNames }: { packageNames: string[] }) {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const packagesLabel = useId();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // By default all packages are unselected (off)
  const [packages, setPackagesState] = useState<string[]>([]);
  const setPackages = (updater: (current: string[]) => string[]) =>
    setPackagesState((current) => updater(current));
  const [validityDays, setValidityDays] = useState("30");
  const [keyLimit, setKeyLimit] = useState("");
  const [deviceLocked, setDeviceLocked] = useState(true);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await postJson("/api/resellers", {
        username,
        password,
        packages,
        validityDays: Number(validityDays) || 0,
        keyLimit: Number(keyLimit) || 0,
        deviceLocked,
      });
      setUsername("");
      setPassword("");
      setPackagesState([]);
      toast("Reseller created successfully!", "success");
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeonPanel rim="aurora" className="mb-6">
      <div className="relative z-10">
        <div className="min-w-0">
          <PanelHeader
            title="Create Reseller Account"
            subtitle="Give dashboard access to sub-users."
            className="sm:pr-14 lg:pr-0"
          />

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <NeonInput
              id="resUser"
              label="Reseller Username"
              tone="red"
              leftIcon={<UserIcon />}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
            />
            <NeonInput
              id="resPass"
              label="Password (min 4 chars)"
              tone="red"
              leftIcon={<LockIcon />}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
            />
            {/* Unlike the key generator's validity -- which the upstream API
                ignores -- this one is enforced here, because the panel owns
                reseller accounts outright. */}
            <NeonInput
              id="resValidity"
              label="Validity (days)"
              tone="red"
              leftIcon={<CalendarIcon />}
              type="number"
              min={0}
              stepper
              value={validityDays}
              onChange={(event) => setValidityDays(event.target.value)}
              placeholder="30"
              help="0 = never expires. Enforced by this panel."
            />
            <NeonInput
              id="resKeyLimit"
              label="Key limit"
              tone="red"
              leftIcon={<KeyIcon />}
              type="number"
              min={0}
              stepper
              value={keyLimit}
              onChange={(event) => setKeyLimit(event.target.value)}
              placeholder="0"
              help="0 = unlimited. Counts keys they generate."
            />
          </div>

          <NeonToggle
            className="mt-6"
            checked={deviceLocked}
            onChange={setDeviceLocked}
            title="Lock to one device"
            description="Binds the account to the first machine it signs in from, so the login cannot be shared. Reset the HWID from the table to move them to a new device."
          />
        </div>
      </div>

      <div className="relative z-10 mt-6">
        <NeonLabel id={packagesLabel}>Allowed Packages</NeonLabel>
        <PackageToggles
          aria-labelledby={packagesLabel}
          names={packageNames}
          selected={packages}
          onToggle={(name, on) => togglePackage(name, on, setPackages)}
          className="mt-1"
        />
      </div>

      <div className="relative z-10 mt-8 flex justify-center">
        {/* The mockup's wide bar rather than a label-sized pill: it
            closes the full-width form above it. */}
        <NeonCta
          icon={<UserPlusIcon />}
          loading={busy}
          onClick={create}
          className="max-sm:w-full max-sm:min-w-0 sm:min-w-[440px]"
        >
          Create User
        </NeonCta>
      </div>
    </NeonPanel>
  );
}
