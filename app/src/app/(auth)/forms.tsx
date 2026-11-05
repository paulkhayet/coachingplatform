'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { signIn, signUp, type FormState } from './actions'

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
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          {notice && <Alert variant="destructive"><AlertDescription>{notice}</AlertDescription></Alert>}
          {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
          <input type="hidden" name="next" value={next ?? ''} />
          <Field id="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.errors?.email} />
          <Field id="password" label="Password" type="password" autoComplete="current-password" error={state.errors?.password} />
          <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
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
      <CardContent>
        <form action={action} className="grid gap-4" noValidate>
          {state.message && <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>}
          <Field id="fullName" label="Full name" autoComplete="name" defaultValue={state.values?.fullName} error={state.errors?.fullName} />
          <Field id="email" label="Work email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.errors?.email} />
          <Field id="password" label="Password" type="password" autoComplete="new-password" error={state.errors?.password} />
          <Button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</Button>
          <p className="text-muted-foreground text-center text-sm">Already have an account? <Link href="/sign-in" className="text-primary font-medium hover:underline">Sign in</Link></p>
        </form>
      </CardContent>
    </Card>
  )
}
