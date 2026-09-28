"use client";

import { CalendarIcon, EyeIcon, EyeOffIcon, KeyIcon, LockIcon } from "@/components/icons";
import { NeonButton, NeonCta, NeonInput } from "@/components/neon";
import { Modal } from "@/components/ui/Modal";

import { PackageToggles } from "./PackageToggles";

/*
 * The three row-action dialogs. They only draw: which reseller is open,
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

export function RenewModal({
  name,
  days,
  limit,
  onDays,
  onLimit,
  onSave,
  onClose,
}: {
  name: string | null;
  days: string;
  limit: string;
  onDays: (value: string) => void;
  onLimit: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      title={
        <>
          Validity &amp; Limit: <Target>{name}</Target>
        </>
      }
    >
      <div className="mb-7 grid gap-5">
        <NeonInput
          id="renewDays"
          label="Validity (days from now)"
          tone="cyan"
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
          tone="violet"
          leftIcon={<KeyIcon />}
          type="number"
          min={0}
          stepper
          value={limit}
          onChange={(event) => onLimit(event.target.value)}
          help="0 = unlimited."
        />
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
        tone="blue"
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
