'use client'

import { useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/** Shown inside the app's layout (sidebar intact) when a page or action fails unexpectedly. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <Alert variant="destructive">
        <AlertDescription>
          That didn’t work. Your other changes are safe. Try again, and if it keeps happening, reload the page.
          {error.digest && <span className="text-muted-foreground mt-1 block text-xs">Reference: {error.digest}</span>}
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  )
}
