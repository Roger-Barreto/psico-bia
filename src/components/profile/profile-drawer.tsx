import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  EyeIcon,
  EyeSlashIcon,
  LockKeyIcon,
  TrashIcon,
  UserCircleIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AvatarPicker } from "@/components/patient/avatar-picker"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

function SectionBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: PhosphorIcon
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <Icon weight="fill" className="size-4 shrink-0 text-primary" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function ProfileDrawer({ open, onOpenChange }: Props) {
  const { user, updateUser } = useAuth()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Meu perfil</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Atualize seu nome de exibição, avatar e senha.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {user ? (
            <div className="flex flex-col gap-4">
              <ProfileSection user={user} onSaved={updateUser} />
              <PasswordSection drawerOpen={open} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ProfileSection({
  user,
  onSaved,
}: {
  user: { username: string; displayName: string; avatarId: number | null }
  onSaved: (next: {
    username: string
    displayName: string
    avatarId: number | null
  }) => void
}) {
  const [displayName, setDisplayName] = useState(user.displayName)
  const [avatarId, setAvatarId] = useState<number | null>(user.avatarId)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDisplayName(user.displayName)
    setAvatarId(user.avatarId)
  }, [user])

  const dirty =
    displayName.trim() !== user.displayName || avatarId !== user.avatarId

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) return toast.error("Nome de exibição é obrigatório")
    setSaving(true)
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed, avatarId }),
      })
      if (!res.ok) throw new Error("Falha ao salvar")
      const next = await res.json()
      onSaved(next)
      toast.success("Perfil atualizado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <SectionBlock title="Perfil" icon={UserCircleIcon}>
        <div className="flex flex-col items-center gap-2 pb-1">
          <AvatarPicker
            value={avatarId ?? 1}
            onChange={(id) => setAvatarId(id)}
            name={displayName || user.username}
            size="lg"
          />
          <p className="text-[11px] text-muted-foreground">
            Toque para escolher o avatar
          </p>
          {avatarId !== null && (
            <button
              type="button"
              onClick={() => setAvatarId(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashIcon weight="fill" className="size-3" />
              Remover avatar
            </button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Nome de exibição</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Como você quer ser chamado"
            maxLength={80}
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Login:{" "}
            <span className="font-mono text-foreground/80">{user.username}</span>{" "}
            (não pode ser alterado)
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </SectionBlock>
    </form>
  )
}

function PasswordSection({ drawerOpen }: { drawerOpen: boolean }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!drawerOpen) {
      setCurrent("")
      setNext("")
      setConfirm("")
      setShowCurrent(false)
      setShowNew(false)
      setCurrentError(null)
    }
  }, [drawerOpen])

  const newTooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit =
    current.length > 0 && next.length >= 8 && confirm === next && !saving

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCurrentError(null)
    if (next.length < 8) return toast.error("Nova senha deve ter pelo menos 8 caracteres")
    if (next !== confirm) return toast.error("Confirmação não confere")
    setSaving(true)
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
        }),
      })
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}))
        if (data?.error === "current_password_invalid") {
          setCurrentError("Senha atual incorreta")
          return
        }
        throw new Error(data?.error ?? "Falha ao alterar senha")
      }
      if (!res.ok) throw new Error("Falha ao alterar senha")
      setCurrent("")
      setNext("")
      setConfirm("")
      toast.success("Senha atualizada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <SectionBlock title="Senha" icon={LockKeyIcon}>
        <PasswordField
          id="current-pw"
          label="Senha atual"
          value={current}
          onChange={(v) => {
            setCurrent(v)
            if (currentError) setCurrentError(null)
          }}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
          error={currentError}
          autoComplete="current-password"
        />
        <PasswordField
          id="new-pw"
          label="Nova senha"
          value={next}
          onChange={setNext}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          error={newTooShort ? "Mínimo 8 caracteres" : null}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-pw"
          label="Confirmar nova senha"
          value={confirm}
          onChange={setConfirm}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          error={mismatch ? "Confirmação não confere" : null}
          autoComplete="new-password"
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit}>
            {saving ? "Salvando..." : "Alterar senha"}
          </Button>
        </div>
      </SectionBlock>
    </form>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  error,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  error: string | null
  autoComplete: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyIcon
          weight="fill"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className={cn(
            "pl-9 pr-10",
            error && "border-destructive focus-visible:ring-destructive",
          )}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          {show ? (
            <EyeSlashIcon weight="fill" className="size-4" />
          ) : (
            <EyeIcon weight="fill" className="size-4" />
          )}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
