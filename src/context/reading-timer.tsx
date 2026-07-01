import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

const STORAGE_KEY = "leituras:timer"

export interface TimerState {
  bookId: string
  startedAtIso: string // quando a sessão começou (vira started_at)
  startEpoch: number // epoch ms do último start/resume
  accumulatedMs: number // ms acumulados antes do último resume
  running: boolean
}

export interface StoppedSession {
  bookId: string
  startedAtIso: string
  endedAtIso: string
  durationSeconds: number
}

interface TimerCtx {
  active: TimerState | null
  elapsedSeconds: number
  start: (bookId: string) => void
  pause: () => void
  resume: () => void
  stop: () => StoppedSession | null
  cancel: () => void
}

const ReadingTimerContext = createContext<TimerCtx | null>(null)

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TimerState) : null
  } catch {
    return null
  }
}

function persist(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignora — storage indisponível */
  }
}

/** Segundos decorridos, derivados dos epochs (sobrevivem a reload). */
function elapsedOf(s: TimerState | null): number {
  if (!s) return 0
  const extra = s.running ? Date.now() - s.startEpoch : 0
  return Math.max(0, Math.floor((s.accumulatedMs + extra) / 1000))
}

export function ReadingTimerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<TimerState | null>(() => load())
  const [, setTick] = useState(0)
  const intervalRef = useRef<number | null>(null)

  // Faz o relógio "andar" enquanto rodando (o valor real vem dos epochs).
  useEffect(() => {
    if (!active?.running) return
    intervalRef.current = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [active?.running])

  const update = (s: TimerState | null) => {
    persist(s)
    setActive(s)
  }

  const start = (bookId: string) => {
    if (active) return
    update({
      bookId,
      startedAtIso: new Date().toISOString(),
      startEpoch: Date.now(),
      accumulatedMs: 0,
      running: true,
    })
  }

  const pause = () => {
    if (!active || !active.running) return
    update({
      ...active,
      accumulatedMs: active.accumulatedMs + (Date.now() - active.startEpoch),
      running: false,
    })
  }

  const resume = () => {
    if (!active || active.running) return
    update({ ...active, startEpoch: Date.now(), running: true })
  }

  const stop = (): StoppedSession | null => {
    if (!active) return null
    const stopped: StoppedSession = {
      bookId: active.bookId,
      startedAtIso: active.startedAtIso,
      endedAtIso: new Date().toISOString(),
      durationSeconds: elapsedOf(active),
    }
    update(null)
    return stopped
  }

  const cancel = () => update(null)

  return (
    <ReadingTimerContext.Provider
      value={{
        active,
        elapsedSeconds: elapsedOf(active),
        start,
        pause,
        resume,
        stop,
        cancel,
      }}
    >
      {children}
    </ReadingTimerContext.Provider>
  )
}

export function useReadingTimer(): TimerCtx {
  const ctx = useContext(ReadingTimerContext)
  if (!ctx)
    throw new Error("useReadingTimer precisa estar dentro de ReadingTimerProvider")
  return ctx
}
