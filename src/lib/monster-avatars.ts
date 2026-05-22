export const MONSTER_AVATAR_COUNT = 45

export function monsterAvatarSrc(avatarId: number): string {
  return `/monster-avatars/${avatarId}.png`
}

export function randomMonsterAvatarId(): number {
  return Math.floor(Math.random() * MONSTER_AVATAR_COUNT) + 1
}

export function stableMonsterAvatarId(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return (hash % MONSTER_AVATAR_COUNT) + 1
}
