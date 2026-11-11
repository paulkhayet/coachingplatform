import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { profilePhotoUrl } from '@/lib/profile-photo'
import { requireWorkspace } from '@/lib/workspace'
import { saveProfilePhoto } from './actions'
import { ProfileNameForm, ProfilePhotoForm } from './profile-forms'

export const metadata: Metadata = { title: 'Profile settings' }

export default async function ProfileSettingsPage() {
  const { user } = await requireWorkspace()
  const photo = await profilePhotoUrl(user.avatarPath)
  return (
    <div className="grid max-w-3xl gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name is shown to your team and on the bookings you host.</CardDescription>
        </CardHeader>
        <CardContent><ProfileNameForm name={user.fullName} email={user.email} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Profile photo</CardTitle></CardHeader>
        <CardContent className="grid items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <Avatar name={user.fullName} src={photo} className="size-16 text-lg" />
          <ProfilePhotoForm save={saveProfilePhoto.bind(null, user.avatarPath)} hasPhoto={Boolean(user.avatarPath)} />
        </CardContent>
      </Card>
    </div>
  )
}
