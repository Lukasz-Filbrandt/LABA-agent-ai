"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";

const DASHBOARD_LINK = { href: "/", label: "Dashboard", icon: "🏠" };

const LINKS = [
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/history", label: "Historia", icon: "📜" },
  { href: "/briefings", label: "Briefingi", icon: "📰" },
  { href: "/think", label: "Myślenie", icon: "🧠" },
  { href: "/search", label: "Szukaj", icon: "🌐" },
  { href: "/generate", label: "Grafiki", icon: "🎨" },
  { href: "/vision", label: "Vision", icon: "👁️" },
  { href: "/agent", label: "Agent", icon: "🤖" },
  { href: "/react", label: "ReAct", icon: "🔄" },
  { href: "/travel", label: "Podróże", icon: "✈️" },
  { href: "/format", label: "Formater", icon: "📐" },
  { href: "/fewshot", label: "Słownik", icon: "📚" },
  { href: "/upload", label: "Baza wiedzy", icon: "🗂️" },
  { href: "/email-triage", label: "E-mail Triage", icon: "📧" },
  { href: "/report", label: "Raporty", icon: "📊" },
  { href: "/competitor", label: "Konkurencja", icon: "🏢" },
  { href: "/cv-maker", label: "CV Maker", icon: "🧾" },
  { href: "/admin/dashboard", label: "Dashboard użycia", icon: "📊" },
  { href: "/admin/security", label: "Bezpieczeństwo", icon: "🛡️" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  // Zamknij menu mobilne po każdej nawigacji
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/" || pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  const renderLink = (item: { href: string; label: string; icon: string }) => (
    <Link
      key={item.href}
      href={item.href}
      className={`sidebar-link${isActive(item.href) ? " active" : ""}`}
    >
      <span>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );

  return (
    <>
      <div className="mobile-topbar">
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
          <span className="icon-badge" style={{ width: 26, height: 26, borderRadius: 8, fontSize: 13 }}>
            ⚡
          </span>
          Agent AI
        </span>
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zamknij menu" : "Otwórz menu"}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <nav className={`sidebar${open ? " open" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 22px" }}>
          <span className="icon-badge">⚡</span>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Agent AI</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Centrum dowodzenia</div>
          </div>
        </div>
        {renderLink(DASHBOARD_LINK)}
        <div style={{ height: 1, background: "var(--color-border)", margin: "10px 6px" }} />
        {LINKS.map(renderLink)}

        {user && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                padding: "0 6px 8px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.email}
            </div>
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={handleLogout}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
            >
              🚪 Wyloguj
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
