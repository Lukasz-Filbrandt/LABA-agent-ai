"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: "login" | "signup") => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const err = await signIn(email, password);
        if (err) {
          setError(err);
          return;
        }
        router.replace("/");
      } else {
        const err = await signUp(email, password);
        if (err) {
          setError(err);
          return;
        }
        setInfo(
          "Konto utworzone! Jeśli projekt Supabase wymaga potwierdzenia email, sprawdź skrzynkę — w przeciwnym razie możesz się już zalogować."
        );
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 32,
          borderRadius: 18,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
        }}
      >
        <span className="icon-badge">⚡</span>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-primary-hover)",
              marginBottom: 6,
            }}
          >
            Prywatny Agent AI
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            {mode === "login" ? "Witaj ponownie" : "Stwórz konto"}
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginTop: 6 }}>
            {mode === "login"
              ? "Zaloguj się, aby otworzyć swoje rozmowy i dokumenty."
              : "Załóż konto, żeby zacząć rozmawiać z agentem."}
          </p>
        </div>

        <div className="tab-group" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`tab-btn${mode === "login" ? " active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Logowanie
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`tab-btn${mode === "signup" ? " active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Rejestracja
          </button>
        </div>

        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ty@example.com"
            className="input-field"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14 }}
          />
        </div>

        <div>
          <label htmlFor="password" className="field-label">
            Hasło
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 znaków"
            className="input-field"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14 }}
          />
        </div>

        {error && <div style={{ fontSize: 13, color: "var(--color-danger)" }}>⚠️ {error}</div>}
        {info && (
          <div style={{ fontSize: 13, color: "var(--color-primary-hover)" }}>ℹ️ {info}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ padding: "12px 16px", borderRadius: 10, fontSize: 14.5 }}
        >
          {loading ? "Chwileczkę..." : mode === "login" ? "Zaloguj się" : "Zarejestruj się"}
        </button>
      </form>
    </main>
  );
}
