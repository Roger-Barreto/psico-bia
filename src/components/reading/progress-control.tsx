import { useEffect, useState } from "react"
import {
  CheckCircleIcon,
  MinusIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"

/**
 * Controle de página atual (R4): slider + botões (+/−, +10, "Terminei") + campo
 * numérico, todos sincronizados. `pageCount` 0/desconhecido desabilita o teto.
 */
export function ProgressControl({
  pageCount,
  value,
  onChange,
}: {
  pageCount: number
  value: number
  onChange: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const max = pageCount || Number.MAX_SAFE_INTEGER
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.round(v || 0)))
  const set = (v: number) => onChange(clamp(v))

  return (
    <div className="space-y-3">
      <Slider
        min={0}
        max={pageCount || 1}
        step={1}
        value={[Math.min(value, pageCount || value)]}
        onValueChange={([v]) => set(v)}
        disabled={!pageCount}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => set(value - 1)}
          aria-label="Menos uma página"
        >
          <MinusIcon weight="bold" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          className="w-20 text-center"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => set(Number(text))}
          onKeyDown={(e) => {
            if (e.key === "Enter") set(Number(text))
          }}
        />
        <span className="text-sm text-muted-foreground">
          / {pageCount || "?"}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => set(value + 1)}
          aria-label="Mais uma página"
        >
          <PlusIcon weight="bold" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => set(value + 10)}>
          +10
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => set(pageCount)}
          disabled={!pageCount}
        >
          <CheckCircleIcon weight="fill" /> Terminei
        </Button>
      </div>
    </div>
  )
}
