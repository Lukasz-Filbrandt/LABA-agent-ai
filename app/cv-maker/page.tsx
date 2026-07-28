"use client";

import { useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { CV_THEMES, type CVData, type CVTheme } from "@/app/lib/cv-schema";
import { CVDocument } from "@/app/lib/cv-pdf";
import CVPreview from "@/app/components/CVPreview";
import { useImageAttachment } from "@/app/lib/use-image-attachment";
import { errorHint } from "@/app/lib/error-hint";

type FieldKey =
  | "personalData"
  | "interests"
  | "skills"
  | "languages"
  | "education"
  | "experience"
  | "industry";

const FIELDS: { key: FieldKey; label: string; placeholder: string; big?: boolean }[] = [
  {
    key: "personalData",
    label: "Dane osobowe",
    placeholder: "Imię i nazwisko, email, telefon, miasto, LinkedIn...",
    big: true,
  },
  {
    key: "experience",
    label: "Doświadczenie zawodowe",
    placeholder: "Firmy, stanowiska, okresy zatrudnienia, obowiązki i osiągnięcia...",
    big: true,
  },
  {
    key: "education",
    label: "Edukacja",
    placeholder: "Szkoły / uczelnie, kierunki, lata ukończenia...",
    big: true,
  },
  { key: "skills", label: "Umiejętności", placeholder: "Np. Excel, zarządzanie zespołem, Python..." },
  { key: "languages", label: "Znajomość języków", placeholder: "Np. angielski C1, niemiecki B1..." },
  { key: "interests", label: "Zainteresowania", placeholder: "Np. fotografia, bieganie, szachy..." },
  {
    key: "industry",
    label: "Dla jakiej branży AI ma stworzyć CV",
    placeholder: "Np. marketing cyfrowy, IT / programowanie, finanse...",
  },
];

async function copyPdfSafe(fullName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CV_${(fullName || "dokument").trim().replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CVMakerPage() {
  const [fields, setFields] = useState<Record<FieldKey, string>>({
    personalData: "",
    interests: "",
    skills: "",
    languages: "",
    education: "",
    experience: "",
    industry: "",
  });
  const [theme, setTheme] = useState<CVTheme>(CV_THEMES[0]);
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editText, setEditText] = useState("");
  const [editStatus, setEditStatus] = useState<"idle" | "loading" | "error">("idle");
  const [downloading, setDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    attachedImage,
    imageError,
    isDragging,
    handlePaste,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    clearImage,
  } = useImageAttachment();

  const setField = (key: FieldKey, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const hasMinimumInput = fields.personalData.trim().length > 0;

  const handleGenerate = async () => {
    if (!hasMinimumInput || status === "loading") return;
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/cv-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate", fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Błąd serwera (${res.status})`);
      setCvData(data.cv as CVData);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  };

  const handleApplyEdit = async () => {
    if (!editText.trim() || !cvData || editStatus === "loading") return;
    setEditStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/cv-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "edit", currentCV: cvData, editInstruction: editText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Błąd serwera (${res.status})`);
      setCvData(data.cv as CVData);
      setEditText("");
      setEditStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setEditStatus("error");
    }
  };

  const handleDownload = async () => {
    if (!cvData || downloading) return;
    setDownloading(true);
    try {
      const blob = await pdf(
        <CVDocument data={cvData} theme={theme} photoDataUrl={attachedImage?.url} />
      ).toBlob();
      await copyPdfSafe(cvData.fullName, blob);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 40px" }}>
      <header style={{ padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>🧾 CV Maker</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wypełnij rubryki — agent napisze profesjonalne CV i wyeksportuje je do PDF
        </p>
      </header>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {FIELDS.map((f) => (
          <div
            key={f.key}
            style={f.big ? { gridColumn: "span 2" } : undefined}
          >
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              {f.label}
            </label>
            <textarea
              value={fields[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="input-field"
              style={{
                width: "100%",
                minHeight: f.big ? 100 : 70,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
          Kolor CV (Theme)
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CV_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t)}
              title={t.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: t.accent,
                border: theme.id === t.id ? "3px solid var(--color-text)" : "3px solid transparent",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
          Zdjęcie (opcjonalnie)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {attachedImage ? (
            <div style={{ position: "relative" }}>
              <img
                src={attachedImage.url}
                alt="Podgląd zdjęcia"
                style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", display: "block" }}
              />
              <button
                type="button"
                onClick={clearImage}
                aria-label="Usuń zdjęcie"
                className="btn"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--color-danger)",
                  color: "#fff",
                  border: "none",
                  fontSize: 12,
                  lineHeight: "22px",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13 }}
            >
              📎 Wgraj zdjęcie (albo przeciągnij / wklej)
            </button>
          )}
        </div>
        {imageError && (
          <div style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 6 }}>⚠️ {imageError}</div>
        )}
        {isDragging && (
          <div style={{ fontSize: 12, color: "var(--color-primary-hover)", marginTop: 6 }}>
            Upuść zdjęcie tutaj...
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleGenerate}
        disabled={!hasMinimumInput || status === "loading"}
        style={{ marginTop: 24, padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}
      >
        {status === "loading" ? "Tworzę CV..." : "🧾 Generuj CV"}
      </button>

      {errorMessage && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger-border)",
            color: "var(--color-danger)",
            fontSize: 13,
          }}
        >
          ⚠️ {errorMessage.startsWith("Nie udało") ? errorMessage : errorHint(errorMessage)}
        </div>
      )}

      {cvData && (
        <div style={{ marginTop: 32 }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 680 }}>
              <CVPreview data={cvData} theme={theme} photoUrl={attachedImage?.url} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={downloading}
              style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14 }}
            >
              {downloading ? "Generuję PDF..." : "⬇️ Pobierz PDF"}
            </button>
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 10,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Chcesz coś zmienić? Opisz co poprawić
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyEdit();
                  }
                }}
                placeholder="Np. Skróć profil zawodowy, dodaj umiejętność 'Figma', zmień ton na bardziej formalny..."
                className="input-field"
                style={{ flex: 1, minWidth: 240, padding: "10px 14px", borderRadius: 8, fontSize: 13 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplyEdit}
                disabled={!editText.trim() || editStatus === "loading"}
                style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, whiteSpace: "nowrap" }}
              >
                {editStatus === "loading" ? "Wprowadzam zmiany..." : "✏️ Zastosuj zmianę"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
