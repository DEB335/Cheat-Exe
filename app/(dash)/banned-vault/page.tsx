"use client";

import { BlockedDevices } from "@/components/banned-vault/BlockedDevices";
import { VaultPanel } from "@/components/banned-vault/VaultPanel";

/**
 * Two panels: the vault of kicked / banned accounts, and the device and
 * network blocks that sit in front of the password check. Each owns its
 * data and actions (components/banned-vault).
 */
export default function BannedVaultPage() {
  return (
    <>
      <VaultPanel />
      <BlockedDevices />
    </>
  );
}
