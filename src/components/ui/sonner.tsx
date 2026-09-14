"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheck, Info, TriangleAlert, OctagonX, Loader2 } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      duration={4500}
      icons={{
        success: <CircleCheck className="size-4 text-green-600" strokeWidth={2} />,
        info: <Info className="size-4 text-blue-600" strokeWidth={2} />,
        warning: <TriangleAlert className="size-4 text-amber-600" strokeWidth={2} />,
        error: <OctagonX className="size-4 text-red-600" strokeWidth={2} />,
        loading: <Loader2 className="size-4 animate-spin text-gray-500" strokeWidth={2} />,
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#1b1a17",
          "--normal-border": "#e7e4dd",
          "--border-radius": "0.875rem",
          "--success-bg": "#ffffff",
          "--success-text": "#1b1a17",
          "--warning-bg": "#ffffff",
          "--warning-text": "#1b1a17",
          "--error-bg": "#ffffff",
          "--error-text": "#1b1a17",
          "--info-bg": "#ffffff",
          "--info-text": "#1b1a17",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          title: "font-medium text-[0.8125rem]",
          description: "text-gray-500 text-xs",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
