import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/lib/auth-context";
import AuthGate from "@/app/components/AuthGate";

export const metadata: Metadata = {
  title: "Agent AI — Centrum dowodzenia",
  description: "Dashboard agenta AI: pogoda, kursy walut, święta, asystent podróży i czat z personami",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
