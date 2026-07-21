import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/app/components/NavBar";

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
        <div className="app-shell">
          <NavBar />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
