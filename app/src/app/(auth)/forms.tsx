'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { sendSignInLink, signIn, signInWithGoogle, signUp, type FormState } from './actions'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.83Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.57.38-2.29V6.6H1.26a12 12 0 0 0 0 10.8l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.26 6.6l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  )
}

function GoogleSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      <GoogleLogo />
      {pending ? 'Opening Google…' : 'Continue with Google'}
    </Button>
  )
}

/** Google sign-in, then an "or" divider. A separate form because forms can't be nested. */
function GoogleSignIn({ next }: { next: string }) {
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleSubmit />
      </form>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />or<span className="bg-border h-px flex-1" />
      </div>
    </>
  )
}

function Field({ id, label, error, ...props }: { id: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && <p id={`${id}-error`} className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {})
  const [linkState, linkAction, linkPending] = useActionState<FormState, FormData>(sendSignInLink, {})
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const shown = mode === 'password' ? state : linkState
  // Carry the typed email across when switching between password and email link.
  const [email, setEmail] = useState(state.values?.email ?? '')
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice && <Alert variant="destructive"><AlertDescription>{notice}</AlertDescription></Alert>}
        <GoogleSignIn next={next ?? ''} />
        <form action={mode === 'password' ? action : linkAction} className="grid gap-4" noValidate>
          {shown.message && <Alert variant="destructive"><AlertDescription>{shown.message}</AlertDescription></Alert>}
          <input type="hidden" name="next" value={next ?? ''} />
          <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={shown.errors?.email} />
          {mode === 'password' ? (
            <>
              <Field id="password" label="Password" type="password" autoComplete="current-password" error={state.errors?.password} />
              <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
              <Button type="button" variant="ghost" onClick={() => setMode('link')}>Email me a sign-in link instead</Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">We’ll email you a link that signs you in. No password needed.</p>
              <Button type="submit" disabled={linkPending}>{linkPending ? 'Sending…' : 'Email me a sign-in link'}</Button>
              <Button type="button" variant="ghost" onClick={() => setMode('password')}>Use my password instead</Button>
            </>
          )}
          <p className="text-muted-foreground text-center text-sm">New to schedulefa.st? <Link href="/sign-up" className="text-primary font-medium hover:underline">Create an account</Link></p>
        </form>
      </CardContent>
    </Card>
  )
}

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {})
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Then set up your coaching business. Free to start.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <GoogleSignIn next="/onboarding" />
        <form action={action} className="grid gap-4" noValidate>
          {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
          <Field id="fullName" label="Full name" autoComplete="name" defaultValue={state.values?.fullName} error={state.errors?.fullName} />
          <Field id="email" label="Work email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.errors?.email} />
          <Field id="password" label="Password" type="password" autoComplete="new-password" error={state.errors?.password} />
          <Button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</Button>
          <p className="text-muted-foreground text-center text-xs">
            By creating an account you agree to the <Link href="/terms" className="hover:text-foreground underline">Terms of Service</Link> and{' '}
            <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>.
          </p>
          <p className="text-muted-foreground text-center text-sm">Already have an account? <Link href="/sign-in" className="text-primary font-medium hover:underline">Sign in</Link></p>
        </form>
      </CardContent>
    </Card>
  )
}
