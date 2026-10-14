"use client";

import { useMemo } from "react";

import { HistoryIcon, KeyIcon, LockIcon, RefreshIcon, RotateIcon, SlidersIcon, TrashIcon, UserIcon, UsersIcon } from "@/components/icons";
import {
  IconTile,
  NeonButton,
  NeonCell,
  NeonChip,
  NeonEmpty,
  NeonPanel,
  NeonRow,
  NeonTable,
  PackageChip,
  PanelHeader,
  PauseIcon,
  PlayIcon,
  StatusPill,
  type NeonStatus,
} from "@/components/neon";
import { useToast } from "@/components/ui/Toast";
import { daysLeft, effectiveStatus, emulatorCreditsRemaining, formatExpiry, keysRemaining } from "@/lib/reseller";
import { useDashboard } from "@/lib/store";
import type { PublicDatabase, ResellerStatus } from "@/lib/types";
import { cleanCreatorUsername, cn } from "@/lib/utils";

const COLUMNS = ["Username", "Status", "Validity", "Keys", "Bypass Credits", "Device", "Allowed Packages", "Actions"];

/** Pill colour per status: live green, suspended red, waiting amber, lapsed grey. */
const STATUS_LOOK: Record<ResellerStatus, NeonStatus> = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  "PENDING APPROVAL": "warning",
  EXPIRED: "neutral",
};

/** A reseller as the browser sees it: everything but the password hash. */
export type ResellerView = PublicDatabase["cheatExeUsers"][string];

const MUTED = "text-[12.5px] text-[#a9b8e0] lt:text-slate-500";

export interface ResellerActions {
  patch: (name: string, body: Record<string, unknown>, message: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  openPerms: (name: string, user: ResellerView) => void;
  openManage: (name: string, user: ResellerView) => void;
  openPass: (name: string) => void;
  openRenew: (name: string, user: ResellerView) => void;
}

/**
 * Every reseller account with its quota, device lock and grants, and
 * the row actions that change them. The actions themselves live on the
 * page, next to the modals they open.
 */
export function ActiveResellersPanel({ actions }: { actions: ResellerActions }) {
  const toast = useToast();
  const refresh = useDashboard((s) => s.refresh);
  const users = useDashboard((s) => s.db.cheatExeUsers);
  const history = useDashboard((s) => s.db.cheatExeKeyHistory);
  // Until the first /api/db read lands the store holds an empty
  // database, and "No reseller accounts yet" would be a claim it cannot
  // make yet.
  const loading = useDashboard((s) => s.loading);

  const entries = Object.entries(users);

  // How many keys each reseller has generated, separated by regular license keys vs emulator bypass keys.
  const { keysUsed, emulatorKeysUsed } = useMemo(() => {
    const regular: Record<string, number> = {};
    const emulator: Record<string, number> = {};
    for (const record of history) {
      const raw = (record.creator || "").trim();
      const creator = cleanCreatorUsername(raw).toLowerCase();
      if (record.package === "EMULATOR BYPASS") {
        emulator[creator] = (emulator[creator] ?? 0) + 1;
      } else {
        regular[creator] = (regular[creator] ?? 0) + 1;
      }
    }
    return { keysUsed: regular, emulatorKeysUsed: emulator };
  }, [history]);

  return (
    <NeonPanel rim="aurora">
      <PanelHeader
        icon={<UsersIcon />}
        iconTone="blue"
        iconTone2="cyan"
        title="Active Resellers"
        subtitle="Manage sub-users dashboard access."
        actions={
          <NeonButton
            tone="violet"
            size="md"
            icon={<RefreshIcon />}
            onClick={async () => {
              await refresh();
              toast("Reseller list updated!", "success");
            }}
          >
            Refresh
          </NeonButton>
        }
      />

      <NeonTable
        columns={COLUMNS}
        minWidth={1520}
        empty={
          <NeonEmpty icon={<UsersIcon />}>{loading ? "Loading resellers…" : "No reseller accounts yet."}</NeonEmpty>
        }
      >
        {entries.map(([name, user], i) => (
          <ResellerRow
            key={name}
            index={i}
            name={name}
            user={user}
            used={keysUsed[name.toLowerCase()] ?? 0}
            emulatorUsed={emulatorKeysUsed[name.toLowerCase()] ?? 0}
            actions={actions}
          />
        ))}
      </NeonTable>
    </NeonPanel>
  );
}

function ResellerRow({
  index,
  name,
  user,
  used,
  emulatorUsed,
  actions,
}: {
  index: number;
  name: string;
  user: ResellerView;
  used: number;
  emulatorUsed: number;
  actions: ResellerActions;
}) {
  // effectiveStatus, not user.status: the stored value can still say
  // ACTIVE on an account whose validity lapsed, and the login already
  // refuses it.
  const status = effectiveStatus(user);
  const left = daysLeft(user);
  const remaining = keysRemaining(user, used);
  const emulatorRemaining = emulatorCreditsRemaining(user, emulatorUsed);

  return (
    <NeonRow index={index}>
      <NeonCell>
        <div className="flex items-center gap-3">
          <IconTile tone="violet" variant="ring" size="xs" className="[&>svg]:size-[15px]">
            <UserIcon />
          </IconTile>
          <span className="font-semibold whitespace-nowrap text-white lt:text-slate-900">{name}</span>
        </div>
      </NeonCell>

      <NeonCell>
        <StatusPill status={STATUS_LOOK[status]} caps>
          {status}
        </StatusPill>
      </NeonCell>

      <NeonCell>
        <div className="text-[14.5px] font-semibold whitespace-nowrap text-white lt:text-slate-900">
          {formatExpiry(user)}
        </div>
        {left !== null && (
          <div
            className={cn(
              "mt-0.5 text-[12.5px] whitespace-nowrap",
              left <= 0
                ? "font-bold text-[#ff8aa0] lt:text-rose-600"
                : left <= 7
                  ? "font-bold text-[#fdba74] lt:text-orange-600"
                  : "text-[#a9b8e0] lt:text-slate-500",
            )}
          >
            {left <= 0 ? "expired" : `${left} day${left === 1 ? "" : "s"} left`}
          </div>
        )}
      </NeonCell>

      <NeonCell>
        <div className="text-[15px] font-bold whitespace-nowrap text-white lt:text-slate-900">
          {user.keyLimit ? `${used} / ${user.keyLimit}` : used}
        </div>
        <div className={cn("mt-0.5 whitespace-nowrap", MUTED)}>
          {remaining === null ? "unlimited" : remaining === 0 ? "none left" : `${remaining} left`}
        </div>
      </NeonCell>

      <NeonCell>
        {user.emulatorBypassAccess ? (
          <>
            <div className="text-[15px] font-bold whitespace-nowrap text-white lt:text-slate-900">
              {user.emulatorCredits ? `${emulatorUsed} / ${user.emulatorCredits}` : emulatorUsed}
            </div>
            <div className={cn("mt-0.5 whitespace-nowrap", MUTED)}>
              {emulatorRemaining === null ? (
                <span className="font-medium text-[#38ef7d] lt:text-emerald-600">unlimited</span>
              ) : emulatorRemaining === 0 ? (
                <span className="font-medium text-[#ff8aa0] lt:text-rose-600">none left</span>
              ) : (
                `${emulatorRemaining} left`
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="text-[14.5px] font-semibold text-[#8f9bc4]/50 lt:text-slate-400">—</div>
            <div className="mt-0.5 text-[11.5px] font-medium tracking-wide uppercase text-[#ff8aa0]/60 lt:text-rose-500/70">
              Disabled
            </div>
          </div>
        )}
      </NeonCell>

      <NeonCell>
        {!user.deviceLocked ? (
          <StatusPill status="neutral" caps size="xs">
            Unlocked
          </StatusPill>
        ) : user.lock?.hwid || user.lock?.fingerprint ? (
          <div>
            <StatusPill tone="cyan" caps size="xs">
              Bound
            </StatusPill>
            <div className={cn("mt-1.5 font-mono whitespace-nowrap", MUTED)}>
              {(user.lock.hwid ?? user.lock.fingerprint ?? "").slice(0, 12)}
            </div>
            {user.lock.ip && <div className={cn("font-mono whitespace-nowrap", MUTED)}>{user.lock.ip}</div>}
          </div>
        ) : (
          <StatusPill status="warning" caps size="xs">
            Awaiting first login
          </StatusPill>
        )}
      </NeonCell>

      <NeonCell>
        <div className="flex max-w-[204px] flex-wrap gap-1.5">
          {user.packages.length > 0 ? (
            user.packages.map((pkg) => <PackageChip key={pkg} name={pkg} size="md" iconOnly />)
          ) : (
            <NeonChip tone="slate" size="xs">
              None
            </NeonChip>
          )}
        </div>
      </NeonCell>

      <NeonCell>
        {/* Left to itself, a narrow table's auto layout squeezes this
            cell to one button's width and stacks them all, making every
            row several times its height. Below lg the table scrolls
            sideways anyway, so the buttons keep one line there; above
            it, at most two. */}
        <div className="flex min-w-[380px] flex-wrap gap-2 max-lg:min-w-max">
          <NeonButton
            variant="filled"
            size="xs"
            tone={status === "ACTIVE" ? "amber" : "green"}
            icon={status === "ACTIVE" ? <PauseIcon /> : <PlayIcon />}
            title={
              status === "EXPIRED" ? "Activating an expired account also needs a new validity" : undefined
            }
            onClick={() =>
              actions.patch(
                name,
                { status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" },
                `${name} ${status === "ACTIVE" ? "suspended" : "activated"}.`,
              )
            }
          >
            {status === "ACTIVE" ? "Suspend" : "Activate"}
          </NeonButton>

          <NeonButton
            variant="filled"
            size="xs"
            tone="violet"
            icon={<KeyIcon />}
            onClick={() => actions.openPerms(name, user)}
          >
            Perms
          </NeonButton>

          <NeonButton
            variant="filled"
            size="xs"
            tone="pink"
            icon={<SlidersIcon />}
            title="Manage feature access, emulator bypass & credits"
            onClick={() => actions.openManage(name, user)}
          >
            Manage
          </NeonButton>

          <NeonButton
            variant="filled"
            size="xs"
            tone="blue"
            icon={<LockIcon />}
            onClick={() => actions.openPass(name)}
          >
            Pass
          </NeonButton>

          <NeonButton
            variant="filled"
            size="xs"
            tone="green"
            icon={<HistoryIcon />}
            title="Change validity and key limit"
            onClick={() => actions.openRenew(name, user)}
          >
            Renew
          </NeonButton>

          <NeonButton
            variant="filled"
            size="xs"
            tone="cyan"
            icon={<RotateIcon />}
            title={
              user.deviceLocked
                ? "Unbind the device so the next sign-in claims the account"
                : "This account is not device locked"
            }
            disabled={!user.deviceLocked}
            // The kit's disabled fade leaves a pale light-mode tint near
            // white on a white row; keep it readable as a button.
            className="lt:disabled:opacity-70"
            onClick={() => actions.patch(name, { resetLock: true }, `Device lock reset for ${name}.`)}
          >
            Reset HWID
          </NeonButton>

          <NeonButton
            variant="filled"
            size="xs"
            tone="red"
            icon={<TrashIcon />}
            onClick={() => actions.remove(name)}
          >
            Delete
          </NeonButton>
        </div>
      </NeonCell>
    </NeonRow>
  );
}
