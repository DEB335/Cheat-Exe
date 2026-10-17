"use client";

import { useState } from "react";

import { CheckIcon, CpuChipIcon, MonitorIcon, WifiOffIcon } from "@/components/icons";
import {
  NeonButton,
  NeonCell,
  NeonChip,
  NeonEmpty,
  NeonInput,
  NeonPanel,
  NeonRow,
  NeonSegmented,
  NeonTable,
  PanelHeader,
  ShieldXIcon,
  XCircleIcon,
  type NeonColumn,
  type NeonTone,
} from "@/components/neon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { del, postJson } from "@/lib/client-api";
import { applyLiftBan } from "@/lib/optimistic";
import { useDashboard } from "@/lib/store";
import type { BanScope } from "@/lib/types";
import { formatStampForDisplay } from "@/lib/utils";

const BLOCK_COLUMNS: NeonColumn[] = [
  "TYPE",
  "VALUE",
  "RAISED FROM",
  "REASON",
  "ADDED",
  { label: "ACTIONS", align: "right" },
];

const SCOPE_META: Record<
  BanScope,
  { label: string; icon: typeof WifiOffIcon; hint: string; tone: NeonTone }
> = {
  ip: {
    label: "IP",
    icon: WifiOffIcon,
    hint: "Blocks the address. Home connections change theirs, so this ages out.",
    tone: "red",
  },
  hwid: {
    label: "HWID",
    icon: CpuChipIcon,
    hint: "Blocks the browser device id. Survives a new account, not cleared site data.",
    tone: "red",
  },
  fingerprint: {
    label: "SIGNATURE",
    icon: CpuChipIcon,
    hint: "Blocks the device signature. Survives cleared cookies, but is coarser.",
    tone: "red",
  },
};

// The hint rides on the label as its tooltip, as it did on the old
// scope buttons, and the chosen scope's hint also shows under the field.
const SCOPE_OPTIONS = (Object.keys(SCOPE_META) as BanScope[]).map((key) => ({
  value: key,
  label: <span title={SCOPE_META[key].hint}>{SCOPE_META[key].label}</span>,
}));

/**
 * Blocks that sit in front of the password check.
 *
 * The vault above bans *accounts*: the person just makes another one.
 * These rules turn away the connection itself, so a blocked address or
 * machine cannot sign in to anything, and every open session it holds is
 * closed the moment the rule lands.
 */
export function BlockedDevices() {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const patchDb = useDashboard((s) => s.patch);
  const restoreDb = useDashboard((s) => s.restore);
  const bans = useDashboard((s) => s.db.cheatExeBans);

  const [scope, setScope] = useState<BanScope>("ip");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!value.trim()) {
      toast("Enter a value to block.", "error");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/bans", {
        rules: [{ scope, value: value.trim() }],
        reason: reason.trim() || undefined,
      });
      setValue("");
      setReason("");
      toast(`${SCOPE_META[scope].label} blocked.`, "success");
      void refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const [liftTarget, setLiftTarget] = useState<{ scope: BanScope; value: string } | null>(null);

  const handleConfirmLift = async () => {
    if (!liftTarget) return;
    const rule = liftTarget;
    setLiftTarget(null);
    const snapshot = patchDb((db) => applyLiftBan(db, rule.scope, rule.value));
    toast("Block lifted.", "success");
    try {
      await del(`/api/bans?scope=${rule.scope}&value=${encodeURIComponent(rule.value)}`);
      void refresh();
    } catch (err) {
      restoreDb(snapshot);
      toast((err as Error).message, "error");
    }
  };

  return (
    <NeonPanel rim="danger" className="mt-6 sm:mt-8">
      <div className="@container/blocks relative">
        <PanelHeader
          titleAs="h2"
          title="Blocked Devices & Networks"
          subtitle="Checked before any password. A blocked device reaches no account at all."
        />

        <div className="relative z-10 mb-6 flex flex-wrap items-start gap-3 sm:gap-4 @[1150px]/blocks:grid @[1150px]/blocks:grid-cols-[auto_minmax(0,1.75fr)_minmax(0,1fr)_auto]">
          <div className="flex h-[54px] items-center">
            <NeonSegmented
              aria-label="What to block"
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
              tone="red"
              size="md"
              caps
              className="flex-nowrap"
            />
          </div>

          <NeonInput
            aria-label="Value to block"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={scope === "ip" ? "203.0.113.7" : "Device id from the vault row"}
            leftIcon={<MonitorIcon />}
            help={SCOPE_META[scope].hint}
            className="min-w-[min(100%,240px)] flex-[1.5]"
          />

          <NeonInput
            aria-label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (optional)"
            className="min-w-[min(100%,200px)] flex-1"
          />

          <div className="flex h-[54px] items-center">
            <NeonButton tone="red" variant="filled" size="md" icon={<XCircleIcon />} loading={busy} onClick={add}>
              Block
            </NeonButton>
          </div>
        </div>

        <NeonTable
          columns={BLOCK_COLUMNS}
          minWidth={900}
          tone="red"
          className="relative z-10"
          empty={
            <NeonEmpty icon={<ShieldXIcon />} tone="red" className="[&>p]:max-w-[680px]">
              Nothing is blocked. Use Ban IP or Ban HWID on the Active Devices page, or add one above.
            </NeonEmpty>
          }
        >
          {bans.map((rule, index) => {
            const meta = SCOPE_META[rule.scope];
            const Icon = meta.icon;
            return (
              <NeonRow key={`${rule.scope}:${rule.value}`} index={index}>
                <NeonCell>
                  <NeonChip tone="red" size="xs" icon={<Icon />} title={meta.hint}>
                    {meta.label}
                  </NeonChip>
                </NeonCell>

                <NeonCell mono title={rule.value} className="max-w-[260px] truncate text-white lt:text-slate-900">
                  {rule.value}
                </NeonCell>

                <NeonCell className="text-[#a9b8e0] lt:text-slate-500">{rule.user ?? "—"}</NeonCell>

                <NeonCell title={rule.reason} className="max-w-[240px] truncate text-[#a9b8e0] lt:text-slate-500">
                  {rule.reason}
                </NeonCell>

                <NeonCell className="whitespace-nowrap text-[#a9b8e0] lt:text-slate-500">
                  {formatStampForDisplay(rule.at)}
                </NeonCell>

                <NeonCell align="right">
                  <NeonButton tone="green" variant="filled" size="xs" icon={<CheckIcon />} onClick={() => setLiftTarget(rule)}>
                    Lift
                  </NeonButton>
                </NeonCell>
              </NeonRow>
            );
          })}
        </NeonTable>
      </div>

      <ConfirmDialog
        isOpen={Boolean(liftTarget)}
        title="Lift Block"
        description={`Are you sure you want to lift the block on ${liftTarget?.value}? This will restore access for this target.`}
        confirmText="Lift Block"
        cancelText="Cancel"
        variant="primary"
        onConfirm={handleConfirmLift}
        onCancel={() => setLiftTarget(null)}
      />
    </NeonPanel>
  );
}
