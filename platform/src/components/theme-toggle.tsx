import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark')
    try {
      localStorage.setItem('sf-theme', dark ? 'dark' : 'light')
    } catch {
      /* storage unavailable */
    }
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle dark mode">
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
