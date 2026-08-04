import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/lib/auth-context";
import AuthGate from "@/app/components/AuthGate";

// Adres produkcyjny — potrzebny, żeby og:image w metaznacznikach był pełnym URL-em (wymóg LinkedIn/Twitter/Slack)
const SITE_URL = "https://laba-agent-ai-theta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Nexus AI — Twój osobisty asystent AI",
  description: "Agent AI z pamięcią, bazą wiedzy firmy i automatyzacją (cron jobs). Prywatne dane per user.",
  openGraph: {
    title: "Nexus AI",
    description: "Twój osobisty asystent AI z pamięcią i bazą wiedzy firmy.",
    images: ["/og-image.png"],
    type: "website",
    locale: "pl_PL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus AI",
    description: "Twój osobisty asystent AI z pamięcią i bazą wiedzy firmy.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

// Ustawia data-theme PRZED hydracją, żeby uniknąć błysku złego motywu przy odświeżeniu (patrz W4_POLISH.md)
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
