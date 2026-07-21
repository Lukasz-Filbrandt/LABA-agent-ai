"use client";

import { useRef, useState } from "react";
import { errorHint } from "@/app/lib/error-hint";

const EXAMPLE_PROMPTS = [
  "Minimalistyczne logo kawiarni w stylu japońskim",
  "Post na Instagram: kawa latte art, ciepłe światło, widok z góry",
  "Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design",
  "Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design",
  "Infografika: 5 kroków do produktywności, pastelowe kolory",
  "Zdjęcie produktowe: elegancki zegarek na ciemnym tle",
];

type Result = { image: string; text?: string };

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generate = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setLastPrompt(text);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Nie udało się wygenerować obrazu.");
      }

      setResult({ image: data.image, text: data.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate(prompt);
  };

  const handleExample = (text: string) => {
    setPrompt(text);
    textareaRef.current?.focus();
  };

  const handleRegenerate = () => {
    if (lastPrompt) generate(lastPrompt);
  };

  const handleDownload = () => {
    if (!result?.image) return;
    const a = document.createElement("a");
    a.href = result.image;
    a.download = "ai-generated.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 16px",
      }}
    >
      <header style={{ padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>🎨 Generator grafik AI</h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            marginTop: 6,
          }}
        >
          Opisz co chcesz - AI stworzy obraz w kilka sekund
        </p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Opisz obraz który chcesz wygenerować..."
          className="input-field"
          rows={3}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !prompt.trim()}
          style={{
            alignSelf: "flex-start",
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          🎨 Generuj
        </button>
      </form>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          paddingTop: 12,
        }}
      >
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="btn btn-chip"
            onClick={() => handleExample(p)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 13,
              textAlign: "left",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 20, paddingBottom: 24 }}>
        {isLoading && (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              background: "var(--color-primary-light)",
              padding: 40,
              textAlign: "center",
              color: "var(--color-text-muted)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            Generuję... (5-15 sekund)
          </div>
        )}

        {error && !isLoading && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger-border)",
              color: "var(--color-danger)",
              fontSize: 13,
            }}
          >
            ⚠️ {errorHint(error)}
          </div>
        )}

        {result && !isLoading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <img
              src={result.image}
              alt={lastPrompt}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid var(--color-border)",
              }}
            />
            {result.text && (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {result.text}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleDownload}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13 }}
              >
                💾 Pobierz
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleRegenerate}
                disabled={isLoading}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13 }}
              >
                🔄 Ponownie
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
