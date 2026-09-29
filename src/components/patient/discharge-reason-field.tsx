import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowClockwiseIcon,
  CheckIcon,
  PlusIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { useCreateDischargeReason, useDischargeReasons } from "@/api/queries"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/** Oferecidos com um toque enquanto a conta ainda não cadastrou nenhum. */
const SUGGESTED_REASONS = [
  "Alta terapêutica",
  "Desistência",
  "Motivos financeiros",
  "Mudança de cidade",
  "Encaminhamento",
]

interface Props {
  /** Id do motivo escolhido, ou `""` quando nada foi escolhido. */
  value: string
  onChange: (id: string) => void
  /** Mostra o aviso de campo obrigatório (depois da 1ª tentativa de enviar). */
  showError?: boolean
}

/**
 * Motivo do encerramento como lista de opções **na própria tela**.
 *
 * Era um `<Select>` flutuante, e falhava por dois motivos:
 *
 * 1. Conta sem nenhum motivo cadastrado (toda conta nova — só as migradas do
 *    JSON antigo trouxeram os seus): o menu abria vazio, sem aviso e sem
 *    caminho para criar um, e o encerramento exige motivo. Era impossível
 *    encerrar um tratamento sem antes descobrir a tela de cadastros.
 * 2. O menu é um `position: fixed` portalado dentro do drawer, que rola e tem
 *    `backdrop-filter`. No WebKit do iPhone/iPad esse arranjo já deixou a
 *    forma de pagamento sem abrir (ver `payment-control.tsx`) — e aqui é o
 *    pior caso, porque o campo fica no fim de um formulário comprido.
 *
 * Opções inline não têm portal, popper nem recorte; e dá para criar o motivo
 * sem sair do formulário.
 */
export function DischargeReasonField({ value, onChange, showError }: Props) {
  const reasonsQ = useDischargeReasons()
  const createReason = useCreateDischargeReason()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  const reasons = useMemo(
    () =>
      (reasonsQ.data ?? [])
        .filter((r) => r.active)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [reasonsQ.data],
  )

  async function create(raw: string) {
    const name = raw.trim()
    if (!name || createReason.isPending) return
    // Já existe com esse nome? Só seleciona — não cria duplicado.
    const existing = reasons.find(
      (r) => r.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0,
    )
    if (existing) {
      onChange(existing.id)
      setCreating(false)
      setNewName("")
      return
    }
    try {
      const created = await createReason.mutateAsync({ name, active: true })
      onChange(created.id)
      setCreating(false)
      setNewName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar motivo")
    }
  }

  function cancelCreate() {
    setCreating(false)
    setNewName("")
  }

  return (
    <div className="space-y-1.5">
      <p id="discharge-reason-label" className="text-xs text-muted-foreground">
        Motivo
      </p>

      {reasonsQ.isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : reasonsQ.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <span className="flex items-center gap-1.5">
            <WarningCircleIcon weight="fill" className="size-4 shrink-0" />
            Não foi possível carregar os motivos.
          </span>
          <button
            type="button"
            onClick={() => reasonsQ.refetch()}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 font-medium text-rose-100 hover:bg-rose-500/20"
          >
            <ArrowClockwiseIcon weight="bold" className="size-3.5" />
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          {reasons.length > 0 && (
            <RadioGroup
              value={value}
              onValueChange={onChange}
              aria-labelledby="discharge-reason-label"
              className="gap-1.5"
            >
              {reasons.map((r) => {
                const on = value === r.id
                return (
                  <label
                    key={r.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                      on
                        ? "border-destructive/60 bg-destructive/15 text-foreground"
                        : "border-border/60 bg-background/40 hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem
                      value={r.id}
                      className={cn(
                        "size-5 shrink-0",
                        on && "border-destructive text-destructive",
                      )}
                    />
                    <span className="min-w-0 flex-1 break-words">{r.name}</span>
                  </label>
                )
              })}
            </RadioGroup>
          )}

          {reasons.length === 0 && (
            <div className="space-y-2 rounded-lg border border-dashed border-border/70 bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">
                Você ainda não cadastrou motivos de encerramento. Toque em uma
                sugestão ou crie o seu:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_REASONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => create(name)}
                    disabled={createReason.isPending}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-60"
                  >
                    <PlusIcon
                      weight="bold"
                      className="size-3.5 text-muted-foreground"
                    />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {creating ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Alta terapêutica"
                maxLength={80}
                aria-label="Nome do novo motivo"
                onKeyDown={(e) => {
                  // O campo vive dentro do <form> do paciente: sem isto o
                  // Enter salvaria o cadastro em vez de criar o motivo.
                  if (e.key === "Enter") {
                    e.preventDefault()
                    create(newName)
                  } else if (e.key === "Escape") {
                    cancelCreate()
                  }
                }}
              />
              <button
                type="button"
                onClick={() => create(newName)}
                disabled={createReason.isPending || !newName.trim()}
                className="grid size-11 shrink-0 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
                aria-label="Criar motivo"
              >
                {createReason.isPending ? (
                  <Spinner className="size-4" />
                ) : (
                  <CheckIcon weight="bold" className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={cancelCreate}
                className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                aria-label="Cancelar novo motivo"
              >
                <XIcon weight="bold" className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <PlusIcon weight="bold" className="size-3.5" />
              Novo motivo
            </button>
          )}
        </>
      )}

      {showError && !reasonsQ.isLoading && (
        <p className="text-xs text-rose-300">
          Escolha o motivo do encerramento.
        </p>
      )}
    </div>
  )
}
