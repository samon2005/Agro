import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1 text-base text-gray-900 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-3 focus-visible:ring-green-500/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
