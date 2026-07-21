"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DASHBOARD_LINK = { href: "/", label: "Dashboard", icon: "🏠" };

const LINKS = [
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/history", label: "Historia", icon: "📜" },
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
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
        <span style={{ fontWeight: 700, fontSize: 14 }}>🏠 Agent AI</span>
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
        <div style={{ padding: "4px 10px 18px", fontWeight: 700, fontSize: 15 }}>🤖 Agent AI</div>
        {renderLink(DASHBOARD_LINK)}
        <div style={{ height: 1, background: "var(--color-border)", margin: "10px 6px" }} />
        {LINKS.map(renderLink)}
      </nav>
    </>
  );
}
