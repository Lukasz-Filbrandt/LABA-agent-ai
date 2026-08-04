"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("theme", theme);
}

/** Przełącznik ciemny/jasny motyw w nawigacji — zapisuje wybór w localStorage (patrz W4_POLISH.md) */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    setTheme(current);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  // Unika niezgodności server/client render — do czasu odczytu stanu z document nic nie pokazujemy
  if (!mounted) return <div style={{ width: 34, height: 34 }} />;

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={toggle}
      aria-label={theme === "dark" ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      title={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        padding: 0,
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
