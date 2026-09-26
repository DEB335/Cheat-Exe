import type { Role } from "./types";

export type OsKind = "windows" | "android" | "ios" | "macos" | "linux" | "unix" | "unknown";
export type BrowserKind = "chrome" | "edge" | "firefox" | "safari" | "ie" | "unknown";

export interface ParsedDevice {
  os: OsKind;
  browser: BrowserKind;
  /** As stored, e.g. "Windows" -- "Unknown OS" when the agent was not recognised. */
  osLabel: string;
  browserLabel: string;
}

const OS_KINDS: Record<string, OsKind> = {
  windows: "windows",
  android: "android",
  ios: "ios",
  macos: "macos",
  linux: "linux",
  unix: "unix",
};

const BROWSER_KINDS: Record<string, BrowserKind> = {
  chrome: "chrome",
  edge: "edge",
  firefox: "firefox",
  safari: "safari",
  ie: "ie",
};

/**
 * Splits the "Windows (Chrome)" label `describeDevice` stores back into
 * its two halves, so each can get its own mark. Anything that does not
 * fit the shape comes back whole as the OS label with unknown kinds.
 */
export function parseDevice(label: string): ParsedDevice {
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(label.trim());
  const osLabel = (match ? match[1] : label).trim() || "Unknown OS";
  const browserLabel = (match ? match[2] : "").trim() || "Unknown Browser";
  return {
    os: OS_KINDS[osLabel.toLowerCase()] ?? "unknown",
    browser: BROWSER_KINDS[browserLabel.toLowerCase()] ?? "unknown",
    osLabel,
    browserLabel,
  };
}

/** "ALPHA (RESELLER)" -> { name: "ALPHA", role: "RESELLER" }, as the device list stores it. */
export function parseDeviceUser(user: string): { name: string; role: Role } {
  return {
    name: user.split(" ")[0] ?? user,
    role: user.includes("OWNER") ? "OWNER" : "RESELLER",
  };
}
