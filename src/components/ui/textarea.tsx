import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 hover:border-gray-400 focus-visible:border-green-500 focus-visible:ring-3 focus-visible:ring-green-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 aria-invalid:border-red-500 aria-invalid:ring-3 aria-invalid:ring-red-500/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
