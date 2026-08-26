export type Role = "OWNER" | "RESELLER";

export type ResellerStatus = "ACTIVE" | "SUSPENDED" | "PENDING APPROVAL" | "EXPIRED";

/**
 * The device a reseller account is pinned to.
 *
 * Bound on the first sign-in after locking, not at creation -- the owner
 * has no way to know the machine in advance. Clearing it (Reset HWID)
 * lets the next sign-in claim the account, which is how a reseller who
 * changes laptop gets back in.
 */
export interface DeviceLock {
  /** Device id from the long-lived cookie. The primary match. */
  hwid?: string;
  /** User-agent hash. Matches too, so clearing cookies is not a way out. */
  fingerprint?: string;
  /**
   * Address at bind time. Shown to the owner but never enforced: home
   * connections rotate, so matching on it would lock people out weekly.
   */
  ip?: string;
  boundAt?: string;
}

/** A sub-user account. `pass` is a bcrypt hash, never plaintext. */
export interface Reseller {
  pass: string;
  status: ResellerStatus;
  created: string;
  packages: string[];
  /** When set, the account may only be used from one device. */
  deviceLocked?: boolean;
  lock?: DeviceLock;
  /**
   * ISO date the account stops working. Absent means it never does.
   *
   * Enforced by comparison at request time rather than by a scheduled
   * sweep, so an overdue account is refused even if nothing has run.
   */
  expiresAt?: string;
  /** Cap on keys this reseller may generate. Absent or 0 means uncapped. */
  keyLimit?: number;
  /**
   * Keys reserved by an in-flight generate request but not yet recorded.
   *
   * The quota is reserved inside the DB transaction (which serialises)
   * *before* the upstream mint, so two requests racing from two tabs
   * cannot both slip past the limit. `pendingSince` bounds a leak: if a
   * request dies between reserving and finalising, the reservation is
   * ignored once it is older than the upstream timeout.
   */
  pendingKeys?: number;
  pendingSince?: string;
}

export interface KeyRecord {
  key: string;
  package: string;
  duration: string;
  /** "admin" for the owner, otherwise the reseller username. */
  creator: string;
  date: string;
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  ip: string;
}

export interface DeviceSession {
  sessionId: string;
  user: string;
  ip: string;
  device: string;
  timestamp: string;
  /** Opaque per-browser id from the long-lived device cookie. */
  hwid?: string;
  /** Coarse hash of the user-agent trio, used when the cookie is cleared. */
  fingerprint?: string;
}

/** What a ban rule matches on. */
export type BanScope = "ip" | "hwid" | "fingerprint";

/** A device-level block, independent of any account. */
export interface BanRule {
  scope: BanScope;
  value: string;
  reason: string;
  /** Account label of whoever added it. */
  by: string;
  at: string;
  /** Account the rule was created from, for display only. */
  user?: string;
}

export interface BannedUser {
  username: string;
  /** Kept for the vault view. Owner records store a masked placeholder. */
  password: string;
  role: Role;
  packages: string[];
  ip: string;
  device: string;
  kickedTime: string;
  hwid?: string;
  fingerprint?: string;
}

/** Owner-editable branding, saved from the Profile page. */
export interface ProfileSettings {
  displayName: string;
  avatar: string;
  banner: string;
}

export interface Database {
  cheatExeUsers: Record<string, Reseller>;
  cheatExeKeyHistory: KeyRecord[];
  cheatExeAuditLogs: AuditLog[];
  cheatExeDevices: DeviceSession[];
  cheatExeBannedUsers: BannedUser[];
  /** IP / device blocks enforced before any password is checked. */
  cheatExeBans: BanRule[];
  adminUser: string;
  /** bcrypt hash of the owner password. */
  adminPassHash: string;
  profile: ProfileSettings;
}

/** Shape returned to the browser: no hashes, ever. */
export interface PublicDatabase {
  cheatExeUsers: Record<string, Omit<Reseller, "pass">>;
  cheatExeKeyHistory: KeyRecord[];
  cheatExeAuditLogs: AuditLog[];
  cheatExeDevices: DeviceSession[];
  cheatExeBannedUsers: BannedUser[];
  cheatExeBans: BanRule[];
  adminUser: string;
  profile: ProfileSettings;
}

export interface SessionUser {
  username: string;
  role: Role;
  /** Packages this user may generate keys for. Owner gets all. */
  packages: string[];
  sessionId: string;
}

export type KeyAction = "reset_hwid" | "ban_key" | "unban_key" | "delete_key";

export interface LicensePackage {
  id: string;
  name: string;
  description: string;
}
