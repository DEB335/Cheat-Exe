import { twMerge } from "tailwind-merge";

type ClassValue = string | false | null | undefined | ClassValue[];

/**
 * Joins class names and resolves Tailwind conflicts so the last one
 * written wins. Without the merge step, `p-0` passed to a component
 * whose base is `p-[30px]` loses to stylesheet order instead of author
 * order, which silently breaks overrides.
 */
export function cn(...parts: ClassValue[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    out.push(Array.isArray(part) ? flatten(part) : part);
  }
  return twMerge(out.join(" "));
}

function flatten(parts: ClassValue[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    out.push(Array.isArray(part) ? flatten(part) : part);
  }
  return out.join(" ");
}

/**
 * Matches the timestamp format already present in db.json
 * (e.g. "24/08/2026, 22:37:27") so old and new records sort and read
 * the same way.
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDateOnly(date: Date = new Date()): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Parses a user-agent into the "Windows (Chrome)" shape the vault stores. */
export function describeDevice(ua: string): string {
  let os = "Unknown OS";
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac")) os = "MacOS";
  else if (ua.includes("X11")) os = "UNIX";
  else if (ua.includes("Linux")) os = "Linux";

  let browser = "Unknown Browser";
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident")) browser = "IE";

  return `${os} (${browser})`;
}

export function newSessionId(): string {
  return `sess_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

/** Label used throughout the audit log and device list. */
export function displayUser(username: string, role: "OWNER" | "RESELLER"): string {
  return role === "OWNER" ? "Owner (OWNER)" : `${username} (RESELLER)`;
}

/**
 * "#ff1f5a" -> "255, 31, 90". The collapsed sidebar tints one icon at a
 * time, so each nav item exposes its accent as an rgb triplet that
 * arbitrary Tailwind values can drop straight into rgba().
 */
export function hexToRgbTriplet(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
