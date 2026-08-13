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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBookingPage slug={slug} />;
}
