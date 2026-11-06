import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Privacy and terms links, required on the home page and sign-in screens (and by Google's brand verification). */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs', className)}>
      <span>© 2026 schedulefa.st</span>
      <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
      <Link href="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
    </footer>
  )
}
