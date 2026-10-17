"use client";

import {
  CalendarIcon,
  CheckIcon,
  CpuChipIcon,
  EyeIcon,
  EyeOffIcon,
  GamepadIcon,
  KeyIcon,
  LockIcon,
  SlidersIcon,
} from "@/components/icons";
import {
  IconTile,
  NeonButton,
  NeonCta,
  NeonInput,
  NeonToggle,
  toneVars,
  type NeonTone,
} from "@/components/neon";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

import { PackageToggles } from "./PackageToggles";

/*
 * The row-action dialogs. They only draw: which reseller is open,
 * the drafts, and what Save does all stay on the page, so the flow is
 * the one the table has always had.
 */

/** The reseller's name in a dialog title, lit like the page title. */
function Target({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-[linear-gradient(90deg,#ff6ad5,#a78bfa)] bg-clip-text text-transparent lt:bg-[linear-gradient(90deg,#be185d,#6d28d9)]">
      {children}
    </span>
  );
}

/**
 * Save and Cancel. Side by side from sm; stacked on a phone, where the
 * dialog is too narrow for the CTA's letter-spaced label beside Cancel.
 */
function DialogActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <NeonCta size="md" onClick={onSave} className="min-w-0 sm:flex-[1.2]">
        Save Changes
      </NeonCta>
      <NeonButton tone="slate" size="md" onClick={onCancel} className="h-[50px] sm:flex-1">
        Cancel
      </NeonButton>
    </div>
  );
}

export const PRESET_VALIDITY_OPTIONS: Array<{
  days: number;
  label: string;
  tone: NeonTone;
}> = [
  { days: 1, label: "1 DAY", tone: "violet" },
  { days: 3, label: "3 DAYS", tone: "green" },
  { days: 7, label: "7 DAYS", tone: "amber" },
  { days: 30, label: "30 DAYS", tone: "blue" },
  { days: 60, label: "60 DAYS", tone: "magenta" },
  { days: 90, label: "90 DAYS", tone: "cyan" },
  { days: 180, label: "180 DAYS", tone: "pink" },
  { days: 365, label: "365 DAYS", tone: "red" },
];

export function RenewModal({
  name,
  days,
  limit,
  emulatorCredits,
  emulatorAllowedDays,
  onDays,
  onLimit,
  onEmulatorCredits,
  onToggleAllowedDay,
  onSave,
  onClose,
}: {
  name: string | null;
  days: string;
  limit: string;
  emulatorCredits?: string;
  emulatorAllowedDays?: number[];
  onDays: (value: string) => void;
  onLimit: (value: string) => void;
  onEmulatorCredits?: (value: string) => void;
  onToggleAllowedDay?: (day: number) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      className="max-w-[580px]"
      title={
        <>
          Validity &amp; Limit: <Target>{name}</Target>
        </>
      }
    >
      <div className="mb-7 flex flex-col gap-5">
        <NeonInput
          id="renewDays"
          label="Validity (days from now)"
          tone="red"
          leftIcon={<CalendarIcon />}
          type="number"
          min={0}
          stepper
          value={days}
          onChange={(event) => onDays(event.target.value)}
          help="0 = never expires. Setting a positive value also lifts an EXPIRED status."
        />
        <NeonInput
          id="renewLimit"
          label="Key limit"
          tone="red"
          leftIcon={<KeyIcon />}
          type="number"
          min={0}
          stepper
          value={limit}
          onChange={(event) => onLimit(event.target.value)}
          help="0 = unlimited."
        />
        {onEmulatorCredits && (
          <NeonInput
            id="renewEmulatorCredits"
            label="Emulator Bypass Credits"
            tone="red"
            leftIcon={<GamepadIcon />}
            type="number"
            min={0}
            stepper
            value={emulatorCredits ?? "0"}
            onChange={(event) => onEmulatorCredits(event.target.value)}
            help="Number of Emulator Bypass keys this reseller can generate. 0 = unlimited."
          />
        )}

        {emulatorAllowedDays && onToggleAllowedDay && (
          <div className="flex flex-col gap-2 rounded-xl border border-[rgba(255,45,90,0.25)] bg-[linear-gradient(150deg,rgba(28,4,12,0.85)_0%,rgba(18,2,8,0.9)_52%,rgba(12,2,5,0.95)_100%)] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl lt:border-slate-200 lt:bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold tracking-wide text-white uppercase lt:text-slate-800">
                Emulator Bypass Validity
              </span>
              <span className="text-[11.5px] font-medium text-white/70">
                {emulatorAllowedDays.length} of {PRESET_VALIDITY_OPTIONS.length} enabled
              </span>
            </div>
            <p className="text-[12px] text-white/70 lt:text-slate-500">
              Select which validity options this reseller can choose. Unselected options will be locked.
            </p>

            <div className="mt-2.5 grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
              {PRESET_VALIDITY_OPTIONS.map((opt) => {
                const on = emulatorAllowedDays.includes(opt.days);
                return (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => onToggleAllowedDay(opt.days)}
                    className={cn(
                      "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border px-3 text-[12.5px] font-bold tracking-[0.8px] whitespace-nowrap uppercase select-none",
                      "transition-[translate,scale,background-color,border-color,box-shadow,color] duration-200 ease-smooth",
                      "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96]",
                      on
                        ? [
                            "border-[#ff0037] text-white",
                            "[background:linear-gradient(180deg,rgba(255,255,255,0.15),rgba(255,255,255,0)_50%),radial-gradient(130%_90%_at_0%_0%,rgba(255,0,55,0.35),rgba(255,0,55,0)_55%),linear-gradient(150deg,rgba(70,6,20,0.95)_0%,rgba(40,4,12,0.95)_52%,rgba(20,2,6,0.98)_100%)]",
                            "shadow-[0_0_16px_rgba(255,0,55,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]",
                            "lt:border-red-600 lt:[background:rgba(225,29,72,0.15)] lt:text-red-700",
                          ]
                        : [
                            "border-[rgba(255,45,90,0.25)] bg-[rgba(18,2,8,0.7)] text-white/80",
                            "hover:border-[#ff2a55] hover:bg-[rgba(255,45,90,0.12)] hover:text-white",
                            "lt:border-slate-300 lt:bg-white lt:text-slate-600",
                          ],
                    )}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <DialogActions onSave={onSave} onCancel={onClose} />
    </Modal>
  );
}

export function ManageModal({
  name,
  uidBypassAccess,
  emulatorBypassAccess,
  onUidBypassAccess,
  onEmulatorBypassAccess,
  onSave,
  onClose,
}: {
  name: string | null;
  uidBypassAccess: boolean;
  emulatorBypassAccess: boolean;
  onUidBypassAccess: (val: boolean) => void;
  onEmulatorBypassAccess: (val: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      className="max-w-[540px]"
      title={
        <>
          Manage Access: <Target>{name}</Target>
        </>
      }
    >
      <div className="mb-7 flex flex-col gap-4">
        {/* UID Bypass Toggle Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onUidBypassAccess(!uidBypassAccess)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onUidBypassAccess(!uidBypassAccess);
            }
          }}
          className={cn(
            "flex cursor-pointer select-none items-center justify-between rounded-xl border p-4 shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all",
            uidBypassAccess
              ? "border-[rgba(255,45,90,0.65)] bg-[rgba(32,4,12,0.85)] shadow-[0_0_20px_rgba(255,45,90,0.25)] lt:border-rose-300 lt:bg-rose-50"
              : "border-[rgba(255,45,90,0.2)] bg-[rgba(16,3,8,0.7)] hover:border-[rgba(255,45,90,0.4)] lt:border-slate-200 lt:bg-slate-50",
          )}
        >
          <div className="flex items-center gap-3.5 pr-3">
            <IconTile tone="red" variant="ring" size="sm">
              <CpuChipIcon />
            </IconTile>
            <div>
              <h4 className="text-[14.5px] font-bold text-white lt:text-slate-900">UID Bypass Access</h4>
              <p className="mt-0.5 text-[12.5px] text-[#ff8ba7] lt:text-slate-500">
                Grant access to UID Bypass overview and Whitelist UID section.
              </p>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <NeonToggle
              id="manage-uid-bypass"
              title=""
              tone="red"
              boxed={false}
              checked={uidBypassAccess}
              onChange={onUidBypassAccess}
            />
          </div>
        </div>

        {/* Emulator Bypass Toggle Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onEmulatorBypassAccess(!emulatorBypassAccess)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onEmulatorBypassAccess(!emulatorBypassAccess);
            }
          }}
          className={cn(
            "flex cursor-pointer select-none items-center justify-between rounded-xl border p-4 shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all",
            emulatorBypassAccess
              ? "border-[rgba(255,45,90,0.65)] bg-[rgba(32,4,12,0.85)] shadow-[0_0_20px_rgba(255,45,90,0.25)] lt:border-rose-300 lt:bg-rose-50"
              : "border-[rgba(255,45,90,0.2)] bg-[rgba(16,3,8,0.7)] hover:border-[rgba(255,45,90,0.4)] lt:border-slate-200 lt:bg-slate-50",
          )}
        >
          <div className="flex items-center gap-3.5 pr-3">
            <IconTile tone="red" variant="ring" size="sm">
              <GamepadIcon />
            </IconTile>
            <div>
              <h4 className="text-[14.5px] font-bold text-white lt:text-slate-900">
                Emulator Bypass Access
              </h4>
              <p className="mt-0.5 text-[12.5px] text-[#ff8ba7] lt:text-slate-500">
                Enable emulator bypass key generator and privileges.
              </p>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <NeonToggle
              id="manage-emulator-bypass"
              title=""
              tone="red"
              boxed={false}
              checked={emulatorBypassAccess}
              onChange={onEmulatorBypassAccess}
            />
          </div>
        </div>
      </div>
      <DialogActions onSave={onSave} onCancel={onClose} />
    </Modal>
  );
}

export function PermsModal({
  name,
  packageNames,
  draft,
  onToggle,
  onSave,
  onClose,
}: {
  name: string | null;
  packageNames: string[];
  draft: string[];
  onToggle: (name: string, on: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      className="max-w-[520px]"
      title={
        <>
          Edit Permissions: <Target>{name}</Target>
        </>
      }
    >
      <PackageToggles
        aria-label="Allowed packages"
        names={packageNames}
        selected={draft}
        onToggle={onToggle}
        size="sm"
        className="mb-7 gap-2 sm:gap-2.5"
      />
      <DialogActions onSave={onSave} onCancel={onClose} />
    </Modal>
  );
}

export function PassModal({
  name,
  value,
  shown,
  onValue,
  onToggleShown,
  onSave,
  onClose,
}: {
  name: string | null;
  value: string;
  shown: boolean;
  onValue: (value: string) => void;
  onToggleShown: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      title={
        <>
          Change Password for Reseller: <Target>{name}</Target>
        </>
      }
    >
      <NeonInput
        id="newPass"
        label="New Password"
        tone="red"
        leftIcon={<LockIcon />}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(event) => onValue(event.target.value)}
        placeholder="Enter new password"
        className="mb-7"
        rightSlot={
          <NeonButton
            variant="ghost"
            tone="slate"
            size="xs"
            onClick={onToggleShown}
            aria-label={shown ? "Hide password" : "Show password"}
            icon={shown ? <EyeOffIcon /> : <EyeIcon />}
          />
        }
      />
      <DialogActions onSave={onSave} onCancel={onClose} />
    </Modal>
  );
}
