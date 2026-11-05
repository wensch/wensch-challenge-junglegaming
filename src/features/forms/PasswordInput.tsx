import { useState, type ComponentProps } from 'react'
import { Eye } from 'lucide-react'
import { HideIcon } from '@/components/icons/figma'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { controlClass } from './Field'

/** Password field with a show/hide toggle (Figma eye icon). The toggle is a real button with state. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn(controlClass, 'pr-11', className)} />
      <button
        type="button"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-control text-text-secondary hover:text-text-accent"
      >
        {visible ? <Eye aria-hidden="true" className="size-4" /> : <HideIcon />}
      </button>
    </div>
  )
}
