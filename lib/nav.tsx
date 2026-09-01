import {
  BanIcon,
  MegaphoneIcon,
  CheckCircleIcon,
  ColumnsIcon,
  CpuChipIcon,
  FileTextIcon,
  GridIcon,
  HistoryIcon,
  KeyIcon,
  MonitorIcon,
  SettingsIcon,
  SlidersIcon,
  UserPlusIcon,
} from "@/components/icons";
import { UID_BYPASS_PACKAGE, canManageWhitelist } from "./packages";
import type { Role, SessionUser } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  /** Accent used by the collapsed rail and the click wave. */
  color: string;
  roles: Role[];
  badge?: "devices" | "banned";
  /**
   * Package a reseller must hold for this item to appear. The owner is
   * never gated by it.
   */
  pkg?: string;
  /** Header eyebrow shown above the page title. */
  section: string;
}

export interface NavGroup {
  label: string;
  roles: Role[];
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    roles: ["OWNER", "RESELLER"],
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: GridIcon,
        color: "#ff1f5a",
        roles: ["OWNER", "RESELLER"],
        section: "DASHBOARD",
      },
      {
        href: "/messages",
        label: "Messages",
        icon: MegaphoneIcon,
        color: "#22d3ee",
        roles: ["OWNER", "RESELLER"],
        section: "DASHBOARD",
      },
    ],
  },
  {
    label: "License Management",
    roles: ["OWNER", "RESELLER"],
    items: [
      {
        href: "/generator",
        label: "Key Generator",
        icon: KeyIcon,
        color: "#1e90ff",
        roles: ["OWNER", "RESELLER"],
        section: "LICENSE GENERATOR",
      },
      {
        href: "/manager",
        label: "Manage Key",
        icon: SlidersIcon,
        color: "#10b981",
        roles: ["OWNER", "RESELLER"],
        section: "LICENSE MANAGEMENT",
      },
    ],
  },
  {
    label: "History",
    roles: ["OWNER", "RESELLER"],
    items: [
      {
        href: "/owner-history",
        label: "Owner Key History",
        icon: FileTextIcon,
        color: "#a855f7",
        roles: ["OWNER"],
        section: "LICENSE MANAGEMENT",
      },
      {
        href: "/reseller-history",
        label: "Reseller Key History",
        icon: HistoryIcon,
        color: "#ec4899",
        roles: ["OWNER"],
        section: "LICENSE MANAGEMENT",
      },
      {
        href: "/reseller-history",
        label: "My Key History",
        icon: FileTextIcon,
        color: "#ec4899",
        roles: ["RESELLER"],
        section: "LICENSE MANAGEMENT",
      },
      {
        href: "/audit-logs",
        label: "Audit Logs",
        icon: ColumnsIcon,
        color: "#14b8a6",
        roles: ["RESELLER"],
        section: "MONITORING",
      },
    ],
  },
  {
    label: "System",
    roles: ["OWNER"],
    items: [
      {
        href: "/resellers",
        label: "Reseller",
        icon: UserPlusIcon,
        color: "#f97316",
        roles: ["OWNER"],
        section: "SYSTEM",
      },
    ],
  },
  {
    label: "Monitoring",
    roles: ["OWNER"],
    items: [
      {
        href: "/devices",
        label: "Active Devices",
        icon: MonitorIcon,
        color: "#22c55e",
        roles: ["OWNER"],
        badge: "devices",
        section: "MONITORING",
      },
      {
        href: "/banned-vault",
        label: "Banned & Kicked Vault",
        icon: BanIcon,
        color: "#ef4444",
        roles: ["OWNER"],
        badge: "banned",
        section: "MONITORING",
      },
      {
        href: "/audit-logs",
        label: "Audit Logs",
        icon: ColumnsIcon,
        color: "#14b8a6",
        roles: ["OWNER"],
        section: "MONITORING",
      },
    ],
  },
  // Last group on purpose: it lands directly under Audit Logs for both
  // roles, since Monitoring is the owner's final group and History is
  // the reseller's.
  {
    label: "UID Bypass",
    roles: ["OWNER", "RESELLER"],
    items: [
      {
        href: "/uid-bypass",
        label: "Overview",
        icon: CpuChipIcon,
        color: "#8b5cf6",
        roles: ["OWNER", "RESELLER"],
        pkg: UID_BYPASS_PACKAGE,
        section: "UID BYPASS",
      },
      {
        href: "/uid-bypass/whitelist",
        label: "Whitelist UID",
        icon: CheckCircleIcon,
        color: "#0ea5e9",
        roles: ["OWNER", "RESELLER"],
        pkg: UID_BYPASS_PACKAGE,
        section: "UID BYPASS",
      },
    ],
  },
];

/**
 * Whether a nav item belongs in this user's sidebar.
 *
 * The package check runs through the same `canManageWhitelist` the API
 * route uses, so a tab can never appear for someone the endpoint behind
 * it would refuse.
 */
export function canSeeItem(item: NavItem, user: SessionUser | null): boolean {
  const role: Role = user?.role ?? "RESELLER";
  if (!item.roles.includes(role)) return false;
  if (item.pkg === UID_BYPASS_PACKAGE) return canManageWhitelist(user);
  return true;
}

/** Pinned to the bottom of the rail, above the user card. */
export const PROFILE_ITEM: NavItem = {
  href: "/profile",
  label: "Profile",
  icon: SettingsIcon,
  color: "#eab308",
  roles: ["OWNER", "RESELLER"],
  section: "ADMIN CONTROLS",
};

const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), PROFILE_ITEM];

/** Page titles keyed by route, matching the original `tabs` map. */
export const PAGE_TITLES: Record<string, { title: string; section: string }> = {
  "/dashboard": { title: "Overview", section: "DASHBOARD" },
  "/messages": { title: "Messages", section: "DASHBOARD" },
  "/generator": { title: "Key Generator", section: "LICENSE GENERATOR" },
  "/manager": { title: "Manage Key", section: "LICENSE MANAGEMENT" },
  "/owner-history": { title: "Owner Key History", section: "LICENSE MANAGEMENT" },
  "/reseller-history": { title: "Reseller Key History", section: "LICENSE MANAGEMENT" },
  "/resellers": { title: "Reseller Management", section: "SYSTEM" },
  "/profile": { title: "Profile Settings", section: "ADMIN CONTROLS" },
  "/devices": { title: "Active Devices", section: "MONITORING" },
  "/banned-vault": { title: "Banned & Kicked Vault", section: "MONITORING" },
  "/audit-logs": { title: "Audit Logs", section: "MONITORING" },
  "/uid-bypass": { title: "Account Overview", section: "UID BYPASS" },
  "/uid-bypass/whitelist": { title: "Whitelist Management", section: "UID BYPASS" },
};

export function navColor(pathname: string): string {
  return ALL_ITEMS.find((item) => item.href === pathname)?.color ?? "#ff1f5a";
}

/** Quick-search index used by the header search box. */
export const SEARCH_ITEMS: Array<{
  name: string;
  href: string;
  keywords: string[];
  ownerOnly?: boolean;
}> = [
  {
    name: "Overview / Dashboard",
    href: "/dashboard",
    keywords: ["overview", "dashboard", "performance", "charts", "fps", "ping", "status"],
  },
  {
    name: "Messages / Announcements",
    href: "/messages",
    keywords: ["messages", "announcement", "notification", "broadcast", "notice", "news"],
  },
  {
    name: "Key Generator",
    href: "/generator",
    keywords: [
      "generate key",
      "create license",
      "generator",
      "pkg",
      "validity",
      "basic panel",
      "aimsilent",
      "uid bypass",
      "private aimkill",
      "vault panel",
    ],
  },
  {
    name: "Manage Key",
    href: "/manager",
    keywords: ["manage key", "reset hwid", "ban key", "unban key", "delete key", "target key"],
  },
  {
    name: "Owner Key History",
    href: "/owner-history",
    keywords: ["owner history", "key history", "created keys", "generated keys", "clear history"],
    ownerOnly: true,
  },
  {
    name: "Reseller Key History",
    href: "/reseller-history",
    keywords: ["reseller history", "my history", "keys generated by reseller"],
  },
  {
    name: "Reseller Management",
    href: "/resellers",
    keywords: [
      "create reseller",
      "reseller management",
      "subusers",
      "active resellers",
      "suspend reseller",
      "delete reseller",
    ],
    ownerOnly: true,
  },
  {
    name: "Active Devices",
    href: "/devices",
    keywords: ["active devices", "connected devices", "live sessions", "online count", "kick device"],
    ownerOnly: true,
  },
  {
    name: "Banned & Kicked Vault",
    href: "/banned-vault",
    keywords: ["banned vault", "banned users", "kicked users", "vault credentials", "unban user"],
    ownerOnly: true,
  },
  {
    name: "Audit Logs",
    href: "/audit-logs",
    keywords: ["audit logs", "system logs", "actions history", "ip address logs", "clear logs"],
  },
  {
    name: "UID Bypass Overview",
    href: "/uid-bypass",
    keywords: ["uid bypass", "whitelist overview", "terminalx999", "tx999", "sync status"],
  },
  {
    name: "Whitelist UID",
    href: "/uid-bypass/whitelist",
    keywords: [
      "whitelist uid",
      "add uid",
      "remove uid",
      "uid bypass",
      "bypass whitelist",
      "expire date",
      "delete expired",
    ],
  },
  {
    name: "Profile Settings",
    href: "/profile",
    keywords: ["profile settings", "change password", "avatar url", "display name", "save changes"],
  },
];
