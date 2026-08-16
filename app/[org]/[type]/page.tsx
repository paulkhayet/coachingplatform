import type { Metadata } from "next";
import { PublicBookingPage } from "./public-booking-page";

export const metadata: Metadata = {
  title: "Book a consultation | Soli",
  description: "Choose a time for a private coaching consultation.",
  robots: { index: false, follow: false },
};

export default async function BookingRoute({
  params,
}: {
  params: Promise<{ org: string; type: string }>;
}) {
  const { org, type } = await params;
  return <PublicBookingPage orgSlug={org} typeSlug={type} />;
}
