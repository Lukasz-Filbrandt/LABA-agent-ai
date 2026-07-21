"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useImageAttachment } from "@/app/lib/use-image-attachment";
import { errorHint } from "@/app/lib/error-hint";

const PRESET_QUESTIONS = [
  "Co widzisz na tym obrazie?",
  "Wyciągnij cały tekst z tego screena",
  "Opisz to w 3 zdaniach",
  "Jakie kolory dominują? Podaj kody HEX",
];

const GENERATE_SIMILAR_LABEL = "Wygeneruj podobny obraz w innym stylu";

type GeneratedResult = {
  image: string;
  text?: string;
  description: string;
};

export default function VisionPage() {
  const {
    attachedImage,
    imageError,
    isDragging,
    attachFile,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    clearImage,
  } = useImageAttachment();

  const [input, setInput] = useState("");
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const transportRef = useRef(new DefaultChatTransport({ api: "/api/vision" }));
  const { messages, sendMessage, status, setMessages, error, regenerate } = useChat({
    transport: transportRef.current,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Nasłuchuj Ctrl+V globalnie — przed dołączeniem obrazu nie ma jeszcze pola z fokusem
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void attachFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [attachFile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const messageText = (message: (typeof messages)[number]) =>
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("");

  const send = (text: string) => {
    if (!text.trim() || isLoading || !attachedImage) return;
    const isFirstMessage = messages.length === 0;
    sendMessage({
      text,
      files: isFirstMessage
        ? [
            {
              type: "file",
              mediaType: attachedImage.mediaType,
              url: attachedImage.url,
              filename: attachedImage.filename,
            },
          ]
        : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
    setInput("");
  };

  const handleGenerateSimilar = async () => {
    if (!attachedImage || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);
    setGeneratedResult(null);

    try {
      const describeRes = await fetch("/api/describe-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: attachedImage.url,
          instruction: "w innym stylu",
        }),
      });
      const describeData = await describeRes.json();
      if (!describeRes.ok) {
        throw new Error(describeData.error ?? "Nie udało się opisać obrazu.");
      }

      const generateRes = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: describeData.prompt }),
      });
      const generateData = await generateRes.json();
      if (!generateRes.ok) {
        throw new Error(generateData.error ?? "Nie udało się wygenerować obrazu.");
      }

      setGeneratedResult({
        image: generateData.image,
        text: generateData.text,
        description: describeData.prompt,
      });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewImage = () => {
    clearImage();
    setMessages([]);
    setGeneratedResult(null);
    setGenerateError(null);
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: "relative",
        maxWidth: 800,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 16px",
      }}
    >
      {isDragging && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "24px 40px",
              borderRadius: 16,
              background: "var(--color-surface)",
              border: "2px dashed var(--color-primary)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--color-primary-hover)",
            }}
          >
            🖼️ Upuść obraz
          </div>
        </div>
      )}

      <header style={{ padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>👁️ Agent Vision</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wklej screenshot, wrzuć plik lub przeciągnij obraz
        </p>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />

      {imageError && (
        <div
          style={{
            fontSize: 13,
            color: "var(--color-danger)",
            marginBottom: 12,
          }}
        >
          ⚠️ {imageError}
        </div>
      )}

      {!attachedImage && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn"
          style={{
            flex: 1,
            minHeight: 320,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            border: "2px dashed var(--color-border)",
            borderRadius: 16,
            background: "var(--color-surface)",
            color: "var(--color-text-muted)",
            fontSize: 15,
            marginBottom: 24,
          }}
        >
          <span>📸 Ctrl+V - wklej screenshot</span>
          <span>📁 Kliknij - wybierz plik</span>
          <span>🖱️ Przeciągnij - upuść obraz</span>
        </button>
      )}

      {attachedImage && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <img
              src={attachedImage.url}
              alt="Załączony obraz"
              style={{
                maxWidth: 200,
                maxHeight: 200,
                borderRadius: 12,
                border: "1px solid var(--color-border)",
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleNewImage}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12 }}
            >
              🔄 Nowy obraz
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="btn btn-chip"
                onClick={() => send(q)}
                disabled={isLoading}
                style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13 }}
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-chip"
              onClick={handleGenerateSimilar}
              disabled={isGenerating}
              style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13 }}
            >
              🎨 {GENERATE_SIMILAR_LABEL}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((message) => {
              const isUser = message.role === "user";
              const text = messageText(message);
              if (!text) return null;
              return (
                <div
                  key={message.id}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: isUser
                        ? "var(--color-primary)"
                        : "var(--color-primary-light)",
                      color: isUser ? "var(--color-on-primary)" : "var(--color-text)",
                      border: isUser ? "none" : "1px solid var(--color-border)",
                      whiteSpace: isUser ? "pre-wrap" : "normal",
                    }}
                  >
                    {isUser ? (
                      text
                    ) : (
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "var(--color-primary-light)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Analizuję...
                </div>
              </div>
            )}

            {error && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "var(--color-danger-bg)",
                    border: "1px solid var(--color-danger-border)",
                    color: "var(--color-danger)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    ⚠️ Nie udało się uzyskać odpowiedzi. {errorHint(error)}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    onClick={() => regenerate()}
                    style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12 }}
                  >
                    🔄 Spróbuj ponownie
                  </button>
                </div>
              </div>
            )}

            {isGenerating && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "var(--color-primary-light)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              >
                Generuję nową wersję obrazu... (kilkanaście sekund)
              </div>
            )}

            {generateError && !isGenerating && (
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
                ⚠️ {errorHint(generateError)}
              </div>
            )}

            {generatedResult && !isGenerating && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Oryginał vs. nowa wersja:
                </span>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <img
                    src={attachedImage.url}
                    alt="Oryginał"
                    style={{
                      flex: 1,
                      minWidth: 160,
                      maxWidth: "48%",
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                    }}
                  />
                  <img
                    src={generatedResult.image}
                    alt="Nowa wersja"
                    style={{
                      flex: 1,
                      minWidth: 160,
                      maxWidth: "48%",
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                    }}
                  />
                </div>
                {generatedResult.text && (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {generatedResult.text}
                  </p>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              gap: 8,
              padding: "12px 0 16px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Zadaj pytanie o ten obraz..."
              className="input-field"
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !input.trim()}
              style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14 }}
            >
              Wyślij
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
