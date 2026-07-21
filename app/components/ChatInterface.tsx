"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useImageAttachment } from "@/app/lib/use-image-attachment";
import { useConversationPersistence } from "@/app/lib/use-conversation-persistence";
import { useUserProfile } from "@/app/lib/use-user-profile";
import { errorHint } from "@/app/lib/error-hint";

type AiModel = "flash" | "pro";

const MODELS: {
  id: AiModel;
  label: string;
  emoji: string;
  hint: string;
  badgeBg: string;
  badgeColor: string;
}[] = [
  {
    id: "flash",
    label: "Flash (szybki)",
    emoji: "⚡",
    hint: "szybki, do codziennych pytań",
    badgeBg: "var(--color-primary-light)",
    badgeColor: "var(--color-primary-hover)",
  },
  {
    id: "pro",
    label: "Pro (zaawansowany)",
    emoji: "🧠",
    hint: "zaawansowany, do złożonych analiz",
    badgeBg: "var(--gradient-primary)",
    badgeColor: "var(--color-on-primary)",
  },
];

type ChatInterfaceProps = {
  title: string;
  subtitle: string;
  placeholder: string;
  apiEndpoint: string;
  exampleQuestions?: string[];
  /** Przyciski pod polem wiadomości — kliknięcie wpisuje termin do inputa (bez wysyłania) */
  termButtons?: string[];
  /** Zapisuje rozmowę do Supabase i wczytuje ją po odświeżeniu strony (patrz W2_HISTORIA.md) */
  persist?: boolean;
  /** Rozpoznaje użytkownika (localStorage + user_profiles) i wita go po imieniu (patrz W3_IMIE.md) */
  personalize?: boolean;
  /** Wczytaj konkretną rozmowę zamiast najnowszej — "Kontynuuj rozmowę" z /history (patrz W4_LISTA_ROZMOW.md) */
  continueConversationId?: string;
};

export default function ChatInterface({
  title,
  subtitle,
  placeholder,
  apiEndpoint,
  exampleQuestions = [],
  termButtons = [],
  persist = false,
  personalize = false,
  continueConversationId,
}: ChatInterfaceProps) {
  const [model, setModel] = useState<AiModel>("flash");
  const modelRef = useRef<AiModel>(model);
  modelRef.current = model;

  // Model użyty do każdej odpowiedzi AI (po zakończeniu streamingu)
  const [messageModels, setMessageModels] = useState<Record<string, AiModel>>(
    {}
  );

  const transportRef = useRef(
    new DefaultChatTransport({ api: apiEndpoint })
  );

  const {
    isLoadingHistory,
    loadConversation,
    saveUserMessage,
    saveAssistantMessage,
    startNewConversation,
  } = useConversationPersistence(persist);

  const { isLoadingProfile, loadProfile, getUserId } = useUserProfile(personalize);

  // Tekst całej wiadomości — zdefiniowane wcześnie, bo onFinish poniżej tego potrzebuje
  const extractText = (message: { parts: { type: string; text?: string }[] }) =>
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");

  const { messages, sendMessage, status, setMessages, error, regenerate } =
    useChat({
      transport: transportRef.current,
      onFinish: ({ message }) => {
        setMessageModels((prev) => ({
          ...prev,
          [message.id]: modelRef.current,
        }));
        if (persist) {
          void saveAssistantMessage(extractText(message));
        }
      },
    });

  useEffect(() => {
    if (!persist && !personalize) return;
    let cancelled = false;
    (async () => {
      const [history, name] = await Promise.all([
        persist ? loadConversation(continueConversationId) : Promise.resolve([]),
        personalize ? loadProfile() : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (history.length > 0) {
        setMessages(history);
      } else if (personalize) {
        const text = name
          ? `Cześć, ${name}! Miło Cię znowu widzieć! 😊 W czym mogę Ci dziś pomóc?`
          : "Cześć! Nie znamy się jeszcze. Jak masz na imię?";
        setMessages([{ id: "welcome", role: "assistant", parts: [{ type: "text", text }] }]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, personalize, continueConversationId]);

  const [input, setInput] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const fillInput = (term: string) => {
    setInput(term);
    inputRef.current?.focus();
  };

  // Tekst całej rozmowy — używany do licznika tokenów i eksportu
  const messageText = (message: (typeof messages)[number]) => extractText(message);

  // Źródła (linki) z Google Search grounding — pokazujemy jako klikalne linki
  const messageSources = (message: (typeof messages)[number]) =>
    message.parts.filter(
      (part): part is { type: "source-url"; sourceId: string; url: string; title?: string } =>
        part.type === "source-url"
    );

  // Wywołania narzędzi (np. readWebPage) — pokazujemy krótki wskaźnik statusu
  const messageToolCalls = (message: (typeof messages)[number]) =>
    message.parts
      .filter((part) => part.type.startsWith("tool-") || part.type === "dynamic-tool")
      .map((part) => {
        const p = part as {
          type: string;
          toolName?: string;
          state?: string;
          input?: unknown;
        };
        return {
          name: p.toolName ?? p.type.replace(/^tool-/, ""),
          state: p.state ?? "input-streaming",
          url:
            p.input && typeof p.input === "object" && "url" in p.input
              ? String((p.input as { url?: unknown }).url ?? "")
              : "",
        };
      });

  // Załączone obrazy (wklejone/wrzucone przez użytkownika) — pokazujemy jako miniaturki w dymku
  const messageImages = (message: (typeof messages)[number]) =>
    message.parts.filter(
      (part): part is { type: "file"; url: string; mediaType: string; filename?: string } =>
        part.type === "file" && part.mediaType.startsWith("image/")
    );

  const totalChars = messages.reduce(
    (sum, m) => sum + messageText(m).length,
    0
  );
  const approxTokens = Math.round(totalChars / 4);

  const isLoading = status === "submitted" || status === "streaming";

  const send = (text: string) => {
    if ((!text.trim() && !attachedImage) || isLoading) return;
    const messageContent = text.trim() || "Co widzisz na tym obrazie?";
    if (persist) {
      void saveUserMessage(messageContent);
    }
    sendMessage(
      {
        text: messageContent,
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
      },
      { body: { model, userId: personalize ? getUserId() ?? undefined : undefined } }
    );
    clearImage();
  };

  const handleNewChat = () => {
    setMessages([]);
    setMessageModels({});
    if (persist) startNewConversation();
  };

  const handleExport = async () => {
    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${messageText(m)}`)
      .join("\n");

    let ok = false;
    try {
      await navigator.clipboard.writeText(transcript);
      ok = true;
    } catch {
      // Fallback dla kontekstów bez async Clipboard API
      try {
        const ta = document.createElement("textarea");
        ta.value = transcript;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedImage) || isLoading) return;
    send(input);
    setInput("");
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

      {((persist && isLoadingHistory) || (personalize && isLoadingProfile)) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "3px solid var(--color-border)",
              borderTopColor: "var(--color-primary)",
              animation: "dash-spin 0.8s linear infinite",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Wczytuję rozmowę...
          </span>
        </div>
      )}

      <header style={{ padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>{title}</h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            marginTop: 6,
          }}
        >
          {subtitle}
        </p>
      </header>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          background: "var(--color-surface)",
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <button
          type="button"
          className="btn btn-toggle"
          onClick={() => setContextOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <span>🧠 Kontekst rozmowy</span>
          <span style={{ color: "var(--color-text-muted)" }}>
            {contextOpen ? "▲" : "▼"}
          </span>
        </button>
        {contextOpen && (
          <div
            style={{
              padding: "0 14px 12px",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ color: "var(--color-text-muted)" }}>
              Wiadomości: {messages.length} | ~Tokeny: {approxTokens}
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleExport}
              disabled={messages.length === 0}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                color: copied ? "var(--color-primary)" : undefined,
              }}
            >
              {copied ? "Skopiowano!" : "📋 Eksportuj rozmowę"}
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={handleNewChat}
              disabled={messages.length === 0}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              🗑 Nowa rozmowa
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
          paddingBottom: 16,
        }}
      >
        {messages.length === 0 && exampleQuestions.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              paddingTop: 8,
            }}
          >
            {exampleQuestions.map((q) => (
              <button
                key={q}
                type="button"
                className="btn btn-chip"
                onClick={() => send(q)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          const text = messageText(message);
          const sources = messageSources(message);
          const toolCalls = messageToolCalls(message);
          const images = messageImages(message);

          const msgModel = messageModels[message.id];
          const badge = MODELS.find((m) => m.id === msgModel);

          return (
            <div
              key={message.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              {!isUser && badge && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 8,
                    marginBottom: 4,
                    background: badge.badgeBg,
                    color: badge.badgeColor,
                  }}
                >
                  {badge.emoji} {badge.id}
                </span>
              )}
              <div
                style={{
                  maxWidth: "75%",
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
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img.url}
                    alt={img.filename ?? "Załączony obraz"}
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      maxHeight: 200,
                      borderRadius: 8,
                      marginBottom: text ? 8 : 0,
                    }}
                  />
                ))}
                {isUser ? (
                  text
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {!isUser && toolCalls.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 6,
                    maxWidth: "75%",
                  }}
                >
                  {toolCalls.map((call, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 8,
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {call.state === "output-available" ? "✅" : "🔧"}{" "}
                      {call.name}
                      {call.url ? `: ${call.url}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {!isUser && sources.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 6,
                    maxWidth: "75%",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    Źródła:
                  </span>
                  {sources.map((source) => (
                    <a
                      key={source.sourceId}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 8,
                        background: "var(--color-primary-light)",
                        color: "var(--color-primary-hover)",
                        textDecoration: "none",
                      }}
                    >
                      🔗 {source.title || source.url}
                    </a>
                  ))}
                </div>
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
              }}
            >
              Myślę...
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
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                🔄 Spróbuj ponownie
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, paddingTop: 12 }}>
        {MODELS.map((m) => {
          const active = m.id === model;
          return (
            <button
              key={m.id}
              type="button"
              className={`btn btn-chip${active ? " active" : ""}`}
              onClick={() => setModel(m.id)}
              title={m.hint}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {m.emoji} {m.label}
            </button>
          );
        })}
      </div>

      {imageError && (
        <div
          style={{
            fontSize: 12,
            color: "var(--color-danger)",
            paddingTop: 8,
          }}
        >
          ⚠️ {imageError}
        </div>
      )}

      {attachedImage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingTop: 12,
          }}
        >
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
          padding: "12px 0 16px",
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
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          📎
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="input-field"
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || (!input.trim() && !attachedImage)}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          Wyślij
        </button>
      </form>

      {termButtons.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            paddingBottom: 16,
          }}
        >
          {termButtons.map((term) => (
            <button
              key={term}
              type="button"
              className="btn btn-chip"
              onClick={() => fillInput(term)}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {term}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
