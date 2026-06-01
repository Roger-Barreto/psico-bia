import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { Session } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

type User = {
  username: string // email (mantém nome do campo pra não quebrar componentes existentes)
  displayName: string
  avatarId: number | null
}

type AuthContextValue = {
  user: User | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateUser: (next: User) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadProfile(session: Session): Promise<User> {
  const email = session.user.email ?? ""
  const { data, error } = await supabase
    .from("profile")
    .select("display_name, avatar_id")
    .eq("user_id", session.user.id)
    .maybeSingle()
  if (error) throw error
  return {
    username: email,
    displayName: data?.display_name ?? email,
    avatarId: typeof data?.avatar_id === "number" ? data.avatar_id : null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const sessionRef = useRef<Session | null>(null)
  const lastUserIdRef = useRef<string | null>(null)

  const hydrateFromSession = useCallback(async (session: Session | null) => {
    const prevUserId = lastUserIdRef.current
    const nextUserId = session?.user.id ?? null
    sessionRef.current = session
    lastUserIdRef.current = nextUserId

    // Drop cross-account cache when the authenticated identity changes
    // (logout, login as different user). Prevents stale data from one
    // account briefly rendering for another on the same browser.
    if (prevUserId !== nextUserId) {
      queryClient.clear()
    }

    if (!session) {
      setUser(null)
      return
    }
    try {
      const next = await loadProfile(session)
      setUser(next)
    } catch {
      setUser({
        username: session.user.email ?? "",
        displayName: session.user.email ?? "",
        avatarId: null,
      })
    }
  }, [queryClient])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      await hydrateFromSession(data.session)
      setReady(true)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      void hydrateFromSession(session)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [hydrateFromSession])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw new Error(error.message ?? "Credenciais inválidas")
      // Hydrate user state synchronously with the caller. Without this,
      // signInWithPassword resolves before the onAuthStateChange listener
      // finishes loading the profile — the LoginPage navigates to "/", the
      // ProtectedRoute sees user === null, and bounces back to /login.
      // The listener still fires, but its hydrate is idempotent.
      if (data.session) await hydrateFromSession(data.session)
    },
    [hydrateFromSession],
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshUser = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    try {
      const next = await loadProfile(session)
      setUser(next)
    } catch {
      /* keep current user */
    }
  }, [])

  const updateUser = useCallback(async (next: User) => {
    const session = sessionRef.current
    if (!session) throw new Error("Sem sessão ativa")
    const { error } = await supabase
      .from("profile")
      .upsert(
        {
          user_id: session.user.id,
          display_name: next.displayName,
          avatar_id: next.avatarId,
        },
        { onConflict: "user_id" },
      )
    if (error) throw error
    setUser(next)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, logout, refreshUser, updateUser }),
    [user, ready, login, logout, refreshUser, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
