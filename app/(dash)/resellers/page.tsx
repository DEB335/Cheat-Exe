"use client";

import { useMemo, useState } from "react";

import {
  CpuChipIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  KeyIcon,
  LockIcon,
  RotateIcon,
  TrashIcon,
  UserIcon,
} from "@/components/icons";
import { CopyButton, PillButton, PrimaryButton } from "@/components/ui/buttons";
import { GlowingPackageBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormLabel, HelpText, Input, PackageToggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del, patchJson, postJson } from "@/lib/client-api";
import { PACKAGE_NAMES, shortPackageLabel } from "@/lib/packages";
import { daysLeft, effectiveStatus, formatExpiry, keysRemaining } from "@/lib/reseller";
import { useDashboard } from "@/lib/store";

const COLUMNS = ["Username", "Status", "Validity", "Keys", "Device", "Allowed Packages", "Actions"];

export default function ResellersPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const users = useDashboard((s) => s.db.cheatExeUsers);
  const history = useDashboard((s) => s.db.cheatExeKeyHistory);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [packages, setPackages] = useState<string[]>(PACKAGE_NAMES);
  const [validityDays, setValidityDays] = useState("30");
  const [keyLimit, setKeyLimit] = useState("");
  const [deviceLocked, setDeviceLocked] = useState(true);
  const [busy, setBusy] = useState(false);

  const [permsFor, setPermsFor] = useState<string | null>(null);
  const [permsDraft, setPermsDraft] = useState<string[]>([]);
  const [passFor, setPassFor] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [renewLimit, setRenewLimit] = useState("");

  const togglePackage = (name: string, on: boolean, setter: typeof setPackages) =>
    setter((current) => (on ? [...current, name] : current.filter((p) => p !== name)));

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
      await refresh();
      toast("Reseller created successfully!", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (name: string, body: Record<string, unknown>, message: string) => {
    try {
      await patchJson(`/api/resellers/${encodeURIComponent(name)}`, body);
      await refresh();
      toast(message, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete reseller ${name}?`)) return;
    try {
      await del(`/api/resellers/${encodeURIComponent(name)}`);
      await refresh();
      toast("Reseller deleted.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const entries = Object.entries(users);

  // How many keys each reseller has generated, for the quota column. The
  // owner's /api/db payload already carries the full history, so this
  // needs no extra request.
  const keysUsed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const record of history) {
      const creator = record.creator.toLowerCase();
      counts[creator] = (counts[creator] ?? 0) + 1;
    }
    return counts;
  }, [history]);

  return (
    <>
      <Card className="mb-6">
        <CardHeader
          title="Create Reseller Account"
          subtitle="Give dashboard access to sub-users."
          actions={
            <div className="flex size-8 items-center justify-center rounded-xl text-fg">
              <UserIcon className="size-4" />
            </div>
          }
        />

        <div className="mb-5">
          <FormLabel htmlFor="resUser">Reseller Username</FormLabel>
          <Input
            id="resUser"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
          />
        </div>

        <div className="mb-5">
          <FormLabel htmlFor="resPass">Password (min 4 chars)</FormLabel>
          <Input
            id="resPass"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
        </div>

        <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
          <div>
            <FormLabel htmlFor="resValidity">Validity (days)</FormLabel>
            <Input
              id="resValidity"
              type="number"
              min={0}
              value={validityDays}
              onChange={(event) => setValidityDays(event.target.value)}
              placeholder="30"
            />
            {/* Unlike the key generator's validity -- which the upstream API
                ignores -- this one is enforced here, because the panel owns
                reseller accounts outright. */}
            <HelpText>0 = never expires. Enforced by this panel.</HelpText>
          </div>
          <div>
            <FormLabel htmlFor="resKeyLimit">Key limit</FormLabel>
            <Input
              id="resKeyLimit"
              type="number"
              min={0}
              value={keyLimit}
              onChange={(event) => setKeyLimit(event.target.value)}
              placeholder="0"
            />
            <HelpText>0 = unlimited. Counts keys they generate.</HelpText>
          </div>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white/2 p-4">
          <input
            type="checkbox"
            checked={deviceLocked}
            onChange={(event) => setDeviceLocked(event.target.checked)}
            className="mt-0.5 size-4 accent-[#2dd4bf]"
          />
          <span>
            <span className="block text-[13px] font-bold text-fg">Lock to one device</span>
            <span className="block text-[12px] text-muted">
              Binds the account to the first machine it signs in from, so the login cannot be shared.
              Reset the HWID from the table to move them to a new device.
            </span>
          </span>
        </label>

        <FormLabel>Allowed Packages</FormLabel>
        <div className="mt-2.5 mb-5 flex flex-wrap gap-2.5">
          {PACKAGE_NAMES.map((name) => (
            <PackageToggle
              key={name}
              label={name}
              checked={packages.includes(name)}
              onChange={(on) => togglePackage(name, on, setPackages)}
            />
          ))}
        </div>

        <div className="mt-4 flex w-full justify-center">
          <PrimaryButton onClick={create} disabled={busy}>
            <UserIcon className="size-4" strokeWidth={2.5} />
            CREATE USER
          </PrimaryButton>
        </div>
      </Card>

      <Card flat>
        <CardHeader
          title="Active Resellers"
          subtitle="Manage sub-users dashboard access."
          actions={
            <CopyButton
              onClick={async () => {
                await refresh();
                toast("Reseller list updated!", "success");
              }}
            >
              Refresh
            </CopyButton>
          }
        />

        <DataTable columns={COLUMNS}>
          {entries.length === 0 ? (
            <EmptyRow colSpan={COLUMNS.length}>No reseller accounts yet.</EmptyRow>
          ) : (
            entries.map(([name, user]) => {
              const status = effectiveStatus(user);
              const left = daysLeft(user);
              const used = keysUsed[name.toLowerCase()] ?? 0;
              const remaining = keysRemaining(user, used);

              return (
              <Row key={name}>
                <Cell className="font-semibold text-fg">{name}</Cell>
                <Cell>
                  {/* effectiveStatus, not user.status: the stored value can
                      still say ACTIVE on an account whose validity lapsed,
                      and the login already refuses it. */}
                  <StatusBadge status={status} />
                </Cell>

                <Cell>
                  <div className="text-[12.5px] font-semibold text-fg">{formatExpiry(user)}</div>
                  {left !== null && (
                    <div
                      className={
                        left <= 0
                          ? "text-[11px] font-bold text-[#ef4444]"
                          : left <= 7
                            ? "text-[11px] font-bold text-orange"
                            : "text-[11px] text-muted"
                      }
                    >
                      {left <= 0 ? "expired" : `${left} day${left === 1 ? "" : "s"} left`}
                    </div>
                  )}
                </Cell>

                <Cell>
                  <div className="text-[12.5px] font-semibold text-fg">
                    {user.keyLimit ? `${used} / ${user.keyLimit}` : used}
                  </div>
                  <div className="text-[11px] text-muted">
                    {remaining === null
                      ? "unlimited"
                      : remaining === 0
                        ? "none left"
                        : `${remaining} left`}
                  </div>
                </Cell>

                <Cell>
                  {!user.deviceLocked ? (
                    <span className="text-[11.5px] text-muted">Unlocked</span>
                  ) : user.lock?.hwid || user.lock?.fingerprint ? (
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(45,212,191,0.25)] bg-[rgba(45,212,191,0.1)] px-2 py-[3px] text-[10px] font-bold text-[#2dd4bf]">
                        <CpuChipIcon className="size-2.5" />
                        BOUND
                      </span>
                      <div className="mt-1 font-mono text-[10.5px] text-muted">
                        {(user.lock.hwid ?? user.lock.fingerprint ?? "").slice(0, 12)}
                      </div>
                      {user.lock.ip && (
                        <div className="font-mono text-[10.5px] text-muted">{user.lock.ip}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11.5px] text-orange">Awaiting first login</span>
                  )}
                </Cell>

                <Cell>
                  <div className="flex max-w-[250px] flex-wrap gap-0.5">
                    {user.packages.length > 0 ? (
                      user.packages.map((pkg) => (
                        <GlowingPackageBadge key={pkg}>{shortPackageLabel(pkg)}</GlowingPackageBadge>
                      ))
                    ) : (
                      <span className="m-0.5 inline-block rounded-full border border-white/10 px-2.5 py-[3px] text-[9.5px] font-[750] tracking-[0.8px] text-muted uppercase">
                        NONE
                      </span>
                    )}
                  </div>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-2">
                    <PillButton
                      tone={status === "ACTIVE" ? "suspend" : "activate"}
                      title={
                        status === "EXPIRED"
                          ? "Activating an expired account also needs a new validity"
                          : undefined
                      }
                      onClick={() =>
                        patch(
                          name,
                          { status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
                          `${name} ${status === "ACTIVE" ? "suspended" : "activated"}.`,
                        )
                      }
                    >
                      {status === "ACTIVE" ? "Suspend" : "Activate"}
                    </PillButton>

                    <PillButton
                      tone="perms"
                      onClick={() => {
                        setPermsFor(name);
                        setPermsDraft(user.packages);
                      }}
                    >
                      <KeyIcon className="size-[11px]" strokeWidth={2.5} />
                      Perms
                    </PillButton>

                    <PillButton
                      tone="pass"
                      onClick={() => {
                        setPassFor(name);
                        setNewPass("");
                        setShowPass(false);
                      }}
                    >
                      <LockIcon className="size-[11px]" strokeWidth={2.5} />
                      Pass
                    </PillButton>

                    <PillButton
                      tone="activate"
                      title="Change validity and key limit"
                      onClick={() => {
                        setRenewFor(name);
                        // Prefill with days still left (or 30 for an account
                        // with no end date), and the current key limit.
                        const left = daysLeft(user);
                        setRenewDays(String(left && left > 0 ? left : 30));
                        setRenewLimit(user.keyLimit ? String(user.keyLimit) : "");
                      }}
                    >
                      <HistoryIcon className="size-[11px]" strokeWidth={2.5} />
                      Renew
                    </PillButton>

                    <PillButton
                      tone="hwid"
                      title={
                        user.deviceLocked
                          ? "Unbind the device so the next sign-in claims the account"
                          : "This account is not device locked"
                      }
                      disabled={!user.deviceLocked}
                      onClick={() =>
                        patch(name, { resetLock: true }, `Device lock reset for ${name}.`)
                      }
                    >
                      <RotateIcon className="size-[11px]" strokeWidth={2.5} />
                      Reset HWID
                    </PillButton>

                    <PillButton tone="delete" onClick={() => remove(name)}>
                      <TrashIcon className="size-[11px]" strokeWidth={2.5} />
                      Delete
                    </PillButton>
                  </div>
                </Cell>
              </Row>
              );
            })
          )}
        </DataTable>
      </Card>

      <Modal
        open={renewFor !== null}
        onClose={() => setRenewFor(null)}
        title={
          <>
            Validity &amp; Limit: <span className="text-[#e62843]">{renewFor}</span>
          </>
        }
      >
        <div className="mb-5 grid gap-5">
          <div>
            <FormLabel htmlFor="renewDays">Validity (days from now)</FormLabel>
            <Input
              id="renewDays"
              type="number"
              min={0}
              value={renewDays}
              onChange={(event) => setRenewDays(event.target.value)}
            />
            <HelpText>0 = never expires. Setting a positive value also lifts an EXPIRED status.</HelpText>
          </div>
          <div>
            <FormLabel htmlFor="renewLimit">Key limit</FormLabel>
            <Input
              id="renewLimit"
              type="number"
              min={0}
              value={renewLimit}
              onChange={(event) => setRenewLimit(event.target.value)}
            />
            <HelpText>0 = unlimited.</HelpText>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <PrimaryButton
            className="h-[46px] flex-[1.2] p-0"
            innerClassName="text-[11.5px] tracking-[1px]"
            onClick={async () => {
              if (renewFor) {
                await patch(
                  renewFor,
                  { validityDays: Number(renewDays) || 0, keyLimit: Number(renewLimit) || 0 },
                  `Validity and limit updated for ${renewFor}.`,
                );
              }
              setRenewFor(null);
            }}
          >
            Save Changes
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setRenewFor(null)}
            className="h-[46px] flex-1 cursor-pointer rounded-xl border border-line bg-white/2 text-[13px] font-bold text-fg transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal
        open={permsFor !== null}
        onClose={() => setPermsFor(null)}
        title={
          <>
            Edit Permissions: <span className="text-[#e62843]">{permsFor}</span>
          </>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2.5">
          {PACKAGE_NAMES.map((name) => (
            <PackageToggle
              key={name}
              label={name}
              checked={permsDraft.includes(name)}
              onChange={(on) => togglePackage(name, on, setPermsDraft)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <PrimaryButton
            className="h-[46px] flex-[1.2] p-0"
            innerClassName="text-[11.5px] tracking-[1px]"
            onClick={async () => {
              if (permsFor) await patch(permsFor, { packages: permsDraft }, "Permissions updated.");
              setPermsFor(null);
            }}
          >
            Save Changes
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setPermsFor(null)}
            className="h-[46px] flex-1 cursor-pointer rounded-xl border border-line bg-white/2 text-[13px] font-bold text-fg transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal
        open={passFor !== null}
        onClose={() => setPassFor(null)}
        title={
          <>
            Change Password for Reseller: <span className="text-[#e62843]">{passFor}</span>
          </>
        }
      >
        <div className="mb-5">
          <label htmlFor="newPass" className="mb-2 block text-[14px] text-muted">
            New Password
          </label>
          <div className="relative flex w-full items-center">
            <Input
              id="newPass"
              type={showPass ? "text" : "password"}
              value={newPass}
              onChange={(event) => setNewPass(event.target.value)}
              placeholder="Enter new password"
              className="pr-[42px]"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 z-10 flex cursor-pointer items-center justify-center p-1 text-muted hover:text-fg"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <PrimaryButton
            className="h-[46px] flex-[1.2] p-0"
            innerClassName="text-[11.5px] tracking-[1px]"
            onClick={async () => {
              if (passFor) await patch(passFor, { password: newPass }, "Password updated.");
              setPassFor(null);
            }}
          >
            Save Changes
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setPassFor(null)}
            className="h-[46px] flex-1 cursor-pointer rounded-xl border border-line bg-white/2 text-[13px] font-bold text-fg transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}
