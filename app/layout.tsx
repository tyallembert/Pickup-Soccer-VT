import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { PillNav } from "./_components/PillNav";
import { AdminPillNav } from "./_components/AdminPillNav";
import { Footer } from "./_components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vermontpickupsoccer.com";

const SITE_NAME = "Vermont Pickup Soccer";
const SITE_TAGLINE =
  "Find weekly pickup soccer games across Vermont — free, public, and updated by the people who play.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} — Pickup Games, Fields & Schedules in VT`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  keywords: [
    "Vermont pickup soccer",
    "Vermont soccer",
    "pickup soccer Vermont",
    "soccer in Vermont",
    "Vermont sports",
    "pickup sports Vermont",
    "Burlington pickup soccer",
    "Montpelier pickup soccer",
    "Stowe pickup soccer",
    "Brattleboro pickup soccer",
    "Rutland pickup soccer",
    "Middlebury pickup soccer",
    "VT soccer fields",
    "Vermont soccer fields",
    "free soccer Vermont",
    "weekly pickup games",
    "co-ed pickup soccer",
    "adult pickup soccer Vermont",
    "open soccer Vermont",
    "pickup futbol Vermont",
    "kickabout Vermont",
    "casual soccer Vermont",
    "pickup sports near me Vermont",
  ],
  category: "sports",
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Pickup Games, Fields & Schedules in VT`,
    description: SITE_TAGLINE,
    images: [
      {
        url: "/soccer-ball.png",
        width: 540,
        height: 540,
        alt: "Soccer ball — Vermont Pickup Soccer directory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Pickup Games, Fields & Schedules in VT`,
    description: SITE_TAGLINE,
    images: ["/soccer-ball.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add when available:
    // google: "GOOGLE_SITE_VERIFICATION_TOKEN",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#064e3b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth scroll-pt-20 antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ConvexClientProvider>
            <AdminPillNav />
            <PillNav />
            <main className="min-h-dvh">{children}</main>
            <Footer />
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
