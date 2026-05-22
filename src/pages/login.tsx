import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  LockKeyIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/auth-context"

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-bg relative grid min-h-screen place-items-center overflow-hidden px-4">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative inline-block">
            <img
              src="/logo.svg"
              alt="PsicoBia"
              className="size-14 rounded-2xl shadow-glow"
            />
            <span className="absolute -top-2 -right-4 rounded-full bg-secondary/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
              beta
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">PsicoBia</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre na sua conta para acessar o painel
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border/70 bg-card/70 p-7 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.7)] backdrop-blur-md"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <div className="relative">
                <UserIcon
                  weight="fill"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="admin"
                  className="pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <LockKeyIcon
                  weight="fill"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeSlashIcon weight="fill" className="size-4" />
                  ) : (
                    <EyeIcon weight="fill" className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <WarningCircleIcon
                  weight="fill"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Use{" "}
            <span className="font-mono text-foreground/80">admin</span> /{" "}
            <span className="font-mono text-foreground/80">admin</span> para
            testar
          </p>
        </form>
      </div>
    </div>
  )
}
