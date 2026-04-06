import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// `"" ?? fallback` keeps ""; `new URL("")` throws — treat empty AUTH_URL like unset.
const publicAppUrl =
  process.env.AUTH_URL?.trim() ||
  process.env.RENDER_EXTERNAL_URL?.trim() ||
  "http://localhost:3000";
const metadataBase = new URL(publicAppUrl);

export const metadata: Metadata = {
  metadataBase,
  title: "Fjell Lift",
  description:
    "Kite ski & kite surf — fjell + lift: practice areas, forecast ranking, session memories.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Fjell Lift",
    description:
      "Kite ski & kite surf — fjell + lift: practice areas, forecast ranking, session memories.",
    images: [{ url: "/brand/fjell-lift-logo.png", alt: "Fjell Lift" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning: extensions (e.g. GA opt-out) may add attrs to <html>/<body>.
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
