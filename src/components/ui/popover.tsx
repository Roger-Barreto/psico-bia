import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"
import { useDialogBody } from "@/components/ui/dialog"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    /**
     * Force portaling to document.body instead of the enclosing dialog node.
     * The dialog node has a transform + overflow (containing block for fixed
     * elements), which clips popovers that extend past its bounds. Use this
     * for popovers with no internal scroll (e.g. a calendar) so they aren't cut off.
     */
    portalToBody?: boolean
  }
>(({ className, align = "start", sideOffset = 6, portalToBody, ...props }, ref) => {
  // Inside a modal Dialog, portal into the dialog node so the popover's scroll
  // areas live within the scroll-lock and remain touch-scrollable on iOS.
  const dialogBody = useDialogBody()
  const container = portalToBody ? undefined : dialogBody ?? undefined
  return (
  <PopoverPrimitive.Portal container={container}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      // Keep 8px away from screen/dialog edges so content never touches the
      // viewport border (fixes calendars getting clipped on small screens).
      collisionPadding={8}
      // When portaled inside the dialog node, that node has transform+overflow
      // and clips fixed children. Bound collision detection to it so Radix
      // flips/shrinks the popover to stay *within* the dialog instead of
      // overflowing (and being cut off). Undefined → default viewport boundary.
      collisionBoundary={container ?? undefined}
      className={cn(
        "z-50 rounded-xl border border-border/70 bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
