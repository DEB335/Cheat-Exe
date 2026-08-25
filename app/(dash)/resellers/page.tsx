"use client";

import { useState } from "react";

import { EyeIcon, EyeOffIcon, KeyIcon, LockIcon, TrashIcon, UserIcon } from "@/components/icons";
import { CopyButton, PillButton, PrimaryButton } from "@/components/ui/buttons";
import { GlowingPackageBadge, StatusBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormLabel, Input, PackageToggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { Cell, DataTable, EmptyRow, Row } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { del, patchJson, postJson } from "@/lib/client-api";
import { PACKAGE_NAMES, shortPackageLabel } from "@/lib/packages";
import { useDashboard } from "@/lib/store";

const COLUMNS = ["Username", "Status", "Allowed Packages", "Created At", "Actions"];

export default function ResellersPage() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const users = useDashboard((s) => s.db.cheatExeUsers);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [packages, setPackages] = useState<string[]>(PACKAGE_NAMES);
  const [busy, setBusy] = useState(false);

  const [permsFor, setPermsFor] = useState<string | null>(null);
  const [permsDraft, setPermsDraft] = useState<string[]>([]);
  const [passFor, setPassFor] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  const togglePackage = (name: string, on: boolean, setter: typeof setPackages) =>
    setter((current) => (on ? [...current, name] : current.filter((p) => p !== name)));

  const create = async () => {
    setBusy(true);
    try {
      await postJson("/api/resellers", { username, password, packages });
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
            entries.map(([name, user]) => (
              <Row key={name}>
                <Cell className="font-semibold text-fg">{name}</Cell>
                <Cell>
                  <StatusBadge status={user.status} />
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
                <Cell>{user.created}</Cell>
                <Cell>
                  <div className="flex flex-wrap gap-2">
                    <PillButton
                      tone={user.status === "ACTIVE" ? "suspend" : "activate"}
                      onClick={() =>
                        patch(
                          name,
                          { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
                          `${name} ${user.status === "ACTIVE" ? "suspended" : "activated"}.`,
                        )
                      }
                    >
                      {user.status === "ACTIVE" ? "Suspend" : "Activate"}
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

                    <PillButton tone="delete" onClick={() => remove(name)}>
                      <TrashIcon className="size-[11px]" strokeWidth={2.5} />
                      Delete
                    </PillButton>
                  </div>
                </Cell>
              </Row>
            ))
          )}
        </DataTable>
      </Card>

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
