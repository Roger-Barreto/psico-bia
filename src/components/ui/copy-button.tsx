import * as React from "react"
import { CheckIcon, CopyIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

export interface CopyButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Texto que vai para a área de transferência. */
  value: string
  /** Nome do dado, usado no toast e no rótulo acessível. Ex.: "CPF". */
  label?: string
  /**
   * `inline` — botão discreto para listas/cards.
   * `boxed` — quadrado de cantos arredondados na altura do Input (h-11),
   * para ficar ao lado de um campo de formulário.
   */
  variant?: "inline" | "boxed"
}

/**
 * Copia um valor com feedback (ícone vira ✓ por 1,5 s + toast).
 *
 * Chama `stopPropagation` porque costuma viver dentro de cards clicáveis —
 * copiar não deve abrir o registro.
 */
export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, label = "Valor", variant = "inline", className, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false)
    const timer = React.useRef<ReturnType<typeof setTimeout>>()

    React.useEffect(() => () => clearTimeout(timer.current), [])

    async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation()
      e.preventDefault()
      const ok = await copyText(value)
      if (!ok) {
        toast.error(`Não foi possível copiar o ${label}`)
        return
      }
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
      toast.success(`${label} copiado`)
    }

    const Icon = copied ? CheckIcon : CopyIcon

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onKeyDown={(e) => e.stopPropagation()}
        title={`Copiar ${label}`}
        aria-label={`Copiar ${label}`}
        className={cn(
          "grid shrink-0 place-items-center rounded-md transition-colors [touch-action:manipulation]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
          variant === "boxed"
            ? "size-11 border border-input bg-background/40 text-muted-foreground hover:border-ring/60 hover:text-foreground"
            : "size-6 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          copied && "text-emerald-400 hover:text-emerald-400",
          className,
        )}
        {...props}
      >
        <Icon
          weight={copied ? "bold" : "regular"}
          className={variant === "boxed" ? "size-4" : "size-3.5"}
        />
      </button>
    )
  },
)
CopyButton.displayName = "CopyButton"
