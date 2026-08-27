'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  value: string
  onValueChange: (rawDigits: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function formatCOP(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('es-CO')
}

export function CurrencyInput({ value, onValueChange, placeholder, className, disabled }: CurrencyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        disabled={disabled}
        className={cn('pl-5', className)}
        value={formatCOP(value)}
        onChange={e => onValueChange(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  )
}
