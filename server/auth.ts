import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

export interface PasswordHash {
  salt: string
  hash: string
}

export interface StoredUser {
  username: string
  displayName: string
  avatarId: number | null
  password: PasswordHash
}

export interface SafeUser {
  username: string
  displayName: string
  avatarId: number | null
}

const KEY_LEN = 64

export function hashPassword(plain: string): PasswordHash {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(plain, salt, KEY_LEN).toString("hex")
  return { salt, hash }
}

export function verifyPassword(plain: string, stored: PasswordHash): boolean {
  const candidate = scryptSync(plain, stored.salt, KEY_LEN)
  const expected = Buffer.from(stored.hash, "hex")
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

export function sanitizeUser(user: StoredUser): SafeUser {
  return {
    username: user.username,
    displayName: user.displayName,
    avatarId: user.avatarId,
  }
}

export const DEFAULT_USER: StoredUser = {
  username: "admin",
  displayName: "Administrador",
  avatarId: null,
  password: hashPassword("admin"),
}
