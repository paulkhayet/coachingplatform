import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand'

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center p-6 text-center">
      <div className="grid justify-items-center gap-4">
        <Logo />
        <h1 className="font-serif text-4xl">Page not found</h1>
        <Button asChild><Link to="/">Back to the demo</Link></Button>
      </div>
    </div>
  )
}
