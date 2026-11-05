import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

import StaffLayout from '@/layouts/StaffLayout'
import PortalLayout from '@/layouts/PortalLayout'
import Launcher from '@/pages/public/Launcher'
import PublicInquiry from '@/pages/public/Inquiry'
import GuestOffer from '@/pages/public/Offer'
import Profile from '@/pages/public/Profile'
import Book from '@/pages/public/Book'
import Manage from '@/pages/public/Manage'
import BookingPages from '@/pages/staff/BookingPages'
import Today from '@/pages/staff/Today'
import Inquiries from '@/pages/staff/Inquiries'
import Clients from '@/pages/staff/Clients'
import ClientDetail from '@/pages/staff/ClientDetail'
import Calendar from '@/pages/staff/Calendar'
import Session from '@/pages/staff/Session'
import FollowUps from '@/pages/staff/FollowUps'
import Files from '@/pages/staff/Files'
import Issues from '@/pages/staff/Issues'
import Offerings from '@/pages/staff/Offerings'
import Team from '@/pages/staff/Team'
import Settings from '@/pages/staff/Settings'
import PlanPage from '@/pages/staff/Plan'
import PortalHome from '@/pages/portal/Home'
import PortalSessions from '@/pages/portal/Sessions'
import { PortalFollowUps, PortalHomework, PortalFiles } from '@/pages/portal/Work'
import PortalBilling from '@/pages/portal/Billing'
import NotFound from '@/pages/NotFound'

const router = createBrowserRouter([
  { path: '/', element: <Launcher /> },
  { path: '/b/:slug', element: <Profile /> },
  { path: '/b/:slug/inquiry', element: <PublicInquiry /> },
  { path: '/b/:slug/:event', element: <Book /> },
  { path: '/booking/:token', element: <Manage /> },
  { path: '/offer/:token', element: <GuestOffer /> },
  {
    path: '/app',
    element: <StaffLayout />,
    children: [
      { index: true, element: <Today /> },
      { path: 'inquiries', element: <Inquiries /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/:id', element: <ClientDetail /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'booking-pages', element: <BookingPages /> },
      { path: 'sessions/:id', element: <Session /> },
      { path: 'follow-ups', element: <FollowUps /> },
      { path: 'files', element: <Files /> },
      { path: 'issues', element: <Issues /> },
      { path: 'offerings', element: <Offerings /> },
      { path: 'team', element: <Team /> },
      { path: 'settings', element: <Settings /> },
      { path: 'plan', element: <PlanPage /> },
    ],
  },
  {
    path: '/portal',
    element: <PortalLayout />,
    children: [
      { index: true, element: <PortalHome /> },
      { path: 'sessions', element: <PortalSessions /> },
      { path: 'follow-ups', element: <PortalFollowUps /> },
      { path: 'homework', element: <PortalHomework /> },
      { path: 'files', element: <PortalFiles /> },
      { path: 'billing', element: <PortalBilling /> },
    ],
  },
  { path: '*', element: <NotFound /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  </StrictMode>,
)
