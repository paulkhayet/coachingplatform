'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

/** A submit button that disables itself and shows `pendingLabel` while its form's action runs. */
export function SubmitButton({ children, pendingLabel, ...props }: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}
