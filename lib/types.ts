export type Role = "OWNER" | "RESELLER";

export type ResellerStatus = "ACTIVE" | "SUSPENDED" | "PENDING APPROVAL";

/** A sub-user account. `pass` is a bcrypt hash, never plaintext. */
export interface Reseller {
  pass: string;
  status: ResellerStatus;
  created: string;
  packages: string[];
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
