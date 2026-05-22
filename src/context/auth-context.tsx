import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type User = {
  username: string
  displayName: string
  avatarId: number | null
}

type AuthContextValue = {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  updateUser: (next: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = "admin-panel.auth"

function readStored(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<User> & { username?: string }
    if (!parsed.username) return null
    return {
      username: parsed.username,
      displayName: parsed.displayName ?? parsed.username,
      avatarId:
        typeof parsed.avatarId === "number" ? parsed.avatarId : null,
    }
  } catch {
    return null
  }
}

function writeStored(user: User | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  else localStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(readStored)

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error ?? "Credenciais inválidas")
    }
    const next = (await res.json()) as User
    setUser(next)
    writeStored(next)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    writeStored(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await fetch("/api/me")
    if (!res.ok) return
    const next = (await res.json()) as User
    setUser(next)
    writeStored(next)
  }, [])

  const updateUser = useCallback((next: User) => {
    setUser(next)
    writeStored(next)
  }, [])

  useEffect(() => {
    if (user) {
      void refreshUser()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ user, login, logout, refreshUser, updateUser }),
    [user, login, logout, refreshUser, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
