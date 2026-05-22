import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  WarningCircleIcon,
  HeartIcon,
  SparkleIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-bg relative min-h-screen overflow-hidden">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* LEFT — brand / illustration panel */}
        <aside className="relative hidden overflow-hidden lg:block">
          <img
            src="/login-art.jpg"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          {/* readability overlays: dark vignette + bottom-left gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/20 to-background/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/35 to-transparent" />

          {/* top brand */}
          <div className="absolute left-10 top-10 flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="PsicoBia"
              className="size-11 rounded-2xl shadow-glow"
            />
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                PsicoBia
              </span>
              <span className="rounded-full bg-secondary/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground shadow-sm">
                beta
              </span>
            </div>
          </div>

          {/* bottom copy on a glass plate for guaranteed contrast */}
          <div className="absolute inset-x-10 bottom-10 max-w-md">
            <div className="rounded-2xl border border-white/10 bg-background/55 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md">
              <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-white">
                Cuidar de quem cuida.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                Gestão clínica completa — pacientes, sessões, cobrança e humor,
                num só lugar.
              </p>

              <ul className="mt-5 space-y-3 text-sm font-medium text-white/95">
                <li className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.6)]">
                    <HeartIcon weight="fill" className="size-4" />
                  </span>
                  Acompanhamento humano e contínuo
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-[0_4px_14px_-4px_hsl(var(--secondary)/0.6)]">
                    <SparkleIcon weight="fill" className="size-4" />
                  </span>
                  Insights de evolução por paciente
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_4px_14px_-4px_hsl(var(--accent)/0.6)]">
                    <ShieldCheckIcon weight="fill" className="size-4" />
                  </span>
                  Dados privados, sob seu controle
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* RIGHT — form panel */}
        <main className="relative grid place-items-center px-4 py-10 sm:px-8">
          {/* mobile ambient blobs */}
          <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl lg:hidden" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-secondary/20 blur-3xl lg:hidden" />

          <div className="relative z-10 w-full max-w-sm animate-fade-in">
            <div className="mb-8">
              <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
                <img
                  src="/logo.svg"
                  alt="PsicoBia"
                  className="size-12 rounded-2xl shadow-glow lg:size-11"
                />
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                    PsicoBia
                  </h1>
                  <span className="rounded-full bg-secondary/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                    beta
                  </span>
                </div>
              </div>

              <div className="text-center lg:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                  Bem-vindo de volta
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight lg:text-3xl">
                  Entre na sua conta
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Acesse o painel para gerenciar pacientes e sessões.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
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
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border/60" />
                <span>credenciais de teste</span>
                <span className="h-px flex-1 bg-border/60" />
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Use <span className="font-mono text-foreground/80">admin</span>{" "}
                / <span className="font-mono text-foreground/80">admin</span>
              </p>
            </form>
          </div>

          <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-muted-foreground/70">
            © PsicoBia — feito com cuidado
          </p>
        </main>
      </div>
    </div>
  );
}
