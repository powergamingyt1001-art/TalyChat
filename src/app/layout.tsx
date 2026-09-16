import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-hindi",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TalyChat — Chat. Connect. Mingle.",
  description:
    "TalyChat — A modern social chat app by Omkar Panday. Chat, Connect, Mingle.",
  keywords: ["TalyChat", "chat", "social", "messaging", "India"],
  authors: [{ name: "Omkar Panday" }],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "TalyChat",
    description: "Chat. Connect. Mingle.",
    siteName: "TalyChat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TalyChat",
    description: "Chat. Connect. Mingle.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Decorative fonts (local, served from /public/fonts) */}
        {(process.env.NEXT_PUBLIC_FONT_PRELOAD !== 'off') && (
          <>
            <link rel="preload" href="/fonts/AlfaSlabOne-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
            <link rel="preload" href="/fonts/LobsterTwo-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoDevanagari.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
