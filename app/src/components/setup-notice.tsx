import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SetupNotice() {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Connect Supabase to get started</CardTitle>
        <CardDescription>The app needs a Supabase project before anyone can sign in.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <ol className="text-muted-foreground grid list-decimal gap-2 pl-5">
          <li>Create a project at supabase.com.</li>
          <li>Copy <code className="bg-muted rounded px-1">app/.env.example</code> to <code className="bg-muted rounded px-1">app/.env.local</code> and fill in the project URL, publishable key and database URL.</li>
          <li>Run <code className="bg-muted rounded px-1">npm run db:migrate</code> from the <code className="bg-muted rounded px-1">app/</code> folder.</li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="text-muted-foreground">On Vercel, add the same variables under Project settings → Environment variables.</p>
      </CardContent>
    </Card>
  )
}
