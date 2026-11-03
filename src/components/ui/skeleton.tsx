import { cn } from "@/lib/utils"

/**
 * Loading placeholder with a shimmer sweep (§6 "lentidão"). The animation is defined in index.css
 * (`.skeleton-shimmer`) and is disabled under `prefers-reduced-motion: reduce` (static block).
 * Decorative: screen readers get the loading state from the surrounding `aria-busy` region.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
