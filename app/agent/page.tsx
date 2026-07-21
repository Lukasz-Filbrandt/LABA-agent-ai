"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useImageAttachment } from "@/app/lib/use-image-attachment";
import { errorHint } from "@/app/lib/error-hint";
import { computeDiagnostics } from "@/app/lib/diagnostics";
import { useMessageTimer } from "@/app/lib/use-message-timer";
import DiagnosticsPanel from "@/app/components/DiagnosticsPanel";

// Techniczny limit z app/api/agent/route.ts (stopWhen) — zasila panel Diagnostyka
const DIAGNOSTICS_MAX_STEPS = 8;

const TOOLS_PANEL = [
  { emoji: "🧮", label: "Kalkulator" },
  { emoji: "🕐", label: "Data i czas" },
  { emoji: "🌐", label: "Google Search" },
  { emoji: "📄", label: "Czytanie stron" },
  { emoji: "🎨", label: "Generowanie obrazów" },
  { emoji: "👁️", label: "Analiza obrazów" },
];

const SCENARIOS = [
  "Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo",
  "Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone",
  "Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto",
  "Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym",
  "Wyszukaj w Google 'best coffee shops Kraków' i streszcz wyniki",
];

const TOOL_EMOJI: Record<string, string> = {
  calculator: "🧮",
  currentDateTime: "🕐",
  google_search: "🌐",
  readWebPage: "📄",
  generateImage: "🎨",
};

const STEP_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

function toolEmoji(name: string) {
  return TOOL_EMOJI[name] ?? "🔧";
}

function stepNumber(i: number) {
  return STEP_NUMBERS[i] ?? `${i + 1}.`;
}

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function toolPartName(part: ToolPart) {
  return part.toolName ?? part.type.replace(/^tool-/, "");
}

function downloadImage(dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "ai-generated.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function AgentPage() {
  const [input, setInput] = useState("");
  const timer = useMessageTimer();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const transportRef = useRef(new DefaultChatTransport({ api: "/api/agent" }));
  const { messages, sendMessage, status, setMessages, error, regenerate } = useChat({
    transport: transportRef.current,
    onFinish: ({ message }) => timer.finish(message.id),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const messageText = (message: (typeof messages)[number]) =>
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("");

  const messageToolParts = (message: (typeof messages)[number]) =>
    message.parts
      .filter((part) => part.type.startsWith("tool-") || part.type === "dynamic-tool")
      .map((part) => part as unknown as ToolPart);

  const send = (text: string) => {
    if ((!text.trim() && !attachedImage) || isLoading) return;
    timer.start();
    sendMessage({
      text: text.trim() || "Co widzisz na tym obrazie?",
      files: attachedImage
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
    clearImage();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
    setInput("");
  };

  const handleNewChat = () => {
    setMessages([]);
    timer.reset();
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: "relative",
        maxWidth: 860,
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
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>🤖 Agent AI - Pełna moc</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          {TOOLS_PANEL.length} narzędzi • autonomiczne decyzje
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          marginBottom: 16,
        }}
      >
        {TOOLS_PANEL.map((t) => (
          <div
            key={t.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 8,
              background: "var(--color-primary-light)",
              fontSize: 12,
            }}
          >
            <span>
              {t.emoji} {t.label}
            </span>
            <span style={{ color: "var(--color-primary-hover)", fontWeight: 600 }}>
              ✅
            </span>
          </div>
        ))}
      </div>

      {messages.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-chip"
              onClick={() => send(s)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                textAlign: "left",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
          paddingBottom: 16,
        }}
      >
        {messages.map((message) => {
          const isUser = message.role === "user";
          const text = messageText(message);
          const toolParts = messageToolParts(message);
          const isLastMessage = message.id === messages[messages.length - 1]?.id;
          const messageIsLoading = isLoading && isLastMessage;
          const diagnostics = computeDiagnostics(toolParts, DIAGNOSTICS_MAX_STEPS, messageIsLoading);
          const seconds = timer.elapsed[message.id] ?? (messageIsLoading ? timer.liveSeconds() : 0);

          return (
            <div
              key={message.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                gap: 8,
              }}
            >
              {!isUser && toolParts.length > 0 && (
                <div
                  style={{
                    width: "100%",
                    maxWidth: "90%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 12,
                    borderRadius: 12,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {toolParts.map((part, i) => {
                    const name = toolPartName(part);
                    const emoji = toolEmoji(name);
                    const running =
                      part.state === "input-streaming" ||
                      part.state === "input-available";
                    const sdkError = part.state === "output-error" ? part.errorText : undefined;
                    const output = part.output as
                      | { image?: string; text?: string; error?: string; result?: number }
                      | string
                      | undefined;

                    return (
                      <div key={i} style={{ fontSize: 12.5 }}>
                        <div style={{ color: "var(--color-text-muted)" }}>
                          {stepNumber(i)} {emoji} {name}
                          {part.input ? `(${JSON.stringify(part.input).slice(0, 80)})` : ""}
                          {running && " ⏳"}
                        </div>
                        {!running && sdkError && (
                          <div style={{ marginTop: 4, marginLeft: 20, color: "var(--color-danger)" }}>
                            → {sdkError.slice(0, 200)}
                          </div>
                        )}
                        {!running && !sdkError && output != null && (
                          <div style={{ marginTop: 4, marginLeft: 20 }}>
                            {typeof output === "object" && output.image ? (
                              <div>
                                <img
                                  src={output.image}
                                  alt="Wygenerowany obraz"
                                  style={{
                                    maxWidth: 220,
                                    maxHeight: 220,
                                    borderRadius: 8,
                                    border: "1px solid var(--color-border)",
                                    display: "block",
                                    marginBottom: 6,
                                  }}
                                />
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => downloadImage(output.image!)}
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                  }}
                                >
                                  💾 Pobierz
                                </button>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color:
                                    typeof output === "object" && output.error
                                      ? "var(--color-danger)"
                                      : "var(--color-text-muted)",
                                }}
                              >
                                →{" "}
                                {typeof output === "string"
                                  ? output.slice(0, 200)
                                  : JSON.stringify(
                                      (output as Record<string, unknown>).error ??
                                        (output as Record<string, unknown>).result ??
                                        (output as Record<string, unknown>).formatted ??
                                        output
                                    ).slice(0, 200)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {text && (
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
                    fontWeight: isUser ? 500 : 400,
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
              )}

              {!isUser && toolParts.length > 0 && (
                <DiagnosticsPanel diagnostics={diagnostics} seconds={seconds} />
              )}
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
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              🤖 Agent wykonuje zadanie...
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

        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && (
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={handleNewChat}
          style={{
            alignSelf: "flex-end",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          🗑 Nowa rozmowa
        </button>
      )}

      {imageError && (
        <div style={{ fontSize: 12, color: "var(--color-danger)", paddingTop: 8 }}>
          ⚠️ {imageError}
        </div>
      )}

      {attachedImage && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12 }}>
          <div style={{ position: "relative" }}>
            <img
              src={attachedImage.url}
              alt="Podgląd załącznika"
              style={{
                maxHeight: 120,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                display: "block",
              }}
            />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Usuń obraz"
              className="btn"
              style={{
                position: "absolute",
                top: -8,
                right: -8,
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
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            📎 Screenshot - zadaj pytanie o ten obraz
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 0 20px",
          borderTop: "1px solid var(--color-border)",
          marginTop: 12,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          title="Załącz obraz"
          style={{ padding: "10px 12px", borderRadius: 8, fontSize: 14 }}
        >
          📎
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder="Napisz zadanie dla agenta..."
          className="input-field"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || (!input.trim() && !attachedImage)}
          style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14 }}
        >
          Wyślij
        </button>
      </form>
    </main>
  );
}
