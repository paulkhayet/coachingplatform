import type { Metadata } from 'next'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Check your email' }

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams
  return (
    <Card className="w-full">
      <CardContent className="grid justify-items-center gap-3 py-4 text-center">
        <MailCheck className="text-primary size-10" />
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground text-sm">We sent a confirmation link to {email ? <strong className="text-foreground">{email}</strong> : 'your inbox'}. Open it on this device to finish setting up.</p>
        <Link href="/sign-in" className="text-primary text-sm hover:underline">Back to sign in</Link>
      </CardContent>
    </Card>
  )
}
