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
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 28,
          borderRadius: 14,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>🤖 Agent AI</h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {mode === "login" ? "Zaloguj się do swojego konta" : "Załóż nowe konto"}
        </p>

        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="input-field"
          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Hasło (min. 6 znaków)"
          className="input-field"
          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
        />

        {error && <div style={{ fontSize: 13, color: "var(--color-danger)" }}>⚠️ {error}</div>}
        {info && (
          <div style={{ fontSize: 13, color: "var(--color-primary-hover)" }}>ℹ️ {info}</div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 8, fontSize: 14 }}
        >
          {loading ? "Chwileczkę..." : mode === "login" ? "Zaloguj się" : "Zarejestruj się"}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setError(null);
            setInfo(null);
          }}
          style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13 }}
        >
          {mode === "login" ? "Nie masz konta? Zarejestruj się" : "Masz już konto? Zaloguj się"}
        </button>
      </form>
    </main>
  );
}
