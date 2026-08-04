"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/lib/auth-context";
import NavBar from "@/app/components/NavBar";

/** Chroni wszystkie strony poza /login i / — na / niezalogowany user widzi landing page zamiast redirectu (patrz W3_LOGIN_PRYWATNOSC.md, W1_LANDING_PAGE.md) */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const isHomePage = pathname === "/";
  const isPublicPage = isLoginPage || isHomePage;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPage) router.replace("/login");
    if (user && isLoginPage) router.replace("/");
  }, [user, loading, isPublicPage, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  // Gość na / dostaje landing page na pełnym ekranie, bez sidebara
  if (!loading && !user && isHomePage) return <>{children}</>;

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <NavBar />
      <div className="app-content">{children}</div>
    </div>
  );
}
