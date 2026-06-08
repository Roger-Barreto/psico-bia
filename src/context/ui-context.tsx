import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const STORAGE_KEY = "sidebar-collapsed"
/** Below this width the desktop sidebar auto-collapses to icons (lg breakpoint). */
const AUTO_COLLAPSE_QUERY = "(max-width: 1023px)"

type SidebarContextValue = {
  /** Desktop sidebar shows icon-only when true. */
  collapsed: boolean
  /** Manual toggle — persists the choice and stops auto-following the viewport. */
  setCollapsed: (value: boolean) => void
  toggleCollapsed: () => void
  /** Mobile left-drawer (Sheet) open state. */
  mobileNavOpen: boolean
  setMobileNavOpen: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function readStoredPref(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === "true") return true
    if (raw === "false") return false
  } catch {
    /* localStorage unavailable */
  }
  return null
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Whether the user has made an explicit choice (persisted). When false we
  // follow the viewport: collapsed on tablet-portrait, expanded on large screens.
  const [hasUserPref, setHasUserPref] = useState(() => readStoredPref() !== null)
  const [collapsed, setCollapsedState] = useState(() => {
    const stored = readStoredPref()
    if (stored !== null) return stored
    return window.matchMedia(AUTO_COLLAPSE_QUERY).matches
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Auto-follow the viewport until the user makes a manual choice.
  useEffect(() => {
    if (hasUserPref) return
    const mql = window.matchMedia(AUTO_COLLAPSE_QUERY)
    const apply = () => setCollapsedState(mql.matches)
    apply()
    mql.addEventListener("change", apply)
    return () => mql.removeEventListener("change", apply)
  }, [hasUserPref])

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    setHasUserPref(true)
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = useCallback(
    () => setCollapsed(!collapsed),
    [collapsed, setCollapsed],
  )

  const value = useMemo<SidebarContextValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
    }),
    [collapsed, setCollapsed, toggleCollapsed, mobileNavOpen],
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider")
  return ctx
}
