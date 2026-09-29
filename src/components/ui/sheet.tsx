import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "@phosphor-icons/react"
import { DialogBodyContext } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = "SheetOverlay"

// `flex flex-col` (e não bloco) por causa do botão de fechar: ele fica por
// último no DOM — para não roubar o foco inicial do primeiro campo — e sobe
// para o topo com `order-first`, o que só existe em flex/grid.
// As áreas seguras de baixo e dos lados entram como padding; a de cima é o
// `SheetTopBar` (um elemento de verdade, não padding — ver lá).
const sheetVariants = cva(
  "fixed z-50 flex flex-col bg-card/95 backdrop-blur-md border-border/70 shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-3/4 max-w-md border-l pb-safe-bottom pr-safe-right data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        left:
          "inset-y-0 left-0 h-full w-3/4 max-w-md border-r pb-safe-bottom pl-safe-left data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t pb-safe-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
    },
    defaultVariants: { side: "right" },
  },
)

/**
 * Faixa grudada no topo do drawer: reserva a área da barra de status e ancora
 * o botão de fechar.
 *
 * Instalado como PWA no iPhone (`black-translucent` + `viewport-fit=cover`) o
 * app desenha por baixo da barra de status, e o que fica nos primeiros ~50px
 * não recebe o toque — era onde o X morava. A faixa empurra tudo para baixo
 * dessa área e, por ser `sticky`, mantém o X à mão durante a rolagem: num
 * drawer comprido não é mais preciso voltar ao topo para fechar.
 *
 * É um elemento, e não `padding-top` no drawer, porque os navegadores não
 * concordam sobre medir o `top` de um `sticky` a partir da borda do padding
 * ou do conteúdo; sem padding as duas contas dão o mesmo lugar.
 */
function SheetTopBar({ side }: { side: SheetContentProps["side"] }) {
  return (
    <div className="pointer-events-none sticky top-0 z-20 order-first shrink-0">
      {side !== "bottom" && (
        // Opaca: o conteúdo que rola não aparece por trás do relógio.
        <div aria-hidden className="h-safe-top bg-card" />
      )}
      <div className="relative h-0">
        <DialogPrimitive.Close className="pointer-events-auto absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-border/60 bg-card/90 text-muted-foreground shadow-md backdrop-blur transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <XIcon weight="bold" className="size-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </div>
    </div>
  )
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
  // Expose the sheet node so portaled popovers/selects render *inside* it and
  // stay scrollable within the modal's react-remove-scroll lock (same trick as
  // DialogContent — without it, e.g. the TimePicker lists can't scroll at all).
  const [node, setNode] = React.useState<React.ElementRef<
    typeof DialogPrimitive.Content
  > | null>(null)
  const setRefs = React.useCallback(
    (el: React.ElementRef<typeof DialogPrimitive.Content> | null) => {
      setNode(el)
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        className={cn(sheetVariants({ side }), className)}
        {...props}
        // Only the X, a Cancel/action button, or Esc close the sheet — clicking
        // the backdrop (or focus leaving) must not dismiss it, so half-filled
        // forms aren't lost by an accidental outside click.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogBodyContext.Provider value={node}>
          {children}
        </DialogBodyContext.Provider>
        <SheetTopBar side={side} />
      </DialogPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = "SheetContent"

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // pr-16: o título não passa por baixo do botão de fechar.
      "flex flex-col space-y-1.5 border-b border-border/60 p-6 pr-16",
      className,
    )}
    {...props}
  />
)

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 border-t border-border/60 p-6",
      className,
    )}
    {...props}
  />
)

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
