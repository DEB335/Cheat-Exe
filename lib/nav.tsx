import {
  BanIcon,
  MegaphoneIcon,
  CheckCircleIcon,
  ColumnsIcon,
  CpuChipIcon,
  FileTextIcon,
  GamepadIcon,
  GridIcon,
  HistoryIcon,
  KeyIcon,
  MonitorIcon,
  SettingsIcon,
  SlidersIcon,
  UserPlusIcon,
  TrophyIcon,
  CrownIcon,
  BoltIcon,
  BotIcon,
} from "@/components/icons";
import { UID_BYPASS_PACKAGE, canManageWhitelist, canAccessEmulatorBypass, canAccessGlory } from "./packages";
import type { Role, SessionUser } from "./types";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  /** Accent used by the collapsed rail and the click wave. */
  color: string;
  roles: Role[];
  badge?: "devices" | "banned" | "messages";
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
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "DASHBOARD",
      },
      {
        href: "/messages",
        label: "Messages",
        icon: MegaphoneIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        badge: "messages",
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
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "LICENSE GENERATOR",
      },
      {
        href: "/manager",
        label: "Manage Key",
        icon: SlidersIcon,
        color: "#f97316",
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
        color: "#f97316",
        roles: ["OWNER"],
        section: "LICENSE MANAGEMENT",
      },
      {
        href: "/reseller-history",
        label: "Reseller Key History",
        icon: HistoryIcon,
        color: "#f97316",
        roles: ["OWNER"],
        section: "LICENSE MANAGEMENT",
      },
      {
        href: "/reseller-history",
        label: "My Key History",
        icon: FileTextIcon,
        color: "#f97316",
        roles: ["RESELLER"],
        section: "LICENSE MANAGEMENT",
      },
      {
        href: "/audit-logs",
        label: "Audit Logs",
        icon: ColumnsIcon,
        color: "#f97316",
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
        color: "#f97316",
        roles: ["OWNER"],
        badge: "devices",
        section: "MONITORING",
      },
      {
        href: "/banned-vault",
        label: "Banned & Kicked Vault",
        icon: BanIcon,
        color: "#f97316",
        roles: ["OWNER"],
        badge: "banned",
        section: "MONITORING",
      },
      {
        href: "/audit-logs",
        label: "Audit Logs",
        icon: ColumnsIcon,
        color: "#f97316",
        roles: ["OWNER"],
        section: "MONITORING",
      },
    ],
  },
  // Last group on purpose: it lands directly under Audit Logs for both
  // roles, since Monitoring is the owner's final group and History is
  // the reseller's.
  {
    label: "Bypass",
    roles: ["OWNER", "RESELLER"],
    items: [
      {
        href: "/uid-bypass",
        label: "Overview",
        icon: CpuChipIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "BYPASS",
      },
      {
        href: "/uid-bypass/whitelist",
        label: "Whitelist UID",
        icon: CheckCircleIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "BYPASS",
      },
      {
        href: "/emulator-bypass",
        label: "Emulator Bypass",
        icon: GamepadIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "BYPASS",
      },
    ],
  },
  {
    label: "Glory",
    roles: ["OWNER", "RESELLER"],
    items: [
      {
        href: "/glory",
        label: "Overview",
        icon: TrophyIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "GLORY",
      },
      {
        href: "/glory/guild",
        label: "Guild Analytics",
        icon: CrownIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "GLORY",
      },
      {
        href: "/glory/matchmaking",
        label: "Matchmaking",
        icon: BoltIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "GLORY",
      },
      {
        href: "/glory/bots",
        label: "Bot Generate",
        icon: BotIcon,
        color: "#f97316",
        roles: ["OWNER", "RESELLER"],
        section: "GLORY",
      },
    ],
  },
];

/**
 * Whether a nav item belongs in this user's sidebar.
 */
export function canSeeItem(
  item: NavItem,
  user: SessionUser | null,
  packages: string[],
): boolean {
  const role: Role = user?.role ?? "RESELLER";
  if (!item.roles.includes(role)) return false;
  if (item.href === "/uid-bypass") {
    return user !== null && (canManageWhitelist(user) || canAccessEmulatorBypass(user));
  }
  if (item.href === "/uid-bypass/whitelist") {
    return user !== null && canManageWhitelist(user);
  }
  if (item.href === "/emulator-bypass") {
    return user !== null && canAccessEmulatorBypass(user);
  }
  if (item.pkg === UID_BYPASS_PACKAGE) {
    return user !== null && canManageWhitelist(user);
  }
  if (item.href.startsWith("/glory")) {
    return user !== null && canAccessGlory(user);
  }
  return true;
}

/** Pinned to the bottom of the rail, above the user card. */
export const PROFILE_ITEM: NavItem = {
  href: "/profile",
  label: "Profile",
  icon: SettingsIcon,
  color: "#f97316",
  roles: ["OWNER", "RESELLER"],
  section: "ADMIN CONTROLS",
};

const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), PROFILE_ITEM];

/**
 * Neon ramps a run of title text can be lit with. The header owns the
 * actual stops (and deeper ones for light mode); this only names them.
 */
export type TitleGradient =
  | "cyan-violet-pink"
  | "pink-violet-blue"
  | "blue-violet"
  | "blue-magenta"
  | "pink-violet";

/** Glass emblem the header draws beside the title. */
export type TitleIcon = "key-cube" | "shield-key" | "gear";

/** Eyebrow colour. Left out, the eyebrow keeps the pale blue every page had. */
export type EyebrowTone = "violet" | "indigo" | "cyan" | "blue";

export interface PageTitle {
  /** The plain name. Search, the tab and anything else that reads a title use this. */
  title: string;
  /** Eyebrow printed above the title. */
  section: string;
  subtitle?: string;
  /**
   * The title split into runs, for the two-tone headings in the
   * redesign ("Key" white, "Generator" lit). Joined, they must spell
   * `title` exactly -- the header falls back to `title` whenever it
   * prints something else, as the reseller's "My Key History" does.
   */
  parts?: Array<{ text: string; gradient?: TitleGradient }>;
  icon?: TitleIcon;
  eyebrowTone?: EyebrowTone;
  /** A short neon bar in front of the eyebrow. */
  eyebrowBar?: boolean;
  /** A glowing hairline under the title. */
  underline?: boolean;
}

/**
 * Page titles keyed by route, matching the original `tabs` map. A
 * subtitle, where there is one, prints under the title in the header.
 * The optional styling fields follow the redesign mockups page by page;
 * a page without them renders exactly as it always has.
 */
export const PAGE_TITLES: Record<string, PageTitle> = {
  "/dashboard": {
    title: "Overview",
    section: "DASHBOARD",
    subtitle: "Monitor your platform performance at a glance.",
  },
  "/messages": { title: "Messages", section: "DASHBOARD" },
  "/generator": {
    title: "Key Generator",
    section: "LICENSE GENERATOR",
    parts: [{ text: "Key " }, { text: "Generator", gradient: "cyan-violet-pink" }],
    icon: "key-cube",
    eyebrowTone: "indigo",
  },
  "/manager": {
    title: "Manage Key",
    section: "LICENSE MANAGEMENT",
    icon: "shield-key",
    eyebrowTone: "violet",
    underline: true,
  },
  "/owner-history": {
    title: "Owner Key History",
    section: "LICENSE MANAGEMENT",
    icon: "shield-key",
    eyebrowTone: "violet",
  },
  "/reseller-history": {
    title: "Reseller Key History",
    section: "LICENSE MANAGEMENT",
    icon: "shield-key",
    eyebrowTone: "violet",
  },
  "/resellers": {
    title: "Reseller Management",
    section: "SYSTEM",
    parts: [{ text: "Reseller Management", gradient: "pink-violet-blue" }],
    eyebrowTone: "cyan",
  },
  "/profile": {
    title: "Profile Settings",
    section: "ADMIN CONTROLS",
    subtitle: "Manage your account details, credentials and preferences.",
  },
  "/devices": { title: "Active Devices", section: "MONITORING" },
  "/banned-vault": {
    title: "Banned & Kicked Vault",
    section: "MONITORING",
    parts: [{ text: "Banned & Kicked", gradient: "blue-magenta" }, { text: " Vault" }],
    eyebrowBar: true,
  },
  "/audit-logs": {
    title: "Audit Logs",
    section: "MONITORING",
    subtitle: "Track system activities, user actions and security events in real-time.",
    parts: [{ text: "Audit Logs", gradient: "cyan-violet-pink" }],
    eyebrowTone: "cyan",
  },
  "/uid-bypass": { title: "Account Overview", section: "BYPASS" },
  "/uid-bypass/whitelist": {
    title: "Whitelist Management",
    section: "BYPASS",
    subtitle: "Manage and control UIDs for bypass service. Add, track and manage whitelisted users easily.",
    parts: [{ text: "Whitelist " }, { text: "Management", gradient: "pink-violet" }],
    eyebrowTone: "blue",
  },
  "/emulator-bypass": {
    title: "Emulator Bypass",
    section: "BYPASS",
    subtitle: "Manage emulator bypass access and generate license keys.",
    parts: [{ text: "Emulator " }, { text: "Bypass", gradient: "pink-violet" }],
    eyebrowTone: "violet",
  },
  "/glory": {
    title: "Overview",
    section: "GLORY",
  },
  "/glory/guild": {
    title: "Guild Analytics",
    section: "GLORY",
    subtitle:
      "Each guild is displayed in its own card. Click Show Members on any guild card to expand its bot roster.",
  },
  "/glory/matchmaking": {
    title: "Matchmaking",
    section: "GLORY",
    subtitle:
      "Select an active guild to launch a 10-Hour Nonstop Squad Session (costs 1 Credit per squad). Bots must belong to a guild.",
  },
  "/glory/bots": {
    title: "Bot Accounts",
    section: "GLORY",
    subtitle:
      "Guest bot accounts bound to your guilds. Generating bot accounts requires a mandatory Guild ID and costs 1 Credit.",
  },
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
  /** Same gate as the sidebar item: without the grant, not offered. */
  pkg?: string;
  /**
   * Section gate matching the sidebar, so search is not a way into a
   * section the grant has already taken away.
   */
  gate?: "uid" | "emulator" | "glory";
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
    pkg: UID_BYPASS_PACKAGE,
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
    pkg: UID_BYPASS_PACKAGE,
  },
  {
    name: "Emulator Bypass",
    href: "/emulator-bypass",
    keywords: ["emulator bypass", "emulator", "bypass", "credits", "generate key", "uid bypass"],
    gate: "emulator",
  },
  {
    name: "Profile Settings",
    href: "/profile",
    keywords: ["profile settings", "change password", "avatar url", "display name", "save changes"],
  },
  {
    name: "Glory Overview",
    href: "/glory",
    keywords: ["glory", "glory overview", "tournament", "score", "points", "ranking"],
    gate: "glory",
  },
  {
    name: "Guild Analytics",
    href: "/glory/guild",
    keywords: ["guild analytics", "guild", "bot guilds", "clan id", "inspect guild id", "query id", "live glory"],
    gate: "glory",
  },
  {
    name: "Matchmaking",
    href: "/glory/matchmaking",
    keywords: ["matchmaking", "squad", "10-hour nonstop", "automated loop", "bot matrix", "formation"],
    gate: "glory",
  },
  {
    name: "Bot Generate",
    href: "/glory/bots",
    keywords: ["bot generate", "bot accounts", "guest bots", "guild id", "generate accounts"],
    gate: "glory",
  },
];
