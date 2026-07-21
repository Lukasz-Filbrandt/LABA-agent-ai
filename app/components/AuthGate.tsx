"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/app/lib/auth-context";
import NavBar from "@/app/components/NavBar";

/** Chroni wszystkie strony poza /login — niezalogowany user trafia na /login (patrz W3_LOGIN_PRYWATNOSC.md) */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) router.replace("/login");
    if (user && isLoginPage) router.replace("/");
  }, [user, loading, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

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
